import { randomBytes, randomUUID, createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Page } from '@playwright/test';
import type { EditorHost } from '@blocksuite/affine/std';
import { test, expect } from './fixtures';
import { createOidcProvider } from './oidc-provider';
import { buildApp } from '../server/app';
import { openDatabase, type AccountDatabase } from '../server/storage/database';
import { proxyApplicationAssets, syntheticCanaries } from './access-fixtures';
let closeProxy: (() => void) | undefined;
let app: FastifyInstance; let database: AccountDatabase; let provider: Awaited<ReturnType<typeof createOidcProvider>>;
let accountId: string; const origin = 'http://127.0.0.1:5499';
let beforeCommit: (() => Promise<void>) | undefined;
const expectedAccessErrors = ['the server responded with a status of 401', 'the server responded with a status of 403', 'the server responded with a status of 404', 'the server responded with a status of 409', 'the server responded with a status of 503'];
test.use({ expectErrors: expectedAccessErrors });
test.beforeEach(async ({ page, baseURL }) => {
  await page.clock.install();
  beforeCommit = undefined;
  const registration = { clientId: 'synthetic-recovery', clientSecret: randomBytes(32).toString('hex'), redirectUri: origin + '/auth/callback' };
  provider = await createOidcProvider({ clients: [registration] }); database = openDatabase(':memory:');
  app = await buildApp({ database, beforeCommit: () => beforeCommit?.() ?? Promise.resolve(), config: { DALI_ORIGIN: origin, DALI_DATABASE_PATH: ':memory:', DALI_SESSION_SECRET: randomBytes(32).toString('hex'), DALI_SESSION_TTL_MS: '86400000', DALI_OIDC_ISSUER: provider.issuer, DALI_OIDC_CLIENT_ID: registration.clientId, DALI_OIDC_CLIENT_SECRET: registration.clientSecret, DALI_OIDC_CALLBACK_URL: registration.redirectUri, DALI_INTERNAL_CLAIM: 'membership', DALI_INTERNAL_VALUES_JSON: '["internal"]', DALI_INTERNAL_EMAIL_DOMAINS_JSON: '["example.org"]' } });
  closeProxy = proxyApplicationAssets(app, baseURL!);
  await app.listen({ host: '127.0.0.1', port: 5499 });
  await page.goto(origin); await page.getByRole('link', { name: 'Synthetic Owner', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
  accountId = (await (await page.request.get(origin + '/api/session')).json()).accountId;
});
test.afterEach(async ({ page }) => { await page.unrouteAll({ behavior: 'ignoreErrors' }); closeProxy?.(); closeProxy = undefined; await app?.close(); database?.close(); await provider?.close(); });
async function board(page: Page) {
  const response = await page.request.post(origin + '/api/boards', { headers: { Origin: origin, 'X-Dali-Account': accountId, 'X-Dali-Request': '1' }, data: { title: 'Recovery canary', operationId: randomUUID() } });
  expect(response.status()).toBe(201); const result = await response.json();
  await page.goto(origin + '/?board=' + result.summary.id); await expect(page.locator('affine-edgeless-root')).toBeVisible(); return result;
}
async function text(page: Page, value: string) {
  await page.getByRole('button', { name: 'Add mind map', exact: true }).click(); await page.keyboard.type(value); await page.keyboard.press('Escape');
}
async function model(page: Page) { return page.locator('editor-host').evaluate(el => JSON.stringify((el as EditorHost).store.spaceDoc.toJSON(), (_key, value: unknown) => value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value)); }
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
  const journalImage = await page.evaluate(() => new Promise<{ bytes: number[]; mime: string }>((resolve, reject) => {
    const request = indexedDB.open('dali-account-recovery-v1');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result; const tx = db.transaction('journal', 'readonly'); const rows = tx.objectStore('journal').getAll();
      tx.oncomplete = () => { const image = rows.result.find(row => row.kind === 'blob'); db.close(); resolve({ bytes: Array.from(image.data), mime: image.mime }); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
  }));
  expect(journalImage).toEqual({ bytes: [...bytes], mime: 'image/png' });
  await text(page, 'Pending map canary'); const before = await model(page);
  expect(database.prepare('SELECT * FROM board_blobs WHERE board_id=?').all(descriptor.summary.id)).toHaveLength(0);
  await expire(page); await page.unrouteAll({ behavior: 'ignoreErrors' });
  await page.clock.setFixedTime(new Date());
  await page.getByRole('button', { name: 'Sign in to continue', exact: true }).click();
  await expect(page.locator('affine-edgeless-root')).toHaveCount(1);
  await expect(page.locator('affine-edgeless-root')).toBeVisible();
  expect(await model(page)).toBe(before);
  const blob = await page.request.get(origin + '/api/boards/' + descriptor.summary.id + '/blobs/' + encodeURIComponent(createHash('sha256').update(bytes).digest('base64url') + '='), { headers: { 'X-Dali-Account': accountId } });
  expect(blob.status()).toBe(200); expect(blob.headers()['content-type']).toContain('image/png'); expect(await blob.body()).toEqual(bytes);
  await page.reload(); await expect(page.locator('affine-edgeless-root')).toHaveCount(1); await expect(page.locator('affine-edgeless-root')).toBeVisible(); expect(await model(page)).toBe(before);
});
test('@03-10-01 interrupted acknowledgment replays idempotently against committed server bytes', async ({ page }) => {
  const descriptor = await board(page); let committed = 0;
  await page.route('**/docs/*/push', async route => { const response = await route.fetch(); expect(response.status()).toBe(200); committed++; await route.fulfill({ status: 503, json: { code: 'ACK_INTERRUPTED' } }); });
  await text(page, 'Committed once canary'); const before = await model(page);
  await expect.poll(() => committed).toBeGreaterThan(0);
  await expire(page); await page.unrouteAll({ behavior: 'ignoreErrors' }); await page.clock.setFixedTime(new Date());
  await page.getByRole('button', { name: 'Sign in to continue', exact: true }).click(); await expect(page.locator('affine-edgeless-root')).toBeVisible();
  expect(await model(page)).toBe(before);
  const independent = await page.request.get(origin + '/api/boards/' + descriptor.summary.id + '/editable-export', { headers: { 'X-Dali-Account': accountId } });
  expect(independent.status()).toBe(200);
  const saved = await independent.json(); await page.reload(); await expect(page.locator('affine-edgeless-root')).toBeVisible();
  const reopened = await page.request.get(origin + '/api/boards/' + descriptor.summary.id + '/editable-export', { headers: { 'X-Dali-Account': accountId } });
  expect((await reopened.json()).content).toBe(saved.content); expect(await model(page)).toBe(before);
});
test('@03-10-01 real 401 freezes and preserves native buffered text before disposal', async ({ page }) => {
  const descriptor = await board(page);
  let release!: () => void; const barrier = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/docs/*/push', async route => { await barrier; await route.continue(); });
  await text(page, '401 buffered canary');
  database.prepare('UPDATE sessions SET expires_at=0').run(); release();
  await expect(page.getByRole('heading', { name: 'Session expired — sign in to continue.', exact: true })).toBeVisible();
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await page.getByRole('button', { name: 'Sign in to continue', exact: true }).click(); await expect(page.locator('affine-edgeless-root')).toBeVisible();
  expect(await model(page)).toContain('401 buffered canary');
  const response = await page.request.get(origin + '/api/boards/' + descriptor.summary.id + '/editable-export', { headers: { 'X-Dali-Account': accountId } });
  expect(response.status()).toBe(200);
});
async function records(page: Page) {
  return page.evaluate(async () => new Promise<{ accountId: string; boardId: string; id: string }[]>((resolve, reject) => {
    const opening = indexedDB.open('dali-account-recovery-v1'); opening.onerror = () => reject(opening.error);
    opening.onsuccess = () => { const db = opening.result; const request = db.transaction('journal').objectStore('journal').getAll(); request.onsuccess = () => { db.close(); resolve(request.result); }; request.onerror = () => reject(request.error); };
  }));
}
test('@03-10-02 different identity receives no previous content or replay even with shared access', async ({ page, browser }) => {
  const descriptor = await board(page); const originalAccount = accountId;
  const other = await browser.newContext(); const otherPage = await other.newPage(); await otherPage.goto(origin);
  await otherPage.getByRole('link', { name: 'Synthetic Editor', exact: true }).click(); await expect(otherPage.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
  const otherId = (await (await other.request.get(origin + '/api/session')).json()).accountId;
  database.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?)').run(descriptor.summary.id, otherId, 'editor'); await other.close();
  await page.route('**/docs/*/push', route => route.fulfill({ status: 503, json: {} }));
  await text(page, 'Original identity secret canary'); await expire(page); await page.unrouteAll({ behavior: 'ignoreErrors' });
  const pending = await records(page); expect(pending.length).toBeGreaterThan(0);
  await page.context().clearCookies({ name: 'dali_fixture_identity' }); await page.clock.setFixedTime(new Date());
  let pushes = 0; page.on('request', request => { if (request.url().includes('/push')) pushes++; });
  await page.getByRole('button', { name: 'Sign in to continue', exact: true }).click();
  await page.getByRole('link', { name: 'Synthetic Editor', exact: true }).click();
  await expect(page.getByText("You're signed in with a different account. Return to your boards or sign in with the previous account to recover its pending changes.", { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Account changed', exact: true })).toBeFocused();
  expect(pushes).toBe(0); expect(await records(page)).toEqual(pending);
  await expect(page.locator('editor-host')).toHaveCount(0); await expect(page.getByText('Original identity secret canary')).toHaveCount(0);
  expect((await records(page)).every(record => record.accountId === originalAccount && record.boardId === descriptor.summary.id)).toBe(true);
});
test('@03-10-02 persisted pageshow pauses until fresh session and descriptor authorize', async ({ page }) => {
  const descriptor = await board(page); await text(page, 'BFCache canary'); await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  let release!: () => void; const barrier = new Promise<void>(resolve => { release = resolve; }); let checks = 0;
  await page.route('**/api/session', async route => { checks++; await barrier; await route.continue(); });
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await expect.poll(() => checks).toBe(1);
  await expect(page.getByRole('button', { name: 'Add mind map', exact: true })).toHaveCount(0);
  const before = database.prepare('SELECT * FROM board_documents WHERE board_id=?').all(descriptor.summary.id);
  await page.keyboard.press('Tab'); await page.keyboard.type('DENIED'); expect(database.prepare('SELECT * FROM board_documents WHERE board_id=?').all(descriptor.summary.id)).toEqual(before);
  release(); await expect(page.locator('affine-edgeless-root')).toBeVisible(); expect(await model(page)).toContain('BFCache canary');
});
for (const access of ['viewer', 'revoked'] as const) test(`@03-10-02 ${access} recovery retains original journal with zero replay and named discard`, async ({ page, browser }) => {
  const descriptor = await board(page);
  const owner = await browser.newContext(); const ownerPage = await owner.newPage(); await ownerPage.goto(origin);
  await ownerPage.getByRole('link', { name: 'Synthetic Editor', exact: true }).click(); await expect(ownerPage.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
  const ownerId = (await (await owner.request.get(origin + '/api/session')).json()).accountId;
  // Transfer fixture ownership in the isolated repository so the original member can lose a grant.
  database.prepare('UPDATE boards SET owner_id=? WHERE id=?').run(ownerId, descriptor.summary.id);
  database.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?)').run(descriptor.summary.id, accountId, 'editor');
  await page.route('**/docs/*/push', route => route.fulfill({ status: 503, json: {} }));
  await text(page, 'Quarantined grant canary'); await expire(page); await page.unrouteAll({ behavior: 'ignoreErrors' });
  if (access === 'viewer') database.prepare('UPDATE board_grants SET role=? WHERE board_id=? AND member_id=?').run('viewer', descriptor.summary.id, accountId);
  else database.prepare('DELETE FROM board_grants WHERE board_id=? AND member_id=?').run(descriptor.summary.id, accountId);
  const pending = await records(page); const serverBefore = database.prepare('SELECT * FROM board_documents WHERE board_id=?').all(descriptor.summary.id);
  let writes = 0; page.on('request', request => { if (request.url().includes('/push') || request.method() === 'PUT') writes++; });
  await page.clock.setFixedTime(new Date()); await page.getByRole('button', { name: 'Sign in to continue', exact: true }).click();
  await expect(page.getByText('Your access has changed. Pending changes have not been applied. Return to your boards or contact the board owner.', { exact: true })).toBeVisible();
  expect(writes).toBe(0); expect(await records(page)).toEqual(pending); expect(database.prepare('SELECT * FROM board_documents WHERE board_id=?').all(descriptor.summary.id)).toEqual(serverBefore);
  await page.getByRole('button', { name: 'Discard pending changes', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Recovery canary'); await expect(page.getByRole('button', { name: 'Keep pending changes', exact: true })).toBeFocused();
  await page.getByRole('dialog').getByRole('button', { name: 'Discard pending changes', exact: true }).click(); await expect(page.getByRole('status')).toHaveText('Pending changes discarded.'); expect(await records(page)).toEqual([]);
  await owner.close();
});
for (const fallback of [false, true]) test(`@03-10-02 cross-tab logout preserves pending edits with ${fallback ? 'storage fallback' : 'BroadcastChannel'}`, async ({ page, context }) => {
  if (fallback) { await context.addInitScript(() => Object.defineProperty(window, 'BroadcastChannel', { value: undefined })); await page.reload(); }
  const descriptor = await board(page); const other = await context.newPage(); await other.goto(origin);
  await expect(other.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible(); await expect(page.locator('affine-edgeless-root')).toBeVisible();
  await page.route('**/docs/*/push', route => route.fulfill({ status: 503, json: {} })); await text(page, 'Stale tab pending canary');
  const before = database.prepare('SELECT * FROM board_documents WHERE board_id=?').all(descriptor.summary.id);
  await other.getByRole('button', { name: 'Sign out of Dalí', exact: true }).click();
  await expect(page.getByRole('heading', { name: "You're signed out of Dalí", exact: true })).toBeVisible();
  await expect(page.locator('editor-host')).toHaveCount(0); expect((await records(page)).length).toBeGreaterThan(0);
  expect(database.prepare('SELECT * FROM board_documents WHERE board_id=?').all(descriptor.summary.id)).toEqual(before);
  const signal = await page.evaluate(() => JSON.parse(localStorage.getItem('dali-session-signal')!)); expect(Object.keys(signal).sort()).toEqual(['id', 'kind']);
  await page.reload(); await expect(page.getByRole('heading', { name: "You're signed out of Dalí", exact: true })).toBeVisible(); await other.close();
});
test('@03-10-02 explicit logout quota failure retains tab and only sends logout after retry', async ({ page }) => {
  await board(page); await text(page, 'Logout pending canary');
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  await page.evaluate(() => { const put = IDBObjectStore.prototype.put; Object.assign(window, { restoreJournal: () => { IDBObjectStore.prototype.put = put; } }); IDBObjectStore.prototype.put = function (...args) { if (this.transaction.db.name.startsWith('dali-account-recovery')) throw new DOMException('Synthetic quota', 'QuotaExceededError'); return put.apply(this, args); }; });
  let logout = 0; page.on('request', request => { if (request.url().endsWith('/api/logout')) logout++; });
  await page.locator('summary').filter({ hasText: /^Account$/ }).click(); await page.getByRole('button', { name: 'Sign out of Dalí', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry preservation', exact: true })).toBeVisible(); expect(logout).toBe(0);
  await page.evaluate(() => (window as unknown as { restoreJournal(): void }).restoreJournal());
  await page.getByRole('button', { name: 'Retry preservation', exact: true }).click();
  await expect(page.getByRole('heading', { name: "You're signed out of Dalí", exact: true })).toBeVisible(); expect(logout).toBe(1);
  expect((await records(page)).length).toBeGreaterThan(0); expect((await page.request.get(origin + '/api/session')).status()).toBe(401);
});
for (const resource of ['document', 'image', 'thumbnail'] as const) test.describe(`delayed ${resource}`, () => {
  // Pinned native image loading logs this exact cancellation when its authorized request is aborted.
  if (resource === 'image') test.use({ expectErrors: [...expectedAccessErrors, 'AbortError: signal is aborted without reason'] });
  test(`@03-10-02 delayed ${resource} from old cookie identity cannot render after account switch`, async ({ page, context }) => {
  const descriptor = await board(page); await text(page, 'Delayed identity canary');
  await page.locator('input[type=file][accept="image/*"]').setInputFiles({ name: 'canary.png', mimeType: 'image/png', buffer: syntheticCanaries().imageBytes }); await expect(page.locator('affine-edgeless-image')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  if (resource === 'thumbnail') {
    const thumbnail = await page.request.put(origin + '/api/boards/' + descriptor.summary.id + '/thumbnail', { headers: { Origin: origin, 'X-Dali-Account': accountId, 'X-Dali-Request': '1', 'Content-Type': 'image/png' }, data: syntheticCanaries().imageBytes }); expect(thumbnail.status()).toBe(200);
  }
  const before = database.prepare('SELECT * FROM board_documents WHERE board_id=?').all(descriptor.summary.id);
  let release!: () => void; const barrier = new Promise<void>(resolve => { release = resolve; }); let received = false;
  const pattern = resource === 'document' ? '**/docs/*/pull' : resource === 'image' ? '**/blobs/*' : '**/thumbnail';
  await page.route(pattern, async route => { const response = await route.fetch(); expect(response.status()).toBe(200); expect(route.request().headers()['x-dali-account']).toBe(accountId); received = true; await barrier; await route.fulfill({ response }).catch(() => {}); });
  await page.goto(resource === 'thumbnail' ? origin : origin + '/?board=' + descriptor.summary.id); await expect.poll(() => received).toBe(true);
  await context.clearCookies({ name: 'dali_fixture_identity' }); const other = await context.newPage(); await other.goto(origin + '/auth/start');
  await other.getByRole('link', { name: 'Synthetic Editor', exact: true }).click(); await expect(other.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
  await expect(page.getByText("You're signed in with a different account. Return to your boards or sign in with the previous account to recover its pending changes.", { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Account changed', exact: true })).toBeFocused();
  release(); await page.unrouteAll({ behavior: 'ignoreErrors' });
  await expect(page.locator('editor-host')).toHaveCount(0); await expect(page.locator('.board-card')).toHaveCount(0); await expect(page.getByText('Delayed identity canary')).toHaveCount(0);
  expect(database.prepare('SELECT * FROM board_documents WHERE board_id=?').all(descriptor.summary.id)).toEqual(before);
  const denied = await page.request.post(origin + '/api/boards/' + descriptor.summary.id + '/docs/' + descriptor.contentDocId + '/push', { headers: { Origin: origin, 'X-Dali-Account': accountId, 'X-Dali-Request': '1', 'Content-Type': 'application/octet-stream' }, data: Buffer.from([0, 0]) });
  expect(denied.status()).toBe(409); expect(database.prepare('SELECT * FROM board_documents WHERE board_id=?').all(descriptor.summary.id)).toEqual(before); await other.close();
  });
});
test('@03-10-02 role revocation at replay commit retains journal and unchanged document bytes', async ({ page, browser }) => {
  const descriptor = await board(page);
  const other = await browser.newContext(); const otherPage = await other.newPage(); await otherPage.goto(origin); await otherPage.getByRole('link', { name: 'Synthetic Editor', exact: true }).click();
  await expect(otherPage.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible(); const otherId = (await (await other.request.get(origin + '/api/session')).json()).accountId;
  await page.route('**/docs/*/push', route => route.fulfill({ status: 503, json: {} })); await text(page, 'Commit barrier canary'); await expire(page); await page.unrouteAll({ behavior: 'ignoreErrors' });
  const pending = await records(page); const before = database.prepare('SELECT * FROM board_documents WHERE board_id=?').all(descriptor.summary.id); let crossed = 0;
  beforeCommit = async () => { crossed++; database.prepare('UPDATE boards SET owner_id=? WHERE id=?').run(otherId, descriptor.summary.id); };
  await page.clock.setFixedTime(new Date()); await page.getByRole('button', { name: 'Sign in to continue', exact: true }).click();
  await expect(page.getByText('Your access has changed. Pending changes have not been applied. Return to your boards or contact the board owner.', { exact: true })).toBeVisible();
  expect(crossed).toBeGreaterThan(0); expect(await records(page)).toEqual(pending); expect(database.prepare('SELECT * FROM board_documents WHERE board_id=?').all(descriptor.summary.id)).toEqual(before); await other.close();
});
test('@03-10-02 late session response cannot override simultaneous logout and account switch', async ({ page, context }) => {
  const descriptor = await board(page); const other = await context.newPage(); await other.goto(origin); await expect(other.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
  await page.route('**/docs/*/push', route => route.fulfill({ status: 503, json: {} })); await text(page, 'Session race canary');
  const before = database.prepare('SELECT * FROM board_documents WHERE board_id=?').all(descriptor.summary.id);
  let release!: () => void; const barrier = new Promise<void>(resolve => { release = resolve; }); let received = false;
  await page.route('**/api/session', async route => { const response = await route.fetch(); received = true; await barrier; await route.fulfill({ response }).catch(() => {}); });
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))); await expect.poll(() => received).toBe(true);
  await other.getByRole('button', { name: 'Sign out of Dalí', exact: true }).click(); await expect(page.getByRole('heading', { name: "You're signed out of Dalí", exact: true })).toBeVisible();
  await context.clearCookies({ name: 'dali_fixture_identity' }); await other.getByRole('button', { name: 'Sign in again', exact: true }).click(); await other.getByRole('link', { name: 'Synthetic Editor', exact: true }).click(); await other.getByRole('button', { name: 'Back to your boards', exact: true }).click(); await expect(other.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
  release(); await page.unrouteAll({ behavior: 'ignoreErrors' }); await expect(page.getByRole('heading', { name: "You're signed out of Dalí", exact: true })).toBeVisible();
  await expect(page.locator('editor-host')).toHaveCount(0); expect((await records(page)).length).toBeGreaterThan(0); expect(database.prepare('SELECT * FROM board_documents WHERE board_id=?').all(descriptor.summary.id)).toEqual(before); await other.close();
});
test('@03-10-03 same-board recovery announces acknowledged resume and restores prior control focus', async ({ page }) => {
  await board(page); await text(page, 'Focus recovery canary');
  await page.getByRole('button', { name: 'Add mind map', exact: true }).focus(); await expire(page);
  const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible();
  for (let i = 0; i < 4; i++) { await page.keyboard.press('Tab'); expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true); }
  await page.keyboard.press('Escape'); await expect(dialog).toBeVisible(); await expect(page.getByRole('button', { name: 'Add mind map', exact: true })).toHaveCount(0);
  await page.clock.setFixedTime(new Date()); await page.getByRole('button', { name: 'Sign in to continue', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: /^Editing resumed\.$/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add mind map', exact: true })).toBeFocused(); expect(await model(page)).toContain('Focus recovery canary');
});
test('@03-10-03 long account recovery fits 490px and short viewport with reachable static controls', async ({ page }) => {
  const descriptor = await board(page); const email = 'synthetic-' + 'longidentifier'.repeat(22) + '@example.org';
  database.prepare('UPDATE members SET email=?,display_name=? WHERE id=?').run(email, 'Synthetic ' + 'longname'.repeat(30), accountId);
  await page.reload(); await expect(page.locator('affine-edgeless-root')).toBeVisible(); await page.setViewportSize({ width: 490, height: 240 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  await expire(page); await expect(page.getByRole('dialog').getByText(email, { exact: true })).toBeVisible();
  const action = page.getByRole('button', { name: 'Sign in to continue', exact: true }); await action.scrollIntoViewIfNeeded(); const box = (await action.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44); expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(490); expect(box.y + box.height).toBeLessThanOrEqual(240);
  expect(await page.getByRole('dialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true); expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  expect((await records(page)).every(record => record.boardId === descriptor.summary.id)).toBe(true);
});
test('@03-10-03 failed replay stays pending without resume and retries committed content', async ({ page }) => {
  const descriptor = await board(page); await text(page, 'Replay retry canary'); await expire(page);
  await page.clock.setFixedTime(new Date()); await page.route('**/docs/*/push', route => route.fulfill({ status: 503, json: { code: 'SYNTHETIC_UNAVAILABLE' } }));
  await page.getByRole('button', { name: 'Sign in to continue', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible(); await expect(page.getByText('Editing resumed.', { exact: true })).toHaveCount(0); await expect(page.locator('editor-host')).toHaveCount(0);
  expect((await records(page)).length).toBeGreaterThan(0); await page.unrouteAll({ behavior: 'ignoreErrors' }); await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByText('Editing resumed.', { exact: true })).toBeVisible(); expect(await model(page)).toContain('Replay retry canary');
  const independent = await page.request.get(origin + '/api/boards/' + descriptor.summary.id + '/editable-export', { headers: { 'X-Dali-Account': accountId } }); expect(independent.status()).toBe(200);
});
test('@03-10-03 native topic focus returns only after replay acknowledgment and composition stays blocked while paused', async ({ page }) => {
  await board(page); await page.getByRole('button', { name: 'Add mind map', exact: true }).click(); await page.keyboard.type('Native focus canary');
  await expire(page); const pending = await records(page);
  await page.getByRole('dialog').evaluate(el => { el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '未' })); el.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, inputType: 'insertCompositionText', data: '未承認' })); el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '未承認' })); });
  await page.keyboard.press('Escape'); expect(await records(page)).toEqual(pending);
  let release!: () => void; const barrier = new Promise<void>(resolve => { release = resolve; }); let received = false;
  await page.route('**/docs/*/push', async route => { const response = await route.fetch(); expect(response.status()).toBe(200); received = true; await barrier; await route.fulfill({ response }); });
  await page.clock.setFixedTime(new Date()); await page.getByRole('button', { name: 'Sign in to continue', exact: true }).click(); await expect.poll(() => received).toBe(true);
  await expect(page.getByText('Editing resumed.', { exact: true })).toHaveCount(0); await expect(page.locator('editor-host')).toHaveCount(0);
  release(); await expect(page.getByText('Editing resumed.', { exact: true })).toBeVisible(); await expect(page.locator('edgeless-shape-text-editor [contenteditable="true"]')).toBeVisible();
  expect(await page.locator('edgeless-shape-text-editor').evaluate(el => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('End'); await page.keyboard.type(' resumed'); await page.keyboard.press('Escape'); expect(await model(page)).toContain('Native focus canary resumed');
});
test('@03-10-03 long authentication error stays bounded and retries deliberate sign-in', async ({ page }) => {
  await page.setViewportSize({ width: 490, height: 240 }); await page.goto(origin + '/?authError=' + 'synthetic-long-error-'.repeat(80));
  await expect(page.getByRole('heading', { name: "We couldn't sign you in.", exact: true })).toBeVisible();
  await expect(page.locator('editor-host')).toHaveCount(0); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(490);
  await page.getByRole('button', { name: 'Sign in again', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
});
