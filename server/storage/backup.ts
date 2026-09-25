import type { AccountDatabase } from './database.js';
import { randomUUID, createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { open, lstat, mkdir, realpath, rename, rm, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { validateBackupDatabase } from './backup-validation.js';
export type BackupDestination = { directory: string; independentStorage: true };
export type BackupManifest = { schemaVersion: 1; applicationVersion: string; databaseVersion: number; epoch: string; recoveryPointAt: number; completedAt: number; byteLength: number; sha256: string; counts: Record<string, number> };
export type BackupOptions = { database: AccountDatabase; destination: BackupDestination; applicationVersion: string; now?: () => number; progress?: (info: { totalPages: number; remainingPages: number }) => number };
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
export async function publishBackup(options: BackupOptions): Promise<{ id: string; manifest: BackupManifest }> {
  let temporary: string | undefined;
  try {
    const destination = await destinationDirectory(options); const now = options.now ?? Date.now;
    const recoveryPointAt = now(); if (!Number.isSafeInteger(recoveryPointAt) || recoveryPointAt < 0) throw new Error('Invalid clock');
    const id = `backup-${recoveryPointAt}-${randomUUID()}`; temporary = join(destination, '.' + id + '.partial'); await mkdir(temporary, { mode: 0o700 });
    const file = join(temporary, 'database.sqlite'); const handle = await open(file, 'wx', 0o600); await handle.close();
    await options.database.backup(file, options.progress ? { progress: options.progress } : undefined);
    const validation = validateBackupDatabase(file); const sha256 = await backupDigest(file); const byteLength = (await stat(file)).size;
    const completedAt = now(); if (!Number.isSafeInteger(completedAt) || completedAt < recoveryPointAt) throw new Error('Invalid clock');
    const manifest: BackupManifest = { schemaVersion: 1, applicationVersion: options.applicationVersion, ...validation, recoveryPointAt, completedAt, byteLength, sha256 };
    await syncPath(file); await writeExclusive(join(temporary, 'manifest.json'), JSON.stringify(manifest) + '\n'); await syncPath(temporary);
    const published = join(destination, id); await rename(temporary, published); temporary = undefined; await syncPath(destination);
    await writeExclusive(join(published, 'COMPLETE'), sha256 + '\n'); await syncPath(published); await syncPath(destination);
    return { id, manifest };
  } catch { if (temporary) await rm(temporary, { recursive: true, force: true }).catch(() => undefined); throw new Error('Backup publication failed'); }
}
