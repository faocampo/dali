/** Synthetic signed OIDC for tests/local development. Production entrypoints must never import this module. */
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import Fastify, { type FastifyInstance, type FastifyReply } from 'fastify';
import cookie from '@fastify/cookie';
import * as oidc from 'openid-client';
import { testOrigin, testPort } from './test-ports.js';

export const PROVIDER_PORT = testPort(5496);
export const IDENTITY_COOKIE = 'dali_fixture_identity';
export const identities = {
  owner: { sub: 'synthetic-owner', name: 'Synthetic Owner', email: 'owner@example.org', membership: 'internal', app_role: 'editor' },
  editor: { sub: 'synthetic-editor', name: 'Synthetic Editor', email: 'editor@example.org', membership: 'internal', app_role: 'editor' },
  viewer: { sub: 'synthetic-viewer', name: 'Synthetic Viewer', email: 'viewer@example.org', membership: 'internal', app_role: 'viewer' },
  // This internal member has no grants on other members' test boards.
  nonMember: { sub: 'synthetic-non-member', name: 'Synthetic Internal Member', email: 'non-member@example.org', membership: 'internal', app_role: 'editor' },
  // A verified email on the accepted domain alone must never admit this account.
  external: { sub: 'synthetic-external', name: 'Synthetic External Account', email: 'external@example.org', membership: 'external' },
} as const;
export type IdentityName = keyof typeof identities;
export type ProviderFaults = {
  issuer?: string; audience?: string; signature?: boolean; nonce?: string;
  state?: string; omitClaims?: string[]; claims?: Record<string, unknown>;
  clockOffsetSeconds?: number; userInfoSubject?: string; kid?: string;
};
export type ClientRegistration = { clientId: string; clientSecret: string; redirectUri: string };
type Code = {
  client: ClientRegistration; challenge: string; nonce: string; identity: IdentityName;
  expiresAt: number; faults: ProviderFaults; signingKid: string;
};
const opaque = () => randomBytes(32).toString('base64url');
const escaped = (value: string) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');

