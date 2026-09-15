import { test, expect } from './fixtures';
import { prepareClipboard, pasteClipboard } from './clipboard-route';
import type { Page } from '@playwright/test';
import type { EditorHost } from '@blocksuite/affine/std';
import type { GfxController } from '@blocksuite/affine/std/gfx';
import type { MindmapElementModel, ShapeElementModel } from '@blocksuite/affine/model';

async function seed(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add mind map', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('Central topic');
  await page.keyboard.type('Synthetic source');
  await page.keyboard.press('Enter');
  await expect(page.locator('edgeless-shape-text-editor')).toHaveCount(0);
  return page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const map = gfx.surface!.elementModels.find(e => e.type === 'mindmap') as MindmapElementModel;
    const branch = map.addNode(map.tree.id, undefined, 'after', { text: 'Synthetic branch' });
    const nested = map.addNode(branch, undefined, 'after', { text: 'Synthetic nested' });
    map.addNode(nested, undefined, 'after', { text: 'Hidden detail' });
    map.addNode(branch, undefined, 'after', { text: 'Sibling detail' });
    const other = map.addNode(map.tree.id, undefined, 'after', { text: 'Other branch' });
    map.addNode(other, undefined, 'after', { text: 'Other detail' });
    map.toggleCollapse(map.getNode(nested)!, { layout: true });
    map.toggleCollapse(map.getNode(branch)!, { layout: true });
    map.traverse(node => gfx.surface!.updateElement(node.id, { fontSize: 29, fontWeight: '700', color: '#345678' }));
    map.layout(); gfx.doc.captureSync();
    gfx.selection.set({ elements: [map.id], editing: false });
    return { map: map.id, branch, nested, doc: gfx.doc.id };
  });
}

async function state(page: Page) {
  return page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    return { doc: gfx.doc.id, elements: gfx.surface!.elementModels.map(e => e.id), maps: gfx.surface!.elementModels.filter(e => e.type === 'mindmap').map(e => {
      const map = e as MindmapElementModel;
      return { id: map.id, nodes: [...map.children].map(([id, detail]) => {
        const shape = map.getNode(id)!.element as ShapeElementModel;
        return { id, ...detail, xywh: shape.xywh, hidden: shape.hidden, text: shape.text?.toString(), fontSize: shape.fontSize, fontWeight: shape.fontWeight, color: shape.color };
      }) };
    }) };
  });
}

test('@02-02-01 queued duplicate captures intended source selection at invocation', async ({ page }) => {
  const ids = await seed(page);
  await page.locator('affine-edgeless-root').evaluate((el, id) => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    gfx.selection.set({ elements: [id], editing: false });
    // Deterministic scheduling probe: change selection in the same event turn.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', bubbles: true, ctrlKey: !/Mac/.test(navigator.platform), metaKey: /Mac/.test(navigator.platform) }));
    const unrelated = gfx.surface!.addElement({ type: 'shape', xywh: '[0,0,50,50]' });
    gfx.selection.set({ elements: [unrelated], editing: false });
  }, ids.map);
  await expect.poll(async () => (await state(page)).maps.length).toBe(2);
  expect((await state(page)).maps[1]!.nodes).toHaveLength(7);
});

