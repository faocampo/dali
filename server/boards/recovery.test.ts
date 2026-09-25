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
const snapshot = () => ({ boards: database.prepare('SELECT * FROM boards ORDER BY id').all(), docs: database.prepare('SELECT * FROM board_documents ORDER BY board_id,doc_id').all(), blobs: database.prepare('SELECT * FROM board_blobs ORDER BY board_id,blob_key').all() });
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

it('@04-02-03 pre-board creation and import reservations reject missing epochs', async () => {
  const before = snapshot();
  for (const [url, payload] of [
    ['/api/boards', { operationId: randomUUID(), title: 'rejected' }],
    ['/api/imports', { operationId: randomUUID(), title: 'rejected', manifest: [] }],
  ] as const) {
    const response = await app.inject({ method: 'POST', url, headers: headers('owner', ''), payload });
    expect(response.statusCode).toBe(409); expect(response.json().code).toBe('RECOVERY_EPOCH_REQUIRED'); expect(snapshot()).toEqual(before);
  }
});
