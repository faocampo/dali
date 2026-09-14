import { expect, type Page } from '@playwright/test';

/** Explicit user gesture: tests that need the sidebar must request Properties. */
export async function openMindmapProperties(page: Page) {
  await page.getByRole('button', { name: 'Object actions', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Properties', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Mind-map topic', exact: true })).toBeVisible();
}
