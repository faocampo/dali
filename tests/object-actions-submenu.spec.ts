import { test, expect } from './fixtures';

test('Object actions is nested under the native More menu', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add mind map', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('Central topic');
  await page.keyboard.press('Enter');
  await expect(page.locator('.object-actions-trigger')).toHaveCount(0);
  await page.locator('editor-icon-button[aria-label="More"]').click();
  await page.getByRole('menuitem', { name: 'Object actions', exact: true }).click();
  const menu = page.getByRole('menu', { name: 'Object actions', exact: true });
  await expect(menu).toBeVisible();
  const entry = page.getByRole('menuitem', { name: 'Object actions', exact: true });
  const entryBox = (await entry.boundingBox())!;
  const menuBox = (await menu.boundingBox())!;
  expect(menuBox.x >= entryBox.x + entryBox.width || menuBox.x + menuBox.width <= entryBox.x).toBe(true);
  await page.screenshot({ path: '/tmp/dali-more-submenu.png' });
  await page.keyboard.press('ArrowLeft');
  await expect(menu).toHaveCount(0);
  await expect(entry).toBeFocused();
  await entry.press('ArrowRight');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: /^Align / })).toHaveCount(0);
  await menu.getByRole('menuitem', { name: 'Properties', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Mind-map topic', exact: true })).toBeVisible();
});

test('alignment appears for multiple objects and hides again for one', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Shape', exact: true }).click();
  await page.mouse.move(260, 210); await page.mouse.down();
  await page.mouse.move(350, 270); await page.mouse.up();
  await page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: import('@blocksuite/affine/std/gfx').GfxController }).gfx;
    const first = gfx.surface!.elementModels.find(m => m.type === 'shape')!;
    const second = gfx.surface!.addElement({ type: 'shape', xywh: '[50,120,100,80]' });
    gfx.selection.set({ elements: [first.id, second], editing: false });
  });
  await page.locator('editor-icon-button[aria-label="More"]').click();
  await page.getByRole('menuitem', { name: 'Object actions', exact: true }).click();
  const menu = page.getByRole('menu', { name: 'Object actions', exact: true });
  await expect(menu.getByRole('menuitem', { name: /^Align / })).toHaveCount(8);
  await expect(menu.getByRole('menuitem', { name: 'Align left', exact: true })).toBeEnabled();
  await expect(menu.getByRole('menuitem', { name: 'Align distribute-x', exact: true })).toBeDisabled();
  await page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: import('@blocksuite/affine/std/gfx').GfxController }).gfx;
    gfx.selection.set({ elements: [gfx.selection.selectedElements[0]!.id], editing: false });
  });
  await expect(menu).toHaveCount(0);
  await page.locator('editor-host').focus(); await page.keyboard.press('Shift+F10');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: /^Align / })).toHaveCount(0);
});
