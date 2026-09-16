import { randomBytes, randomUUID, createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Page } from '@playwright/test';
import type { EditorHost } from '@blocksuite/affine/std';
import { test, expect } from './fixtures';
import { createOidcProvider } from './oidc-provider';
import { buildApp } from '../server/app';
import { openDatabase, type AccountDatabase } from '../server/storage/database';
import { syntheticCanaries } from './access-fixtures';
let app: FastifyInstance; let database: AccountDatabase; let provider: Awaited<ReturnType<typeof createOidcProvider>>;
let accountId: string; const origin = 'http://127.0.0.1:5499';
test.use({ expectErrors: ['the server responded with a status of 401', 'the server responded with a status of 403', 'the server responded with a status of 404', 'the server responded with a status of 409', 'the server responded with a status of 503'] });
test.beforeEach(async ({ page, baseURL }) => {
  await page.clock.install();
  const registration = { clientId: 'synthetic-recovery', clientSecret: randomBytes(32).toString('hex'), redirectUri: origin + '/auth/callback' };
  provider = await createOidcProvider({ clients: [registration] }); database = openDatabase(':memory:');
  app = await buildApp({ database, config: { DALI_ORIGIN: origin, DALI_DATABASE_PATH: ':memory:', DALI_SESSION_SECRET: randomBytes(32).toString('hex'), DALI_SESSION_TTL_MS: '86400000', DALI_OIDC_ISSUER: provider.issuer, DALI_OIDC_CLIENT_ID: registration.clientId, DALI_OIDC_CLIENT_SECRET: registration.clientSecret, DALI_OIDC_CALLBACK_URL: registration.redirectUri, DALI_INTERNAL_CLAIM: 'membership', DALI_INTERNAL_VALUES_JSON: '["internal"]', DALI_INTERNAL_EMAIL_DOMAINS_JSON: '["example.org"]' } });
  app.get('/*', async (request, reply) => { const response = await fetch(baseURL! + request.url); return reply.type(response.headers.get('content-type') ?? 'text/html').send(Buffer.from(await response.arrayBuffer())); });
  await app.listen({ host: '127.0.0.1', port: 5499 });
  await page.goto(origin); await page.getByRole('link', { name: 'Synthetic Owner', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
  accountId = (await (await page.request.get(origin + '/api/session')).json()).accountId;
});
test.afterEach(async ({ page }) => { await page.unrouteAll({ behavior: 'ignoreErrors' }); await app?.close(); database?.close(); await provider?.close(); });
async function board(page: Page) {
  const response = await page.request.post(origin + '/api/boards', { headers: { Origin: origin, 'X-Dali-Account': accountId, 'X-Dali-Request': '1' }, data: { title: 'Recovery canary', operationId: randomUUID() } });
  expect(response.status()).toBe(201); const result = await response.json();
  await page.goto(origin + '/?board=' + result.summary.id); await expect(page.locator('affine-edgeless-root')).toBeVisible(); return result;
}
async function text(page: Page, value: string) {
  await page.getByRole('button', { name: 'Add mind map', exact: true }).click(); await page.keyboard.type(value); await page.keyboard.press('Escape');
}
async function model(page: Page) { return page.locator('editor-host').evaluate(el => JSON.stringify((el as EditorHost).store.spaceDoc.toJSON())); }
async function expire(page: Page) { await page.clock.fastForward(86400001); }
test('@03-10-01 quota failure blocks navigation until real pending work is secured', async ({ page }) => {
  await board(page);
  await page.evaluate(() => { const put = IDBObjectStore.prototype.put; Object.assign(window, { restoreJournal: () => { IDBObjectStore.prototype.put = put; } }); IDBObjectStore.prototype.put = function (...args) { if (this.transaction.db.name.startsWith('dali-account-recovery')) throw new DOMException('Synthetic quota', 'QuotaExceededError'); return put.apply(this, args); }; });
  await text(page, 'Quota pending canary');
  await expire(page);
  await expect(page.getByRole('button', { name: 'Retry preservation', exact: true })).toBeVisible();
  await expect(page.getByText('Pending changes could not be secured for sign-in. Keep this tab open and retry preservation.', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.getByRole('button', { name: 'Add mind map', exact: true })).toHaveCount(0);
  await page.evaluate(() => (window as unknown as { restoreJournal(): void }).restoreJournal());
  await page.getByRole('button', { name: 'Retry preservation', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in to continue', exact: true })).toBeEnabled();
});
test('@03-10-01 full redirect restores unacknowledged image hash and map text exactly once', async ({ page }) => {
  const descriptor = await board(page);
  await page.route('**/docs/*/push', route => route.fulfill({ status: 503, json: { code: 'SYNTHETIC_OFFLINE' } }));
  await page.route('**/blobs/*', route => route.request().method() === 'PUT' ? route.fulfill({ status: 503, json: { code: 'SYNTHETIC_OFFLINE' } }) : route.continue());
  const bytes = syntheticCanaries().imageBytes;
  await page.locator('input[type=file][accept="image/*"]').setInputFiles({ name: 'pending.png', mimeType: 'image/png', buffer: bytes });
  await expect(page.locator('affine-edgeless-image')).toHaveCount(1);
  await text(page, 'Pending map canary'); const before = await model(page);
  expect(database.prepare('SELECT * FROM board_blobs WHERE board_id=?').all(descriptor.summary.id)).toHaveLength(0);
  await expire(page); await page.unrouteAll({ behavior: 'ignoreErrors' });
  await page.getByRole('button', { name: 'Sign in to continue', exact: true }).click();
  await expect(page.locator('affine-edgeless-root')).toBeVisible();
  expect(await model(page)).toBe(before);
  const blob = await page.request.get(origin + '/api/boards/' + descriptor.summary.id + '/blobs/' + encodeURIComponent(createHash('sha256').update(bytes).digest('base64url') + '='), { headers: { 'X-Dali-Account': accountId } });
  expect(blob.status()).toBe(200); expect(await blob.body()).toEqual(bytes);
  await page.reload(); await expect(page.locator('affine-edgeless-root')).toBeVisible(); expect(await model(page)).toBe(before);
});
