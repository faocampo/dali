import { addStickyNote } from './sticky-tool';
import { test, expect } from './fixtures';
import type { GfxController } from '@blocksuite/affine/std/gfx';
import type { ShapeElementModel } from '@blocksuite/affine/model';

test.use({ actionTimeout: 15000 });
const root = (page: import('@playwright/test').Page) => page.locator('affine-edgeless-root');
for (const width of [390, 707, 1456]) test(`live thickness, enabled icons and clear frame action at ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 998 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Shapes', exact: true }).click();
  await page.getByRole('button', { name: 'Square / rectangle', exact: true }).click();
  const left = width < 500 ? 150 : 300, right = width < 500 ? 290 : 450;
  await page.mouse.move(left, 320); await page.mouse.down(); await page.mouse.move(right, 440, { steps: 5 }); await page.mouse.up();
  const state = () => root(page).evaluate(el => {
    const shape = (el as HTMLElement & { gfx: GfxController }).gfx.gfxElements.find(m => 'type' in m && m.type === 'shape') as ShapeElementModel;
    return { stroke: shape.strokeWidth, xywh: shape.xywh };
  });
  const initial = await state();
  const colorButton = page.locator('edgeless-shape-color-picker editor-menu-button > editor-icon-button');
  await colorButton.click();
  const input = page.getByRole('spinbutton', { name: 'Thickness', exact: true });
  await input.fill('8');
  await expect.poll(async () => (await state()).stroke).toBe(8); // before Enter/blur
  expect((await state()).xywh).toBe(initial.xywh);
  await page.getByRole('button', { name: 'Increase thickness', exact: true }).click();
  await expect(input).toHaveValue('9');
  await expect.poll(async () => (await state()).stroke).toBe(9);
  await page.getByRole('button', { name: 'Decrease thickness', exact: true }).click();
  await expect.poll(async () => (await state()).stroke).toBe(8);
  await input.fill(''); await input.press('Tab'); await expect(input).toHaveValue('8');
  const palette = page.locator('edgeless-shape-color-picker editor-menu-content');
  const paletteBounds = (await palette.boundingBox())!;
  expect(paletteBounds.x).toBeGreaterThanOrEqual(0);
  expect(paletteBounds.x + paletteBounds.width).toBeLessThanOrEqual(width);
  await expect(page.locator('.canvas-measurements')).toHaveCount(0);
  // Test the real stacking context even if a stale/transient guide were present.
  const layers = await page.locator('affine-toolbar-widget').evaluate(widget => {
    const guide = document.createElement('div');
    guide.className = 'canvas-measurements'; guide.style.cssText = 'position:absolute;inset:0;z-index:6;pointer-events:auto';
    const viewport = document.querySelector('.affine-edgeless-viewport')!;
    viewport.parentElement!.append(guide);
    const popup = widget.shadowRoot!.querySelector('edgeless-shape-color-picker')!.shadowRoot!.querySelector('editor-menu-button')!.shadowRoot!.querySelector('editor-menu-content')!;
    const r = popup.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + 12, r.top + 12);
    guide.remove();
    return hit === widget || (hit !== null && widget.contains(hit));
  });
  expect(layers).toBe(true);
  await page.screenshot({ animations: 'disabled', path: info.outputPath(`formatting-${width}.png`) });
  await page.mouse.click(Math.min(width - 20, 580), 750);
  await page.mouse.click((left + right) / 2, 380);
  await page.locator('editor-host').focus(); await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(async () => (await state()).stroke).toBe(9);
  await page.locator('editor-icon-button[aria-label="More"]').click();
  await expect(page.getByRole('menuitem', { name: 'Object actions', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Frame section', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Frame selection', exact: true }).click();
  await expect(page.locator('affine-frame')).toHaveCount(1);
  await addStickyNote(page);
  await page.locator('affine-edgeless-note').click();
  await expect(page.getByRole('combobox', { name: 'Note size', exact: true })).toBeVisible();
  const icons = page.locator('affine-toolbar-widget editor-icon-button .icon-container');
  for (const icon of await icons.all()) {
    if (await icon.isVisible() && await icon.getAttribute('disabled') === null) await expect(icon).toHaveCSS('color', 'rgb(23, 17, 38)');
  }
  await page.screenshot({ animations: 'disabled', path: info.outputPath(`note-controls-${width}.png`) });
});

test('automatic insertion avoids occupied viewport space and stays on top when full', async ({ page }) => {
  await page.goto('/');
  await addStickyNote(page);
  await addStickyNote(page);
  await addStickyNote(page);
  const bounds = await root(page).evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    return gfx.gfxElements.filter(m => ('flavour' in m && m.flavour === 'affine:note') || ('type' in m && m.type === 'text')).map(m => {
      const { x, y, w, h } = gfx.viewport.toViewBound(m.elementBound); return { x, y, w, h };
    });
  });
  expect(bounds).toHaveLength(3);
  for (let i = 0; i < bounds.length; i++) for (let j = i + 1; j < bounds.length; j++) {
    const a = bounds[i]!, b = bounds[j]!;
    expect(a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y).toBe(false);
  }
  const front = await root(page).evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const id = gfx.surface!.addElement({ type: 'shape', xywh: '[-5000,-5000,10000,10000]', index: gfx.layer.generateIndex() });
    return gfx.surface!.getElementById(id)!.index;
  });
  await addStickyNote(page);
  const placed = await root(page).evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const m = gfx.gfxElements.filter(model => 'flavour' in model && model.flavour === 'affine:note').sort((a, b) => b.index.localeCompare(a.index))[0]!; const b = gfx.viewport.toViewBound(m.elementBound);
    return { index: m.index, x: b.x, y: b.y, w: b.w, h: b.h, viewport: { w: gfx.viewport.width, h: gfx.viewport.height } };
  });
  expect(placed.index > front).toBe(true);
  expect(placed.x).toBeGreaterThanOrEqual(88); expect(placed.y).toBeGreaterThanOrEqual(60);
  expect(placed.x + placed.w).toBeLessThanOrEqual(placed.viewport.w - 24);
  expect(placed.y + placed.h).toBeLessThanOrEqual(placed.viewport.h - 80);
  await page.keyboard.press('ControlOrMeta+z');
  await expect(page.locator('affine-edgeless-note')).toHaveCount(3);
});

test('resize shows dimensions only for the active gesture', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('dali:view-preferences:v1', JSON.stringify({ version: 1, grid: 'dots', spacing: 20, dimensions: true, distances: true })));
  await page.goto('/');
  await page.getByRole('button', { name: 'Shapes', exact: true }).click();
  await page.getByRole('button', { name: 'Square / rectangle', exact: true }).click();
  await page.mouse.move(300, 300); await page.mouse.down(); await page.mouse.move(450, 430, { steps: 5 }); await page.mouse.up();
  await expect(page.locator('.canvas-measurements')).toHaveCount(0);
  const handle = page.locator('edgeless-selected-rect .handle[aria-label="bottom-right"]');
  const b = (await handle.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 40, b.y + b.height / 2 + 30, { steps: 5 });
  await expect(page.locator('.canvas-dimensions')).toBeVisible();
  await page.mouse.up(); await expect(page.locator('.canvas-measurements')).toHaveCount(0);
});
