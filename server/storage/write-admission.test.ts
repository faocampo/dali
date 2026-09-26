import { afterEach, beforeEach, expect, it } from 'vitest';
import { randomBytes, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { openDatabase, type AccountDatabase } from './database.js';
import { readRecoveryEpoch } from './recovery-state.js';
import { createOidcProvider, IDENTITY_COOKIE } from '../../tests/oidc-provider.js';
import type { BackupHealth } from './backup-scheduler.js';

let app: FastifyInstance; let database: AccountDatabase; let provider: Awaited<ReturnType<typeof createOidcProvider>>;
let health: BackupHealth; let barrier: () => Promise<void>;
const origin = 'http://127.0.0.1:5499';
let actor: { cookie: string; accountId: string };
let board: { summary: { id: string }; rootDocId: string; contentDocId: string; revision: number; recoveryEpoch: string };
const headers = () => ({ ...actor, cookie: actor.cookie, 'x-dali-account': actor.accountId, origin, 'x-dali-request': '1', 'x-dali-recovery-epoch': readRecoveryEpoch(database) });
const snapshot = () => ['boards', 'board_documents', 'board_blobs', 'board_thumbnails', 'board_grants', 'pending_grants', 'import_staging', 'import_staging_blobs', 'operations'].map(table => database.prepare('SELECT * FROM ' + table).all());
async function signIn(identity = 'owner') {
  const cookieOf = (values: string | string[] | undefined) => (Array.isArray(values) ? values.at(-1) : values)!.split(';')[0]!;
  const start = await app.inject('/auth/start');
  const authorize = await fetch(start.headers.location!, { redirect: 'manual', headers: { cookie: `${IDENTITY_COOKIE}=${identity}` } });
  const callback = new URL(authorize.headers.get('location')!);
  const response = await app.inject({ url: callback.pathname + callback.search, headers: { cookie: cookieOf(start.headers['set-cookie']) } });
  const cookie = cookieOf(response.headers['set-cookie']);
  const session = await app.inject({ url: '/api/session', headers: { cookie } }); expect(session.statusCode).toBe(200);
  return { cookie, accountId: session.json().accountId as string };
}
beforeEach(async () => {
  barrier = async () => {}; health = { state: 'healthy', reason: 'fresh', recoveryPointAt: Date.now(), recoverableAgeMs: 0, failure: null };
  const registration = { clientId: 'synthetic-admission', clientSecret: randomBytes(32).toString('hex'), redirectUri: origin + '/auth/callback' };
  provider = await createOidcProvider({ port: 0, clients: [registration] }); database = openDatabase(':memory:');
  app = await buildApp({ database, storagePolicy: { health: () => health }, beforeCommit: () => barrier(), config: {
    DALI_ORIGIN: origin, DALI_DATABASE_PATH: ':memory:', DALI_SESSION_SECRET: randomBytes(32).toString('hex'), DALI_SESSION_TTL_MS: '86400000',
    DALI_OIDC_ISSUER: provider.issuer, DALI_OIDC_CLIENT_ID: registration.clientId, DALI_OIDC_CLIENT_SECRET: registration.clientSecret,
    DALI_OIDC_CALLBACK_URL: registration.redirectUri, DALI_INTERNAL_CLAIM: 'membership', DALI_INTERNAL_VALUES_JSON: '["internal"]', DALI_INTERNAL_EMAIL_DOMAINS_JSON: '["example.org"]',
  } });
  actor = await signIn();
  const created = await app.inject({ method: 'POST', url: '/api/boards', headers: headers(), payload: { title: 'Synthetic admission board', operationId: randomUUID() } });
  expect(created.statusCode).toBe(201); board = created.json();
});
afterEach(async () => { await app?.close(); database?.close(); await provider?.close(); });
it('@04-11-02 stale backup fences create without changing durable storage', async () => {
  health = { ...health, state: 'fenced', reason: 'stale', recoverableAgeMs: 3_600_000 };
  const before = snapshot();
  const response = await app.inject({ method: 'POST', url: '/api/boards', headers: headers(), payload: { title: 'Unacknowledged', operationId: randomUUID() } });
  expect(response.statusCode).toBe(503); expect(response.json()).toEqual({ code: 'BACKUP_FRESHNESS_REQUIRED' }); expect(snapshot()).toEqual(before);
  expect(board.summary.id).toBeTruthy();
});
