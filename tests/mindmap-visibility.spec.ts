import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import type { GfxController } from '@blocksuite/affine/std/gfx';
import type { MindmapElementModel } from '@blocksuite/affine/model';

async function seed(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add mind map', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('Central topic');
  await page.keyboard.press('Escape');
  return page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const map = gfx.surface!.elementModels.find(e => e.type === 'mindmap') as MindmapElementModel;
    const a = map.addNode(map.tree.id, undefined, 'after', { text: 'Visible branch' });
    const b = map.addNode(map.tree.id, undefined, 'after', { text: 'Other branch' });
    const c = map.addNode(a, undefined, 'after', { text: 'Hidden nested branch' });
    const d = map.addNode(c, undefined, 'after', { text: 'Hidden nested detail' });
    const leaf = map.addNode(a, undefined, 'after', { text: 'Hidden direct leaf' });
    map.addNode(b, undefined, 'after', { text: 'Visible detail' });
    map.toggleCollapse(map.getNode(c)!, { layout: true });
    map.toggleCollapse(map.getNode(a)!, { layout: true });
    gfx.selection.set({ elements: [a], editing: false });
    gfx.doc.captureSync();
    return { map: map.id, root: map.tree.id, a, b, c, d, leaf };
  });
}

async function selected(page: Page) {
  return page.locator('affine-edgeless-root').evaluate(el =>
    (el as HTMLElement & { gfx: GfxController }).gfx.selection.selectedElements.map(model => model.id));
}
async function snapshot(page: Page) {
  return page.locator('affine-edgeless-root').evaluate(el =>
    (el as HTMLElement & { gfx: GfxController }).gfx.surface!.elementModels.map(model => structuredClone(model.serialize())));
}

test('@02-04-01 Layers filters every effectively hidden descendant', async ({ page }) => {
  const ids = await seed(page);
  await page.getByRole('button', { name: 'Layers', exact: true }).click();
  const layers = page.getByTestId('layers-inspector');
  for (const id of [ids.c, ids.d, ids.leaf]) await expect(layers.locator(`[data-layer-id="${id}"]`)).toHaveCount(0);
  await expect(layers.locator(`[data-layer-id="${ids.a}"]`)).toBeVisible();
  await layers.locator(`[data-layer-id="${ids.b}"] .layers-list__select`).click();
  expect(await selected(page)).toEqual([ids.b]);
});

test('@02-04-01 arrow traversal and stale selection cannot select a hidden topic', async ({ page }) => {
  const ids = await seed(page);
  await page.keyboard.press('ArrowRight');
  expect(await selected(page)).toEqual([ids.a]);
  await page.locator('affine-edgeless-root').evaluate((el, ids) => {
    (el as HTMLElement & { gfx: GfxController }).gfx.selection.set({ elements: [ids.d], editing: false });
  }, ids);
  expect(await selected(page)).toEqual([ids.a]);
});

test('@02-04-01 grouping and alignment reject partial mind-map selection', async ({ page }) => {
  const ids = await seed(page);
  await page.locator('affine-edgeless-root').evaluate((el, ids) => {
    (el as HTMLElement & { gfx: GfxController }).gfx.selection.set({ elements: [ids.a, ids.b], editing: false });
  }, ids);
  const before = await snapshot(page);
  await page.getByRole('button', { name: 'Layers', exact: true }).click();
  const layers = page.getByTestId('layers-inspector');
  await expect(layers.getByRole('button', { name: 'Group', exact: true })).toBeDisabled();
  await expect(layers.getByRole('button', { name: 'Left', exact: true })).toBeDisabled();
  await expect(layers.getByText('Select the whole mind map to group or align it.', { exact: true })).toBeVisible();
  await page.keyboard.press('ControlOrMeta+g');
  expect(await snapshot(page)).toEqual(before);
});
