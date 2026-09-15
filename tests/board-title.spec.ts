import { test, expect } from './fixtures';

test('title opens options and rename persists without replacing the canvas', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('affine-edgeless-root')).toHaveCount(1);
  await page.locator('affine-edgeless-root').evaluate(el => el.setAttribute('data-rename-sentinel', 'mounted'));
  await page.locator('.djai-board-switcher').click();
  await expect(page.getByRole('menu', { name: 'Board options' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your boards', exact: true })).toHaveCount(0);
  await page.getByRole('menuitem', { name: 'Rename board' }).click();
  await expect(page.getByRole('textbox', { name: 'Board name' })).toBeFocused();
  await page.getByRole('textbox', { name: 'Board name' }).fill('  Synthetic planning  ');
  await page.getByRole('textbox', { name: 'Board name' }).press('Enter');
  await expect(page.locator('.djai-board-switcher')).toHaveText('Synthetic planning');
  await expect(page.locator('affine-edgeless-root')).toHaveAttribute('data-rename-sentinel', 'mounted');
  await page.reload();
  await expect(page.locator('.djai-board-switcher')).toHaveText('Synthetic planning');
  await page.locator('.djai-board-switcher').click();
  await page.getByRole('menuitem', { name: 'All boards' }).click();
  await expect(page.getByRole('button', { name: 'Open Synthetic planning', exact: true })).toBeVisible();
});

test('rename rejects blank names and cancellation keeps the existing title', async ({ page }) => {
  await page.goto('/');
  await page.locator('.djai-board-switcher').click();
  await page.getByRole('menuitem', { name: 'Rename board' }).click();
  await page.getByRole('textbox', { name: 'Board name' }).fill('   ');
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  await page.getByRole('textbox', { name: 'Board name' }).fill('Discard this');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('.djai-board-switcher')).toHaveText('Untitled board');
  await expect(page.locator('.djai-board-switcher')).toBeFocused();
  await page.locator('.djai-board-switcher').click();
  await page.getByRole('menuitem', { name: 'Rename board' }).click();
  await page.getByRole('textbox', { name: 'Board name' }).press('Escape');
  await expect(page.getByRole('dialog', { name: 'Rename board' })).toHaveCount(0);
});

test('board options support keyboard navigation and outside dismissal', async ({ page }) => {
  await page.goto('/');
  await page.locator('.djai-board-switcher').click();
  await expect(page.getByRole('menuitem', { name: 'Rename board' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'All boards' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('.djai-board-switcher')).toBeFocused();
  await page.locator('.djai-board-switcher').click();
  await page.mouse.click(400, 500);
  await expect(page.getByRole('menu', { name: 'Board options' })).toHaveCount(0);
  await expect(page.locator('.djai-board-switcher')).toHaveAttribute('aria-expanded', 'false');
});
