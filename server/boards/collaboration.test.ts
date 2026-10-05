import { readRecoveryEpoch } from '../storage/recovery-state.js';
import { afterEach, beforeEach } from 'vitest';
import { randomBytes, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { openDatabase, type AccountDatabase } from '../storage/database.js';
import { createOidcProvider, IDENTITY_COOKIE } from '../../tests/oidc-provider.js';

import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { CollaborationBroker, movedShapeIds } from './collaboration.js';

describe('live collaboration reservation boundary', () => {
  it('@05-01-01 reserves independent objects and fences competing actions', () => {
    const broker = new CollaborationBroker(() => 0);
    const a = broker.connect('board', 'alice', 'tab-a');
    const b = broker.connect('board', 'bob', 'tab-b');
    const first = broker.acquire(a, ['shape-a']);
    expect(first).toBeTruthy();
    expect(broker.acquire(b, ['shape-a', 'shape-b'])).toBeNull();
    expect(broker.acquire(b, ['shape-b'])).toBeTruthy();
    expect(broker.owns(a, first!, ['shape-a'])).toBe(true);
    expect(broker.owns(b, first!, ['shape-a'])).toBe(false);
    broker.release(a, first!);
    expect(broker.acquire(b, ['shape-a'])).toBeTruthy();
  });
  it('@05-01-02 disconnect invalidates old tokens and releases reservations', () => {
    const broker = new CollaborationBroker(() => 0);
    const a = broker.connect('board', 'alice', 'tab');
    const token = broker.acquire(a, ['shape'])!;
    broker.disconnect(a);
    const next = broker.connect('board', 'alice', 'tab');
    expect(broker.owns(next, token, ['shape'])).toBe(false);
    expect(broker.acquire(next, ['shape'])).toBeTruthy();
    expect(() => broker.acquire(a, ['shape'])).toThrow();
  });
  it('@05-01-02 idle heartbeats retain reservations; lost connections expire', () => {
    let clock = 0;
    const broker = new CollaborationBroker(() => clock);
    const a = broker.connect('board', 'alice', 'a');
    const token = broker.acquire(a, ['shape'])!;
    for (let i = 0; i < 10; i++) { clock += 10000; broker.touch(a); }
    expect(broker.owns(a, token, ['shape'])).toBe(true);
    clock += 40000;
    const b = broker.connect('board', 'bob', 'b');
    expect(broker.acquire(b, ['shape'])).toBeTruthy();
    expect(broker.owns(a, token, ['shape'])).toBe(false);
  });
  it('@05-01-02 rejects duplicate and oversized object sets and scopes tokens to boards', () => {
    const broker = new CollaborationBroker(() => 0);
    const a = broker.connect('one', 'alice', 'a');
    const b = broker.connect('two', 'alice', 'b');
    expect(() => broker.acquire(a, [])).toThrow();
    expect(() => broker.acquire(a, ['same', 'same'])).toThrow();
    expect(() => broker.acquire(a, Array.from({ length: 10001 }, (_, i) => String(i)))).toThrow();
    const token = broker.acquire(a, ['shape'])!;
    expect(broker.owns(b, token, ['shape'])).toBe(false);
  });
});

function shapeDocument() {
  const doc = new Y.Doc();
  const surface = new Y.Map<unknown>();
  surface.set('sys:flavour', 'affine:surface');
  const box = new Y.Map<unknown>(); const elements = new Y.Map<unknown>();
  box.set('type', '$blocksuite:internal:native$'); box.set('value', elements);
  surface.set('prop:elements', box); doc.getMap('blocks').set('surface', surface);
  for (const id of ['a', 'b']) { const shape = new Y.Map<unknown>(); shape.set('type', 'shape'); shape.set('xywh', '[0,0,100,100]'); elements.set(id, shape); }
  return { doc, elements };
}
describe('authoritative native effect classification', () => {
  it('@05-01-01 derives moved objects from content rather than client claims', () => {
    const { doc, elements } = shapeDocument(); const before = new Y.Doc(); Y.applyUpdate(before, Y.encodeStateAsUpdate(doc));
    (elements.get('a') as Y.Map<unknown>).set('xywh', '[10,20,100,100]');
    expect(movedShapeIds(before, doc)).toEqual(['a']); before.destroy(); doc.destroy();
  });
  it('@05-01-02 ignores property insertion order when classifying native effects', () => {
    const original = shapeDocument(); const reordered = shapeDocument();
    const shape = reordered.elements.get('a') as Y.Map<unknown>;
    shape.delete('type'); shape.set('type', 'shape');
    expect(movedShapeIds(original.doc, reordered.doc)).toEqual([]);
    original.doc.destroy(); reordered.doc.destroy();
  });
  it('@05-01-02 rejects mutations to the native container wrapper', () => {
    const { doc } = shapeDocument(); const before = new Y.Doc(); Y.applyUpdate(before, Y.encodeStateAsUpdate(doc));
    ((doc.getMap('blocks').get('surface') as Y.Map<unknown>).get('prop:elements') as Y.Map<unknown>).set('type', 'foreign');
    expect(movedShapeIds(before, doc)).toBeNull(); before.destroy(); doc.destroy();
  });
  it('@05-01-02 refuses hidden formatting, deletion, and root metadata effects', () => {
    const { doc, elements } = shapeDocument(); const before = new Y.Doc(); Y.applyUpdate(before, Y.encodeStateAsUpdate(doc));
    (elements.get('a') as Y.Map<unknown>).set('fillColor', 'red');
    expect(movedShapeIds(before, doc)).toBeNull();
    elements.delete('b'); expect(movedShapeIds(before, doc)).toBeNull(); before.destroy(); doc.destroy();
  });
});

describe('authenticated live collaboration', () => {
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

  it('@05-01-01 opens a consistent authorized snapshot and viewer subscription', async () => {
    for (const actor of ['owner', 'editor', 'viewer']) {
      const response = await app.inject({ method: 'POST', url: `/api/boards/${board.summary.id}/live/connect`, headers: headers(actor), payload: { tabId: randomUUID() } });
      expect(response.statusCode).toBe(200);
      const state = response.json(); expect(state.connectionId).toBeTruthy(); expect(state.revision).toBeGreaterThan(0);
      const doc = new Y.Doc(); Y.applyUpdate(doc, Buffer.from(state.content, 'base64'));
      expect(doc.getMap('blocks').size).toBe(2); doc.destroy();
    }
  });
  it('@05-01-02 rejects viewers reserving objects and foreign-board connections', async () => {
    const open = await app.inject({ method: 'POST', url: `/api/boards/${board.summary.id}/live/connect`, headers: headers('viewer'), payload: { tabId: randomUUID() } });
    const held = await app.inject({ method: 'POST', url: `/api/boards/${board.summary.id}/live/reserve`, headers: headers('viewer'), payload: { connectionId: open.json().connectionId, objectIds: ['shape'] } });
    expect(held.statusCode).toBe(403);
    const denied = await app.inject({ method: 'POST', url: `/api/boards/${foreign.summary.id}/live/connect`, headers: headers('viewer'), payload: { tabId: randomUUID() } });
    expect(denied.statusCode).toBe(404);
  });
  it('@05-01-02 reauthorizes a held response after access revocation', async () => {
    const open = await app.inject({ method: 'POST', url: `/api/boards/${board.summary.id}/live/connect`, headers: headers('viewer'), payload: { tabId: randomUUID() } });
    const state = open.json();
    const pending = app.inject({ method: 'POST', url: `/api/boards/${board.summary.id}/live/poll`, headers: headers('viewer'), payload: { connectionId: state.connectionId, revision: state.revision, epoch: state.epoch, waitMs: 1000 } }).then(r => r);
    await new Promise(resolve => setTimeout(resolve, 50));
    database.prepare('DELETE FROM board_grants WHERE board_id=? AND member_id=?').run(board.summary.id, actors.viewer!.accountId);
    const response = await pending;
    expect(response.statusCode).toBe(404); expect(response.json()).toEqual({ code: 'BOARD_UNAVAILABLE' });
    expect(response.body).not.toContain(state.content);
  });
  it('@05-01-02 catches a change between snapshot and subscription', async () => {
    const open = await app.inject({ method: 'POST', url: `/api/boards/${board.summary.id}/live/connect`, headers: headers('viewer'), payload: { tabId: randomUUID() } });
    const state = open.json();
    expect((await requestDoc('push', edit('gap-change'))).statusCode).toBe(200);
    const response = await app.inject({ method: 'POST', url: `/api/boards/${board.summary.id}/live/poll`, headers: headers('viewer'), payload: { connectionId: state.connectionId, revision: state.revision, epoch: state.epoch, waitMs: 0 } });
    expect(response.statusCode).toBe(200); expect(response.json().revision).toBeGreaterThan(state.revision);
    const doc = new Y.Doc(); Y.applyUpdate(doc, Buffer.from(response.json().content, 'base64'));
    expect(JSON.stringify(doc.getMap('blocks').toJSON())).toContain('gap-change'); doc.destroy();
  });

  it('@05-01-01 commits reserved native movement with an idempotent durable receipt', async () => {
    const native = new Y.Doc(); Y.applyUpdate(native, bytes());
    const blocks = native.getMap<Y.Map<unknown>>('blocks');
    const surface = [...blocks.values()].find(block => block.get('sys:flavour') === 'affine:surface')!;
    const elements = (surface.get('prop:elements') as Y.Map<unknown>).get('value') as Y.Map<unknown>;
    const shape = new Y.Map<unknown>(); shape.set('type', 'shape'); shape.set('xywh', '[0,0,100,100]'); elements.set('shape', shape);
    expect((await requestDoc('push', Y.encodeStateAsUpdate(native))).statusCode).toBe(200);
    database.prepare('UPDATE boards SET live_enabled=1 WHERE id=?').run(board.summary.id);
    const open = await app.inject({ method: 'POST', url: `/api/boards/${board.summary.id}/live/connect`, headers: headers('editor'), payload: { tabId: 'editor-tab' } });
    const connectionId = open.json().connectionId;
    const held = await app.inject({ method: 'POST', url: `/api/boards/${board.summary.id}/live/reserve`, headers: headers('editor'), payload: { connectionId, objectIds: ['shape'] } });
    expect(held.statusCode).toBe(200);
    const vector = Y.encodeStateVector(native); shape.set('xywh', '[20,30,100,100]'); const update = Y.encodeStateAsUpdate(native, vector);
    const metadata = { 'x-dali-connection': connectionId, 'x-dali-reservation': held.json().token, 'x-dali-operation': randomUUID() };
    expect((await requestDoc('push', update, 'editor')).statusCode).toBe(409);
    const response = await requestDoc('push', update, 'editor', board.contentDocId, board, metadata);
    expect(response.statusCode).toBe(200); expect(response.json().acknowledged).toBe(true);
    expect((await requestDoc('push', update, 'editor', board.contentDocId, board, metadata)).json()).toEqual(response.json());
    expect((database.prepare('SELECT count(*) AS n FROM document_receipts').get() as { n: number }).n).toBe(1);
    const persisted = Buffer.from(bytes());
    shape.set('type', 'foreign');
    const hidden = await requestDoc('push', Y.encodeStateAsUpdate(native, vector), 'editor', board.contentDocId, board, { ...metadata, 'x-dali-operation': randomUUID() });
    expect(hidden.statusCode).toBe(409); expect(bytes()).toEqual(persisted);
    shape.set('type', 'shape');
    database.exec("CREATE TEMP TRIGGER fail_receipt BEFORE INSERT ON document_receipts BEGIN SELECT RAISE(ABORT,'synthetic write failure'); END");
    shape.set('xywh', '[23,30,100,100]');
    const failed = await requestDoc('push', Y.encodeStateAsUpdate(native, vector), 'editor', board.contentDocId, board, { ...metadata, 'x-dali-operation': randomUUID() });
    expect(failed.statusCode).toBe(500); expect(bytes()).toEqual(persisted);
    expect((database.prepare('SELECT count(*) AS n FROM document_receipts').get() as { n: number }).n).toBe(1);
    const unchanged = await app.inject({ method: 'POST', url: `/api/boards/${board.summary.id}/live/poll`, headers: headers('editor'), payload: { connectionId, revision: response.json().revision, epoch: readRecoveryEpoch(database), waitMs: 0 } });
    expect(unchanged.statusCode).toBe(200); expect(unchanged.json()).toEqual({ revision: response.json().revision, epoch: readRecoveryEpoch(database) });
    database.exec('DROP TRIGGER fail_receipt');

    shape.set('xywh', '[25,30,100,100]');
    expect((await requestDoc('push', Y.encodeStateAsUpdate(native, vector), 'editor', board.contentDocId, board, metadata)).statusCode).toBe(409);
    native.destroy();
  });

  it('@05-01-01 accepts native synchronization of an unchanged root', async () => {
    database.prepare('UPDATE boards SET live_enabled=1 WHERE id=?').run(board.summary.id);
    const open = await app.inject({ method: 'POST', url: `/api/boards/${board.summary.id}/live/connect`, headers: headers(), payload: { tabId: 'root-tab' } });
    const response = await requestDoc('push', bytes(board.rootDocId), 'owner', board.rootDocId, board, { 'x-dali-connection': open.json().connectionId, 'x-dali-operation': randomUUID() });
    expect(response.statusCode).toBe(200); expect(response.json().previousRevision).toBe(response.json().revision);
  });

  it.each(['expired', 'identity', 'epoch', 'viewer-push'])('@05-01-02 fences %s requests without returning canvas bytes', async fault => {
    const opened = await app.inject({ method: 'POST', url: `/api/boards/${board.summary.id}/live/connect`, headers: headers('viewer'), payload: { tabId: randomUUID() } });
    const state = opened.json();
    if (fault === 'viewer-push') {
      const result = await requestDoc('push', edit(), 'viewer');
      expect(result.statusCode).toBe(403); return;
    }
    const requestHeaders = headers('viewer');
    if (fault === 'expired') database.prepare('UPDATE sessions SET expires_at=? WHERE member_id=?').run(clock - 1, actors.viewer!.accountId);
    if (fault === 'identity') requestHeaders.cookie = actors.owner!.cookie;
    const result = await app.inject({ method: 'POST', url: `/api/boards/${board.summary.id}/live/poll`, headers: requestHeaders,
      payload: { connectionId: state.connectionId, revision: 0, epoch: fault === 'epoch' ? randomUUID() : state.epoch, waitMs: 0 } });
    expect(result.statusCode).toBe(fault === 'expired' ? 401 : 409);
    expect(result.json()).not.toHaveProperty('content'); expect(result.json()).not.toHaveProperty('root');
  });
  it('@05-01-02 rejects a stale connection after a same-tab reconnect', async () => {
    const connect = () => app.inject({ method: 'POST', url: `/api/boards/${board.summary.id}/live/connect`, headers: headers('editor'), payload: { tabId: 'same-tab' } });
    const first = (await connect()).json(); const second = (await connect()).json();
    expect(first.connectionId).not.toBe(second.connectionId);
    const denied = await app.inject({ method: 'POST', url: `/api/boards/${board.summary.id}/live/reserve`, headers: headers('editor'), payload: { connectionId: first.connectionId, objectIds: ['shape'] } });
    expect(denied.statusCode).toBe(409);
  });

  it('@05-02-02 creation scopes adopt only their new objects and cannot edit other existing objects', async () => {
    database.prepare('UPDATE boards SET live_enabled=1 WHERE id=?').run(board.summary.id);
    const connections: Record<string, { id: string; token: string }> = {};
    for (const actor of ['owner', 'editor']) {
      const opened = await app.inject({ method: 'POST', url: `/api/boards/${board.summary.id}/live/connect`, headers: headers(actor), payload: { tabId: actor } });
      const id = opened.json().connectionId;
      const held = await app.inject({ method: 'POST', url: `/api/boards/${board.summary.id}/live/reserve`, headers: headers(actor), payload: { connectionId: id, objectIds: [`$dali:create:${id}`] } });
      expect(held.statusCode).toBe(200); connections[actor] = { id, token: held.json().token };
    }
    for (const actor of ['owner', 'editor']) {
      const native = new Y.Doc(); Y.applyUpdate(native, bytes()); const vector = Y.encodeStateVector(native);
      const surface = [...native.getMap<Y.Map<unknown>>('blocks').values()].find(block => block.get('sys:flavour') === 'affine:surface')!;
      const elements = (surface.get('prop:elements') as Y.Map<unknown>).get('value') as Y.Map<unknown>;
      const shape = new Y.Map<unknown>(); shape.set('type', 'shape'); shape.set('xywh', '[0,0,100,100]'); elements.set(actor, shape);
      const connection = connections[actor]!;
      const extra = { 'x-dali-connection': connection.id, 'x-dali-reservation': connection.token, 'x-dali-operation': randomUUID() };
      if (actor === 'owner') {
        const original = Buffer.from(bytes());
        database.exec("CREATE TEMP TRIGGER fail_creation_receipt BEFORE INSERT ON document_receipts BEGIN SELECT RAISE(ABORT,'synthetic creation failure'); END");
        expect((await requestDoc('push', Y.encodeStateAsUpdate(native, vector), actor, board.contentDocId, board, extra)).statusCode).toBe(500);
        expect(bytes()).toEqual(original);
        database.exec('DROP TRIGGER fail_creation_receipt');
      }
      expect((await requestDoc('push', Y.encodeStateAsUpdate(native, vector), actor, board.contentDocId, board, extra)).statusCode).toBe(200);
      shape.set('xywh', '[5,0,100,100]');
      expect((await requestDoc('push', Y.encodeStateAsUpdate(native, vector), actor, board.contentDocId, board, { ...extra, 'x-dali-operation': randomUUID() })).statusCode).toBe(200);
      if (actor === 'editor') {
        const existing = elements.get('owner') as Y.Map<unknown>;
        existing.set('xywh', '[9,0,100,100]');
        expect((await requestDoc('push', Y.encodeStateAsUpdate(native, vector), actor, board.contentDocId, board, { ...extra, 'x-dali-operation': randomUUID() })).statusCode).toBe(409);
      }
      native.destroy();
    }
    const forged = await app.inject({ method: 'POST', url: `/api/boards/${board.summary.id}/live/reserve`, headers: headers('editor'), payload: { connectionId: connections.editor!.id, objectIds: [`$dali:create:${connections.owner!.id}`] } });
    expect(forged.statusCode).toBe(400);
  });

  it('@05-02-02 board renaming honors the explicit metadata reservation', async () => {
    database.prepare('UPDATE boards SET live_enabled=1 WHERE id=?').run(board.summary.id);
    const opened = await app.inject({ method: 'POST', url: `/api/boards/${board.summary.id}/live/connect`, headers: headers(), payload: { tabId: 'metadata-editor' } });
    const connectionId = opened.json().connectionId;
    const held = await app.inject({ method: 'POST', url: `/api/boards/${board.summary.id}/live/reserve`, headers: headers(), payload: { connectionId, objectIds: ['$dali:metadata'] } });
    expect(held.statusCode).toBe(200);
    const revision = (database.prepare('SELECT revision FROM boards WHERE id=?').get(board.summary.id) as { revision: number }).revision;
    const rename = () => app.inject({ method: 'PATCH', url: `/api/boards/${board.summary.id}`, headers: headers(), payload: { operationId: randomUUID(), revision, title: 'Synthetic renamed board' } });
    const denied = await rename(); expect(denied.statusCode).toBe(409); expect(denied.json().code).toBe('OBJECT_RESERVED');
    await app.inject({ method: 'POST', url: `/api/boards/${board.summary.id}/live/release`, headers: headers(), payload: { connectionId, token: held.json().token } });
    const accepted = await rename(); expect(accepted.statusCode).toBe(200); expect(accepted.json().summary.title).toBe('Synthetic renamed board');
  });

});
