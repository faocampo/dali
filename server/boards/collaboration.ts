import { createHash } from 'node:crypto';
import { PresenceRegistry, type PresenceIdentity } from './presence.js';
import type { FastifyInstance } from 'fastify';
import type { AuthConfig } from '../app.js';
import { runMigrations, type AccountDatabase } from '../storage/database.js';
import { requireMutation } from '../auth/session-store.js';
import { requireBoardCapability } from './routes.js';
import { documentBytes } from './documents.js';
import { initializeBackupSchedule, readRecoveryEpoch } from '../storage/recovery-state.js';

export { CollaborationBroker } from './reservations.js';
import { CollaborationBroker, type LiveConnection } from './reservations.js';

const semanticJson = (value: unknown): string => JSON.stringify(value, (_key, item: unknown) =>
  item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);

/** Only movement of existing native shapes is admitted by the first tracer. */
export function movedShapeIds(before: import('yjs').Doc, after: import('yjs').Doc): string[] | null {
  const oldBlocks = before.getMap('blocks').toJSON() as Record<string, Record<string, unknown>>;
  const newBlocks = after.getMap('blocks').toJSON() as Record<string, Record<string, unknown>>;
  if (semanticJson(before.getMap('meta').toJSON()) !== semanticJson(after.getMap('meta').toJSON())) return null;
  if (Object.keys(oldBlocks).sort().join('\0') !== Object.keys(newBlocks).sort().join('\0')) return null;
  const changed: string[] = [];
  for (const [id, oldBlock] of Object.entries(oldBlocks)) {
    const newBlock = newBlocks[id]!;
    if (oldBlock['sys:flavour'] !== 'affine:surface') {
      if (semanticJson(oldBlock) !== semanticJson(newBlock)) return null;
      continue;
    }
    const oldElements = (oldBlock['prop:elements'] as { value?: Record<string, Record<string, unknown>> })?.value;
    const newElements = (newBlock['prop:elements'] as { value?: Record<string, Record<string, unknown>> })?.value;
    if (!oldElements || !newElements) return null;
    const boxMetadata = (block: Record<string, unknown>) => Object.fromEntries(Object.entries(block['prop:elements'] as Record<string, unknown>).filter(([key]) => key !== 'value'));
    if (semanticJson(boxMetadata(oldBlock)) !== semanticJson(boxMetadata(newBlock))) return null;
    const withoutElements = (block: Record<string, unknown>) => Object.fromEntries(Object.entries(block).filter(([key]) => key !== 'prop:elements'));
    if (semanticJson(withoutElements(oldBlock)) !== semanticJson(withoutElements(newBlock))) return null;
    if (Object.keys(oldElements).sort().join('\0') !== Object.keys(newElements).sort().join('\0')) return null;
    for (const [elementId, oldElement] of Object.entries(oldElements)) {
      const next = newElements[elementId]!;
      if (semanticJson(oldElement) === semanticJson(next)) continue;
      const withoutBounds = (element: Record<string, unknown>) => Object.fromEntries(Object.entries(element).filter(([key]) => key !== 'xywh'));
      if (oldElement.type !== 'shape' || semanticJson(withoutBounds(oldElement)) !== semanticJson(withoutBounds(next))) return null;
      let bounds: unknown;
      try { bounds = JSON.parse(next.xywh as string); } catch { return null; }
      if (!Array.isArray(bounds) || bounds.length !== 4 || !bounds.every(Number.isFinite) || bounds[2] <= 0 || bounds[3] <= 0) return null;
      changed.push(elementId);
    }
  }
  return changed;
}

