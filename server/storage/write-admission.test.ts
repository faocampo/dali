import { afterEach, beforeEach, expect, it } from 'vitest';
import { randomBytes, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { openDatabase, type AccountDatabase } from './database.js';
import { readRecoveryEpoch } from './recovery-state.js';
import { createOidcProvider, IDENTITY_COOKIE } from '../../tests/oidc-provider.js';
import type { BackupHealth } from './backup-scheduler.js';
import * as Y from 'yjs';
import { syntheticCanaries } from '../../tests/access-fixtures.js';
import { imageHash } from '../boards/blobs.js';

let app: FastifyInstance; let database: AccountDatabase; let provider: Awaited<ReturnType<typeof createOidcProvider>>;
let health: BackupHealth; let barrier: () => Promise<void>;
const origin = 'http://127.0.0.1:5499';
let actor: { cookie: string; accountId: string };
let board: { summary: { id: string }; rootDocId: string; contentDocId: string; revision: number; recoveryEpoch: string };
const headers = () => ({ ...actor, cookie: actor.cookie, 'x-dali-account': actor.accountId, origin, 'x-dali-request': '1', 'x-dali-recovery-epoch': readRecoveryEpoch(database) });
const snapshot = () => ['boards', 'board_documents', 'board_blobs', 'board_thumbnails', 'board_grants', 'pending_grants', 'import_staging', 'import_staging_blobs', 'operations'].map(table => database.prepare('SELECT * FROM ' + table).all());
type MutationRequest = { method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'; url: string; payload: Record<string, unknown> | Buffer; mime?: string };
const send = ({ mime = 'application/json', ...request }: MutationRequest) => app.inject({ ...request, headers: { ...headers(), 'content-type': mime } });
const mutationRoutes = ['create', 'root', 'content', 'blob-put', 'blob-delete', 'thumbnail', 'rename', 'delete', 'duplicate', 'import-stage', 'import-document', 'import-blob', 'import-commit'] as const;
async function prepareMutation(route: typeof mutationRoutes[number]): Promise<MutationRequest> {
  const base = `/api/boards/${board.summary.id}`; const operationId = randomUUID();
  if (route === 'create') return { method: 'POST', url: '/api/boards', payload: { title: 'Synthetic new', operationId } };
  if (route === 'root' || route === 'content') {
    const id = route === 'root' ? board.rootDocId : board.contentDocId; const doc = new Y.Doc();
    Y.applyUpdate(doc, (database.prepare('SELECT update_bytes FROM board_documents WHERE doc_id=?').get(id) as { update_bytes: Buffer }).update_bytes);
    doc.getMap('meta').set('synthetic-write', operationId); const payload = Buffer.from(Y.encodeStateAsUpdate(doc)); doc.destroy();
    return { method: 'POST', url: `${base}/docs/${id}/push`, payload, mime: 'application/octet-stream' };
  }
  if (route === 'rename' || route === 'delete' || route === 'duplicate') return { method: route === 'rename' ? 'PATCH' : route === 'delete' ? 'DELETE' : 'POST', url: base + (route === 'duplicate' ? '/duplicate' : ''), payload: { title: 'Synthetic changed', operationId, revision: board.revision } };
  const png = syntheticCanaries().imageBytes; const key = imageHash(png);
  if (route === 'thumbnail') return { method: 'PUT', url: base + '/thumbnail', payload: png, mime: 'image/png' };
  if (route === 'blob-put' || route === 'blob-delete') {
    if (route === 'blob-delete') expect((await send({ method: 'PUT', url: base + '/blobs/' + key, payload: png, mime: 'image/png' })).statusCode).toBe(200);
    return { method: route === 'blob-put' ? 'PUT' : 'DELETE', url: base + '/blobs/' + key, payload: route === 'blob-put' ? png : {}, mime: route === 'blob-put' ? 'image/png' : 'application/json' };
  }
  const stage: MutationRequest = { method: 'POST', url: '/api/imports', payload: { title: 'Synthetic import', operationId, manifest: [key] } };
  if (route === 'import-stage') return stage;
  const response = await send(stage); expect(response.statusCode).toBe(200); const d = response.json().result;
  const root = new Y.Doc(); root.getMap('spaces').set(d.contentDocId, new Y.Doc({ guid: d.contentDocId }));
  root.getMap('meta').set('pages', Y.Array.from([{ id: d.contentDocId, title: 'Synthetic import', createDate: 1, tags: [] }]));
  const content = new Y.Doc(); Y.applyUpdate(content, (database.prepare('SELECT update_bytes FROM board_documents WHERE doc_id=?').get(board.contentDocId) as { update_bytes: Buffer }).update_bytes);
  const image = new Y.Map(); image.set('sys:id', 'synthetic-image'); image.set('sys:flavour', 'affine:image'); image.set('prop:sourceId', key); content.getMap('blocks').set('synthetic-image', image);
  const doc: MutationRequest = { method: 'PUT', url: `/api/imports/${operationId}/document`, payload: { root: Buffer.from(Y.encodeStateAsUpdate(root)).toString('base64'), content: Buffer.from(Y.encodeStateAsUpdate(content)).toString('base64'), manifest: [key] } };
  root.destroy(); content.destroy();
  const blob: MutationRequest = { method: 'PUT', url: `/api/imports/${operationId}/blobs/${key}`, payload: png, mime: 'image/png' };
  if (route === 'import-document') return doc;
  if (route === 'import-blob') return blob;
  expect((await send(doc)).statusCode).toBe(200); expect((await send(blob)).statusCode).toBe(200);
  return { method: 'POST', url: `/api/imports/${operationId}/commit`, payload: {} };
}
async function signIn(identity = 'owner') {
  const cookieOf = (values: string | string[] | undefined) => (Array.isArray(values) ? values.at(-1) : values)!.split(';')[0]!;
  const start = await app.inject('/auth/start');
  const authorize = await fetch(start.headers.location!, { redirect: 'manual', headers: { cookie: `${IDENTITY_COOKIE}=${identity}` } });
  const callback = new URL(authorize.headers.get('location')!);
  const response = await app.inject({ url: callback.pathname + callback.search, headers: { cookie: cookieOf(start.headers['set-cookie']) } });
  const cookie = cookieOf(response.headers['set-cookie']);
  const session = await app.inject({ url: '/api/session', headers: { cookie } }); expect(session.statusCode).toBe(200);
  return { cookie, accountId: session.json().accountId as string };
}
beforeEach(async () => {
  barrier = async () => {}; health = { state: 'healthy', reason: 'fresh', recoveryPointAt: Date.now(), recoverableAgeMs: 0, failure: null };
  const registration = { clientId: 'synthetic-admission', clientSecret: randomBytes(32).toString('hex'), redirectUri: origin + '/auth/callback' };
  provider = await createOidcProvider({ port: 0, clients: [registration] }); database = openDatabase(':memory:');
  app = await buildApp({ database, storagePolicy: { health: () => health }, beforeCommit: () => barrier(), config: {
    DALI_ORIGIN: origin, DALI_DATABASE_PATH: ':memory:', DALI_SESSION_SECRET: randomBytes(32).toString('hex'), DALI_SESSION_TTL_MS: '86400000',
    DALI_OIDC_ISSUER: provider.issuer, DALI_OIDC_CLIENT_ID: registration.clientId, DALI_OIDC_CLIENT_SECRET: registration.clientSecret,
    DALI_OIDC_CALLBACK_URL: registration.redirectUri, DALI_INTERNAL_CLAIM: 'membership', DALI_INTERNAL_VALUES_JSON: '["internal"]', DALI_INTERNAL_EMAIL_DOMAINS_JSON: '["example.org"]',
  } });
  actor = await signIn();
  const created = await app.inject({ method: 'POST', url: '/api/boards', headers: headers(), payload: { title: 'Synthetic admission board', operationId: randomUUID() } });
  expect(created.statusCode).toBe(201); board = created.json();
});
afterEach(async () => { await app?.close(); database?.close(); await provider?.close(); });
it('@04-11-02 stale backup fences create without changing durable storage', async () => {
  health = { ...health, state: 'fenced', reason: 'stale', recoverableAgeMs: 3_600_000 };
  const before = snapshot();
  const response = await app.inject({ method: 'POST', url: '/api/boards', headers: headers(), payload: { title: 'Unacknowledged', operationId: randomUUID() } });
  expect(response.statusCode).toBe(503); expect(response.json()).toEqual({ code: 'BACKUP_FRESHNESS_REQUIRED' }); expect(snapshot()).toEqual(before);
  expect(board.summary.id).toBeTruthy();
});
it.each(mutationRoutes)('@04-11-02 %s rejects stale and crossing-bound commits then resumes', async route => {
  const request = await prepareMutation(route); const before = snapshot();
  for (const delayed of [false, true]) {
    health = { ...health, state: delayed ? 'alert' : 'fenced', reason: delayed ? 'aging' : 'stale', recoverableAgeMs: delayed ? 3_599_000 : 3_600_000 };
    let entered = false; barrier = async () => { entered = true; health = { ...health, state: 'fenced', reason: 'stale', recoverableAgeMs: 3_600_000 }; };
    const response = await send(request);
    expect(response.statusCode, route + ': ' + response.body).toBe(503); expect(response.json()).toEqual({ code: 'BACKUP_FRESHNESS_REQUIRED' });
    expect(response.headers['retry-after']).toBe('60'); expect(snapshot()).toEqual(before);
    if (delayed) expect(entered).toBe(true);
  }
  barrier = async () => {}; health = { ...health, state: 'healthy', reason: 'fresh', recoverableAgeMs: 0 };
  const resumed = await send(request); expect(resumed.statusCode, resumed.body).toBe(route === 'create' ? 201 : 200); expect(snapshot()).not.toEqual(before);
});
it.each(['no-baseline', 'clock-invalid'] as const)('@04-11-02 %s fences while authorization and read paths remain distinct', async reason => {
  const outsider = await signIn('nonMember'); const viewer = await signIn('viewer');
  database.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?)').run(board.summary.id, viewer.accountId, 'viewer');
  health = { ...health, state: 'fenced', reason, recoverableAgeMs: null, recoveryPointAt: null };
  const request = await prepareMutation('content'); const before = snapshot();
  expect((await send(request)).statusCode).toBe(503);
  for (const [identity, status] of [[outsider, 404], [viewer, 403]] as const) {
    const response = await app.inject({ ...request, headers: { ...headers(), cookie: identity.cookie, 'x-dali-account': identity.accountId, 'content-type': 'application/octet-stream' } }); expect(response.statusCode).toBe(status); expect(response.body).not.toContain('BACKUP');
  }
  expect((await app.inject({ ...request, headers: { ...headers(), cookie: '', 'content-type': 'application/octet-stream' } })).statusCode).toBe(401);
  for (const url of ['/api/session', '/api/boards', `/api/boards/${board.summary.id}`, `/api/boards/${board.summary.id}/editable-export`, '/api/storage-health']) expect((await app.inject({ url, headers: headers() })).statusCode).toBe(200);
  const pull = await app.inject({ method: 'POST', url: `/api/boards/${board.summary.id}/docs/${board.contentDocId}/pull`, headers: { ...headers(), 'content-type': 'application/octet-stream' }, payload: Buffer.from([0]) }); expect(pull.statusCode).toBe(200);
  expect(snapshot()).toEqual(before);
});
