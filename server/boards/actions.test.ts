import { readRecoveryEpoch } from '../storage/recovery-state.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomBytes, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { openDatabase, type AccountDatabase } from '../storage/database.js';
import { createOidcProvider, IDENTITY_COOKIE } from '../../tests/oidc-provider.js';
import * as Y from 'yjs';
import { syntheticCanaries } from '../../tests/access-fixtures.js';
import { imageHash } from './blobs.js';

describe('@03-08-01 board action transactions', () => {
  let provider: Awaited<ReturnType<typeof createOidcProvider>>;
  let app: FastifyInstance; let database: AccountDatabase;
  let barrier: () => Promise<void> = async () => {};
  const origin = 'http://127.0.0.1:5499';
  const actors: Record<string, { cookie: string; accountId: string }> = {};
  const cookieOf = (response: { headers: Record<string, unknown> }) => {
    const values = response.headers['set-cookie'];
    return (Array.isArray(values) ? values.at(-1) : values)?.split(';')[0] as string;
  };
  beforeEach(async () => {
    const registration = { clientId: 'synthetic-library', clientSecret: randomBytes(32).toString('hex'), redirectUri: origin + '/auth/callback' };
    provider = await createOidcProvider({ clients: [registration] }); database = openDatabase(':memory:');
    barrier = async () => {};
    app = await buildApp({ database, beforeCommit: () => barrier(), config: { DALI_ORIGIN: origin, DALI_DATABASE_PATH: ':memory:',
      DALI_SESSION_SECRET: randomBytes(32).toString('hex'), DALI_SESSION_TTL_MS: '86400000',
      DALI_OIDC_ISSUER: provider.issuer, DALI_OIDC_CLIENT_ID: registration.clientId, DALI_OIDC_CLIENT_SECRET: registration.clientSecret,
      DALI_OIDC_CALLBACK_URL: registration.redirectUri, DALI_INTERNAL_CLAIM: 'membership',
      DALI_INTERNAL_VALUES_JSON: '["internal"]', DALI_INTERNAL_EMAIL_DOMAINS_JSON: '["example.org"]' } });
    for (const identity of ['owner', 'editor', 'viewer', 'nonMember']) {
      const start = await app.inject('/auth/start');
      const authorize = await fetch(start.headers.location!, { redirect: 'manual', headers: { cookie: `${IDENTITY_COOKIE}=${identity}` } });
      const callback = new URL(authorize.headers.get('location')!);
      const response = await app.inject({ url: callback.pathname + callback.search, headers: { cookie: cookieOf(start) } });
      const cookie = cookieOf(response); const session = await app.inject({ url: '/api/session', headers: { cookie } });
      expect(session.statusCode).toBe(200); actors[identity] = { cookie, accountId: session.json().accountId };
    }
  });
  afterEach(async () => { await app?.close(); database?.close(); await provider?.close(); });
  const headers = (identity = 'owner') => ({ "x-dali-recovery-epoch": readRecoveryEpoch(database), cookie: actors[identity]!.cookie, 'x-dali-account': actors[identity]!.accountId, 'x-dali-request': '1', origin });
  const create = async (identity = 'owner', title = 'Synthetic board') => {
    const response = await app.inject({ method: 'POST', url: '/api/boards', headers: headers(identity), payload: { title, operationId: randomUUID() } });
    expect(response.statusCode).toBe(201); return response.json();
  };

  it('renames 200 graphemes with revision and idempotent acknowledgment', async () => {
    const board = await create(); const title = '👩🏽‍💻'.repeat(200);
    const payload = { title, operationId: randomUUID(), revision: board.revision };
    const rename = () => app.inject({ method: 'PATCH', url: '/api/boards/' + board.summary.id, headers: headers(), payload });
    const response = await rename(); expect(response.statusCode).toBe(200);
    expect(response.json().summary.title).toBe(title);
    expect((await rename()).json()).toEqual(response.json());
    const before = database.prepare('SELECT * FROM boards').all();
    expect((await app.inject({ method: 'PATCH', url: '/api/boards/' + board.summary.id, headers: headers(), payload: { ...payload, operationId: randomUUID(), title: title + '界' } })).statusCode).toBe(400);
    expect(database.prepare('SELECT * FROM boards').all()).toEqual(before);
  });
  const state = () => ['boards', 'board_documents', 'board_blobs', 'board_grants', 'pending_grants', 'import_staging', 'import_staging_blobs', 'operations'].map(table => database.prepare('SELECT * FROM ' + table).all());
  const grant = (boardId: string, actor: string, role = actor) => database.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?)').run(boardId, actors[actor]!.accountId, role);
  it('exact denied action matrix leaves metadata bytes images grants and staging unchanged', async () => {
    const board = await create(); const id = board.summary.id; grant(id, 'editor'); grant(id, 'viewer');
    const image = syntheticCanaries().imageBytes; database.prepare('INSERT INTO board_blobs(board_id,blob_key,mime,bytes,hash) VALUES(?,?,?,?,?)').run(id, imageHash(image), 'image/png', image, imageHash(image));
    const before = state();
    for (const actor of ['editor', 'viewer', 'nonMember']) for (const [method, suffix] of [['PATCH', ''], ['DELETE', ''], ['POST', '/duplicate'], ['GET', '/editable-export']] as const) {
      if (actor === 'editor' && method !== 'DELETE') continue;
      const result = await app.inject({ method, url: '/api/boards/' + id + suffix, headers: headers(actor), ...(method !== 'GET' ? { payload: { operationId: randomUUID(), revision: board.revision, title: 'Denied canary' } } : {}) });
      expect(result.statusCode).toBe(actor === 'nonMember' ? 404 : 403); expect(result.body).not.toContain(image.toString('base64')); expect(state()).toEqual(before);
    }
    const rename = await app.inject({ method: 'PATCH', url: '/api/boards/' + id, headers: headers('editor'), payload: { operationId: randomUUID(), revision: board.revision, title: 'Editor title' } }); expect(rename.statusCode).toBe(200);
    expect((await app.inject({ url: '/api/boards/' + id + '/editable-export', headers: headers('editor') })).statusCode).toBe(200);
  });
  it('delete removes resources grants staging and retries only the original result', async () => {
    const board = await create(); grant(board.summary.id, 'editor');
    database.prepare('INSERT INTO pending_grants(board_id,issuer,canonical_email,role) VALUES(?,?,?,?)').run(board.summary.id, provider.issuer, 'waiting@example.org', 'viewer');
    const staged = await app.inject({ method: 'POST', url: '/api/boards/' + board.summary.id + '/duplicate', headers: headers(), payload: { operationId: randomUUID(), revision: board.revision } }); expect(staged.statusCode).toBe(200);
    const payload = { operationId: randomUUID(), revision: board.revision };
    const remove = () => app.inject({ method: 'DELETE', url: '/api/boards/' + board.summary.id, headers: headers(), payload });
    expect((await remove()).json()).toEqual({ deleted: true, boardId: board.summary.id }); expect((await remove()).json()).toEqual({ deleted: true, boardId: board.summary.id });
    for (const table of ['boards', 'board_documents', 'board_blobs', 'board_grants', 'pending_grants', 'import_staging', 'import_staging_blobs']) expect(database.prepare('SELECT * FROM ' + table).all()).toEqual([]);
  });
  it('rename and delete recheck permission after the transaction scheduling barrier', async () => {
    const board = await create(); grant(board.summary.id, 'editor'); const docs = database.prepare('SELECT * FROM board_documents').all();
    barrier = async () => { database.prepare('DELETE FROM board_grants WHERE board_id=?').run(board.summary.id); };
    const result = await app.inject({ method: 'PATCH', url: '/api/boards/' + board.summary.id, headers: headers('editor'), payload: { operationId: randomUUID(), revision: 1, title: 'Rejected' } }); expect(result.statusCode).toBe(404);
    expect(database.prepare('SELECT * FROM board_documents').all()).toEqual(docs); expect(database.prepare('SELECT title FROM boards').get()).toEqual({ title: 'Synthetic board' });
  });
  it('system Viewers retain owned-board privileges and remain read-only on shared boards', async () => {
    const owned = await create('editor'); const shared = await create(); grant(shared.summary.id, 'editor');
    database.prepare("UPDATE members SET system_role='viewer' WHERE id=?").run(actors.editor!.accountId);
    const ownAccess = await app.inject({ url: '/api/boards/' + owned.summary.id, headers: headers('editor') });
    expect(ownAccess.json().summary.role).toBe('owner');
    expect(ownAccess.json().capabilities).toContain('write');
    const sharedAccess = await app.inject({ url: '/api/boards/' + shared.summary.id, headers: headers('editor') });
    expect(sharedAccess.json().summary.role).toBe('viewer');
    expect(sharedAccess.json().capabilities).not.toContain('write');
    const before = state();
    for (const [method, suffix] of [['PATCH', ''], ['POST', '/duplicate']] as const) {
      expect((await app.inject({ method, url: '/api/boards/' + shared.summary.id + suffix, headers: headers('editor'), payload: { operationId: randomUUID(), revision: 1, title: 'Denied' } })).statusCode).toBe(403);
      expect(state()).toEqual(before);
    }
    expect((await app.inject({ method: 'POST', url: '/api/imports', headers: headers('editor'), payload: { operationId: randomUUID(), title: 'Denied import', manifest: [] } })).statusCode).toBe(403);
    const renamed = await app.inject({ method: 'PATCH', url: '/api/boards/' + owned.summary.id, headers: headers('editor'), payload: { operationId: randomUUID(), revision: 1, title: 'Owned board' } });
    expect(renamed.statusCode).toBe(200);
    expect(renamed.json().summary.role).toBe('owner');
  });

  it.each(['editor', 'legacy-owner'] as const)('%s duplicate publishes complete fresh documents and images; source changes and revocation block atomically', async mode => {
    const board = await create(); grant(board.summary.id, 'editor');
    if (mode === 'legacy-owner') {
      database.prepare('UPDATE boards SET owner_id=? WHERE id=?').run(actors.editor!.accountId, board.summary.id);
      database.prepare("UPDATE members SET system_role='viewer' WHERE id=?").run(actors.editor!.accountId);
      const mine = await app.inject({ url: '/api/boards?filter=mine', headers: headers('editor') });
      expect(mine.body).toContain('owner');
      const descriptor = await app.inject({ url: '/api/boards/' + board.summary.id, headers: headers('editor') });
      expect(descriptor.json().summary.role).toBe('owner');
      expect((await app.inject({ method: 'POST', url: '/api/boards', headers: headers('editor'), payload: { title: 'Restricted new board', operationId: randomUUID() } })).statusCode).toBe(403);
    }
    const image = syntheticCanaries().imageBytes; const key = imageHash(image);
    database.prepare('INSERT INTO board_blobs(board_id,blob_key,mime,bytes,hash) VALUES(?,?,?,?,?)').run(board.summary.id, key, 'image/png', image, key);
    const source = new Y.Doc(); const stored = database.prepare('SELECT update_bytes FROM board_documents WHERE doc_id=?').get(board.contentDocId) as { update_bytes: Buffer };
    Y.applyUpdate(source, stored.update_bytes); const imageId = randomUUID(); const imageBlock = new Y.Map(); imageBlock.set('sys:id', imageId); imageBlock.set('sys:flavour', 'affine:image'); imageBlock.set('prop:sourceId', key); source.getMap('blocks').set(imageId, imageBlock);
    database.prepare('UPDATE board_documents SET update_bytes=? WHERE doc_id=?').run(Buffer.from(Y.encodeStateAsUpdate(source)), board.contentDocId);
    const before = database.prepare('SELECT * FROM board_documents WHERE board_id=?').all(board.summary.id);
    const operationId = randomUUID(); const reserve = () => app.inject({ method: 'POST', url: '/api/boards/' + board.summary.id + '/duplicate', headers: headers('editor'), payload: { operationId, revision: 1 } });
    const reserved = await reserve(); expect(reserved.statusCode).toBe(200); expect((await reserve()).json()).toEqual(reserved.json()); const d = reserved.json().result;
    const commit = () => app.inject({ method: 'POST', url: '/api/imports/' + operationId + '/commit', headers: headers('editor'), payload: {} });
    expect((await commit()).statusCode).toBe(409);
    const root = new Y.Doc(); root.getMap('spaces').set(d.contentDocId, new Y.Doc({ guid: d.contentDocId }));
    root.getMap('meta').set('pages', Y.Array.from([{ id: d.contentDocId, title: 'Synthetic copy', createDate: Date.now(), tags: [] }]));
    const content = new Y.Doc(); const replacements = new Map([...source.getMap('blocks').keys()].map(id => [id, randomUUID()]));
    source.getMap<Y.Map<unknown>>('blocks').forEach((block, id) => { const clone = block.clone(); clone.set('sys:id', replacements.get(id)); const children = clone.get('sys:children'); if (children instanceof Y.Array) clone.set('sys:children', Y.Array.from(children.toArray().map(child => replacements.get(child) ?? child))); content.getMap('blocks').set(replacements.get(id)!, clone); });
    const payload = { root: Buffer.from(Y.encodeStateAsUpdate(root)).toString('base64'), content: Buffer.from(Y.encodeStateAsUpdate(content)).toString('base64'), manifest: [key] };
    const upload = (body = payload) => app.inject({ method: 'PUT', url: '/api/imports/' + operationId + '/document', headers: headers('editor'), payload: body });
    const stagedBefore = state();
    const invalidRoot = new Y.Doc(); Y.applyUpdate(invalidRoot, Y.encodeStateAsUpdate(root)); invalidRoot.getMap('meta').delete('pages');
    expect((await upload({ ...payload, root: Buffer.from(Y.encodeStateAsUpdate(invalidRoot)).toString('base64') })).statusCode).toBe(400);
    expect(state()).toEqual(stagedBefore); invalidRoot.destroy();
    expect((await upload({ ...payload, content: Buffer.from(Y.encodeStateAsUpdate(source)).toString('base64') })).statusCode).toBe(400);
    expect((await upload()).statusCode).toBe(200); expect((await commit()).statusCode).toBe(409);
    expect((await app.inject({ method: 'PUT', url: '/api/imports/' + operationId + '/blobs/' + key, headers: { ...headers('editor'), 'content-type': 'image/png' }, payload: image })).statusCode).toBe(200);
    database.prepare('UPDATE boards SET revision=revision+1 WHERE id=?').run(board.summary.id); expect((await commit()).statusCode).toBe(409);
    database.prepare('UPDATE boards SET revision=1 WHERE id=?').run(board.summary.id);
    barrier = async () => { database.prepare('DELETE FROM board_grants WHERE board_id=?').run(board.summary.id); if (mode === 'legacy-owner') database.prepare('UPDATE boards SET owner_id=? WHERE id=?').run(actors.owner!.accountId, board.summary.id); }; expect((await commit()).statusCode).toBe(404);
    expect(database.prepare('SELECT id FROM boards').all()).toEqual([{ id: board.summary.id }]); expect(database.prepare('SELECT * FROM board_documents WHERE board_id=?').all(board.summary.id)).toEqual(before);
    barrier = async () => {}; grant(board.summary.id, 'editor'); if (mode === 'legacy-owner') database.prepare('UPDATE boards SET owner_id=? WHERE id=?').run(actors.editor!.accountId, board.summary.id); const completed = await commit(); expect(completed.statusCode).toBe(200); expect((await commit()).json()).toEqual(completed.json());
    expect(completed.json().summary).toMatchObject({ role: 'owner', access: 'private', accountId: actors.editor!.accountId }); expect(database.prepare('SELECT * FROM board_grants WHERE board_id=?').all(d.summary.id)).toEqual([]);
    expect((database.prepare('SELECT bytes FROM board_blobs WHERE board_id=?').get(d.summary.id) as { bytes: Buffer }).bytes).toEqual(image);
    expect(database.prepare('SELECT * FROM board_documents WHERE board_id=?').all(board.summary.id)).toEqual(before);
    root.destroy(); content.destroy(); source.destroy();
  });
});
