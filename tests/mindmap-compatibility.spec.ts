import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import type { GfxController } from '@blocksuite/affine/std/gfx';
import type { MindmapElementModel, ShapeElementModel } from '@blocksuite/affine/model';

async function seed(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add mind map', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('Central topic');
  await page.keyboard.press('Enter');
  await expect(page.locator('edgeless-shape-text-editor')).toHaveCount(0);
  return page.locator('affine-edgeless-root').evaluate(async el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const map = gfx.surface!.elementModels.find(e => e.type === 'mindmap') as MindmapElementModel;
    const a = map.addNode(map.tree.id, undefined, 'after', { text: 'Synthetic branch A' });
    const b = map.addNode(map.tree.id, undefined, 'after', { text: 'Synthetic branch B' });
    const c = map.addNode(a, undefined, 'after', { text: 'Synthetic nested' });
    map.addNode(a, undefined, 'after', { text: 'Synthetic leaf' });
    map.addNode(c, undefined, 'after', { text: '<img src=x onerror=alert(1)>\nSynthetic detail' });
    map.addNode(b, undefined, 'after', { text: 'Synthetic final leaf' });
    map.toggleCollapse(map.getNode(c)!, { layout: true });
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    gfx.doc.captureSync();
    return { map: map.id, a, b, c, root: map.tree.id };
  });
}

async function snapshot(page: Page) {
  return page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const map = gfx.surface!.elementModels.find(e => e.type === 'mindmap') as MindmapElementModel;
    return [...map.children].map(([id, detail]) => {
      const shape = map.getNode(id)!.element as ShapeElementModel;
      return { id, ...detail, hidden: shape.hidden, xywh: shape.xywh, text: shape.text?.toString(), fontSize: shape.fontSize, fontWeight: shape.fontWeight, color: shape.color };
    });
  });
}

test('@02-01-02 explicit native typography survives layout and preset fitting', async ({ page }) => {
  await seed(page);
  const result = await page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const map = gfx.surface!.elementModels.find(e => e.type === 'mindmap') as MindmapElementModel;
    map.traverse(node => gfx.surface!.updateElement(node.id, { fontSize: 31, fontWeight: '700', color: '#123456' }));
    map.layout();
    map.style = 2;
    map.layout();
    return [...map.children.keys()].map(id => {
      const shape = map.getNode(id)!.element as ShapeElementModel;
      return [shape.fontSize, shape.fontWeight, shape.color];
    });
  });
  expect(result).toEqual(Array.from({ length: 7 }, () => [31, '700', '#123456']));
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Saved locally', exact: true }).waitFor();
  const before = await snapshot(page);
  await page.reload();
  await expect.poll(() => snapshot(page)).toEqual(before);
});

test('@02-01-02 collapse and queued geometry occupy exactly one undo action', async ({ page }) => {
  const ids = await seed(page);
  await page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    gfx.doc.captureSync();
    const map = gfx.surface!.elementModels.find(e => e.type === 'mindmap') as MindmapElementModel;
    (map.tree.element as ShapeElementModel).text!.insert(0, 'Independent edit ');
    map.layout();
    gfx.doc.captureSync();
  });
  const before = await snapshot(page);
  await page.locator('affine-edgeless-root').evaluate((el, id) => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const map = gfx.surface!.elementModels.find(e => e.type === 'mindmap') as MindmapElementModel;
    map.toggleCollapse(map.getNode(id)!, { layout: true });
  }, ids.a);
  const collapsed = await snapshot(page);
  expect(collapsed.find(n => n.id === ids.a)?.collapsed).toBe(true);
  expect(collapsed.filter(n => n.hidden).length).toBeGreaterThan(before.filter(n => n.hidden).length);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(() => snapshot(page)).toEqual(before);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect.poll(() => snapshot(page)).toEqual(collapsed);
});

test('@02-01-02 injected layout failure restores affected native fields', async ({ page }) => {
  const ids = await seed(page);
  const before = await snapshot(page);
  const error = await page.locator('affine-edgeless-root').evaluate((el, id) => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const map = gfx.surface!.elementModels.find(e => e.type === 'mindmap') as MindmapElementModel;
    map.setLayoutMethod(() => { throw new Error('Synthetic layout fault'); });
    try { map.toggleCollapse(map.getNode(id)!, { layout: true }); return null; }
    catch (cause) { return (cause as Error).message; }
  }, ids.a);
  expect(error).toContain('Synthetic layout fault');
  expect(await snapshot(page)).toEqual(before);
});

test('@02-01-02 disposed map callbacks make zero document writes', async ({ page }) => {
  await seed(page);
  const unchanged = await page.locator('affine-edgeless-root').evaluate(async el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const map = gfx.surface!.elementModels.find(e => e.type === 'mindmap') as MindmapElementModel;
    const deferred = map.requestLayout.bind(map);
    el.closest('editor-host')!.remove();
    const before = JSON.stringify(gfx.doc.spaceDoc.toJSON());
    deferred();
    await Promise.resolve();
    return before === JSON.stringify(gfx.doc.spaceDoc.toJSON());
  });
  expect(unchanged).toBe(true);
});
