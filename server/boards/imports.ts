import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as Y from 'yjs';
import type { AuthConfig } from '../app.js';
import { currentSession, requireExpectedMember, requireSystemWriter, requireMutation } from '../auth/session-store.js';
import { runMigrations, type AccountDatabase } from '../storage/database.js';
import { requireBoardCapability, operationReceipt, type BoardRow } from './routes.js';
import { referencedImageKeys, validateDocument, DOCUMENT_LIMITS, type BeforeCommit } from './documents.js';
import { BlobRepository, imageHash, validateImageBytes, IMAGE_LIMITS } from './blobs.js';

type Stage = { member_id: string; operation_id: string; source_id: string; source_revision: number; descriptor: string; manifest: string; root: Buffer | null; content: Buffer | null };
const operationSchema = { type: 'string', minLength: 1, maxLength: 128, pattern: '^[a-zA-Z0-9_-]+$' };
export function registerImportRoutes(app: FastifyInstance, config: AuthConfig, database: AccountDatabase, now: () => number, beforeCommit?: BeforeCommit) {
  runMigrations(database, [{ version: 6, sql: `
    CREATE TABLE import_staging(member_id TEXT NOT NULL REFERENCES members(id), operation_id TEXT NOT NULL,
      source_id TEXT REFERENCES boards(id) ON DELETE CASCADE, source_revision INTEGER, descriptor TEXT NOT NULL,
      manifest TEXT NOT NULL, root BLOB, content BLOB, PRIMARY KEY(member_id,operation_id));
    CREATE TABLE import_staging_blobs(member_id TEXT NOT NULL, operation_id TEXT NOT NULL, blob_key TEXT NOT NULL,
      mime TEXT NOT NULL, bytes BLOB NOT NULL, PRIMARY KEY(member_id,operation_id,blob_key),
      FOREIGN KEY(member_id,operation_id) REFERENCES import_staging(member_id,operation_id) ON DELETE CASCADE);
  ` }]);
  const previous = (member: string, id: string) => database.prepare('SELECT kind,status,board_id,result FROM operations WHERE member_id=? AND operation_id=?').get(member, id) as { kind: string; status: string; board_id: string; result: string } | undefined;
  const record = (member: string, id: string, kind: string, boardId: string, result: unknown, status = 'completed') => database.prepare('INSERT INTO operations(member_id,operation_id,kind,status,board_id,result) VALUES(?,?,?,?,?,?)').run(member, id, kind, status, boardId, JSON.stringify(result));
  const repository = new BlobRepository(database);
  app.post<{ Body: { operationId: string; title: string; manifest: string[] } }>('/api/imports', {
    schema: { body: { type: 'object', additionalProperties: false, required: ['operationId', 'title', 'manifest'], properties: {
      operationId: operationSchema, title: { type: 'string', maxLength: 4000 },
      manifest: { type: 'array', maxItems: 10000, uniqueItems: true, items: { type: 'string', pattern: '^[A-Za-z0-9_-]{43}=$' } },
    } } },
  }, async (request, reply) => {
    if (!requireMutation(request, reply, config)) return;
    return database.transaction(() => {
      const member = currentSession(database, request, now); if (!requireExpectedMember(request, reply, member) || !requireSystemWriter(reply, member)) return;
      const { operationId, title, manifest } = request.body;
      if (![...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(title)].length || [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(title)].length > 200) return reply.code(400).send({ code: 'INVALID_TITLE' });
      const old = previous(member!.accountId, operationId);
      if (old) return old.kind === 'import' ? { status: old.status, result: JSON.parse(old.result) } : reply.code(409).send({ code: 'OPERATION_CONFLICT' });
      const result = { summary: { id: randomUUID(), accountId: member!.accountId, title, updatedAt: now(), role: 'owner', access: 'private', pendingCount: 0 }, rootDocId: randomUUID(), contentDocId: randomUUID(), revision: 1, capabilities: ['read', 'write', 'duplicate', 'rename', 'delete', 'grants', 'editable-export', 'image', 'presentation-export'] };
      database.prepare('INSERT INTO import_staging(member_id,operation_id,descriptor,manifest) VALUES(?,?,?,?)').run(member!.accountId, operationId, JSON.stringify(result), JSON.stringify(manifest));
      record(member!.accountId, operationId, 'import', result.summary.id, result, 'staging');
      return { status: 'staging', result };
    })();
  });
  const stageFor = (member: string, id: string) => database.prepare('SELECT * FROM import_staging WHERE member_id=? AND operation_id=?').get(member, id) as Stage | undefined;
  const canStage = (stage: Stage, request: FastifyRequest, reply: FastifyReply) => stage.source_id
    ? !!requireBoardCapability(database, request, reply, stage.source_id, 'duplicate', now)
    : requireSystemWriter(reply, currentSession(database, request, now));
  app.get<{ Params: { operationId: string } }>('/api/imports/:operationId', async (request, reply) => {
    return operationReceipt(database, request, reply, request.params.operationId, now, true);
  });
  app.put<{ Params: { operationId: string }; Body: { root: string; content: string; manifest: string[] } }>('/api/imports/:operationId/document', {
    bodyLimit: 24 * 1024 * 1024,
    schema: { body: { type: 'object', required: ['root', 'content', 'manifest'], properties: { root: { type: 'string' }, content: { type: 'string' }, manifest: { type: 'array', maxItems: 10000, uniqueItems: true, items: { type: 'string', maxLength: 44 } } } } },
  }, async (request, reply) => {
    if (!requireMutation(request, reply, config)) return;
    const member = currentSession(database, request, now); if (!requireExpectedMember(request, reply, member)) return;
    const stage = stageFor(member!.accountId, request.params.operationId); if (!stage) return reply.code(404).send({ code: 'STAGING_UNAVAILABLE' });
    if (!canStage(stage, request, reply)) return;
    const d = JSON.parse(stage.descriptor); const board = { root_doc_id: d.rootDocId, content_doc_id: d.contentDocId } as BoardRow;
    const root = Buffer.from(request.body.root, 'base64'); const content = Buffer.from(request.body.content, 'base64'); const docs = [new Y.Doc(), new Y.Doc()];
    try {
      if (root.length > DOCUMENT_LIMITS.update || content.length > DOCUMENT_LIMITS.update) throw new Error();
      Y.applyUpdate(docs[0]!, root); Y.applyUpdate(docs[1]!, content); validateDocument(docs[0]!, board, board.root_doc_id); validateDocument(docs[1]!, board, board.content_doc_id);
      let objectCount = docs[1]!.getMap('blocks').size;
      docs[1]!.getMap<Y.Map<unknown>>('blocks').forEach(block => {
        const box = block.get('prop:elements');
        if (box instanceof Y.Map && box.get('value') instanceof Y.Map) objectCount += (box.get('value') as Y.Map<unknown>).size;
      });
      if (objectCount > DOCUMENT_LIMITS.objects) throw new Error();
      const expected = JSON.parse(stage.manifest) as string[]; const actual = [...referencedImageKeys(docs[1]!)];
      if ([request.body.manifest, actual].some(keys => JSON.stringify([...keys].sort()) !== JSON.stringify([...expected].sort()))) throw new Error();
      // No source block or surface identity can survive a native copy.
      if (stage.source_id) {
        const source = database.prepare('SELECT content_doc_id FROM boards WHERE id=?').get(stage.source_id) as { content_doc_id: string };
        const sourceDoc = new Y.Doc();
        try {
          Y.applyUpdate(sourceDoc, (database.prepare('SELECT update_bytes FROM board_documents WHERE board_id=? AND doc_id=?').get(stage.source_id, source.content_doc_id) as { update_bytes: Buffer }).update_bytes);
          const identities = (doc: Y.Doc) => { const ids = new Set(doc.getMap('blocks').keys()); doc.getMap<Y.Map<unknown>>('blocks').forEach(block => { const box = block.get('prop:elements'); if (box instanceof Y.Map) { const values = box.get('value'); if (values instanceof Y.Map) for (const key of values.keys()) ids.add(key); } }); return ids; };
          const originals = identities(sourceDoc); if ([...identities(docs[1]!)].some(id => originals.has(id))) throw new Error();
        } finally { sourceDoc.destroy(); }
      }
    } catch { return reply.code(400).send({ code: 'INVALID_DOCUMENT' }); }
    finally { docs.forEach(doc => doc.destroy()); }
    database.prepare('UPDATE import_staging SET root=?,content=? WHERE member_id=? AND operation_id=?').run(root, content, member!.accountId, request.params.operationId); return { acknowledged: true };
  });
  app.put<{ Params: { operationId: string; key: string }; Body: Buffer }>('/api/imports/:operationId/blobs/:key', { bodyLimit: IMAGE_LIMITS.bytes,
    onRequest: async (request, reply) => { requireMutation(request, reply, config, ['image/png', 'image/jpeg']); },
  }, async (request, reply) => {
    const member = currentSession(database, request, now); if (!requireExpectedMember(request, reply, member)) return;
    const stage = stageFor(member!.accountId, request.params.operationId); if (!stage) return reply.code(404).send({ code: 'STAGING_UNAVAILABLE' });
    if (!canStage(stage, request, reply)) return;
    const mime = (request.headers['content-type'] ?? '').split(';')[0]!;
    try { if (!Buffer.isBuffer(request.body) || !(JSON.parse(stage.manifest) as string[]).includes(request.params.key) || imageHash(request.body) !== request.params.key) throw new Error(); validateImageBytes(request.body, mime); }
    catch { return reply.code(400).send({ code: 'INVALID_IMAGE' }); }
    const used = (database.prepare('SELECT coalesce(sum(length(bytes)),0) AS n FROM import_staging_blobs WHERE member_id=? AND operation_id=? AND blob_key<>?').get(member!.accountId, request.params.operationId, request.params.key) as { n: number }).n;
    if (used + request.body.length > IMAGE_LIMITS.boardBytes) return reply.code(413).send({ code: 'BOARD_IMAGE_QUOTA' });
    database.prepare('INSERT INTO import_staging_blobs(member_id,operation_id,blob_key,mime,bytes) VALUES(?,?,?,?,?) ON CONFLICT(member_id,operation_id,blob_key) DO NOTHING').run(member!.accountId, request.params.operationId, request.params.key, mime, request.body); return { acknowledged: true };
  });
  app.post<{ Params: { operationId: string } }>('/api/imports/:operationId/commit', async (request, reply) => {
    if (!requireMutation(request, reply, config)) return;
    await beforeCommit?.();
    return database.transaction(() => {
      const member = currentSession(database, request, now); if (!requireExpectedMember(request, reply, member)) return;
      const old = previous(member!.accountId, request.params.operationId);
      if (old && !['import', 'duplicate'].includes(old.kind)) return reply.code(409).send({ code: 'OPERATION_CONFLICT' });
      if (old?.status === 'completed') return operationReceipt(database, request, reply, request.params.operationId, now, true)?.result;
      const stage = stageFor(member!.accountId, request.params.operationId); if (!stage) return reply.code(404).send({ code: 'STAGING_UNAVAILABLE' });
      if (!canStage(stage, request, reply)) return;
      if (stage.source_id) {
        const source = requireBoardCapability(database, request, reply, stage.source_id, 'duplicate', now); if (!source) return;
        if (source.revision !== stage.source_revision) return reply.code(409).send({ code: 'SOURCE_CHANGED' });
      }
      const blobs = database.prepare('SELECT blob_key,mime,bytes FROM import_staging_blobs WHERE member_id=? AND operation_id=?').all(member!.accountId, request.params.operationId) as { blob_key: string; mime: string; bytes: Buffer }[];
      if (!stage.root || !stage.content || JSON.stringify(blobs.map(b => b.blob_key).sort()) !== JSON.stringify((JSON.parse(stage.manifest) as string[]).sort())) return reply.code(409).send({ code: 'IMPORT_INCOMPLETE' });
      const d = JSON.parse(stage.descriptor); const time = now();
      database.prepare('INSERT INTO boards(id,owner_id,title,root_doc_id,content_doc_id,created_at,updated_at,revision) VALUES(?,?,?,?,?,?,?,1)').run(d.summary.id, member!.accountId, d.summary.title, d.rootDocId, d.contentDocId, time, time);
      const insert = database.prepare('INSERT INTO board_documents(board_id,doc_id,update_bytes) VALUES(?,?,?)'); insert.run(d.summary.id, d.rootDocId, stage.root); insert.run(d.summary.id, d.contentDocId, stage.content);
      for (const blob of blobs) repository.set(d.summary.id, blob.blob_key, blob.bytes, blob.mime);
      d.summary.updatedAt = time;
      database.prepare("UPDATE operations SET status='completed',result=? WHERE member_id=? AND operation_id=?").run(JSON.stringify(d), member!.accountId, request.params.operationId);
      database.prepare('DELETE FROM import_staging WHERE member_id=? AND operation_id=?').run(member!.accountId, request.params.operationId); return d;
    })();
  });
}
