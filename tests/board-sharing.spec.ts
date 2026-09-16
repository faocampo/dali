import { randomBytes, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Page, Route } from '@playwright/test';
import { test, expect } from './fixtures';
import { createOidcProvider, IDENTITY_COOKIE } from './oidc-provider';
import { buildApp } from '../server/app';
import { openDatabase, type AccountDatabase } from '../server/storage/database';

// The production shell and application use an isolated real HTTP listener and
// repository in this test process; every browser completes signed OIDC login.
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
  app.get('/*', async (request, reply) => {
    const response = await fetch(baseURL! + request.url);
    return reply.type(response.headers.get('content-type') ?? 'text/html').send(Buffer.from(await response.arrayBuffer()));
  });
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
test.afterEach(async ({ page }) => { await page.unrouteAll({ behavior: 'ignoreErrors' }); await app?.close(); database?.close(); await provider?.close(); });
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


test('@03-07-01 owner grants pending Viewer access and revokes with acknowledgment', async ({ page }) => {
  const id = seed('Sharing board'); await refresh(page);
  await expect(card(page, id).getByRole('button', { name: 'Share board' })).toBeVisible();
  await card(page, id).getByRole('button', { name: 'Share board' }).click();
  const dialog = page.getByRole('dialog', { name: 'Share board' });
  await expect(dialog.getByText('Only you have access')).toBeVisible();
  await dialog.getByRole('combobox', { name: 'Internal member or email' }).fill('waiting@example.org');
  await dialog.getByRole('option', { name: /waiting@example.org/ }).click();
  await expect(dialog.getByLabel('New recipient role')).toHaveValue('viewer');
  await dialog.getByRole('button', { name: 'Grant access', exact: true }).click();
  const row = dialog.locator('[data-grant-id]').filter({ hasText: 'waiting@example.org' });
  await expect(row).toContainText('Pending member sign-in');
  expect(database.prepare('SELECT role FROM pending_grants WHERE board_id=?').get(id)).toEqual({ role: 'viewer' });
  await row.getByRole('button', { name: 'Revoke access' }).click();
  await expect(dialog.getByRole('button', { name: 'Keep access' })).toBeFocused();
  await dialog.getByRole('button', { name: 'Confirm revoke' }).click();
  await expect(row).toHaveCount(0);
  expect(database.prepare('SELECT * FROM pending_grants WHERE board_id=?').all(id)).toEqual([]);
});

test('@03-07-01 existing members default Viewer and link copy preserves grants', async ({ page }) => {
  const id = seed('Active access'); await refresh(page);
  await card(page, id).getByRole('button', { name: 'Share board' }).click();
  const dialog = page.getByRole('dialog', { name: 'Share board' });
  await dialog.getByRole('combobox', { name: 'Internal member or email' }).fill('Other');
  await dialog.getByRole('option', { name: /Synthetic Other/ }).click();
  await expect(dialog.getByLabel('New recipient role')).toHaveValue('viewer');
  await dialog.getByLabel('New recipient role').selectOption('editor');
  await dialog.getByRole('button', { name: 'Grant access', exact: true }).click();
  const row = dialog.locator('[data-grant-id]').filter({ hasText: 'other@example.org' });
  await expect(row).toContainText('Active');
  await row.getByLabel('Access role').selectOption('viewer');
  expect(database.prepare('SELECT role FROM board_grants WHERE board_id=?').get(id)).toEqual({ role: 'editor' });
  await row.getByRole('button', { name: 'Save access' }).click();
  await expect(row.locator('span').getByText('Viewer', { exact: true })).toBeVisible();
  const before = database.prepare('SELECT * FROM board_grants WHERE board_id=?').all(id);
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('unavailable'); } }, configurable: true }));
  await dialog.getByRole('button', { name: 'Copy board link' }).click();
  await expect(dialog.getByLabel('Board link')).toHaveValue(origin + '/?board=' + id);
  expect(database.prepare('SELECT * FROM board_grants WHERE board_id=?').all(id)).toEqual(before);
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(card(page, id).getByRole('button', { name: 'Share board' })).toBeFocused();
});

