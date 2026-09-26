import { test, expect } from './fixtures';
import { acceptanceService } from './access-fixtures';
import { libraryRecoveryMember, libraryRecoveryBoard, seedLibraryPending } from './library-recovery-fixtures';

test.use({ entryMode: 'public-entry' });
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
