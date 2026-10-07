import { fileAction } from './app-menu';
import { test, expect } from './fixtures';

test('export is modal, blocks background focus, and restores its trigger on Escape', async ({ page }) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Main Menu', exact: true });
  await fileAction(page, 'Export board');
  const dialog = page.getByRole('dialog', { name: 'Export board', exact: true });
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate(element => element.matches(':modal'))).toBe(true);
  await trigger.evaluate(element => (element as HTMLElement).focus());
  expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  const close = dialog.getByRole('button', { name: 'Close', exact: true });
  const download = dialog.getByRole('button', { name: 'Download', exact: true });
  await download.focus();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(download).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('PNG dimensions and download remain visible while settings scroll in a short viewport', async ({ page }) => {
  await page.setViewportSize({ width: 680, height: 480 });
  await page.goto('/');
  await fileAction(page, 'Export board');
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('radio', { name: 'PNG image' }).check();
  const download = dialog.getByRole('button', { name: 'Download', exact: true });
  await expect(download).toBeInViewport();
  await expect(page.getByTestId('export-dimensions')).toBeInViewport();
  const before = await download.boundingBox();
  await dialog.locator('.export-settings').evaluate(element => { element.scrollTop = element.scrollHeight; });
  expect(await download.boundingBox()).toEqual(before);
  await expect(page.getByTestId('export-dimensions')).toBeInViewport();
  await expect(dialog.locator('input[name="export-scope"][value="selection"]')).toBeDisabled();
  await expect(dialog.getByRole('link')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: /share|device/i })).toHaveCount(0);
});

test('successful export offers artifact status, export again, and Done', async ({ page }) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Main Menu', exact: true });
  await fileAction(page, 'Export board');
  const pending = page.waitForEvent('download');
  await page.getByRole('dialog').getByRole('button', { name: 'Download', exact: true }).click();
  expect(await (await pending).failure()).toBeNull();
  const status = page.getByRole('dialog', { name: 'Download started' });
  await expect(status.getByRole('status')).toContainText('Your browser is downloading the file');
  await expect(status.getByRole('button', { name: 'Done', exact: true })).toBeFocused();
  await expect(status.getByRole('link')).toHaveCount(0);
  await status.getByRole('button', { name: 'Export again' }).click();
  await expect(page.getByRole('dialog', { name: 'Export board', exact: true })).toBeVisible();
  const second = page.waitForEvent('download');
  await page.getByRole('dialog').getByRole('button', { name: 'Download', exact: true }).click();
  await second;
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(trigger).toBeFocused();
});
