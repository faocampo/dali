import { expect, type Page } from '@playwright/test';

export async function openObjectActions(page: Page) {
  const menu = page.getByRole('menu', { name: 'Object actions', exact: true });
  if (await menu.isVisible()) return;
  await page.locator('editor-host').focus();
  await page.keyboard.press('Shift+F10');
  await expect(menu).toBeVisible();
}
