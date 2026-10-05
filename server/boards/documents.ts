import { changedNativeObjects, nativeObjectIds } from './change-footprint.js';
import { createHash } from 'node:crypto';
import type { LiveConnection } from './reservations.js';
import { type CollaborationBroker } from './collaboration.js';
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
    if (value instanceof Y.Map && ['affine:image', 'djai:image-visual-edit'].includes(value.get('sys:flavour') as string) && typeof value.get('prop:sourceId') === 'string') keys.add(value.get('prop:sourceId') as string);
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
/** Validate a complete persisted document without exposing its decoded content. */
export function validateStoredDocument(bytes: Buffer, board: BoardRow, docId: string): Set<string> {
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > DOCUMENT_LIMITS.update) throw new Error('Invalid document size');
  const doc = new Y.Doc({ guid: docId });
  try { Y.applyUpdate(doc, bytes); validateDocument(doc, board, docId); return referencedImageKeys(doc); }
  finally { doc.destroy(); }
}
export function registerDocumentRoutes(app: FastifyInstance, config: AuthConfig, database: AccountDatabase, now: () => number, beforeCommit?: BeforeCommit, collaboration?: CollaborationBroker) {
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
    let expansion: { connection: LiveConnection; token: string; ids: string[] } | undefined;
    const commit = database.transaction(() => {
      const latest = requireBoardCapability(database, request, reply, boardId, 'write', now); if (!latest) return;
      const stored = documentBytes(database, latest, docId); if (!stored) return reply.code(404).send({ code: 'BOARD_UNAVAILABLE' });
      const live = (latest as BoardRow & { live_enabled?: number }).live_enabled === 1;
      const connectionId = request.headers['x-dali-connection'];
      const operationId = request.headers['x-dali-operation'];
      const reservation = request.headers['x-dali-reservation'];
      const connection = typeof connectionId === 'string' ? collaboration?.find(connectionId, boardId, request.headers['x-dali-account'] as string) : undefined;
      const digest = createHash('sha256').update(request.body).digest('hex');
      if (live && (!connection || typeof operationId !== 'string' || !/^[a-zA-Z0-9-]{1,128}$/.test(operationId))) return reply.code(409).send({ code: 'LIVE_CONNECTION_REQUIRED' });
      if (live && connection) {
        const receipt = database.prepare('SELECT doc_id,digest,previous_revision,revision FROM document_receipts WHERE board_id=? AND account_id=? AND tab_id=? AND operation_id=?')
          .get(boardId, connection.accountId, connection.tabId, operationId) as { doc_id: string; digest: string; previous_revision: number; revision: number } | undefined;
        if (receipt) {
          if (receipt.doc_id !== docId || receipt.digest !== digest) return reply.code(409).send({ code: 'OPERATION_CONFLICT' });
          return { acknowledged: true, previousRevision: receipt.previous_revision, revision: receipt.revision };
        }
      }
      const doc = new Y.Doc({ guid: docId }); const before = new Y.Doc({ guid: docId }); let merged: Buffer; let created: string[] = [];
      try {
        Y.applyUpdate(before, stored); Y.applyUpdate(doc, stored); Y.applyUpdate(doc, request.body); validateDocument(doc, latest, docId);
        if (live && connection) {
          const ids = docId === latest.content_doc_id ? changedNativeObjects(before, doc) :
            Buffer.from(Y.encodeStateAsUpdate(before)).equals(Buffer.from(Y.encodeStateAsUpdate(doc))) ? [] : null;
          if (ids === null) return reply.code(409).send({ code: 'UNSUPPORTED_LIVE_ACTION' });
          const existing = docId === latest.content_doc_id ? nativeObjectIds(before) : new Set<string>();
          created = ids.filter(id => id !== '$dali:metadata' && !existing.has(id));
          const required = ids.filter(id => !created.includes(id));
          if (created.length) required.push(`$dali:create:${connection.id}`);
          if (required.length && (typeof reservation !== 'string' || !collaboration!.owns(connection, reservation, required))) return reply.code(409).send({ code: 'RESERVATION_REQUIRED' });
        }
        if (docId === latest.content_doc_id) for (const key of referencedImageKeys(doc)) if (!database.prepare('SELECT 1 FROM board_blobs WHERE board_id=? AND blob_key=?').get(boardId, key)) throw new Error('Unbound image');
        merged = Buffer.from(Y.encodeStateAsUpdate(doc));
        if (merged.length > DOCUMENT_LIMITS.update) return reply.code(413).send({ code: 'PAYLOAD_REJECTED' });
      } catch { return reply.code(400).send({ code: 'INVALID_DOCUMENT' }); }
      finally { doc.destroy(); before.destroy(); }
      if (created.length && connection && typeof reservation === 'string') {
        if (!collaboration!.extend(connection, reservation, created)) return reply.code(409).send({ code: 'RESERVATION_REQUIRED' });
        expansion = { connection, token: reservation, ids: created };
      }
      const previousRevision = latest.revision;
      let revision = previousRevision;
      if (!merged.equals(stored)) {
        database.prepare('UPDATE board_documents SET update_bytes=? WHERE board_id=? AND doc_id=?').run(merged, boardId, docId);
        database.prepare('UPDATE boards SET updated_at=?,revision=revision+1 WHERE id=?').run(now(), boardId);
        revision = previousRevision + 1;
        database.prepare('DELETE FROM board_thumbnails WHERE board_id=?').run(boardId);
      }
      if (live && connection) database.prepare('INSERT INTO document_receipts(board_id,account_id,tab_id,operation_id,doc_id,digest,previous_revision,revision) VALUES(?,?,?,?,?,?,?,?)')
        .run(boardId, connection.accountId, connection.tabId, operationId, docId, digest, previousRevision, revision);
      return { acknowledged: true, previousRevision, revision };
    });
    try { return commit(); }
    catch (error) {
      if (expansion) collaboration!.releaseObjects(expansion.connection, expansion.token, expansion.ids);
      throw error;
    }
  });
}
