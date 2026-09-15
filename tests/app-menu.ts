import type { Page } from '@playwright/test';

export async function fileAction(page: Page, name: 'All boards' | 'Import board' | 'Export board') {
  await page.getByRole('button', { name: 'Dalí', exact: true }).click();
  await page.getByRole('menuitem', { name: 'File', exact: true }).click();
  await page.getByRole('menuitem', { name, exact: true }).click();
}
