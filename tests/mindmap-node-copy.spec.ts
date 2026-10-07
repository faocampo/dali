import { test, expect } from './fixtures';
import { prepareClipboard, pasteClipboard } from './clipboard-route';
import { openObjectActions } from './object-actions';
import type { Page } from '@playwright/test';
import type { GfxController } from '@blocksuite/affine/std/gfx';
import type { MindmapElementModel, ShapeElementModel } from '@blocksuite/affine/model';
import type { EditorHost } from '@blocksuite/affine/std';

async function seed(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add mind map', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('Central topic');
  await page.keyboard.press('Enter');
  return page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const map = gfx.surface!.elementModels.find(m => m.type === 'mindmap') as MindmapElementModel;
    const branch = map.addNode(map.tree.id, undefined, 'after', { text: 'Source branch' });
    const child = map.addNode(branch, undefined, 'after', { text: 'Hidden child' });
    const destination = map.addNode(map.tree.id, undefined, 'after', { text: 'Destination' });
    const shape = map.getNode(branch)!.element as ShapeElementModel;
    gfx.surface!.updateElement(shape.id, { fontSize: 31, fontWeight: '700', color: '#345678' });
    map.toggleCollapse(map.getNode(branch)!, { layout: true });
    gfx.selection.set({ elements: [branch], editing: false });
    gfx.doc.captureSync();
    return { map: map.id, root: map.tree.id, branch, child, destination };
  });
}
async function state(page: Page) {
  return page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    return { count: gfx.surface!.elementModels.length, maps: gfx.surface!.elementModels.filter(m => m.type === 'mindmap').map(m => {
      const map = m as MindmapElementModel;
      return { id: map.id, nodes: [...map.children].map(([id, detail]) => {
        const shape = gfx.surface!.getElementById(id) as ShapeElementModel;
        return { id, ...detail, text: shape.text?.toString(), fontSize: shape.fontSize, fontWeight: shape.fontWeight, color: shape.color };
      }) };
    }) };
  });
}

for (const route of ['native', 'custom', 'shortcut'] as const) test(`topic ${route} Duplicate creates an independent sibling subtree`, async ({ page }) => {
  const ids = await seed(page); const before = await state(page);
  if (route === 'native') {
    await page.locator('editor-icon-button[aria-label="More"]').click();
    await page.locator('editor-menu-action[aria-label="Duplicate"]').click({ timeout: 5000 });
  } else if (route === 'custom') {
    await openObjectActions(page); await page.getByRole('menuitem', { name: 'Duplicate', exact: true }).click();
  } else { await page.locator('editor-host').focus(); await page.keyboard.press('ControlOrMeta+d'); }
  await expect.poll(async () => (await state(page)).maps[0]!.nodes.length, { timeout: 3000 }).toBe(6);
  const after = await state(page);
  expect(after.count).toBe(before.count + 2);
  const copies = after.maps[0]!.nodes.filter(n => !before.maps[0]!.nodes.some(old => old.id === n.id));
  const branch = copies.find(n => n.text === 'Source branch')!;
  expect(branch).toMatchObject({ parent: ids.root, collapsed: true, fontSize: 31, fontWeight: '700', color: '#345678' });
  expect(copies.find(n => n.text === 'Hidden child')!.parent).toBe(branch.id);
  expect(after.maps[0]!.nodes.filter(n => before.maps[0]!.nodes.some(old => old.id === n.id))).toEqual(before.maps[0]!.nodes);
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); expect(await state(page)).toEqual(before);
  await page.getByRole('button', { name: 'Redo', exact: true }).click(); expect(await state(page)).toEqual(after);
  if (route === 'custom') {
    await page.locator('affine-edgeless-root').evaluate((el, id) => {
      const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
      const copy = gfx.surface!.getElementById(id) as ShapeElementModel;
      copy.text!.insert(0, 'Edited copy ');
      const map = copy.group as MindmapElementModel;
      map.toggleCollapse(map.getNode(id)!, { layout: true });
    }, branch.id);
    expect((await state(page)).maps[0]!.nodes.filter(n => before.maps[0]!.nodes.some(old => old.id === n.id))).toEqual(before.maps[0]!.nodes);
    await page.getByRole('button', { name: 'Saved, Open save details', exact: true }).waitFor();
    const saved = await state(page); await page.reload();
    await expect.poll(() => state(page)).toEqual(saved);
  }
});

