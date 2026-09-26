import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AccountDatabase } from './database.js';
import { getBackupHealth, BACKUP_DEFAULTS } from './backup-scheduler.js';
import { requireRecoveryEpoch } from './recovery-state.js';

/** Read-only check; failed admission never updates recovery or application data. */
export function durableWritesAvailable(database: AccountDatabase): boolean {
  try {
    const health = getBackupHealth(database);
    return health.state !== 'fenced' && health.recoveryPointAt !== null && health.recoverableAgeMs !== null &&
      Number.isFinite(health.recoverableAgeMs) && health.recoverableAgeMs >= 0 && health.recoverableAgeMs < BACKUP_DEFAULTS.maxAgeMs;
  } catch { return false; }
}
/** Authorization must already be established. Recheck in the mutation's synchronous transaction. */
export function requireDurableWriteAdmission(database: AccountDatabase, request: FastifyRequest, reply: FastifyReply): boolean {
  if (!database.inTransaction) throw new Error('Durable admission requires a transaction');
  if (!requireRecoveryEpoch(database, request, reply)) return false;
  if (!durableWritesAvailable(database)) { reply.header('Retry-After', '60').code(503).send({ code: 'BACKUP_FRESHNESS_REQUIRED' }); return false; }
  return true;
}