export async function createOidcProvider(options: {
  port?: number; clients: ClientRegistration[]; now?: () => number;
  signingKeyControls?: true; onIdToken?: (token: string) => void;
  signInPage?: { title: string; notice: string };
}) {
  const now = options.now ?? Date.now;
  const app = Fastify({ logger: false, bodyLimit: 16_384 });
  await app.register(cookie);
  app.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (_request, body, done) => {
    done(null, new URLSearchParams(body as string));
  });
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const wrongKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  const kid = opaque();
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid, use: 'sig', alg: 'RS256' };
  // Opt-in protocol probes keep the ordinary provider's single-key behavior.
  const signingKeys = new Map([[kid, { privateKey, jwk }]]);
  let signingKid = kid; let publishedKids = [kid];
  const jwksRequests: string[][] = [];
  const keyControls = options.signingKeyControls ? {
    currentKid: () => signingKid,
    createKey() {
      const pair = generateKeyPairSync('rsa', { modulusLength: 2048 }); const next = opaque();
      signingKeys.set(next, { privateKey: pair.privateKey, jwk: { ...pair.publicKey.export({ format: 'jwk' }), kid: next, use: 'sig', alg: 'RS256' } });
      return next;
    },
    publish(kids: readonly string[]) {
      assert(kids.length > 0 && new Set(kids).size === kids.length && kids.every(id => signingKeys.has(id)));
      publishedKids = [...kids];
    },
    signWith(id: string) { assert(signingKeys.has(id)); signingKid = id; },
    publicJwk(id: string) { assert(signingKeys.has(id)); return structuredClone(signingKeys.get(id)!.jwk); },
    requests: () => structuredClone(jwksRequests),
  } : undefined;
  const codes = new Map<string, Code>();
  const tokens = new Map<string, { claims: Record<string, unknown>; expiresAt: number }>();
  let faults: ProviderFaults = {};
  let issuer = '';
  const reject = (reply: FastifyReply) => reply.code(400).send({ error: 'invalid_request' });
  app.addHook('onRequest', async (_request, reply) => { reply.header('Cache-Control', 'no-store'); });
  app.get('/health', async () => ({ status: 'ready' }));
  app.get('/.well-known/openid-configuration', async () => ({
    issuer, authorization_endpoint: `${issuer}/authorize`, token_endpoint: `${issuer}/token`,
    jwks_uri: `${issuer}/jwks`, userinfo_endpoint: `${issuer}/userinfo`,
    response_types_supported: ['code'], grant_types_supported: ['authorization_code'],
    subject_types_supported: ['public'], id_token_signing_alg_values_supported: ['RS256'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
    code_challenge_methods_supported: ['S256'], scopes_supported: ['openid', 'profile', 'email'],
    authorization_response_iss_parameter_supported: true,
  }));
  app.get('/jwks', async () => {
    if (keyControls) jwksRequests.push([...publishedKids]);
    return { keys: publishedKids.map(id => signingKeys.get(id)!.jwk) };
  });
  app.get('/authorize', async (request, reply) => {
    const url = new URL(request.url, issuer);
    const p = url.searchParams;
    const client = options.clients.find(c => c.clientId === p.get('client_id') && c.redirectUri === p.get('redirect_uri'));
    if (!client || p.get('response_type') !== 'code' || !p.get('scope')?.split(' ').includes('openid') ||
        p.get('code_challenge_method') !== 'S256' || !/^[\w-]{43}$/.test(p.get('code_challenge') ?? '') ||
        !p.get('state') || !p.get('nonce')) return reject(reply);
    const selected = p.get('fixture_identity') ?? request.cookies[IDENTITY_COOKIE];
    if (!selected || !Object.hasOwn(identities, selected)) {
      const links = Object.entries(identities).map(([name, identity]) => {
        const target = new URL(url); target.searchParams.set('fixture_identity', name);
        return `<p><a href="${escaped(target.pathname + target.search)}">${identity.name}</a></p>`;
      }).join('');
      const title = escaped(options.signInPage?.title ?? 'Synthetic sign-in');
      const notice = options.signInPage ? `<p>${escaped(options.signInPage.notice)}</p>` : '';
      return reply.type('text/html; charset=utf-8').send(`<!doctype html><html lang="en"><meta charset="utf-8"><title>${title}</title><h1>Choose a synthetic account</h1>${notice}${links}</html>`);
    }
    // A denied external demo must let the next attempt choose an eligible account.
    if (identities[selected as IdentityName].membership === 'internal') {
      reply.setCookie(IDENTITY_COOKIE, selected, { httpOnly: true, sameSite: 'lax', path: '/' });
    } else reply.clearCookie(IDENTITY_COOKIE, { path: '/' });
    for (const [code, value] of codes) if (value.expiresAt <= now()) codes.delete(code);
    const code = opaque();
    codes.set(code, { client, challenge: p.get('code_challenge')!, nonce: p.get('nonce')!,
      identity: selected as IdentityName, expiresAt: now() + 60_000, faults: structuredClone(faults), signingKid });
    const target = new URL(client.redirectUri);
    target.searchParams.set('code', code); target.searchParams.set('state', faults.state ?? p.get('state')!);
    target.searchParams.set('iss', issuer);
    return reply.redirect(target.href);
  });
  app.post('/token', async (request, reply) => {
    const p = request.body;
    if (!(p instanceof URLSearchParams)) return reject(reply);
    const code = p.get('code') ?? '';
    const record = codes.get(code);
    codes.delete(code); // Consume even on a failed exchange.
    let clientId = p.get('client_id'); let clientSecret = p.get('client_secret');
    if (request.headers.authorization?.startsWith('Basic ')) {
      const basic = Buffer.from(request.headers.authorization.slice(6), 'base64').toString();
      const colon = basic.indexOf(':');
      try { clientId = decodeURIComponent(basic.slice(0, colon)); clientSecret = decodeURIComponent(basic.slice(colon + 1)); }
      catch { return reject(reply); }
    }
    if (!record || record.expiresAt <= now() || p.get('grant_type') !== 'authorization_code' ||
        p.get('redirect_uri') !== record.client.redirectUri || clientId !== record.client.clientId ||
        clientSecret !== record.client.clientSecret || !/^[\w.~\-]{43,128}$/.test(p.get('code_verifier') ?? '') ||
        createHash('sha256').update(p.get('code_verifier')!).digest('base64url') !== record.challenge) {
      return reply.code(400).send({ error: 'invalid_grant' });
    }
    const f = record.faults;
    const seconds = Math.floor(now() / 1000) + (f.clockOffsetSeconds ?? 0);
    const claims: Record<string, unknown> = {
      ...identities[record.identity], email_verified: true,
      iss: f.issuer ?? issuer, aud: f.audience ?? clientId, iat: seconds, exp: seconds + 300,
      nonce: f.nonce ?? record.nonce, ...f.claims,
    };
    for (const claim of f.omitClaims ?? []) delete claims[claim];
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: keyControls ? f.kid ?? record.signingKid : kid })).toString('base64url');
    const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
    const input = `${header}.${payload}`;
    const signature = sign('RSA-SHA256', Buffer.from(input), f.signature ? wrongKey : signingKeys.get(record.signingKid)!.privateKey).toString('base64url');
    const accessToken = opaque();
    tokens.set(accessToken, { claims: { ...claims, sub: f.userInfoSubject ?? claims.sub }, expiresAt: now() + 300_000 });
    const idToken = `${input}.${signature}`;
    if (keyControls) options.onIdToken?.(idToken);
    return { access_token: accessToken, token_type: 'Bearer', expires_in: 300, id_token: idToken };
  });
  app.get('/userinfo', async (request, reply) => {
    const token = request.headers.authorization?.match(/^Bearer (.+)$/)?.[1] ?? '';
    const record = tokens.get(token);
    if (!record || record.expiresAt <= now()) return reply.code(401).send({ error: 'invalid_token' });
    const { sub, name, email, email_verified, membership, app_role } = record.claims;
    return { sub, name, email, email_verified, membership, app_role };
  });
  await app.listen({ host: '127.0.0.1', port: options.port ?? 0 });
  const address = app.server.address();
  assert(address && typeof address !== 'string');
  issuer = `http://127.0.0.1:${address.port}`;
  return {
    app, issuer, now, keyControls,
    setFaults(value: ProviderFaults) { faults = structuredClone(value); },
    async close() { codes.clear(); tokens.clear(); await app.close(); },
  };
}

