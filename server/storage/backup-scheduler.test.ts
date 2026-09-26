import { afterEach, beforeEach, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { buildApp } from '../app.js';
import { openDatabase, type AccountDatabase } from './database.js';
import { inspectBackupSet, publishBackup } from './backup.js';
import { BackupScheduler, BACKUP_DEFAULTS, readStorageConfig, type SchedulerOptions } from './backup-scheduler.js';
import type { FastifyInstance } from 'fastify';
import { readBackupSchedule } from './recovery-state.js';

let directory: string; let database: AccountDatabase; let app: FastifyInstance;
let destination: { directory: string; independentStorage: true }; let clock: number; let mono: number;
let schedulers: BackupScheduler[]; let scheduled: (() => void)[]; let cancelled: number;
let config: Record<string, string>;
const make = (extra: Partial<SchedulerOptions> = {}) => {
  const scheduler = new BackupScheduler({ database, destination, applicationVersion: '0.1.0', wall: () => clock, monotonic: () => mono,
    schedule: callback => { scheduled.push(callback); return () => { cancelled++; }; }, ...extra });
  schedulers.push(scheduler); return scheduler;
};
const advance = (ms: number) => { clock += ms; mono += ms; };
beforeEach(async () => {
  clock = 1_800_000_000_000; mono = 0; schedulers = []; scheduled = []; cancelled = 0;
  directory = await mkdtemp(join(tmpdir(), 'dali-schedule-'));
  destination = { directory: join(directory, 'backups'), independentStorage: true as const };
  await mkdir(destination.directory, { mode: 0o700 });
  database = openDatabase(join(directory, 'live.sqlite'));
  config = {
    DALI_ORIGIN: 'http://127.0.0.1:5499', DALI_DATABASE_PATH: database.name,
    DALI_SESSION_SECRET: randomBytes(32).toString('hex'), DALI_SESSION_TTL_MS: '86400000',
    DALI_OIDC_ISSUER: 'https://identity.example.org', DALI_OIDC_CLIENT_ID: 'synthetic', DALI_OIDC_CLIENT_SECRET: 'synthetic',
    DALI_OIDC_CALLBACK_URL: 'http://127.0.0.1:5499/auth/callback', DALI_INTERNAL_CLAIM: 'membership',
    DALI_INTERNAL_VALUES_JSON: '["internal"]', DALI_INTERNAL_EMAIL_DOMAINS_JSON: '["example.org"]',
  }; app = await buildApp({ database, config });
});
afterEach(async () => { for (const scheduler of schedulers) await scheduler.close(); await app?.close(); database?.close(); await rm(directory, { recursive: true, force: true }); });
it('@04-11-01 startup runs the due verified baseline before admission', async () => {
  const scheduler = make(); expect(scheduler.health().reason).toBe('no-baseline');
  await expect(scheduler.start()).resolves.toBeUndefined();
  expect(await inspectBackupSet(destination)).toHaveLength(1);
  expect(scheduler.health()).toEqual({ state: 'healthy', recoverableAgeMs: 0, recoveryPointAt: clock, reason: 'fresh', failure: null });
  expect(readBackupSchedule(database)).toEqual({ backup_point: clock, backup_completed: clock, backup_checked: clock });
});
it('@04-11-01 duplicate start and overlapping checks publish once, missed timer does not replay backlog', async () => {
  let release!: () => void; let publications = 0;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const scheduler = make({ publish: async options => { publications++; await gate; return publishBackup(options); } });
  const first = scheduler.start(); expect(scheduler.start()).toBe(first); const overlap = scheduler.check();
  release(); await Promise.all([first, overlap]); expect(publications).toBe(1); expect(scheduled).toHaveLength(1);
  advance(BACKUP_DEFAULTS.intervalMs - 1); await scheduler.check(); expect(publications).toBe(1);
  advance(1); await scheduler.check(); expect(publications).toBe(2);
  advance(5 * BACKUP_DEFAULTS.intervalMs); scheduled.shift()!(); await scheduler.check(); expect(publications).toBe(3);
  await scheduler.close(); expect(cancelled).toBe(1);
});
it('@04-11-01 restart independently inspects old coverage and resumes due work', async () => {
  const original = make(); await original.start(); await original.close(); advance(900_000);
  const restart = make(); await restart.start(); expect((await inspectBackupSet(destination)).map(set => set.manifest.recoveryPointAt)).toEqual([clock, clock - 900_000]);
  expect(restart.health().recoverableAgeMs).toBe(0);
});
it('@04-11-01 stale coverage alerts at 45 minutes and fences exactly at 60 without a timer', async () => {
  let fail = false; const scheduler = make({ publish: options => fail ? Promise.reject(new Error('ENOSPC')) : publishBackup(options) });
  await scheduler.start(); fail = true;
  advance(2_699_999); expect(scheduler.health().state).toBe('healthy'); advance(1); expect(scheduler.health()).toMatchObject({ state: 'alert', reason: 'aging' });
  await scheduler.check(); expect(scheduler.health()).toMatchObject({ failure: 'publication', recoveryPointAt: clock - 2_700_000 });
  advance(899_999); expect(scheduler.health().state).toBe('alert'); advance(1); expect(scheduler.health()).toMatchObject({ state: 'fenced', reason: 'stale', recoverableAgeMs: 3_600_000 });
  fail = false; await scheduler.check(); expect(scheduler.health()).toMatchObject({ state: 'healthy', recoverableAgeMs: 0, failure: null });
});
it.each(['backward', 'forward', 'monotonic'] as const)('@04-11-01 %s clock anomaly conservatively fences', async kind => {
  const scheduler = make(); await scheduler.start();
  if (kind === 'backward') clock--; else if (kind === 'forward') clock += 120_000; else mono--;
  expect(scheduler.health()).toMatchObject({ state: 'fenced', reason: 'clock-invalid' });
  await scheduler.check(); expect(await inspectBackupSet(destination)).toHaveLength(1);
});
it('@04-11-01 restart rejects wall time earlier than persisted valid check', async () => {
  const scheduler = make(); await scheduler.start(); await scheduler.close(); clock--;
  const restart = make(); await restart.start(); expect(restart.health().reason).toBe('clock-invalid');
});
it('@04-11-01 publication failure without baseline stays fenced and does not publish metadata', async () => {
  const scheduler = make({ publish: async () => { throw new Error('ENOSPC synthetic'); } });
  await scheduler.start(); expect(scheduler.health()).toMatchObject({ state: 'fenced', reason: 'no-baseline', failure: 'publication' });
  expect(readBackupSchedule(database).backup_point).toBeNull(); expect(await inspectBackupSet(destination)).toHaveLength(0);
});
it('@04-11-01 31-day retention prunes only verified sets strictly beyond 30 days after newer success', async () => {
  const scheduler = make(); await scheduler.start(); const first = (await inspectBackupSet(destination))[0]!;
  advance(86_400_000); await scheduler.check(); const boundary = (await inspectBackupSet(destination))[0]!;
  await mkdir(join(destination.directory, '.synthetic-partial'), { mode: 0o700 });
  advance(30 * 86_400_000); await scheduler.check();
  const ids = (await inspectBackupSet(destination)).map(set => set.id);
  expect(ids).not.toContain(first.id); expect(ids).toContain(boundary.id); expect(ids).toHaveLength(2);
  expect(await readdir(destination.directory)).toContain('.synthetic-partial');
});
it('@04-11-01 failed publication and pruning preserve last good sets and report sanitized failure', async () => {
  let fail = false; const scheduler = make({ publish: options => fail ? Promise.reject(new Error('synthetic private destination')) : publishBackup(options), remove: async () => { throw new Error('EIO'); } });
  await scheduler.start(); const original = (await inspectBackupSet(destination))[0]!.id;
  advance(31 * 86_400_000); fail = true; await scheduler.check(); expect((await inspectBackupSet(destination)).map(set => set.id)).toEqual([original]);
  fail = false; await scheduler.check(); expect(scheduler.health()).toMatchObject({ state: 'alert', failure: 'retention', reason: 'fresh' });
  expect((await inspectBackupSet(destination)).map(set => set.id)).toContain(original); expect(JSON.stringify(scheduler.health())).not.toContain('destination');
});
it('@04-11-01 missing destination and forged completion metadata never establish a baseline', async () => {
  const scheduler = make({ destination: { directory: join(directory, 'unmounted'), independentStorage: true } });
  database.prepare('UPDATE recovery_state SET backup_point=?,backup_completed=?').run(clock, clock);
  await scheduler.start(); expect(scheduler.health()).toMatchObject({ reason: 'no-baseline', state: 'fenced', failure: 'publication' });
});
it('@04-11-01 configuration preserves the approved upper cadence and age bounds and minimum retention', () => {
  const env = { DALI_BACKUP_DIRECTORY: '/synthetic/backups', DALI_BACKUP_INDEPENDENT_STORAGE: 'true' };
  expect(readStorageConfig(env)).toMatchObject(BACKUP_DEFAULTS);
  for (const [key, value] of [['DALI_BACKUP_INTERVAL_MS', '900001'], ['DALI_BACKUP_MAX_AGE_MS', '3600001'], ['DALI_BACKUP_RETENTION_DAYS', '29'], ['DALI_BACKUP_DIRECTORY', 'relative'], ['DALI_BACKUP_INDEPENDENT_STORAGE', 'false']]) expect(() => readStorageConfig({ ...env, [key!]: value })).toThrow();
});
it('@04-11-01 application startup and real timer automatically publish and close cancels scheduling', async () => {
  await app.close();
  app = await buildApp({ database, config: { ...config, DALI_BACKUP_DIRECTORY: destination.directory, DALI_BACKUP_INDEPENDENT_STORAGE: 'true', DALI_BACKUP_INTERVAL_MS: '1000' } });
  expect(await inspectBackupSet(destination)).toHaveLength(1);
  await new Promise(resolve => setTimeout(resolve, 1200));
  expect(await inspectBackupSet(destination)).toHaveLength(2);
  expect((await app.inject('/api/storage-health')).statusCode).toBe(401);
  await app.close(); const count = (await inspectBackupSet(destination)).length;
  await new Promise(resolve => setTimeout(resolve, 1100)); expect(await inspectBackupSet(destination)).toHaveLength(count);
});
