import type { AccountDatabase } from './database.js';
export type BackupDestination = { directory: string; independentStorage: true };
export type BackupManifest = { schemaVersion: 1; applicationVersion: string; databaseVersion: number; epoch: string; recoveryPointAt: number; completedAt: number; byteLength: number; sha256: string; counts: Record<string, number> };
export type BackupOptions = { database: AccountDatabase; destination: BackupDestination; applicationVersion: string; now?: () => number; progress?: (info: { totalPages: number; remainingPages: number }) => number };
export async function publishBackup(_options: BackupOptions): Promise<{ id: string; manifest: BackupManifest }> { throw new Error('Verified backup publication unavailable'); }
