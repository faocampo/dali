import { afterEach, beforeEach, expect, it } from 'vitest';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, stat, copyFile, readdir, writeFile, chmod } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { build } from 'esbuild';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import Database from 'better-sqlite3';
import type { FastifyInstance } from 'fastify';
import * as Y from 'yjs';
import { buildApp } from '../app.js';
import { openDatabase, type AccountDatabase } from './database.js';
import { publishBackup, inspectBackupSet, type BackupBoundary } from './backup.js';
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
  app = await buildApp({ storagePolicy: { kind: 'fixture' }, database, config }); actors = {};
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

it('@05-04-02 preserves acknowledged property provenance in a validated backup and rejects corrupt versions', async () => {
  const opened = await app.inject({ method: 'POST', url: `/api/boards/${board.summary.id}/live/connect`, headers: headers(), payload: { tabId: 'synthetic-history-tab', activate: true } });
  expect(opened.statusCode).toBe(200); const connectionId = opened.json().connectionId;
  const held = await app.inject({ method: 'POST', url: `/api/boards/${board.summary.id}/live/reserve`, headers: headers(), payload: { connectionId, objectIds: ['synthetic-image'] } });
  expect(held.statusCode).toBe(200); const actionId = held.json().token;
  const bytes = (database.prepare('SELECT update_bytes FROM board_documents WHERE doc_id=?').get(board.contentDocId) as { update_bytes: Buffer }).update_bytes;
  const doc = new Y.Doc(); Y.applyUpdate(doc, bytes); const vector = Y.encodeStateVector(doc);
  (doc.getMap('blocks').get('synthetic-image') as Y.Map<unknown>).set('prop:xywh', '[20,0,100,100]');
  const response = await app.inject({ method: 'POST', url: `/api/boards/${board.summary.id}/docs/${board.contentDocId}/push`,
    headers: { ...headers(), 'content-type': 'application/octet-stream', 'x-dali-connection': connectionId, 'x-dali-reservation': actionId, 'x-dali-operation': randomUUID() },
    payload: Buffer.from(Y.encodeStateAsUpdate(doc, vector)) }); doc.destroy(); expect(response.statusCode).toBe(200);
  const result = await publishBackup(options());
  expect(result.manifest.counts.historyProperties).toBe(1);
  const path = join(directory, 'provenance-copy.sqlite'); await copyFile(join(destination, result.id, 'database.sqlite'), path);
  expect(validateBackupDatabase(path).counts.historyProperties).toBe(1);
  const copy = new Database(path);
  expect(copy.prepare('SELECT action_id,property,revision FROM document_action_properties').all()).toEqual([{ action_id: actionId, property: 'prop:xywh', revision: response.json().revision }]);
  copy.prepare('UPDATE document_action_properties SET revision=revision+100').run(); copy.close();
  expect(() => validateBackupDatabase(path)).toThrow('Backup database validation failed');
});

it('@04-10-01 online backup during writes publishes a complete independently reopenable copy', async () => {
  let writes = 0; const start = Date.now();
  const result = await publishBackup({ ...options(), progress: () => {
    if (!writes++) database.prepare('UPDATE boards SET title=?,revision=revision+1 WHERE id=?').run('Synthetic concurrent write', board.summary.id);
    return 16;
  } });
  expect(writes).toBeGreaterThan(0);
  expect(result.manifest).toMatchObject({ schemaVersion: 1, databaseVersion: 11, epoch: board.recoveryEpoch, counts: { boards: 1, documents: 2, images: 1, grants: 2, members: 4, receipts: 1 } });
  expect(result.manifest.recoveryPointAt).toBeGreaterThanOrEqual(start); expect(result.manifest.completedAt).toBeGreaterThanOrEqual(result.manifest.recoveryPointAt);
  const target = join(destination, result.id); const bytes = await readFile(join(target, 'database.sqlite'));
  expect(result.manifest.byteLength).toBe(bytes.length); expect(result.manifest.sha256).toBe(createHash('sha256').update(bytes).digest('hex'));
  expect(JSON.parse(await readFile(join(target, 'manifest.json'), 'utf8'))).toEqual(result.manifest);
  expect(await readFile(join(target, 'COMPLETE'), 'utf8')).toBe(result.manifest.sha256 + '\n');
  expect((await readdir(target)).sort()).toEqual(['COMPLETE', 'database.sqlite', 'manifest.json']);
  expect((await stat(target)).mode & 0o777).toBe(0o700); expect((await stat(join(target, 'database.sqlite'))).mode & 0o777).toBe(0o600);
  expect(validateBackupDatabase(join(target, 'database.sqlite')).counts).toEqual(result.manifest.counts);
  const restore = join(directory, 'fresh.sqlite'); await copyFile(join(target, 'database.sqlite'), restore);
  const freshDb = openDatabase(restore); const fresh = await buildApp({ storagePolicy: { kind: 'fixture' }, database: freshDb, config });
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
  expect(await inspectBackupSet(options().destination)).toEqual([first]);
});

