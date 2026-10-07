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
    (el as HTMLElement & { gfx: GfxController }).gfx.surface!.elementModels.sort((a, b) => a.id.localeCompare(b.id)).map(model => structuredClone(model.serialize())));
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

test('@02-04-01 real pointer and marquee ignore hidden topic bounds', async ({ page }) => {
  const ids = await seed(page);
  const bounds = await page.locator('affine-edgeless-root').evaluate((el, ids) => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const shape = gfx.surface!.getElementById(ids.leaf)!;
    const [x, y] = gfx.viewport.toModelCoord(350, 450);
    shape.xywh = `[${x},${y},100,50]`;
    gfx.selection.set({ elements: [], editing: false });
    const rect = el.closest('editor-host')!.getBoundingClientRect();
    return { x: rect.x + 350, y: rect.y + 450 };
  }, ids);
  await page.mouse.click(bounds.x + 50, bounds.y + 25);
  expect(await selected(page)).not.toContain(ids.leaf);
  await page.mouse.move(bounds.x - 12, bounds.y - 12); await page.mouse.down();
  await page.mouse.move(bounds.x + 112, bounds.y + 62, { steps: 12 }); await page.mouse.up();
  expect(await selected(page)).not.toContain(ids.leaf);
  const visibleBounds = await page.locator('affine-edgeless-root').evaluate((el, ids) => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const map = gfx.surface!.getElementById(ids.map) as MindmapElementModel;
    const visible = [...map.children.keys()].map(id => gfx.surface!.getElementById(id)!).filter(model => !model.hidden);
    return { actual: map.elementBound.toXYWH(), expected: [Math.min(...visible.map(m => m.x)), Math.min(...visible.map(m => m.y)),
      Math.max(...visible.map(m => m.x + m.w)) - Math.min(...visible.map(m => m.x)),
      Math.max(...visible.map(m => m.y + m.h)) - Math.min(...visible.map(m => m.y))] };
  }, ids);
  expect(visibleBounds.actual).toEqual(visibleBounds.expected);
  const connectors = await page.locator('affine-edgeless-root').evaluate((el, ids) => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const map = gfx.surface!.getElementById(ids.map) as MindmapElementModel;
    const nodes = [...map.children.keys()].map(id => map.getNode(id)!).filter(node => !node.element.hidden);
    return {
      actual: nodes.flatMap(node => (map.getConnectors(node) ?? []).map(value => value.connector).filter(edge => edge.target.id).map(edge => `${edge.source.id}:${edge.target.id}`)).sort(),
      expected: nodes.filter(node => node.detail.parent).map(node => `${node.detail.parent}:${node.id}`).sort(),
    };
  }, ids);
  expect(connectors.actual).toEqual(connectors.expected);
});

for (const target of ['leaf', 'branch', 'root'] as const) {
  test(`@02-04-01 native ${target} deletion and one Undo restore complete hidden content`, async ({ page }) => {
    const ids = await seed(page);
    await page.mouse.click(700, 550);
    await page.locator('affine-edgeless-root').evaluate((el, { ids, target }) => {
      const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
      const map = gfx.surface!.getElementById(ids.map) as MindmapElementModel;
      const visibleLeaf = map.getNode(ids.b)!.children[0]!.id;
      gfx.surface!.addElement({ type: 'shape', xywh: '[-350,-250,100,70]' });
      gfx.selection.set({ elements: [target === 'root' ? ids.root : target === 'branch' ? ids.a : visibleLeaf], editing: false });
      gfx.doc.captureSync();
    }, { ids, target });
    const before = await snapshot(page);
    await page.keyboard.press('Backspace');
    await expect.poll(async () => (await snapshot(page)).length).toBe(before.length - (target === 'root' ? 8 : target === 'branch' ? 4 : 1));
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect.poll(() => snapshot(page)).toEqual(before);
  });
}

test('@02-04-01 whole-map movement and ordinary grouping retain hidden hierarchy', async ({ page }) => {
  const ids = await seed(page);
  const before = await snapshot(page);
  await page.locator('affine-edgeless-root').evaluate((el, ids) => {
    (el as HTMLElement & { gfx: GfxController }).gfx.selection.set({ elements: [ids.map], editing: false });
  }, ids);
  await page.keyboard.press('Shift+ArrowRight');
  const moved = await snapshot(page);
  const geometry = (values: typeof moved) => values.filter(value => value.type === 'shape').map(value => ({ id: value.id, bound: JSON.parse(String(value.xywh)) as number[] }));
  const beforeShapes = geometry(before), afterShapes = geometry(moved);
  expect(afterShapes).toHaveLength(7);
  for (let i = 0; i < beforeShapes.length; i++) expect(afterShapes[i]!.bound[0]).toBeCloseTo(beforeShapes[i]!.bound[0]! + 10);
  const ordinary = await page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const one = gfx.surface!.addElement({ type: 'shape', xywh: '[-350,-250,100,70]' });
    const two = gfx.surface!.addElement({ type: 'shape', xywh: '[-150,-150,100,70]' });
    gfx.selection.set({ elements: [one, two], editing: false });
    return [one, two];
  });
  await page.keyboard.press('ControlOrMeta+g');
  const result = await page.locator('affine-edgeless-root').evaluate((el, ordinary) => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    return ordinary.map(id => gfx.surface!.getElementById(id)!.group?.id);
  }, ordinary);
  expect(result[0]).toBeTruthy(); expect(result[0]).toBe(result[1]);
});

test('@02-04-01 hidden descendant locks protect native branch deletion', async ({ page }) => {
  const ids = await seed(page);
  await page.locator('affine-edgeless-root').evaluate((el, ids) => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    gfx.surface!.getElementById(ids.d)!.lock();
  }, ids);
  const before = await snapshot(page);
  await page.keyboard.press('Delete');
  expect(await snapshot(page)).toEqual(before);
});

test('@02-04-01 mixed whole-map grouping and ungrouping preserve topic topology', async ({ page }) => {
  const ids = await seed(page);
  const before = await snapshot(page);
  const other = await page.locator('affine-edgeless-root').evaluate((el, ids) => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const other = gfx.surface!.addElement({ type: 'shape', xywh: '[-350,-250,100,70]' });
    gfx.selection.set({ elements: [ids.map, other], editing: false });
    return other;
  }, ids);
  await page.getByRole('button', { name: 'Layers', exact: true }).click();
  const layers = page.getByTestId('layers-inspector');
  await expect(layers.getByRole('button', { name: 'Left', exact: true })).toBeEnabled();
  await layers.getByRole('button', { name: 'Group', exact: true }).click();
  const groups = await page.locator('affine-edgeless-root').evaluate((el, { ids, other }) => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    return [ids.map, other].map(id => gfx.surface!.getElementById(id)!.group?.id);
  }, { ids, other });
  expect(groups[0]).toBeTruthy(); expect(groups[0]).toBe(groups[1]);
  await layers.getByRole('button', { name: 'Ungroup', exact: true }).click();
  const after = await snapshot(page);
  // Native grouping moves the container forward in the canvas stacking order.
  const expected = before.map(model => model.id === ids.map
    ? { ...model, index: after.find(candidate => candidate.id === ids.map)!.index } : model);
  expect(after.filter(model => before.some(original => original.id === model.id))).toEqual(expected);
});
