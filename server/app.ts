import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import Fastify, { type FastifyInstance, type FastifyRequest, type FastifyReply, type Session } from 'fastify';
import cookie from '@fastify/cookie';
import session, { type SessionStore } from '@fastify/session';
import * as oidc from 'openid-client';
import { openDatabase, runMigrations, type AccountDatabase } from './storage/database.js';

declare module 'fastify' { interface Session { memberId?: string; expiresAt?: number } }
export type SessionDescriptor = { accountId: string; displayName: string; email: string; expiresAt: number };
export type AuthConfig = {
  origin: string; databasePath: string; secret: string; ttl: number; issuer: string;
  clientId: string; clientSecret: string; callback: string; claim: string;
  internalValues: string[]; domains: string[]; emailCaseFold: boolean; secure: boolean;
};
const COOKIE = 'dali_session';
const fail = () => { throw new Error('Authentication configuration unavailable'); };
export function expiresAt(now: number, ttl: number) {
  if (!Number.isSafeInteger(now) || now < 0 || !Number.isSafeInteger(ttl) || ttl <= 0 ||
      ttl > 31 * 86400000 || !Number.isSafeInteger(now + ttl) || now + ttl > 8640000000000000) return fail();
  return now + ttl;
}
export function readConfig(env: Record<string, string | undefined>): AuthConfig {
  const required = (key: string) => env[key]?.trim() ? env[key]! : fail();
  const production = env.NODE_ENV === 'production' || process.env.NODE_ENV === 'production';
  const url = (key: string) => {
    const value = new URL(required(key));
    if (value.username || value.password || value.hash || value.search ||
        (value.protocol !== 'https:' && !(value.protocol === 'http:' && value.hostname === '127.0.0.1' && !production))) fail();
    return value;
  };
  const origin = url('DALI_ORIGIN'); url('DALI_OIDC_ISSUER'); const callback = url('DALI_OIDC_CALLBACK_URL');
  if (origin.href !== `${origin.origin}/` || callback.origin !== origin.origin || callback.pathname !== '/auth/callback') fail();
  const list = (key: string): string[] => {
    const value: unknown = JSON.parse(required(key));
    if (!Array.isArray(value) || !value.length || !value.every(v => typeof v === 'string' && v.trim().length > 0)) return fail();
    return value;
  };
  const ttlString = required('DALI_SESSION_TTL_MS'); if (!/^\d+$/.test(ttlString)) fail();
  const ttl = Number(ttlString); expiresAt(0, ttl);
  const secret = required('DALI_SESSION_SECRET'); if (secret.length < 32) fail();
  const emailCaseFold = env.DALI_EMAIL_CASE_FOLD ?? 'false'; if (!['true', 'false'].includes(emailCaseFold)) fail();
  const domains = list('DALI_INTERNAL_EMAIL_DOMAINS_JSON').map(v => v.toLowerCase());
  if (!domains.every(v => /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(v) && v.includes('.'))) fail();
  return { origin: origin.origin, databasePath: required('DALI_DATABASE_PATH'), secret, ttl,
    issuer: required('DALI_OIDC_ISSUER'), clientId: required('DALI_OIDC_CLIENT_ID'),
    clientSecret: required('DALI_OIDC_CLIENT_SECRET'), callback: callback.href,
    claim: required('DALI_INTERNAL_CLAIM'), internalValues: list('DALI_INTERNAL_VALUES_JSON'),
    domains, emailCaseFold: emailCaseFold === 'true', secure: origin.protocol === 'https:' };
}
class SqliteSessionStore implements SessionStore {
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
      if (!row || !(this.now() < row.expires_at)) { this.database.prepare('DELETE FROM sessions WHERE id=?').run(id); done(null, null); return; }
      done(null, JSON.parse(row.data) as Session);
    } catch { done(new Error('Session storage unavailable')); }
  }
  destroy(id: string, done: (error?: Error) => void) {
    try { this.database.prepare('DELETE FROM sessions WHERE id=?').run(id); done(); }
    catch { done(new Error('Session storage unavailable')); }
  }
}
function validateInternalIdentity(config: AuthConfig, claims: Record<string, unknown>, profile: Record<string, unknown>) {
  if (claims.iss !== config.issuer || typeof claims.sub !== 'string' || !claims.sub || profile.sub !== claims.sub ||
      profile.email_verified !== true || typeof profile.email !== 'string' || typeof profile.name !== 'string' || !profile.name.trim()) fail();
  const membership = profile[config.claim];
  if (!(typeof membership === 'string' ? config.internalValues.includes(membership) :
      Array.isArray(membership) && membership.some(v => typeof v === 'string' && config.internalValues.includes(v)))) fail();
  const email = profile.email as string; const match = /^([^\s@]+)@([^\s@]+)$/.exec(email);
  if (!match || email.length > 254 || !config.domains.includes(match[2]!.toLowerCase())) fail();
  return { issuer: config.issuer, subject: claims.sub as string, displayName: profile.name as string, email,
    canonicalEmail: `${config.emailCaseFold ? match![1]!.toLowerCase() : match![1]}@${match![2]!.toLowerCase()}` };
}
/** Only local board/new intents survive sign-in; arbitrary URLs never do. */
export function localReturnIntent(value: string | null): string {
  if (!value || value.length > 512 || !value.startsWith('/?')) return '/';
  const url = new URL(value, 'https://app.example.org'); const board = url.searchParams.get('board');
  if (url.origin !== 'https://app.example.org' || url.pathname !== '/' || url.hash) return '/';
  if (board && /^[A-Za-z0-9_-]{1,128}$/.test(board)) return `/?board=${encodeURIComponent(board)}`;
  return url.searchParams.get('new') === '1' ? '/?new=1' : '/';
}
export function currentSession(database: AccountDatabase, request: FastifyRequest, now: () => number): SessionDescriptor | undefined {
  return database.prepare(`SELECT m.id AS accountId,m.email,m.display_name AS displayName,s.expires_at AS expiresAt
    FROM sessions s JOIN members m ON m.id=s.member_id WHERE s.id=? AND s.expires_at>?`)
    .get(request.session.sessionId, now()) as SessionDescriptor | undefined;
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
async function registerOidcRoutes(app: FastifyInstance, config: AuthConfig, database: AccountDatabase, now: () => number) {
  let discovery: Promise<oidc.Configuration> | undefined;
  const provider = () => discovery ??= oidc.discovery(new URL(config.issuer), config.clientId, config.clientSecret, undefined,
    { execute: config.issuer.startsWith('http:') ? [oidc.allowInsecureRequests, oidc.enableNonRepudiationChecks] : [oidc.enableNonRepudiationChecks] })
    .catch(() => { discovery = undefined; throw new Error('Provider unavailable'); });
  app.get('/auth/start', async (request, reply) => {
    try {
      const client = await provider(); await request.session.regenerate(); const expiry = expiresAt(now(), 600000);
      request.session.expiresAt = expiry; request.session.cookie.expires = new Date(expiry); await request.session.save();
      const state = oidc.randomState(); const nonce = oidc.randomNonce(); const verifier = oidc.randomPKCECodeVerifier();
      const intent = localReturnIntent(new URL(request.url, config.origin).searchParams.get('returnTo'));
      database.prepare('DELETE FROM sessions WHERE expires_at<=?').run(now());
      database.prepare('INSERT INTO login_transactions(state,browser_id,nonce,verifier,return_to,expires_at) VALUES(?,?,?,?,?,?)')
        .run(state, request.session.sessionId, nonce, verifier, intent, expiry);
      return reply.redirect(oidc.buildAuthorizationUrl(client, { redirect_uri: config.callback, scope: 'openid profile email',
        state, nonce, code_challenge: await oidc.calculatePKCECodeChallenge(verifier), code_challenge_method: 'S256' }).href);
    } catch { return reply.redirect('/?authError=signin'); }
  });
  app.get('/auth/callback', async (request, reply) => {
    try {
      const callback = new URL(request.url, config.origin);
      const transactions = database.prepare('DELETE FROM login_transactions WHERE browser_id=? RETURNING *')
        .all(request.session.sessionId) as { state: string; nonce: string; verifier: string; return_to: string; expires_at: number }[];
      const transaction = transactions.find(t => t.state === callback.searchParams.get('state'));
      if (!transaction || !(now() < transaction.expires_at)) throw new Error('Invalid transaction');
      const client = await provider();
      const tokens = await oidc.authorizationCodeGrant(client, callback, { pkceCodeVerifier: transaction.verifier,
        expectedState: transaction.state, expectedNonce: transaction.nonce, idTokenExpected: true });
      const claims = tokens.claims(); if (!claims) throw new Error('Identity missing');
      const profile = await oidc.fetchUserInfo(client, tokens.access_token, claims.sub);
      const identity = validateInternalIdentity(config, claims, profile); const expiry = expiresAt(now(), config.ttl);
      const member = database.prepare(`INSERT INTO members(id,issuer,subject,email,canonical_email,display_name) VALUES(?,?,?,?,?,?)
        ON CONFLICT(issuer,subject) DO UPDATE SET email=excluded.email,canonical_email=excluded.canonical_email,display_name=excluded.display_name
        RETURNING id`).get(randomUUID(), identity.issuer, identity.subject, identity.email, identity.canonicalEmail, identity.displayName) as { id: string };
      await request.session.regenerate(); request.session.memberId = member.id; request.session.expiresAt = expiry;
      request.session.cookie.expires = new Date(expiry); await request.session.save();
      return reply.redirect(transaction.return_to);
    } catch { return reply.redirect('/?authError=signin'); }
  });
  app.get('/api/session', async (request, reply) => {
    const member = currentSession(database, request, now); if (!requireExpectedMember(request, reply, member, false)) return; return member;
  });
  app.post('/auth/logout', async (request, reply) => {
    if (!requireMutation(request, reply, config)) return;
    const member = currentSession(database, request, now); if (member && !requireExpectedMember(request, reply, member)) return;
    await request.session.destroy(); reply.clearCookie(COOKIE, { path: '/', httpOnly: true, secure: config.secure, sameSite: 'lax' });
    return reply.code(204).send();
  });
}
export async function buildApp(options: { config: Record<string, string | undefined>; database?: AccountDatabase; now?: () => number; beforeCommit?: () => Promise<void> }) {
  if (Object.keys(options.config).some(key => /(?:TEST.*AUTH|AUTH.*TEST|AUTH.*BYPASS)/i.test(key))) throw new Error('Test authentication is forbidden');
  const app = Fastify({ logger: false, bodyLimit: 16384 });
  app.addHook('onRequest', async (_request, reply) => { reply.header('Cache-Control', 'private, no-store'); });
  app.setErrorHandler((_error, _request, reply) => { reply.code(500).send({ code: 'REQUEST_FAILED' }); });
  let config: AuthConfig;
  try { config = readConfig(options.config); } catch {
    app.get('/api/session', async (_request, reply) => reply.code(503).send({ code: 'AUTH_CONFIGURATION' }));
    app.get('/auth/start', async (_request, reply) => reply.redirect('/?authError=configuration'));
    app.get('/auth/callback', async (_request, reply) => reply.redirect('/?authError=configuration')); return app;
  }
  const database = options.database ?? openDatabase(config.databasePath); runMigrations(database);
  if (!options.database) app.addHook('onClose', async () => { database.close(); });
  const now = options.now ?? Date.now; await app.register(cookie);
  await app.register(session, { secret: config.secret, cookieName: COOKIE,
    cookie: { path: '/', httpOnly: true, sameSite: 'lax', secure: config.secure },
    rolling: false, saveUninitialized: false, store: new SqliteSessionStore(database, now) });
  await registerOidcRoutes(app, config, database, now); return app;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  readConfig(process.env); const app = await buildApp({ config: process.env });
  await app.listen({ host: '127.0.0.1', port: Number(process.env.PORT ?? 3000) });
}
