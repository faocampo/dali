import { fork, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { createOidcProvider } from './oidc-provider.js';
import { IDENTITY_COOKIE } from './oidc-provider.js';
import { buildApp } from '../server/app.js';
import { openDatabase } from '../server/storage/database.js';
import { publishBackup, backupDigest, inspectBackupSet } from '../server/storage/backup.js';
import { restoreBackup, verifyRestore, type RestoreReport } from '../server/storage/restore.js';
import { readRecoveryEpoch } from '../server/storage/recovery-state.js';
import { getBackupHealth } from '../server/storage/backup-scheduler.js';

/** Owned synthetic restore drill with real SQLite and a private operator ingress header. */
export async function createRestoreService(assets: string) {
  const directory = await mkdtemp(join(tmpdir(), 'dali-restore-drill-'));
  const old = join(directory, 'old'); const fresh = join(directory, 'fresh'); const backups = join(directory, 'backups');
  for (const path of [old, fresh, backups]) await mkdir(path, { mode: 0o700 });
  const reservation = createServer(); reservation.listen(0, '127.0.0.1'); await once(reservation, 'listening');
  const port = (reservation.address() as { port: number }).port;
  await new Promise<void>(resolve => reservation.close(() => resolve()));
  const origin = `http://127.0.0.1:${port}`;
  const operatorToken = randomBytes(32).toString('hex'); const operatorHeaders = { 'x-synthetic-operator': operatorToken };
  const registration = { clientId: 'synthetic-restore', clientSecret: randomBytes(32).toString('hex'), redirectUri: origin + '/auth/callback' };
  const provider = await createOidcProvider({ port: 0, clients: [registration] });
  const sourceDatabase = join(old, 'database.sqlite'); let database = openDatabase(sourceDatabase);
  const config = { DALI_ORIGIN: origin, DALI_DATABASE_PATH: sourceDatabase, DALI_SESSION_SECRET: randomBytes(32).toString('hex'), DALI_SESSION_TTL_MS: '86400000',
    DALI_OIDC_ISSUER: provider.issuer, DALI_OIDC_CLIENT_ID: registration.clientId, DALI_OIDC_CLIENT_SECRET: registration.clientSecret,
    DALI_OIDC_CALLBACK_URL: registration.redirectUri, DALI_INTERNAL_CLAIM: 'membership', DALI_INTERNAL_VALUES_JSON: '["internal"]', DALI_INTERNAL_EMAIL_DOMAINS_JSON: '["example.org"]',
    DALI_BACKUP_DIRECTORY: backups, DALI_BACKUP_INDEPENDENT_STORAGE: 'true', DALI_BACKUP_INTERVAL_MS: '1000' };
  let ingress = true; let app: Awaited<ReturnType<typeof buildApp>>;
  async function start() {
    app = await buildApp({ config, database });
    app.addHook('onRequest', async (request, reply) => { if (!ingress && request.headers['x-synthetic-operator'] !== operatorToken) return reply.code(503).send({ code: 'SYNTHETIC_MAINTENANCE' }); });
    app.get('/*', async (request, reply) => { const response = await fetch(assets + request.url); return reply.type(response.headers.get('content-type') ?? 'text/html').send(Buffer.from(await response.arrayBuffer())); });
    await app.listen({ host: '127.0.0.1', port });
  }
  await start();
  return { origin, operatorHeaders, get database() { return database; },
    async backup() { const selected = await publishBackup({ database, destination: { directory: backups, independentStorage: true }, applicationVersion: '0.1.0' });
      const backup = join(backups, selected.id); return { ...selected, backup, manifestDigest: await backupDigest(join(backup, 'manifest.json')) }; },
    async plannedRestart() {
      ingress = false; await app.close(); database.close(); database = openDatabase(sourceDatabase); await start();
    },
    async restore(selected: { backup: string; manifestDigest: string }, revoke: { boardId: string; memberId: string }): Promise<RestoreReport> {
      ingress = false; await app.close(); database.close();
      await restoreBackup({ backup: selected.backup, expectedManifestDigest: selected.manifestDigest, destination: fresh, sourceDatabase,
        maintenanceConfirmed: true, fencing: { method: 'writer-stopped', evidence: 'Synthetic app close awaited; owned SQLite connection closed' } });
      const report = await verifyRestore(fresh);
      database = openDatabase(join(fresh, 'database.sqlite'));
      // The separate synthetic operator ledger records the post-selection revocation.
      database.transaction(() => {
        database.prepare('DELETE FROM board_grants WHERE board_id=? AND member_id=?').run(revoke.boardId, revoke.memberId);
        database.prepare('UPDATE boards SET revision=revision+1 WHERE id=?').run(revoke.boardId);
      })();
      config.DALI_DATABASE_PATH = database.name; await start(); return report;
    },
    async completeSets() { return inspectBackupSet({ directory: backups, independentStorage: true }); },
    currentEpoch() { return readRecoveryEpoch(database); },
    openIngress() { if (getBackupHealth(database).state !== 'healthy') throw new Error('Verified fresh coverage required'); ingress = true; },
    async close() { await app?.close(); if (database.open) database.close(); await provider.close(); await rm(directory, { recursive: true, force: true }); },
  };
}

/** Signed OIDC authorization-code flow for HTTP-only crash tests. */
export async function durabilityActor(origin: string, identity = 'owner') {
  const start = await fetch(origin + '/auth/start', { redirect: 'manual' });
  const browserCookie = start.headers.getSetCookie().at(-1)!.split(';')[0]!;
  const authorize = await fetch(start.headers.get('location')!, { redirect: 'manual', headers: { cookie: `${IDENTITY_COOKIE}=${identity}` } });
  const callback = await fetch(authorize.headers.get('location')!, { redirect: 'manual', headers: { cookie: browserCookie } });
  const cookie = callback.headers.getSetCookie().at(-1)!.split(';')[0]!;
  const session = await fetch(origin + '/api/session', { headers: { cookie } });
  if (session.status !== 200) throw new Error('Synthetic signed authentication failed');
  const member = await session.json() as { accountId: string };
  const state = await fetch(origin + '/api/recovery-state', { headers: { cookie, 'x-dali-account': member.accountId } });
  if (!state.ok) throw new Error('Synthetic recovery metadata unavailable');
  const { epoch } = await state.json() as { epoch: string };
  return { cookie, 'x-dali-account': member.accountId, 'x-dali-request': '1', 'x-dali-recovery-epoch': epoch, origin };
}

export async function createDurabilityService(assets: string) {
  const directory = await mkdtemp(join(tmpdir(), 'dali-durability-'));
  const reservation = createServer(); reservation.listen(0, '127.0.0.1'); await once(reservation, 'listening');
  const port = (reservation.address() as { port: number }).port;
  await new Promise<void>(resolve => reservation.close(() => resolve()));
  const origin = `http://127.0.0.1:${port}`;
  const registration = { clientId: 'synthetic-durability', clientSecret: randomBytes(32).toString('hex'), redirectUri: origin + '/auth/callback' };
  const provider = await createOidcProvider({ port: 0, clients: [registration] });
  const databasePath = join(directory, 'boards.sqlite');
  const config = {
    DALI_ORIGIN: origin, DALI_DATABASE_PATH: databasePath, DALI_SESSION_SECRET: randomBytes(32).toString('hex'), DALI_SESSION_TTL_MS: '86400000',
    DALI_OIDC_ISSUER: provider.issuer, DALI_OIDC_CLIENT_ID: registration.clientId, DALI_OIDC_CLIENT_SECRET: registration.clientSecret,
    DALI_OIDC_CALLBACK_URL: registration.redirectUri, DALI_INTERNAL_CLAIM: 'membership', DALI_INTERNAL_VALUES_JSON: '["internal"]', DALI_INTERNAL_EMAIL_DOMAINS_JSON: '["example.org"]',
  };
  let child: ChildProcess;
  async function command(mode: string) {
    return new Promise<boolean>(resolve => {
      const timer = setTimeout(() => { child.off('message', listener); resolve(false); }, 1000);
      const listener = (message: unknown) => {
        if ((message as { type: string }).type === 'armed') { clearTimeout(timer); child.off('message', listener); resolve(true); }
      };
      child.on('message', listener); child.send({ mode });
    });
  }
  async function start() {
    child = fork(join(process.cwd(), '.gsd/access-build/server/testing/durability-child.js'), [], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
    const ready = new Promise<{ type: string; pragmas: { journal: string; synchronous: number; foreignKeys: number } }>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Durability child startup timed out')), 20000);
      child.once('message', message => { clearTimeout(timer); resolve(message as never); });
      child.once('exit', code => { clearTimeout(timer); reject(new Error(`Durability child exited: ${code}`)); });
      child.once('error', reject);
    });
    child.send({ config, assets, port });
    return ready;
  }
  async function stop(signal: NodeJS.Signals = 'SIGKILL') {
    if (child && child.exitCode === null && child.signalCode === null) { const exited = once(child, 'exit'); child.kill(signal); await exited; }
  }
  try {
    const ready = await start();
    return { origin, databasePath, pragmas: ready.pragmas, command,
      waitForBoundary() {
        return new Promise<string>((resolve, reject) => {
          const timer = setTimeout(() => { child.off('message', listener); reject(new Error('Commit boundary not reached')); }, 10000);
          const listener = (message: unknown) => {
            const value = message as { type: string; boundary: string };
            if (value.type === 'boundary') { clearTimeout(timer); child.off('message', listener); resolve(value.boundary); }
          };
          child.on('message', listener);
        });
      },
      async killAndRestart(signal: NodeJS.Signals = 'SIGKILL') { await stop(signal); return start(); },
      async close() { await stop(); await provider.close(); await rm(directory, { recursive: true, force: true }); },
    };
  } catch (error) { await stop(); await provider.close(); await rm(directory, { recursive: true, force: true }); throw error; }
}
