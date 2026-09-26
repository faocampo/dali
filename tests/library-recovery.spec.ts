import { test, expect } from './fixtures';
import { acceptanceService } from './access-fixtures';
import { libraryRecoveryMember, libraryRecoveryBoard, seedLibraryPending } from './library-recovery-fixtures';
import { journalRows } from './recovery-fixtures';

test.use({ entryMode: 'public-entry', expectErrors: ['Failed to load resource: the server responded with a status of 503 (Service Unavailable)', 'Failed to load resource: the server responded with a status of 401 (Unauthorized)'] });
let service: Awaited<ReturnType<typeof acceptanceService>>;
test.beforeEach(async ({ baseURL }) => { service = await acceptanceService(baseURL!); });
test.afterEach(async () => { await service.close(); });

test('@04-09-01 authorized browser pending work appears below card metadata', async ({ page }) => {
  const account = await libraryRecoveryMember(page, service.origin);
  const board = await libraryRecoveryBoard(page, service.origin, account);
  await seedLibraryPending(page, account, [board.summary.id]);
  await page.getByRole('button', { name: 'Refresh boards', exact: true }).click();
  const card = page.locator('[data-board-id="' + board.summary.id + '"]');
  await expect(card.getByRole('link', { name: 'Open Synthetic pending board', exact: true })).toBeVisible();
  await expect(card.getByText('Changes waiting to save', { exact: true })).toBeVisible();
});

test('@04-09-01 authorized cards load independently of blocked inspection and errors retry', async ({ page }) => {
  const account = await libraryRecoveryMember(page, service.origin);
  const board = await libraryRecoveryBoard(page, service.origin, account);
  await seedLibraryPending(page, account, [board.summary.id]);
  await page.evaluate(() => {
    const original = indexedDB.databases.bind(indexedDB);
    let release!: () => void;
    const wait = new Promise<void>(resolve => { release = resolve; });
    indexedDB.databases = async () => { await wait; return original(); };
    Object.assign(window, { releaseInspection: () => { indexedDB.databases = original; release(); } });
  });
  await page.getByRole('button', { name: 'Refresh boards', exact: true }).click();
  await expect(page.locator('[data-board-id]')).toHaveCount(1);
  await expect(page.getByText('Checking recovery status…', { exact: true })).toBeVisible();
  await page.evaluate(() => (window as unknown as { releaseInspection(): void }).releaseInspection());
  await expect(page.locator('.board-card__pending')).toHaveCount(1);
  await page.evaluate(() => {
    const original = indexedDB.databases.bind(indexedDB);
    Object.assign(window, { restoreInspection: () => { indexedDB.databases = original; } });
    indexedDB.databases = async () => { throw new Error('Synthetic recovery read failure'); };
  });
  await page.getByRole('button', { name: 'Refresh boards', exact: true }).click();
  await expect(page.getByText('Recovery status unavailable. Refresh boards to try again.', { exact: true })).toBeVisible();
  await expect(page.locator('[data-board-id]')).toHaveCount(1);
  await page.evaluate(() => (window as unknown as { restoreInspection(): void }).restoreInspection());
  await page.getByRole('button', { name: 'Refresh boards', exact: true }).click();
  await expect(page.locator('.board-card__pending')).toHaveCount(1);
});

test('@04-09-01 zero records and inaccessible foreign records never fabricate cards', async ({ page, browser }) => {
  const account = await libraryRecoveryMember(page, service.origin);
  await expect(page.getByRole('heading', { name: 'Create your first board' })).toBeVisible();
  await seedLibraryPending(page, account, ['inaccessible-board']);
  await page.getByRole('button', { name: 'Refresh boards', exact: true }).click();
  await expect(page.locator('[data-board-id]')).toHaveCount(0);
  const board = await libraryRecoveryBoard(page, service.origin, account);
  await seedLibraryPending(page, 'another-member', [board.summary.id]);
  await page.getByRole('button', { name: 'Refresh boards', exact: true }).click();
  await expect(page.locator('[data-board-id]')).toHaveCount(1);
  await expect(page.getByText('Checking recovery status…', { exact: true })).toHaveCount(0);
  await expect(page.locator('.board-card__pending')).toHaveCount(0);
  await seedLibraryPending(page, account, [board.summary.id]);
  await expect(page.locator('.board-card__pending')).toHaveCount(1);
  const context = await browser.newContext(); const cold = await context.newPage();
  try {
    await libraryRecoveryMember(cold, service.origin);
    await expect(cold.locator('[data-board-id]')).toHaveCount(1);
    await expect(cold.getByText('Checking recovery status…', { exact: true })).toHaveCount(0);
    await expect(cold.locator('.board-card__pending')).toHaveCount(0);
  } finally { await context.close(); }
});

