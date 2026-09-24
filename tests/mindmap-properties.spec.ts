import { openObjectActions } from './object-actions';
import { test, expect } from './fixtures';
import type { GfxController } from '@blocksuite/affine/std/gfx';
import type { MindmapElementModel } from '@blocksuite/affine/model';
import { openMindmapProperties } from './mindmap-properties';

test('@02-uat-properties Properties opens only from the context menu and stays closed during creation', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add mind map', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('Central topic');
  const panel = page.getByRole('region', { name: 'Mind-map topic', exact: true });
  await expect(panel).toHaveCount(0);
  await page.keyboard.type('Synthetic release'); await page.keyboard.press('Enter');
  await expect(panel).toHaveCount(0);
  await page.keyboard.press('Tab');
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('New topic');
  await expect(panel).toHaveCount(0);
  await page.keyboard.type('Synthetic child'); await page.keyboard.press('Enter');
  await openObjectActions(page);
  await page.getByRole('menuitem', { name: 'Properties', exact: true }).click();
  await expect(panel).toHaveClass(/selection-inspector/);
  await expect(panel.locator('.selection-inspector__eyebrow')).toHaveText('Properties');
  const box = (await panel.boundingBox())!;
  expect(box.y).toBeLessThan(100);
  expect(box.x + box.width).toBeGreaterThan(page.viewportSize()!.width - 24);
  await page.getByRole('spinbutton', { name: 'Font size', exact: true }).fill('28');
  await page.getByRole('spinbutton', { name: 'Font size', exact: true }).press('Tab');
  await expect.poll(() => page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    return (gfx.selection.selectedElements[0] as unknown as { fontSize: number }).fontSize;
  })).toBe(28);
  await page.getByRole('button', { name: 'Close mind-map controls', exact: true }).click();
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  await expect(panel).toHaveCount(0);
  await page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const map = gfx.surface!.elementModels.find(model => model.type === 'mindmap')!;
    const root = (map as unknown as { tree: { id: string } }).tree.id;
    gfx.selection.set({ elements: [root], editing: false });
  });
  await expect(panel).toHaveCount(0);
  await page.locator('editor-host').focus(); await page.keyboard.press('Shift+F10');
  await page.getByRole('menuitem', { name: 'Properties', exact: true }).click();
  await expect(panel).toBeVisible();
  await page.getByRole('button', { name: 'Close mind-map controls', exact: true }).click();
  const center = await page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const bound = gfx.viewport.toViewBound(gfx.selection.selectedElements[0]!.elementBound);
    const host = el.closest('editor-host')!.getBoundingClientRect();
    return { x: bound.x + bound.w / 2 + host.x, y: bound.y + bound.h / 2 + host.y };
  });
  await page.mouse.click(center.x, center.y, { button: 'right' });
  await page.getByRole('menuitem', { name: 'Properties', exact: true }).click();
  await expect(panel).toBeVisible();
  await page.getByRole('button', { name: 'Close mind-map controls', exact: true }).click();
  await page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const map = gfx.surface!.elementModels.find(model => model.type === 'mindmap') as MindmapElementModel;
    map.toggleCollapse(map.tree, { layout: true });
  });
  await expect(page.locator('.mindmap-feedback [aria-live="polite"]')).toContainText('Branch collapsed.');
  await expect(panel).toHaveCount(0);
  await page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const map = gfx.surface!.elementModels.find(model => model.type === 'mindmap') as MindmapElementModel;
    map.tree.element.lock(); map.toggleCollapse(map.tree, { layout: true });
  });
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(panel).toHaveCount(0);
});

for (const invalidation of ['selection', 'removed', 'detached'] as const) {
  test(`@02-uat-properties stale ${invalidation} menu cannot open Properties`, async ({ page }) => {
    await page.goto('/'); await page.getByRole('button', { name: 'Add mind map', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('Central topic');
    await page.keyboard.press('Enter');
    await openObjectActions(page);
    const property = page.getByRole('menuitem', { name: 'Properties', exact: true });
    await property.evaluate((el, invalidation) => {
      const root = document.querySelector('affine-edgeless-root') as HTMLElement & { gfx: GfxController };
      const gfx = root.gfx;
      if (invalidation === 'selection') gfx.selection.set({ elements: [], editing: false });
      if (invalidation === 'removed') gfx.surface!.deleteElement(gfx.selection.selectedElements[0]!.id);
      if (invalidation === 'detached') root.closest('editor-host')!.remove();
      (el as HTMLButtonElement).click();
    }, invalidation);
    await expect(page.getByRole('region', { name: 'Mind-map topic', exact: true })).toHaveCount(0);
  });
}

test('@02-uat-properties entering topic editing closes Properties through commit and child creation', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Add mind map', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('Central topic');
  await page.keyboard.press('Enter'); await openMindmapProperties(page);
  const center = await page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const bound = gfx.viewport.toViewBound(gfx.selection.selectedElements[0]!.elementBound);
    const host = el.closest('editor-host')!.getBoundingClientRect();
    return { x: bound.x + bound.w / 2 + host.x, y: bound.y + bound.h / 2 + host.y };
  });
  await page.mouse.dblclick(center.x, center.y);
  await expect(page.locator('edgeless-shape-text-editor')).toHaveCount(1);
  const panel = page.getByRole('region', { name: 'Mind-map topic', exact: true });
  await expect(panel).toHaveCount(0);
  await page.keyboard.press('Enter'); await expect(panel).toHaveCount(0);
  await openMindmapProperties(page);
  await page.getByRole('button', { name: 'Add child', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('New topic');
  await expect(panel).toHaveCount(0);
  await page.keyboard.press('Enter'); await expect(panel).toHaveCount(0);
});

test('@02-uat-properties context menu owns Escape and keyboard navigation', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add mind map', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('Central topic');
  await page.keyboard.press('Enter');
  const trigger = page.locator('editor-host');
  await openObjectActions(page); await page.keyboard.press('Escape');
  await expect(page.getByRole('menu', { name: 'Object actions', exact: true })).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.press('Shift+F10');
  const menu = page.getByRole('menu', { name: 'Object actions', exact: true });
  await expect(menu.getByRole('menuitem', { name: 'Properties', exact: true })).toBeFocused();
  await page.keyboard.press('End'); await expect(menu.getByRole('menuitem').last()).toBeFocused();
  await page.keyboard.press('Home'); await expect(menu.getByRole('menuitem', { name: 'Properties', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown'); await expect(menu.getByRole('menuitem', { name: 'Duplicate', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowUp'); await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Close mind-map controls', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('region', { name: 'Mind-map topic', exact: true })).toHaveCount(0);
  await expect(page.locator('editor-host')).toBeFocused();
});