export function registerCollaborationRoutes(app: FastifyInstance, config: AuthConfig, database: AccountDatabase, now: () => number) {
  initializeBackupSchedule(database);
  runMigrations(database, [{ version: 10, sql: `
    ALTER TABLE boards ADD COLUMN live_enabled INTEGER NOT NULL DEFAULT 0 CHECK(live_enabled IN (0,1));
    CREATE TABLE document_receipts (
      board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      account_id TEXT NOT NULL REFERENCES members(id), tab_id TEXT NOT NULL,
      operation_id TEXT NOT NULL, doc_id TEXT NOT NULL, digest TEXT NOT NULL,
      previous_revision INTEGER NOT NULL, revision INTEGER NOT NULL,
      PRIMARY KEY(board_id,account_id,tab_id,operation_id)
    );
  ` }]);
  const broker = new CollaborationBroker(now);
  const presence = new PresenceRegistry(broker, (boardId, accountId) => {
    const member = database.prepare(`SELECT m.display_name AS name,
      CASE WHEN b.owner_id=m.id THEN 'owner' WHEN m.system_role='viewer' THEN 'viewer' ELSE g.role END AS role
      FROM members m JOIN boards b ON b.id=? LEFT JOIN board_grants g ON g.board_id=b.id AND g.member_id=m.id
      WHERE m.id=? AND (b.owner_id=m.id OR g.member_id IS NOT NULL)`).get(boardId, accountId) as PresenceIdentity | undefined;
    return member;
  }, now);
  const presenceSnapshot = (boardId: string) => {
    const participants = presence.roster(boardId);
    return { presence: participants, presenceVersion: createHash('sha256').update(JSON.stringify(participants)).digest('hex') };
  };
  const polling = new WeakSet<LiveConnection>();
  type Params = { boardId: string };
  const bounded = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 256;
  app.post<{ Params: Params; Body: { tabId?: unknown; activate?: unknown } }>('/api/boards/:boardId/live/connect', {
    bodyLimit: 4096, onRequest: async (request, reply) => { requireMutation(request, reply, config, ['application/json']); },
  }, async (request, reply) => {
    const board = requireBoardCapability(database, request, reply, request.params.boardId, 'read', now); if (!board) return;
    if (!bounded(request.body?.tabId)) return reply.code(400).send({ code: 'INVALID_CONNECTION' });
    if (request.body.activate === true) {
      const admitted = database.transaction(() => {
        if (!requireBoardCapability(database, request, reply, board.id, 'write', now)) return false;
        database.prepare('UPDATE boards SET live_enabled=1 WHERE id=?').run(board.id); return true;
      })();
      if (!admitted) return;
    }
    const accountId = request.headers['x-dali-account'] as string;
    const connection = broker.connect(board.id, accountId, request.body.tabId);
    // Synchronous reads and revision capture share one SQLite transaction.
    return database.transaction(() => ({ connectionId: connection.id, epoch: readRecoveryEpoch(database), revision: board.revision, title: board.title,
      root: documentBytes(database, board, board.root_doc_id)!.toString('base64'), content: documentBytes(database, board, board.content_doc_id)!.toString('base64') }))();
  });
  app.post<{ Params: Params; Body: { connectionId?: unknown; presence?: unknown } }>('/api/boards/:boardId/live/presence', {
    bodyLimit: 64 * 1024, onRequest: async (request, reply) => { requireMutation(request, reply, config, ['application/json']); },
  }, async (request, reply) => {
    const board = requireBoardCapability(database, request, reply, request.params.boardId, 'read', now); if (!board) return;
    if (!bounded(request.body?.connectionId)) return reply.code(400).send({ code: 'INVALID_CONNECTION' });
    const connection = broker.find(request.body.connectionId, board.id, request.headers['x-dali-account'] as string);
    if (!connection) return reply.code(409).send({ code: 'CONNECTION_EXPIRED' });
    try { presence.update(connection, request.body.presence); }
    catch { return reply.code(400).send({ code: 'INVALID_PRESENCE' }); }
    return { acknowledged: true };
  });
  app.post<{ Params: Params; Body: { connectionId?: unknown; objectIds?: unknown } }>('/api/boards/:boardId/live/reserve', {
    bodyLimit: 1024 * 1024, onRequest: async (request, reply) => { requireMutation(request, reply, config, ['application/json']); },
  }, async (request, reply) => {
    const board = requireBoardCapability(database, request, reply, request.params.boardId, 'write', now); if (!board) return;
    if (!bounded(request.body?.connectionId)) return reply.code(400).send({ code: 'INVALID_CONNECTION' });
    const connection = broker.find(request.body.connectionId, board.id, request.headers['x-dali-account'] as string);
    if (!connection) return reply.code(409).send({ code: 'CONNECTION_EXPIRED' });
    if (Array.isArray(request.body.objectIds) && request.body.objectIds.some(id => typeof id === 'string' && id.startsWith('$dali:create:') && id !== `$dali:create:${connection.id}`)) return reply.code(400).send({ code: 'INVALID_OBJECTS' });
    let token: string | null;
    try { token = broker.acquire(connection, request.body.objectIds as string[]); }
    catch { return reply.code(400).send({ code: 'INVALID_OBJECTS' }); }
    if (!token) {
      const blocking = broker.blockingAccount(connection, request.body.objectIds as string[]);
      const member = blocking ? database.prepare('SELECT display_name FROM members WHERE id=?').get(blocking) as { display_name: string } | undefined : undefined;
      return reply.code(409).send({ code: 'OBJECT_RESERVED', editor: member?.display_name ?? 'Another participant' });
    }
    return { token };
  });
  app.post<{ Params: Params; Body: { connectionId?: unknown; epoch?: unknown; revision?: unknown; presenceVersion?: unknown; waitMs?: unknown } }>('/api/boards/:boardId/live/poll', {
    bodyLimit: 4096, onRequest: async (request, reply) => { requireMutation(request, reply, config, ['application/json']); },
  }, async (request, reply) => {
    if (!bounded(request.body?.connectionId) || !Number.isSafeInteger(request.body.revision) || (request.body.revision as number) < 0) return reply.code(400).send({ code: 'INVALID_CURSOR' });
    const connection = broker.find(request.body.connectionId, request.params.boardId, request.headers['x-dali-account'] as string);
    if (!connection) return reply.code(409).send({ code: 'CONNECTION_EXPIRED' });
    const waitMs = request.body.waitMs ?? 20000;
    if (typeof waitMs !== 'number' || !Number.isFinite(waitMs) || waitMs < 0 || waitMs > 20000) return reply.code(400).send({ code: 'INVALID_WAIT' });
    if (polling.has(connection)) return reply.code(409).send({ code: 'POLL_ALREADY_ACTIVE' });
    polling.add(connection);
    const deadline = Date.now() + waitMs;
    try {
    while (!reply.raw.destroyed) {
      // Reauthorize on every wake, including the final delivery. A held request
      // never retains authority from when it was opened.
      const board = requireBoardCapability(database, request, reply, connection.boardId, 'read', now);
      if (!board) { broker.disconnect(connection); return; }
      if (board.role === 'viewer') broker.releaseAll(connection);
      const epoch = readRecoveryEpoch(database);
      if (request.body.epoch !== epoch) { broker.disconnect(connection); return reply.code(409).send({ code: 'RECOVERY_EPOCH_MISMATCH' }); }
      try { broker.touch(connection); } catch { return reply.code(409).send({ code: 'CONNECTION_EXPIRED' }); }
      const delivery = presenceSnapshot(board.id);
      if (board.revision !== request.body.revision) return { revision: board.revision, epoch, ...delivery, title: board.title,
        root: documentBytes(database, board, board.root_doc_id)!.toString('base64'), content: documentBytes(database, board, board.content_doc_id)!.toString('base64') };
      if (Date.now() >= deadline || (typeof request.body.presenceVersion === 'string' && request.body.presenceVersion !== delivery.presenceVersion)) return { revision: board.revision, epoch, ...delivery };
      await new Promise<void>(resolve => {
        const finish = () => { clearTimeout(timer); reply.raw.off('close', finish); resolve(); };
        const timer = setTimeout(finish, Math.min(250, deadline - Date.now()));
        reply.raw.once('close', finish);
      });
    }
    broker.disconnect(connection);
    } finally { polling.delete(connection); }
  });
  for (const action of ['release', 'disconnect'] as const) app.post<{ Params: Params; Body: { connectionId?: unknown; token?: unknown } }>(`/api/boards/:boardId/live/${action}`, {
    bodyLimit: 4096, onRequest: async (request, reply) => { requireMutation(request, reply, config, ['application/json']); },
  }, async (request, reply) => {
    const board = requireBoardCapability(database, request, reply, request.params.boardId, 'read', now); if (!board) return;
    if (!bounded(request.body?.connectionId)) return reply.code(400).send({ code: 'INVALID_CONNECTION' });
    const connection = broker.find(request.body.connectionId, board.id, request.headers['x-dali-account'] as string);
    if (connection) {
      if (action === 'disconnect') broker.disconnect(connection);
      else if (bounded(request.body.token)) broker.release(connection, request.body.token);
      else return reply.code(400).send({ code: 'INVALID_RESERVATION' });
    }
    return { acknowledged: true };
  });
  return broker;
}
