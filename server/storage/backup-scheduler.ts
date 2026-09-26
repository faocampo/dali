import type { AccountDatabase } from './database.js';
import type { BackupDestination } from './backup.js';
export type SchedulerOptions = { database: AccountDatabase; destination: BackupDestination; applicationVersion: string; wall?: () => number; monotonic?: () => number };
export class BackupScheduler {
  constructor(readonly options: SchedulerOptions) {}
  async start(): Promise<void> { throw new Error('Verified backup scheduling unavailable'); }
  async close(): Promise<void> {}
}
