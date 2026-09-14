import { openMindmapProperties } from "./mindmap-properties";
import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import type { GfxController } from '@blocksuite/affine/std/gfx';
import type { MindmapElementModel, ShapeElementModel } from '@blocksuite/affine/model';

export async function seedLayout(page: Page, size = 7) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add mind map', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('Central topic');
  await page.keyboard.press('Enter');
  await openMindmapProperties(page);
  return page.locator('affine-edgeless-root').evaluate((el, size) => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const map = gfx.surface!.elementModels.find(e => e.type === 'mindmap') as MindmapElementModel;
    const a = map.addNode(map.tree.id, undefined, 'after', { text: 'Research' });
    const b = map.addNode(map.tree.id, undefined, 'after', { text: 'Design' });
    for (let i = 3; i < size; i++) map.addNode(i % 2 ? a : b, undefined, 'after', { text: `Topic ${i}` });
    map.layout();
    const other = gfx.surface!.addElement({ type: 'shape', xywh: '[1700,1500,100,80]' });
    gfx.selection.set({ elements: [a], editing: false });
    gfx.doc.captureSync();
    return { a, b, root: map.tree.id, map: map.id, other };
  }, size);
}

export async function geometry(page: Page) {
  return page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const map = gfx.surface!.elementModels.find(e => e.type === 'mindmap') as MindmapElementModel;
    return { layout: map.layoutType, selected: gfx.selection.selectedElements.map(e => e.id),
      nodes: [...map.children].map(([id, detail]) => {
        const s = map.getNode(id)!.element as ShapeElementModel;
        return { id, ...detail, hidden: s.hidden, bounds: [s.x, s.y, s.w, s.h] as [number, number, number, number], text: s.text?.toString() };
      }), other: gfx.surface!.elementModels.filter(e => e.type === 'shape' && !map.children.has(e.id)).map(e => e.xywh),
      edges: [...map.connectors.values()].map(c => ({ source: c.source.id, target: c.target.id })) };
  });
}

function assertGeometry(state: Awaited<ReturnType<typeof geometry>>, before: Awaited<ReturnType<typeof geometry>>) {
  const root = state.nodes.find(n => !n.parent)!;
  const oldRoot = before.nodes.find(n => !n.parent)!;
  expect(Math.abs(root.bounds[0] - oldRoot.bounds[0])).toBeLessThanOrEqual(0.5);
  expect(Math.abs(root.bounds[1] - oldRoot.bounds[1])).toBeLessThanOrEqual(0.5);
  expect(state.other).toEqual(before.other);
  const visible = state.nodes.filter(n => !n.hidden);
  for (const n of visible) {
    expect(n.bounds.every(Number.isFinite)).toBe(true);
    expect(n.bounds[2]).toBeGreaterThan(0); expect(n.bounds[3]).toBeGreaterThan(0);
    for (const sibling of visible.filter(s => s.id !== n.id && s.parent === n.parent)) {
      const dx = Math.min(n.bounds[0] + n.bounds[2], sibling.bounds[0] + sibling.bounds[2]) - Math.max(n.bounds[0], sibling.bounds[0]);
      const dy = Math.min(n.bounds[1] + n.bounds[3], sibling.bounds[1] + sibling.bounds[3]) - Math.max(n.bounds[1], sibling.bounds[1]);
      expect(dx > 0 && dy > 0, 'visible sibling bounds must not overlap').toBe(false);
    }
  }
  for (const edge of state.edges) {
    if (edge.target) expect(state.nodes.find(n => n.id === edge.target)?.parent).toBe(edge.source);
    // Native collapsed badges have a short line from the collapsed topic to a
    // free coordinate, not a topic endpoint.
    else expect(state.nodes.find(n => n.id === edge.source)?.collapsed).toBe(true);
  }
}

for (const size of [7, 50]) test(`@02-05-01 ${size} topics retain anchor collapse and selection in all directions`, async ({ page }) => {
  const ids = await seedLayout(page, size);
  const initial = await geometry(page);
  await expect(page.getByRole('group', { name: 'Mind-map layout', exact: true }).getByRole('button', { name: 'Left', exact: true })).toBeVisible({ timeout: 2000 });
  await page.getByRole('button', { name: 'Collapse branch', exact: true }).click();
  for (const direction of ['Left', 'Balanced', 'Right']) {
    await page.getByRole('group', { name: 'Mind-map layout', exact: true }).getByRole('button', { name: direction, exact: true }).click();
    await expect(page.getByRole('group', { name: 'Mind-map layout', exact: true }).getByRole('button', { name: direction, exact: true })).toHaveAttribute('aria-pressed', 'true');
    const next = await geometry(page);
    assertGeometry(next, initial);
    expect(next.nodes.find(n => n.id === ids.a)?.collapsed).toBe(true);
    expect(next.nodes.filter(n => n.parent === ids.a).every(n => n.hidden)).toBe(true);
    expect(next.selected).toEqual([ids.a]);
  }
  await page.getByRole('button', { name: /Expand branch:/ }).click();
  assertGeometry(await geometry(page), initial);
  await page.getByRole('button', { name: 'Saved locally', exact: true }).waitFor();
  const saved = await geometry(page);
  await page.reload();
  await expect.poll(async () => (await geometry(page)).nodes).toEqual(saved.nodes);
  await page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const map = gfx.surface!.elementModels.find(e => e.type === 'mindmap') as MindmapElementModel;
    map.addNode(map.tree.id, undefined, 'after', { text: 'After hydration' });
  });
  await expect.poll(async () => (await geometry(page)).nodes.length).toBe(size + 1);
  assertGeometry(await geometry(page), initial);
});

