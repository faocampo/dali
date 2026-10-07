import { syntheticCanaries } from '../../tests/access-fixtures.js';
import { imageHash } from './blobs.js';
import { readRecoveryEpoch } from '../storage/recovery-state.js';
import { afterEach, beforeEach } from 'vitest';
import { randomBytes, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { openDatabase, type AccountDatabase } from '../storage/database.js';
import { createOidcProvider, IDENTITY_COOKIE } from '../../tests/oidc-provider.js';

import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import * as Y from 'yjs';
import { recoveryFingerprint, type SharedRecoveryBaseline } from '../../src/canvas/account/recovery-baseline.js';

describe('authorized recovery baseline', () => {
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
  beforeEach(async () => {
    clock = Date.now(); barrier = async () => {};
    const registration = { clientId: 'synthetic-resources', clientSecret: randomBytes(32).toString('hex'), redirectUri: origin + '/auth/callback' };
    provider = await createOidcProvider({ clients: [registration] }); database = openDatabase(':memory:');
    app = await buildApp({ storagePolicy: { kind: 'fixture' }, database, now: () => clock, beforeCommit: () => barrier(), config: {
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

  const snapshot = (actor = 'owner', attempts: unknown[] = [], extra = {}, titleAttempt?: { operationId: string; title: string }) => app.inject({ method: 'POST', url: `/api/boards/${board.summary.id}/recovery/baseline`, headers: { ...headers(actor), ...extra }, payload: { attempts, ...(titleAttempt ? { titleAttempt } : {}) } });
  it('@05-05-01 returns a consistent authorized root/content/title without changing content or revision', async () => {
    const before = database.prepare('SELECT title,revision FROM boards WHERE id=?').get(board.summary.id);
    const response = await snapshot(); expect(response.statusCode).toBe(200);
    const value = response.json(); expect(value.epoch).toBe(readRecoveryEpoch(database));
    expect(value.title).toBe('Owner canary'); expect(value.root.docId).toBe(board.rootDocId); expect(value.content.docId).toBe(board.contentDocId);
    expect(Buffer.from(value.root.data, 'base64')).toEqual(bytes(board.rootDocId));
    expect(Buffer.from(value.content.data, 'base64')).toEqual(bytes()); expect(value.receipts).toEqual([]);
    expect(database.prepare('SELECT title,revision FROM boards WHERE id=?').get(board.summary.id)).toEqual(before);
  });
  it('@05-05-01 denies Viewer, foreign account, wrong identity and stale recovery epoch', async () => {
    expect((await snapshot('viewer')).statusCode).toBe(403);
    expect((await snapshot('nonMember')).statusCode).toBe(404);
    expect((await snapshot('owner', [], { 'x-dali-account': actors.editor!.accountId })).statusCode).toBe(409);
    expect((await snapshot('owner', [], { 'x-dali-recovery-epoch': randomUUID() })).statusCode).toBe(409);
    database.prepare("UPDATE board_grants SET role='viewer' WHERE board_id=? AND member_id=?").run(board.summary.id, actors.editor!.accountId);
    expect((await snapshot('editor')).statusCode).toBe(403);
  });
  it('@05-05-01 exposes only exact own operation receipts; another tab or digest cannot impersonate one', async () => {
    const attempt = { tabId: 'original-transport-tab', operationId: randomUUID(), docId: board.contentDocId, digest: createHash('sha256').update('synthetic receipt').digest('hex') };
    database.prepare('INSERT INTO document_receipts(board_id,account_id,tab_id,operation_id,doc_id,digest,previous_revision,revision) VALUES(?,?,?,?,?,?,?,?)')
      .run(board.summary.id, actors.owner!.accountId, attempt.tabId, attempt.operationId, attempt.docId, attempt.digest, 1, 2);
    const response = await snapshot('owner', [attempt]); expect(response.statusCode).toBe(200);
    expect(response.json().receipts).toEqual([{ ...attempt, previousRevision: 1, revision: 2 }]);
    expect((await snapshot('editor', [attempt])).json().receipts).toEqual([]);
    for (const altered of [{ ...attempt, tabId: 'different-tab' }, { ...attempt, digest: '0'.repeat(64) }, { ...attempt, docId: board.rootDocId }])
      expect((await snapshot('owner', [altered])).json().receipts).toEqual([]);
  });
  it('@05-05-01 bounds receipt queries and rejects unrelated document claims', async () => {
    const attempt = { tabId: 'tab', operationId: randomUUID(), docId: board.contentDocId, digest: '0'.repeat(64) };
    expect((await snapshot('owner', Array.from({ length: 257 }, () => attempt))).statusCode).toBe(400);
    expect((await snapshot('owner', [{ ...attempt, docId: foreign.contentDocId }])).statusCode).toBe(400);
  });
  it('@05-05-02 a lost rename acknowledgement proves its original title even after a foreign rename', async () => {
    const attempt = { operationId: randomUUID(), title: 'Own acknowledged name' };
    const rename = async (actor: string, title: string, operationId = randomUUID()) => {
      const current = database.prepare('SELECT revision FROM boards WHERE id=?').get(board.summary.id) as { revision: number };
      const response = await app.inject({ method: 'PATCH', url: `/api/boards/${board.summary.id}`, headers: headers(actor), payload: { operationId, revision: current.revision, title } });
      expect(response.statusCode).toBe(200); return response.json();
    };
    const own = await rename('owner', attempt.title, attempt.operationId);
    await rename('editor', 'Later foreign name');
    const response = await snapshot('owner', [], {}, attempt); expect(response.statusCode).toBe(200);
    expect(response.json().title).toBe('Later foreign name');
    expect(response.json().titleReceipt).toEqual({ ...attempt, revision: own.revision });
    expect((await snapshot('editor', [], {}, attempt)).json().titleReceipt).toBeUndefined();
    expect((await snapshot('owner', [], {}, { ...attempt, title: 'Different request' })).json().titleReceipt).toBeUndefined();
    expect((await snapshot('owner', [], {}, { ...attempt, operationId: randomUUID() })).json().titleReceipt).toBeUndefined();
  });
  it('@05-05-02 a recovery rename loses to a disjoint document commit and cannot change the title', async () => {
    const seed = new Y.Doc(); Y.applyUpdate(seed, bytes());
    const surface = [...seed.getMap<Y.Map<unknown>>('blocks').values()].find(v => v.get('sys:flavour') === 'affine:surface')!;
    const shape = new Y.Map(); shape.set('type', 'shape'); shape.set('xywh', '[0,0,100,100]');
    ((surface.get('prop:elements') as Y.Map<unknown>).get('value') as Y.Map<Y.Map<unknown>>).set('remote', shape);
    database.prepare('UPDATE board_documents SET update_bytes=? WHERE board_id=? AND doc_id=?').run(Buffer.from(Y.encodeStateAsUpdate(seed)), board.summary.id, board.contentDocId); seed.destroy();
    database.prepare('UPDATE boards SET live_enabled=1 WHERE id=?').run(board.summary.id);
    const connection = await app.inject({ method: 'POST', url: `/api/boards/${board.summary.id}/live/connect`, headers: headers('editor'), payload: { tabId: 'remote-tab' } }); expect(connection.statusCode).toBe(200);
    const connectionId = connection.json().connectionId;
    const reservation = await app.inject({ method: 'POST', url: `/api/boards/${board.summary.id}/live/reserve`, headers: headers('editor'), payload: { connectionId, objectIds: ['remote'] } }); expect(reservation.statusCode).toBe(200);
    const wire = (await snapshot()).json();
    const baseline = { ...wire, root: { ...wire.root, data: new Uint8Array(Buffer.from(wire.root.data, 'base64')) }, content: { ...wire.content, data: new Uint8Array(Buffer.from(wire.content.data, 'base64')) } } as SharedRecoveryBaseline;
    let entered!: () => void; let release!: () => void;
    const waiting = new Promise<void>(resolve => { entered = resolve; }); const held = new Promise<void>(resolve => { release = resolve; });
    barrier = async () => { entered(); await held; };
    const operationId = randomUUID();
    const pending = app.inject({ method: 'PATCH', url: `/api/boards/${board.summary.id}`, headers: { ...headers(), 'x-dali-recovery-baseline': await recoveryFingerprint(baseline) }, payload: { operationId, revision: wire.revision, title: 'Uncommitted local name' } });
    await waiting; barrier = async () => {};
    const doc = new Y.Doc(); Y.applyUpdate(doc, bytes());
    const remote = [...doc.getMap<Y.Map<unknown>>('blocks').values()].find(v => v.get('sys:flavour') === 'affine:surface')!;
    ((remote.get('prop:elements') as Y.Map<unknown>).get('value') as Y.Map<Y.Map<unknown>>).get('remote')!.set('xywh', '[50,0,100,100]');
    const changed = await app.inject({ method: 'POST', url: `/api/boards/${board.summary.id}/docs/${board.contentDocId}/push`, headers: { ...headers('editor'), 'content-type': 'application/octet-stream', 'x-dali-connection': connectionId, 'x-dali-reservation': reservation.json().token, 'x-dali-operation': randomUUID() }, payload: Buffer.from(Y.encodeStateAsUpdate(doc)) }); doc.destroy(); expect(changed.statusCode).toBe(200);
    release(); const response = await pending;
    expect(response.statusCode).toBe(409); expect(response.json().code).toBe('RECOVERY_DIVERGED');
    expect(database.prepare('SELECT title FROM boards WHERE id=?').get(board.summary.id)).toEqual({ title: 'Owner canary' });
    expect(database.prepare('SELECT 1 FROM operations WHERE operation_id=?').get(operationId)).toBeUndefined();
  });
  it('@05-05-02 a remote write between comparison and replay wins atomically without merging local bytes', async () => {
    const seed = new Y.Doc(); Y.applyUpdate(seed, bytes());
    const surface = [...seed.getMap<Y.Map<unknown>>('blocks').values()].find(v => v.get('sys:flavour') === 'affine:surface')!;
    const elements = (surface.get('prop:elements') as Y.Map<unknown>).get('value') as Y.Map<Y.Map<unknown>>;
    for (const id of ['local', 'remote']) { const shape = new Y.Map(); shape.set('type', 'shape'); shape.set('xywh', '[0,0,100,100]'); elements.set(id, shape); }
    database.prepare('UPDATE board_documents SET update_bytes=? WHERE board_id=? AND doc_id=?').run(Buffer.from(Y.encodeStateAsUpdate(seed)), board.summary.id, board.contentDocId); seed.destroy();
    const wire = (await snapshot()).json();
    const baseline = { ...wire, root: { ...wire.root, data: new Uint8Array(Buffer.from(wire.root.data, 'base64')) }, content: { ...wire.content, data: new Uint8Array(Buffer.from(wire.content.data, 'base64')) } } as SharedRecoveryBaseline;
    const fingerprint = await recoveryFingerprint(baseline);
    const connect = async (actor: string, object: string) => {
      const opened = await app.inject({ method: 'POST', url: `/api/boards/${board.summary.id}/live/connect`, headers: headers(actor), payload: { tabId: actor + '-recovery-tab', activate: true } }); expect(opened.statusCode).toBe(200);
      const connectionId = opened.json().connectionId;
      const held = await app.inject({ method: 'POST', url: `/api/boards/${board.summary.id}/live/reserve`, headers: headers(actor), payload: { connectionId, objectIds: [object] } }); expect(held.statusCode).toBe(200);
      return { 'x-dali-connection': connectionId, 'x-dali-reservation': held.json().token, 'x-dali-operation': randomUUID() };
    };
    const owner = await connect('owner', 'local'); const editor = await connect('editor', 'remote');
    const update = (id: string) => {
      const doc = new Y.Doc(); Y.applyUpdate(doc, bytes()); const vector = Y.encodeStateVector(doc);
      const block = [...doc.getMap<Y.Map<unknown>>('blocks').values()].find(v => v.get('sys:flavour') === 'affine:surface')!;
      ((block.get('prop:elements') as Y.Map<unknown>).get('value') as Y.Map<Y.Map<unknown>>).get(id)!.set('xywh', '[40,0,100,100]');
      const result = Buffer.from(Y.encodeStateAsUpdate(doc, vector)); doc.destroy(); return result;
    };
    const local = update('local'); let entered!: () => void; let release!: () => void;
    const waiting = new Promise<void>(resolve => { entered = resolve; }); const held = new Promise<void>(resolve => { release = resolve; });
    barrier = async () => { entered(); await held; };
    const pending = app.inject({ method: 'POST', url: `/api/boards/${board.summary.id}/docs/${board.contentDocId}/push`, headers: { ...headers(), ...owner, 'content-type': 'application/octet-stream', 'x-dali-recovery-baseline': fingerprint }, payload: local });
    await waiting; barrier = async () => {};
    const remote = await app.inject({ method: 'POST', url: `/api/boards/${board.summary.id}/docs/${board.contentDocId}/push`, headers: { ...headers('editor'), ...editor, 'content-type': 'application/octet-stream' }, payload: update('remote') }); expect(remote.statusCode).toBe(200);
    const committed = Buffer.from(bytes()); release(); const response = await pending;
    expect(response.statusCode).toBe(409); expect(response.json().code).toBe('RECOVERY_DIVERGED'); expect(bytes()).toEqual(committed);
    expect(database.prepare('SELECT 1 FROM document_receipts WHERE operation_id=?').get(owner['x-dali-operation'])).toBeUndefined();
  });
  it.each(['rename', 'epoch'] as const)('@05-05-02 image recovery held across %s change cannot publish bytes', async boundary => {
    const wire = (await snapshot()).json();
    const baseline = { ...wire, root: { ...wire.root, data: new Uint8Array(Buffer.from(wire.root.data, 'base64')) }, content: { ...wire.content, data: new Uint8Array(Buffer.from(wire.content.data, 'base64')) } } as SharedRecoveryBaseline;
    const png = syntheticCanaries().imageBytes; const key = imageHash(png);
    let entered!: () => void; let release!: () => void;
    const waiting = new Promise<void>(resolve => { entered = resolve; }); const held = new Promise<void>(resolve => { release = resolve; });
    barrier = async () => { entered(); await held; };
    const pending = Promise.resolve(app.inject({ method: 'PUT', url: `/api/boards/${board.summary.id}/blobs/${encodeURIComponent(key)}`,
      headers: { ...headers(), 'content-type': 'image/png', 'x-dali-recovery-baseline': await recoveryFingerprint(baseline) }, payload: png }));
    await waiting;
    try {
      barrier = async () => {};
      if (boundary === 'rename') {
        const renamed = await app.inject({ method: 'PATCH', url: `/api/boards/${board.summary.id}`, headers: headers('editor'),
          payload: { operationId: randomUUID(), revision: wire.revision, title: 'Foreign name wins image race' } });
        expect(renamed.statusCode).toBe(200);
      } else database.prepare('UPDATE recovery_state SET epoch=?').run(randomUUID());
    } finally { release(); }
    const result = await pending;
    expect(result.statusCode).toBe(409); expect(result.json().code).toBe(boundary === 'rename' ? 'RECOVERY_DIVERGED' : 'RECOVERY_EPOCH_MISMATCH');
    expect(database.prepare('SELECT blob_key FROM board_blobs WHERE board_id=?').all(board.summary.id)).toEqual([]);
    expect(bytes()).toEqual(Buffer.from(wire.content.data, 'base64'));
  });

});
