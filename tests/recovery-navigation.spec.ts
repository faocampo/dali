import { test, expect } from '@playwright/test';
import { recoveryBoardFixture, journalRows } from './recovery-fixtures';

test('@04-08-02 Stay and Escape retain pending work; Leave transitions once with destination focus', async ({ page, baseURL }) => {
  await recoveryBoardFixture(page, baseURL!);
  await page.route('**/docs/*/push', route => route.fulfill({ status: 503, json: { code: 'SYNTHETIC_OUTAGE' } }));
  await page.getByRole('button', { name: 'Add sticky note', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save failed, Open save details', exact: true })).toBeVisible();
  await expect.poll(async () => (await journalRows(page)).length).toBeGreaterThan(0);
  const open = async () => { await page.getByRole('button', { name: 'Main Menu', exact: true }).click(); await page.getByRole('menuitem', { name: 'File', exact: true }).click(); await page.getByRole('menuitem', { name: 'All boards', exact: true }).click(); };
  await open();
  const dialog = page.getByRole('dialog', { name: 'Leave with changes waiting to save?' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Stay on board' })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
  await expect(page.locator('editor-host')).toBeVisible();
  await open(); await dialog.getByRole('button', { name: 'Stay on board' }).click();
  await expect(page.locator('editor-host')).toBeVisible();
  await open(); await dialog.getByRole('button', { name: 'Leave board', exact: true }).dblclick();
  await expect(page.getByRole('heading', { name: 'Your boards', exact: true })).toBeFocused();
  expect((await journalRows(page)).length).toBeGreaterThan(0);
  await expect(page.getByText('Changes waiting to save', { exact: true }).first()).toBeVisible();
});
