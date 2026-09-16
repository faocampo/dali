import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import * as Y from 'yjs';
import { buildApp } from '../app.js';
import { openDatabase, type AccountDatabase } from '../storage/database.js';
import { createOidcProvider, IDENTITY_COOKIE } from '../../tests/oidc-provider.js';
import { syntheticCanaries } from '../../tests/access-fixtures.js';

describe('protected board resources', () => {
  let app: FastifyInstance; let database: AccountDatabase;
  let provider: Awaited<ReturnType<typeof createOidcProvider>>;
  let barrier: () => Promise<void>; let clock: number;
  const origin = 'http://127.0.0.1:5499';
  const actors: Record<string, { cookie: string; accountId: string }> = {};
  type Descriptor = { summary: { id: string }; rootDocId: string; contentDocId: string };
  let board: Descriptor; let foreign: Descriptor;
  const cookieOf = (response: { headers: Record<string, unknown> }) => {
    const values = response.headers['set-cookie'];
    return (Array.isArray(values) ? values.at(-1) : values)?.split(';')[0] as string;
  };
  const headers = (actor = 'owner') => ({ cookie: actors[actor]!.cookie, 'x-dali-account': actors[actor]!.accountId, 'x-dali-request': '1', origin });
  const bytes = (id = board.contentDocId, b = board) => (database.prepare('SELECT update_bytes FROM board_documents WHERE board_id=? AND doc_id=?').get(b.summary.id, id) as { update_bytes: Buffer }).update_bytes;
  const snapshot = () => ({ docs: database.prepare('SELECT * FROM board_documents ORDER BY board_id,doc_id').all(), boards: database.prepare('SELECT * FROM boards ORDER BY id').all(), previews: database.prepare('SELECT * FROM board_thumbnails ORDER BY board_id').all() });
  const requestDoc = (action: string, payload: Uint8Array, actor = 'owner', id = board.contentDocId, b = board, extra = {}) => app.inject({ method: 'POST', url: `/api/boards/${b.summary.id}/docs/${id}/${action}`, headers: { ...headers(actor), 'content-type': 'application/octet-stream', ...extra }, payload: Buffer.from(payload) });
  const edit = (text = 'authorized-text') => {
    const doc = new Y.Doc(); Y.applyUpdate(doc, bytes()); const state = Y.encodeStateVector(doc);
    doc.getMap('blocks').forEach(value => { if ((value as Y.Map<unknown>).get('sys:flavour') === 'affine:page') ((value as Y.Map<unknown>).get('prop:title') as Y.Text).insert(0, text); });
    const update = Y.encodeStateAsUpdate(doc, state); doc.destroy(); return update;
  };
  beforeEach(async () => {
    clock = Date.now(); barrier = async () => {};
    const registration = { clientId: 'synthetic-resources', clientSecret: randomBytes(32).toString('hex'), redirectUri: origin + '/auth/callback' };
    provider = await createOidcProvider({ clients: [registration] }); database = openDatabase(':memory:');
    app = await buildApp({ database, now: () => clock, beforeCommit: () => barrier(), config: {
      DALI_ORIGIN: origin, DALI_DATABASE_PATH: ':memory:', DALI_SESSION_SECRET: randomBytes(32).toString('hex'), DALI_SESSION_TTL_MS: '86400000',
      DALI_OIDC_ISSUER: provider.issuer, DALI_OIDC_CLIENT_ID: registration.clientId, DALI_OIDC_CLIENT_SECRET: registration.clientSecret,
      DALI_OIDC_CALLBACK_URL: registration.redirectUri, DALI_INTERNAL_CLAIM: 'membership', DALI_INTERNAL_VALUES_JSON: '["internal"]', DALI_INTERNAL_EMAIL_DOMAINS_JSON: '["example.org"]',
    } });
    for (const identity of ['owner', 'editor', 'viewer', 'nonMember']) {
      const start = await app.inject('/auth/start');
      const authorize = await fetch(start.headers.location!, { redirect: 'manual', headers: { cookie: `${IDENTITY_COOKIE}=${identity}` } });
      const callback = new URL(authorize.headers.get('location')!);
      const response = await app.inject({ url: callback.pathname + callback.search, headers: { cookie: cookieOf(start) } });
      const cookie = cookieOf(response); const session = await app.inject({ url: '/api/session', headers: { cookie } });
      expect(session.statusCode).toBe(200); actors[identity] = { cookie, accountId: session.json().accountId };
    }
    const create = async (actor: string, title: string) => {
      const response = await app.inject({ method: 'POST', url: '/api/boards', headers: headers(actor), payload: { title, operationId: randomUUID() } });
      expect(response.statusCode).toBe(201); return response.json() as Descriptor;
    };
    board = await create('owner', 'Owner canary'); foreign = await create('nonMember', 'Foreign private canary');
    for (const role of ['editor', 'viewer']) database.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?)').run(board.summary.id, actors[role]!.accountId, role);
  });
  afterEach(async () => { await app?.close(); database?.close(); await provider?.close(); });
  const blobKey = (data: Buffer) => createHash('sha256').update(data).digest('base64url');
  const image = (method: 'GET' | 'PUT' | 'DELETE', key: string, actor = 'owner', b = board, payload?: Buffer, extra = {}) => app.inject({ method, url: `/api/boards/${b.summary.id}/blobs/${key}`, headers: { ...headers(actor), 'content-type': 'image/png', ...extra }, ...(payload ? { payload } : {}) });
  it('@03-04-02 uploaded image owner reread preserves hash and cross-board keys confer no access', async () => {
    const data = syntheticCanaries().imageBytes; const key = blobKey(data);
    expect((await image('PUT', key, 'editor', board, data)).statusCode).toBe(200);
    const response = await image('GET', key); expect(response.statusCode).toBe(200); expect(response.rawPayload).toEqual(data); expect(blobKey(response.rawPayload)).toBe(key);
    expect(response.headers['cache-control']).toBe('private, no-store');
    const deny = await image('GET', key, 'owner', foreign); expect(deny.statusCode).toBe(404); expect(deny.rawPayload.includes(data)).toBe(false);
    expect((await image('GET', key)).rawPayload).toEqual(data);
    expect((await image('PUT', key, 'nonMember', foreign, data)).statusCode).toBe(200);
    expect((await image('GET', key, 'nonMember', foreign)).rawPayload).toEqual(data);
    expect((await app.inject({ url: `/api/boards/${board.summary.id}/blobs`, headers: headers('viewer') })).json()).toEqual([key]);
  });

  it('@03-04-01 editor update round-trips through reader pull and replay converges', async () => {
    const update = edit();
    expect((await requestDoc('push', update, 'editor')).statusCode).toBe(200);
    const saved = Buffer.from(bytes()); const vector = Y.encodeStateVectorFromUpdate(saved);
    const read = await requestDoc('pull', new Uint8Array([0]), 'viewer');
    expect(read.statusCode).toBe(200); expect(read.headers['cache-control']).toBe('private, no-store');
    const doc = new Y.Doc(); Y.applyUpdate(doc, read.rawPayload);
    expect(JSON.stringify(doc.getMap('blocks').toJSON())).toContain('authorized-text');
    expect(Y.encodeStateVector(doc)).toEqual(vector);
    expect((await requestDoc('push', update, 'editor')).statusCode).toBe(200);
    expect(bytes()).toEqual(saved); expect(Y.encodeStateVectorFromUpdate(bytes())).toEqual(vector); doc.destroy();
  });
  it('@03-04-01 repeated denials preserve owner bytes, state vectors and foreign canaries', async () => {
    const before = snapshot(); const vector = Y.encodeStateVectorFromUpdate(bytes());
    const cases = [
      { actor: 'viewer', status: 403 }, { actor: 'nonMember', status: 404 },
      { actor: 'owner', status: 409, extra: { 'x-dali-account': actors.viewer!.accountId } },
      { actor: 'owner', status: 403, extra: { origin: origin + '.evil.example.org' } },
      { actor: 'owner', status: 403, extra: { 'x-dali-request': '' } },
      { actor: 'owner', status: 403, extra: { 'content-type': 'text/plain' } },
    ];
    for (const test of cases) for (let i = 0; i < 2; i++) {
      const response = await requestDoc('push', edit(), test.actor, board.contentDocId, board, test.extra);
      expect(response.statusCode).toBe(test.status); expect(response.body).not.toContain('Owner canary'); expect(response.body).not.toContain('Foreign private canary');
      const owner = await requestDoc('pull', new Uint8Array([0])); expect(owner.statusCode).toBe(200);
      expect(owner.rawPayload).toEqual(bytes()); expect(snapshot()).toEqual(before); expect(Y.encodeStateVectorFromUpdate(owner.rawPayload)).toEqual(vector);
    }
    for (const action of ['pull', 'push']) for (const id of [foreign.rootDocId, foreign.contentDocId, 'unknown']) {
      const response = await requestDoc(action, new Uint8Array([0]), 'owner', id);
      expect(response.statusCode).toBe(404); expect(response.json()).toEqual({ code: 'BOARD_UNAVAILABLE' }); expect(response.body).not.toContain('Foreign private canary'); expect(snapshot()).toEqual(before);
    }
  });
  it('@03-04-01 malformed, oversized and foreign subdocument updates never persist', async () => {
    const before = snapshot();
    const root = new Y.Doc(); Y.applyUpdate(root, bytes(board.rootDocId)); root.getMap('spaces').set(foreign.contentDocId, new Y.Doc({ guid: foreign.contentDocId }));
    const content = new Y.Doc(); Y.applyUpdate(content, bytes()); content.getMap('spaces').set('foreign', new Y.Doc({ guid: foreign.contentDocId }));
    for (const [id, payload] of [[board.rootDocId, Y.encodeStateAsUpdate(root)], [board.contentDocId, Y.encodeStateAsUpdate(content)], [board.contentDocId, new Uint8Array([255])], [board.contentDocId, new Uint8Array(8 * 1024 * 1024 + 1)]] as const) {
      const response = await requestDoc('push', payload, 'owner', id); expect([400, 413]).toContain(response.statusCode); expect(response.body).not.toContain('Foreign private canary'); expect(snapshot()).toEqual(before);
      expect((await requestDoc('pull', new Uint8Array([0]))).rawPayload).toEqual(bytes());
    }
    for (const payload of [new Uint8Array([255]), new Uint8Array(65537)]) { const response = await requestDoc('pull', payload); expect([400, 413]).toContain(response.statusCode); expect(snapshot()).toEqual(before); }
    root.destroy(); content.destroy();
  });
  it.each(['revoke', 'expire', 'identity', 'failure'])('@03-04-01 commit barrier %s prevents acknowledgment and storage', async mode => {
    const before = snapshot(); const update = edit();
    barrier = async () => {
      if (mode === 'revoke') database.prepare('DELETE FROM board_grants WHERE board_id=? AND member_id=?').run(board.summary.id, actors.editor!.accountId);
      if (mode === 'expire') database.prepare('UPDATE sessions SET expires_at=? WHERE member_id=?').run(clock, actors.editor!.accountId);
      if (mode === 'identity') database.prepare('UPDATE sessions SET member_id=? WHERE member_id=?').run(actors.viewer!.accountId, actors.editor!.accountId);
      if (mode === 'failure') throw new Error('Synthetic commit failure');
    };
    const response = await requestDoc('push', update, 'editor'); expect(response.statusCode).toBe({ revoke: 404, expire: 401, identity: 409, failure: 500 }[mode]);
    expect(response.body).not.toContain('Owner canary'); expect(snapshot()).toEqual(before);
    expect((await requestDoc('pull', new Uint8Array([0]))).rawPayload).toEqual(bytes());
  });
});
