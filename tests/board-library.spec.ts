import { randomBytes, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Page, Route } from '@playwright/test';
import { test, expect } from './fixtures';
import { proxyApplicationAssets, syntheticCanaries } from './access-fixtures';
import { createOidcProvider } from './oidc-provider';
import { buildApp } from '../server/app';
import { openDatabase, type AccountDatabase } from '../server/storage/database';

// The production shell and application use an isolated real HTTP listener and
// repository in this test process; every browser completes signed OIDC login.
let closeProxy: (() => void) | undefined;
let app: FastifyInstance; let database: AccountDatabase;
let provider: Awaited<ReturnType<typeof createOidcProvider>>;
let accountId: string; let origin: string;
let responseMode: 'normal' | 'error' | 'missing-role' | 'missing-identity' = 'normal';
let libraryWait: Promise<void> | undefined;
let thumbnailWait: Promise<void> | undefined;
let wrongPreviewAccount = false;
let requestedAccounts: string[] = [];
test.use({ expectErrors: ['Failed to load resource: the server responded with a status of 401 (Unauthorized)', 'Failed to load resource: the server responded with a status of 404 (Not Found)', 'Failed to load resource: the server responded with a status of 503 (Service Unavailable)'] });
test.beforeEach(async ({ page, baseURL }) => {
  origin = 'http://127.0.0.1:5499'; responseMode = 'normal'; libraryWait = undefined; thumbnailWait = undefined; wrongPreviewAccount = false; requestedAccounts = [];
  const registration = { clientId: 'synthetic-library-browser', clientSecret: randomBytes(32).toString('hex'), redirectUri: origin + '/auth/callback' };
  provider = await createOidcProvider({ clients: [registration] }); database = openDatabase(':memory:');
  app = await buildApp({ database, config: { DALI_ORIGIN: origin, DALI_DATABASE_PATH: ':memory:',
    DALI_SESSION_SECRET: randomBytes(32).toString('hex'), DALI_SESSION_TTL_MS: '86400000', DALI_OIDC_ISSUER: provider.issuer,
    DALI_OIDC_CLIENT_ID: registration.clientId, DALI_OIDC_CLIENT_SECRET: registration.clientSecret,
    DALI_OIDC_CALLBACK_URL: registration.redirectUri, DALI_INTERNAL_CLAIM: 'membership', DALI_INTERNAL_VALUES_JSON: '["internal"]',
    DALI_INTERNAL_EMAIL_DOMAINS_JSON: '["example.org"]' } });
  closeProxy = proxyApplicationAssets(app, baseURL!);
  await app.listen({ host: '127.0.0.1', port: 5499 });
  const proxy = async (route: Route) => {
    const request = route.request(); const url = new URL(request.url());
    const response = await route.fetch();
    const headers = response.headers();
    let body = await response.body(); let status = response.status();
    if (url.pathname === '/api/boards' && request.method() === 'GET') {
      await libraryWait;
      if (responseMode === 'error') { status = 503; body = Buffer.from('{"code":"REQUEST_FAILED"}'); }
      if (responseMode === 'missing-role' || responseMode === 'missing-identity') {
        const rows = await response.json(); if (rows[0]) delete rows[0][responseMode === 'missing-role' ? 'role' : 'accountId'];
        body = Buffer.from(JSON.stringify(rows));
      }
    }
    if (url.pathname.endsWith('/thumbnail')) {
      requestedAccounts.push(request.headers()['x-dali-account'] ?? 'missing');
      await thumbnailWait;
      if (wrongPreviewAccount) headers['x-dali-account'] = 'stale-account';
    }
    delete headers['content-length'];
    await route.fulfill({ status, headers, body });
  };
  await page.route(url => url.origin === origin && url.pathname.startsWith('/api/boards'), proxy);
  await page.goto(origin); await page.getByRole('link', { name: 'Synthetic Owner', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
  accountId = (database.prepare("SELECT id FROM members WHERE subject='synthetic-owner'").get() as { id: string } | undefined)?.id
    ?? (database.prepare("SELECT id FROM members WHERE email='owner@example.org'").get() as { id: string }).id;
  database.prepare('INSERT INTO members(id,issuer,subject,email,canonical_email,display_name) VALUES(?,?,?,?,?,?)')
    .run('synthetic-other', provider.issuer, 'synthetic-other', 'other@example.org', 'other@example.org', 'Synthetic Other');
  await expect(page.getByRole('heading', { name: 'Create your first board' })).toBeVisible();
});
test.afterEach(async ({ page }) => { await page.unrouteAll({ behavior: 'ignoreErrors' }); closeProxy?.(); closeProxy = undefined; await app?.close(); database?.close(); await provider?.close(); });
function seed(title: string, options: { role?: 'owner' | 'editor' | 'viewer'; updatedAt?: number; pending?: boolean; foreign?: boolean; image?: Buffer } = {}) {
  const id = randomUUID(); const role = options.role ?? 'owner';
  database.prepare('INSERT INTO boards(id,owner_id,title,root_doc_id,content_doc_id,created_at,updated_at,revision) VALUES(?,?,?,?,?,?,?,1)')
    .run(id, options.foreign || role !== 'owner' ? 'synthetic-other' : accountId, title, randomUUID(), randomUUID(), 1000, options.updatedAt ?? 1000);
  if (!options.foreign && role !== 'owner') database.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?)').run(id, accountId, role);
  if (options.pending) database.prepare('INSERT INTO pending_grants(board_id,issuer,canonical_email,role) VALUES(?,?,?,?)').run(id, provider.issuer, 'waiting@example.org', 'viewer');
  if (options.image) database.prepare('INSERT INTO board_thumbnails(board_id,bytes,mime) VALUES(?,?,?)').run(id, options.image, 'image/png');
  return id;
}
const refresh = (page: Page) => page.getByRole('button', { name: 'Refresh boards', exact: true }).click();
const card = (page: Page, id: string) => page.locator('[data-board-id="' + id + '"]');

test('@03-03-02 UI-HOME-empty every filter has usable copy and no foreign metadata', async ({ page }) => {
  const canary = syntheticCanaries(); seed(canary.boardText, { foreign: true, image: canary.imageBytes });
  for (const name of ['All', 'Mine', 'Shared with me']) {
    await page.getByRole('button', { name, exact: true }).click(); await refresh(page);
    await expect(page.getByRole('heading', { name: name === 'Shared with me' ? 'No shared boards yet' : 'Create your first board' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New board', exact: true })).toBeEnabled();
    expect(await page.locator('body').innerText()).not.toContain(canary.boardText);
    await expect(page.locator('[data-board-id]')).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'View all boards' }).click();
  await expect(page.getByRole('button', { name: 'All', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(requestedAccounts).toEqual([]);
});

test('@03-03-02 UI-HOME-populated BOARD-02 roles pending and all filter ordering are authoritative', async ({ page }) => {
  const a = seed('Owner with redundant grant'); database.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?)').run(a, accountId, 'viewer');
  const b = seed('Private owner', { updatedAt: 2000 }); const c = seed('Editor board', { role: 'editor' });
  const d = seed('Viewer board', { role: 'viewer', updatedAt: 3000 }); const p = seed('Pending-only board', { pending: true });
  const foreign = seed('Foreign hidden canary', { foreign: true });
  const ordered = (ids: string[]) => ids.sort((x, y) => (y === d ? 3000 : y === b ? 2000 : 1000) - (x === d ? 3000 : x === b ? 2000 : 1000) || x.localeCompare(y));
  for (const [name, ids] of [['All', [a, b, c, d, p]], ['Mine', [a, b, p]], ['Shared with me', [c, d]]] as const) {
    await page.getByRole('button', { name, exact: true }).click(); await refresh(page);
    await expect(page.locator('[data-board-id]')).toHaveCount(ids.length);
    await expect.poll(() => page.locator('[data-board-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-board-id')))).toEqual(ordered([...ids]));
    await expect(card(page, foreign)).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await expect(card(page, a).getByText('Owner', { exact: true })).toBeVisible(); await expect(card(page, a)).toHaveCount(1);
  await expect(card(page, a).getByText('Shared', { exact: true })).toBeVisible();
  await expect(card(page, b).getByText('Private', { exact: true })).toBeVisible();
  await expect(card(page, c).getByText('Editor', { exact: true })).toBeVisible();
  await expect(card(page, d).getByText('Viewer', { exact: true })).toBeVisible();
  await expect(card(page, p).getByText('Pending member sign-in')).toBeVisible();
  for (const id of [a, b, c, d, p]) { await expect(card(page, id).getByText('Preview unavailable')).toBeVisible(); await expect(card(page, id).locator('small')).toContainText('Edited'); }
});

test('@03-03-02 UI-HOME-loading and error clear stale cards, retain filter and recover', async ({ page }) => {
  seed('Visible shared board', { role: 'editor' }); await page.getByRole('button', { name: 'Shared with me', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Open Visible shared board' })).toBeVisible();
  let release!: () => void; libraryWait = new Promise(resolve => { release = resolve; });
  await refresh(page); await expect(page.getByRole('status')).toHaveText('Loading your boards…');
  await expect(page.locator('[data-board-id]')).toHaveCount(0); await expect(page.locator('.board-card--skeleton')).toHaveCount(3);
  await expect(page.locator('.board-card--skeleton :is(a,button,input)')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Shared with me', exact: true })).toHaveAttribute('aria-pressed', 'true');
  responseMode = 'error'; release(); libraryWait = undefined;
  await expect(page.getByRole('alert')).toHaveText("We couldn't load your boards. Try again.");
  await expect(page.locator('[data-board-id]')).toHaveCount(0);
  responseMode = 'normal'; await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Open Visible shared board' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Shared with me', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('@03-03-02 UI-HOME-partial missing role or identity blocks actionable cards until refresh', async ({ page }) => {
  seed('Incomplete metadata board');
  for (const mode of ['missing-role', 'missing-identity'] as const) {
    responseMode = mode; await refresh(page); await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open Incomplete metadata board' })).toHaveCount(0);
    responseMode = 'normal'; await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Open Incomplete metadata board' })).toBeVisible();
  }
});

test('@03-03-02 UI-HOME-zero-one-many overflow and long Unicode names work at desktop and touch widths', async ({ page }) => {
  await page.setViewportSize({ width: 1404, height: 900 });
  const title = '👩🏽‍💻'.repeat(200); const id = seed(title); await refresh(page);
  await expect(card(page, id)).toBeVisible();
  expect((await card(page, id).boundingBox())!.width).toBeLessThan(400);
  await expect(card(page, id).getByRole('link', { name: 'Open ' + title, exact: true })).toBeVisible();
  const disclosure = card(page, id).locator('summary'); await disclosure.focus(); await page.keyboard.press('Enter');
  await expect(card(page, id).locator('details')).toHaveAttribute('open', '');
  await expect(card(page, id).locator('details p')).toHaveText(title);
  for (let index = 1; index < 50; index++) seed(index === 1 ? 'x'.repeat(120) : 'Synthetic board ' + index);
  database.prepare('UPDATE members SET email=? WHERE id=?').run('long'.repeat(40) + '@example.org', accountId);
  await page.reload(); await expect(page.locator('[data-board-id]')).toHaveCount(50);
  for (const width of [1404, 490]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const grid = await page.locator('.board-grid').evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length);
    expect(grid).toBe(width === 490 ? 1 : 5);
    const sizes = await page.locator('.board-library button, .board-library summary').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height));
    expect(sizes.every(height => height >= 44)).toBe(true);
    await page.screenshot({ path: '.gsd/library-' + width + '.png', fullPage: false });
  }
  await card(page, id).locator('summary').click(); await expect(card(page, id).locator('details p')).toBeVisible();
  expect(await card(page, id).locator('strong').evaluate(node => node.getBoundingClientRect().height)).toBeLessThanOrEqual(46);
});

test.describe('preview lifecycle', () => {
test.use({ expectErrors: ['Failed to load resource: the server responded with a status of 401 (Unauthorized)', 'Failed to load resource: the server responded with a status of 404 (Not Found)', 'Failed to load resource: net::ERR_FILE_NOT_FOUND'] });
test('@03-03-02 protected previews reject denied and delayed generations and revoke object URLs', async ({ page }) => {
  const own = syntheticCanaries(); const foreign = syntheticCanaries();
  const id = seed('Preview owner', { image: own.imageBytes }); seed(foreign.boardText, { foreign: true, image: foreign.imageBytes });
  await refresh(page); const image = card(page, id).locator('img'); await expect(image).toBeVisible();
  const url = await image.getAttribute('src'); expect(url).toMatch(/^blob:/);
  const bytes = await image.evaluate(async node => Array.from(new Uint8Array(await (await fetch((node as HTMLImageElement).src)).arrayBuffer())));
  expect(Buffer.from(bytes)).toEqual(own.imageBytes); expect(Buffer.from(bytes)).not.toEqual(foreign.imageBytes);
  expect(requestedAccounts.every(value => value === accountId)).toBe(true);
  let release!: () => void; thumbnailWait = new Promise(resolve => { release = resolve; });
  await refresh(page); await expect(card(page, id).getByText('Preview unavailable')).toBeVisible();
  await expect(image).toHaveCount(0);
  // Blob URLs from the discarded generation can no longer be fetched.
  expect(await page.evaluate(async url => { try { await fetch(url!); return true; } catch { return false; } }, url)).toBe(false);
  await page.getByRole('button', { name: 'Shared with me', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No shared boards yet' })).toBeVisible();
  release(); thumbnailWait = undefined; await expect(page.locator('.board-card__preview img')).toHaveCount(0);
  wrongPreviewAccount = true; await page.getByRole('button', { name: 'All', exact: true }).click();
  await expect(card(page, id).getByText('Preview unavailable')).toBeVisible(); await expect(image).toHaveCount(0);
  wrongPreviewAccount = false;
  // The list was authorized, but revoking before preview retrieval denies all image bytes.
  database.prepare('UPDATE boards SET owner_id=? WHERE id=?').run('synthetic-other', id);
  const denied = await app.inject({ url: '/api/boards/' + id + '/thumbnail', headers: { cookie: (await page.context().cookies()).filter(value => value.name === 'dali_session').map(value => value.name + '=' + value.value).join('; '), 'x-dali-account': accountId } });
  expect(denied.statusCode).toBe(404); expect(denied.rawPayload.includes(own.imageBytes)).toBe(false);
  await refresh(page); await expect(card(page, id)).toHaveCount(0); expect(await page.locator('body').innerText()).not.toContain(foreign.boardText);
});
test('@03-03-02 UI-HOME-partial denied preview keeps the authorized open action usable', async ({ page }) => {
  const canary = syntheticCanaries();
  const created = await page.request.post(origin + '/api/boards', { headers: { Origin: origin, 'X-Dali-Account': accountId, 'X-Dali-Request': '1' }, data: { title: 'Missing preview board', operationId: randomUUID() } });
  expect(created.status()).toBe(201);
  const id = (await created.json()).summary.id as string;
  database.prepare('INSERT INTO board_thumbnails(board_id,bytes,mime) VALUES(?,?,?)').run(id, canary.imageBytes, 'image/png');
  await page.route('**/api/boards/' + id + '/thumbnail', async route => {
    database.prepare('DELETE FROM board_thumbnails WHERE board_id=?').run(id);
    await route.fallback();
  });
  await refresh(page); await expect(card(page, id).getByText('Preview unavailable')).toBeVisible();
  await expect(card(page, id).locator('img')).toHaveCount(0);
  await card(page, id).getByRole('link', { name: 'Open Missing preview board' }).click();
  await expect(page.locator('affine-edgeless-root')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Board name', exact: true })).toHaveValue('Missing preview board');
});
});
