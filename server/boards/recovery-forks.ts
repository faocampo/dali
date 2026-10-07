import { createHash, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { AuthConfig } from '../app.js';
import type { AccountDatabase } from '../storage/database.js';
import { currentSession, requireMutation } from '../auth/session-store.js';
import { requireRecoveryEpoch } from '../storage/recovery-state.js';
import { boardCapabilities, operationReceipt, requireBoardCapability } from './routes.js';
import type { BeforeCommit } from './documents.js';

/** A receipt binds the immutable intent without storing native content in metadata. */
export const isRecoveryForkKind = (kind: string) => /^recovery-fork:[a-f0-9]{64}$/.test(kind);
type ForkRequest = { operationId: string; title: string; snapshotDigest: string; manifest: string[] };
function boundKind(source: string, epoch: string, body: ForkRequest) {
  return 'recovery-fork:' + createHash('sha256').update(JSON.stringify([source, epoch, body.title, body.snapshotDigest, [...body.manifest].sort()])).digest('hex');
}

/** Unlike ordinary duplication, this stage belongs to a retained local version.
 * Source content revisions do not authorize or change that immutable version. */
export function registerRecoveryForkRoutes(app: FastifyInstance, config: AuthConfig, database: AccountDatabase, now: () => number, beforeCommit?: BeforeCommit) {
  app.post<{ Params: { boardId: string }; Body: ForkRequest }>('/api/boards/:boardId/recovery-forks', {
    bodyLimit: 1024 * 1024,
    schema: { body: { type: 'object', additionalProperties: false, required: ['operationId', 'title', 'snapshotDigest', 'manifest'], properties: {
      operationId: { type: 'string', minLength: 1, maxLength: 128, pattern: '^[a-zA-Z0-9_-]+$' },
      title: { type: 'string', minLength: 1, maxLength: 4000 },
      snapshotDigest: { type: 'string', pattern: '^[a-f0-9]{64}$' },
      manifest: { type: 'array', maxItems: 10000, uniqueItems: true, items: { type: 'string', pattern: '^[A-Za-z0-9_-]{43}=$' } },
    } } },
  }, async (request, reply) => {
    if (!requireMutation(request, reply, config)) return;
    if (!requireBoardCapability(database, request, reply, request.params.boardId, 'duplicate', now) || !requireRecoveryEpoch(database, request, reply)) return;
    const title = request.body.title.trim();
    if (!title || [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(title)].length > 200) return reply.code(400).send({ code: 'INVALID_TITLE' });
    await beforeCommit?.();
    return database.transaction(() => {
      // Source capability preserves the existing owner/system-Viewer exception.
      const source = requireBoardCapability(database, request, reply, request.params.boardId, 'duplicate', now); if (!source) return;
      const epoch = requireRecoveryEpoch(database, request, reply); if (!epoch) return;
      const member = currentSession(database, request, now)!; const { operationId, manifest } = request.body;
      const kind = boundKind(source.id, epoch, request.body);
      const old = database.prepare('SELECT kind,board_id FROM operations WHERE member_id=? AND operation_id=?').get(member.accountId, operationId) as { kind: string; board_id: string } | undefined;
      if (old) {
        if (old.kind !== kind || old.board_id !== source.id) return reply.code(409).send({ code: 'OPERATION_CONFLICT' });
        return operationReceipt(database, request, reply, operationId, now, true);
      }
      const result = { liveEnabled: false, liveSupported: false, recoveryEpoch: epoch,
        summary: { id: randomUUID(), accountId: member.accountId, title, updatedAt: now(), role: 'owner', access: 'private', pendingCount: 0 },
        rootDocId: randomUUID(), contentDocId: randomUUID(), revision: 1, capabilities: [...boardCapabilities] };
      database.prepare('INSERT INTO import_staging(member_id,operation_id,source_id,descriptor,manifest) VALUES(?,?,?,?,?)')
        .run(member.accountId, operationId, source.id, JSON.stringify(result), JSON.stringify([...manifest].sort()));
      database.prepare("INSERT INTO operations(member_id,operation_id,kind,status,board_id,result) VALUES(?,?,?,'staging',?,?)")
        .run(member.accountId, operationId, kind, source.id, JSON.stringify(result));
      return { status: 'staging', result };
    })();
  });
}
