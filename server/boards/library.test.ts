import { readRecoveryEpoch } from '../storage/recovery-state.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomBytes, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { openDatabase, type AccountDatabase } from '../storage/database.js';
import { createOidcProvider, IDENTITY_COOKIE } from '../../tests/oidc-provider.js';
import * as Y from 'yjs';
import { syntheticCanaries } from '../../tests/access-fixtures.js';
import { canBoard, boardCapabilities } from './routes.js';

describe('@03-03-02 authorized SQL library', () => {
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
  it('@03-06-01 thumbnail publication validates PNG and preserves data on denied writes', async () => {
    const board = await create(); const foreign = await create('nonMember'); const png = syntheticCanaries().imageBytes;
    const put = (id = board.summary.id, identity = 'owner', payload = png) => app.inject({ method: 'PUT', url: `/api/boards/${id}/thumbnail`, headers: { ...headers(identity), 'content-type': 'image/png' }, payload });
    expect((await put()).statusCode).toBe(200);
    const before = database.prepare('SELECT * FROM board_thumbnails').all();
    database.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?)').run(board.summary.id, actors.viewer!.accountId, 'viewer');
    expect((await put(board.summary.id, 'viewer')).statusCode).toBe(403);
    expect((await put(foreign.summary.id)).statusCode).toBe(404);
    expect((await put('absent')).statusCode).toBe(404);
    expect((await put(board.summary.id, 'owner', Buffer.from('invalid'))).statusCode).toBe(400);
    expect((await put(board.summary.id, 'owner', Buffer.alloc(512 * 1024 + 1))).statusCode).toBe(413);
    expect(database.prepare('SELECT * FROM board_thumbnails').all()).toEqual(before);
    const read = await app.inject({ url: `/api/boards/${board.summary.id}/thumbnail`, headers: headers() });
    expect(read.rawPayload).toEqual(png); expect(read.headers['cache-control']).toBe('private, no-store');
    database.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?)').run(board.summary.id, actors.editor!.accountId, 'editor');
    barrier = async () => { database.prepare('DELETE FROM board_grants WHERE board_id=? AND member_id=?').run(board.summary.id, actors.editor!.accountId); };
    expect((await put(board.summary.id, 'editor')).statusCode).toBe(404);
    expect(database.prepare('SELECT * FROM board_thumbnails').all()).toEqual(before);
  });
  it('owner precedence returns one shared card when a redundant grant exists', async () => {
    const board = await create();
    database.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?)').run(board.summary.id, actors.owner!.accountId, 'viewer');
    const response = await app.inject({ url: '/api/boards', headers: headers() });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([{ ...board.summary, role: 'owner', access: 'shared' }]);
  });
  it('BOARD-01/02 ordering and adjacency retain SQL stable order and correct filters without foreign metadata', async () => {
    const a = await create('owner', 'Same title'); const b = await create('owner', 'Same title');
    const shared = await create('editor', 'Granted board'); const foreign = await create('nonMember', 'foreign-canary');
    for (const board of [a, b, shared, foreign]) database.prepare('UPDATE boards SET updated_at=1000 WHERE id=?').run(board.summary.id);
    database.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?)').run(shared.summary.id, actors.owner!.accountId, 'viewer');
    const get = async (filter: string) => (await app.inject({ url: '/api/boards?filter=' + filter, headers: headers() })).json();
    const all = await get('all'); const mine = await get('mine'); const theirs = await get('shared');
    expect(all.map((row: { id: string }) => row.id)).toEqual([a.summary.id, b.summary.id, shared.summary.id].sort());
    expect(mine.map((row: { id: string }) => row.id)).toEqual([a.summary.id, b.summary.id].sort());
    expect(theirs).toHaveLength(1); expect(theirs[0]).toMatchObject({ id: shared.summary.id, role: 'viewer', access: 'shared', accountId: actors.owner!.accountId });
    expect(JSON.stringify(all)).not.toContain('foreign-canary'); expect(JSON.stringify(all)).not.toContain(foreign.rootDocId);
    database.prepare('UPDATE boards SET updated_at=2000 WHERE id=?').run(a.summary.id);
    expect((await get('all'))[0].id).toBe(a.summary.id); expect((await get('mine'))[0].id).toBe(a.summary.id);
  });
  it('pending-only sharing is authoritative and private returns after the last grant disappears', async () => {
    const board = await create();
    database.prepare('INSERT INTO pending_grants(board_id,issuer,canonical_email,role) VALUES(?,?,?,?)').run(board.summary.id, provider.issuer, 'pending@example.org', 'viewer');
    const detail = () => app.inject({ url: '/api/boards/' + board.summary.id, headers: headers() });
    expect((await detail()).json().summary).toMatchObject({ access: 'shared', pendingCount: 1, role: 'owner' });
    database.prepare('DELETE FROM pending_grants WHERE board_id=?').run(board.summary.id);
    expect((await detail()).json().summary).toMatchObject({ access: 'private', pendingCount: 0 });
    for (const filter of ['all', 'mine', 'shared']) expect((await app.inject({ url: '/api/boards?filter=' + filter, headers: headers('nonMember') })).json()).toEqual([]);
  });
  it('BOARD-02 encoding and bounds preserve 200 graphemes and reject 201 without creating', async () => {
    const title = '👩🏽‍💻'.repeat(200); const board = await create('owner', title);
    expect(board.summary.title).toBe(title);
    const rejected = await app.inject({ method: 'POST', url: '/api/boards', headers: headers(), payload: { title: '界'.repeat(201), operationId: randomUUID() } });
    expect(rejected.statusCode).toBe(400);
    expect((database.prepare('SELECT count(*) AS n FROM boards').get() as { n: number }).n).toBe(1);
  });
  it('same-title roots contain exactly their own subdocument, independent page blocks and grants', async () => {
    const a = await create(); const b = await create(); const blocks: string[][] = [];
    for (const board of [a, b]) {
      const root = new Y.Doc(); const content = new Y.Doc();
      const bytes = (id: string) => (database.prepare('SELECT update_bytes FROM board_documents WHERE board_id=? AND doc_id=?').get(board.summary.id, id) as { update_bytes: Buffer }).update_bytes;
      Y.applyUpdate(root, bytes(board.rootDocId)); Y.applyUpdate(content, bytes(board.contentDocId));
      expect([...root.getMap('spaces').keys()]).toEqual([board.contentDocId]);
      expect((root.getMap('spaces').get(board.contentDocId) as Y.Doc).guid).toBe(board.contentDocId);
      const pages = root.getMap('meta').get('pages') as Y.Array<Y.Map<unknown>>;
      expect(pages).toBeInstanceOf(Y.Array);
      expect(pages.length).toBe(1);
      expect(pages.get(0)).toBeInstanceOf(Y.Map);
      expect(pages.get(0).toJSON()).toMatchObject({ id: board.contentDocId, title: board.summary.title, tags: [] });
      expect(pages.get(0).get('createDate')).toEqual(expect.any(Number));
      blocks.push([...content.getMap('blocks').keys()]); expect(blocks.at(-1)).toHaveLength(2);
      const surface = [...content.getMap<Y.Map<unknown>>('blocks').values()].find(block => block.get('sys:flavour') === 'affine:surface')!;
      const elements = surface.get('prop:elements') as Y.Map<unknown>;
      expect(elements.get('type')).toBe('$blocksuite:internal:native$');
      expect(elements.get('value')).toBeInstanceOf(Y.Map);
      expect(database.prepare('SELECT * FROM board_documents WHERE board_id=? AND doc_id=?').get(a.summary.id, b.contentDocId)).toBeUndefined();
      root.destroy(); content.destroy();
    }
    expect(new Set(blocks.flat()).size).toBe(4);
    expect(database.prepare('SELECT * FROM board_grants').all()).toEqual([]);
  });
  it('T-03-05 thumbnail checks current role and account and denies foreign image bytes without state change', async () => {
    const a = await create(); const b = await create('nonMember', 'Foreign image board');
    const one = syntheticCanaries(); const two = syntheticCanaries();
    database.prepare('INSERT INTO board_thumbnails(board_id,bytes,mime) VALUES(?,?,?)').run(a.summary.id, one.imageBytes, 'image/png');
    database.prepare('INSERT INTO board_thumbnails(board_id,bytes,mime) VALUES(?,?,?)').run(b.summary.id, two.imageBytes, 'image/png');
    database.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?)').run(a.summary.id, actors.viewer!.accountId, 'viewer');
    const before = database.prepare('SELECT * FROM board_thumbnails ORDER BY board_id').all();
    const get = (id: string, identity = 'owner') => app.inject({ url: '/api/boards/' + id + '/thumbnail', headers: headers(identity) });
    const allowed = await get(a.summary.id, 'viewer'); expect(allowed.statusCode).toBe(200);
    expect(allowed.rawPayload).toEqual(one.imageBytes); expect(allowed.rawPayload).not.toEqual(two.imageBytes);
    expect(allowed.headers['cache-control']).toBe('private, no-store'); expect(allowed.headers['x-dali-account']).toBe(actors.viewer!.accountId);
    for (const id of [b.summary.id, 'absent']) { const denied = await get(id); expect(denied.statusCode).toBe(404); expect(denied.json()).toEqual({ code: 'BOARD_UNAVAILABLE' }); expect(denied.rawPayload.includes(two.imageBytes)).toBe(false); }
    database.prepare('DELETE FROM board_grants WHERE board_id=?').run(a.summary.id);
    expect((await get(a.summary.id, 'viewer')).statusCode).toBe(404);
    const mismatch = await app.inject({ url: '/api/boards/' + a.summary.id + '/thumbnail', headers: { ...headers(), 'x-dali-account': actors.viewer!.accountId } });
    expect(mismatch.statusCode).toBe(409); expect(mismatch.rawPayload.includes(one.imageBytes)).toBe(false);
    expect(database.prepare('SELECT * FROM board_thumbnails ORDER BY board_id').all()).toEqual(before);
  });
  it('capability enums match owner editor viewer and deny unauthenticated reads/mutations', async () => {
    expect(boardCapabilities.filter(cap => canBoard('viewer', cap))).toEqual(['read', 'image', 'presentation-export']);
    expect(boardCapabilities.filter(cap => canBoard('editor', cap))).toEqual(['read', 'image', 'presentation-export', 'write', 'rename', 'editable-export', 'duplicate']);
    expect(boardCapabilities.every(cap => canBoard('owner', cap))).toBe(true);
    expect(boardCapabilities.some(cap => canBoard(undefined, cap))).toBe(false);
    expect((await app.inject('/api/boards')).statusCode).toBe(401);
    for (const invalid of [{ ...headers(), origin: 'https://foreign.example.org' }, { ...headers(), 'x-dali-request': '' }, { ...headers(), 'x-dali-account': actors.viewer!.accountId }]) {
      const response = await app.inject({ method: 'POST', url: '/api/boards', headers: invalid, payload: { operationId: randomUUID() } });
      expect([403, 409]).toContain(response.statusCode);
    }
    expect(database.prepare('SELECT * FROM boards').all()).toEqual([]);
  });
});
