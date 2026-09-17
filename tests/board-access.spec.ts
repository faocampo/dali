import { randomUUID } from 'node:crypto';
import { test, expect, waitForAuthenticatedLibrary } from './fixtures';
import type { GfxController } from '@blocksuite/affine/std/gfx';
import { acceptanceService, syntheticCanaries } from './access-fixtures';
import { fileAction } from './app-menu';
import type { Page } from '@playwright/test';

async function journalRecords(page: Page) {
  return page.evaluate(() => new Promise<{ boardId: string; kind: string }[]>((resolve, reject) => {
    const request = indexedDB.open('dali-account-recovery-v1', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result; const transaction = db.transaction('journal', 'readonly');
      const records = transaction.objectStore('journal').getAll();
      transaction.oncomplete = () => { db.close(); resolve(records.result); };
      transaction.onabort = transaction.onerror = () => { db.close(); reject(transaction.error); };
    };
  }));
}
async function expectAcknowledgedJournal(page: Page, retained: unknown[] = []) {
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  expect(await page.evaluate(async () => (await indexedDB.databases()).map(db => db.name))).toEqual(['dali-account-recovery-v1']);
  await expect.poll(() => journalRecords(page)).toEqual(retained);
}

test('@03-06-02 two New commands create distinct private tabs and preserve the source board', async ({ page, context, baseURL }) => {
  await page.goto('/'); await page.getByRole('link', { name: 'Synthetic Owner', exact: true }).click();
  await waitForAuthenticatedLibrary(page);
  const member = await (await context.request.get('/api/session')).json();
  const headers = { 'X-Dali-Account': member.accountId, 'X-Dali-Request': '1', Origin: baseURL! };
  const board = await (await context.request.post('/api/boards', { headers, data: { operationId: randomUUID(), title: 'Preserved source title' } })).json();
  await page.goto('/?board=' + board.summary.id); await expect(page.locator('editor-host')).toBeVisible();
  await page.getByRole('button', { name: 'Add mind map', exact: true }).click(); await page.keyboard.press('Escape');
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  const sourceBytes = await (await context.request.post(`/api/boards/${board.summary.id}/docs/${board.contentDocId}/pull`, { headers: { ...headers, 'Content-Type': 'application/octet-stream' }, data: Buffer.from([0]) })).body();
  const destinations: string[] = []; const errors: string[] = [];
  for (let index = 0; index < 2; index++) {
    let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/api/boards', async route => { if (route.request().method() !== 'POST') return route.continue(); const response = await route.fetch(); await gate; await route.fulfill({ response }); });
    const opened = context.waitForEvent('page'); await fileAction(page, 'New'); const tab = await opened;
    tab.on('pageerror', error => errors.push(error.message));
    try { await expect(tab.getByRole('status')).toHaveText('Creating board…'); expect(tab.url()).toBe('about:blank'); } finally { release(); }
    await expect(tab.locator('editor-host'), 'each New command opens an authorized native board').toBeVisible();
    const id = new URL(tab.url()).searchParams.get('board')!; destinations.push(id);
    const result = await (await context.request.get('/api/boards/' + id, { headers })).json();
    expect(result.summary).toMatchObject({ role: 'owner', access: 'private', title: 'Untitled board', accountId: member.accountId });
    await tab.close();
  }
  expect(new Set([board.summary.id, ...destinations]).size).toBe(3);
  expect(new URL(page.url()).searchParams.get('board')).toBe(board.summary.id);
  await expect(page.getByRole('textbox', { name: 'Board name', exact: true })).toHaveValue('Preserved source title');
  expect(await (await context.request.post(`/api/boards/${board.summary.id}/docs/${board.contentDocId}/pull`, { headers: { ...headers, 'Content-Type': 'application/octet-stream' }, data: Buffer.from([0]) })).body()).toEqual(sourceBytes);
  expect(errors).toEqual([]);
});