test('@03-07-01 direct non-owner grant reads and mutations deny with unchanged owner state', async ({ page }) => {
  const id = seed('Private sharing canary'); await refresh(page);
  const cookieOf = (response: { headers: Record<string, unknown> }) => { const cookies = response.headers['set-cookie']; return (Array.isArray(cookies) ? cookies.at(-1) : cookies)?.split(';')[0] as string; };
  const ownerHeaders = { 'x-dali-account': accountId, 'x-dali-request': '1', origin };
  const url = origin + '/api/boards/' + id + '/grants';
  const added = await page.request.post(url, { headers: ownerHeaders, data: { email: 'waiting@example.org', revision: 1, operationId: randomUUID() } });
  expect(added.status()).toBe(200); const state = await added.json(); const target = state.grants[0];
  for (const actor of ['editor', 'viewer', 'nonMember']) {
    const start = await app.inject('/auth/start');
    const authorization = await fetch(start.headers.location!, { redirect: 'manual', headers: { cookie: `${IDENTITY_COOKIE}=${actor}` } });
    const callback = new URL(authorization.headers.get('location')!);
    const authenticated = await app.inject({ url: callback.pathname + callback.search, headers: { cookie: cookieOf(start) } });
    const cookie = cookieOf(authenticated); const session = await app.inject({ url: '/api/session', headers: { cookie } }); expect(session.statusCode).toBe(200);
    const member = session.json().accountId;
    if (actor !== 'nonMember') database.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?)').run(id, member, actor);
    const before = await (await page.request.get(url, { headers: ownerHeaders })).json();
    const headers = { cookie, origin, 'x-dali-account': member, 'x-dali-request': '1' };
    for (const method of ['GET', 'POST', 'PATCH', 'DELETE'] as const) {
      const response = await app.inject({ method, url: '/api/boards/' + id + '/grants' + (['PATCH', 'DELETE'].includes(method) ? '/' + target.id : ''), headers,
        ...(method === 'GET' ? {} : { payload: { revision: target.revision, operationId: randomUUID(), role: 'editor' } }) });
      expect(response.statusCode).toBe(actor === 'nonMember' ? 404 : 403); expect(response.body).not.toContain('waiting@example.org');
      expect(await (await page.request.get(url, { headers: ownerHeaders })).json()).toEqual(before);
    }
    const search = await app.inject({ url: '/api/members?boardId=' + id + '&q=owner', headers }); expect(search.statusCode).toBe(actor === 'nonMember' ? 404 : 403);
  }
  const revoke = { revision: target.revision, operationId: randomUUID() };
  for (let i = 0; i < 2; i++) expect((await page.request.delete(url + '/' + target.id, { headers: ownerHeaders, data: revoke })).status()).toBe(200);
  expect(database.prepare('SELECT * FROM pending_grants WHERE board_id=?').all(id)).toEqual([]);
  const stale = await page.request.patch(url + '/' + target.id, { headers: ownerHeaders, data: { revision: target.revision, operationId: randomUUID(), role: 'editor' } }); expect(stale.status()).toBe(409);
  expect(database.prepare('SELECT * FROM pending_grants WHERE board_id=?').all(id)).toEqual([]);
});

test('@03-07-02 UI-SHARE-empty partial keyboard and IME do not submit invalid recipients', async ({ page }) => {
  const id = seed('Recipient validation'); await refresh(page); await card(page, id).getByRole('button', { name: 'Share board' }).click();
  const dialog = page.getByRole('dialog', { name: 'Share board' }); const input = dialog.getByRole('combobox', { name: 'Internal member or email' });
  for (const query of ['', 'invalid', 'outside@external.example']) {
    await input.fill(query); await expect(dialog.getByRole('button', { name: 'Grant access', exact: true })).toBeDisabled();
    if (query) await expect(dialog.getByText('No matching members. Enter an eligible internal email.')).toBeVisible();
    expect(database.prepare('SELECT * FROM pending_grants WHERE board_id=?').all(id)).toEqual([]);
  }
  await input.fill('Other'); await expect(dialog.locator('[role=option]')).toHaveCount(1);
  await input.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true });
  await expect(dialog.getByRole('button', { name: 'Grant access', exact: true })).toBeDisabled();
  await input.press('ArrowDown'); await input.press('ArrowUp'); await input.press('Enter');
  await expect(dialog.getByLabel('New recipient role')).toHaveValue('viewer');
  await expect(dialog.getByRole('button', { name: 'Grant access', exact: true })).toBeEnabled();
  await input.fill('waiting@example.org'); await expect(dialog.locator('[role=option]')).toHaveCount(1);
  await input.press('Escape'); await expect(dialog).toBeVisible(); await expect(dialog.locator('[role=option]')).toHaveCount(0);
  await input.press('ArrowDown'); await input.press('Enter');
  await dialog.getByLabel('New recipient role').selectOption('editor');
  await input.fill('other@example.org'); await expect(dialog.locator('[role=option]')).toHaveCount(1); await input.press('Enter');
  await expect(dialog.getByLabel('New recipient role')).toHaveValue('viewer');
  await dialog.getByRole('button', { name: 'Close', exact: true }).focus(); await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Copy board link' })).toBeFocused();
});

