import type { FastifyRequest, FastifyReply, Session } from 'fastify';
import type { SessionStore } from '@fastify/session';
import type { AccountDatabase } from '../storage/database.js';
import type { AuthConfig } from '../app.js';
declare module 'fastify' { interface Session { memberId?: string; expiresAt?: number } }
export type SessionDescriptor = { accountId: string; displayName: string; email: string; expiresAt: number };
export const SESSION_COOKIE = 'dali_session';
export function expiresAt(now: number, ttl: number) {
  if (!Number.isSafeInteger(now) || now < 0 || !Number.isSafeInteger(ttl) || ttl <= 0 ||
      ttl > 31 * 86400000 || !Number.isSafeInteger(now + ttl) || now + ttl > 8640000000000000) throw new Error('Invalid session lifetime');
  return now + ttl;
}
export class SqliteSessionStore implements SessionStore {
  constructor(private database: AccountDatabase, private now: () => number) {}
  set(id: string, value: Session, done: (error?: Error) => void) {
    try {
      // Regeneration creates an empty session; only explicitly bounded sessions persist.
      if (value.expiresAt !== undefined) {
        if (!Number.isSafeInteger(value.expiresAt) || value.expiresAt <= this.now()) throw new Error('Session expired');
        this.database.prepare(`INSERT INTO sessions(id,member_id,expires_at,data) VALUES(?,?,?,?)
          ON CONFLICT(id) DO UPDATE SET member_id=excluded.member_id,expires_at=excluded.expires_at,data=excluded.data`)
          .run(id, value.memberId ?? null, value.expiresAt, JSON.stringify(value));
      }
      done();
    } catch { done(new Error('Session storage unavailable')); }
  }
  get(id: string, done: (error: Error | null, value?: Session | null) => void) {
    try {
      const row = this.database.prepare('SELECT data,expires_at FROM sessions WHERE id=?').get(id) as { data: string; expires_at: number } | undefined;
      const now = this.now();
      if (!Number.isSafeInteger(now) || now < 0 || !row || !Number.isSafeInteger(row.expires_at) || !(now < row.expires_at)) {
        this.database.prepare('DELETE FROM sessions WHERE id=?').run(id); done(null, null); return;
      }
      done(null, JSON.parse(row.data) as Session);
    } catch { done(new Error('Session storage unavailable')); }
  }
  destroy(id: string, done: (error?: Error) => void) {
    try { this.database.prepare('DELETE FROM sessions WHERE id=?').run(id); done(); }
    catch { done(new Error('Session storage unavailable')); }
  }
}
export function currentSession(database: AccountDatabase, request: FastifyRequest, now: () => number): SessionDescriptor | undefined {
  const time = now();
  if (!Number.isSafeInteger(time) || time < 0) return undefined;
  return database.prepare(`SELECT m.id AS accountId,m.email,m.display_name AS displayName,s.expires_at AS expiresAt
    FROM sessions s JOIN members m ON m.id=s.member_id WHERE s.id=? AND s.expires_at>?`)
    .get(request.session.sessionId, time) as SessionDescriptor | undefined;
}
export function requireExpectedMember(request: FastifyRequest, reply: FastifyReply, member: SessionDescriptor | undefined, required = true) {
  if (!member) { reply.code(401).send({ code: 'SESSION_REQUIRED' }); return false; }
  const expected = request.headers['x-dali-account'];
  if ((required || expected !== undefined) && expected !== member.accountId) { reply.code(409).send({ code: 'IDENTITY_CHANGED' }); return false; }
  return true;
}
export function requireMutation(request: FastifyRequest, reply: FastifyReply, config: AuthConfig, types = ['application/json']) {
  if (request.headers.origin !== config.origin || request.headers['x-dali-request'] !== '1' ||
      !types.includes((request.headers['content-type'] ?? '').split(';')[0]!.trim().toLowerCase())) {
    reply.code(403).send({ code: 'REQUEST_REJECTED' }); return false;
  }
  return true;
}
