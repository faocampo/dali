import { test, expect } from './fixtures';
import type { GfxController } from '@blocksuite/affine/std/gfx';

test('shape and line palettes create the chosen native geometry and endpoints', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('affine-edgeless-root')).toHaveCount(1);
  for (const name of ['Square / rectangle', 'Rounded rectangle', 'Circle / ellipse', 'Triangle', 'Diamond']) {
    await page.getByRole('button', { name: 'Shapes', exact: true }).click();
    await page.getByRole('dialog', { name: 'Shapes palette' }).getByRole('button', { name, exact: true }).click();
    await page.mouse.move(400, 250); await page.mouse.down();
    await page.mouse.move(550, 370, { steps: 8 }); await page.mouse.up();
  }
  for (const name of ['Straight line', 'Straight arrow', 'Curved line', 'Curved arrow', 'Angled line', 'Angled arrow']) {
    await page.getByRole('button', { name: 'Lines', exact: true }).click();
    await page.getByRole('dialog', { name: 'Lines palette' }).getByRole('button', { name, exact: true }).click();
    await page.mouse.move(500, 500); await page.mouse.down();
    await page.mouse.move(650, 620, { steps: 8 }); await page.mouse.up();
  }
  const models = await page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    return gfx.gfxElements.map(model => ({ type: 'type' in model ? model.type : '', shape: 'shapeType' in model ? model.shapeType : '', radius: 'radius' in model ? model.radius : 0, mode: 'mode' in model ? model.mode : -1, end: 'rearEndpointStyle' in model ? model.rearEndpointStyle : '' }));
  });
  expect(models.filter(m => m.type === 'shape').map(m => [m.shape, m.radius])).toEqual([['rect', 0], ['rect', 0.1], ['ellipse', 0], ['triangle', 0], ['diamond', 0]]);
  expect(models.filter(m => m.type === 'connector').map(m => [m.mode, m.end])).toEqual([[0, 'None'], [0, 'Arrow'], [2, 'None'], [2, 'Arrow'], [1, 'None'], [1, 'Arrow']]);
});

test('palette keyboard dismissal and narrow viewport containment', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 640 });
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Shapes', exact: true });
  await trigger.click();
  await expect(page.getByRole('button', { name: 'Square / rectangle', exact: true })).toBeFocused();
  await page.keyboard.press('End');
  await expect(page.getByRole('dialog', { name: 'Shapes palette' }).getByRole('button', { name: 'Diamond', exact: true })).toBeFocused();
  const bounds = await page.getByRole('dialog', { name: 'Shapes palette' }).boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(640);
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await expect(page.getByRole('dialog', { name: 'Shapes palette' })).toHaveCount(0);
});

test('Edit uses document history and Settings saves viewport visibility', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Shapes', exact: true }).click();
  await page.getByRole('button', { name: 'Triangle', exact: true }).click();
  await page.mouse.click(450, 300);
  const count = () => page.locator('affine-edgeless-root').evaluate(el => (el as HTMLElement & { gfx: GfxController }).gfx.gfxElements.filter(m => 'type' in m && m.type === 'shape').length);
  await expect.poll(count).toBe(1);
  for (const [action, expected] of [['Undo', 0], ['Redo', 1]] as const) {
    await page.getByRole('button', { name: 'Dalí', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
    await page.getByRole('menuitem', { name: action, exact: true }).click();
    await expect.poll(count).toBe(expected);
  }
  await page.getByRole('button', { name: 'Dalí', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Settings', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Hide viewport controls', exact: true }).click();
  await expect(page.getByRole('toolbar', { name: 'Viewport and history' })).toBeHidden();
  await page.reload();
  await expect(page.getByRole('toolbar', { name: 'Viewport and history' })).toBeHidden();
  await page.getByRole('button', { name: 'Dalí', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Settings', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Show viewport controls', exact: true }).click();
  await expect(page.getByRole('toolbar', { name: 'Viewport and history' })).toBeVisible();
});
