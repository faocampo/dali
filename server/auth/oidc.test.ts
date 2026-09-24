import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPublicKey, randomBytes, verify } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp, expiresAt, readConfig, localReturnIntent } from '../app.js';
import { openDatabase, runMigrations, type AccountDatabase } from '../storage/database.js';
import { createOidcProvider, IDENTITY_COOKIE, type ProviderFaults } from '../../tests/oidc-provider.js';

describe('@03-02-02 trusted callbacks and absolute sessions', () => {
  let provider: Awaited<ReturnType<typeof createOidcProvider>>;
  let app: FastifyInstance; let database: AccountDatabase; let env: Record<string, string>;
  let clock: number; let directory: string; let issuedTokens: string[];
  const cookieOf = (response: { headers: Record<string, unknown> }) => {
    const values = response.headers['set-cookie'];
    return (Array.isArray(values) ? values.at(-1) : values)?.split(';')[0] as string;
  };
  beforeEach(async context => {
    issuedTokens = [];
    clock = Date.now(); directory = await mkdtemp(join(tmpdir(), 'dali-auth-'));
    const registration = { clientId: 'synthetic-app', clientSecret: randomBytes(32).toString('hex'), redirectUri: 'http://127.0.0.1:5499/auth/callback' };
    const keyProbe = context.task.name.includes('@NYQ-01');
    if (keyProbe) vi.spyOn(Date, 'now').mockImplementation(() => clock);
    provider = await createOidcProvider({ clients: [registration], ...(keyProbe ? {
      now: () => clock, signingKeyControls: true as const, onIdToken: (token: string) => { issuedTokens.push(token); },
    } : {}) });
    env = { DALI_ORIGIN: 'http://127.0.0.1:5499', DALI_DATABASE_PATH: join(directory, 'accounts.sqlite'),
      DALI_SESSION_SECRET: randomBytes(32).toString('hex'), DALI_SESSION_TTL_MS: '86400000',
      DALI_OIDC_ISSUER: provider.issuer, DALI_OIDC_CLIENT_ID: registration.clientId,
      DALI_OIDC_CLIENT_SECRET: registration.clientSecret, DALI_OIDC_CALLBACK_URL: registration.redirectUri,
      DALI_INTERNAL_CLAIM: 'membership', DALI_INTERNAL_VALUES_JSON: '["internal"]',
      DALI_INTERNAL_EMAIL_DOMAINS_JSON: '["example.org"]', DALI_EMAIL_CASE_FOLD: 'false' };
    database = openDatabase(env.DALI_DATABASE_PATH!);
    app = await buildApp({ config: env, database, now: () => clock });
  });
  afterEach(async () => { vi.restoreAllMocks(); vi.unstubAllEnvs(); await app?.close(); database?.close(); await provider?.close(); await rm(directory, { recursive: true, force: true }); });
  const begin = async (returnTo = '/', identity = 'owner') => {
    const start = await app.inject({ method: 'GET', url: `/auth/start?returnTo=${encodeURIComponent(returnTo)}` });
    expect(start.statusCode).toBe(302);
    const authorize = await fetch(start.headers.location!, { redirect: 'manual', headers: { cookie: `${IDENTITY_COOKIE}=${identity}` } });
    expect(authorize.status).toBe(302);
    const callback = new URL(authorize.headers.get('location')!);
    return { cookie: cookieOf(start), callback: callback.pathname + callback.search, start };
  };
  const finish = (flow: { cookie: string; callback: string }) => app.inject({ method: 'GET', url: flow.callback, headers: { cookie: flow.cookie } });
  const signIn = async () => { const flow = await begin(); const response = await finish(flow); expect(response.headers.location).toBe('/'); return { ...flow, response, authenticated: cookieOf(response) }; };
  const session = (cookie: string) => app.inject({ method: 'GET', url: '/api/session', headers: { cookie } });
  const members = () => database.prepare('SELECT * FROM members ORDER BY id').all();
  const count = () => (database.prepare('SELECT count(*) AS n FROM sessions WHERE member_id IS NOT NULL').get() as { n: number }).n;

  it('trusted system Viewer overrides ownership and grants, including existing sessions', async () => {
    const flow = await begin('/', 'viewer'); const first = await finish(flow); const oldCookie = cookieOf(first);
    const actor = (await session(oldCookie)).json();
    const headers = { cookie: oldCookie, origin: env.DALI_ORIGIN!, 'x-dali-account': actor.accountId, 'x-dali-request': '1' };
    const created = await app.inject({ method: 'POST', url: '/api/boards', headers, payload: { title: 'Previously owned', operationId: '11111111-1111-4111-8111-111111111111' } });
    expect(created.statusCode).toBe(201); const board = created.json();
    await app.close();
    app = await buildApp({ config: { ...env, DALI_ROLE_CLAIM: 'app_role', DALI_EDITOR_VALUES_JSON: '["editor"]' }, database, now: () => clock });
    const restricted = await finish(await begin('/', 'viewer'));
    expect((await session(cookieOf(restricted))).json().systemRole).toBe('viewer');
    expect((await session(oldCookie)).json().systemRole).toBe('viewer');
    const path = '/api/boards/' + board.summary.id;
    const descriptor = (await app.inject({ url: path, headers })).json();
    expect(descriptor.summary.role).toBe('viewer'); expect(descriptor.capabilities).not.toContain('write');
    expect((await app.inject({ url: '/api/boards', headers })).json()[0].role).toBe('viewer');
    const before = database.prepare('SELECT * FROM boards').all();
    expect((await app.inject({ method: 'POST', url: '/api/boards', headers, payload: { title: 'Denied', operationId: '22222222-2222-4222-8222-222222222222' } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'PATCH', url: path, headers, payload: { title: 'Denied', revision: board.revision, operationId: '33333333-3333-4333-8333-333333333333' } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: '/api/imports', headers, payload: { title: 'Denied import', manifest: [], operationId: '44444444-4444-4444-8444-444444444444' } })).statusCode).toBe(403);
    const binary = { ...headers, 'content-type': 'application/octet-stream' };
    expect((await app.inject({ method: 'POST', url: path + '/docs/' + board.contentDocId + '/pull', headers: binary, payload: Buffer.from([0]) })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: path + '/docs/' + board.contentDocId + '/push', headers: binary, payload: Buffer.from([0, 0]) })).statusCode).toBe(403);
    expect((await app.inject({ url: path + '/editable-export', headers })).statusCode).toBe(403);
    expect(database.prepare('SELECT * FROM boards').all()).toEqual(before);
    // A missing or unrecognized configured role is read-only, never elevated.
    provider.setFaults({ omitClaims: ['app_role'] }); const unknown = await finish(await begin('/', 'editor'));
    expect((await session(cookieOf(unknown))).json().systemRole).toBe('viewer');
    provider.setFaults({}); const writer = await finish(await begin('/', 'editor'));
    expect((await session(cookieOf(writer))).json().systemRole).toBe('member');
  });

  it('external fixture with a verified accepted-domain email cannot enter the system', async () => {
    const before = members();
    const flow = await begin('/', 'external');
    const response = await finish(flow);
    expect(response.headers.location).toBe('/?authError=signin');
    expect((await session(cookieOf(response) || flow.cookie)).statusCode).toBe(401);
    expect((await app.inject({ url: '/api/boards', headers: { cookie: flow.cookie } })).statusCode).toBe(401);
    expect(count()).toBe(0); expect(members()).toEqual(before);
  });

  it('@NYQ-01 a valid signature with an unpublished kid rejects identity mutation and callback replay', async () => {
    const keys = provider.keyControls!; const knownKid = keys.currentKid();
    const valid = await signIn(); const validSession = (await session(valid.authenticated)).json();
    expect(keys.requests()).toEqual([[knownKid]]);
    const authenticated = () => database.prepare('SELECT * FROM sessions WHERE member_id IS NOT NULL ORDER BY id').all();
    const before = { members: members(), sessions: authenticated() };
    const unknownKid = 'unpublished-' + randomBytes(16).toString('hex');
    provider.setFaults({ kid: unknownKid }); const flow = await begin(); const rejected = await finish(flow);
    const token = issuedTokens.at(-1)!; const [header, payload, signature] = token.split('.');
    expect(JSON.parse(Buffer.from(header!, 'base64url').toString()).kid).toBe(unknownKid);
    expect(verify('RSA-SHA256', Buffer.from(header + '.' + payload), createPublicKey({ key: keys.publicJwk(knownKid), format: 'jwk' }), Buffer.from(signature!, 'base64url'))).toBe(true);
    expect(keys.requests().flat()).not.toContain(unknownKid);
    for (const response of [rejected, await finish(flow)]) {
      expect(response.headers.location).toBe('/?authError=signin');
      expect(response.body).not.toContain('owner@example.org'); expect(response.body).not.toContain(env.DALI_OIDC_CLIENT_SECRET);
      expect((await session(flow.cookie)).statusCode).toBe(401);
      expect({ members: members(), sessions: authenticated() }).toEqual(before);
    }
    expect((await session(valid.authenticated)).json()).toEqual(validSession);
    provider.setFaults({}); expect((await session((await signIn()).authenticated)).json().accountId).toBe(validSession.accountId);
  });

  it('@NYQ-01 newly published signing key refreshes cached JWKS in the same running application', async () => {
    const keys = provider.keyControls!; const initialKid = keys.currentKid(); const issuer = provider.issuer; const runningApp = app;
    const first = await signIn(); const initial = (await session(first.authenticated)).json(); const originalMembers = members();
    expect(keys.requests()).toEqual([[initialKid]]); expect(count()).toBe(1);
    const nextKid = keys.createKey(); expect(nextKid).not.toBe(initialKid);
    expect(keys.requests().flat()).not.toContain(nextKid); keys.publish([initialKid, nextKid]); keys.signWith(nextKid);
    // Pinned oauth4webapi refreshes an unknown kid after 60s; ordinary cache expiry is 300s.
    // Advance Date.now only. Provider/app clocks agree; actual timers and HTTP remain real.
    clock += 61_000;
    expect(initial.expiresAt).toBeGreaterThan(clock); expect((await session(first.authenticated)).json()).toEqual(initial);
    const second = await signIn(); const current = (await session(second.authenticated)).json();
    expect(app).toBe(runningApp); expect(provider.issuer).toBe(issuer);
    expect(keys.requests()).toEqual([[initialKid], [initialKid, nextKid]]);
    const [header, payload] = issuedTokens.at(-1)!.split('.');
    expect(JSON.parse(Buffer.from(header!, 'base64url').toString()).kid).toBe(nextKid);
    expect(JSON.parse(Buffer.from(payload!, 'base64url').toString())).toMatchObject({ iat: Math.floor(clock / 1000), exp: Math.floor(clock / 1000) + 300 });
    expect(current).toEqual({ ...initial, expiresAt: clock + 86400000 }); expect(current.expiresAt - initial.expiresAt).toBe(61000);
    expect(second.authenticated).not.toBe(second.cookie); expect(second.authenticated).not.toBe(first.authenticated);
    expect((await session(second.cookie)).statusCode).toBe(401); expect((await session(first.authenticated)).json()).toEqual(initial);
    expect(members()).toEqual(originalMembers);
    const rows = database.prepare('SELECT id,member_id,expires_at FROM sessions WHERE member_id IS NOT NULL ORDER BY expires_at').all() as { id: string; member_id: string; expires_at: number }[];
    expect(rows).toHaveLength(2); expect(new Set(rows.map(row => row.id)).size).toBe(2);
    expect(rows.map(({ member_id, expires_at }) => ({ member_id, expires_at }))).toEqual([
      { member_id: initial.accountId, expires_at: initial.expiresAt }, { member_id: initial.accountId, expires_at: current.expiresAt },
    ]);
    expect((await finish(second)).headers.location).toBe('/?authError=signin'); expect(count()).toBe(2);
    expect(members()).toEqual(originalMembers);
  });

  it('production rejects ambient test-auth enablement', async () => {
    vi.stubEnv('DALI_TEST_AUTH', 'true');
    let rejected = false;
    try { const invalid = await buildApp({ config: { ...env, NODE_ENV: 'production' }, database }); await invalid.close(); }
    catch (error) { rejected = error instanceof Error && error.message === 'Test authentication is forbidden'; }
    expect(rejected, 'production startup rejects ambient authentication switches').toBe(true);
  });
  it('signed code+PKCE rotates persistent cookie and exposes only minimal identity', async () => {
    const flow = await signIn(); expect(flow.authenticated).not.toBe(flow.cookie);
    const result = await session(flow.authenticated);
    expect(result.statusCode).toBe(200); expect(result.headers['cache-control']).toBe('private, no-store');
    expect(result.json()).toEqual({ accountId: expect.any(String), email: 'owner@example.org', displayName: 'Synthetic Owner', systemRole: 'member', expiresAt: clock + 86400000 });
    const set = String(flow.response.headers['set-cookie']);
    expect(set).toContain('HttpOnly'); expect(set).toContain('SameSite=Lax'); expect(set).toContain('Path=/'); expect(set).toContain('Expires='); expect(set).not.toContain('Domain=');
    expect((await session(flow.cookie)).statusCode).toBe(401);
    expect((await finish(flow)).headers.location).toBe('/?authError=signin'); expect(count()).toBe(1);
  });
  const faults: [string, ProviderFaults][] = [
    ['issuer', { issuer: 'https://foreign.example.org' }], ['audience', { audience: 'foreign-client' }],
    ['signature', { signature: true }], ['nonce', { nonce: 'other-nonce' }], ['state', { state: 'other-state' }],
    ['expired token', { clockOffsetSeconds: -3600 }], ['missing issuer', { omitClaims: ['iss'] }],
    ['missing subject', { omitClaims: ['sub'] }], ['missing nonce', { omitClaims: ['nonce'] }],
    ['missing expiration', { omitClaims: ['exp'] }], ['missing membership', { omitClaims: ['membership'] }],
    ['external membership', { claims: { membership: 'external' } }], ['missing email', { omitClaims: ['email'] }],
    ['unverified email', { claims: { email_verified: false } }], ['string verified', { claims: { email_verified: 'true' } }],
    ['missing verification', { omitClaims: ['email_verified'] }], ['external email', { claims: { email: 'owner@external.example.net' } }],
    ['missing display name', { omitClaims: ['name'] }], ['UserInfo subject', { userInfoSubject: 'other-subject' }],
  ];
  it.each(faults)('AUTH-01 empty rejects %s without session or identity mutation', async (_label, fault) => {
    await signIn(); const before = members(); const sessionCount = count();
    provider.setFaults(fault); const flow = await begin(); const response = await finish(flow);
    expect(response.headers.location).toBe('/?authError=signin');
    expect((await session(flow.cookie)).statusCode).toBe(401);
    expect(count()).toBe(sessionCount); expect(members()).toEqual(before);
    expect(response.body).not.toContain('owner@example.org'); expect(response.body).not.toContain(env.DALI_OIDC_CLIENT_SECRET);
    expect((await finish(flow)).headers.location).toBe('/?authError=signin');
  });
  it.each(['state', 'code'])('missing %s consumes the transaction and rejects replay', async field => {
    const flow = await begin(); const url = new URL(flow.callback, env.DALI_ORIGIN); url.searchParams.delete(field);
    expect((await finish({ ...flow, callback: url.pathname + url.search })).headers.location).toBe('/?authError=signin');
    expect((await finish(flow)).headers.location).toBe('/?authError=signin'); expect(count()).toBe(0); expect(members()).toEqual([]);
  });
  it('browser-bound transaction denies another cookie jar and incorrect PKCE', async () => {
    const flow = await begin(); const other = await begin();
    expect((await finish({ ...flow, cookie: other.cookie })).headers.location).toBe('/?authError=signin');
    database.prepare('UPDATE login_transactions SET verifier=? WHERE state=?').run('a'.repeat(43), new URL(flow.callback, env.DALI_ORIGIN).searchParams.get('state'));
    expect((await finish(flow)).headers.location).toBe('/?authError=signin'); expect(count()).toBe(0); expect(members()).toEqual([]);
  });
  it('expired transaction denies at its exact millisecond boundary', async () => {
    const flow = await begin(); clock += 600000;
    expect((await finish(flow)).headers.location).toBe('/?authError=signin'); expect(count()).toBe(0); expect(members()).toEqual([]);
  });
  it('concurrent callback replay creates exactly one session', async () => {
    const flow = await begin(); const results = await Promise.all([finish(flow), finish(flow)]);
    expect(results.map(r => r.headers.location).sort()).toEqual(['/', '/?authError=signin']); expect(count()).toBe(1); expect(members()).toHaveLength(1);
  });
  it('AUTH-01 encoding preserves issuer+subject identity across metadata changes and separates reused email', async () => {
    const first = (await session((await signIn()).authenticated)).json();
    provider.setFaults({ claims: { email: 'Changed+Alias@EXAMPLE.ORG', name: 'Changed Name' } });
    const updated = (await session((await signIn()).authenticated)).json(); expect(updated.accountId).toBe(first.accountId); expect(updated.email).toBe('Changed+Alias@EXAMPLE.ORG');
    provider.setFaults({ claims: { sub: 'different-subject', email: 'Changed+Alias@EXAMPLE.ORG' } });
    const separate = (await session((await signIn()).authenticated)).json(); expect(separate.accountId).not.toBe(first.accountId);
    expect(members()).toHaveLength(2);
  });
  it.each([-1, 0, 1])('AUTH-01 precision session at expiry %+d milliseconds fails closed at boundary', async offset => {
    const flow = await signIn(); const expiry = (await session(flow.authenticated)).json().expiresAt;
    clock = expiry + offset; expect((await session(flow.authenticated)).statusCode).toBe(offset < 0 ? 200 : 401);
  });
  it('persistent SQL session survives a new app instance without rolling expiry', async () => {
    const flow = await signIn(); const before = (await session(flow.authenticated)).json();
    await app.close(); database.close(); database = openDatabase(env.DALI_DATABASE_PATH!);
    clock += 1000; app = await buildApp({ config: env, database, now: () => clock });
    const restored = await session(flow.authenticated); expect(restored.json()).toEqual(before); expect(restored.headers['set-cookie']).toBeUndefined();
  });
  it.each(['0', '-1', 'NaN', 'Infinity', '1.5', '9007199254740992', '2678400001'])('AUTH-01 precision rejects invalid lifetime %s', async value => {
    expect(() => readConfig({ ...env, DALI_SESSION_TTL_MS: value })).toThrow();
  });
  it('AUTH-01 precision rejects invalid clocks and overflowing time arithmetic', () => {
    for (const now of [NaN, Infinity, -1, 1.5, Number.MAX_SAFE_INTEGER, 8640000000000000]) expect(() => expiresAt(now, 1000)).toThrow();
    expect(expiresAt(clock, 1)).toBe(clock + 1);
  });
  it.each(['DALI_OIDC_ISSUER', 'DALI_INTERNAL_CLAIM', 'DALI_INTERNAL_VALUES_JSON', 'DALI_INTERNAL_EMAIL_DOMAINS_JSON', 'DALI_SESSION_SECRET'])('AUTH-01 empty incomplete %s gives a recoverable secret-free error', async key => {
    const invalid = await buildApp({ config: { ...env, [key]: '' } });
    try { const response = await invalid.inject('/api/session'); expect(response.statusCode).toBe(503); expect(response.json()).toEqual({ code: 'AUTH_CONFIGURATION' });
      expect((await invalid.inject('/auth/start')).headers.location).toBe('/?authError=configuration'); }
    finally { await invalid.close(); }
  });
  it('missing configuration fails closed and can recover on valid startup', async () => {
    const invalid = await buildApp({ config: {} });
    try { expect((await invalid.inject('/api/session')).statusCode).toBe(503); } finally { await invalid.close(); }
    expect((await session((await signIn()).authenticated)).statusCode).toBe(200);
  });
  it('AUTH-01 idempotency exact-origin local logout denies forgery and stale account, then remains harmless', async () => {
    const flow = await signIn(); const account = (await session(flow.authenticated)).json(); const before = members();
    const headers = { cookie: flow.authenticated, origin: env.DALI_ORIGIN!, 'x-dali-request': '1', 'x-dali-account': account.accountId, 'content-type': 'application/json' };
    for (const change of [{ origin: 'https://foreign.example.org' }, { 'x-dali-request': '' }, { 'content-type': 'text/plain' }, { 'x-dali-account': 'stale-account' }]) {
      const response = await app.inject({ method: 'POST', url: '/api/logout', headers: { ...headers, ...change }, payload: '{}' });
      expect([403, 409]).toContain(response.statusCode); expect((await session(flow.authenticated)).statusCode).toBe(200); expect(members()).toEqual(before);
    }
    expect((await app.inject({ method: 'GET', url: '/api/session', headers: { cookie: flow.authenticated, 'x-dali-account': 'stale-account' } })).statusCode).toBe(409);
    for (let i = 0; i < 2; i++) expect((await app.inject({ method: 'POST', url: '/api/logout', headers, payload: '{}' })).statusCode).toBe(204);
    expect((await session(flow.authenticated)).statusCode).toBe(401); expect(members()).toEqual(before);
  });
  it.each(['/?board=synthetic-board', '/?new=1', '//foreign.example.org', 'https://foreign.example.org', '/?board=../secret', '/?signedOut=1'])('D-01 retains only validated local intent %s', async value => {
    const flow = await begin(value); expect((await finish(flow)).headers.location).toBe(localReturnIntent(value));
    if (value === '/?board=synthetic-board' || value === '/?new=1') expect(localReturnIntent(value)).toBe(value);
    else expect(localReturnIntent(value)).toBe('/');
  });
  it('@03-06-02 retains a bounded new operation identity through signed login', async () => {
    const target = '/?new=1&operationId=synthetic-operation_123';
    expect(localReturnIntent(target)).toBe(target);
    const flow = await begin(target); expect((await finish(flow)).headers.location).toBe(target);
    for (const value of ['../foreign', 'x'.repeat(129), '', 'space here']) expect(localReturnIntent('/?new=1&operationId=' + encodeURIComponent(value))).toBe('/');
  });
  it('production configuration requires HTTPS, bounded policy and registers no fixture route', async () => {
    expect(() => readConfig({ ...env, NODE_ENV: 'production' })).toThrow();
    expect(() => readConfig({ ...env, DALI_INTERNAL_VALUES_JSON: '[]' })).toThrow();
    expect(() => readConfig({ ...env, DALI_OIDC_CALLBACK_URL: 'https://foreign.example.org/auth/callback' })).toThrow();
    for (const path of ['/auth/test', '/api/test/login', '/auth/fixture']) expect((await app.inject(path)).statusCode).toBe(404);
    await expect(buildApp({ config: { ...env, DALI_TEST_AUTH: 'true' }, database })).rejects.toThrow();
    const production = await buildApp({ config: { ...env, NODE_ENV: 'production',
      DALI_ORIGIN: 'https://app.example.org', DALI_OIDC_CALLBACK_URL: 'https://app.example.org/auth/callback', DALI_OIDC_ISSUER: 'https://identity.example.org' }, database });
    try {
      for (const path of ['/auth/test', '/api/test/login', '/auth/fixture']) expect((await production.inject(path)).statusCode).toBe(404);
      expect((await production.inject('/api/session')).statusCode).toBe(401);
    } finally { await production.close(); }
  });
  it('HTTPS origin issues Secure host-only persistent cookies', async () => {
    const secure = await buildApp({ config: { ...env, DALI_ORIGIN: 'https://app.example.org',
      DALI_OIDC_CALLBACK_URL: 'https://app.example.org/auth/callback' }, database });
    try {
      const response = await secure.inject('/auth/start'); expect(response.statusCode).toBe(302);
      expect(String(response.headers['set-cookie'])).toContain('Secure'); expect(String(response.headers['set-cookie'])).not.toContain('Domain=');
      expect(String(response.headers['set-cookie'])).toContain('HttpOnly'); expect(String(response.headers['set-cookie'])).toContain('SameSite=Lax');
    } finally { await secure.close(); }
  });
  it('identical subject from another trusted issuer retains a separate member key', async () => {
    const first = (await session((await signIn()).authenticated)).json(); expect(first.accountId).toEqual(expect.any(String));
    const second = await createOidcProvider({ clients: [{ clientId: env.DALI_OIDC_CLIENT_ID!, clientSecret: env.DALI_OIDC_CLIENT_SECRET!, redirectUri: env.DALI_OIDC_CALLBACK_URL! }] });
    try {
      await app.close(); app = await buildApp({ config: { ...env, DALI_OIDC_ISSUER: second.issuer }, database, now: () => clock });
      const other = (await session((await signIn()).authenticated)).json(); expect(other.accountId).not.toBe(first.accountId);
      expect(other.email).toBe(first.email); expect(members()).toHaveLength(2);
    } finally { await second.close(); }
  });
  it('malformed operator values never appear in configuration errors', () => {
    for (const setting of [{ DALI_OIDC_ISSUER: 'synthetic-private-value' }, { DALI_INTERNAL_VALUES_JSON: 'synthetic-private-value' }]) {
      expect(() => readConfig({ ...env, ...setting })).toThrow('Authentication configuration unavailable');
      try { readConfig({ ...env, ...setting }); } catch (error) { expect(String(error)).not.toContain('synthetic-private-value'); }
    }
  });
  it('migrations are idempotent and failed additive migration rolls back its table and ledger', () => {
    const ledger = database.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as { version: number }[];
    expect(ledger).toContainEqual({ version: 1 });
    runMigrations(database); expect(database.prepare('SELECT version FROM schema_migrations ORDER BY version').all()).toEqual(ledger);
    const nextVersion = Math.max(...ledger.map(row => row.version)) + 1;
    expect(() => runMigrations(database, [{ version: nextVersion, sql: 'CREATE TABLE synthetic_probe(id TEXT); INSERT INTO missing_table VALUES(1)' }])).toThrow();
    expect(database.prepare("SELECT name FROM sqlite_master WHERE name='synthetic_probe'").get()).toBeUndefined();
    expect(database.prepare('SELECT version FROM schema_migrations ORDER BY version').all()).toEqual(ledger);
  });
});
