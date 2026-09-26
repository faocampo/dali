import { test, expect } from '@playwright/test';
import { recoveryBoardFixture, journalRows } from './recovery-fixtures';

test('@04-06-01 zero-image pending board downloads a timestamped editable recovery archive', async ({ page, baseURL }) => {
  await recoveryBoardFixture(page, baseURL!);
  await page.route('**/docs/*/push', route => route.fulfill({ status: 503, json: { code: 'SYNTHETIC_OUTAGE' } }));
  await page.getByRole('button', { name: 'Add sticky note', exact: true }).click();
  await expect.poll(async () => (await journalRows(page)).length).toBeGreaterThan(0);
  await page.locator('.djai-save__status').click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download recovery copy', exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/-recovery-\d{4}-.*\.bs\.zip$/);
  expect((await journalRows(page)).length).toBeGreaterThan(0);
});
