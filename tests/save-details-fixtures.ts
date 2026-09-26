import { expect, type Page } from '@playwright/test';
export { recoveryBoardFixture as saveDetailsBoard } from './recovery-fixtures';

export const saveDetailsFixtures = { title: 'Synthetic save details '.padEnd(200, 'T'), name: 'I'.repeat(120), count: 50, widths: [1440, 900, 600, 490, 320] };
export const saveTrigger = (page: Page) => page.locator('.djai-save__status');
export async function openSaveDetails(page: Page) {
  await saveTrigger(page).click();
  const dialog = page.getByRole('dialog', { name: 'Save details', exact: true });
  await expect(dialog).toBeVisible(); return dialog;
}
