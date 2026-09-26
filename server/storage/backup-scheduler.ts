import { performance } from 'node:perf_hooks';
import { rm, open } from 'node:fs/promises';
import { join, isAbsolute } from 'node:path';
import type { AccountDatabase } from './database.js';
import { publishBackup, inspectBackupSet, type BackupDestination } from './backup.js';
import { initializeBackupSchedule, readBackupSchedule, readRecoveryEpoch } from './recovery-state.js';

export const BACKUP_DEFAULTS = { intervalMs: 900_000, retentionDays: 30, alertAgeMs: 2_700_000, maxAgeMs: 3_600_000 };
export type StorageConfig = typeof BACKUP_DEFAULTS & { destination: BackupDestination };
export type BackupHealth = { state: 'healthy' | 'alert' | 'fenced'; recoverableAgeMs: number | null; recoveryPointAt: number | null; reason: 'fresh' | 'aging' | 'stale' | 'no-baseline' | 'clock-invalid'; failure: 'publication' | 'retention' | null };
export function readStorageConfig(env: Record<string, string | undefined>): StorageConfig {
  const directory = env.DALI_BACKUP_DIRECTORY;
  if (!directory || !isAbsolute(directory) || env.DALI_BACKUP_INDEPENDENT_STORAGE !== 'true') throw new Error('Backup configuration unavailable');
  const integer = (key: string, fallback: number, min: number, max: number) => {
    const value = env[key] ?? String(fallback);
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < min || Number(value) > max) throw new Error('Backup configuration unavailable');
    return Number(value);
  };
  const maxAgeMs = integer('DALI_BACKUP_MAX_AGE_MS', BACKUP_DEFAULTS.maxAgeMs, 60_000, BACKUP_DEFAULTS.maxAgeMs);
  return { destination: { directory, independentStorage: true }, maxAgeMs,
    intervalMs: integer('DALI_BACKUP_INTERVAL_MS', BACKUP_DEFAULTS.intervalMs, 1_000, Math.min(BACKUP_DEFAULTS.intervalMs, maxAgeMs)),
    retentionDays: integer('DALI_BACKUP_RETENTION_DAYS', 30, 30, 36500), alertAgeMs: Math.min(BACKUP_DEFAULTS.alertAgeMs, Math.floor(maxAgeMs * .75)) };
}
export const unavailableBackupHealth = (): BackupHealth => ({ state: 'fenced', recoverableAgeMs: null, recoveryPointAt: null, reason: 'no-baseline', failure: null });
const policies = new WeakMap<AccountDatabase, () => BackupHealth>();
export const getBackupHealth = (database: AccountDatabase) => policies.get(database)?.() ?? unavailableBackupHealth();
export function setBackupHealthPolicy(database: AccountDatabase, policy: () => BackupHealth) { policies.set(database, policy); }
export type StoragePolicy = { kind: 'fixture' } | { health: () => BackupHealth };
export type SchedulerOptions = { database: AccountDatabase; destination: BackupDestination; applicationVersion: string; wall?: () => number; monotonic?: () => number;
  policy?: typeof BACKUP_DEFAULTS; publish?: typeof publishBackup; inspect?: typeof inspectBackupSet; remove?: (directory: string) => Promise<void>;
  schedule?: (callback: () => void, delay: number) => () => void; onHealth?: (health: BackupHealth) => void };
