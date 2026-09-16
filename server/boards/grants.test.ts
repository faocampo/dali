import { afterEach, beforeEach, expect, it } from 'vitest';
import { randomBytes, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { openDatabase, type AccountDatabase } from '../storage/database.js';
import { createOidcProvider, IDENTITY_COOKIE, type IdentityName } from '../../tests/oidc-provider.js';

let app: FastifyInstance; let database: AccountDatabase; let provider: Awaited<ReturnType<typeof createOidcProvider>>;
let barrier: () => Promise<void>; let clock: number; let board: string;
const origin = 'http://127.0.0.1:5499';
const actors: Record<string, { cookie: string; accountId: string }> = {};
const cookieOf = (response: { headers: Record<string, unknown> }) => { const cookies = response.headers['set-cookie']; return (Array.isArray(cookies) ? cookies.at(-1) : cookies)?.split(';')[0] as string; };
const headers = (actor = 'owner') => ({ cookie: actors[actor]!.cookie, 'x-dali-account': actors[actor]!.accountId, 'x-dali-request': '1', origin });
async function login(identity: IdentityName) {
  const start = await app.inject('/auth/start');
  const authorize = await fetch(start.headers.location!, { redirect: 'manual', headers: { cookie: `${IDENTITY_COOKIE}=${identity}` } });
  const callback = new URL(authorize.headers.get('location')!);
  const response = await app.inject({ url: callback.pathname + callback.search, headers: { cookie: cookieOf(start) } });
  const cookie = cookieOf(response); const session = await app.inject({ url: '/api/session', headers: { cookie } });
  if (session.statusCode === 200) actors[identity] = { cookie, accountId: session.json().accountId };
  return session;
}
const grants = () => app.inject({ url: `/api/boards/${board}/grants`, headers: headers() });
const mutate = (method: 'POST' | 'PATCH' | 'DELETE', body: object, id = '', actor = 'owner') => app.inject({ method, url: `/api/boards/${board}/grants` + (id ? '/' + id : ''), headers: headers(actor), payload: { operationId: randomUUID(), ...body } });
beforeEach(async () => {
  clock = Date.now(); barrier = async () => {};
  const registration = { clientId: 'synthetic-grants', clientSecret: randomBytes(32).toString('hex'), redirectUri: origin + '/auth/callback' };
  provider = await createOidcProvider({ clients: [registration] }); database = openDatabase(':memory:');
  app = await buildApp({ database, now: () => clock, beforeCommit: () => barrier(), config: {
    DALI_ORIGIN: origin, DALI_DATABASE_PATH: ':memory:', DALI_SESSION_SECRET: randomBytes(32).toString('hex'), DALI_SESSION_TTL_MS: '86400000',
    DALI_OIDC_ISSUER: provider.issuer, DALI_OIDC_CLIENT_ID: registration.clientId, DALI_OIDC_CLIENT_SECRET: registration.clientSecret,
    DALI_OIDC_CALLBACK_URL: registration.redirectUri, DALI_INTERNAL_CLAIM: 'membership', DALI_INTERNAL_VALUES_JSON: '["internal"]', DALI_INTERNAL_EMAIL_DOMAINS_JSON: '["example.org","xn--bcher-kva.example"]',
  } });
  expect((await login('owner')).statusCode).toBe(200);
  const created = await app.inject({ method: 'POST', url: '/api/boards', headers: headers(), payload: { operationId: randomUUID(), title: 'Synthetic sharing' } });
  expect(created.statusCode).toBe(201); board = created.json().summary.id;
});
afterEach(async () => { await app?.close(); database?.close(); await provider?.close(); });

it('@03-07-02 trusted first sign-in activates pending Viewer exactly once', async () => {
  expect((await mutate('POST', { email: 'editor@example.org', revision: 1 })).statusCode).toBe(200);
  expect((await login('editor')).statusCode).toBe(200);
  const state = (await grants()).json();
  expect(state.grants).toHaveLength(1); expect(state.grants[0]).toMatchObject({ memberId: actors.editor!.accountId, status: 'active', role: 'viewer' });
  expect(database.prepare('SELECT * FROM pending_grants').all()).toEqual([]);
  await login('editor'); expect((await grants()).json()).toEqual(state);
});

it('@03-07-02 revoked pending access remains absent at first sign-in', async () => {
  const state = (await mutate('POST', { email: 'editor@example.org', revision: 1 })).json(); const row = state.grants[0];
  expect((await mutate('DELETE', { revision: row.revision }, row.id)).statusCode).toBe(200);
  await login('editor'); expect((await grants()).json().grants).toEqual([]);
  expect((await app.inject({ url: `/api/boards/${board}`, headers: headers('editor') })).statusCode).toBe(404);
});

it.each([{ email_verified: false }, { email_verified: null }, { membership: 'external' }])('@03-07-02 untrusted claims %j do not activate', async claims => {
  await mutate('POST', { email: 'editor@example.org', revision: 1 }); const before = (await grants()).json();
  provider.setFaults({ claims }); expect((await login('editor')).statusCode).toBe(401);
  expect((await grants()).json()).toEqual(before);
});

it('@03-07-02 two subjects and observed recycled email remain ambiguous; active grants retain member binding', async () => {
  await login('editor'); const original = actors.editor!.accountId;
  await mutate('POST', { memberId: original, revision: 1, role: 'editor' });
  provider.setFaults({ claims: { email: 'changed@example.org' } }); await login('editor');
  expect(actors.editor!.accountId).toBe(original);
  const active = (await grants()).json(); expect(active.grants[0]).toMatchObject({ memberId: original, role: 'editor', email: 'changed@example.org' });
  await mutate('POST', { email: 'editor@example.org', revision: active.revision });
  provider.setFaults({ claims: { email: 'editor@example.org' } }); await login('viewer');
  const state = (await grants()).json();
  expect(state.grants.find((row: { status: string }) => row.status === 'pending')).toMatchObject({ email: 'editor@example.org', status: 'pending' });
  expect((await app.inject({ url: `/api/boards/${board}`, headers: headers('viewer') })).statusCode).toBe(404);
  expect((await app.inject({ url: `/api/boards/${board}`, headers: headers('editor') })).statusCode).toBe(200);
});

it('@03-07-02 local-part case and IDNA domain policy match exactly', async () => {
  const state = (await mutate('POST', { email: 'Editor@BÜCHER.example', revision: 1 })).json();
  expect(state.grants[0].email).toBe('Editor@xn--bcher-kva.example');
  provider.setFaults({ claims: { email: 'editor@bücher.example' } }); await login('editor');
  expect((await grants()).json().grants[0].status).toBe('pending');
  provider.setFaults({ claims: { email: 'Editor@bücher.example' } }); expect((await login('editor')).statusCode).toBe(200);
  expect((await grants()).json().grants[0].status).toBe('active');
});

it('@03-07-02 stale update after revoke and recreate cannot restore an old grant', async () => {
  const state = (await mutate('POST', { email: 'waiting@example.org', revision: 1 })).json(); const row = state.grants[0];
  const operationId = randomUUID();
  const removed = await mutate('DELETE', { revision: row.revision, operationId }, row.id); expect(removed.statusCode).toBe(200);
  expect((await mutate('DELETE', { revision: row.revision, operationId }, row.id)).json()).toEqual(removed.json());
  const next = await mutate('POST', { revision: removed.json().revision, email: 'waiting@example.org' }); expect(next.statusCode).toBe(200);
  expect((await mutate('PATCH', { revision: row.revision, role: 'editor' }, row.id)).statusCode).toBe(409);
  expect((await grants()).json()).toEqual(next.json());
});

it.each(['expiry', 'owner', 'identity'])('@03-07-02 commit-time %s race denies with unchanged grants', async race => {
  await login('editor'); const before = (await grants()).json().grants;
  barrier = async () => {
    if (race === 'expiry') clock += 86400000;
    if (race === 'owner') database.prepare('UPDATE boards SET owner_id=? WHERE id=?').run(actors.editor!.accountId, board);
    if (race === 'identity') database.prepare('DELETE FROM sessions WHERE member_id=?').run(actors.owner!.accountId);
  };
  const response = await mutate('POST', { email: 'waiting@example.org', revision: 1 }); expect([401, 404, 409]).toContain(response.statusCode);
  expect(database.prepare('SELECT * FROM pending_grants').all()).toEqual(before);
  expect(database.prepare("SELECT * FROM operations WHERE kind LIKE '%grant%'").all()).toEqual([]);
});
