import { readRecoveryEpoch } from '../storage/recovery-state.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import * as Y from 'yjs';
import { buildApp } from '../app.js';
import { openDatabase, type AccountDatabase } from '../storage/database.js';
import { createOidcProvider, IDENTITY_COOKIE } from '../../tests/oidc-provider.js';
import { syntheticCanaries } from '../../tests/access-fixtures.js';
import { IMAGE_LIMITS } from './blobs.js';

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
  const headers = (actor = 'owner') => ({ "x-dali-recovery-epoch": readRecoveryEpoch(database), cookie: actors[actor]!.cookie, 'x-dali-account': actors[actor]!.accountId, 'x-dali-request': '1', origin });
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
  const blobKey = (data: Buffer) => createHash('sha256').update(data).digest('base64').replace(/\+/g, '-').replace(/\//g, '_');
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
  it('@03-04-02 repeated viewer identity CSRF and guessed-key denials preserve document vectors and image hashes', async () => {
    const data = syntheticCanaries().imageBytes; const key = blobKey(data); const other = syntheticCanaries().imageBytes;
    expect((await image('PUT', key, 'owner', board, data)).statusCode).toBe(200);
    expect((await image('PUT', blobKey(other), 'nonMember', foreign, other)).statusCode).toBe(200);
    const before = snapshot(); const blobs = database.prepare('SELECT * FROM board_blobs ORDER BY board_id,blob_key').all();
    for (const method of ['PUT', 'DELETE'] as const) for (const actor of ['viewer', 'nonMember']) for (let i = 0; i < 2; i++) {
      const response = await image(method, key, actor, board, method === 'PUT' ? data : undefined);
      expect(response.statusCode).toBe(actor === 'viewer' ? 403 : 404); expect(response.rawPayload.includes(data)).toBe(false); expect(response.rawPayload.includes(other)).toBe(false);
      expect((await image('GET', key)).rawPayload).toEqual(data); expect((await requestDoc('pull', new Uint8Array([0]))).rawPayload).toEqual(bytes());
      expect(snapshot()).toEqual(before); expect(database.prepare('SELECT * FROM board_blobs ORDER BY board_id,blob_key').all()).toEqual(blobs);
    }
    for (const extra of [{ origin: 'https://foreign.example.org' }, { 'x-dali-request': '' }, { 'x-dali-account': actors.viewer!.accountId }]) {
      const response = await image('PUT', key, 'owner', board, data, extra); expect([403, 409]).toContain(response.statusCode); expect(snapshot()).toEqual(before); expect((await image('GET', key)).rawPayload).toEqual(data);
    }
    for (const key of [blobKey(other), 'guessed', '..%2Fsecret']) { const denied = await image('GET', key); expect(denied.statusCode).toBe(404); expect(denied.rawPayload.includes(other)).toBe(false); }
    expect((await app.inject({ url: `/api/boards/${foreign.summary.id}/blobs`, headers: headers() })).statusCode).toBe(404);
  });
  it('@03-04-02 referenced image deletion conflicts and foreign image references never commit', async () => {
    const data = syntheticCanaries().imageBytes; const key = blobKey(data);
    expect((await image('PUT', key, 'owner', board, data)).statusCode).toBe(200);
    const doc = new Y.Doc(); Y.applyUpdate(doc, bytes()); const imageBlock = new Y.Map<unknown>();
    imageBlock.set('sys:id', 'image'); imageBlock.set('sys:flavour', 'affine:image'); imageBlock.set('prop:sourceId', key); doc.getMap('blocks').set('image', imageBlock);
    expect((await requestDoc('push', Y.encodeStateAsUpdate(doc))).statusCode).toBe(200); const before = snapshot();
    for (let i = 0; i < 2; i++) { expect((await image('DELETE', key, 'editor')).statusCode).toBe(409); expect((await image('GET', key)).rawPayload).toEqual(data); expect(snapshot()).toEqual(before); }
    const other = syntheticCanaries().imageBytes; const foreignKey = blobKey(other); await image('PUT', foreignKey, 'nonMember', foreign, other);
    imageBlock.set('prop:sourceId', foreignKey); expect((await requestDoc('push', Y.encodeStateAsUpdate(doc))).statusCode).toBe(400); expect(snapshot()).toEqual(before);
    imageBlock.set('prop:sourceId', key); doc.getMap('blocks').delete('image'); expect((await requestDoc('push', Y.encodeStateAsUpdate(doc))).statusCode).toBe(200);
    expect((await image('DELETE', key, 'editor')).statusCode).toBe(200); expect((await image('GET', key)).json()).toEqual({ code: 'IMAGE_UNAVAILABLE' }); doc.destroy();
  });
  it('@03-04-02 malformed bytes pixel overflow wrong hash active formats and quota failures preserve state', async () => {
    const data = syntheticCanaries().imageBytes; const key = blobKey(data); await image('PUT', key, 'owner', board, data); const before = snapshot();
    const huge = Buffer.from(data); huge.writeUInt32BE(8193, 16);
    let crc = 0xffffffff; for (const byte of huge.subarray(12, 29)) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); } huge.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 29);
    for (const invalid of [data.subarray(0, 24), Buffer.from('<svg/>'), huge, Buffer.alloc(16 * 1024 * 1024 + 1)]) {
      const denied = await image('PUT', blobKey(invalid), 'owner', board, invalid); expect([400, 413]).toContain(denied.statusCode); expect((await image('GET', key)).rawPayload).toEqual(data); expect(snapshot()).toEqual(before);
    }
    expect((await image('PUT', key, 'owner', board, data, { 'content-type': 'image/svg+xml' })).statusCode).toBe(403);
    expect((await image('PUT', 'a'.repeat(43), 'owner', board, data)).statusCode).toBe(400);
    const limit = IMAGE_LIMITS.boardBytes;
    try {
      IMAGE_LIMITS.boardBytes = data.length;
      const overQuota = syntheticCanaries().imageBytes;
      expect((await image('PUT', blobKey(overQuota), 'owner', board, overQuota)).statusCode).toBe(413);
      expect((await image('GET', key)).rawPayload).toEqual(data); expect(snapshot()).toEqual(before);
    } finally { IMAGE_LIMITS.boardBytes = limit; }
    database.exec("CREATE TRIGGER fail_blob BEFORE INSERT ON board_blobs BEGIN SELECT RAISE(ABORT, 'synthetic storage failure'); END");
    const newData = syntheticCanaries().imageBytes; expect((await image('PUT', blobKey(newData), 'owner', board, newData)).statusCode).toBe(500);
    expect((await image('GET', key)).rawPayload).toEqual(data); expect(snapshot()).toEqual(before);
  });
  it('@03-04-02 valid JPEG round-trips and truncated or oversized JPEG headers are rejected', async () => {
    // Synthetic 2x2 canvas export; ICC metadata omitted.
    const data = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAACAAIDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AJVAA//Z', 'base64');
    const key = blobKey(data); expect((await image('PUT', key, 'editor', board, data, { 'content-type': 'image/jpeg' })).statusCode).toBe(200);
    expect((await image('GET', key, 'viewer')).rawPayload).toEqual(data); const before = snapshot();
    const huge = Buffer.from(data); const frame = huge.indexOf(Buffer.from([255, 192])); huge.writeUInt16BE(8193, frame + 7);
    for (const invalid of [data.subarray(0, data.length - 2), huge]) {
      const response = await image('PUT', blobKey(invalid), 'editor', board, invalid, { 'content-type': 'image/jpeg' }); expect(response.statusCode).toBe(400);
      expect((await image('GET', key)).rawPayload).toEqual(data); expect(snapshot()).toEqual(before);
    }
  });
  it.each(['revoke', 'expire', 'identity'])('@03-04-02 late %s rejects image set and delete without changing hashes', async mode => {
    const data = syntheticCanaries().imageBytes; const key = blobKey(data); await image('PUT', key, 'owner', board, data);
    const before = snapshot(); const blobs = database.prepare('SELECT * FROM board_blobs').all();
    barrier = async () => {
      if (mode === 'revoke') database.prepare('DELETE FROM board_grants WHERE board_id=? AND member_id=?').run(board.summary.id, actors.editor!.accountId);
      if (mode === 'expire') database.prepare('UPDATE sessions SET expires_at=? WHERE member_id=?').run(clock, actors.editor!.accountId);
      if (mode === 'identity') database.prepare('UPDATE sessions SET member_id=? WHERE member_id=?').run(actors.viewer!.accountId, actors.editor!.accountId);
    };
    for (const method of ['PUT', 'DELETE'] as const) {
      const denied = await image(method, key, 'editor', board, method === 'PUT' ? data : undefined); expect(denied.statusCode).toBe({ revoke: 404, expire: 401, identity: 409 }[mode]);
      expect(denied.rawPayload.includes(data)).toBe(false); expect((await image('GET', key)).rawPayload).toEqual(data); expect(snapshot()).toEqual(before); expect(database.prepare('SELECT * FROM board_blobs').all()).toEqual(blobs);
    }
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
  it('@CR-01 malformed native metadata cannot replace a reopenable root', async () => {
    database.prepare('INSERT INTO board_thumbnails(board_id,bytes,mime) VALUES(?,?,?)').run(board.summary.id, syntheticCanaries().imageBytes, 'image/png');
    const before = snapshot(); const saved = Buffer.from(bytes(board.rootDocId)); const vector = Y.encodeStateVectorFromUpdate(saved);
    const invalid = [undefined, new Y.Array(), [{ id: board.contentDocId }], [{ id: board.contentDocId, title: 1, createDate: 1, tags: [] }], [{ id: board.contentDocId, title: 'Page', createDate: '1', tags: [] }], [{ id: board.contentDocId, title: 'Page', createDate: 1, tags: {} }]];
    for (const actor of ['owner', 'editor']) for (const value of invalid) {
      const root = new Y.Doc(); Y.applyUpdate(root, saved);
      if (value === undefined) root.getMap('meta').delete('pages');
      else root.getMap('meta').set('pages', Array.isArray(value) ? Y.Array.from(value) : new Y.Array());
      expect((await requestDoc('push', Y.encodeStateAsUpdate(root, vector), actor, board.rootDocId)).statusCode).toBe(400);
      expect(snapshot()).toEqual(before); expect(bytes(board.rootDocId)).toEqual(saved);
      const reopened = new Y.Doc(); Y.applyUpdate(reopened, (await requestDoc('pull', new Uint8Array([0]), 'owner', board.rootDocId)).rawPayload);
      expect(Y.encodeStateVector(reopened)).toEqual(vector);
      expect((reopened.getMap('meta').get('pages') as Y.Array<unknown>).toJSON()).toEqual([{ id: board.contentDocId, title: 'Owner canary', createDate: clock, tags: [] }]);
      reopened.destroy(); root.destroy();
    }
  });
  it('@03-04-01 root metadata remains bound and content commit invalidates preview atomically', async () => {
    const root = new Y.Doc(); Y.applyUpdate(root, bytes(board.rootDocId));
    root.getMap('meta').set('pages', Y.Array.from([new Y.Map<unknown>([['id', board.contentDocId], ['title', 'Bound page'], ['createDate', clock], ['tags', []]])]));
    expect((await requestDoc('push', Y.encodeStateAsUpdate(root), 'editor', board.rootDocId)).statusCode).toBe(200);
    // Pull re-encodes normalized Yjs state; deleted metadata can be GC-compacted.
    // Compare successful read semantics/vector; denial checks below retain bytes.
    const readRoot = new Y.Doc(); const storedRoot = new Y.Doc();
    Y.applyUpdate(readRoot, (await requestDoc('pull', new Uint8Array([0]), 'viewer', board.rootDocId)).rawPayload);
    Y.applyUpdate(storedRoot, bytes(board.rootDocId));
    expect(readRoot.getMap('meta').toJSON()).toEqual(storedRoot.getMap('meta').toJSON());
    expect(Y.encodeStateVector(readRoot)).toEqual(Y.encodeStateVector(storedRoot));
    readRoot.destroy(); storedRoot.destroy();
    database.prepare('INSERT INTO board_thumbnails(board_id,bytes,mime) VALUES(?,?,?)').run(board.summary.id, syntheticCanaries().imageBytes, 'image/png');
    const prior = snapshot(); clock++;
    expect((await requestDoc('push', edit(), 'editor')).statusCode).toBe(200);
    expect(database.prepare('SELECT * FROM board_thumbnails WHERE board_id=?').get(board.summary.id)).toBeUndefined();
    expect((database.prepare('SELECT updated_at FROM boards WHERE id=?').get(board.summary.id) as { updated_at: number }).updated_at).toBe(clock);
    expect(snapshot()).not.toEqual(prior); const before = snapshot();
    (root.getMap('meta').get('pages') as Y.Array<Y.Map<string>>).get(0).set('id', foreign.contentDocId);
    expect((await requestDoc('push', Y.encodeStateAsUpdate(root), 'editor', board.rootDocId)).statusCode).toBe(400); expect(snapshot()).toEqual(before); root.destroy();
  });
  it('@03-04-01 overlapping editor updates merge against latest committed state', async () => {
    const one = edit('first-update'); const two = edit('second-update');
    let count = 0; let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
    barrier = async () => { if (++count === 2) release(); await gate; };
    const results = await Promise.all([requestDoc('push', one, 'editor'), requestDoc('push', two)]); expect(results.map(result => result.statusCode)).toEqual([200, 200]);
    const read = await requestDoc('pull', new Uint8Array([0]), 'viewer'); const doc = new Y.Doc(); Y.applyUpdate(doc, read.rawPayload);
    const text = JSON.stringify(doc.getMap('blocks').toJSON()); expect(text).toContain('first-update'); expect(text).toContain('second-update');
    expect(Y.encodeStateVector(doc)).toEqual(Y.encodeStateVectorFromUpdate(bytes())); doc.destroy();
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
