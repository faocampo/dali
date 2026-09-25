import { afterEach, beforeEach, expect, it } from 'vitest';
import { randomBytes, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import * as Y from 'yjs';
import { buildApp } from '../app.js';
import { openDatabase, type AccountDatabase } from '../storage/database.js';
import { createOidcProvider, IDENTITY_COOKIE } from '../../tests/oidc-provider.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initializeRecoveryState, readRecoveryEpoch } from '../storage/recovery-state.js';
import { syntheticCanaries } from '../../tests/access-fixtures.js';
import { imageHash } from './blobs.js';

let app: FastifyInstance; let database: AccountDatabase;
let provider: Awaited<ReturnType<typeof createOidcProvider>>;
let barrier: () => Promise<void>;
const origin = 'http://127.0.0.1:5499';
type Descriptor = { summary: { id: string }; rootDocId: string; contentDocId: string; recoveryEpoch: string; revision: number };
let board: Descriptor;
const actors: Record<string, { cookie: string; accountId: string }> = {};
const headers = (actor = 'owner', epoch: string | undefined = board?.recoveryEpoch) => ({ cookie: actors[actor]!.cookie, 'x-dali-account': actors[actor]!.accountId, 'x-dali-request': '1', origin, ...(epoch ? { 'x-dali-recovery-epoch': epoch } : {}) });
const bytes = () => (database.prepare('SELECT update_bytes FROM board_documents WHERE board_id=? AND doc_id=?').get(board.summary.id, board.contentDocId) as { update_bytes: Buffer }).update_bytes;
const push = (epoch: string | undefined, actor = 'owner') => app.inject({ method: 'POST', url: `/api/boards/${board.summary.id}/docs/${board.contentDocId}/push`, headers: { ...headers(actor, epoch), 'content-type': 'application/octet-stream' }, payload: bytes() });
const snapshot = () => ['boards', 'board_documents', 'board_blobs', 'board_thumbnails', 'board_grants', 'pending_grants', 'import_staging', 'import_staging_blobs', 'operations'].map(table => database.prepare('SELECT * FROM ' + table).all());
beforeEach(async () => {
  barrier = async () => {};
  const registration = { clientId: 'synthetic-recovery', clientSecret: randomBytes(32).toString('hex'), redirectUri: origin + '/auth/callback' };
  provider = await createOidcProvider({ port: 0, clients: [registration] }); database = openDatabase(':memory:');
  app = await buildApp({ database, beforeCommit: () => barrier(), config: {
    DALI_ORIGIN: origin, DALI_DATABASE_PATH: ':memory:', DALI_SESSION_SECRET: randomBytes(32).toString('hex'), DALI_SESSION_TTL_MS: '86400000',
    DALI_OIDC_ISSUER: provider.issuer, DALI_OIDC_CLIENT_ID: registration.clientId, DALI_OIDC_CLIENT_SECRET: registration.clientSecret,
    DALI_OIDC_CALLBACK_URL: registration.redirectUri, DALI_INTERNAL_CLAIM: 'membership', DALI_INTERNAL_VALUES_JSON: '["internal"]', DALI_INTERNAL_EMAIL_DOMAINS_JSON: '["example.org"]',
  } });
  for (const identity of ['owner', 'editor', 'viewer', 'nonMember']) {
    const start = await app.inject('/auth/start');
    const cookieOf = (values: string | string[] | undefined) => (Array.isArray(values) ? values.at(-1) : values)!.split(';')[0]!;
    const authorize = await fetch(start.headers.location!, { redirect: 'manual', headers: { cookie: `${IDENTITY_COOKIE}=${identity}` } });
    const callback = new URL(authorize.headers.get('location')!);
    const response = await app.inject({ url: callback.pathname + callback.search, headers: { cookie: cookieOf(start.headers['set-cookie']) } });
    const cookie = cookieOf(response.headers['set-cookie']);
    const session = await app.inject({ url: '/api/session', headers: { cookie } });
    expect(session.statusCode).toBe(200); actors[identity] = { cookie, accountId: session.json().accountId };
  }
  const state = await app.inject({ url: '/api/recovery-state', headers: headers('owner', '') });
  const epoch = state.statusCode === 200 ? state.json().epoch : '';
  const created = await app.inject({ method: 'POST', url: '/api/boards', headers: headers('owner', epoch), payload: { title: 'Synthetic recovery board', operationId: randomUUID() } });
  expect(created.statusCode).toBe(201); board = created.json();
  for (const role of ['editor', 'viewer']) database.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?)').run(board.summary.id, actors[role]!.accountId, role);
});
afterEach(async () => { await app?.close(); database?.close(); await provider?.close(); });