test('@04-09-02 fifty long marked cards preserve ordering roles dates and responsive controls', async ({ page }, testInfo) => {
  const account = await libraryRecoveryMember(page, service.origin);
  const ids: string[] = [];
  for (let index = 0; index < 50; index++) {
    const board = await libraryRecoveryBoard(page, service.origin, account, index === 0 ? 'x'.repeat(200) : 'Synthetic board ' + index);
    ids.push(board.summary.id);
  }
  await page.getByRole('button', { name: 'Refresh boards', exact: true }).click();
  await expect(page.locator('[data-board-id]')).toHaveCount(50);
  const before = await page.locator('[data-board-id]').evaluateAll(cards => cards.map(card => [card.getAttribute('data-board-id'), card.querySelector('small')!.textContent]));
  await seedLibraryPending(page, account, ids);
  await expect(page.locator('.board-card__pending')).toHaveCount(50);
  expect(await page.locator('[data-board-id]').evaluateAll(cards => cards.map(card => [card.getAttribute('data-board-id'), card.querySelector('small')!.textContent]))).toEqual(before);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [1440, 900, 600, 490, 320]) {
    await page.setViewportSize({ width, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const marker = page.locator('.board-card__pending').first();
    await expect(marker).toHaveCSS('font-size', '12px');
    await expect(marker).toHaveCSS('font-weight', '400');
    await expect(marker).toHaveCSS('color', 'rgb(134, 89, 0)');
    expect(await marker.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    const card = page.locator('[data-board-id]').first();
    expect((await marker.boundingBox())!.y).toBeGreaterThanOrEqual((await card.locator('.board-card__metadata').boundingBox())!.y);
    await expect(card.getByRole('link')).toHaveAccessibleDescription(/Open this board in this browser/);
    await expect(card.getByText('Preview unavailable')).toBeVisible();
    if (width <= 490) expect(await page.locator('.board-grid').evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length)).toBe(1);
    const last = page.locator('[data-board-id]').last();
    await last.locator('summary').scrollIntoViewIfNeeded(); await last.locator('summary').click();
    await expect(last.getByRole('button', { name: 'Rename board', exact: true })).toBeInViewport();
    await page.keyboard.press('Escape');
    if (width === 320) { await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: testInfo.outputPath('library-recovery-320.png') }); }
  }
});

test('@04-09-02 delayed inspection cannot reveal the prior account after account switch', async ({ page, context, expectErrors }) => {
  expectErrors.push('Failed to load resource: the server responded with a status of 409 (Conflict)');
  const account = await libraryRecoveryMember(page, service.origin);
  const board = await libraryRecoveryBoard(page, service.origin, account, 'Private previous-account canary');
  await seedLibraryPending(page, account, [board.summary.id]);
  await page.evaluate(() => {
    const original = indexedDB.databases.bind(indexedDB); let release!: () => void;
    const wait = new Promise<void>(resolve => { release = resolve; });
    indexedDB.databases = async () => { await wait; return original(); };
    Object.assign(window, { releaseInspection: () => { indexedDB.databases = original; release(); } });
  });
  await page.getByRole('button', { name: 'Refresh boards', exact: true }).click();
  await expect(page.getByText('Checking recovery status…', { exact: true })).toBeVisible();
  await context.clearCookies({ name: 'dali_fixture_identity' });
  const other = await context.newPage();
  try {
    await other.goto(service.origin + '/auth/start');
    await other.getByRole('link', { name: 'Synthetic Editor', exact: true }).click();
    await expect(other.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
    await expect(page.locator('[data-board-id]')).toHaveCount(0);
    await page.evaluate(() => (window as unknown as { releaseInspection(): void }).releaseInspection());
    await expect(page.locator('.board-card__pending')).toHaveCount(0);
    await expect(page.getByText('Private previous-account canary', { exact: true })).toHaveCount(0);
    await expect(other.locator('[data-board-id]')).toHaveCount(0);
    expect((await journalRows(page)).length).toBe(1);
  } finally { await other.close(); }
});

test('@04-09-02 denied authorized list removes private cached cards and markers', async ({ page }) => {
  const account = await libraryRecoveryMember(page, service.origin);
  const board = await libraryRecoveryBoard(page, service.origin, account);
  await seedLibraryPending(page, account, [board.summary.id]);
  await expect(page.locator('.board-card__pending')).toHaveCount(1);
  await page.route('**/api/boards?*', route => route.fulfill({ status: 503, json: {} }));
  await page.getByRole('button', { name: 'Refresh boards', exact: true }).click();
  await expect(page.getByText("We couldn't load your boards. Try again.", { exact: true })).toBeVisible();
  await expect(page.locator('[data-board-id]')).toHaveCount(0);
  await expect(page.locator('.board-card__pending')).toHaveCount(0);
  expect((await journalRows(page)).length).toBe(1);
});

test('@04-09-02 current viewers and editors see retained markers under their real roles', async ({ page }) => {
  const account = await libraryRecoveryMember(page, service.origin);
  const board = await libraryRecoveryBoard(page, service.origin, account);
  await seedLibraryPending(page, account, [board.summary.id]);
  const other = service.database.prepare('SELECT id FROM members WHERE id<>? LIMIT 1').get(account) as { id: string } | undefined;
  // Seed a neutral internal member through the same member schema used by the provider.
  if (!other) service.database.prepare("INSERT INTO members(id,issuer,subject,email,canonical_email,display_name) SELECT 'synthetic-other-owner',issuer,'synthetic-other-owner','other@example.org','other@example.org','Synthetic other' FROM members WHERE id=?").run(account);
  const owner = other?.id ?? 'synthetic-other-owner';
  service.database.prepare('UPDATE boards SET owner_id=? WHERE id=?').run(owner, board.summary.id);
  for (const role of ['viewer', 'editor']) {
    service.database.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?) ON CONFLICT(board_id,member_id) DO UPDATE SET role=excluded.role').run(board.summary.id, account, role);
    await page.getByRole('button', { name: 'Refresh boards', exact: true }).click();
    const card = page.locator('[data-board-id]');
    await expect(card.locator('.board-card__pending')).toHaveCount(1);
    await expect(card.locator('.board-card__metadata')).toContainText(role === 'viewer' ? 'Viewer' : 'Editor');
    await expect(card.locator('summary')).toHaveCount(role === 'viewer' ? 0 : 1);
  }
});

