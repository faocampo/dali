import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import * as Y from 'yjs';
import type { AuthConfig } from '../app.js';
import { requireMutation } from '../auth/session-store.js';
import type { AccountDatabase } from '../storage/database.js';
import { requireBoardCapability, type BoardRow } from './routes.js';

export const DOCUMENT_LIMITS = { update: 8 * 1024 * 1024, vector: 64 * 1024, objects: 10000 };
export type BeforeCommit = () => Promise<void>;
export function referencedImageKeys(doc: Y.Doc): Set<string> {
  const keys = new Set<string>();
  doc.getMap('blocks').forEach(value => {
    if (value instanceof Y.Map && value.get('sys:flavour') === 'affine:image' && typeof value.get('prop:sourceId') === 'string') keys.add(value.get('prop:sourceId') as string);
  });
  return keys;
}
export function documentBytes(database: AccountDatabase, board: BoardRow, docId: string): Buffer | undefined {
  if (docId !== board.root_doc_id && docId !== board.content_doc_id) return;
  return (database.prepare('SELECT update_bytes FROM board_documents WHERE board_id=? AND doc_id=?').get(board.id, docId) as { update_bytes: Buffer } | undefined)?.update_bytes;
}
export function validateDocument(doc: Y.Doc, board: BoardRow, docId: string) {
  if (doc.store.pendingStructs || doc.store.pendingDs) throw new Error('Incomplete update');
  if (docId === board.root_doc_id) {
    const spaces = doc.getMap('spaces');
    if (spaces.size !== 1 || !(spaces.get(board.content_doc_id) instanceof Y.Doc) ||
      (spaces.get(board.content_doc_id) as Y.Doc).guid !== board.content_doc_id ||
      doc.getSubdocs().size !== 1) throw new Error('Invalid root binding');
    // Workspace metadata may describe only the already bound content document.
    const meta = doc.getMap('meta'); const pages = meta.get('pages');
    if (!(pages instanceof Y.Array) || pages.length !== 1) throw new Error('Invalid metadata binding');
    const raw = pages.get(0); const entry = raw instanceof Y.Map ? raw.toJSON() : raw;
    if (!entry || entry.id !== board.content_doc_id || typeof entry.title !== 'string' ||
      !Number.isFinite(entry.createDate) || !Array.isArray(entry.tags)) throw new Error('Invalid metadata binding');
    if ([...doc.share.keys()].some(key => !['spaces', 'meta'].includes(key))) throw new Error('Invalid root');
  } else {
    if (docId !== board.content_doc_id || doc.getSubdocs().size || [...doc.share.keys()].some(key => !['blocks', 'meta'].includes(key))) throw new Error('Invalid content binding');
    const blocks = doc.getMap('blocks'); let pages = 0; let surfaces = 0;
    if (blocks.size > DOCUMENT_LIMITS.objects) throw new Error('Too many blocks');
    blocks.forEach((value, key) => {
      if (!(value instanceof Y.Map) || value.get('sys:id') !== key || typeof value.get('sys:flavour') !== 'string') throw new Error('Invalid block');
      if (value.get('sys:flavour') === 'affine:page') pages++;
      if (value.get('sys:flavour') === 'affine:surface') surfaces++;
    });
    if (pages !== 1 || surfaces !== 1) throw new Error('Invalid content identity');
  }
}
export function registerDocumentRoutes(app: FastifyInstance, config: AuthConfig, database: AccountDatabase, now: () => number, beforeCommit?: BeforeCommit) {
  app.addContentTypeParser('application/octet-stream', { parseAs: 'buffer' }, (_request, body, done) => done(null, body));
  type Params = { boardId: string; docId: string };
  const guard = (request: FastifyRequest, reply: FastifyReply) => { requireMutation(request, reply, config, ['application/octet-stream']); };
  for (const action of ['pull', 'push'] as const) app.post<{ Params: Params; Body: Buffer }>(`/api/boards/:boardId/docs/:docId/${action}`, {
    bodyLimit: action === 'pull' ? DOCUMENT_LIMITS.vector : DOCUMENT_LIMITS.update,
    onRequest: async (request, reply) => guard(request, reply),
    errorHandler: (error, _request, reply) => {
      const overflow = error instanceof Error && 'code' in error && error.code === 'FST_ERR_CTP_BODY_TOO_LARGE';
      return reply.code(overflow ? 413 : 500).send({ code: overflow ? 'PAYLOAD_REJECTED' : 'REQUEST_FAILED' });
    },
  }, async (request, reply) => {
    const { boardId, docId } = request.params;
    const board = requireBoardCapability(database, request, reply, boardId, action === 'pull' ? 'read' : 'write', now);
    if (!board) return;
    const current = documentBytes(database, board, docId);
    if (!current) return reply.code(404).send({ code: 'BOARD_UNAVAILABLE' });
    if (!Buffer.isBuffer(request.body)) return reply.code(400).send({ code: 'INVALID_DOCUMENT' });
    try {
      if (action === 'pull') {
        Y.decodeStateVector(request.body);
        return reply.type('application/octet-stream').send(Buffer.from(Y.diffUpdate(current, request.body)));
      }
      // Decode before the scheduling barrier. Merge with the newest committed bytes inside the transaction.
      Y.decodeUpdate(request.body);
    } catch { return reply.code(400).send({ code: 'INVALID_DOCUMENT' }); }
    await beforeCommit?.();
    return database.transaction(() => {
      const latest = requireBoardCapability(database, request, reply, boardId, 'write', now); if (!latest) return;
      const stored = documentBytes(database, latest, docId); if (!stored) return reply.code(404).send({ code: 'BOARD_UNAVAILABLE' });
      const doc = new Y.Doc({ guid: docId }); let merged: Buffer;
      try {
        Y.applyUpdate(doc, stored); Y.applyUpdate(doc, request.body); validateDocument(doc, latest, docId);
        if (docId === latest.content_doc_id) for (const key of referencedImageKeys(doc)) if (!database.prepare('SELECT 1 FROM board_blobs WHERE board_id=? AND blob_key=?').get(boardId, key)) throw new Error('Unbound image');
        merged = Buffer.from(Y.encodeStateAsUpdate(doc));
        if (merged.length > DOCUMENT_LIMITS.update) return reply.code(413).send({ code: 'PAYLOAD_REJECTED' });
      } catch { return reply.code(400).send({ code: 'INVALID_DOCUMENT' }); }
      finally { doc.destroy(); }
      if (!merged.equals(stored)) {
        database.prepare('UPDATE board_documents SET update_bytes=? WHERE board_id=? AND doc_id=?').run(merged, boardId, docId);
        database.prepare('UPDATE boards SET updated_at=?,revision=revision+1 WHERE id=?').run(now(), boardId);
        database.prepare('DELETE FROM board_thumbnails WHERE board_id=?').run(boardId);
      }
      return { acknowledged: true };
    })();
  });
}