test('@03-07-02 UI-SHARE-loading ignores stale search responses and recovers search failure', async ({ page }) => {
  const id = seed('Search ordering'); await refresh(page); await card(page, id).getByRole('button', { name: 'Share board' }).click();
  const dialog = page.getByRole('dialog', { name: 'Share board' }); const input = dialog.getByRole('combobox', { name: 'Internal member or email' });
  let release!: () => void; const wait = new Promise<void>(resolve => { release = resolve; }); let started!: () => void; const requested = new Promise<void>(resolve => { started = resolve; });
  await page.route('**/api/members?**', async route => {
    if (new URL(route.request().url()).searchParams.get('q') === 'Other') { const response = await route.fetch(); started(); await wait; await route.fulfill({ response }).catch(() => {}); }
    else await route.continue();
  });
  await input.fill('Other'); await requested; await expect(dialog.getByText('Searching members…')).toBeVisible();
  await input.fill('waiting@example.org'); await expect(dialog.locator('[role=option]')).toContainText('waiting@example.org');
  release(); await expect(dialog.locator('[role=option]')).toHaveCount(1); await expect(dialog.locator('[role=option]')).not.toContainText('Synthetic Other');
  await page.unroute('**/api/members?**');
  let failed = true;
  await page.route('**/api/members?**', route => failed ? route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }) : route.continue());
  await input.fill('Other'); await expect(dialog.getByRole('alert')).toContainText("We couldn't search members.");
  failed = false; await dialog.getByRole('button', { name: 'Try search again' }).click(); await expect(dialog.locator('[role=option]')).toContainText('Synthetic Other');
});

test('@03-07-02 UI-SHARE-error grant and revoke failures preserve state and reconcile before retry', async ({ page }) => {
  const id = seed('Access failures'); await refresh(page); await card(page, id).getByRole('button', { name: 'Share board' }).click();
  const dialog = page.getByRole('dialog', { name: 'Share board' }); let fail = true; const events: string[] = [];
  await page.route('**/api/operations/*', async route => { events.push('reconcile'); await route.continue(); });
  await page.route('**/grants{,/*}', async route => { const method = route.request().method(); if (method === 'GET') return route.continue(); events.push(method); if (fail) await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }); else await route.continue(); });
  await dialog.getByRole('combobox', { name: 'Internal member or email' }).fill('waiting@example.org'); await dialog.locator('[role=option]').click();
  await dialog.getByRole('button', { name: 'Grant access', exact: true }).click(); await expect(dialog.getByRole('alert')).toContainText("We couldn't update access.");
  expect(database.prepare('SELECT * FROM pending_grants WHERE board_id=?').all(id)).toEqual([]);
  fail = false; await dialog.getByRole('button', { name: 'Grant access', exact: true }).click();
  const row = dialog.locator('[data-grant-id]'); await expect(row).toHaveCount(1); expect(events.slice(0, 4)).toEqual(['POST', 'reconcile', 'reconcile', 'POST']);
  fail = true; await row.getByRole('button', { name: 'Revoke access' }).click(); await dialog.getByRole('button', { name: 'Confirm revoke' }).click();
  await expect(row.getByRole('alert')).toContainText("We couldn't update access."); await expect(row).toContainText('Pending member sign-in');
  await expect(row.getByRole('button', { name: 'Check access' })).toBeEnabled();
  await expect(row.getByRole('button', { name: 'Save access' })).toBeDisabled();
  expect(database.prepare('SELECT * FROM pending_grants WHERE board_id=?').all(id)).toHaveLength(1);
  fail = false; await dialog.getByRole('button', { name: 'Confirm revoke' }).click(); await expect(row).toHaveCount(0);
  await expect(dialog.getByRole('combobox', { name: 'Internal member or email' })).toBeFocused();
});

test('@03-07-02 owner control loss closes stale sharing and direct mutations preserve access', async ({ page }) => {
  const editor = seed('Editor actions', { role: 'editor' }); const viewer = seed('Viewer actions', { role: 'viewer' }); const id = seed('Ownership check'); await refresh(page);
  for (const boardId of [editor, viewer]) await expect(card(page, boardId).getByRole('button', { name: 'Share board' })).toHaveCount(0);
  await card(page, id).getByRole('button', { name: 'Share board' }).click(); const dialog = page.getByRole('dialog', { name: 'Share board' });
  await dialog.getByRole('combobox', { name: 'Internal member or email' }).fill('waiting@example.org'); await dialog.locator('[role=option]').click();
  database.prepare('UPDATE boards SET owner_id=? WHERE id=?').run('synthetic-other', id);
  await dialog.getByRole('button', { name: 'Grant access', exact: true }).click(); await expect(dialog).toHaveCount(0); await expect(card(page, id)).toHaveCount(0);
  expect(database.prepare('SELECT * FROM pending_grants WHERE board_id=?').all(id)).toEqual([]);
});

