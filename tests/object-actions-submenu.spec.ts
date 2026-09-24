import { test, expect } from './fixtures';

test('native More keeps topic properties directly and has no duplicate actions submenu', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add mind map', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('Central topic');
  await page.keyboard.press('Enter');
  await page.locator('editor-icon-button[aria-label="More"]').click();
  await expect(page.getByRole('menuitem', { name: 'Object actions', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Frame selection', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Topic properties', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Mind-map topic', exact: true })).toBeVisible();
});

test('alignment appears for multiple objects and hides again for one', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Shapes', exact: true }).click();
  await page.getByRole('button', { name: 'Square / rectangle', exact: true }).click();
  await page.mouse.move(260, 210); await page.mouse.down();
  await page.mouse.move(350, 270); await page.mouse.up();
  await page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: import('@blocksuite/affine/std/gfx').GfxController }).gfx;
    const first = gfx.surface!.elementModels.find(m => m.type === 'shape')!;
    const second = gfx.surface!.addElement({ type: 'shape', xywh: '[50,120,100,80]' });
    gfx.selection.set({ elements: [first.id, second], editing: false });
  });
  await page.locator('editor-host').focus(); await page.keyboard.press('Shift+F10');
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
