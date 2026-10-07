import { randomUUID } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { runMigrations, type AccountDatabase } from './database.js';

export type RecoveryState = { epoch: string; schemaVersion: number };
export function initializeRecoveryState(database: AccountDatabase): RecoveryState {
  runMigrations(database, [{ version: 8, sql: `CREATE TABLE recovery_state (
    singleton INTEGER PRIMARY KEY CHECK(singleton=1), schema_version INTEGER NOT NULL CHECK(schema_version=1), epoch TEXT NOT NULL);` }]);
  database.prepare('INSERT INTO recovery_state(singleton,schema_version,epoch) VALUES(1,1,?) ON CONFLICT(singleton) DO NOTHING').run(randomUUID());
  return { epoch: readRecoveryEpoch(database), schemaVersion: 1 };
}
export function readRecoveryEpoch(database: AccountDatabase): string {
  const state = database.prepare('SELECT epoch,schema_version FROM recovery_state WHERE singleton=1').get() as { epoch: string; schema_version: number } | undefined;
  if (!state || state.schema_version !== 1 || !/^[0-9a-f-]{36}$/.test(state.epoch)) throw new Error('Recovery state unavailable');
  return state.epoch;
}
export type BackupScheduleState = { backup_point: number | null; backup_completed: number | null; backup_checked: number | null };
export function initializeBackupSchedule(database: AccountDatabase) {
  runMigrations(database, [{ version: 9, sql: `ALTER TABLE recovery_state ADD COLUMN backup_point INTEGER;
    ALTER TABLE recovery_state ADD COLUMN backup_completed INTEGER;
    ALTER TABLE recovery_state ADD COLUMN backup_checked INTEGER;` }]);
}
export function readBackupSchedule(database: AccountDatabase): BackupScheduleState {
  return database.prepare('SELECT backup_point,backup_completed,backup_checked FROM recovery_state WHERE singleton=1').get() as BackupScheduleState;
}
/** Only the offline fresh-target restore calls this, before service startup. */
export function resetRestoredRecoveryState(database: AccountDatabase): string {
  return database.transaction(() => {
    database.prepare('DELETE FROM login_transactions').run();
    database.prepare('DELETE FROM sessions').run();
    const epoch = randomUUID();
    database.prepare('UPDATE recovery_state SET epoch=?,backup_point=NULL,backup_completed=NULL,backup_checked=NULL WHERE singleton=1').run(epoch);
    return readRecoveryEpoch(database);
  })();
}
/** Call only after current authorization, and again inside the write transaction. */
export function requireRecoveryEpoch(database: AccountDatabase, request: FastifyRequest, reply: FastifyReply): string | undefined {
  const supplied = request.headers['x-dali-recovery-epoch'];
  if (typeof supplied !== 'string' || !supplied) { reply.code(409).send({ code: 'RECOVERY_EPOCH_REQUIRED' }); return; }
  const epoch = readRecoveryEpoch(database);
  if (supplied !== epoch) { reply.code(409).send({ code: 'RECOVERY_EPOCH_MISMATCH' }); return; }
  reply.header('X-Dali-Recovery-Epoch', epoch); return epoch;
}