test('@02-05-01 multiline edit add delete and history use measured native geometry', async ({ page }) => {
  const ids = await seedLayout(page);
  const initial = await geometry(page);
  await page.getByRole('button', { name: 'Add child', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('New topic');
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('Measured long topic '.repeat(10));
  await page.keyboard.press('Shift+Enter');
  await page.keyboard.type('X'.repeat(120));
  await page.keyboard.press('Shift+Enter');
  await page.keyboard.type('Third measured line');
  await page.keyboard.press('Enter');
  await expect(page.locator('edgeless-shape-text-editor')).toHaveCount(0);
  const grown = await geometry(page);
  assertGeometry(grown, initial);
  expect(grown.nodes).toHaveLength(8);
  expect(grown.nodes.find(n => n.text?.startsWith('Measured'))?.bounds[3]).toBeGreaterThan(50);
  await page.keyboard.press('Backspace');
  await expect.poll(async () => (await geometry(page)).nodes.length).toBe(7);
  assertGeometry(await geometry(page), initial);
  await page.locator('affine-edgeless-root').evaluate((el, id) => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    // Synthetic selection can target a topic outside the viewport after the
    // long editor pans it. Bring that topic into view before using its toolbar.
    const topic = gfx.surface!.getElementById(id) as ShapeElementModel;
    gfx.viewport.setCenter(topic.x + topic.w / 2, topic.y + topic.h / 2);
    gfx.selection.set({ elements: [id], editing: false });
  }, ids.a);
  const before = await geometry(page);
  await openMindmapProperties(page);
  await page.getByRole('group', { name: 'Mind-map layout', exact: true }).getByRole('button', { name: 'Left', exact: true }).click();
  const left = await geometry(page);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(async () => (await geometry(page)).nodes).toEqual(before.nodes);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect.poll(async () => (await geometry(page)).nodes).toEqual(left.nodes);
});

test('@02-05-01 partial native failure restores geometry and retry retains identities', async ({ page }) => {
  await seedLayout(page);
  const before = await geometry(page);
  await page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const map = gfx.surface!.elementModels.find(e => e.type === 'mindmap') as MindmapElementModel;
    const delegate = (map as unknown as { _layout: unknown })._layout;
    // Restore the actual delegate after one deliberately partial failure.
    map.setLayoutMethod(() => {
      map.setLayoutMethod(delegate as Parameters<typeof map.setLayoutMethod>[0]);
      map.tree.element.xywh = '[999,999,160,50]';
      throw new Error('Synthetic partial geometry fault');
    });
  });
  await page.getByRole('button', { name: 'Arrange mind map', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('The mind map could not be arranged. Try Arrange mind map again.');
  expect((await geometry(page)).nodes).toEqual(before.nodes);
  await page.getByRole('button', { name: 'Arrange mind map', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect((await geometry(page)).nodes).toEqual(before.nodes);
});

test('@02-05-01 upstream Layout toolbar preserves collapsed records and one-action history', async ({ page }) => {
  const ids = await seedLayout(page);
  await page.getByRole('button', { name: 'Collapse branch', exact: true }).click();
  await page.locator('affine-edgeless-root').evaluate((el, id) => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    gfx.selection.set({ elements: [id], editing: false }); gfx.doc.captureSync();
  }, ids.map);
  const before = await geometry(page);
  await page.getByRole('button', { name: 'Layout', exact: true }).click();
  await page.locator('editor-icon-button[aria-label="Left"]').click();
  const left = await geometry(page);
  expect(left.layout).toBe(1);
  expect(left.nodes.find(n => n.id === ids.a)?.collapsed).toBe(true);
  expect(left.nodes.filter(n => n.parent === ids.a).every(n => n.hidden)).toBe(true);
  assertGeometry(left, before);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(async () => (await geometry(page)).nodes).toEqual(before.nodes);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect.poll(async () => (await geometry(page)).nodes).toEqual(left.nodes);
});
