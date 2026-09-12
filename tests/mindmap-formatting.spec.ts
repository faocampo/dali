import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import type { GfxController } from '@blocksuite/affine/std/gfx';
import type { MindmapElementModel, ShapeElementModel } from '@blocksuite/affine/model';

async function seed(page: Page, text = 'Research') {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add mind map', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('Central topic');
  await page.keyboard.press('Enter');
  return page.locator('affine-edgeless-root').evaluate((el, text) => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const map = gfx.surface!.elementModels.find(e => e.type === 'mindmap') as MindmapElementModel;
    const a = map.addNode(map.tree.id, undefined, 'after', { text });
    map.addNode(a, undefined, 'after', { text: 'Nested detail' });
    map.addNode(map.tree.id, undefined, 'after', { text: 'Design' });
    map.layout(); gfx.selection.set({ elements: [a], editing: false }); gfx.doc.captureSync();
    return { a, root: map.tree.id, map: map.id };
  }, text);
}
async function state(page: Page) {
  return page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    return gfx.surface!.elementModels.filter(e => e.type === 'mindmap').map(e => {
      const map = e as MindmapElementModel;
      return { id: map.id, style: map.style, nodes: [...map.children].map(([id, detail]) => {
        const s = map.getNode(id)!.element as ShapeElementModel;
        return { id, ...detail, hidden: s.hidden, text: s.text?.toString(), delta: s.text?.toDelta(),
          fontSize: s.fontSize, fontWeight: s.fontWeight, color: s.color, width: s.w, height: s.h };
      }), presentation: [...map.children.keys()].map(id => {
        const s = map.getNode(id)!.element as ShapeElementModel;
        return [s.fillColor, s.strokeColor, s.fontFamily, s.padding];
      }), branches: [...map.connectors.values()].filter(c => c.target.id).map(c => {
        const node = map.getNode(c.target.id!)!;
        const expected = map.styleGetter.getNodeStyle(node, map.getPath(node)).connector;
        return { actual: [c.stroke, c.strokeWidth, c.mode], expected: [expected.stroke, expected.strokeWidth, expected.mode] };
      }) };
    });
  });
}
async function format(page: Page) {
  await expect(page.getByRole('spinbutton', { name: 'Font size', exact: true })).toBeVisible({ timeout: 2000 });
  await page.getByRole('spinbutton', { name: 'Font size', exact: true }).fill('31');
  await page.getByRole('spinbutton', { name: 'Font size', exact: true }).press('Tab');
  await page.getByRole('combobox', { name: 'Font weight', exact: true }).selectOption('700');
  await page.getByLabel('Text color', { exact: true }).fill('#234567');
}