for (const route of ['duplicate', 'clipboard'] as const) test(`@02-02-01 ${route} retains nested details, typography, Undo and independent edits`, async ({ page, context, browserName, expectErrors },testInfo) => {
  await prepareClipboard(page,context,browserName,testInfo,route==='clipboard'?expectErrors:[]);
  const ids = await seed(page);
  const source = (await state(page)).maps[0]!;
  if (route === 'duplicate') await page.keyboard.press('ControlOrMeta+d');
  else {
    await page.evaluate(() => navigator.clipboard.writeText('Synthetic clipboard marker'));
    await page.keyboard.press('ControlOrMeta+c');
    await expect.poll(() => page.evaluate(async () => {
      try { const items = await navigator.clipboard.read(); const html = items.find(i => i.types.includes('text/html')); return !!html && (await (await html.getType('text/html')).text()).includes('data-blocksuite'); }
      catch (cause) { if ((cause as Error).name === 'InvalidStateError') return false; throw cause; }
    })).toBe(true);
    await pasteClipboard(page,browserName);
  }
  await expect.poll(async () => (await state(page)).maps.length).toBe(2);
  const copy = (await state(page)).maps.find(m => m.id !== ids.map)!;
  const labels = new Map(copy.nodes.map(n => [n.id, n.text]));
  expect(copy.nodes).toHaveLength(7);
  for (const node of copy.nodes) {
    const original = source.nodes.find(n => n.text === node.text)!;
    expect(node.id).not.toBe(original.id);
    expect({ ...node, id: original.id, parent: node.parent ? source.nodes.find(n => n.text === labels.get(node.parent!))!.id : undefined, xywh: original.xywh }).toEqual({ ...original, parent: original.parent });
  }
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(async () => (await state(page)).maps).toEqual([source]);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect.poll(async () => (await state(page)).maps.length).toBe(2);
  await page.locator('affine-edgeless-root').evaluate((el, id) => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const map = gfx.surface!.getElementById(id) as MindmapElementModel;
    const branch = map.tree.children[0]!;
    map.toggleCollapse(branch, { layout: true });
    (map.tree.element as ShapeElementModel).text!.insert(0, 'Edited copy ');
    gfx.surface!.updateElement(map.tree.id, { fontSize: 35, color: '#663399' });
    map.layout(); gfx.doc.captureSync();
  }, copy.id);
  expect((await state(page)).maps.find(m => m.id === ids.map)).toEqual(source);
  await page.getByRole('button', { name: 'Saved locally', exact: true }).waitFor();
  const beforeReload = await state(page);
  await page.reload();
  await expect.poll(() => state(page)).toEqual(beforeReload);
  if (route === 'duplicate') {
    await page.locator('affine-edgeless-root').evaluate((el, id) => {
      const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
      gfx.selection.set({ elements: [id], editing: false });
    }, ids.map);
    await page.keyboard.press('ControlOrMeta+d');
    await expect.poll(async () => (await state(page)).maps.length).toBe(3);
    const maps = (await state(page)).maps;
    expect(new Set(maps.flatMap(m => m.nodes.map(n => n.id))).size).toBe(21);
    expect(maps.find(m => m.id === ids.map)).toEqual(source);
  }
});

test('@02-02-01 board copy retains document-local IDs and independent typography', async ({ page }) => {
  const ids = await seed(page);
  const original = await state(page);
  await page.getByRole('button', { name: 'Saved locally', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Untitled board', exact: true }).click();
  await page.getByRole('menuitem', { name: 'All boards', exact: true }).click();
  await page.locator('.board-card').filter({ has: page.getByRole('button', { name: 'Open Untitled board', exact: true }) }).getByRole('button', { name: 'Duplicate', exact: true }).click();
  await page.getByRole('button', { name: 'Open Untitled board copy', exact: true }).click();
  await expect.poll(async () => (await state(page)).maps).toEqual(original.maps);
  expect((await state(page)).doc).not.toBe(ids.doc);
  await page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const map = gfx.surface!.elementModels.find(e => e.type === 'mindmap') as MindmapElementModel;
    map.toggleCollapse(map.tree.children[0]!, { layout: true });
    gfx.surface!.updateElement(map.tree.id, { fontSize: 40, fontWeight: '400', color: '#991122' });
    map.layout(); gfx.doc.captureSync();
  });
  await page.getByRole('button', { name: 'Saved locally', exact: true }).waitFor();
  const changed = await state(page);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(async () => (await state(page)).maps[0]!.nodes.find(n => !n.parent)!.fontSize).toBe(29);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect.poll(() => state(page)).toEqual(changed);
  await page.getByRole('button', { name: 'Saved locally', exact: true }).waitFor();
  await page.reload(); await expect.poll(() => state(page)).toEqual(changed);
  await page.getByRole('button', { name: 'Untitled board copy', exact: true }).click();
  await page.getByRole('menuitem', { name: 'All boards', exact: true }).click();
  await page.getByRole('button', { name: 'Open Untitled board', exact: true }).click();
  await expect.poll(() => state(page)).toEqual(original);
});

for (const invalidation of ['readonly', 'locked', 'removed', 'detached'] as const) test(`@02-02-01 ${invalidation} source cancels queued duplication`, async ({ page }) => {
  const ids = await seed(page);
  const unchanged = await page.locator('affine-edgeless-root').evaluate(async (el, { id, invalidation }) => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const host = el.closest('editor-host') as EditorHost;
    const map = gfx.surface!.getElementById(id) as MindmapElementModel;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', bubbles: true, ctrlKey: !/Mac/.test(navigator.platform), metaKey: /Mac/.test(navigator.platform) }));
    if (invalidation === 'readonly') gfx.doc.readonly = true;
    if (invalidation === 'locked') map.tree.children[0]!.element.lock();
    if (invalidation === 'removed') gfx.surface!.deleteElement(id);
    if (invalidation === 'detached') host.remove();
    const before = JSON.stringify(gfx.doc.spaceDoc.toJSON());
    await new Promise<void>(resolve => setTimeout(resolve, 100));
    return before === JSON.stringify(gfx.doc.spaceDoc.toJSON());
  }, { id: ids.map, invalidation });
  expect(unchanged).toBe(true);
});