for (const boundary of ['snapshot', 'verification', 'digest', 'file-sync', 'manifest-sync', 'rename', 'directory-sync', 'completion-marker', 'completion-sync'] as BackupBoundary[]) it(`@04-10-02 ${boundary} failure preserves the last verified recovery point`, async () => {
  const old = await publishBackup({ ...options(), now: () => 1_700_000_000_000 });
  let injected = false;
  await expect(publishBackup({ ...options(), now: () => 1_700_000_001_000, onBoundary: point => {
    if (point === boundary) { injected = true; throw Object.assign(new Error('Synthetic destination failure'), { code: boundary === 'manifest-sync' ? 'ENOSPC' : 'EIO' }); }
  } })).rejects.toThrow('Backup publication failed');
  expect(injected).toBe(true); expect(await inspectBackupSet(options().destination)).toEqual([old]);
  expect(await readdir(destination)).toEqual([old.id]);
});

it('@04-10-02 unavailable and unrestricted destinations never replace a stale good backup', async () => {
  const old = await publishBackup({ ...options(), now: () => 1_700_000_000_000 });
  await expect(publishBackup({ ...options(), destination: { directory: join(directory, 'unavailable'), independentStorage: true } })).rejects.toThrow('Backup publication failed');
  await chmod(destination, 0o755); await expect(publishBackup(options())).rejects.toThrow('Backup publication failed'); await chmod(destination, 0o700);
  await expect(publishBackup({ ...options(), destination: { ...options().destination, independentStorage: false as unknown as true } })).rejects.toThrow('Backup publication failed');
  expect(await inspectBackupSet(options().destination)).toEqual([old]);
});

it('@04-10-02 inspection ignores partial, tampered and unsupported sets without editing them', async () => {
  const old = await publishBackup(options()); const bad = await publishBackup(options());
  await writeFile(join(destination, bad.id, 'manifest.json'), JSON.stringify({ ...bad.manifest, schemaVersion: 999 }));
  const partial = join(destination, `backup-123-${randomUUID()}`); await mkdir(partial, { mode: 0o700 }); await writeFile(join(partial, 'manifest.json'), '{}', { mode: 0o600 });
  const before = await readFile(join(destination, old.id, 'database.sqlite')); const names = await readdir(destination);
  expect(await inspectBackupSet(options().destination)).toEqual([old]);
  expect(await readFile(join(destination, old.id, 'database.sqlite'))).toEqual(before); expect(await readdir(destination)).toEqual(names);
  await writeFile(join(destination, bad.id, 'manifest.json'), JSON.stringify(bad.manifest));
  await writeFile(join(destination, bad.id, 'database.sqlite'), Buffer.from('synthetic corruption'));
  expect(await inspectBackupSet(options().destination)).toEqual([old]);
});

it('@04-10-02 preserves pending access, unfinished imports and receipts for deleted boards', async () => {
  database.prepare('INSERT INTO pending_grants(board_id,issuer,canonical_email,role) VALUES(?,?,?,?)').run(board.summary.id, provider.issuer, 'pending@example.org', 'viewer');
  const staged = await app.inject({ method: 'POST', url: '/api/imports', headers: headers(), payload: { operationId: randomUUID(), title: 'Synthetic unfinished import', manifest: [] } }); expect(staged.statusCode).toBe(200);
  const current = await app.inject({ url: '/api/boards/' + board.summary.id, headers: headers() });
  const duplicate = await app.inject({ method: 'POST', url: '/api/boards/' + board.summary.id + '/duplicate', headers: headers(), payload: { operationId: randomUUID(), revision: current.json().revision } }); expect(duplicate.statusCode).toBe(200);
  const created = await app.inject({ method: 'POST', url: '/api/boards', headers: headers(), payload: { operationId: randomUUID(), title: 'Synthetic deleted board' } }); expect(created.statusCode).toBe(201);
  const deleted = await app.inject({ method: 'DELETE', url: '/api/boards/' + created.json().summary.id, headers: headers(), payload: { operationId: randomUUID(), revision: 1 } }); expect(deleted.statusCode).toBe(200);
  const published = await publishBackup(options());
  expect(published.manifest.counts).toMatchObject({ boards: 1, pendingGrants: 1, stagedImports: 2, receipts: 5 });
  expect(await inspectBackupSet(options().destination)).toEqual([published]);
});

