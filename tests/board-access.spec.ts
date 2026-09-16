import { randomUUID } from 'node:crypto';
import { test, expect } from './fixtures';
import type { GfxController } from '@blocksuite/affine/std/gfx';
import { syntheticCanaries } from './access-fixtures';
import { fileAction } from './app-menu';

test('@03-06-02 two New commands create distinct private tabs and preserve the source board', async ({ page, context, baseURL }) => {
  await page.goto('/'); await page.getByRole('link', { name: 'Synthetic Owner', exact: true }).click();
  const member = await (await context.request.get('/api/session')).json();
  const headers = { 'X-Dali-Account': member.accountId, 'X-Dali-Request': '1', Origin: baseURL! };
  const board = await (await context.request.post('/api/boards', { headers, data: { operationId: randomUUID(), title: 'Preserved source title' } })).json();
  await page.goto('/?board=' + board.summary.id); await expect(page.locator('editor-host')).toBeVisible();
  await page.getByRole('button', { name: 'Add mind map', exact: true }).click(); await page.keyboard.press('Escape');
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  const sourceBytes = await (await context.request.post(`/api/boards/${board.summary.id}/docs/${board.contentDocId}/pull`, { headers: { ...headers, 'Content-Type': 'application/octet-stream' }, data: Buffer.from([0]) })).body();
  const destinations: string[] = []; const errors: string[] = [];
  for (let index = 0; index < 2; index++) {
    const opened = context.waitForEvent('page'); await fileAction(page, 'New'); const tab = await opened;
    tab.on('pageerror', error => errors.push(error.message));
    await expect(tab.locator('editor-host'), 'each New command opens an authorized native board').toBeVisible();
    const id = new URL(tab.url()).searchParams.get('board')!; destinations.push(id);
    const result = await (await context.request.get('/api/boards/' + id, { headers })).json();
    expect(result.summary).toMatchObject({ role: 'owner', access: 'private', title: 'Untitled board', accountId: member.accountId });
    await tab.close();
  }
  expect(new Set([board.summary.id, ...destinations]).size).toBe(3);
  expect(new URL(page.url()).searchParams.get('board')).toBe(board.summary.id);
  await expect(page.getByRole('heading', { name: 'Preserved source title' })).toBeVisible();
  expect(await (await context.request.post(`/api/boards/${board.summary.id}/docs/${board.contentDocId}/pull`, { headers: { ...headers, 'Content-Type': 'application/octet-stream' }, data: Buffer.from([0]) })).body()).toEqual(sourceBytes);
  expect(errors).toEqual([]);
});

test('@03-06-01 authorized deep link mounts native editing and cold reopen retains acknowledged content', async ({ page, context, browser, baseURL }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Synthetic Owner', exact: true }).click();
  const member = await (await context.request.get('/api/session')).json();
  const headers = { 'X-Dali-Account': member.accountId, 'X-Dali-Request': '1', Origin: baseURL! };
  const created = await context.request.post('/api/boards', { headers, data: { title: 'Native shell canary', operationId: randomUUID() } });
  expect(created.status()).toBe(201);
  const board = await created.json();
  await page.goto('/?board=' + board.summary.id);
  await expect(page.locator('editor-host'), 'authorized account board mounts the native canvas').toBeVisible();
  await page.getByRole('button', { name: 'Add mind map', exact: true }).click();
  await expect.poll(() => page.locator('affine-edgeless-root').evaluate(el => (el as HTMLElement & { gfx: GfxController }).gfx.surface!.elementModels.filter(model => model.type === 'mindmap').length)).toBe(1);
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  const cold = await browser.newContext({ baseURL });
  try {
    const tab = await cold.newPage();
    await tab.goto('/?board=' + board.summary.id);
    await expect(tab.locator('editor-host')).toHaveCount(0);
    await tab.getByRole('link', { name: 'Synthetic Owner', exact: true }).click();
    await expect(tab.locator('editor-host')).toBeVisible();
    await expect.poll(() => tab.locator('affine-edgeless-root').evaluate(el => (el as HTMLElement & { gfx: GfxController }).gfx.surface!.elementModels.filter(model => model.type === 'mindmap').length)).toBe(1);
    expect(new URL(tab.url()).searchParams.get('board')).toBe(board.summary.id);
  } finally { await cold.close(); }
});

test.use({ expectErrors: ['Failed to load resource: the server responded with a status of 401 (Unauthorized)', 'Failed to load resource: the server responded with a status of 404 (Not Found)'] });