test.describe('blocked popup and interrupted creation', () => {
test.use({ expectErrors: ['401 (Unauthorized)', '503 (Service Unavailable)', 'net::ERR_TIMED_OUT'] });
test('@03-06-02 blocked popup retry reconciles one committed destination without touching source', async ({ page, context, baseURL }) => {
  await page.goto('/'); await page.getByRole('link', { name: 'Synthetic Owner', exact: true }).click();
  await waitForAuthenticatedLibrary(page);
  const member = await (await context.request.get('/api/session')).json();
  const headers = { 'X-Dali-Account': member.accountId, 'X-Dali-Request': '1', Origin: baseURL! };
  const board = await (await context.request.post('/api/boards', { headers, data: { operationId: randomUUID(), title: 'Popup source canary' } })).json();
  await page.goto('/?board=' + board.summary.id); await expect(page.locator('editor-host')).toBeVisible();
  const before = await (await context.request.get('/api/boards', { headers })).json();
  await page.evaluate(() => { window.open = () => null; });
  let posts = 0; let operations = 0;
  await page.route('**/api/boards', async route => { if (route.request().method() !== 'POST') return route.continue(); posts++; await route.fetch(); await route.abort('timedout'); });
  await page.route('**/api/operations/*', route => { operations++; return operations === 2 ? route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }) : route.continue(); });
  await fileAction(page, 'New'); await expect(page.getByRole('button', { name: 'Retry new board' })).toBeVisible();
  await page.getByRole('button', { name: 'Retry new board' }).click();
  const link = page.getByRole('link', { name: 'Open new board', exact: true }); await expect(link).toBeVisible();
  expect(posts).toBe(1); expect(operations).toBe(3);
  const after = await (await context.request.get('/api/boards', { headers })).json(); expect(after).toHaveLength(before.length + 1);
  const href = await link.getAttribute('href'); expect(href).toMatch(/^\/\?board=/);
  expect(new URL(page.url()).searchParams.get('board')).toBe(board.summary.id);
  await expect(page.getByRole('textbox', { name: 'Board name', exact: true })).toHaveValue('Popup source canary');
  const copy = await (await context.request.get('/api/boards/' + new URL(href!, baseURL!).searchParams.get('board'), { headers })).json();
  expect(copy.summary).toMatchObject({ role: 'owner', access: 'private', accountId: member.accountId });
});
});

test('@03-06-02 valid new intent survives OIDC and reload reconciles the same operation', async ({ page, context }) => {
  const operationId = randomUUID(); await page.goto('/?new=1&operationId=' + operationId);
  await page.getByRole('link', { name: 'Synthetic Editor', exact: true }).click();
  await expect(page.locator('editor-host')).toBeVisible();
  const boardId = new URL(page.url()).searchParams.get('board'); expect(boardId).toBeTruthy();
  const member = await (await context.request.get('/api/session')).json(); const headers = { 'X-Dali-Account': member.accountId };
  expect(await (await context.request.get('/api/operations/' + operationId, { headers })).json()).toMatchObject({ status: 'completed', result: { summary: { id: boardId, role: 'owner', access: 'private' } } });
  const before = await (await context.request.get('/api/boards', { headers })).json();
  await page.goto('/?new=1&operationId=' + operationId); await expect(page.locator('editor-host')).toBeVisible();
  expect(new URL(page.url()).searchParams.get('board')).toBe(boardId);
  expect(await (await context.request.get('/api/boards', { headers })).json()).toEqual(before);
});

test('@03-06-01 authorized deep link mounts native editing and cold reopen retains acknowledged content', async ({ page, context, browser, baseURL }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Synthetic Owner', exact: true }).click();
  await waitForAuthenticatedLibrary(page);
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
  await waitForAuthenticatedLibrary(page);
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
  await expectAcknowledgedJournal(page);
});