for (const destination of ['topic', 'empty'] as const) test(`topic clipboard retains subtree at ${destination} destination`, async ({ page, context, browserName, expectErrors }, testInfo) => {
  await prepareClipboard(page, context, browserName, testInfo, expectErrors);
  const ids = await seed(page); const before = await state(page);
  await page.locator('editor-host').focus(); await page.keyboard.press('ControlOrMeta+c');
  await expect.poll(() => page.evaluate(async () => (await navigator.clipboard.read()).length)).toBeGreaterThan(0);
  await page.locator('affine-edgeless-root').evaluate((el, id) => {
    (el as HTMLElement & { gfx: GfxController }).gfx.selection.set({ elements: id ? [id] : [], editing: false });
  }, destination === 'topic' ? ids.destination : '');
  await pasteClipboard(page, browserName);
  await expect.poll(async () => (await state(page)).maps.reduce((sum, m) => sum + m.nodes.length, 0), { timeout: 3000 }).toBe(6);
  const after = await state(page);
  const map = after.maps[destination === 'topic' ? 0 : 1]!;
  const branch = map.nodes.find(n => n.text === 'Source branch' && n.id !== ids.branch)!;
  expect(branch.parent).toBe(destination === 'topic' ? ids.destination : undefined);
  expect(branch.collapsed).toBe(true);
  expect(map.nodes.find(n => n.text === 'Hidden child' && n.id !== ids.child)!.parent).toBe(branch.id);
  expect(after.maps[0]!.nodes.filter(n => before.maps[0]!.nodes.some(old => old.id === n.id))).toEqual(before.maps[0]!.nodes);
});

test('branch paste rejects a locked destination without creating loose shapes', async ({ page, context, browserName, expectErrors }, testInfo) => {
  await prepareClipboard(page, context, browserName, testInfo, expectErrors);
  const ids = await seed(page);
  await page.locator('editor-host').focus(); await page.keyboard.press('ControlOrMeta+c');
  await expect.poll(() => page.evaluate(async () => (await navigator.clipboard.read()).length)).toBeGreaterThan(0);
  await page.locator('affine-edgeless-root').evaluate((el, id) => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    gfx.selection.set({ elements: [id], editing: false }); gfx.surface!.getElementById(id)!.lock();
  }, ids.destination);
  const before = await state(page);
  await pasteClipboard(page, browserName); await page.waitForTimeout(200);
  expect(await state(page)).toEqual(before);
});

test('pending branch conversion preserves intervening edits and unrelated objects on rejection', async ({ page }) => {
  const ids = await seed(page); const before = await state(page);
  await page.locator('affine-edgeless-root').evaluate((el, ids) => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const subscription = gfx.surface!.elementAdded.subscribe(() => {
      subscription.unsubscribe();
      queueMicrotask(() => {
        gfx.surface!.addElement({ type: 'shape', xywh: '[120,120,50,50]' });
        (gfx.surface!.getElementById(ids.destination) as ShapeElementModel).text!.insert(0, 'Intervening ');
      });
    });
  }, ids);
  await page.locator('editor-host').focus(); await page.keyboard.press('ControlOrMeta+d');
  await expect.poll(async () => (await state(page)).maps[0]!.nodes.find(n => n.id === ids.destination)!.text).toBe('Intervening Destination');
  const after = await state(page);
  expect(after.count).toBe(before.count + 1);
  expect(after.maps[0]!.nodes).toHaveLength(4);
});

test('root Duplicate creates an independent native map', async ({ page }) => {
  const ids = await seed(page); const before = await state(page);
  await page.locator('affine-edgeless-root').evaluate((el, id) => {
    (el as HTMLElement & { gfx: GfxController }).gfx.selection.set({ elements: [id], editing: false });
  }, ids.root);
  await page.locator('editor-host').focus(); await page.keyboard.press('ControlOrMeta+d');
  await expect.poll(async () => (await state(page)).maps.length).toBe(2);
  const after = await state(page);
  expect(after.maps[0]).toEqual(before.maps[0]);
  expect(after.maps[1]!.nodes).toHaveLength(4);
  expect(after.maps[1]!.nodes.every(n => !before.maps[0]!.nodes.some(old => old.id === n.id))).toBe(true);
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); expect(await state(page)).toEqual(before);
});

test('malformed marked branch paste preserves exact document state', async ({ page, context, browserName, expectErrors }, testInfo) => {
  await prepareClipboard(page, context, browserName, testInfo, expectErrors);
  await seed(page);
  const before = await page.locator('affine-edgeless-root').evaluate(async el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const host = el.closest('editor-host') as EditorHost;
    const map = gfx.surface!.elementModels.find(m => m.type === 'mindmap') as MindmapElementModel;
    gfx.selection.set({ elements: [], editing: false });
    const data = { ...structuredClone(map.serialize()), daliMindmapBranch: 1 };
    data.children[map.tree.id]!.index = '';
    const snapshot = [...map.children.keys()].map(id => gfx.surface!.getElementById(id)!.serialize());
    await host.std.clipboard.writeToClipboard(async items => ({ ...items, 'blocksuite/surface': JSON.stringify({ snapshot: [...snapshot, data], blobs: {} }) }));
    return JSON.stringify(gfx.doc.spaceDoc.toJSON());
  });
  await pasteClipboard(page, browserName); await page.waitForTimeout(200);
  expect(await page.locator('affine-edgeless-root').evaluate(el => JSON.stringify((el as HTMLElement & { gfx: GfxController }).gfx.doc.spaceDoc.toJSON()))).toBe(before);
});
