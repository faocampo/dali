import type { Page } from '@playwright/test';

/** Follow the same explicit color choice as the Notes tool user. */
export async function addStickyNote(page: Page, color = 'Yellow') {
  await page.getByRole('button', { name: 'Add sticky note', exact: true }).click();
  await page.getByRole('dialog', { name: 'Note colors', exact: true }).getByRole('button', { name: `${color} note`, exact: true }).click();
}
