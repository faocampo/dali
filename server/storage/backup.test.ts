import { afterEach, beforeEach, expect, it } from 'vitest';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, stat, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import Database from 'better-sqlite3';
import type { FastifyInstance } from 'fastify';
import * as Y from 'yjs';
import { buildApp } from '../app.js';
import { openDatabase, type AccountDatabase } from './database.js';
import { publishBackup } from './backup.js';
import { validateBackupDatabase } from './backup-validation.js';
import { readRecoveryEpoch } from './recovery-state.js';
import { createOidcProvider, IDENTITY_COOKIE } from '../../tests/oidc-provider.js';
import { syntheticCanaries } from '../../tests/access-fixtures.js';
import { imageHash } from '../boards/blobs.js';

let directory: string; let destination: string; let database: AccountDatabase; let app: FastifyInstance;
let provider: Awaited<ReturnType<typeof createOidcProvider>>; let config: Record<string, string>;
const origin = 'http://127.0.0.1:5499';
let board: { summary: { id: string }; rootDocId: string; contentDocId: string; recoveryEpoch: string };
let actors: Record<string, { cookie: string; accountId: string }>;
const headers = (actor = 'owner') => ({ cookie: actors[actor]!.cookie, 'x-dali-account': actors[actor]!.accountId, 'x-dali-request': '1', 'x-dali-recovery-epoch': board?.recoveryEpoch ?? readRecoveryEpoch(database), origin });
const png = syntheticCanaries().imageBytes; const imageKey = imageHash(png);
const options = () => ({ database, destination: { directory: destination, independentStorage: true as const }, applicationVersion: '0.1.0' });
async function signIn(target: FastifyInstance, identity: string) {
  const cookieOf = (values: string | string[] | undefined) => (Array.isArray(values) ? values.at(-1) : values)!.split(';')[0]!;
  const start = await target.inject('/auth/start');
  const authorize = await fetch(start.headers.location!, { redirect: 'manual', headers: { cookie: `${IDENTITY_COOKIE}=${identity}` } });
  const callback = new URL(authorize.headers.get('location')!);
  const response = await target.inject({ url: callback.pathname + callback.search, headers: { cookie: cookieOf(start.headers['set-cookie']) } });
  const cookie = cookieOf(response.headers['set-cookie']);
  const session = await target.inject({ url: '/api/session', headers: { cookie } });
  expect(session.statusCode).toBe(200); return { cookie, accountId: session.json().accountId as string };
}
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'dali-backup-')); destination = join(directory, 'synthetic-independent'); await mkdir(destination, { mode: 0o700 });
  const registration = { clientId: 'synthetic-backup', clientSecret: randomBytes(32).toString('hex'), redirectUri: origin + '/auth/callback' };
  provider = await createOidcProvider({ port: 0, clients: [registration] }); database = openDatabase(join(directory, 'live.sqlite'));
  config = { DALI_ORIGIN: origin, DALI_DATABASE_PATH: database.name, DALI_SESSION_SECRET: randomBytes(32).toString('hex'), DALI_SESSION_TTL_MS: '86400000',
    DALI_OIDC_ISSUER: provider.issuer, DALI_OIDC_CLIENT_ID: registration.clientId, DALI_OIDC_CLIENT_SECRET: registration.clientSecret,
    DALI_OIDC_CALLBACK_URL: registration.redirectUri, DALI_INTERNAL_CLAIM: 'membership', DALI_INTERNAL_VALUES_JSON: '["internal"]', DALI_INTERNAL_EMAIL_DOMAINS_JSON: '["example.org"]' };
  app = await buildApp({ database, config }); actors = {};
  for (const identity of ['owner', 'editor', 'viewer', 'nonMember']) actors[identity] = await signIn(app, identity);
  board = undefined as unknown as typeof board;
  const created = await app.inject({ method: 'POST', url: '/api/boards', headers: headers(), payload: { operationId: randomUUID(), title: 'Synthetic backup' } });
  expect(created.statusCode).toBe(201); board = created.json();
  for (const role of ['editor', 'viewer']) database.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?)').run(board.summary.id, actors[role]!.accountId, role);
  const image = await app.inject({ method: 'PUT', url: `/api/boards/${board.summary.id}/blobs/${imageKey}`, headers: { ...headers(), 'content-type': 'image/png' }, payload: png }); expect(image.statusCode).toBe(200);
  const row = database.prepare('SELECT update_bytes FROM board_documents WHERE doc_id=?').get(board.contentDocId) as { update_bytes: Buffer };
  const doc = new Y.Doc(); Y.applyUpdate(doc, row.update_bytes);
  const imageBlock = new Y.Map(); imageBlock.set('sys:id', 'synthetic-image'); imageBlock.set('sys:flavour', 'affine:image'); imageBlock.set('prop:sourceId', imageKey);
  doc.getMap('blocks').set('synthetic-image', imageBlock); doc.getMap('meta').set('synthetic-padding', 'x'.repeat(600_000));
  const pushed = await app.inject({ method: 'POST', url: `/api/boards/${board.summary.id}/docs/${board.contentDocId}/push`, headers: { ...headers(), 'content-type': 'application/octet-stream' }, payload: Buffer.from(Y.encodeStateAsUpdate(doc)) }); doc.destroy(); expect(pushed.statusCode).toBe(200);
});
afterEach(async () => { await app?.close(); if (database?.open) database.close(); await provider?.close(); if (directory) await rm(directory, { recursive: true, force: true }); });