it('@04-02-01 file-backed recovery epoch is initialized once and retained on reopen', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dali-epoch-'));
  try {
    const first = openDatabase(join(directory, 'db.sqlite')); const initial = initializeRecoveryState(first);
    expect(initializeRecoveryState(first)).toEqual(initial); first.close();
    const reopened = openDatabase(join(directory, 'db.sqlite'));
    expect(initializeRecoveryState(reopened)).toEqual(initial); expect(readRecoveryEpoch(reopened)).toBe(initial.epoch); reopened.close();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

it('@04-02-01 missing epoch rejects document mutation without changing durable bytes', async () => {
  const before = snapshot(); const response = await push('');
  expect(response.statusCode).toBe(409);
  expect(response.json()).toEqual({ code: 'RECOVERY_EPOCH_REQUIRED' }); expect(snapshot()).toEqual(before);
});

it('@04-02-01 matching epoch acknowledges; stale epoch and unauthorized descriptors disclose no epoch', async () => {
  expect(board.recoveryEpoch).toMatch(/^[0-9a-f-]{36}$/);
  const good = await push(board.recoveryEpoch); expect(good.statusCode).toBe(200);
  expect(good.headers['x-dali-recovery-epoch']).toBe(board.recoveryEpoch);
  const before = snapshot(); const stale = await push(randomUUID());
  expect(stale.statusCode).toBe(409); expect(stale.json()).toEqual({ code: 'RECOVERY_EPOCH_MISMATCH' }); expect(snapshot()).toEqual(before);
  const denied = await app.inject({ url: '/api/boards/' + board.summary.id, headers: headers('nonMember') });
  expect(denied.statusCode).toBe(404); expect(denied.body).not.toContain(board.recoveryEpoch);
  expect((await app.inject('/api/recovery-state')).statusCode).toBe(401);
  expect((await app.inject({ url: '/api/recovery-state', headers: { ...headers(), 'x-dali-account': actors.viewer!.accountId } })).statusCode).toBe(409);
  const read = await app.inject({ method: 'POST', url: `/api/boards/${board.summary.id}/docs/${board.contentDocId}/pull`, headers: { ...headers('viewer', ''), 'content-type': 'application/octet-stream' }, payload: Buffer.from([0]) });
  expect(read.statusCode).toBe(200); expect(read.rawPayload).toEqual(bytes());
});

it('@04-02-01 request held across epoch rotation cannot commit', async () => {
  let release!: () => void; let reached!: () => void;
  const waiting = new Promise<void>(resolve => { reached = resolve; });
  barrier = () => { reached(); return new Promise<void>(resolve => { release = resolve; }); };
  const doc = new Y.Doc(); Y.applyUpdate(doc, bytes());
  doc.getMap<Y.Map<unknown>>('blocks').forEach(block => { if (block.get('sys:flavour') === 'affine:page') (block.get('prop:title') as Y.Text).insert(0, 'stale '); });
  const before = snapshot();
  const request = app.inject({ method: 'POST', url: `/api/boards/${board.summary.id}/docs/${board.contentDocId}/push`, headers: { ...headers(), 'content-type': 'application/octet-stream' }, payload: Buffer.from(Y.encodeStateAsUpdate(doc)) });
  const response = Promise.resolve(request); await waiting;
  database.prepare('UPDATE recovery_state SET epoch=?').run(randomUUID()); release();
  expect((await response).json()).toEqual({ code: 'RECOVERY_EPOCH_MISMATCH' }); expect(snapshot()).toEqual(before); doc.destroy();
});

it('@04-02-02 old image and metadata epochs reject while current actions stay usable', async () => {
  const png = syntheticCanaries().imageBytes; const key = imageHash(png); const base = '/api/boards/' + board.summary.id;
  const before = snapshot();
  for (const epoch of ['', randomUUID()]) {
    for (const [method, url, payload, mime] of [
      ['PUT', base + '/blobs/' + key, png, 'image/png'], ['DELETE', base + '/blobs/' + key, '{}', 'application/json'],
      ['PUT', base + '/thumbnail', png, 'image/png'],
      ['PATCH', base, { operationId: randomUUID(), revision: 1, title: 'stale' }, 'application/json'],
      ['DELETE', base, { operationId: randomUUID(), revision: 1 }, 'application/json'],
    ] as const) {
      const result = await app.inject({ method, url, headers: { ...headers('owner', epoch), 'content-type': mime }, payload });
      expect(result.statusCode).toBe(409); expect(result.json().code).toBe(epoch ? 'RECOVERY_EPOCH_MISMATCH' : 'RECOVERY_EPOCH_REQUIRED'); expect(snapshot()).toEqual(before);
    }
  }
  const image = await app.inject({ method: 'PUT', url: base + '/blobs/' + key, headers: { ...headers(), 'content-type': 'image/png' }, payload: png });
  expect(image.statusCode).toBe(200); expect(image.headers['x-dali-recovery-epoch']).toBe(board.recoveryEpoch);
  expect((await app.inject({ method: 'PATCH', url: base, headers: headers(), payload: { operationId: randomUUID(), revision: 1, title: 'current' } })).statusCode).toBe(200);
  expect((await app.inject({ method: 'DELETE', url: base, headers: headers(), payload: { operationId: randomUUID(), revision: 2 } })).statusCode).toBe(200);
});

it('@04-02-03 pre-board creation and import reservations reject missing and stale epochs', async () => {
  const before = snapshot();
  for (const epoch of ['', randomUUID()]) for (const [url, payload] of [
    ['/api/boards', { operationId: randomUUID(), title: 'rejected' }],
    ['/api/imports', { operationId: randomUUID(), title: 'rejected', manifest: [] }],
    [`/api/boards/${board.summary.id}/duplicate`, { operationId: randomUUID(), revision: 1 }],
  ] as const) {
    const response = await app.inject({ method: 'POST', url, headers: headers('owner', epoch), payload });
    expect(response.statusCode).toBe(409); expect(response.json().code).toBe(epoch ? 'RECOVERY_EPOCH_MISMATCH' : 'RECOVERY_EPOCH_REQUIRED'); expect(snapshot()).toEqual(before);
  }
});

it.each(['import', 'duplicate'])('@04-02-03 %s stages bind their original epoch for every write and publish', async kind => {
  const operationId = randomUUID(); const key = imageHash(syntheticCanaries().imageBytes);
  const reservation = await app.inject({ method: 'POST', url: kind === 'import' ? '/api/imports' : `/api/boards/${board.summary.id}/duplicate`, headers: headers(), payload: { operationId, ...(kind === 'import' ? { title: 'Synthetic import', manifest: [key] } : { revision: 1 }) } });
  expect(reservation.statusCode).toBe(200); expect(reservation.json().result.recoveryEpoch).toBe(board.recoveryEpoch);
  const before = snapshot(); const base = '/api/imports/' + operationId;
  const requests = [
    { method: 'PUT' as const, url: base + '/document', payload: { root: '', content: '', manifest: [] }, mime: 'application/json' },
    { method: 'PUT' as const, url: base + '/blobs/' + key, payload: syntheticCanaries().imageBytes, mime: 'image/png' },
    { method: 'POST' as const, url: base + '/commit', payload: {}, mime: 'application/json' },
  ];
  for (const epoch of ['', randomUUID()]) for (const request of requests) {
    const response = await app.inject({ ...request, headers: { ...headers('owner', epoch), 'content-type': request.mime } });
    expect(response.statusCode).toBe(409); expect(response.json().code).toBe(epoch ? 'RECOVERY_EPOCH_MISMATCH' : 'RECOVERY_EPOCH_REQUIRED'); expect(snapshot()).toEqual(before);
  }
  const nextEpoch = randomUUID(); database.prepare('UPDATE recovery_state SET epoch=?').run(nextEpoch);
  for (const request of requests) {
    const response = await app.inject({ ...request, headers: { ...headers('owner', nextEpoch), 'content-type': request.mime } });
    expect(response.json()).toEqual({ code: 'RECOVERY_EPOCH_MISMATCH' }); expect(snapshot()).toEqual(before);
  }
  expect((await app.inject({ url: base, headers: headers() })).json().status).toBe('staging');
});

it.each(['document', 'image', 'commit'])('@04-02-03 import %s checks epoch again after its scheduling barrier', async step => {
  const operationId = randomUUID(); const png = syntheticCanaries().imageBytes; const key = imageHash(png);
  const reserved = await app.inject({ method: 'POST', url: '/api/imports', headers: headers(), payload: { operationId, title: 'Synthetic import', manifest: [key] } });
  const d = reserved.json().result as Descriptor;
  const root = new Y.Doc(); root.getMap('spaces').set(d.contentDocId, new Y.Doc({ guid: d.contentDocId }));
  root.getMap('meta').set('pages', Y.Array.from([{ id: d.contentDocId, title: 'Synthetic import', createDate: 1, tags: [] }]));
  const content = new Y.Doc(); Y.applyUpdate(content, bytes()); const id = randomUUID();
  const image = new Y.Map(); image.set('sys:id', id); image.set('sys:flavour', 'affine:image'); image.set('prop:sourceId', key); content.getMap('blocks').set(id, image);
  const payload = { root: Buffer.from(Y.encodeStateAsUpdate(root)).toString('base64'), content: Buffer.from(Y.encodeStateAsUpdate(content)).toString('base64'), manifest: [key] };
  root.destroy(); content.destroy();
  const base = '/api/imports/' + operationId;
  const document = () => app.inject({ method: 'PUT', url: base + '/document', headers: headers(), payload });
  const blob = () => app.inject({ method: 'PUT', url: base + '/blobs/' + key, headers: { ...headers(), 'content-type': 'image/png' }, payload: png });
  const commit = () => app.inject({ method: 'POST', url: base + '/commit', headers: headers(), payload: {} });
  if (step === 'commit') { expect((await document()).statusCode).toBe(200); expect((await blob()).statusCode).toBe(200); }
  const before = snapshot(); barrier = async () => { database.prepare('UPDATE recovery_state SET epoch=?').run(randomUUID()); };
  const response = await (step === 'document' ? document() : step === 'image' ? blob() : commit());
  expect(response.json()).toEqual({ code: 'RECOVERY_EPOCH_MISMATCH' }); expect(snapshot()).toEqual(before);
  barrier = async () => {}; database.prepare('UPDATE recovery_state SET epoch=?').run(board.recoveryEpoch);
  expect((await document()).statusCode).toBe(200); expect((await blob()).statusCode).toBe(200);
  const completed = await commit(); expect(completed.statusCode).toBe(200); expect((await commit()).json()).toEqual(completed.json());
});

it('@04-02-03 grant and revoke epochs retain access and revision distinctions', async () => {
  const base = `/api/boards/${board.summary.id}/grants`;
  const current = (await app.inject({ url: base, headers: headers() })).json();
  const grant = current.grants.find((row: { memberId: string }) => row.memberId === actors.viewer!.accountId);
  expect(current.recoveryEpoch).toBe(board.recoveryEpoch); const before = snapshot();
  for (const epoch of ['', randomUUID()]) for (const method of ['POST', 'PATCH', 'DELETE'] as const) {
    const response = await app.inject({ method, url: base + (method === 'POST' ? '' : '/' + grant.id), headers: headers('owner', epoch), payload: { operationId: randomUUID(), revision: 1, ...(method === 'POST' ? { email: 'synthetic@example.org' } : {}), ...(method !== 'DELETE' ? { role: 'editor' } : {}) } });
    expect(response.json().code).toBe(epoch ? 'RECOVERY_EPOCH_MISMATCH' : 'RECOVERY_EPOCH_REQUIRED'); expect(snapshot()).toEqual(before);
  }
  expect((await app.inject({ method: 'PATCH', url: base + '/' + grant.id, headers: headers(), payload: { operationId: randomUUID(), revision: 999, role: 'editor' } })).json().code).toBe('GRANT_CONFLICT');
  expect((await app.inject({ method: 'DELETE', url: base + '/' + grant.id, headers: headers('viewer'), payload: { operationId: randomUUID(), revision: 1 } })).statusCode).toBe(403);
  expect(snapshot()).toEqual(before);
  barrier = async () => { database.prepare('UPDATE recovery_state SET epoch=?').run(randomUUID()); };
  for (const method of ['POST', 'PATCH', 'DELETE'] as const) {
    database.prepare('UPDATE recovery_state SET epoch=?').run(board.recoveryEpoch);
    const response = await app.inject({ method, url: base + (method === 'POST' ? '' : '/' + grant.id), headers: headers(), payload: { operationId: randomUUID(), revision: grant.revision, ...(method === 'POST' ? { email: 'synthetic@example.org' } : {}), ...(method !== 'DELETE' ? { role: 'editor' } : {}) } });
    expect(response.json()).toEqual({ code: 'RECOVERY_EPOCH_MISMATCH' }); expect(snapshot()).toEqual(before);
  }
  barrier = async () => {}; database.prepare('UPDATE recovery_state SET epoch=?').run(board.recoveryEpoch);
  const changed = await app.inject({ method: 'PATCH', url: base + '/' + grant.id, headers: headers(), payload: { operationId: randomUUID(), revision: grant.revision, role: 'editor' } });
  expect(changed.statusCode).toBe(200); expect(changed.headers['x-dali-recovery-epoch']).toBe(board.recoveryEpoch);
});
