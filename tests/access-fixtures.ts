import { createHash, randomUUID } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { randomBytes } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import type { Duplex } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { openDatabase } from '../server/storage/database.js';
import { createOidcProvider } from './oidc-provider.js';
import type { APIResponse, Browser, BrowserContext } from '@playwright/test';
import { test, expect } from './fixtures.js';

// Kept independent of the provider module so browser helpers never start a service on import.
export type AccessIdentity = 'owner' | 'editor' | 'viewer' | 'nonMember';
export const accessIdentityNames: AccessIdentity[] = ['owner', 'editor', 'viewer', 'nonMember'];
export const accessIdentityLabels: Record<AccessIdentity, string> = {
  owner: 'Synthetic Owner', editor: 'Synthetic Editor', viewer: 'Synthetic Viewer', nonMember: 'Synthetic Non-member',
};
export { test, expect };

/** Isolated final-acceptance service; all identities still use signed OIDC. */
export async function acceptanceService(baseURL: string) {
  const origin = 'http://127.0.0.1:5499';
  const registration = { clientId: 'synthetic-acceptance', clientSecret: randomBytes(32).toString('hex'), redirectUri: origin + '/auth/callback' };
  const provider = await createOidcProvider({ clients: [registration] });
  const database = openDatabase(':memory:');
  let barrier: (() => Promise<void>) | undefined;
  const app = await buildApp({ database, beforeCommit: () => barrier?.() ?? Promise.resolve(), config: {
    DALI_ORIGIN: origin, DALI_DATABASE_PATH: ':memory:', DALI_SESSION_SECRET: randomBytes(32).toString('hex'), DALI_SESSION_TTL_MS: '86400000',
    DALI_OIDC_ISSUER: provider.issuer, DALI_OIDC_CLIENT_ID: registration.clientId, DALI_OIDC_CLIENT_SECRET: registration.clientSecret,
    DALI_OIDC_CALLBACK_URL: registration.redirectUri, DALI_INTERNAL_CLAIM: 'membership', DALI_INTERNAL_VALUES_JSON: '["internal"]', DALI_INTERNAL_EMAIL_DOMAINS_JSON: '["example.org"]',
  } });
  const closeProxy = proxyApplicationAssets(app, baseURL);
  await app.listen({ host: '127.0.0.1', port: 5499 });
  return { origin, database, provider, setBarrier(value?: () => Promise<void>) { barrier = value; },
    async close() { closeProxy(); await app.close(); database.close(); await provider.close(); } };
}

/** Preserve both HTTP assets and dev HMR for each isolated synthetic service. */
export function proxyApplicationAssets(app: FastifyInstance, baseURL: string) {
  app.get('/*', async (request, reply) => { const response = await fetch(baseURL + request.url); return reply.type(response.headers.get('content-type') ?? 'text/html').send(Buffer.from(await response.arrayBuffer())); });
  // Dev assets retain Vite's HMR client. Forward its upgrade as well as HTTP
  // assets so the isolated origin exercises dev without hiding runtime errors.
  const upgradeSockets = new Set<Duplex>();
  app.server.on('upgrade', (request, socket, head) => {
    if (request.headers['sec-websocket-protocol'] !== 'vite-hmr') { socket.destroy(); return; }
    const target = new URL(request.url ?? '/', baseURL);
    upgradeSockets.add(socket);
    const upstream = httpRequest(target, { headers: { ...request.headers, host: target.host } });
    socket.on('error', () => upstream.destroy());
    socket.on('close', () => { upgradeSockets.delete(socket); upstream.destroy(); });
    upstream.on('error', () => socket.destroy());
    upstream.on('response', response => { response.resume(); socket.destroy(); });
    upstream.on('upgrade', (response, peer, buffered) => {
      upgradeSockets.add(peer);
      peer.on('error', () => socket.destroy());
      peer.on('close', () => { upgradeSockets.delete(peer); socket.destroy(); });
      const headers = response.rawHeaders.reduce<string[]>((lines, value, index, all) => {
        if (index % 2 === 0) lines.push(`${value}: ${all[index + 1]}`);
        return lines;
      }, []);
      socket.write(`HTTP/1.1 ${response.statusCode} ${response.statusMessage}\r\n${headers.join('\r\n')}\r\n\r\n`);
      if (buffered.length) socket.write(buffered);
      if (head.length) peer.write(head);
      socket.pipe(peer).pipe(socket);
    });
    upstream.end();
  });
  return () => { for (const socket of upgradeSockets) socket.destroy(); };
}

