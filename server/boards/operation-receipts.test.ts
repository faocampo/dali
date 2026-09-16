import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { randomBytes, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import * as Y from 'yjs';
import { buildApp } from '../app.js';
import { openDatabase, type AccountDatabase } from '../storage/database.js';
import { createOidcProvider, IDENTITY_COOKIE } from '../../tests/oidc-provider.js';

describe('@03-12-receipts current authority and acknowledgment reconciliation', () => {
  let app: FastifyInstance; let database: AccountDatabase; let provider: Awaited<ReturnType<typeof createOidcProvider>>;
  const actors: Record<string, { cookie: string; accountId: string }> = {};
  const origin = 'http://127.0.0.1:5499';
  const cookieOf = (response: { headers: Record<string, unknown> }) => { const v = response.headers['set-cookie']; return (Array.isArray(v) ? v.at(-1) : v)?.split(';')[0] as string; };
  beforeEach(async () => {
    const registration = { clientId: 'synthetic-receipts', clientSecret: randomBytes(32).toString('hex'), redirectUri: origin + '/auth/callback' };
    provider = await createOidcProvider({ clients: [registration] }); database = openDatabase(':memory:');
    app = await buildApp({ database, config: { DALI_ORIGIN: origin, DALI_DATABASE_PATH: ':memory:', DALI_SESSION_SECRET: randomBytes(32).toString('hex'), DALI_SESSION_TTL_MS: '86400000', DALI_OIDC_ISSUER: provider.issuer, DALI_OIDC_CLIENT_ID: registration.clientId, DALI_OIDC_CLIENT_SECRET: registration.clientSecret, DALI_OIDC_CALLBACK_URL: registration.redirectUri, DALI_INTERNAL_CLAIM: 'membership', DALI_INTERNAL_VALUES_JSON: '["internal"]', DALI_INTERNAL_EMAIL_DOMAINS_JSON: '["example.org"]' } });
    for (const role of ['owner', 'editor', 'viewer']) {
      const start = await app.inject('/auth/start'); const authorization = await fetch(start.headers.location!, { redirect: 'manual', headers: { cookie: `${IDENTITY_COOKIE}=${role}` } }); const callback = new URL(authorization.headers.get('location')!);
      const response = await app.inject({ url: callback.pathname + callback.search, headers: { cookie: cookieOf(start) } }); const cookie = cookieOf(response);
      const session = await app.inject({ url: '/api/session', headers: { cookie } }); expect(session.statusCode).toBe(200); actors[role] = { cookie, accountId: session.json().accountId };
    }
  });
  afterEach(async () => { await app.close(); database.close(); await provider.close(); });
  const h = (role = 'owner') => ({ cookie: actors[role]!.cookie, origin, 'x-dali-request': '1', 'x-dali-account': actors[role]!.accountId });
  const create = async () => { const response = await app.inject({ method: 'POST', url: '/api/boards', headers: h(), payload: { operationId: randomUUID(), title: 'Synthetic receipt source' } }); expect(response.statusCode).toBe(201); return response.json(); };
  it('returns current grant state and denies a former owner access to stored grant identities', async () => {
    const board = await create(); const operationId = randomUUID();
    const grant = await app.inject({ method: 'POST', url: `/api/boards/${board.summary.id}/grants`, headers: h(), payload: { operationId, revision: board.revision, memberId: actors.viewer!.accountId } }); expect(grant.statusCode).toBe(200);
    const g = grant.json().grants[0];
    expect((await app.inject({ method: 'DELETE', url: `/api/boards/${board.summary.id}/grants/${g.id}`, headers: h(), payload: { operationId: randomUUID(), revision: g.revision } })).statusCode).toBe(200);
    expect((await app.inject({ url: '/api/operations/' + operationId, headers: h() })).json().result.grants).toEqual([]);
    database.prepare('UPDATE boards SET owner_id=? WHERE id=?').run(actors.editor!.accountId, board.summary.id);
    database.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?)').run(board.summary.id, actors.owner!.accountId, 'editor');
    const denied = await app.inject({ url: '/api/operations/' + operationId, headers: h() }); expect(denied.statusCode).toBe(403); expect(denied.body).not.toContain(actors.viewer!.accountId);
  });
  it('denies revoked source staging but reconciles a completed private duplicate against its destination', async () => {
    const source = await create(); const id = source.summary.id;
    database.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?)').run(id, actors.editor!.accountId, 'editor');
    const operationId = randomUUID(); const response = await app.inject({ method: 'POST', url: `/api/boards/${id}/duplicate`, headers: h('editor'), payload: { operationId, revision: source.revision } }); expect(response.statusCode).toBe(200); const d = response.json().result;
    database.prepare('DELETE FROM board_grants WHERE board_id=?').run(id);
    for (const prefix of ['/api/operations/', '/api/imports/']) expect((await app.inject({ url: prefix + operationId, headers: h('editor') })).statusCode).toBe(404);
    database.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?)').run(id, actors.editor!.accountId, 'editor');
    const root = new Y.Doc({ guid: d.rootDocId }); const content = new Y.Doc({ guid: d.contentDocId }); root.getMap('spaces').set(d.contentDocId, content);
    root.getMap('meta').set('pages', Y.Array.from([{ id: d.contentDocId, title: 'Synthetic copy', createDate: Date.now(), tags: [] }]));
    for (const flavour of ['affine:page', 'affine:surface']) { const block = new Y.Map(); const blockId = randomUUID(); block.set('sys:id', blockId); block.set('sys:flavour', flavour); content.getMap('blocks').set(blockId, block); }
    const payload = { root: Buffer.from(Y.encodeStateAsUpdate(root)).toString('base64'), content: Buffer.from(Y.encodeStateAsUpdate(content)).toString('base64'), manifest: [] }; root.destroy(); content.destroy();
    expect((await app.inject({ method: 'PUT', url: `/api/imports/${operationId}/document`, headers: h('editor'), payload })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: `/api/imports/${operationId}/commit`, headers: h('editor'), payload: {} })).statusCode).toBe(200);
    database.prepare('DELETE FROM board_grants WHERE board_id=?').run(id);
    for (const prefix of ['/api/operations/', '/api/imports/']) { const receipt = await app.inject({ url: prefix + operationId, headers: h('editor') }); expect(receipt.statusCode).toBe(200); expect(receipt.json().result.summary.id).toBe(d.summary.id); expect(receipt.json().result.summary.role).toBe('owner'); }
    expect((await app.inject({ method: 'POST', url: `/api/imports/${operationId}/commit`, headers: h('editor'), payload: {} })).json().summary.id).toBe(d.summary.id);
    const before = database.prepare('SELECT * FROM boards ORDER BY id').all();
    expect((await app.inject({ url: '/api/imports/' + operationId, headers: h('viewer') })).json()).toEqual({ status: 'unknown' });
    expect(database.prepare('SELECT * FROM boards ORDER BY id').all()).toEqual(before);
  });
});
