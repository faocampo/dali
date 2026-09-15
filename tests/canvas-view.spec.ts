import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import type { GfxController } from '@blocksuite/affine/std/gfx';
import type { MindmapElementModel } from '@blocksuite/affine/model';
import { fileAction } from './app-menu';

test.use({ actionTimeout: 15_000 });
const root = (page: Page) => page.locator('affine-edgeless-root');
async function openView(page: Page) {
  await page.getByRole('button', { name: 'Dalí', exact: true }).click();
  await page.getByRole('menuitem', { name: 'View', exact: true }).click();
}
async function enableMeasurements(page: Page) {
  await openView(page);
  await page.getByRole('menuitemcheckbox', { name: 'Object dimensions' }).click();
  await page.getByRole('menuitemcheckbox', { name: 'Distances', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menuitem', { name: 'View', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Dalí', exact: true })).toHaveAttribute('aria-expanded', 'false');
}
async function seedShapes(page: Page) {
  await page.goto('/');
  for (const x of [350, 600]) {
    await page.getByRole('button', { name: 'Shapes', exact: true }).click();
    await page.getByRole('button', { name: 'Square / rectangle' }).click();
    await page.mouse.click(x, 320);
  }
  return root(page).evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const shapes = gfx.gfxElements.filter(m => 'type' in m && m.type === 'shape');
    gfx.surface!.updateElement(shapes[0]!.id, { xywh: '[300,240,120,80]' });
    gfx.surface!.updateElement(shapes[1]!.id, { xywh: '[500,250,100,60]' });
    gfx.viewport.setZoom(1);
    gfx.viewport.setCenter(640, gfx.viewport.height / 2);
    gfx.selection.set({ elements: [shapes[0]!.id], editing: false });
    return shapes.map(m => m.id);
  });
}

test('View grid submenu and toggles support keyboard navigation and persist after reload', async ({ page }) => {
  await page.goto('/');
  await expect(root(page)).toHaveAttribute('data-grid-style', 'dots');
  await openView(page);
  await expect(page.getByRole('menuitem', { name: 'Grid', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('menuitemradio', { name: 'Dots', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitemradio', { name: 'Lines', exact: true })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('menuitemradio', { name: '40 px', exact: true }).click();
  // Engines serialize repeated background layers differently.
  await expect(root(page).locator('.edgeless-background')).toHaveCSS('background-size', /^40px 40px(?:, 40px 40px)?$/);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menuitem', { name: 'Grid', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitemcheckbox', { name: 'Object dimensions' })).toBeFocused();
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Space');
  await expect(page.getByRole('menuitemcheckbox', { name: 'Distances', exact: true })).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Dalí', exact: true })).toBeFocused();
  await page.reload();
  await expect(root(page)).toHaveAttribute('data-grid-style', 'lines');
  await openView(page);
  await expect(page.getByRole('menuitemcheckbox', { name: 'Object dimensions' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('menuitemcheckbox', { name: 'Distances', exact: true })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('menuitem', { name: 'Grid', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'Off', exact: true }).click();
  await expect(root(page).locator('.edgeless-background')).toHaveCSS('background-image', 'none');
});

test('dimensions and gaps update with drag, resize, multi-selection, zoom and pan without document writes', async ({ page }) => {
  const ids = await seedShapes(page);
  const doc = () => page.locator('editor-host').evaluate((host: any) => JSON.stringify(host.store.spaceDoc.toJSON()));
  const before = await doc();
  await enableMeasurements(page);
  await expect(page.locator('.canvas-dimensions')).toHaveAttribute('data-width', '120');
  await expect(page.locator('.canvas-dimensions')).toHaveAttribute('data-height', '80');
  await expect(page.locator('.canvas-distance[data-direction="right"]')).toHaveAttribute('data-distance', '80');
  expect(await doc()).toBe(before);
  await root(page).evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    gfx.viewport.setZoom(1.5); gfx.viewport.setCenter(450, 300);
  });
  await expect(page.locator('.canvas-distance[data-direction="right"]')).toHaveAttribute('data-distance', '80');
  await expect(page.locator('.canvas-dimensions')).toHaveAttribute('data-width', '120');
  await expect(root(page).locator('.edgeless-background')).toHaveCSS('background-size', '30px 30px');
  const gridPosition = await root(page).evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    return gfx.viewport.toViewCoord(0, 0).map(value => `${Math.round((((value % 30) + 30) % 30) * 1000) / 1000}px`).join(' ');
  });
  await expect(root(page).locator('.edgeless-background')).toHaveCSS('background-position', gridPosition);
  const position = await root(page).evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const [x, y] = gfx.viewport.toViewCoord(360, 280); const r = el.getBoundingClientRect(); return { x: x + r.x, y: y + r.y };
  });
  await page.mouse.move(position.x, position.y); await page.mouse.down();
  await page.mouse.move(position.x - 30, position.y, { steps: 6 });
  await expect(page.locator('.canvas-distance[data-direction="right"]')).toHaveAttribute('data-distance', '100');
  await page.mouse.up();
  await expect(page.locator('.canvas-distance[data-direction="right"]')).toHaveAttribute('data-distance', '100');
  if (test.info().project.name === 'prod') await page.screenshot({ path: test.info().outputPath('measurements.png') });
  await root(page).evaluate((el, ids) => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    gfx.surface!.updateElement(ids[0]!, { xywh: '[300,240,140,90]' });
  }, ids);
  await expect(page.locator('.canvas-dimensions')).toHaveAttribute('data-width', '140');
  await expect(page.locator('.canvas-distance[data-direction="right"]')).toHaveAttribute('data-distance', '60');
  await root(page).evaluate((el, ids) => (el as HTMLElement & { gfx: GfxController }).gfx.selection.set({ elements: ids, editing: false }), ids);
  await expect(page.locator('.canvas-dimensions')).toHaveAttribute('data-width', '300');
  await expect(page.locator('.canvas-distance')).toHaveCount(0);
  await root(page).evaluate(el => (el as HTMLElement & { gfx: GfxController }).gfx.selection.set({ elements: [], editing: false }));
  await expect(page.locator('.canvas-measurements')).toHaveCount(0);
});

