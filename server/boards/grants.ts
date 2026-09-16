import { domainToASCII } from 'node:url';
import type { FastifyInstance } from 'fastify';
import type { AuthConfig } from '../app.js';
import { runMigrations, type AccountDatabase } from '../storage/database.js';
import { currentSession, requireMutation } from '../auth/session-store.js';
import { requireBoardCapability } from './routes.js';
import type { BeforeCommit } from './documents.js';

export function canonicalInternalEmail(config: Pick<AuthConfig, 'domains' | 'emailCaseFold'>, email: unknown): string | undefined {
  if (typeof email !== 'string' || email.length > 254) return;
  const match = /^([^\s@]+)@([^\s@]+)$/.exec(email.trim());
  if (!match) return;
  const domain = domainToASCII(match[2]!).toLowerCase();
  if (!domain || !config.domains.includes(domain)) return;
  return `${config.emailCaseFold ? match[1]!.toLowerCase() : match[1]}@${domain}`;
}
type Member = { id: string; email: string; display_name: string; canonical_email: string };
type Grant = { id: string; memberId?: string; issuer?: string; email: string; displayName: string; role: 'viewer' | 'editor'; status: 'active' | 'pending'; revision: number };
const grantId = (kind: string, key: string) => Buffer.from(JSON.stringify([kind, key])).toString('base64url');
/** Called only inside the validated identity/profile transaction. History is ambiguity evidence. */
export function activatePendingGrants(database: AccountDatabase, identity: { issuer: string; canonicalEmail: string }, memberId: string) {
  const collisions = database.prepare(`SELECT id FROM members WHERE issuer=? AND id<>? AND
    (canonical_email=? OR EXISTS(SELECT 1 FROM json_each(email_history) WHERE value=?))`).all(identity.issuer, memberId, identity.canonicalEmail, identity.canonicalEmail);
  if (collisions.length) return;
  const pending = database.prepare('SELECT board_id,role FROM pending_grants WHERE issuer=? AND canonical_email=?').all(identity.issuer, identity.canonicalEmail) as { board_id: string; role: string }[];
  for (const row of pending) {
    const board = database.prepare('UPDATE boards SET revision=revision+1 WHERE id=? RETURNING revision,owner_id').get(row.board_id) as { revision: number; owner_id: string };
    if (board.owner_id !== memberId) database.prepare('INSERT INTO board_grants(board_id,member_id,role,revision) VALUES(?,?,?,?) ON CONFLICT(board_id,member_id) DO NOTHING').run(row.board_id, memberId, row.role, board.revision);
    database.prepare('DELETE FROM pending_grants WHERE board_id=? AND issuer=? AND canonical_email=?').run(row.board_id, identity.issuer, identity.canonicalEmail);
  }
}
export function grantState(database: AccountDatabase, boardId: string) {
  const board = database.prepare('SELECT owner_id,revision FROM boards WHERE id=?').get(boardId) as { owner_id: string; revision: number };
  const owner = database.prepare('SELECT id,email,display_name FROM members WHERE id=?').get(board.owner_id) as Member;
  const active = database.prepare(`SELECT m.id,m.email,m.display_name,g.role,g.revision FROM board_grants g JOIN members m ON m.id=g.member_id WHERE g.board_id=? AND g.member_id<>?`).all(boardId, owner.id) as (Member & { role: 'editor' | 'viewer'; revision: number })[];
  const pending = database.prepare('SELECT issuer,canonical_email,role,revision FROM pending_grants WHERE board_id=?').all(boardId) as { issuer: string; canonical_email: string; role: 'editor' | 'viewer'; revision: number }[];
  const grants: Grant[] = [...active.map(row => ({ id: grantId('active', row.id), memberId: row.id, email: row.email, displayName: row.display_name, role: row.role, status: 'active' as const, revision: row.revision })),
    ...pending.map(row => ({ id: grantId('pending', JSON.stringify([row.issuer, row.canonical_email])), issuer: row.issuer, email: row.canonical_email, displayName: row.canonical_email, role: row.role, status: 'pending' as const, revision: row.revision }))];
  grants.sort((a, b) => a.displayName < b.displayName ? -1 : a.displayName > b.displayName ? 1 : a.email < b.email ? -1 : a.email > b.email ? 1 : a.id < b.id ? -1 : 1);
  return { revision: board.revision, owner: { memberId: owner.id, email: owner.email, displayName: owner.display_name, role: 'owner' }, grants };
}
export function registerGrantRoutes(app: FastifyInstance, config: AuthConfig, database: AccountDatabase, now: () => number, beforeCommit?: BeforeCommit) {
  runMigrations(database, [{ version: 5, sql: `ALTER TABLE members ADD COLUMN email_history TEXT NOT NULL DEFAULT '[]'; UPDATE members SET email_history=json_array(canonical_email); CREATE INDEX members_canonical_email ON members(issuer,canonical_email);` }]);
  app.get<{ Querystring: { q?: string; boardId?: string } }>('/api/members', async (request, reply) => {
    if (!requireBoardCapability(database, request, reply, request.query.boardId ?? '', 'grants', now)) return;
    const query = request.query.q?.trim() ?? '';
    if (query.length > 254) return reply.code(400).send({ code: 'INVALID_QUERY' });
    const members = query ? (database.prepare(`SELECT id,email,display_name,canonical_email FROM members WHERE issuer=? AND (instr(lower(display_name),lower(?))>0 OR instr(lower(email),lower(?))>0) ORDER BY display_name,email,id LIMIT 50`).all(config.issuer, query, query) as Member[])
      .map(row => ({ memberId: row.id, email: row.email, displayName: row.display_name })) : [];
    return { members, pendingEmail: canonicalInternalEmail(config, query) ?? null };
  });
  app.get<{ Params: { boardId: string } }>('/api/boards/:boardId/grants', async (request, reply) => {
    if (requireBoardCapability(database, request, reply, request.params.boardId, 'grants', now)) return grantState(database, request.params.boardId);
  });
  type Body = { operationId: string; revision: number; memberId?: string; email?: string; role?: 'editor' | 'viewer' };
  for (const method of ['POST', 'PATCH', 'DELETE'] as const) app.route<{ Params: { boardId: string; grantId?: string }; Body: Body }>({
    method, url: '/api/boards/:boardId/grants' + (method === 'POST' ? '' : '/:grantId'),
    schema: { body: { type: 'object', additionalProperties: false, required: ['operationId', 'revision'], properties: {
      operationId: { type: 'string', minLength: 1, maxLength: 128, pattern: '^[a-zA-Z0-9_-]+$' }, revision: { type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER },
      memberId: { type: 'string', minLength: 1, maxLength: 128 }, email: { type: 'string', maxLength: 254 }, role: { enum: ['editor', 'viewer'] },
    } } },
    handler: async (request, reply) => {
      if (!requireMutation(request, reply, config) || !requireBoardCapability(database, request, reply, request.params.boardId, 'grants', now)) return;
      await beforeCommit?.();
      return database.transaction(() => {
        const board = requireBoardCapability(database, request, reply, request.params.boardId, 'grants', now); if (!board) return;
        const actor = currentSession(database, request, now)!;
        const kind = JSON.stringify(['grant', method, board.id, request.params.grantId, request.body.revision, request.body.memberId, request.body.email, request.body.role]);
        const previous = database.prepare('SELECT kind,result FROM operations WHERE member_id=? AND operation_id=?').get(actor.accountId, request.body.operationId) as { kind: string; result: string } | undefined;
        if (previous) return previous.kind === kind ? JSON.parse(previous.result) : reply.code(409).send({ code: 'OPERATION_CONFLICT' });
        const state = grantState(database, board.id); let target = state.grants.find(row => row.id === request.params.grantId);
        if (request.params.grantId === grantId('active', board.owner_id)) return reply.code(400).send({ code: 'OWNER_IMMUTABLE' });
        const revision = board.revision + 1; let changed = false;
        if (method === 'POST') {
          if (request.body.revision !== board.revision) return reply.code(409).send({ code: 'GRANT_CONFLICT' });
          const canonical = canonicalInternalEmail(config, request.body.email);
          const member = request.body.memberId ? database.prepare('SELECT id,email,display_name,canonical_email FROM members WHERE id=? AND issuer=?').get(request.body.memberId, config.issuer) as Member | undefined : undefined;
          if ((!member && !canonical) || (request.body.memberId && !member)) return reply.code(400).send({ code: 'INVALID_RECIPIENT' });
          const matching = canonical ? database.prepare('SELECT id,email,display_name,canonical_email FROM members WHERE issuer=? AND canonical_email=?').all(config.issuer, canonical) as Member[] : [];
          if (matching.length > 1) return reply.code(409).send({ code: 'AMBIGUOUS_RECIPIENT' });
          const established = member ?? matching[0];
          if (established?.id === board.owner_id) return reply.code(400).send({ code: 'OWNER_IMMUTABLE' });
          target = state.grants.find(row => established ? row.memberId === established.id : row.status === 'pending' && row.issuer === config.issuer && row.email === canonical);
          // Duplicate creation converges on the acknowledged role; changes use PATCH.
          if (!target) {
            changed = true;
            if (established) {
              const pending = state.grants.find(row => row.status === 'pending' && row.issuer === config.issuer && row.email === established.canonical_email);
              database.prepare('INSERT INTO board_grants(board_id,member_id,role,revision) VALUES(?,?,?,?)').run(board.id, established.id, pending?.role ?? request.body.role ?? 'viewer', revision);
              database.prepare('DELETE FROM pending_grants WHERE board_id=? AND issuer=? AND canonical_email=?').run(board.id, config.issuer, established.canonical_email);
            }
            else database.prepare('INSERT INTO pending_grants(board_id,issuer,canonical_email,role,revision) VALUES(?,?,?,?,?)').run(board.id, config.issuer, canonical, request.body.role ?? 'viewer', revision);
          }
        } else if (target) {
          if (target.revision !== request.body.revision) return reply.code(409).send({ code: 'GRANT_CONFLICT' });
          const table = target.status === 'active' ? 'board_grants' : 'pending_grants';
          const condition = target.status === 'active' ? 'board_id=? AND member_id=?' : 'board_id=? AND canonical_email=? AND issuer=?';
          const args = target.status === 'active' ? [board.id, target.memberId!] : [board.id, target.email, target.issuer!];
          changed = true;
          if (method === 'DELETE') database.prepare(`DELETE FROM ${table} WHERE ${condition}`).run(...args);
          else {
            if (!request.body.role) return reply.code(400).send({ code: 'INVALID_ROLE' });
            database.prepare(`UPDATE ${table} SET role=?,revision=? WHERE ${condition}`).run(request.body.role, revision, ...args);
          }
        } else if (method === 'PATCH') return reply.code(409).send({ code: 'GRANT_CONFLICT' });
        if (changed) database.prepare('UPDATE boards SET revision=? WHERE id=?').run(revision, board.id);
        const result = grantState(database, board.id);
        database.prepare('INSERT INTO operations(member_id,operation_id,kind,status,board_id,result) VALUES(?,?,?,?,?,?)').run(actor.accountId, request.body.operationId, kind, 'completed', board.id, JSON.stringify(result));
        return result;
      })();
    },
  });
}