export async function providerSelfTest() {
  const registration = { clientId: 'synthetic-self-test', clientSecret: opaque(), redirectUri: 'http://127.0.0.1:5498/auth/callback' };
  let clock = Date.now();
  const provider = await createOidcProvider({ clients: [registration], now: () => clock });
  let passed = 0;
  const check = async (name: string, operation: () => Promise<void>) => {
    await operation(); passed++; console.log(`PASS ${name}`);
  };
  try {
    const config = await oidc.discovery(new URL(provider.issuer), registration.clientId, registration.clientSecret, undefined,
      { execute: [oidc.allowInsecureRequests, oidc.enableNonRepudiationChecks] });
    const authorize = async (identity: IdentityName = 'owner') => {
      const verifier = oidc.randomPKCECodeVerifier(); const state = oidc.randomState(); const nonce = oidc.randomNonce();
      const url = oidc.buildAuthorizationUrl(config, { redirect_uri: registration.redirectUri, scope: 'openid profile email',
        code_challenge: await oidc.calculatePKCECodeChallenge(verifier), code_challenge_method: 'S256', state, nonce });
      const response = await fetch(url, { redirect: 'manual', headers: { cookie: `${IDENTITY_COOKIE}=${identity}` } });
      assert.equal(response.status, 302);
      const callback = new URL(response.headers.get('location')!);
      return { callback, verifier, state, nonce };
    };
    const exchange = (t: Awaited<ReturnType<typeof authorize>>) => oidc.authorizationCodeGrant(config, t.callback,
      { pkceCodeVerifier: t.verifier, expectedState: t.state, expectedNonce: t.nonce, idTokenExpected: true });
    await check('discovery, signed exchange, subject-checked UserInfo and one-use code', async () => {
      const t = await authorize(); const token = await exchange(t);
      assert.equal(token.claims()?.sub, identities.owner.sub);
      assert.equal((await oidc.fetchUserInfo(config, token.access_token, identities.owner.sub)).email, identities.owner.email);
      await assert.rejects(exchange(t));
    });
    for (const identity of ['editor', 'viewer', 'nonMember'] as const) {
      await check(`independent ${identity} identity cookie`, async () => {
        assert.equal((await exchange(await authorize(identity))).claims()?.sub, identities[identity].sub);
      });
    }
    for (const [name, fault] of Object.entries({ issuer: { issuer: 'https://wrong.example.org' }, audience: { audience: 'wrong-client' },
      signature: { signature: true }, nonce: { nonce: 'wrong-nonce' }, state: { state: 'wrong-state' },
      expiry: { clockOffsetSeconds: -3600 }, subject: { omitClaims: ['sub'] }, expiration: { omitClaims: ['exp'] },
    } satisfies Record<string, ProviderFaults>)) {
      await check(`reject ${name}`, async () => {
        provider.setFaults(fault); await assert.rejects(exchange(await authorize())); provider.setFaults({});
      });
    }
    await check('reject incorrect PKCE and subsequent replay', async () => {
      const t = await authorize(); await assert.rejects(exchange({ ...t, verifier: oidc.randomPKCECodeVerifier() }));
      await assert.rejects(exchange(t));
    });
    await check('reject expired code at exact injected clock boundary', async () => {
      const t = await authorize(); clock += 60_000; await assert.rejects(exchange(t)); clock -= 60_000;
    });
    await check('reject mismatched UserInfo subject', async () => {
      provider.setFaults({ userInfoSubject: 'other-subject' });
      const token = await exchange(await authorize());
      await assert.rejects(oidc.fetchUserInfo(config, token.access_token, identities.owner.sub)); provider.setFaults({});
    });
    await check('reject unregistered redirect and missing protocol fields', async () => {
      const response = await fetch(`${provider.issuer}/authorize?client_id=${registration.clientId}&redirect_uri=https://foreign.example.org`);
      assert.equal(response.status, 400); assert.equal(response.headers.has('location'), false);
    });
    await check('signed claim controls preserve absent membership for application policy tests', async () => {
      provider.setFaults({ omitClaims: ['membership', 'email_verified'] });
      const token = await exchange(await authorize());
      assert.equal(token.claims()?.membership, undefined); assert.equal(token.claims()?.email_verified, undefined);
    });
    assert.equal(passed, 17); console.log(`OIDC self-test: ${passed} passed, 0 skipped`);
  } finally { await provider.close(); }
}

