import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, realpath, readdir, readFile, mkdir, copyFile, open, rename, rm } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { backupDigest, inspectBackupSet } from './backup.js';
import { validateBackupDatabase } from './backup-validation.js';
import { runMigrations } from './database.js';
import { initializeBackupSchedule, resetRestoredRecoveryState } from './recovery-state.js';

export type RestoreOptions = {
  backup: string; destination: string; sourceDatabase: string; expectedManifestDigest: string;
  maintenanceConfirmed: boolean; fencing: { method: 'writer-stopped' | 'storage-fenced'; evidence: string };
};
export type RestoreReport = { schemaVersion: 1; backupId: string; manifestDigest: string; recoveryPointAt: number; restoredAt: number; epoch: string; previousEpoch: string; counts: Record<string, number>; integrity: 'verified'; sessionsInvalidated: true; ingress: 'closed' };
async function directory(path: string) {
  const info = await lstat(path);
  if (!info.isDirectory() || info.isSymbolicLink() || (info.mode & 0o077)) throw new Error('Restricted directory required');
  return realpath(path);
}
async function sync(path: string) { const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW); try { await handle.sync(); } finally { await handle.close(); } }
async function write(path: string, value: string) { const handle = await open(path, 'wx', 0o600); try { await handle.writeFile(value); await handle.sync(); } finally { await handle.close(); } }
/** Explicit selection only. This never chooses the latest set on an operator's behalf. */
export async function inspectSelectedBackup(backup: string, expectedManifestDigest?: string) {
  try {
    const selected = await directory(resolve(backup));
    if (JSON.stringify((await readdir(selected)).sort()) !== JSON.stringify(['COMPLETE', 'database.sqlite', 'manifest.json'])) throw new Error('Unexpected backup companions');
    const result = (await inspectBackupSet({ directory: dirname(selected), independentStorage: true })).find(item => item.id === basename(selected));
    if (!result) throw new Error('Invalid selected set');
    const manifestDigest = await backupDigest(join(selected, 'manifest.json'));
    if (expectedManifestDigest !== undefined && (!/^[a-f0-9]{64}$/.test(expectedManifestDigest) || manifestDigest !== expectedManifestDigest)) throw new Error('Manifest mismatch');
    return { ...result, manifestDigest };
  } catch { throw new Error('Selected backup verification failed'); }
}
/** Offline only: fencing evidence is an operator attestation, never inferred from a path or PID. */
export async function restoreBackup(options: RestoreOptions): Promise<RestoreReport> {
  let staging: string | undefined;
  try {
    if (options.maintenanceConfirmed !== true || !['writer-stopped', 'storage-fenced'].includes(options.fencing?.method) ||
        typeof options.fencing?.evidence !== 'string' || !options.fencing.evidence.trim() || options.fencing.evidence.length > 4000 ||
        !options.sourceDatabase || !/^[a-f0-9]{64}$/.test(options.expectedManifestDigest)) throw new Error('Maintenance and fencing evidence required');
    const selected = await inspectSelectedBackup(options.backup, options.expectedManifestDigest);
    if (!Number.isSafeInteger(Date.now()) || Date.now() < selected.manifest.completedAt) throw new Error('Restore clock precedes selected backup');
    const backup = await directory(options.backup); const target = await directory(options.destination);
    // The live file may have been lost. Resolve its existing parent without opening SQLite or its WAL.
    const source = join(await realpath(dirname(resolve(options.sourceDatabase))), basename(options.sourceDatabase));
    if (target === dirname(source) || source.startsWith(target + '/') || target === backup || target.startsWith(backup + '/') || backup.startsWith(target + '/') || (await readdir(target)).length) throw new Error('Fresh distinct destination required');
    staging = join(dirname(target), '.restore-' + randomUUID()); await mkdir(staging, { mode: 0o700 });
    const file = join(staging, 'database.sqlite');
    await copyFile(join(backup, 'database.sqlite'), file, constants.COPYFILE_EXCL);
    if (await backupDigest(file) !== selected.manifest.sha256 || (await lstat(file)).size !== selected.manifest.byteLength) throw new Error('Copy mismatch');
    const before = validateBackupDatabase(file);
    if (before.epoch !== selected.manifest.epoch) throw new Error('Copy epoch mismatch');
    const database = new Database(file, { fileMustExist: true }); let epoch: string;
    try {
      runMigrations(database); initializeBackupSchedule(database);
      epoch = resetRestoredRecoveryState(database);
      if (database.pragma('journal_mode=DELETE', { simple: true }) !== 'delete') throw new Error('Standalone database required');
    } finally { database.close(); }
    const after = validateBackupDatabase(file);
    if (JSON.stringify(after.counts) !== JSON.stringify(before.counts) || epoch! !== after.epoch || after.epoch === before.epoch) throw new Error('Restore integrity mismatch');
    const restoredAt = Date.now(); if (!Number.isSafeInteger(restoredAt) || restoredAt < selected.manifest.completedAt) throw new Error('Restore clock changed');
    const report: RestoreReport = { schemaVersion: 1, backupId: selected.id, manifestDigest: selected.manifestDigest, recoveryPointAt: selected.manifest.recoveryPointAt,
      restoredAt, previousEpoch: before.epoch, epoch: after.epoch, counts: after.counts, integrity: 'verified', sessionsInvalidated: true, ingress: 'closed' };
    await sync(file); await write(join(staging, 'restore-report.json'), JSON.stringify(report) + '\n'); await sync(staging);
    // Recheck the named destination; rename refuses a competing nonempty directory. Parent directories must be operator-controlled.
    if (await directory(options.destination) !== target || (await readdir(target)).length) throw new Error('Destination changed');
    await rename(staging, target); staging = undefined; await sync(dirname(target));
    return report;
  } catch { throw new Error('Restore failed; ingress must remain closed'); }
  finally { if (staging) await rm(staging, { recursive: true, force: true }).catch(() => undefined); }
}
/** Offline verification before application startup; later access reconciliation is an operator gate. */
export async function verifyRestore(destination: string): Promise<RestoreReport> {
  try {
    const target = await directory(destination);
    if (JSON.stringify((await readdir(target)).sort()) !== JSON.stringify(['database.sqlite', 'restore-report.json'])) throw new Error('Unexpected restore companions');
    for (const name of ['database.sqlite', 'restore-report.json']) {
      const info = await lstat(join(target, name));
      if (!info.isFile() || info.isSymbolicLink() || (info.mode & 0o077) || (name.endsWith('.json') && info.size > 65536)) throw new Error('Invalid restore file');
    }
    const report = JSON.parse(await readFile(join(target, 'restore-report.json'), 'utf8')) as RestoreReport;
    const state = validateBackupDatabase(join(target, 'database.sqlite'));
    if (report.schemaVersion !== 1 || report.integrity !== 'verified' || report.sessionsInvalidated !== true || report.ingress !== 'closed' ||
        !/^backup-\d+-[0-9a-f-]{36}$/.test(report.backupId) || !/^[0-9a-f]{64}$/.test(report.manifestDigest) ||
        !Number.isSafeInteger(report.recoveryPointAt) || report.recoveryPointAt < 0 || !Number.isSafeInteger(report.restoredAt) || report.restoredAt < report.recoveryPointAt ||
        !/^[0-9a-f-]{36}$/.test(report.previousEpoch) || report.previousEpoch === state.epoch || report.epoch !== state.epoch || JSON.stringify(report.counts) !== JSON.stringify(state.counts)) throw new Error('Invalid report');
    const database = new Database(join(target, 'database.sqlite'), { readonly: true, fileMustExist: true });
    try { for (const table of ['sessions', 'login_transactions']) if ((database.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n) throw new Error('Authentication state retained'); }
    finally { database.close(); }
    // Return only known aggregate fields, even if an operator modified the local report.
    return { schemaVersion: 1, backupId: report.backupId, manifestDigest: report.manifestDigest, recoveryPointAt: report.recoveryPointAt, restoredAt: report.restoredAt,
      epoch: state.epoch, previousEpoch: report.previousEpoch, counts: state.counts, integrity: 'verified', sessionsInvalidated: true, ingress: 'closed' };
  } catch { throw new Error('Restore verification failed; ingress must remain closed'); }
}
