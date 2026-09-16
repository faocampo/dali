import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import * as oidc from 'openid-client';
import type { AuthConfig } from '../app.js';
import type { AccountDatabase } from '../storage/database.js';
import { validateInternalIdentity } from './identity-policy.js';
import { expiresAt, currentSession, requireExpectedMember, requireMutation, SESSION_COOKIE } from './session-store.js';
/** Only local board/new intents survive sign-in; arbitrary URLs never do. */
export function localReturnIntent(value: string | null): string {
  if (!value || value.length > 512 || !value.startsWith('/?')) return '/';
  const url = new URL(value, 'https://app.example.org'); const board = url.searchParams.get('board');
  if (url.origin !== 'https://app.example.org' || url.pathname !== '/' || url.hash) return '/';
  if (board && /^[A-Za-z0-9_-]{1,128}$/.test(board)) return `/?board=${encodeURIComponent(board)}`;
  return url.searchParams.get('new') === '1' ? '/?new=1' : '/';
}
export async function registerOidcRoutes(app: FastifyInstance, config: AuthConfig, database: AccountDatabase, now: () => number) {
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
      // A logout or expiry during provider I/O revokes this browser's ability to finish login.
      if (!database.prepare('SELECT id FROM sessions WHERE id=? AND expires_at>?').get(request.session.sessionId, now())) {
        throw new Error('Login session no longer valid');
      }
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
  app.post('/api/logout', async (request, reply) => {
    if (!requireMutation(request, reply, config)) return;
    const member = currentSession(database, request, now); if (member && !requireExpectedMember(request, reply, member)) return;
    await request.session.destroy(); reply.clearCookie(SESSION_COOKIE, { path: '/', httpOnly: true, secure: config.secure, sameSite: 'lax' });
    return reply.code(204).send();
  });
}
