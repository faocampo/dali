export type RestoreOptions = {
  backup: string; destination: string; sourceDatabase: string; expectedManifestDigest: string;
  maintenanceConfirmed: boolean; fencing: { method: 'writer-stopped' | 'storage-fenced'; evidence: string };
};
export type RestoreReport = { schemaVersion: 1; backupId: string; manifestDigest: string; recoveryPointAt: number; restoredAt: number; epoch: string; previousEpoch: string; counts: Record<string, number>; integrity: 'verified'; sessionsInvalidated: true; ingress: 'closed' };
export async function restoreBackup(_options: RestoreOptions): Promise<RestoreReport> { throw new Error('Restore unavailable'); }
export async function verifyRestore(_destination: string): Promise<RestoreReport> { throw new Error('Restore unavailable'); }
