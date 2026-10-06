import type { FastifyInstance } from 'fastify';
import type { AuthConfig } from '../app.js';
import type { AccountDatabase } from '../storage/database.js';
import { requireMutation } from '../auth/session-store.js';
import { readRecoveryEpoch } from '../storage/recovery-state.js';
import { documentBytes } from './documents.js';
import { requireBoardCapability } from './routes.js';
import { validRecoveryAttempt, type RecoveryAttempt } from '../../src/canvas/account/recovery-baseline.js';

/** A read-only, transaction-consistent pair; requesting it never applies a candidate. */
export function registerRecoveryBaselineRoutes(app: FastifyInstance, config: AuthConfig, database: AccountDatabase, now: () => number) {
  app.post<{ Params: { boardId: string }; Body: { attempts?: (RecoveryAttempt & { docId: string })[] } }>('/api/boards/:boardId/recovery/baseline', {
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
    const root = documentBytes(database, board, board.root_doc_id); const content = documentBytes(database, board, board.content_doc_id);
    if (!root || !content) return reply.code(404).send({ code: 'BOARD_UNAVAILABLE' });
    const lookup = database.prepare('SELECT previous_revision,revision FROM document_receipts WHERE board_id=? AND account_id=? AND tab_id=? AND operation_id=? AND doc_id=? AND digest=?');
    const receipts = attempts.flatMap(attempt => {
      const row = lookup.get(board.id, request.headers['x-dali-account'], attempt.tabId, attempt.operationId, attempt.docId, attempt.digest) as { previous_revision: number; revision: number } | undefined;
      return row ? [{ tabId: attempt.tabId, operationId: attempt.operationId, docId: attempt.docId, digest: attempt.digest, previousRevision: row.previous_revision, revision: row.revision }] : [];
    });
    reply.header('Cache-Control', 'no-store'); reply.header('X-Dali-Recovery-Epoch', epoch);
    return { version: 1, epoch, revision: board.revision, titleRevision: board.revision, title: board.title,
      root: { docId: board.root_doc_id, data: root.toString('base64') }, content: { docId: board.content_doc_id, data: content.toString('base64') }, receipts };
  })());
}
