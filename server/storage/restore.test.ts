import { afterEach, beforeEach, expect, it } from 'vitest';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, readdir, writeFile, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { FastifyInstance } from 'fastify';
import * as Y from 'yjs';
import { buildApp } from '../app.js';
import { openDatabase, type AccountDatabase } from './database.js';
import { publishBackup, backupDigest } from './backup.js';
import { restoreBackup, verifyRestore } from './restore.js';
import { runOperator } from '../operator.js';
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

async function selected(now?: () => number) {
  const session = database.prepare('SELECT id FROM sessions LIMIT 1').get() as { id: string };
  database.prepare('INSERT INTO login_transactions(state,browser_id,nonce,verifier,return_to,expires_at) VALUES(?,?,?,?,?,?)')
    .run(randomUUID(), session.id, 'synthetic-nonce', 'synthetic-verifier', '/', Date.now() + 60000);
  const publication = await publishBackup({ ...options(), now }); const backup = join(destination, publication.id);
  const target = join(directory, 'fresh'); await mkdir(target, { mode: 0o700 });
  const sourceDatabase = database.name; await app.close(); database.close();
  return { backup, destination: target, sourceDatabase, expectedManifestDigest: await backupDigest(join(backup, 'manifest.json')),
    maintenanceConfirmed: true, fencing: { method: 'writer-stopped' as const, evidence: 'Synthetic writer closed and awaited' } };
}
it('@04-12-01 selected restore preserves content and access while invalidating sessions and rotating epoch', async () => {
  const input = await selected(); const oldBytes = await readFile(input.sourceDatabase);
  await expect(restoreBackup(input)).resolves.toMatchObject({ integrity: 'verified', sessionsInvalidated: true, ingress: 'closed' });
  const report = await verifyRestore(input.destination);
  expect(report.previousEpoch).toBe(board.recoveryEpoch); expect(report.epoch).not.toBe(board.recoveryEpoch);
  expect(report.counts).toMatchObject({ boards: 1, documents: 2, images: 1, members: 4, grants: 2, receipts: 1 });
  expect(await readFile(input.sourceDatabase)).toEqual(oldBytes);
  database = openDatabase(join(input.destination, 'database.sqlite'));
  expect(database.prepare('SELECT count(*) AS n FROM sessions').get()).toEqual({ n: 0 });
  expect(database.prepare('SELECT count(*) AS n FROM login_transactions').get()).toEqual({ n: 0 });
  app = await buildApp({ database, config, storagePolicy: { kind: 'fixture' } });
  expect((await app.inject({ url: '/api/session', headers: { cookie: actors.owner!.cookie } })).statusCode).toBe(401);
  for (const identity of ['owner', 'editor', 'viewer', 'nonMember']) {
    const actor = await signIn(app, identity); const access = { cookie: actor.cookie, 'x-dali-account': actor.accountId };
    const descriptor = await app.inject({ url: `/api/boards/${board.summary.id}`, headers: access });
    expect(descriptor.statusCode).toBe(identity === 'nonMember' ? 404 : 200);
    const image = await app.inject({ url: `/api/boards/${board.summary.id}/blobs/${imageKey}`, headers: access });
    if (identity === 'nonMember') { expect(image.statusCode).toBe(404); continue; }
    expect(image.rawPayload).toEqual(png); expect(descriptor.json().summary.role).toBe(identity);
    const stale = await app.inject({ method: 'POST', url: `/api/boards/${board.summary.id}/docs/${board.contentDocId}/push`, headers: { ...access, origin, 'x-dali-request': '1', 'x-dali-recovery-epoch': board.recoveryEpoch, 'content-type': 'application/octet-stream' }, payload: Buffer.from([0, 0]) });
    expect(stale.statusCode).toBe(identity === 'viewer' ? 403 : 409);
  }
});
// These rejection checks publish and fsync a real backup before validating it.
// Allow bounded disk contention while retaining all source/destination assertions.
for (const defect of ['digest', 'corrupt', 'incomplete', 'maintenance', 'fencing', 'nonempty', 'symlink', 'source'] as const) it(`@04-12-01 ${defect} refuses restore without changing source or destination`, { timeout: 15_000 }, async () => {
  const input = await selected(); const oldBytes = await readFile(input.sourceDatabase);
  if (defect === 'digest') input.expectedManifestDigest = '0'.repeat(64);
  if (defect === 'corrupt') await writeFile(join(input.backup, 'database.sqlite'), 'invalid');
  if (defect === 'incomplete') await rm(join(input.backup, 'COMPLETE'));
  if (defect === 'maintenance') input.maintenanceConfirmed = false;
  if (defect === 'fencing') input.fencing.evidence = '';
  if (defect === 'nonempty') await writeFile(join(input.destination, 'database.sqlite-wal'), 'old-wal');
  if (defect === 'symlink') { const link = join(directory, 'link'); await symlink(input.destination, link); input.destination = link; }
  if (defect === 'source') input.destination = directory;
  const before = await readdir(input.destination);
  await expect(restoreBackup(input)).rejects.toThrow();
  expect(await readdir(input.destination)).toEqual(before); expect(await readFile(input.sourceDatabase)).toEqual(oldBytes);
});
it('@04-12-01 CLI explicitly inspects selects restores and verifies with sanitized failures', async () => {
  const input = await selected(); const output: string[] = []; const log = (value: string) => output.push(value);
  expect(await runOperator(['inspect', '--backup', input.backup], log)).toBe(0);
  expect(JSON.parse(output.pop()!).manifestDigest).toBe(input.expectedManifestDigest);
  expect(await runOperator(['restore', '--backup', input.backup], log)).toBe(1);
  expect(output.pop()).toBe('{"error":"OPERATOR_VERIFICATION_FAILED","ingress":"closed"}');
  expect(await readdir(input.destination)).toEqual([]);
  expect(await runOperator(['restore', '--backup', input.backup, '--destination', input.destination, '--source-database', input.sourceDatabase,
    '--expected-manifest-digest', input.expectedManifestDigest, '--maintenance-confirmed', '--writer-fenced', 'writer-stopped', '--fence-evidence', 'Synthetic writer exited'], log)).toBe(0);
  expect(await runOperator(['verify', '--destination', input.destination], log)).toBe(0);
  expect(output.join('')).not.toContain(directory); expect(output.join('')).not.toContain('example.org');
  await writeFile(join(input.destination, 'database.sqlite-wal'), 'Unexpected old WAL');
  expect(await runOperator(['verify', '--destination', input.destination], log)).toBe(1);
});
it('@04-12-01 future-dated selected backup cannot publish an unverifiable restore', async () => {
  const input = await selected(() => Date.now() + 3_600_000);
  await expect(restoreBackup(input)).rejects.toThrow();
  expect(await readdir(input.destination)).toEqual([]);
});