/** Launcher contract: buildApp receives server-only environment-shaped config and an injected clock. */
export async function startAccessHarness() {
  const directory = await mkdtemp(join(tmpdir(), 'dali-access-'));
  const registrations = [
    { clientId: 'synthetic-dev', clientSecret: opaque(), redirectUri: `${testOrigin(5494)}/auth/callback` },
    { clientId: 'synthetic-preview', clientSecret: opaque(), redirectUri: `${testOrigin(5493)}/auth/callback` },
  ];
  let provider: Awaited<ReturnType<typeof createOidcProvider>> | undefined;
  const apps: FastifyInstance[] = [];
  let offset = 0;
  const now = () => Date.now() + offset;
  const close = async () => {
    await Promise.allSettled(apps.map(app => app.close()));
    await provider?.close(); await rm(directory, { recursive: true, force: true });
  };
  try {
    provider = await createOidcProvider({ port: PROVIDER_PORT, clients: registrations, now });
    // Lazy URL import intentionally allows the protocol self-test before plan 02 creates the application.
    const appModuleUrl = new URL('../server/app.js', import.meta.url).href;
    const { buildApp } = await import(appModuleUrl) as {
      buildApp(options: { storagePolicy: { kind: 'fixture' }; config: Record<string, string>; now: () => number }): Promise<FastifyInstance>;
    };
    for (const [index, registration] of registrations.entries()) {
      const origin = new URL(registration.redirectUri).origin;
      const app = await buildApp({ storagePolicy: { kind: 'fixture' }, now, config: {
        DALI_ORIGIN: origin, DALI_DATABASE_PATH: join(directory, `app-${index}.sqlite`),
        DALI_SESSION_SECRET: opaque(), DALI_SESSION_TTL_MS: '86400000',
        DALI_OIDC_ISSUER: provider.issuer, DALI_OIDC_CLIENT_ID: registration.clientId,
        DALI_OIDC_CLIENT_SECRET: registration.clientSecret, DALI_OIDC_CALLBACK_URL: registration.redirectUri,
        DALI_INTERNAL_CLAIM: 'membership', DALI_INTERNAL_VALUES_JSON: '["internal"]',
        DALI_INTERNAL_EMAIL_DOMAINS_JSON: '["example.org"]', DALI_EMAIL_CASE_FOLD: 'false',
      } });
      apps.push(app); await app.listen({ host: '127.0.0.1', port: testPort(index === 0 ? 5495 : 5497) });
    }
    return { provider, apps, now, advanceClock(milliseconds: number) {
      assert(Number.isSafeInteger(milliseconds)); assert(Number.isSafeInteger(offset + milliseconds)); offset += milliseconds;
    }, close };
  } catch (error) { await close(); throw error; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--self-test')) await providerSelfTest();
  else if (process.argv.includes('--serve-access')) {
    const harness = await startAccessHarness();
    let closing = false;
    const close = async () => { if (closing) return; closing = true; await harness.close(); };
    process.once('SIGINT', () => { void close(); }); process.once('SIGTERM', () => { void close(); });
    console.log('Synthetic access services ready');
  } else throw new Error('Use --self-test or --serve-access');
}