for (const boundary of ['snapshot', 'completion-marker'] as const) it(`@04-10-02 SIGKILL at ${boundary} leaves only the old verified set selectable`, async () => {
  const old = await publishBackup(options()); const childDatabase = join(directory, 'child-live.sqlite'); await database.backup(childDatabase);
  const source = `import Database from 'better-sqlite3'; import { publishBackup } from './server/storage/backup.ts';
    const keepAlive = setInterval(() => {}, 1000);
    const database = new Database(process.env.SYNTHETIC_DATABASE);
    await publishBackup({ database, destination: { directory: process.env.SYNTHETIC_DESTINATION, independentStorage: true }, applicationVersion: '0.1.0',
      progress: () => { if (process.env.SYNTHETIC_BOUNDARY === 'snapshot') { process.send('ready'); return 0; } return 16; },
      onBoundary: async point => { if (point === process.env.SYNTHETIC_BOUNDARY && point !== 'snapshot') { process.send('ready'); await new Promise(() => {}); } } }); clearInterval(keepAlive);`;
  const compiled = await build({ stdin: { contents: source, resolveDir: process.cwd() }, bundle: true, write: false, platform: 'node', format: 'esm', packages: 'external' });
  const child = spawn(process.execPath, ['--input-type=module'], { stdio: ['pipe', 'ignore', 'pipe', 'ipc'], env: { ...process.env, SYNTHETIC_DATABASE: childDatabase, SYNTHETIC_DESTINATION: destination, SYNTHETIC_BOUNDARY: boundary } });
  child.stdin!.end(compiled.outputFiles[0]!.text);
  let errors = ''; child.stderr?.on('data', chunk => { errors += chunk.toString(); });
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Child backup barrier timed out: ' + errors)), 10000);
      child.once('message', () => { clearTimeout(timer); resolve(); }); child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', code => { clearTimeout(timer); reject(new Error('Child exited before barrier: ' + code + ' ' + errors)); });
    });
    const exited = once(child, 'exit'); child.kill('SIGKILL'); expect((await exited)[1]).toBe('SIGKILL');
    expect(await inspectBackupSet(options().destination)).toEqual([old]);
    expect((await readdir(destination)).length).toBeGreaterThan(1);
    const next = await publishBackup(options()); expect((await inspectBackupSet(options().destination)).map(row => row.id)).toContain(next.id);
  } finally { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); }
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

for (const version of [8, 9, 10]) it(`@05-04-02 upgrades a version ${version} backup without changing canvas or access`, async () => {
  const path = join(directory, `prior-${version}.sqlite`);
  await database.backup(path);
  const prior = new Database(path);
  prior.exec('DROP TABLE document_action_properties; DELETE FROM schema_migrations WHERE version=11');
  if (version < 10) prior.exec('DROP TABLE document_receipts; ALTER TABLE boards DROP COLUMN live_enabled; DELETE FROM schema_migrations WHERE version=10');
  if (version === 8) prior.exec('ALTER TABLE recovery_state DROP COLUMN backup_point; ALTER TABLE recovery_state DROP COLUMN backup_completed; ALTER TABLE recovery_state DROP COLUMN backup_checked; DELETE FROM schema_migrations WHERE version=9');
  const content = prior.prepare('SELECT update_bytes FROM board_documents WHERE doc_id=?').get(board.contentDocId);
  const grants = prior.prepare('SELECT * FROM board_grants ORDER BY member_id').all();
  prior.close();
  expect(validateBackupDatabase(path).databaseVersion).toBe(version);
  const migrated = openDatabase(path);
  const first = await buildApp({ storagePolicy: { kind: 'fixture' }, database: migrated, config });
  await first.close();
  const second = await buildApp({ storagePolicy: { kind: 'fixture' }, database: migrated, config });
  expect(migrated.prepare('SELECT update_bytes FROM board_documents WHERE doc_id=?').get(board.contentDocId)).toEqual(content);
  expect(migrated.prepare('SELECT * FROM board_grants ORDER BY member_id').all()).toEqual(grants);
  expect(validateBackupDatabase(path).databaseVersion).toBe(11);
  await second.close(); migrated.close();
});
