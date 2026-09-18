import { fileAction } from './app-menu';
import { test, expect } from './fixtures';

test('Main Menu supports arrow navigation, nested Escape, View actions and outside dismissal', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('affine-edgeless-root')).toHaveCount(1);
  const boardId = new URL(page.url()).searchParams.get('board');
  const trigger = page.getByRole('button', { name: 'Main Menu', exact: true });
  await expect(page.locator('.board-utilities')).toHaveCount(0);
  await trigger.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'File', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('menuitem', { name: 'New', exact: true })).toBeFocused();
  expect((await page.getByRole('menuitem', { name: 'New', exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect((await page.getByRole('menu', { name: 'File', exact: true }).getByRole('menuitem').allTextContents()).slice(-2)).toEqual(['Import board', 'Export board']);
  await page.keyboard.press('End');
  await expect(page.getByRole('menuitem', { name: 'Export board', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menuitem', { name: 'File', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.getByRole('menuitem', { name: 'Reset zoom to 100%', exact: true }).click();
  await expect(page.getByRole('button', { name: /Reset zoom to 100%, current/ })).toHaveText('100%');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await trigger.click(); await page.getByRole('menuitem', { name: 'Help', exact: true }).click();
  expect((await page.getByRole('menuitem', { name: 'Upstream source', exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await trigger.click();
  await page.mouse.click(600, 400);
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await fileAction(page, 'All boards');
  await expect(page.getByRole('link', { name: 'Open Untitled board', exact: true }).and(page.locator(`[href="/?board=${boardId}"]`))).toBeVisible();
});

test('File Import opens the editable-board file picker', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('affine-edgeless-root')).toHaveCount(1);
  const pending = page.waitForEvent('filechooser');
  await fileAction(page, 'Import board');
  const chooser = await pending;
  expect(chooser.isMultiple()).toBe(false);
  expect(await chooser.element().getAttribute('accept')).toBe('.zip,application/zip');
});
