import type { AccountDatabase } from './database.js';
import Database from 'better-sqlite3';
import { randomUUID, createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { open, lstat, mkdir, realpath, rename, rm, stat, readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { validateBackupDatabase } from './backup-validation.js';
export type BackupDestination = { directory: string; independentStorage: true };
export type BackupManifest = { schemaVersion: 1; applicationVersion: string; databaseVersion: number; epoch: string; recoveryPointAt: number; completedAt: number; byteLength: number; sha256: string; counts: Record<string, number> };
export type BackupBoundary = 'snapshot' | 'verification' | 'digest' | 'file-sync' | 'manifest-sync' | 'rename' | 'directory-sync' | 'completion-marker' | 'completion-sync';
export type BackupOptions = { database: AccountDatabase; destination: BackupDestination; applicationVersion: string; now?: () => number; progress?: (info: { totalPages: number; remainingPages: number }) => number; onBoundary?: (boundary: BackupBoundary) => void | Promise<void> };
type Publication = { id: string; manifest: BackupManifest };
const active = new WeakMap<AccountDatabase, { key: string; promise: Promise<Publication> }>();
export async function backupDigest(path: string) {
  const hash = createHash('sha256'); for await (const chunk of createReadStream(path)) hash.update(chunk); return hash.digest('hex');
}
async function syncPath(path: string) { const handle = await open(path, 'r'); try { await handle.sync(); } finally { await handle.close(); } }
async function writeExclusive(path: string, value: string) { const handle = await open(path, 'wx', 0o600); try { await handle.writeFile(value); await handle.sync(); } finally { await handle.close(); } }
async function destinationDirectory(options: BackupOptions) {
  if (options.destination.independentStorage !== true || !options.destination.directory || !/^[a-zA-Z0-9][a-zA-Z0-9.+_-]{0,127}$/.test(options.applicationVersion)) throw new Error('Backup destination contract required');
  const path = resolve(options.destination.directory); const info = await lstat(path);
  if (!info.isDirectory() || info.isSymbolicLink() || (info.mode & 0o077) !== 0) throw new Error('Restricted backup destination required');
  const canonical = await realpath(path);
  if (options.database.name !== ':memory:' && (canonical === await realpath(dirname(options.database.name)) || resolve(options.database.name).startsWith(canonical + '/'))) throw new Error('Independent backup destination required');
  return canonical;
}
/** One live connection owns its asynchronous snapshot; duplicate triggers join it. */
export function publishBackup(options: BackupOptions): Promise<Publication> {
  const key = JSON.stringify([resolve(options.destination.directory), options.destination.independentStorage, options.applicationVersion]);
  const running = active.get(options.database);
  if (running) return running.key === key ? running.promise : Promise.reject(new Error('Backup already in progress'));
  const promise = publish(options).finally(() => { if (active.get(options.database)?.promise === promise) active.delete(options.database); });
  active.set(options.database, { key, promise }); return promise;
}
async function publish(options: BackupOptions): Promise<Publication> {
  let owned: string | undefined;
  try {
    const destination = await destinationDirectory(options); const now = options.now ?? Date.now;
    const recoveryPointAt = now(); if (!Number.isSafeInteger(recoveryPointAt) || recoveryPointAt < 0) throw new Error('Invalid clock');
    const id = `backup-${recoveryPointAt}-${randomUUID()}`; const temporary = join(destination, '.' + id + '.partial'); await mkdir(temporary, { mode: 0o700 }); owned = temporary;
    const file = join(temporary, 'database.sqlite'); const handle = await open(file, 'wx', 0o600); await handle.close();
    await options.onBoundary?.('snapshot'); await options.database.backup(file, options.progress ? { progress: options.progress } : undefined);
    // Normalize only the completed copy so read-only inspection needs no WAL/SHM.
    const copy = new Database(file, { fileMustExist: true });
    try { if (copy.pragma('journal_mode=DELETE', { simple: true }) !== 'delete') throw new Error('Backup journal unavailable'); }
    finally { copy.close(); }
    await options.onBoundary?.('verification'); const validation = validateBackupDatabase(file);
    await options.onBoundary?.('digest'); const sha256 = await backupDigest(file); const byteLength = (await stat(file)).size;
    const completedAt = now(); if (!Number.isSafeInteger(completedAt) || completedAt < recoveryPointAt) throw new Error('Invalid clock');
    const manifest: BackupManifest = { schemaVersion: 1, applicationVersion: options.applicationVersion, ...validation, recoveryPointAt, completedAt, byteLength, sha256 };
    await options.onBoundary?.('file-sync'); await syncPath(file);
    await options.onBoundary?.('manifest-sync'); await writeExclusive(join(temporary, 'manifest.json'), JSON.stringify(manifest) + '\n'); await syncPath(temporary);
    const published = join(destination, id); await options.onBoundary?.('rename'); await rename(temporary, published); owned = published;
    await options.onBoundary?.('directory-sync'); await syncPath(destination);
    await options.onBoundary?.('completion-marker'); await writeExclusive(join(published, '.complete.pending'), sha256 + '\n');
    await rename(join(published, '.complete.pending'), join(published, 'COMPLETE'));
    await options.onBoundary?.('completion-sync'); await syncPath(published); await syncPath(destination);
    owned = undefined;
    return { id, manifest };
  } catch { if (owned) await rm(owned, { recursive: true, force: true }).catch(() => undefined); throw new Error('Backup publication failed'); }
}

/** Read-only selection: partial, corrupt, unsupported and unverified sets are omitted. */
export async function inspectBackupSet(destination: BackupDestination): Promise<Publication[]> {
  if (destination.independentStorage !== true) throw new Error('Backup destination contract required');
  const directory = resolve(destination.directory); const root = await lstat(directory);
  if (!root.isDirectory() || root.isSymbolicLink() || (root.mode & 0o077)) throw new Error('Restricted backup destination required');
  const results: Publication[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^backup-\d+-[0-9a-f-]{36}$/.test(entry.name)) continue;
    try {
      const path = join(directory, entry.name); const info = await lstat(path); if (!info.isDirectory() || info.isSymbolicLink() || (info.mode & 0o077)) continue;
      for (const [name, limit] of [['manifest.json', 65536], ['COMPLETE', 65], ['database.sqlite', Number.MAX_SAFE_INTEGER]] as const) {
        const file = await lstat(join(path, name)); if (!file.isFile() || file.isSymbolicLink() || (file.mode & 0o077) || !file.size || file.size > limit) throw new Error('Invalid backup file');
      }
      const manifest = JSON.parse(await readFile(join(path, 'manifest.json'), 'utf8')) as BackupManifest;
      if (manifest.schemaVersion !== 1 || !/^[a-zA-Z0-9][a-zA-Z0-9.+_-]{0,127}$/.test(manifest.applicationVersion) || !/^[0-9a-f]{64}$/.test(manifest.sha256) || !Number.isSafeInteger(manifest.recoveryPointAt) || manifest.recoveryPointAt < 0 || !Number.isSafeInteger(manifest.completedAt) || manifest.completedAt < manifest.recoveryPointAt || !Number.isSafeInteger(manifest.byteLength) || manifest.byteLength <= 0 || !entry.name.startsWith(`backup-${manifest.recoveryPointAt}-`)) continue;
      if (await readFile(join(path, 'COMPLETE'), 'utf8') !== manifest.sha256 + '\n' || (await stat(join(path, 'database.sqlite'))).size !== manifest.byteLength || await backupDigest(join(path, 'database.sqlite')) !== manifest.sha256) continue;
      const verified = validateBackupDatabase(join(path, 'database.sqlite'));
      if (manifest.databaseVersion !== verified.databaseVersion || manifest.epoch !== verified.epoch || !manifest.counts || Object.keys(manifest.counts).length !== Object.keys(verified.counts).length || Object.entries(verified.counts).some(([key, count]) => manifest.counts[key] !== count)) continue;
      results.push({ id: entry.name, manifest: { schemaVersion: 1, applicationVersion: manifest.applicationVersion, ...verified, recoveryPointAt: manifest.recoveryPointAt, completedAt: manifest.completedAt, byteLength: manifest.byteLength, sha256: manifest.sha256 } });
    } catch { /* An incomplete or invalid set never advances recovery age. */ }
  }
  return results.sort((a, b) => b.manifest.recoveryPointAt - a.manifest.recoveryPointAt || a.id.localeCompare(b.id));
}