test('@03-07-02 UI-SHARE-loading row isolation and lost-response reconciliation preserve acknowledged roles', async ({ page }) => {
  const id = seed('Row pending');
  for (const email of ['first@example.org', 'second@example.org']) database.prepare('INSERT INTO pending_grants(board_id,issuer,canonical_email,role) VALUES(?,?,?,?)').run(id, provider.issuer, email, 'viewer');
  await refresh(page); await card(page, id).getByRole('button', { name: 'Share board' }).click();
  const dialog = page.getByRole('dialog', { name: 'Share board' }); const first = dialog.locator('[data-grant-id]').filter({ hasText: 'first@example.org' }); const second = dialog.locator('[data-grant-id]').filter({ hasText: 'second@example.org' });
  let release!: () => void; const wait = new Promise<void>(resolve => { release = resolve; }); let patches = 0; let reconciles = 0;
  await page.route('**/api/operations/*', async route => { reconciles++; await route.continue(); });
  await page.route('**/grants/*', async route => { if (route.request().method() !== 'PATCH') return route.continue(); patches++; await route.fetch(); await wait; await route.abort(); });
  await first.getByLabel('Access role').selectOption('editor'); await first.getByRole('button', { name: 'Save access' }).click();
  await expect(first).toHaveAttribute('aria-busy', 'true'); await expect(second.getByRole('button', { name: 'Save access' })).toBeEnabled();
  await expect(first.locator('span').getByText('Viewer', { exact: true })).toBeVisible();
  // Let the real ten-second request timeout fire after the service committed.
  await expect(first.locator('span').getByText('Editor', { exact: true })).toBeVisible(); release(); expect(patches).toBe(1); expect(reconciles).toBe(1);
});

for (const count of [0, 1, 50]) test(`@03-07-02 UI-SHARE-zero-one-many ${count} rows and long-text overflow at 490px`, async ({ page }) => {
  await page.setViewportSize({ width: 490, height: 700 });
  const id = seed('Long board ' + 'Q'.repeat(120));
  for (let index = 0; index < count; index++) {
    const email = String(index).padStart(2, '0') + 'long'.repeat(30) + '@example.org';
    database.prepare('INSERT INTO pending_grants(board_id,issuer,canonical_email,role) VALUES(?,?,?,?)').run(id, provider.issuer, email, 'viewer');
    database.prepare('INSERT INTO members(id,issuer,subject,email,canonical_email,display_name) VALUES(?,?,?,?,?,?)').run('search-' + index, provider.issuer, 'search-' + index, email, email, 'Equal Name');
  }
  await refresh(page); await card(page, id).getByRole('button', { name: 'Share board' }).click();
  const dialog = page.getByRole('dialog', { name: 'Share board' }); const rows = dialog.locator('[data-grant-id]'); await expect(rows).toHaveCount(count);
  await expect(dialog.locator('.share-owner')).toContainText('Owner'); await expect(dialog.locator('.share-owner button, .share-owner select')).toHaveCount(0);
  if (!count) await expect(dialog.getByText('Only you have access')).toBeVisible();
  const input = dialog.getByRole('combobox', { name: 'Internal member or email' }); await input.fill('Equal Name');
  if (count) {
    await expect(dialog.locator('[role=option]')).toHaveCount(count);
    const names = await dialog.locator('[role=option]').allTextContents(); expect(names).toEqual([...names].sort());
    await input.press('Escape'); const last = rows.last(); await last.getByRole('button', { name: 'Revoke access' }).focus();
    const bounds = await last.getByRole('button', { name: 'Revoke access' }).boundingBox(); const footer = await dialog.locator('footer').boundingBox(); expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(footer!.y + 1);
    await last.getByRole('button', { name: 'Revoke access' }).click(); await expect(dialog.getByRole('button', { name: 'Keep access' })).toBeFocused();
    await expect(dialog.getByRole('alertdialog')).toContainText('long'.repeat(30));
    await dialog.getByRole('button', { name: 'Keep access' }).click();
  } else await expect(dialog.getByText('No matching members. Enter an eligible internal email.')).toBeVisible();
  const geometry = await dialog.evaluate(node => ({ width: node.getBoundingClientRect().width, scroll: node.scrollWidth, client: node.clientWidth, body: node.querySelector('.share-dialog__body')!.scrollHeight > node.querySelector('.share-dialog__body')!.clientHeight }));
  expect(geometry.width).toBeLessThanOrEqual(490); expect(geometry.scroll).toBeLessThanOrEqual(geometry.client + 1); if (count === 50) expect(geometry.body).toBe(true);
  const targets = await dialog.locator('button,input,select').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height)); expect(targets.every(height => height >= 44)).toBe(true);
  await expect(dialog.getByRole('button', { name: 'Copy board link' })).toBeInViewport();
});
