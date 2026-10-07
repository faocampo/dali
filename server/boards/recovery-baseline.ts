import type { FastifyInstance } from 'fastify';
import type { AuthConfig } from '../app.js';
import type { AccountDatabase } from '../storage/database.js';
import { createHash } from 'node:crypto';
import { requireMutation } from '../auth/session-store.js';
import { readRecoveryEpoch } from '../storage/recovery-state.js';
import { documentBytes } from './documents.js';
import { requireBoardCapability, type BoardRow } from './routes.js';
import { recoveryFingerprintInput, validRecoveryAttempt, validRecoveryTitleAttempt, type RecoveryAttempt, type RecoveryTitleAttempt, type RecoveryTitleReceipt, type SharedRecoveryBaseline } from '../../src/canvas/account/recovery-baseline.js';

export function currentRecoveryBaseline(database: AccountDatabase, board: BoardRow): SharedRecoveryBaseline {
  const root = documentBytes(database, board, board.root_doc_id); const content = documentBytes(database, board, board.content_doc_id);
  if (!root || !content) throw new Error('Board documents unavailable');
  return { version: 1, epoch: readRecoveryEpoch(database), title: board.title, revision: board.revision, titleRevision: board.revision,
    root: { docId: board.root_doc_id, data: new Uint8Array(root) }, content: { docId: board.content_doc_id, data: new Uint8Array(content) } };
}
/** Call only within the same transaction that will commit the update. */
export function currentRecoveryFingerprint(database: AccountDatabase, board: BoardRow) {
  if (!database.inTransaction) throw new Error('Recovery comparison requires a transaction');
  return createHash('sha256').update(recoveryFingerprintInput(currentRecoveryBaseline(database, board))).digest('hex');
}

/** A read-only, transaction-consistent pair; requesting it never applies a candidate. */
export function registerRecoveryBaselineRoutes(app: FastifyInstance, config: AuthConfig, database: AccountDatabase, now: () => number) {
  app.post<{ Params: { boardId: string }; Body: { attempts?: (RecoveryAttempt & { docId: string })[]; titleAttempt?: RecoveryTitleAttempt } }>('/api/boards/:boardId/recovery/baseline', {
    bodyLimit: 128 * 1024,
    onRequest: async (request, reply) => { requireMutation(request, reply, config, ['application/json']); },
  }, async (request, reply) => database.transaction(() => {
    // Editable-export requires current Owner/Editor authority without treating
    // this inspection as a durable mutation or a grant over the shared canvas.
    const board = requireBoardCapability(database, request, reply, request.params.boardId, 'editable-export', now);
    if (!board) return;
    const epoch = readRecoveryEpoch(database);
    if (request.headers['x-dali-recovery-epoch'] !== epoch) return reply.code(409).send({ code: 'RECOVERY_EPOCH_MISMATCH' });
    const attempts = request.body?.attempts;
    if (!Array.isArray(attempts) || attempts.length > 256 || attempts.some(a => !validRecoveryAttempt(a) || ![board.root_doc_id, board.content_doc_id].includes(a.docId))) return reply.code(400).send({ code: 'INVALID_RECOVERY_ATTEMPTS' });
    const titleAttempt = request.body?.titleAttempt;
    if (titleAttempt !== undefined && !validRecoveryTitleAttempt(titleAttempt)) return reply.code(400).send({ code: 'INVALID_RECOVERY_ATTEMPTS' });
    const root = documentBytes(database, board, board.root_doc_id); const content = documentBytes(database, board, board.content_doc_id);
    if (!root || !content) return reply.code(404).send({ code: 'BOARD_UNAVAILABLE' });
    const lookup = database.prepare('SELECT previous_revision,revision FROM document_receipts WHERE board_id=? AND account_id=? AND tab_id=? AND operation_id=? AND doc_id=? AND digest=?');
    const receipts = attempts.flatMap(attempt => {
      const row = lookup.get(board.id, request.headers['x-dali-account'], attempt.tabId, attempt.operationId, attempt.docId, attempt.digest) as { previous_revision: number; revision: number } | undefined;
      return row ? [{ tabId: attempt.tabId, operationId: attempt.operationId, docId: attempt.docId, digest: attempt.digest, previousRevision: row.previous_revision, revision: row.revision }] : [];
    });
    let titleReceipt: RecoveryTitleReceipt | undefined;
    if (titleAttempt) {
      // The ordinary operation endpoint returns today's authorized descriptor.
      // Recovery needs the exact original rename result, without adopting a
      // later foreign title as proof of this local operation.
      const operation = database.prepare("SELECT result FROM operations WHERE member_id=? AND operation_id=? AND board_id=? AND kind='rename' AND status='completed'")
        .get(request.headers['x-dali-account'], titleAttempt.operationId, board.id) as { result: string } | undefined;
      if (operation) {
        const result = JSON.parse(operation.result);
        if (result.summary?.id === board.id && result.summary?.accountId === request.headers['x-dali-account'] && result.summary?.title === titleAttempt.title && result.recoveryEpoch === epoch && Number.isSafeInteger(result.revision) && result.revision > 0)
          titleReceipt = { ...titleAttempt, revision: result.revision };
      }
    }
    reply.header('Cache-Control', 'no-store'); reply.header('X-Dali-Recovery-Epoch', epoch);
    return { version: 1, epoch, revision: board.revision, titleRevision: board.revision, title: board.title,
      root: { docId: board.root_doc_id, data: root.toString('base64') }, content: { docId: board.content_doc_id, data: content.toString('base64') }, receipts, ...(titleReceipt ? { titleReceipt } : {}) };
  })());
}