it('@04-10-01 online backup during writes publishes a complete independently reopenable copy', async () => {
  let writes = 0; const start = Date.now();
  const result = await publishBackup({ ...options(), progress: () => {
    if (!writes++) database.prepare('UPDATE boards SET title=?,revision=revision+1 WHERE id=?').run('Synthetic concurrent write', board.summary.id);
    return 16;
  } });
  expect(writes).toBeGreaterThan(0);
  expect(result.manifest).toMatchObject({ schemaVersion: 1, databaseVersion: 8, epoch: board.recoveryEpoch, counts: { boards: 1, documents: 2, images: 1, grants: 2, members: 4, receipts: 1 } });
  expect(result.manifest.recoveryPointAt).toBeGreaterThanOrEqual(start); expect(result.manifest.completedAt).toBeGreaterThanOrEqual(result.manifest.recoveryPointAt);
  const target = join(destination, result.id); const bytes = await readFile(join(target, 'database.sqlite'));
  expect(result.manifest.byteLength).toBe(bytes.length); expect(result.manifest.sha256).toBe(createHash('sha256').update(bytes).digest('hex'));
  expect(JSON.parse(await readFile(join(target, 'manifest.json'), 'utf8'))).toEqual(result.manifest);
  expect(await readFile(join(target, 'COMPLETE'), 'utf8')).toBe(result.manifest.sha256 + '\n');
  expect((await stat(target)).mode & 0o777).toBe(0o700); expect((await stat(join(target, 'database.sqlite'))).mode & 0o777).toBe(0o600);
  expect(validateBackupDatabase(join(target, 'database.sqlite')).counts).toEqual(result.manifest.counts);
  const restore = join(directory, 'fresh.sqlite'); await copyFile(join(target, 'database.sqlite'), restore);
  const freshDb = openDatabase(restore); const fresh = await buildApp({ database: freshDb, config });
  try {
    for (const identity of ['owner', 'editor', 'viewer', 'nonMember']) {
      const actor = await signIn(fresh, identity); const access = { cookie: actor.cookie, 'x-dali-account': actor.accountId };
      const descriptor = await fresh.inject({ url: `/api/boards/${board.summary.id}`, headers: access });
      expect(descriptor.statusCode).toBe(identity === 'nonMember' ? 404 : 200);
      if (identity === 'nonMember') continue;
      expect(descriptor.json().summary.role).toBe(identity); expect(descriptor.json().summary.title).toBe('Synthetic concurrent write');
      const image = await fresh.inject({ url: `/api/boards/${board.summary.id}/blobs/${imageKey}`, headers: access }); expect(image.rawPayload).toEqual(png);
      const push = await fresh.inject({ method: 'POST', url: `/api/boards/${board.summary.id}/docs/${board.contentDocId}/push`, headers: { ...access, origin, 'x-dali-request': '1', 'x-dali-recovery-epoch': board.recoveryEpoch, 'content-type': 'application/octet-stream' }, payload: Buffer.from([0, 0]) });
      expect(push.statusCode).toBe(identity === 'viewer' ? 403 : 200);
    }
  } finally { await fresh.close(); freshDb.close(); }
});

it('@04-10-02 concurrent triggers share one complete publication', async () => {
  const [first, second] = await Promise.all([publishBackup(options()), publishBackup(options())]);
  expect(second.id).toBe(first.id); expect(second.manifest).toEqual(first.manifest);
});

for (const corruption of ['missing-image', 'document', 'image-hash', 'schema', 'binding', 'foreign-key'] as const) it(`@04-10-01 rejects ${corruption} in a real SQLite copy`, async () => {
  const path = join(directory, 'invalid.sqlite'); await database.backup(path); const copy = new Database(path); copy.pragma('foreign_keys=OFF');
  if (corruption === 'missing-image') copy.prepare('DELETE FROM board_blobs').run();
  if (corruption === 'document') copy.prepare('UPDATE board_documents SET update_bytes=? WHERE doc_id=?').run(Buffer.from([255]), board.contentDocId);
  if (corruption === 'image-hash') copy.prepare("UPDATE board_blobs SET hash='invalid'").run();
  if (corruption === 'schema') copy.prepare('INSERT INTO schema_migrations(version) VALUES(999)').run();
  if (corruption === 'binding') copy.prepare("UPDATE boards SET content_doc_id='missing'").run();
  if (corruption === 'foreign-key') copy.prepare("UPDATE board_grants SET member_id='missing' WHERE role='viewer'").run();
  copy.close(); expect(() => validateBackupDatabase(path)).toThrow();
});