/** Every identity traverses the application's ordinary OIDC boundary in its own cookie jar. */
export async function createIdentityContexts(browser: Browser, baseURL: string) {
  const contexts = {} as Record<AccessIdentity, BrowserContext>;
  const runtimeErrors: string[] = [];
  try {
    for (const identity of accessIdentityNames) {
      const context = await browser.newContext({ baseURL }); contexts[identity] = context;
      context.on('page', page => {
        page.on('pageerror', error => runtimeErrors.push(`${identity}: ${error.message}`));
        page.on('console', message => { if (message.type() === 'error') runtimeErrors.push(`${identity}: ${message.text()}`); });
      });
      const page = await context.newPage();
      await page.goto('/auth/start');
      await page.getByRole('link', { name: accessIdentityLabels[identity], exact: true }).click();
      await page.waitForURL(url => url.origin === new URL(baseURL).origin && !url.pathname.startsWith('/auth/'));
      const session = await context.request.get('/api/session');
      expect(session.status(), `${identity} authenticated through callback`).toBe(200);
      expect((await session.json()).accountId).toEqual(expect.any(String));
    }
    return { contexts, runtimeErrors, async close() {
      await Promise.all(Object.values(contexts).map(context => context.close()));
      expect(runtimeErrors, 'unexpected identity-context runtime errors').toEqual([]);
    } };
  } catch (error) { await Promise.all(Object.values(contexts).map(context => context.close())); throw error; }
}

/** Roles are assigned only by an explicitly supplied repository seeder inside a test process. */
export async function seedAccessRoles(seed: (input: {
  boardId: string; ownerId: string; grants: { memberId: string; role: 'editor' | 'viewer' }[];
}) => void | Promise<void>, input: { boardId: string; ownerId: string; editorId: string; viewerId: string }) {
  await seed({ boardId: input.boardId, ownerId: input.ownerId, grants: [
    { memberId: input.editorId, role: 'editor' }, { memberId: input.viewerId, role: 'viewer' },
  ] });
}

export function syntheticCanaries() {
  const id = randomUUID();
  const chunk = (kind: string, data: Buffer) => {
    const content = Buffer.concat([Buffer.from(kind), data]);
    let crc = 0xffffffff;
    for (const byte of content) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
    const checksum = Buffer.alloc(4); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([length, content, checksum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0); header.writeUInt32BE(1, 4); header[8] = 8; header[9] = 6;
  const color = createHash('sha256').update(id).digest().subarray(0, 3);
  return {
    boardText: `synthetic-board-canary-${id}`,
    // Real, distinct 1x1 RGBA PNG bytes for cross-board image disclosure checks.
    imageBytes: Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header),
      chunk('tEXt', Buffer.from(`canary\0${id}`)),
      chunk('IDAT', deflateSync(Buffer.concat([Buffer.from([0]), color, Buffer.from([255])]))), chunk('IEND', Buffer.alloc(0))]),
    imageKey: `synthetic-image-${id}`,
  };
}

export type OwnerSnapshot = {
  documentBytes: Uint8Array; stateVector: Uint8Array; imageBytes: Uint8Array;
  grants: unknown; metadata: unknown;
};
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const fingerprint = (snapshot: OwnerSnapshot) => ({
  document: hash(snapshot.documentBytes), vector: hash(snapshot.stateVector), image: hash(snapshot.imageBytes),
  grants: structuredClone(snapshot.grants), metadata: structuredClone(snapshot.metadata),
});

/** A denial only passes after the owner re-reads every protected state dimension. */
export async function expectDeniedWithoutChange(options: {
  ownerRead: () => Promise<OwnerSnapshot>; attempt: () => Promise<APIResponse>;
  status: number; canaryText: string; canaryImage: Uint8Array;
}) {
  const before = fingerprint(await options.ownerRead());
  const response = await options.attempt(); const bytes = await response.body();
  expect(response.status()).toBe(options.status);
  expect(bytes.toString('utf8')).not.toContain(options.canaryText);
  expect(bytes.includes(Buffer.from(options.canaryImage))).toBe(false);
  expect(fingerprint(await options.ownerRead())).toEqual(before);
}
