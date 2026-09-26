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
