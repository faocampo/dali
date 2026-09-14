import { test, expect } from './fixtures';
import { openObjectActions } from './object-actions';
import type { GfxController, GfxModel } from '@blocksuite/affine/std/gfx';

for (const lock of ['object menu', 'native toolbar']) for (const unlock of ['context menu', 'native toolbar']) test(`a locked mind-map topic can be unlocked after deselection through ${unlock} after ${lock}`, async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add mind map', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('Central topic');
  await page.keyboard.type('Lockable topic'); await page.keyboard.press('Enter');
  const topic = await page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const model = gfx.selection.selectedElements[0]!;
    const bound = gfx.viewport.toViewBound(model.elementBound);
    const rect = el.closest('editor-host')!.getBoundingClientRect();
    return { id: model.id, x: bound.x + bound.w / 2 + rect.left, y: bound.y + bound.h / 2 + rect.top, xywh: model.xywh };
  });
  if (lock === 'object menu') {
    await openObjectActions(page);
    await page.getByRole('menuitem', { name: 'Lock object', exact: true }).click();
  } else await page.getByRole('button', { name: 'Lock', exact: true }).click();
  await page.mouse.click(400, 600);
  await page.mouse.click(topic.x, topic.y, { button: 'right' });
  await expect(page.getByRole('menuitem', { name: 'Unlock object', exact: true })).toBeVisible({ timeout: 2500 });
  if (unlock === 'context menu') await page.getByRole('menuitem', { name: 'Unlock object', exact: true }).click();
  else { await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'Click to unlock', exact: true }).click(); }
  await expect.poll(() => page.locator('affine-edgeless-root').evaluate((el, id) => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    return gfx.getElementById<GfxModel>(id)!.isLocked();
  }, topic.id)).toBe(false);
  await page.mouse.click(400, 600);
  await page.mouse.move(topic.x, topic.y); await page.mouse.down();
  await page.mouse.move(topic.x + 80, topic.y + 50, { steps: 10 }); await page.mouse.up();
  await expect.poll(() => page.locator('affine-edgeless-root').evaluate((el, id) =>
    (el as HTMLElement & { gfx: GfxController }).gfx.getElementById<GfxModel>(id)!.xywh, topic.id)).not.toBe(topic.xywh);
});


test('stale lock action cannot change a deselected topic', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Add mind map', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('Central topic');
  await page.keyboard.press('Enter'); await openObjectActions(page);
  const locked = await page.getByRole('menuitem', { name: 'Lock object', exact: true }).evaluate(el => {
    const root = document.querySelector('affine-edgeless-root') as HTMLElement & { gfx: GfxController };
    const model = root.gfx.selection.selectedElements[0]!;
    root.gfx.selection.set({ elements: [], editing: false });
    (el as HTMLButtonElement).click();
    return model.isLocked();
  });
  expect(locked).toBe(false);
});