test('@02-05-02 selected typography survives four branch presets collapse direction history copy reload', async ({ page }) => {
  const ids = await seed(page);
  const before = (await state(page))[0]!;
  await format(page);
  const palettes = new Set<string>();
  for (const preset of [1, 2, 3, 4]) {
    await page.getByRole('button', { name: `Style ${preset}`, exact: true }).click();
    await expect(page.getByRole('button', { name: `Style ${preset}`, exact: true })).toHaveAttribute('aria-pressed', 'true');
    const map = (await state(page))[0]!;
    expect(map.style).toBe(preset);
    const target = map.nodes.find(n => n.id === ids.a)!;
    expect([target.fontSize, target.fontWeight, target.color]).toEqual([31, '700', '#234567']);
    for (const other of map.nodes.filter(n => n.id !== ids.a)) {
      const old = before.nodes.find(n => n.id === other.id)!;
      expect([other.fontSize, other.fontWeight, other.color]).toEqual([old.fontSize, old.fontWeight, old.color]);
    }
    expect(map.branches.length).toBeGreaterThan(0);
    for (const branch of map.branches) expect(branch.actual).toEqual(branch.expected);
    // Native ONE and FOUR share their first branch colors/widths; their shapes,
    // padding and families distinguish the full native presets.
    palettes.add(JSON.stringify([map.branches, map.presentation]));
  }
  expect(palettes.size).toBe(4);
  await page.getByRole('button', { name: 'Collapse branch', exact: true }).click();
  await page.getByRole('group', { name: 'Mind-map layout', exact: true }).getByRole('button', { name: 'Left', exact: true }).click();
  await page.getByRole('button', { name: 'Style 2', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  expect((await state(page))[0]!.nodes.find(n => n.id === ids.a)).toMatchObject({ collapsed: true, fontSize: 31, fontWeight: '700', color: '#234567' });
  await page.getByRole('button', { name: 'Add child', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('New topic');
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('A later edit'); await page.keyboard.press('Enter');
  await expect(page.locator('edgeless-shape-text-editor')).toHaveCount(0);
  await page.locator('affine-edgeless-root').evaluate((el, id) => {
    (el as HTMLElement & { gfx: GfxController }).gfx.selection.set({ elements: [id], editing: false });
  }, ids.map);
  await page.keyboard.press('ControlOrMeta+d');
  await expect.poll(async () => (await state(page)).length).toBe(2);
  for (const map of await state(page)) expect(map.nodes.find(n => n.text === 'Research')).toMatchObject({ fontSize: 31, fontWeight: '700', color: '#234567' });
  await page.getByRole('button', { name: 'Saved locally', exact: true }).waitFor();
  const saved = (await state(page)).map(m => m.nodes);
  await page.reload();
  await expect.poll(async () => (await state(page)).map(m => m.nodes)).toEqual(saved);
});

for (const text of ['', 'Cafe\u0301 👩🏽‍💻 家族 日本語 العربية עברית', '<img src=x onerror=alert(1)>', '界'.repeat(120)]) {
  test(`@02-05-02 exact native international and empty label ${text.slice(0, 12) || 'empty'}`, async ({ page }) => {
    const ids = await seed(page, text);
    await page.locator('affine-edgeless-root').evaluate((el, id) => {
      const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
      const s = gfx.surface!.getElementById(id) as ShapeElementModel;
      if (s.text!.length > 3) s.text!.format(0, 3, { bold: true });
    }, ids.a);
    const original = (await state(page))[0]!.nodes.find(n => n.id === ids.a)!;
    await format(page);
    await page.getByRole('button', { name: 'Style 4', exact: true }).click();
    await page.getByRole('group', { name: 'Mind-map layout', exact: true }).getByRole('button', { name: 'Balanced', exact: true }).click();
    const actual = (await state(page))[0]!.nodes.find(n => n.id === ids.a)!;
    expect(actual.text).toBe(text); expect(actual.delta).toEqual(original.delta);
    expect(actual.width).toBeGreaterThan(0); expect(actual.height).toBeGreaterThan(0);
    expect(actual.height).toBeGreaterThanOrEqual(original.height);
    await expect(page.locator('img[src="x"]')).toHaveCount(0);
    await page.getByRole('button', { name: 'Saved locally', exact: true }).waitFor(); await page.reload();
    await expect.poll(async () => (await state(page))[0]!.nodes.find(n => n.id === ids.a)?.text).toBe(text);
  });
}

test('@02-05-02 absent multi unrelated readonly and locked selections cannot format', async ({ page }) => {
  const ids = await seed(page);
  for (const selection of [[], [ids.a, ids.root], [ids.map]]) {
    await page.locator('affine-edgeless-root').evaluate((el, elements) => {
      (el as HTMLElement & { gfx: GfxController }).gfx.selection.set({ elements, editing: false });
    }, selection);
    await expect(page.getByRole('spinbutton', { name: 'Font size' })).toHaveCount(0);
  }
  await page.locator('affine-edgeless-root').evaluate((el, id) => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    gfx.surface!.getElementById(id)!.lock(); gfx.selection.set({ elements: [id], editing: false });
  }, ids.a);
  await expect(page.getByRole('spinbutton', { name: 'Font size' })).toBeDisabled();
  await page.locator('affine-edgeless-root').evaluate((el, id) => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    gfx.doc.readonly = true; gfx.selection.set({ elements: [id], editing: false });
  }, ids.root);
  await expect(page.getByRole('spinbutton', { name: 'Font size' })).toBeDisabled();
});

test('@02-05-02 external color-field composition cannot consume a topic Enter', async ({ page }) => {
  await seed(page);
  const color = page.getByLabel('Text color', { exact: true });
  await color.dispatchEvent('compositionstart'); await color.dispatchEvent('compositionend');
  await page.getByRole('button', { name: 'Add child', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('New topic');
  await page.keyboard.press('Enter');
  await expect(page.locator('edgeless-shape-text-editor')).toHaveCount(0, { timeout: 2000 });
  expect((await state(page))[0]!.nodes).toHaveLength(5);
});
