import { openMindmapProperties } from "./mindmap-properties";
import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import type { GfxController } from '@blocksuite/affine/std/gfx';
import type { MindmapElementModel, ShapeElementModel } from '@blocksuite/affine/model';

async function seed(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add mind map', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('Central topic');
  await page.keyboard.press('Enter');
  await openMindmapProperties(page);
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

test('@02-03-02 leaf has no toggle, one child uses singular, root remains visible', async ({ page }) => {
  const ids = await seed(page);
  const select = async (id: string) => page.locator('affine-edgeless-root').evaluate((el, id) => {
    (el as HTMLElement & { gfx: GfxController }).gfx.selection.set({ elements: [id], editing: false });
  }, id);
  await select(ids.c);
  await expect(page.getByRole('button', { name: 'Expand branch: 1 direct branch hidden', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Expand branch: 1 direct branch hidden', exact: true }).click();
  await select(ids.leaf);
  await expect(page.getByRole('button', { name: /Collapse branch|Expand branch/ })).toHaveCount(0);
  await select(ids.root);
  await expect(page.getByRole('button', { name: 'Add sibling', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Collapse branch', exact: true }).click();
  const visible = await page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const map = gfx.surface!.elementModels.find(e => e.type === 'mindmap') as MindmapElementModel;
    return [...map.children.keys()].filter(id => !map.getNode(id)!.element.hidden);
  });
  expect(visible).toEqual([ids.root]);
});

test('@02-03-02 native collapse relocates hidden selected descendant to ancestor', async ({ page }) => {
  const ids = await seed(page);
  await page.locator('affine-edgeless-root').evaluate((el, ids) => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const map = gfx.surface!.elementModels.find(e => e.type === 'mindmap') as MindmapElementModel;
    gfx.selection.set({ elements: [ids.c], editing: false });
    map.toggleCollapse(map.getNode(ids.a)!, { layout: true });
  }, ids);
  await expect(page.getByText('Topic: Branch A', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Expand branch: 2 direct branches hidden', exact: true }).click();
  await expect(page.getByText('Topic: Branch A', { exact: true })).toBeVisible();
});

test('@02-03-02 locked descendant rejects collapse visibly with full document intact', async ({ page }) => {
  const ids = await seed(page);
  await page.locator('affine-edgeless-root').evaluate((el, ids) => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    gfx.surface!.getElementById(ids.leaf)!.lock();
    gfx.surface!.addElement({ type: 'shape', xywh: '[700,500,100,80]', text: 'Unrelated synthetic object' });
  }, ids);
  const before = await snapshot(page);
  await page.getByRole('button', { name: 'Collapse branch', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('This change could not be applied. Your previous topic is still available. Try again.');
  expect(await snapshot(page)).toEqual(before);
});

test('@02-03-02 injected layout failure retains topology text style geometry and unrelated objects', async ({ page }) => {
  await seed(page);
  await page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const map = gfx.surface!.elementModels.find(e => e.type === 'mindmap') as MindmapElementModel;
    gfx.surface!.addElement({ type: 'shape', xywh: '[700,500,100,80]' });
    map.setLayoutMethod(() => { throw new Error('Synthetic collapse fault'); });
  });
  const before = await snapshot(page);
  await page.getByRole('button', { name: 'Collapse branch', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  expect(await snapshot(page)).toEqual(before);
});

test('@02-03-02 failed child insertion restores omitted defaults and removes partial topics', async ({ page }) => {
  await seed(page);
  await page.getByRole('button', { name: 'Collapse branch', exact: true }).click();
  await page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const map = gfx.surface!.elementModels.find(e => e.type === 'mindmap') as MindmapElementModel;
    map.setLayoutMethod(() => { throw new Error('Synthetic child insertion fault'); });
  });
  const before = await snapshot(page);
  await page.getByRole('button', { name: 'Add child', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  expect(await snapshot(page)).toEqual(before);
});

test('@02-03-02 adding to a collapsed parent reveals existing content and repeated toggles retain topology', async ({ page }) => {
  const ids = await seed(page);
  await page.getByRole('button', { name: 'Collapse branch', exact: true }).click();
  await page.getByRole('button', { name: 'Add child', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('New topic');
  await page.keyboard.press('Enter');
  const count = await page.locator('affine-edgeless-root').evaluate((el, ids) => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const map = gfx.surface!.elementModels.find(e => e.type === 'mindmap') as MindmapElementModel;
    const before = [...map.children].map(([id, detail]) => ({ id, parent: detail.parent, index: detail.index,
      text: (map.getNode(id)!.element as ShapeElementModel).text?.toString() }));
    const immediateVisible = [...map.children.keys()].filter(id => !map.getNode(id)!.element.hidden).length;
    for (let i = 0; i < 12; i++) map.toggleCollapse(map.getNode(ids.a)!, { layout: true });
    const after = [...map.children].map(([id, detail]) => ({ id, parent: detail.parent, index: detail.index,
      text: (map.getNode(id)!.element as ShapeElementModel).text?.toString() }));
    return { before, after, immediateVisible, collapsed: map.children.get(ids.a)?.collapsed,
      nested: map.children.get(ids.c)?.collapsed, hidden: map.getNode(ids.leaf)!.element.hidden,
      visible: [...map.children.keys()].filter(id => !map.getNode(id)!.element.hidden).length };
  }, ids);
  expect(count.before).toHaveLength(8); expect(count.after).toEqual(count.before);
  expect(count.immediateVisible).toBe(7);
  expect(count.collapsed).toBe(false); expect(count.nested).toBe(true); expect(count.hidden).toBe(true);
  expect(count.visible).toBe(7);
});

for (const fault of ['orphan', 'cycle', 'duplicate', 'roots', 'order', 'geometry'] as const) {
  test(`@02-03-02 ${fault} preflight input rejects before native writes`, async ({ page }) => {
    const ids = await seed(page);
    const before = await snapshot(page);
    // Inject malformed restored-detail input at the read-only native iterator
    // boundary; avoid letting native observers repair the fixture before action.
    await page.locator('affine-edgeless-root').evaluate((el, { ids, fault }) => {
      const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
      const map = gfx.surface!.elementModels.find(e => e.type === 'mindmap') as MindmapElementModel;
      const entries = [...map.children].map(([id, detail]) => [id, { ...detail }] as [string, typeof detail]);
      const a = entries.find(([id]) => id === ids.a)!;
      if (fault === 'orphan') a[1].parent = 'unknown-parent';
      if (fault === 'cycle') a[1].parent = ids.c;
      if (fault === 'duplicate') entries.push(a);
      if (fault === 'roots') delete a[1].parent;
      if (fault === 'order') a[1].index = '';
      if (fault === 'geometry') Object.defineProperty(map.tree.element, 'x', { get: () => Infinity, configurable: true });
      map.children[Symbol.iterator] = function* () { yield* entries; };
    }, { ids, fault });
    await page.getByRole('button', { name: 'Collapse branch', exact: true }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    expect(await snapshot(page)).toEqual(before);
  });
}