for (const defect of ['orphan', 'cycle', 'duplicate', 'nonfinite', 'empty-order', 'duplicate-order', 'excessive-depth'] as const) test(`@02-02-01 malformed ${defect} clipboard hierarchy inserts nothing`, async ({ page, context, browserName, expectErrors },testInfo) => {
  await prepareClipboard(page,context,browserName,testInfo,expectErrors);
  await seed(page);
  const before = await state(page);
  const documentBefore = await page.locator('affine-edgeless-root').evaluate(el =>
    JSON.stringify((el as HTMLElement & { gfx: GfxController }).gfx.doc.spaceDoc.toJSON()));
  await page.locator('affine-edgeless-root').evaluate(async (el, defect) => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const host = el.closest('editor-host') as EditorHost;
    const map = gfx.surface!.elementModels.find(e => e.type === 'mindmap') as MindmapElementModel;
    const snapshot = [...map.children.keys()].map(id => gfx.surface!.getElementById(id)!.serialize());
    const data = structuredClone(map.serialize());
    const child = map.tree.children[0]!.id;
    if (defect === 'orphan') data.children[child]!.parent = 'missing-synthetic-parent';
    if (defect === 'cycle') data.children[map.tree.id]!.parent = child;
    if (defect === 'duplicate') snapshot.push(structuredClone(snapshot[0]!));
    if (defect === 'nonfinite') Object.assign(snapshot[0]!, { xywh: '[0,0,1e400,50]' });
    if (defect === 'empty-order') data.children[map.tree.id]!.index = '';
    if (defect === 'duplicate-order') data.children[map.tree.children[1]!.id]!.index = data.children[child]!.index;
    if (defect === 'excessive-depth') {
      const template = structuredClone(snapshot[0]!);
      snapshot.length = 0;
      data.children = {};
      for (let depth = 0; depth < 130; depth++) {
        const id = `synthetic-depth-${depth}`;
        snapshot.push({ ...structuredClone(template), id });
        data.children[id] = { index: 'a0', ...(depth ? { parent: `synthetic-depth-${depth - 1}` } : {}) };
      }
    }
    await host.std.clipboard.writeToClipboard(async items => ({ ...items, 'blocksuite/surface': JSON.stringify({ snapshot: [...snapshot, data], blobs: {} }) }));
  }, defect);
  await pasteClipboard(page,browserName);
  await page.waitForTimeout(150);
  expect(await state(page)).toEqual(before);
  expect(await page.locator('affine-edgeless-root').evaluate(el =>
    JSON.stringify((el as HTMLElement & { gfx: GfxController }).gfx.doc.spaceDoc.toJSON()))).toBe(documentBefore);
});

test('@02-02-01 native topic copy preserves its branch and ordinary duplicate remains available', async ({ page }) => {
  const ids = await seed(page);
  const before = await state(page);
  await page.locator('affine-edgeless-root').evaluate((el, id) => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    gfx.selection.set({ elements: [id], editing: false });
  }, ids.branch);
  await page.keyboard.press('ControlOrMeta+d');
  await expect.poll(async () => (await state(page)).elements.length).toBe(before.elements.length + 4);
  const copied = await state(page);
  expect(copied.maps[0]!.nodes).toHaveLength(11);
  await page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const id = gfx.surface!.addElement({ type: 'shape', xywh: '[0,0,50,50]' });
    gfx.selection.set({ elements: [id], editing: false });
  });
  await page.keyboard.press('ControlOrMeta+d');
  await expect.poll(async () => (await state(page)).elements.length).toBe(copied.elements.length + 2);
  expect((await state(page)).maps).toEqual(copied.maps);
});

test('@02-02-01 source lock immediately before native conversion prevents mutation', async ({ page }) => {
  await seed(page);
  const before = await state(page);
  await page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const host = el.closest('editor-host') as EditorHost;
    const nativeExec = host.std.command.exec;
    host.std.command.exec = ((...args: Parameters<typeof nativeExec>) => {
      if (args[1] && 'elementsRawData' in args[1]) {
        const map = gfx.surface!.elementModels.find(e => e.type === 'mindmap') as MindmapElementModel;
        map.tree.children[0]!.element.lock();
      }
      return nativeExec(...args);
    }) as typeof nativeExec;
  });
  await page.keyboard.press('ControlOrMeta+d');
  await page.waitForTimeout(100);
  expect(await state(page)).toEqual(before);
});
