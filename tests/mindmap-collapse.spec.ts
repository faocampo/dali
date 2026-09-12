import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import type { GfxController } from '@blocksuite/affine/std/gfx';
import type { MindmapElementModel, ShapeElementModel } from '@blocksuite/affine/model';

async function seed(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add mind map', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('Central topic');
  await page.keyboard.press('Enter');
  return page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const map = gfx.surface!.elementModels.find(e => e.type === 'mindmap') as MindmapElementModel;
    const a = map.addNode(map.tree.id, undefined, 'after', { text: 'Branch A' });
    const b = map.addNode(map.tree.id, undefined, 'after', { text: 'Branch B' });
    const c = map.addNode(a, undefined, 'after', { text: 'Nested branch' });
    const leaf = map.addNode(c, undefined, 'after', { text: 'Hidden detail' });
    map.addNode(a, undefined, 'after', { text: 'Leaf A' });
    map.addNode(b, undefined, 'after', { text: 'Leaf B' });
    for (const id of map.children.keys()) gfx.surface!.updateElement(id, { fontSize: 27, fontWeight: '700', color: '#234567' });
    map.toggleCollapse(map.getNode(c)!, { layout: true });
    gfx.selection.set({ elements: [a], editing: false });
    gfx.doc.captureSync();
    return { a, b, c, leaf, root: map.tree.id };
  });
}
async function snapshot(page: Page) {
  return page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    return gfx.surface!.elementModels.map(model => structuredClone(model.serialize()));
  });
}

test('@02-03-02 nested collapse has direct-child accessible count and exact undo redo state', async ({ page }) => {
  const ids = await seed(page);
  const before = await snapshot(page);
  await expect(page.getByRole('button', { name: 'Collapse branch', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Collapse branch', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Expand branch: 2 direct branches hidden', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByText('Branch collapsed. 2 direct branches hidden.', { exact: true })).toBeVisible();
  const collapsed = await snapshot(page);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(() => snapshot(page)).toEqual(before);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect.poll(() => snapshot(page)).toEqual(collapsed);
  await page.getByRole('button', { name: 'Expand branch: 2 direct branches hidden', exact: true }).click();
  const state = await page.locator('affine-edgeless-root').evaluate((el, ids) => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const map = gfx.surface!.elementModels.find(e => e.type === 'mindmap') as MindmapElementModel;
    return { nested: map.children.get(ids.c)?.collapsed, hidden: map.getNode(ids.leaf)!.element.hidden,
      selected: gfx.selection.selectedElements.map(e => e.id), texts: [...map.children.keys()].map(id => (map.getNode(id)!.element as ShapeElementModel).text?.toString()) };
  }, ids);
  expect(state.nested).toBe(true); expect(state.hidden).toBe(true); expect(state.selected).toEqual([ids.a]);
  expect(state.texts).toHaveLength(7);
  await page.getByRole('button', { name: 'Saved locally', exact: true }).waitFor();
  const expanded = await snapshot(page);
  await page.reload(); await expect.poll(() => snapshot(page)).toEqual(expanded);
});