test.describe('native source authorization rejection', () => {
test.use({ expectErrors: ['401 (Unauthorized)', '404 (Not Found)', 'SourceAccessError: Board access changed'] });
test('@03-06-01 image loading missing retry and lost authorization clear protected pixels', async ({ page, context, baseURL, expectErrors, pageErrors }) => {
  let revocationInjected = false;
  const staleCancellationPhases: boolean[] = [];
  const cancellationReads: Promise<void>[] = [];
  page.on('console', message => {
    if (message.type() !== 'error') return;
    const inRevokedPhase = revocationInjected;
    cancellationReads.push(Promise.all(message.args().map(arg => arg.evaluate(value => ({ name: value?.name, message: value?.message })).catch(() => null))).then(args => {
      if (args.some(arg => arg?.message === 'Account source is stale' || (arg?.name === 'SourceAccessError' && arg.message === 'Board access changed'))) staleCancellationPhases.push(inRevokedPhase);
    }));
  });
  await page.goto('/'); await page.getByRole('link', { name: 'Synthetic Owner', exact: true }).click();
  await waitForAuthenticatedLibrary(page);
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
  await Promise.all(cancellationReads); expect(staleCancellationPhases).toEqual([]);
  expect(pageErrors.filter(error => !expectErrors.some(allowed => error.includes(allowed)))).toEqual([]);
  expect(pageErrors.filter(error => error.startsWith('pageerror:'))).toEqual([]);
  // Native ImageEdgelessBlock.refreshData catches and logs an in-flight read
  // rejected by scope disposal. Permit only that console cancellation after
  // the intentional revoke, while retaining the global runtime collector.
  expectErrors.push('console: Error: Account source is stale');
  revocationInjected = true; phase = 'denied'; await page.reload();
  await expect(page.getByRole('heading', { name: "You don't have access to this board" })).toBeVisible();
  await expect(page.locator('editor-host')).toHaveCount(0); await expect(page.locator('img[src^="blob:"]')).toHaveCount(0);
  expect(await page.locator('body').innerText()).not.toContain('Image access canary');
  await Promise.all(cancellationReads);
  expect(staleCancellationPhases.every(inRevokedPhase => inRevokedPhase)).toBe(true);
  expect(pageErrors.filter(error => error.startsWith('pageerror:'))).toEqual([]);
});
});

test('@03-03-01 private creates have independent IDs and idempotent operation results', async ({ page, context, baseURL }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Synthetic Owner', exact: true }).click();
  await waitForAuthenticatedLibrary(page);
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
  // Conformance suites grant this identity boards; empty-state acceptance needs
  // its own repository while retaining the real signed provider and account UI.
  const service = await acceptanceService(baseURL!);
  try {
  await page.goto(service.origin); await page.getByRole('link', { name: 'Synthetic Viewer', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Create your first board' })).toBeVisible();
  await page.getByRole('button', { name: 'New board', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Board name', exact: true })).toHaveValue('Untitled board');
  const firstId = new URL(page.url()).searchParams.get('board');
  await expectAcknowledgedJournal(page); await fileAction(page, 'All boards');
  await expect(page.getByRole('heading', { name: 'Your boards', exact: true })).toBeFocused();
  const retained = await journalRecords(page); expect(retained).toHaveLength(2);
  expect(retained.every(row => row.boardId === firstId && row.kind === 'document')).toBe(true);
  await page.getByRole('textbox', { name: 'Board name' }).fill('  Named synthetic board  ');
  await page.getByRole('button', { name: 'New board', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Board name', exact: true })).toHaveValue('Named synthetic board');
  await expect(page.locator('editor-host')).toBeVisible();
  const secondId = new URL(page.url()).searchParams.get('board'); expect(secondId).not.toBe(firstId);
  await expectAcknowledgedJournal(page, retained);
  expect((await journalRecords(page)).filter(row => row.boardId === secondId)).toEqual([]);
  await fileAction(page, 'All boards');
  await expect(page.getByRole('link', { name: 'Open Named synthetic board', exact: true })).toBeVisible();
  const member = await (await context.request.get(service.origin + '/api/session')).json();
  const headers = { 'X-Dali-Account': member.accountId, Origin: service.origin, 'X-Dali-Request': '1' };
  const before = await (await context.request.get(service.origin + '/api/boards', { headers })).json();
  await page.evaluate(() => localStorage.setItem('djai-design.active-board', 'remembered-foreign-target'));
  for (const target of ['missing-target', '']) {
    await page.goto(service.origin + '/?board=' + target); await expect(page.getByRole('heading', { name: "You don't have access to this board" })).toBeFocused();
    await expect(page.locator('[data-board-id]')).toHaveCount(0);
  }
  expect(await (await context.request.get(service.origin + '/api/boards', { headers })).json()).toEqual(before);
  } finally { await service.close(); }
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
  await expect(page.locator('editor-host')).toBeVisible(); await expect(page.getByRole('textbox', { name: 'Board name', exact: true })).toHaveValue('Reconciled synthetic board');
  expect(posts).toBe(1); expect(lookups).toBe(1);
});
});
