import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import * as Y from 'yjs';
import type { AuthConfig } from '../app.js';
import { currentSession, requireExpectedMember, requireMutation } from '../auth/session-store.js';
import { runMigrations, type AccountDatabase } from '../storage/database.js';
import { registerDocumentRoutes, type BeforeCommit } from './documents.js';
import { registerBlobRoutes } from './blobs.js';

export type BoardRole = 'owner' | 'editor' | 'viewer';
export type BoardCapability = 'read' | 'image' | 'presentation-export' | 'write' | 'rename' | 'editable-export' | 'duplicate' | 'grants' | 'delete';
export const boardCapabilities: BoardCapability[] = ['read', 'image', 'presentation-export', 'write', 'rename', 'editable-export', 'duplicate', 'grants', 'delete'];
export function canBoard(role: BoardRole | undefined, capability: BoardCapability): boolean {
  if (!role) return false;
  if (['read', 'image', 'presentation-export'].includes(capability)) return true;
  if (['write', 'rename', 'editable-export', 'duplicate'].includes(capability)) return role === 'owner' || role === 'editor';
  return role === 'owner';
}
export type BoardRow = { id: string; owner_id: string; title: string; root_doc_id: string; content_doc_id: string; created_at: number; updated_at: number; revision: number; role: BoardRole };
export type BoardSummary = { id: string; title: string; updatedAt: number; role: BoardRole; access: 'private' | 'shared'; pendingCount: number; accountId: string; thumbnailUrl?: string };
export function requireBoardCapability(database: AccountDatabase, request: FastifyRequest, reply: FastifyReply, boardId: string, capability: BoardCapability, now: () => number): BoardRow | undefined {
  const member = currentSession(database, request, now);
  if (!requireExpectedMember(request, reply, member)) return;
  const board = database.prepare(`SELECT b.*, CASE WHEN b.owner_id=@member THEN 'owner' ELSE g.role END AS role
    FROM boards b LEFT JOIN board_grants g ON g.board_id=b.id AND g.member_id=@member
    WHERE b.id=@board AND (b.owner_id=@member OR g.member_id IS NOT NULL)`).get({ member: member!.accountId, board: boardId }) as BoardRow | undefined;
  if (!board) { reply.code(404).send({ code: 'BOARD_UNAVAILABLE' }); return; }
  if (!canBoard(board.role, capability)) { reply.code(403).send({ code: 'CAPABILITY_REQUIRED' }); return; }
  return board;
}
function summary(database: AccountDatabase, board: BoardRow, accountId: string): BoardSummary {
  const counts = database.prepare(`SELECT (SELECT count(*) FROM board_grants WHERE board_id=?) AS active,
    (SELECT count(*) FROM pending_grants WHERE board_id=?) AS pending,
    EXISTS(SELECT 1 FROM board_thumbnails WHERE board_id=?) AS thumbnail`).get(board.id, board.id, board.id) as { active: number; pending: number; thumbnail: number };
  return { id: board.id, title: board.title, updatedAt: board.updated_at, role: board.role,
    access: counts.active + counts.pending > 0 ? 'shared' : 'private', pendingCount: counts.pending, accountId,
    ...(counts.thumbnail ? { thumbnailUrl: `/api/boards/${encodeURIComponent(board.id)}/thumbnail` } : {}) };
}
function descriptor(database: AccountDatabase, board: BoardRow, accountId: string) {
  return { summary: summary(database, board, accountId), rootDocId: board.root_doc_id, contentDocId: board.content_doc_id,
    capabilities: boardCapabilities.filter(capability => canBoard(board.role, capability)), revision: board.revision };
}
/** Root and content are separately persisted; a root has exactly one bound subdocument. */
function seedDocuments(database: AccountDatabase, board: BoardRow) {
  const root = new Y.Doc({ guid: board.root_doc_id });
  const content = new Y.Doc({ guid: board.content_doc_id });
  try {
    root.getMap('spaces').set(board.content_doc_id, content);
    const metadata = new Y.Map<unknown>();
    metadata.set('id', board.content_doc_id); metadata.set('title', board.title);
    metadata.set('createDate', board.created_at); metadata.set('tags', new Y.Array<string>());
    root.getMap('meta').set('pages', Y.Array.from([metadata]));
    const pageId = randomUUID(); const surfaceId = randomUUID();
    const page = new Y.Map<unknown>();
    page.set('sys:id', pageId); page.set('sys:flavour', 'affine:page'); page.set('sys:version', 2);
    page.set('sys:children', Y.Array.from([surfaceId])); page.set('prop:title', new Y.Text(board.title));
    const surface = new Y.Map<unknown>();
    surface.set('sys:id', surfaceId); surface.set('sys:flavour', 'affine:surface'); surface.set('sys:version', 5);
    // Pinned BlockSuite 0.22.4 SurfaceBlockSchema uses Boxed<Y.Map> (MIT).
    // Keep the native wire representation; a raw Y.Map cannot hydrate a surface.
    const elements = new Y.Map<unknown>();
    elements.set('type', '$blocksuite:internal:native$'); elements.set('value', new Y.Map());
    surface.set('sys:children', new Y.Array()); surface.set('prop:elements', elements);
    content.getMap('blocks').set(pageId, page); content.getMap('blocks').set(surfaceId, surface);
    const insert = database.prepare('INSERT INTO board_documents(board_id,doc_id,update_bytes) VALUES(?,?,?)');
    insert.run(board.id, board.root_doc_id, Buffer.from(Y.encodeStateAsUpdate(root)));
    insert.run(board.id, board.content_doc_id, Buffer.from(Y.encodeStateAsUpdate(content)));
  } finally { root.destroy(); content.destroy(); }
}
export function registerBoardRoutes(app: FastifyInstance, config: AuthConfig, database: AccountDatabase, now: () => number, beforeCommit?: BeforeCommit) {
  runMigrations(database, [{ version: 2, sql: `
    CREATE TABLE boards (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES members(id), title TEXT NOT NULL,
      root_doc_id TEXT NOT NULL UNIQUE, content_doc_id TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, revision INTEGER NOT NULL DEFAULT 1);
    CREATE INDEX board_owner_updated ON boards(owner_id,updated_at DESC,id);
    CREATE TABLE board_grants (board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE, member_id TEXT NOT NULL REFERENCES members(id),
      role TEXT NOT NULL CHECK(role IN ('editor','viewer')), revision INTEGER NOT NULL DEFAULT 1, PRIMARY KEY(board_id,member_id));
    CREATE INDEX grants_member ON board_grants(member_id,board_id);
    CREATE TABLE pending_grants (board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE, issuer TEXT NOT NULL, canonical_email TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('editor','viewer')), revision INTEGER NOT NULL DEFAULT 1, PRIMARY KEY(board_id,issuer,canonical_email));
    CREATE TABLE board_documents (board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE, doc_id TEXT NOT NULL, update_bytes BLOB NOT NULL, PRIMARY KEY(board_id,doc_id));
    CREATE TABLE operations (member_id TEXT NOT NULL REFERENCES members(id), operation_id TEXT NOT NULL, kind TEXT NOT NULL, status TEXT NOT NULL,
      board_id TEXT, result TEXT NOT NULL, PRIMARY KEY(member_id,operation_id));
  ` }, { version: 3, sql: `CREATE TABLE board_thumbnails (board_id TEXT PRIMARY KEY REFERENCES boards(id) ON DELETE CASCADE, bytes BLOB NOT NULL, mime TEXT NOT NULL CHECK(mime='image/png'));` }]);
  registerDocumentRoutes(app, config, database, now, beforeCommit);
  registerBlobRoutes(app, config, database, now, beforeCommit);
  app.get<{ Querystring: { filter?: string } }>('/api/boards', async (request, reply) => {
    const member = currentSession(database, request, now); if (!requireExpectedMember(request, reply, member)) return;
    const filter = request.query.filter ?? 'all';
    if (!['all', 'mine', 'shared'].includes(filter)) return reply.code(400).send({ code: 'INVALID_FILTER' });
    const rows = database.prepare(`SELECT b.*, CASE WHEN b.owner_id=@member THEN 'owner' ELSE g.role END AS role
      FROM boards b LEFT JOIN board_grants g ON g.board_id=b.id AND g.member_id=@member
      WHERE (b.owner_id=@member OR g.member_id IS NOT NULL)
      AND (@filter='all' OR (@filter='mine' AND b.owner_id=@member) OR (@filter='shared' AND b.owner_id<>@member))
      ORDER BY b.updated_at DESC,b.id ASC`).all({ member: member!.accountId, filter }) as BoardRow[];
    return rows.map(board => summary(database, board, member!.accountId));
  });
  app.get<{ Params: { boardId: string } }>('/api/boards/:boardId', async (request, reply) => {
    const board = requireBoardCapability(database, request, reply, request.params.boardId, 'read', now);
    if (board) return descriptor(database, board, currentSession(database, request, now)!.accountId);
  });
  app.get<{ Params: { boardId: string } }>('/api/boards/:boardId/thumbnail', async (request, reply) => {
    const board = requireBoardCapability(database, request, reply, request.params.boardId, 'image', now);
    if (!board) return;
    const thumbnail = database.prepare('SELECT bytes,mime FROM board_thumbnails WHERE board_id=?').get(board.id) as { bytes: Buffer; mime: string } | undefined;
    if (!thumbnail) return reply.code(404).send({ code: 'PREVIEW_UNAVAILABLE' });
    reply.header('X-Dali-Account', currentSession(database, request, now)!.accountId);
    reply.header('X-Content-Type-Options', 'nosniff'); return reply.type(thumbnail.mime).send(thumbnail.bytes);
  });
  app.get<{ Params: { operationId: string } }>('/api/operations/:operationId', async (request, reply) => {
    const member = currentSession(database, request, now); if (!requireExpectedMember(request, reply, member)) return;
    const operation = database.prepare('SELECT status,result FROM operations WHERE member_id=? AND operation_id=?')
      .get(member!.accountId, request.params.operationId) as { status: string; result: string } | undefined;
    return operation ? { status: operation.status, result: JSON.parse(operation.result) as unknown } : { status: 'unknown' };
  });
  app.post<{ Body: { title?: string; operationId: string } }>('/api/boards', {
    schema: { body: { type: 'object', required: ['operationId'], properties: {
      operationId: { type: 'string', minLength: 1, maxLength: 128, pattern: '^[a-zA-Z0-9_-]+$' }, title: { type: 'string', maxLength: 4000 },
    } } },
  }, async (request, reply) => {
    if (!requireMutation(request, reply, config)) return;
    const title = request.body.title?.trim() || 'Untitled board';
    if ([...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(title)].length > 200) return reply.code(400).send({ code: 'TITLE_TOO_LONG' });
    return database.transaction(() => {
      const member = currentSession(database, request, now); if (!requireExpectedMember(request, reply, member)) return;
      const previous = database.prepare('SELECT kind,result FROM operations WHERE member_id=? AND operation_id=?')
        .get(member!.accountId, request.body.operationId) as { kind: string; result: string } | undefined;
      if (previous) {
        if (previous.kind !== 'create') return reply.code(409).send({ code: 'OPERATION_CONFLICT' });
        return JSON.parse(previous.result) as unknown;
      }
      const time = now();
      const board: BoardRow = { id: randomUUID(), owner_id: member!.accountId, title, root_doc_id: randomUUID(), content_doc_id: randomUUID(), created_at: time, updated_at: time, revision: 1, role: 'owner' };
      database.prepare(`INSERT INTO boards(id,owner_id,title,root_doc_id,content_doc_id,created_at,updated_at,revision)
        VALUES(@id,@owner_id,@title,@root_doc_id,@content_doc_id,@created_at,@updated_at,@revision)`).run(board);
      seedDocuments(database, board);
      const result = descriptor(database, board, member!.accountId);
      database.prepare('INSERT INTO operations(member_id,operation_id,kind,status,board_id,result) VALUES(?,?,?,?,?,?)')
        .run(member!.accountId, request.body.operationId, 'create', 'completed', board.id, JSON.stringify(result));
      reply.code(201); return result;
    })();
  });
}