test('hidden collapsed topics and offscreen neighbors never become distance targets', async ({ page }) => {
  const ids = await seedShapes(page);
  await page.getByRole('button', { name: 'Add mind map', exact: true }).click();
  await page.keyboard.press('Escape');
  const hidden = await root(page).evaluate((el, ids) => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const map = gfx.gfxElements.find(m => 'type' in m && m.type === 'mindmap') as MindmapElementModel;
    const child = map.addNode(map.tree.id, undefined, 'after', { text: 'Hidden topic' });
    map.children.set(map.tree.id, { ...map.children.get(map.tree.id)!, collapsed: true });
    map.buildTree(); map.layout();
    gfx.surface!.updateElement(map.tree.id, { xywh: '[2000,2000,100,40]' });
    gfx.surface!.updateElement(child, { xywh: '[430,250,20,30]' });
    gfx.viewport.setZoom(1); gfx.viewport.setCenter(640, gfx.viewport.height / 2);
    gfx.selection.set({ elements: [ids[0]!], editing: false });
    return child;
  }, ids);
  await enableMeasurements(page);
  await expect(page.locator('.canvas-distance[data-direction="right"]')).toHaveAttribute('data-neighbor', ids[1]!);
  await expect(page.locator(`.canvas-distance[data-neighbor="${hidden}"]`)).toHaveCount(0);
  await root(page).evaluate((el, ids) => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    gfx.surface!.updateElement(ids[1]!, { xywh: '[2000,250,100,60]' });
  }, ids);
  await expect(page.locator('.canvas-distance')).toHaveCount(0);
  await root(page).evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const map = gfx.gfxElements.find(m => 'type' in m && m.type === 'mindmap') as MindmapElementModel;
    gfx.surface!.updateElement(map.tree.id, { xywh: '[700,500,100,40]' });
    gfx.selection.set({ elements: [map.id], editing: false });
  });
  await expect(page.locator('.canvas-dimensions')).toHaveAttribute('data-width', '100');
  await expect(page.locator('.canvas-dimensions')).toHaveAttribute('data-height', '40');
});

for (const width of [390, 1280]) test(`View menu and Grid submenu fit a ${width}px viewport`, async ({ page }) => {
  await page.setViewportSize({ width, height: 700 });
  await page.goto('/');
  await openView(page);
  for (const grid of [false, true]) {
    if (grid) await page.getByRole('menuitem', { name: 'Grid', exact: true }).click();
    const bounds = (await page.locator('.dali-menu-popup').boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    await expect(page.getByRole(grid ? 'menuitemradio' : 'menuitemcheckbox', { name: grid ? '80 px' : 'Object dimensions', exact: true })).toBeInViewport();
    if (test.info().project.name === 'prod') await page.screenshot({ path: test.info().outputPath(`view-${width}-${grid ? 'grid' : 'menu'}.png`) });
  }
});

test('malformed or unavailable preference storage preserves working session controls', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('dali:view-preferences:v1', '{broken');
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { if (key === 'dali:view-preferences:v1') throw new Error('Unavailable'); original.call(this, key, value); };
  });
  await page.goto('/');
  await expect(root(page)).toHaveAttribute('data-grid-style', 'dots');
  await openView(page); await page.getByRole('menuitem', { name: 'Grid', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'Lines', exact: true }).click();
  await expect(root(page)).toHaveAttribute('data-grid-style', 'lines');
});

test('Escape returns through View menus while Properties and Layers stay open', async ({ page }) => {
  await seedShapes(page);
  await enableMeasurements(page);
  await expect(page.getByRole('button', { name: 'Close properties' })).toBeVisible();
  await page.getByRole('button', { name: 'Layers', exact: true }).click();
  await openView(page);
  await page.getByRole('menuitem', { name: 'Grid', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menuitem', { name: 'Grid', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menuitem', { name: 'View', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Dalí', exact: true })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Close layers' })).toBeVisible();
});

async function pngPixels(page: Page) {
  await fileAction(page, 'Export board');
  await page.getByRole('radio', { name: 'PNG image' }).check();
  await page.locator('input[name="export-scope"][value="board"]').check();
  const pending = page.waitForEvent('download');
  await page.getByRole('dialog').getByRole('button', { name: 'Download', exact: true }).click();
  const file = await pending;
  expect(await file.failure()).toBeNull();
  const chunks: Buffer[] = [];
  for await (const chunk of (await file.createReadStream())!) chunks.push(Buffer.from(chunk));
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  return page.evaluate(async base64 => {
    const image = new Image(); image.src = `data:image/png;base64,${base64}`; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext('2d')!; ctx.drawImage(image, 0, 0);
    const digest = await crypto.subtle.digest('SHA-256', ctx.getImageData(0, 0, image.width, image.height).data);
    return { w: image.width, h: image.height, pixels: Array.from(new Uint8Array(digest)) };
  }, Buffer.concat(chunks).toString('base64'));
}
test('grid and measurement chrome never appears in exported PNG pixels', async ({ page }) => {
  await seedShapes(page);
  const before = await pngPixels(page);
  await enableMeasurements(page);
  await expect(page.locator('.canvas-dimensions')).toBeVisible();
  await openView(page); await page.getByRole('menuitem', { name: 'Grid', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'Lines', exact: true }).click();
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  expect(await pngPixels(page)).toEqual(before);
});
