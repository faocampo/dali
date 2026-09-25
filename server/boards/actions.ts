import { registerImportRoutes } from './imports.js';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import * as Y from 'yjs';
import type { AuthConfig } from '../app.js';
import { currentSession, requireExpectedMember, requireMutation } from '../auth/session-store.js';
import { type AccountDatabase } from '../storage/database.js';
import { descriptor, requireBoardCapability } from './routes.js';
import { documentBytes, referencedImageKeys, type BeforeCommit } from './documents.js';
import { BlobRepository } from './blobs.js';
import { readRecoveryEpoch } from '../storage/recovery-state.js';

type Mutation = { operationId: string; revision: number; title?: string };
const operationSchema = { type: 'string', minLength: 1, maxLength: 128, pattern: '^[a-zA-Z0-9_-]+$' };
const mutationSchema = { body: { type: 'object', required: ['operationId', 'revision'], properties: {
  operationId: operationSchema, revision: { type: 'integer', minimum: 1 }, title: { type: 'string', maxLength: 4000 },
} } };
const titleLength = (title: string) => [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(title)].length;
export function registerActionRoutes(app: FastifyInstance, config: AuthConfig, database: AccountDatabase, now: () => number, beforeCommit?: BeforeCommit) {
  registerImportRoutes(app, config, database, now, beforeCommit);
  const previous = (member: string, id: string) => database.prepare('SELECT kind,status,board_id,result FROM operations WHERE member_id=? AND operation_id=?').get(member, id) as { kind: string; status: string; board_id: string; result: string } | undefined;
  const record = (member: string, id: string, kind: string, boardId: string, result: unknown, status = 'completed') => database.prepare('INSERT INTO operations(member_id,operation_id,kind,status,board_id,result) VALUES(?,?,?,?,?,?)').run(member, id, kind, status, boardId, JSON.stringify(result));
  const repository = new BlobRepository(database);
  for (const method of ['PATCH', 'DELETE'] as const) app.route<{ Params: { boardId: string }; Body: Mutation }>({ method, url: '/api/boards/:boardId', schema: mutationSchema,
    handler: async (request, reply) => {
      if (!requireMutation(request, reply, config)) return;
      const member = currentSession(database, request, now); if (!requireExpectedMember(request, reply, member)) return;
      const kind = method === 'PATCH' ? 'rename' : 'delete'; const { boardId } = request.params;
      if (method === 'PATCH' && (typeof request.body.title !== 'string' || titleLength(request.body.title.trim()) > 200)) return reply.code(400).send({ code: 'TITLE_TOO_LONG' });
      // Completed deletion has no board to authorize; only its original actor can reconcile it.
      const known = previous(member!.accountId, request.body.operationId);
      if (known && kind === 'delete') return known.kind === kind && known.board_id === boardId ? JSON.parse(known.result) : reply.code(409).send({ code: 'OPERATION_CONFLICT' });
      if (!requireBoardCapability(database, request, reply, boardId, kind, now)) return;
      await beforeCommit?.();
      return database.transaction(() => {
        const board = requireBoardCapability(database, request, reply, boardId, kind, now); if (!board) return;
        const committed = previous(member!.accountId, request.body.operationId);
        if (committed) return committed.kind === kind && committed.board_id === boardId ? JSON.parse(committed.result) : reply.code(409).send({ code: 'OPERATION_CONFLICT' });
        if (board.revision !== request.body.revision) return reply.code(409).send({ code: 'BOARD_CHANGED' });
        let result: unknown;
        if (kind === 'rename') {
          board.title = request.body.title!.trim() || board.title; board.updated_at = now(); board.revision++;
          database.prepare('UPDATE boards SET title=?,updated_at=?,revision=? WHERE id=?').run(board.title, board.updated_at, board.revision, board.id);
          result = descriptor(database, board, member!.accountId);
        } else {
          database.prepare('DELETE FROM boards WHERE id=?').run(boardId); result = { deleted: true, boardId };
        }
        record(member!.accountId, request.body.operationId, kind, boardId, result); return result;
      })();
    },
  });
  app.get<{ Params: { boardId: string } }>('/api/boards/:boardId/editable-export', async (request, reply) => database.transaction(() => {
    const board = requireBoardCapability(database, request, reply, request.params.boardId, 'editable-export', now); if (!board) return;
    const content = documentBytes(database, board, board.content_doc_id)!; const doc = new Y.Doc();
    try {
      Y.applyUpdate(doc, content);
      const manifest = [...referencedImageKeys(doc)];
      if (manifest.some(key => !repository.get(board.id, key))) return reply.code(409).send({ code: 'IMAGES_INCOMPLETE' });
      return { descriptor: descriptor(database, board, currentSession(database, request, now)!.accountId), root: documentBytes(database, board, board.root_doc_id)!.toString('base64'), content: content.toString('base64'), manifest };
    } finally { doc.destroy(); }
  })());
  app.post<{ Params: { boardId: string }; Body: Mutation }>('/api/boards/:boardId/duplicate', { schema: mutationSchema }, async (request, reply) => {
    if (!requireMutation(request, reply, config)) return;
    return database.transaction(() => {
      const board = requireBoardCapability(database, request, reply, request.params.boardId, 'duplicate', now); if (!board) return;
      const member = currentSession(database, request, now)!; const old = previous(member.accountId, request.body.operationId);
      if (old) return old.kind === 'duplicate' && old.board_id === board.id ? { status: old.status, result: JSON.parse(old.result) } : reply.code(409).send({ code: 'OPERATION_CONFLICT' });
      if (board.revision !== request.body.revision) return reply.code(409).send({ code: 'SOURCE_CHANGED' });
      const title = request.body.title?.trim() || board.title;
      if (titleLength(title) > 200) return reply.code(400).send({ code: 'TITLE_TOO_LONG' });
      const result = { recoveryEpoch: readRecoveryEpoch(database), summary: { id: randomUUID(), accountId: member.accountId, title, updatedAt: now(), role: 'owner', access: 'private', pendingCount: 0 }, rootDocId: randomUUID(), contentDocId: randomUUID(), revision: 1, capabilities: ['read', 'write', 'duplicate', 'rename', 'delete', 'grants', 'editable-export', 'image', 'presentation-export'] };
      const doc = new Y.Doc(); let manifest: string[];
      try { Y.applyUpdate(doc, documentBytes(database, board, board.content_doc_id)!); manifest = [...referencedImageKeys(doc)]; } finally { doc.destroy(); }
      database.prepare('INSERT INTO import_staging(member_id,operation_id,source_id,source_revision,descriptor,manifest) VALUES(?,?,?,?,?,?)').run(member.accountId, request.body.operationId, board.id, board.revision, JSON.stringify(result), JSON.stringify(manifest));
      record(member.accountId, request.body.operationId, 'duplicate', board.id, result, 'staging'); return { status: 'staging', result };
    })();
  });
}
