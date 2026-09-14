import { expect, type Page } from '@playwright/test';

export async function openObjectActions(page: Page) {
  const menu = page.getByRole('menu', { name: 'Object actions', exact: true });
  if (await menu.isVisible()) return;
  const entry = page.getByRole('menuitem', { name: 'Object actions', exact: true });
  if (!await entry.isVisible()) await page.locator('editor-icon-button[aria-label="More"]').click();
  await entry.click();
  await expect(menu).toBeVisible();
}
