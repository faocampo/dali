import { randomUUID } from 'node:crypto';
import { test, expect } from './fixtures';

test.use({ expectErrors: ['Failed to load resource: the server responded with a status of 401 (Unauthorized)', 'Failed to load resource: the server responded with a status of 404 (Not Found)'] });

test('@03-03-01 private creates have independent IDs and idempotent operation results', async ({ page, context, baseURL }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Synthetic Owner', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
  const member = await (await context.request.get('/api/session')).json();
  const headers = { 'X-Dali-Account': member.accountId, 'X-Dali-Request': '1', Origin: baseURL! };
  const operationId = randomUUID();
  const create = (operation = operationId) => context.request.post('/api/boards', { headers, data: { title: 'Independent synthetic boards', operationId: operation, ownerId: 'forged-owner', grants: [{ memberId: 'forged-member', role: 'editor' }] } });
  const first = await create();
  expect(first.status(), 'authenticated private creation succeeds').toBe(201);
  const a = await first.json();
  expect(a.summary).toMatchObject({ title: 'Independent synthetic boards', role: 'owner', access: 'private', pendingCount: 0, accountId: member.accountId });
  expect(await (await create()).json()).toEqual(a);
  const second = await create(randomUUID()); expect(second.status()).toBe(201);
  const b = await second.json();
  expect(new Set([a.summary.id, a.rootDocId, a.contentDocId, b.summary.id, b.rootDocId, b.contentDocId]).size).toBe(6);
  expect(await (await context.request.get(`/api/operations/${operationId}`, { headers })).json()).toMatchObject({ status: 'completed', result: a });
  const before = await (await context.request.get('/api/boards', { headers })).json();
  const denied = await context.request.get('/api/boards/absent-target', { headers });
  expect(denied.status()).toBe(404); expect(await denied.json()).toEqual({ code: 'BOARD_UNAVAILABLE' });
  expect(await (await context.request.get('/api/boards', { headers })).json()).toEqual(before);
});

test('@03-03-01 BOARD-01 empty creates server-confirmed default and named cards without local authority', async ({ page, context, baseURL }) => {
  await page.goto('/'); await page.getByRole('link', { name: 'Synthetic Viewer', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Create your first board' })).toBeVisible();
  await page.getByRole('button', { name: 'New board', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Open Untitled board', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Board name' }).fill('  Named synthetic board  ');
  await page.getByRole('button', { name: 'New board', exact: true }).click();
  const card = page.getByRole('link', { name: 'Open Named synthetic board', exact: true }); await expect(card).toBeVisible();
  await card.click(); await expect(page.getByRole('heading', { name: 'Named synthetic board', exact: true })).toBeVisible();
  await expect(page.locator('affine-editor-container')).toHaveCount(0);
  expect(await page.evaluate(async () => (await indexedDB.databases()).length)).toBe(0);
  await page.getByRole('link', { name: 'Back to your boards' }).click();
  await expect(page.getByRole('link', { name: 'Open Named synthetic board', exact: true })).toBeVisible();
  const member = await (await context.request.get('/api/session')).json();
  const headers = { 'X-Dali-Account': member.accountId, Origin: baseURL!, 'X-Dali-Request': '1' };
  const before = await (await context.request.get('/api/boards', { headers })).json();
  await page.evaluate(() => localStorage.setItem('djai-design.active-board', 'remembered-foreign-target'));
  for (const target of ['missing-target', '']) {
    await page.goto('/?board=' + target); await expect(page.getByRole('heading', { name: "You don't have access to this board" })).toBeVisible();
    await expect(page.locator('[data-board-id]')).toHaveCount(0);
  }
  expect(await (await context.request.get('/api/boards', { headers })).json()).toEqual(before);
});

test('@03-03-01 D-05 D-13 foreign target and library conceal canary and preserve owner descriptor', async ({ page, context, browser, baseURL }) => {
  await page.goto('/'); await page.getByRole('link', { name: 'Synthetic Owner', exact: true }).click();
  const owner = await (await context.request.get('/api/session')).json();
  const headers = { 'X-Dali-Account': owner.accountId, 'X-Dali-Request': '1', Origin: baseURL! };
  const canary = 'foreign-secret-' + randomUUID();
  const created = await context.request.post('/api/boards', { headers, data: { title: canary, operationId: randomUUID() } });
  expect(created.status()).toBe(201); const descriptor = await created.json();
  const stranger = await browser.newContext({ baseURL });
  try {
    const tab = await stranger.newPage(); await tab.goto('/auth/start'); await tab.getByRole('link', { name: 'Synthetic Non-member', exact: true }).click();
    await expect(tab.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
    const other = await (await stranger.request.get('/api/session')).json();
    const otherHeaders = { 'X-Dali-Account': other.accountId };
    const list = await stranger.request.get('/api/boards', { headers: otherHeaders }); expect(await list.text()).not.toContain(canary);
    const foreign = await stranger.request.get('/api/boards/' + descriptor.summary.id, { headers: otherHeaders });
    const absent = await stranger.request.get('/api/boards/absent', { headers: otherHeaders });
    expect(foreign.status()).toBe(404); expect(await foreign.json()).toEqual(await absent.json());
    await tab.goto('/?board=' + descriptor.summary.id);
    await expect(tab.getByRole('heading', { name: "You don't have access to this board" })).toBeVisible();
    expect(await tab.locator('body').innerText()).not.toContain(canary);
    expect(await (await context.request.get('/api/boards/' + descriptor.summary.id, { headers })).json()).toEqual(descriptor);
  } finally { await stranger.close(); }
});

test.describe('lost create response', () => {
test.use({ expectErrors: ['Failed to load resource: the server responded with a status of 401 (Unauthorized)', 'Failed to load resource: net::ERR_TIMED_OUT'] });
test('@03-03-01 uncertain create response reconciles operation before any second create', async ({ page }) => {
  await page.goto('/'); await page.getByRole('link', { name: 'Synthetic Editor', exact: true }).click();
  let posts = 0; let lookups = 0;
  await page.route('**/api/boards', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    posts++; await route.fetch(); await route.abort('timedout');
  });
  await page.route('**/api/operations/*', route => { lookups++; return route.continue(); });
  await page.getByRole('textbox', { name: 'Board name' }).fill('Reconciled synthetic board');
  await page.getByRole('button', { name: 'New board', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Open Reconciled synthetic board', exact: true })).toBeVisible();
  expect(posts).toBe(1); expect(lookups).toBe(1);
});
});
