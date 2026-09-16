import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomBytes, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { openDatabase, type AccountDatabase } from '../storage/database.js';
import { createOidcProvider, IDENTITY_COOKIE } from '../../tests/oidc-provider.js';

describe('@03-08-01 board action transactions', () => {
  let provider: Awaited<ReturnType<typeof createOidcProvider>>;
  let app: FastifyInstance; let database: AccountDatabase;
  let barrier: () => Promise<void> = async () => {};
  const origin = 'http://127.0.0.1:5499';
  const actors: Record<string, { cookie: string; accountId: string }> = {};
  const cookieOf = (response: { headers: Record<string, unknown> }) => {
    const values = response.headers['set-cookie'];
    return (Array.isArray(values) ? values.at(-1) : values)?.split(';')[0] as string;
  };
  beforeEach(async () => {
    const registration = { clientId: 'synthetic-library', clientSecret: randomBytes(32).toString('hex'), redirectUri: origin + '/auth/callback' };
    provider = await createOidcProvider({ clients: [registration] }); database = openDatabase(':memory:');
    barrier = async () => {};
    app = await buildApp({ database, beforeCommit: () => barrier(), config: { DALI_ORIGIN: origin, DALI_DATABASE_PATH: ':memory:',
      DALI_SESSION_SECRET: randomBytes(32).toString('hex'), DALI_SESSION_TTL_MS: '86400000',
      DALI_OIDC_ISSUER: provider.issuer, DALI_OIDC_CLIENT_ID: registration.clientId, DALI_OIDC_CLIENT_SECRET: registration.clientSecret,
      DALI_OIDC_CALLBACK_URL: registration.redirectUri, DALI_INTERNAL_CLAIM: 'membership',
      DALI_INTERNAL_VALUES_JSON: '["internal"]', DALI_INTERNAL_EMAIL_DOMAINS_JSON: '["example.org"]' } });
    for (const identity of ['owner', 'editor', 'viewer', 'nonMember']) {
      const start = await app.inject('/auth/start');
      const authorize = await fetch(start.headers.location!, { redirect: 'manual', headers: { cookie: `${IDENTITY_COOKIE}=${identity}` } });
      const callback = new URL(authorize.headers.get('location')!);
      const response = await app.inject({ url: callback.pathname + callback.search, headers: { cookie: cookieOf(start) } });
      const cookie = cookieOf(response); const session = await app.inject({ url: '/api/session', headers: { cookie } });
      expect(session.statusCode).toBe(200); actors[identity] = { cookie, accountId: session.json().accountId };
    }
  });
  afterEach(async () => { await app?.close(); database?.close(); await provider?.close(); });
  const headers = (identity = 'owner') => ({ cookie: actors[identity]!.cookie, 'x-dali-account': actors[identity]!.accountId, 'x-dali-request': '1', origin });
  const create = async (identity = 'owner', title = 'Synthetic board') => {
    const response = await app.inject({ method: 'POST', url: '/api/boards', headers: headers(identity), payload: { title, operationId: randomUUID() } });
    expect(response.statusCode).toBe(201); return response.json();
  };

  it('renames 200 graphemes with revision and idempotent acknowledgment', async () => {
    const board = await create(); const title = '👩🏽‍💻'.repeat(200);
    const payload = { title, operationId: randomUUID(), revision: board.revision };
    const rename = () => app.inject({ method: 'PATCH', url: '/api/boards/' + board.summary.id, headers: headers(), payload });
    const response = await rename(); expect(response.statusCode).toBe(200);
    expect(response.json().summary.title).toBe(title);
    expect((await rename()).json()).toEqual(response.json());
    const before = database.prepare('SELECT * FROM boards').all();
    expect((await app.inject({ method: 'PATCH', url: '/api/boards/' + board.summary.id, headers: headers(), payload: { ...payload, operationId: randomUUID(), title: title + '界' } })).statusCode).toBe(400);
    expect(database.prepare('SELECT * FROM boards').all()).toEqual(before);
  });
});
