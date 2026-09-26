import { test, expect } from '@playwright/test';
import { saveBoardFixture, addSavedImage } from './save-status-fixtures';

test('@04-05-02 manual retry confirms an individual image after a real read failure', async ({ page, baseURL }) => {
  await saveBoardFixture(page, baseURL!); await addSavedImage(page);
  let fail = true; let reads = 0;
  await page.route('**/blobs/*', async route => {
    if (route.request().method() !== 'GET') return route.continue();
    reads++; if (fail) return route.fulfill({ status: 503, json: { code: 'SYNTHETIC_IMAGE_UNAVAILABLE' } });
    return route.continue();
  });
  await page.reload(); await expect(page.locator('editor-host')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Image not saved', exact: true })).toBeVisible();
  expect(reads).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Image not saved', exact: true }).click();
  const failedReads = reads; fail = false;
  await page.getByRole('button', { name: 'Retry saving', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  expect(reads).toBeGreaterThan(failedReads);
});