export class BackupScheduler {
  private readonly wall; private readonly monotonic; private readonly policy;
  private wallAnchor: number; private monoAnchor: number; private clockInvalid = false;
  private point: number | null = null; private pointEpoch: string | null = null; private pointMono = 0; private pointAge = 0;
  private failure: BackupHealth['failure'] = null;
  private running?: Promise<void>; private startup?: Promise<void>; private cancel?: () => void; private closed = false;
  constructor(readonly options: SchedulerOptions) {
    initializeBackupSchedule(options.database);
    this.wall = options.wall ?? Date.now; this.monotonic = options.monotonic ?? (() => performance.now()); this.policy = options.policy ?? BACKUP_DEFAULTS;
    this.wallAnchor = this.wall(); this.monoAnchor = this.monotonic();
    const prior = readBackupSchedule(options.database).backup_checked;
    if (prior !== null && this.wallAnchor < prior) this.clockInvalid = true;
    setBackupHealthPolicy(options.database, () => this.health());
  }
  private sample() {
    const wall = this.wall(); const mono = this.monotonic();
    if (!Number.isSafeInteger(wall) || wall < 0 || !Number.isFinite(mono) || mono < this.monoAnchor || wall < this.wallAnchor || Math.abs((wall - this.wallAnchor) - (mono - this.monoAnchor)) > 60_000) this.clockInvalid = true;
    return { wall, mono };
  }
  health(): BackupHealth {
    const { wall, mono } = this.sample();
    const point = this.pointEpoch === readRecoveryEpoch(this.options.database) ? this.point : null;
    const age = point === null ? null : Math.max(0, wall - point, this.pointAge + mono - this.pointMono);
    const reason = this.clockInvalid ? 'clock-invalid' : age === null ? 'no-baseline' : age >= this.policy.maxAgeMs ? 'stale' : age >= this.policy.alertAgeMs ? 'aging' : 'fresh';
    return { state: ['clock-invalid', 'no-baseline', 'stale'].includes(reason) ? 'fenced' : reason === 'aging' || this.failure ? 'alert' : 'healthy',
      recoverableAgeMs: age, recoveryPointAt: point, reason, failure: this.failure };
  }
  start(): Promise<void> {
    if (!this.startup) this.startup = this.check().finally(() => this.arm());
    return this.startup;
  }
  private arm() {
    if (this.closed) return;
    const schedule = this.options.schedule ?? ((callback, delay) => { const timer = setTimeout(callback, delay); timer.unref(); return () => clearTimeout(timer); });
    this.cancel = schedule(() => { void this.check().finally(() => this.arm()); }, Math.min(60_000, this.policy.intervalMs));
  }
  check(): Promise<void> {
    if (this.closed) return Promise.resolve();
    if (!this.running) this.running = this.run().finally(() => { this.running = undefined; });
    return this.running;
  }
  private async run() {
    const { wall, mono } = this.sample();
    try {
      const epoch = readRecoveryEpoch(this.options.database);
      let sets = await (this.options.inspect ?? inspectBackupSet)(this.options.destination);
      const baseline = sets.find(set => set.manifest.epoch === epoch);
      if (!baseline) { this.point = null; this.pointEpoch = null; }
      else if (baseline.manifest.recoveryPointAt > wall || baseline.manifest.completedAt > wall) this.clockInvalid = true;
      else if (this.point !== baseline.manifest.recoveryPointAt || this.pointEpoch !== epoch) {
        this.point = baseline.manifest.recoveryPointAt; this.pointEpoch = epoch; this.pointAge = wall - this.point; this.pointMono = mono;
      }
      // Persist only valid observations; an invalid clock requires operator correction/restart.
      if (this.clockInvalid) { this.options.onHealth?.(this.health()); return; }
      this.options.database.prepare('UPDATE recovery_state SET backup_checked=? WHERE singleton=1').run(wall);
      if (this.point === null || this.health().recoverableAgeMs! >= this.policy.intervalMs) {
        const result = await (this.options.publish ?? publishBackup)({ database: this.options.database, destination: this.options.destination, applicationVersion: this.options.applicationVersion, now: this.wall });
        sets = await (this.options.inspect ?? inspectBackupSet)(this.options.destination);
        const verified = sets.find(set => set.id === result.id && set.manifest.epoch === epoch);
        if (!verified || readRecoveryEpoch(this.options.database) !== epoch || this.sample().wall < verified.manifest.completedAt || this.clockInvalid) throw new Error('Unverified publication');
        this.point = verified.manifest.recoveryPointAt; this.pointEpoch = epoch; this.pointAge = Math.max(this.wall() - this.point, this.monotonic() - mono); this.pointMono = this.monotonic();
        this.options.database.prepare('UPDATE recovery_state SET backup_point=?,backup_completed=?,backup_checked=? WHERE singleton=1').run(this.point, verified.manifest.completedAt, this.wall());
        this.failure = null;
        try {
          const cutoff = wall - this.policy.retentionDays * 86_400_000;
          // Only independently verified complete sets, strictly outside retention, after renewed coverage.
          for (const old of sets) if (old.id !== verified.id && old.id !== sets[0]?.id && old.manifest.completedAt < cutoff && old.manifest.recoveryPointAt < verified.manifest.recoveryPointAt) {
            const directory = join(this.options.destination.directory, old.id);
            if (this.options.remove) await this.options.remove(directory); else await rm(directory, { recursive: true });
          }
          const handle = await open(this.options.destination.directory, 'r'); try { await handle.sync(); } finally { await handle.close(); }
        } catch { this.failure = 'retention'; }
      }
    } catch { this.failure = 'publication'; }
    this.options.onHealth?.(this.health());
  }
  async close(): Promise<void> { this.closed = true; this.cancel?.(); await this.running; }
}