test('@04-09-02 actual acknowledgment clears one board while another pending marker remains', async ({ page, context }) => {
  const account = await libraryRecoveryMember(page, service.origin);
  const board = await libraryRecoveryBoard(page, service.origin, account);
  const other = await libraryRecoveryBoard(page, service.origin, account, 'Other unresolved board');
  const unresolved = [other.summary.id];
  for (let index = 0; index < 48; index++) unresolved.push((await libraryRecoveryBoard(page, service.origin, account, 'Unresolved board ' + index)).summary.id);
  await seedLibraryPending(page, account, unresolved);
  await page.goto(service.origin + '/?board=' + board.summary.id);
  await expect(page.locator('editor-host')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  await page.route('**/docs/*/push', route => route.fulfill({ status: 503, json: { code: 'SYNTHETIC_OUTAGE' } }));
  await page.getByRole('button', { name: 'Add sticky note', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save failed', exact: true })).toBeVisible();
  const library = await context.newPage();
  try {
    await library.goto(service.origin + '/');
    await expect(library.locator('.board-card__pending')).toHaveCount(50);
    await page.unroute('**/docs/*/push');
    await page.getByRole('button', { name: 'Save failed', exact: true }).click();
    await page.getByRole('button', { name: 'Retry saving', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
    await expect(library.locator('[data-board-id="' + board.summary.id + '"] .board-card__pending')).toHaveCount(0);
    await expect(library.locator('[data-board-id="' + other.summary.id + '"] .board-card__pending')).toHaveCount(1);
    await expect(library.locator('.board-card__pending')).toHaveCount(49);
  } finally { await library.close(); }
});

test('@04-09-02 download then leave and explicit restored entry preserve unresolved markers', async ({ page }) => {
  const account = await libraryRecoveryMember(page, service.origin);
  const board = await libraryRecoveryBoard(page, service.origin, account);
  await page.goto(service.origin + '/?board=' + board.summary.id);
  await expect(page.locator('editor-host')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  await page.route('**/docs/*/push', route => route.fulfill({ status: 503, json: { code: 'SYNTHETIC_OUTAGE' } }));
  await page.getByRole('button', { name: 'Add sticky note', exact: true }).click();
  await page.getByRole('button', { name: 'Save failed', exact: true }).click();
  const before = await journalRows(page);
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download recovery copy', exact: true }).click();
  expect((await downloaded).suggestedFilename()).toContain('-recovery-');
  expect(await journalRows(page)).toEqual(expect.arrayContaining(before));
  page.on('dialog', dialog => dialog.accept());
  await page.getByRole('link', { name: 'Dalí', exact: true }).click();
  await expect(page.locator('.board-card__pending')).toHaveCount(1);
  service.database.prepare('UPDATE recovery_state SET epoch=? WHERE singleton=1').run('22222222-2222-4222-8222-222222222222');
  await page.unroute('**/docs/*/push');
  await page.getByRole('link', { name: 'Open Synthetic pending board', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Recovery needs attention', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open restored board', exact: true }).click();
  await expect(page.locator('editor-host')).toBeVisible();
  expect(await journalRows(page)).toEqual(expect.arrayContaining(before));
  await page.getByRole('link', { name: 'Dalí', exact: true }).click();
  await expect(page.locator('.board-card__pending')).toHaveCount(1);
});
