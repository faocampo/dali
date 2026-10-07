import { pathToFileURL } from 'node:url';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import session from '@fastify/session';
import { registerOidcRoutes } from './auth/oidc.js';
import { SqliteSessionStore, expiresAt, SESSION_COOKIE, currentSession, requireExpectedMember } from './auth/session-store.js';
export { expiresAt, currentSession, requireExpectedMember, requireMutation } from './auth/session-store.js';
export { localReturnIntent } from './auth/oidc.js';
export type { SessionDescriptor } from './auth/session-store.js';
import { openDatabase, runMigrations, type AccountDatabase } from './storage/database.js';
import { registerBoardRoutes } from './boards/routes.js';
import { startProductionLifecycle, drainProductionApp } from './storage/lifecycle.js';
import { BackupScheduler, readStorageConfig, setBackupHealthPolicy, getBackupHealth, unavailableBackupHealth, type StoragePolicy } from './storage/backup-scheduler.js';

export type AuthConfig = {
  origin: string; databasePath: string; secret: string; ttl: number; issuer: string;
  clientId: string; clientSecret: string; callback: string; claim: string;
  roleClaim?: string; editorValues?: string[]; internalValues: string[]; domains: string[]; emailCaseFold: boolean; secure: boolean;
};
const fail = () => { throw new Error('Authentication configuration unavailable'); };
export function readConfig(env: Record<string, string | undefined>): AuthConfig {
  try {
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
      roleClaim: env.DALI_ROLE_CLAIM?.trim() || undefined, editorValues: env.DALI_ROLE_CLAIM?.trim() ? list('DALI_EDITOR_VALUES_JSON') : undefined,
      claim: required('DALI_INTERNAL_CLAIM'), internalValues: list('DALI_INTERNAL_VALUES_JSON'),
      domains, emailCaseFold: emailCaseFold === 'true', secure: origin.protocol === 'https:' };
  } catch { return fail(); }
}
export async function buildApp(options: { config: Record<string, string | undefined>; database?: AccountDatabase; now?: () => number; beforeCommit?: () => Promise<void>; storagePolicy?: StoragePolicy }) {
  if (Object.keys({ ...process.env, ...options.config }).some(key => /(?:TEST.*AUTH|AUTH.*TEST|AUTH.*BYPASS)/i.test(key))) throw new Error('Test authentication is forbidden');
  // Pending grant identifiers encode issuer + email and can exceed the router's 100-byte default.
  const proxy = options.config.DALI_TRUST_PROXY;
  if (proxy !== undefined && proxy !== 'loopback') throw new Error('Proxy configuration unavailable');
  const app = Fastify({ logger: false, bodyLimit: 16384, routerOptions: { maxParamLength: 8192 },
    forceCloseConnections: 'idle', return503OnClosing: true,
    trustProxy: proxy === 'loopback' ? (address, hop) => hop === 0 && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address) : false });
  let initialized = false;
  let localDatabase: AccountDatabase | undefined;
  startProductionLifecycle(app, {
    ready: () => initialized && !!localDatabase?.open && !!localDatabase.prepare('SELECT 1').get(),
    onDrain: () => { if (localDatabase) setBackupHealthPolicy(localDatabase, unavailableBackupHealth); },
  });
  app.addHook('onRequest', async (_request, reply) => { reply.header('Cache-Control', 'private, no-store'); });
  app.setErrorHandler((error, _request, reply) => {
    const validation = error instanceof Error && 'validation' in error;
    reply.code(validation ? 400 : 500).send({ code: validation ? 'INVALID_REQUEST' : 'REQUEST_FAILED' });
  });
  let config: AuthConfig;
  try { config = readConfig(options.config); } catch {
    app.get('/api/session', async (_request, reply) => reply.code(503).send({ code: 'AUTH_CONFIGURATION' }));
    app.get('/auth/start', async (_request, reply) => reply.redirect('/?authError=configuration'));
    app.get('/auth/callback', async (_request, reply) => reply.redirect('/?authError=configuration')); return app;
  }
  const database = options.database ?? openDatabase(config.databasePath); runMigrations(database);
  localDatabase = database;
  const now = options.now ?? Date.now; await app.register(cookie);
  await app.register(session, { secret: config.secret, cookieName: SESSION_COOKIE,
    cookie: { path: '/', httpOnly: true, sameSite: 'lax', secure: config.secure },
    rolling: false, saveUninitialized: false, store: new SqliteSessionStore(database, now) });
  await registerOidcRoutes(app, config, database, now);
  registerBoardRoutes(app, config, database, now, options.beforeCommit);
  let scheduler: BackupScheduler | undefined;
  setBackupHealthPolicy(database, unavailableBackupHealth);
  if (options.storagePolicy) {
    const policy = options.storagePolicy;
    setBackupHealthPolicy(database, 'health' in policy ? policy.health : () => ({ state: 'healthy', reason: 'fresh', recoverableAgeMs: 0, recoveryPointAt: now(), failure: null }));
    initialized = true;
  } else {
    try {
      const storage = readStorageConfig(options.config);
      scheduler = new BackupScheduler({ database, destination: storage.destination, policy: storage, applicationVersion: '0.1.0', onHealth: health => {
        if (health.state !== 'healthy') app.log.warn({ backup: health }, 'Backup coverage requires attention');
      } });
      await scheduler.start();
      initialized = true;
    } catch { /* Configuration failure leaves durable writes fenced; authentication and repair remain available. */ }
  }
  app.get('/api/storage-health', async (request, reply) => {
    const member = currentSession(database, request, now); if (!requireExpectedMember(request, reply, member)) return;
    return { backup: getBackupHealth(database) };
  });
  app.addHook('onClose', async () => { initialized = false; await scheduler?.close(); if (!options.database) database.close(); });
  return app;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  readConfig(process.env); readStorageConfig(process.env); const app = await buildApp({ config: process.env });
  await app.listen({ host: '127.0.0.1', port: Number(process.env.PORT ?? 3000) });
  const shutdown = () => { void drainProductionApp(app).catch(() => { process.exit(1); }); };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}