test('@03-06-01 loading blank board gates mutations and native history publishes acknowledged preview', async ({ page, context, baseURL }) => {
  await page.goto('/'); await page.getByRole('link', { name: 'Synthetic Owner', exact: true }).click();
  const member = await (await context.request.get('/api/session')).json();
  const headers = { 'X-Dali-Account': member.accountId, 'X-Dali-Request': '1', Origin: baseURL! };
  const board = await (await context.request.post('/api/boards', { headers, data: { operationId: randomUUID() } })).json();
  let release!: () => void;
  const hold = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/boards/' + board.summary.id, async route => { await hold; await route.continue(); });
  await page.goto('/?board=' + board.summary.id);
  await expect(page.getByText('Opening board…', { exact: true })).toBeVisible();
  await expect(page.locator('editor-host')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add mind map', exact: true })).toHaveCount(0);
  release();
  await expect(page.locator('editor-host')).toBeVisible();
  await page.getByRole('button', { name: 'Main Menu', exact: false }).click(); await page.getByRole('menuitem', { name: 'File', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Export board', exact: true }).click();
  await page.getByRole('radio', { name: 'PNG image' }).check();
  await expect(page.getByRole('dialog')).toContainText(/nothing|empty|add/i);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  const push = page.waitForResponse(response => response.url().includes('/docs/') && response.url().endsWith('/push') && response.ok());
  await page.getByRole('button', { name: 'Add mind map', exact: true }).click(); await page.keyboard.press('Escape'); await push;
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  await expect.poll(async () => (await context.request.get(`/api/boards/${board.summary.id}/thumbnail`, { headers })).status()).toBe(200);
  const preview = await context.request.get(`/api/boards/${board.summary.id}/thumbnail`, { headers });
  expect((await preview.body()).subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  await page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    gfx.doc.captureSync(); gfx.surface!.addElement({ type: 'shape', xywh: '[300,300,100,100]', fillColor: '#2468ab' }); gfx.doc.captureSync();
  });
  const count = () => page.locator('affine-edgeless-root').evaluate(el => (el as HTMLElement & { gfx: GfxController }).gfx.surface!.elementModels.filter(model => model.type === 'shape' && model.xywh === '[300,300,100,100]').length);
  await expect.poll(count).toBe(1);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('dali:board-command', { detail: 'undo' })));
  await expect.poll(count).toBe(0);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('dali:board-command', { detail: 'redo' })));
  await expect.poll(count).toBe(1);
  expect(await page.evaluate(async () => (await indexedDB.databases()).length)).toBe(0);
});

test.describe('native source authorization rejection', () => {
test.use({ expectErrors: ['401 (Unauthorized)', '404 (Not Found)', 'SourceAccessError: Board access changed'] });
test('@03-06-01 image loading missing retry and lost authorization clear protected pixels', async ({ page, context, baseURL }) => {
  await page.goto('/'); await page.getByRole('link', { name: 'Synthetic Owner', exact: true }).click();
  const member = await (await context.request.get('/api/session')).json();
  const headers = { 'X-Dali-Account': member.accountId, 'X-Dali-Request': '1', Origin: baseURL! };
  const board = await (await context.request.post('/api/boards', { headers, data: { operationId: randomUUID(), title: 'Image access canary' } })).json();
  await page.goto('/?board=' + board.summary.id);
  await page.locator('input[type=file][accept="image/*"]').setInputFiles({ name: 'synthetic-canary.png', mimeType: 'image/png', buffer: syntheticCanaries().imageBytes });
  await expect(page.locator('affine-edgeless-image img')).toBeVisible();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  let release!: () => void; const hold = new Promise<void>(resolve => { release = resolve; });
  let phase: 'missing' | 'ready' | 'denied' = 'missing'; let reads = 0;
  await page.route('**/api/boards/*/blobs/*', async route => {
    if (route.request().method() !== 'GET') return route.continue(); reads++;
    if (phase === 'ready') return route.continue();
    if (phase === 'missing') { await hold; return route.fulfill({ status: 404, contentType: 'application/json', body: '{"code":"IMAGE_UNAVAILABLE"}' }); }
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{"code":"BOARD_UNAVAILABLE"}' });
  });
  await page.reload(); await expect(page.getByText('Loading images…')).toBeVisible();
  release(); await expect(page.getByRole('button', { name: 'Retry images' })).toBeVisible();
  await expect(page.locator('affine-edgeless-image img')).toHaveCount(0);
  phase = 'ready'; await page.getByRole('button', { name: 'Retry images' }).click();
  await expect(page.locator('affine-edgeless-image img')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry images' })).toHaveCount(0); expect(reads).toBeGreaterThanOrEqual(2);
  phase = 'denied'; await page.reload();
  await expect(page.getByRole('heading', { name: "You don't have access to this board" })).toBeVisible();
  await expect(page.locator('editor-host')).toHaveCount(0); await expect(page.locator('img[src^="blob:"]')).toHaveCount(0);
  expect(await page.locator('body').innerText()).not.toContain('Image access canary');
});
});

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

test('@03-03-01 @03-06-01 D-05 D-13 foreign target and library conceal canary and preserve owner descriptor', async ({ page, context, browser, baseURL }) => {
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
    await expect(tab.locator('editor-host')).toHaveCount(0);
    expect(await tab.evaluate(async () => (await indexedDB.databases()).length)).toBe(0);
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
