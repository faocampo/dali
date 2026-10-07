import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import type { GfxController } from '@blocksuite/affine/std/gfx';
import type { ShapeElementModel } from '@blocksuite/affine/model';
import { classicalShapes } from '../src/canvas/classical-shape-geometry';
import { fileAction } from './app-menu';

test.use({ actionTimeout: 15_000 });

async function shapes(page: Page) {
  return page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    return gfx.gfxElements.filter(m => 'type' in m && m.type === 'shape').map(m => {
      const model = m as ShapeElementModel;
      return { id: model.id, type: model.type, shape: String(model.shapeType), xywh: model.xywh, text: model.text?.toString() ?? '' };
    });
  });
}
async function draw(page: Page, name: string, x = 400, y = 250, drag = true) {
  await page.getByRole('button', { name: 'Shapes', exact: true }).click();
  await page.getByRole('dialog', { name: 'Shapes palette' }).getByRole('button', { name, exact: true }).click();
  if (!drag) { await page.mouse.click(x, y); return; }
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + 140, y + 110, { steps: 6 }); await page.mouse.up();
}

test('classical palette creates editable native shapes and restores all geometries', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.goto('/');
  for (const [i, shape] of classicalShapes.entries()) {
    await draw(page, shape.name, 260 + i % 4 * 240, 180 + Math.floor(i / 4) * 220, i !== 0);
    await expect.poll(async () => (await shapes(page))[i]?.shape).toBe(shape.id);
    await expect(page.getByTestId('selection-inspector')).toHaveCount(0);
  }
  const before = await shapes(page);
  expect(before.every(s => s.type === 'shape')).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('classical-shapes.png') });
  await page.reload();
  await expect.poll(() => shapes(page)).toEqual(before);
});

test('polygon selection, resize, history, text and duplicate retain geometry', async ({ page }) => {
  await page.goto('/');
  await draw(page, 'Star');
  const initial = (await shapes(page))[0]!;
  await page.mouse.click(470, 310);
  const handle = page.locator('.handle[aria-label="bottom-right"] .resize');
  const bounds = (await handle.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2); await page.mouse.down();
  await page.mouse.move(bounds.x + 60, bounds.y + 50, { steps: 8 }); await page.mouse.up();
  const resized = (await shapes(page))[0]!;
  expect(JSON.parse(resized.xywh)[2]).toBeGreaterThan(JSON.parse(initial.xywh)[2]);
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(async () => (await shapes(page))[0]?.xywh).toBe(initial.xywh);
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect.poll(async () => (await shapes(page))[0]?.xywh).toBe(resized.xywh);
  await page.mouse.dblclick(470, 310);
  await page.keyboard.type('Milestone'); await page.keyboard.press('Escape');
  await expect.poll(async () => (await shapes(page))[0]?.text).toBe('Milestone');
  await page.mouse.click(470, 310);
  await page.keyboard.press('ControlOrMeta+d');
  await expect.poll(async () => (await shapes(page)).length).toBe(2);
  expect((await shapes(page)).every(s => s.shape === 'dali:star' && s.text === 'Milestone')).toBe(true);
});

test('header symbol, favicon assets and useful selection panels', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Dalí');
  const symbol = await page.locator('.djai-brand img').evaluate(async image => {
    const img = image as HTMLImageElement;
    await img.decode();
    return { width: img.naturalWidth, height: img.naturalHeight, source: await (await fetch(img.src)).text() };
  });
  expect(symbol.source).toContain('Dalí eye symbol');
  expect(symbol.width / symbol.height).toBeLessThan(1.5);
  for (const href of await page.locator('link[rel="icon"],link[rel="apple-touch-icon"]').evaluateAll(links => links.map(link => (link as HTMLLinkElement).href))) {
    expect(await page.evaluate(async href => (await fetch(href)).ok, href)).toBe(true);
  }
  await draw(page, 'Hexagon');
  await draw(page, 'Pentagon', 650, 450);
  await page.mouse.move(350, 220); await page.mouse.down(); await page.mouse.move(840, 610, { steps: 8 }); await page.mouse.up();
  await expect.poll(() => page.locator('affine-edgeless-root').evaluate(el => (el as HTMLElement & { gfx: GfxController }).gfx.selection.selectedElements.length)).toBe(2);
  await expect(page.getByTestId('selection-inspector')).toHaveCount(0);
});

test('connectors attach to polygons and track moved, rotated endpoints', async ({ page }) => {
  await page.goto('/');
  await draw(page, 'Star', 300, 300);
  await draw(page, 'Hexagon', 800, 300);
  const ids = (await shapes(page)).map(s => s.id);
  await page.getByRole('button', { name: 'Lines', exact: true }).click();
  await page.getByRole('button', { name: 'Straight arrow', exact: true }).click();
  await page.mouse.move(370, 350); await page.mouse.down(); await page.mouse.move(870, 350, { steps: 8 }); await page.mouse.up();
  const connected = () => page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const line = gfx.gfxElements.find(m => 'type' in m && m.type === 'connector') as import('@blocksuite/affine/model').ConnectorElementModel;
    return { source: line?.source.id, target: line?.target.id, end: line?.absolutePath.at(-1)?.toVec() };
  });
  await expect.poll(async () => { const line = await connected(); return [line.source, line.target]; }).toEqual(ids);
  const before = await connected();
  await page.locator('affine-edgeless-root').evaluate((el, id) => {
    (el as HTMLElement & { gfx: GfxController }).gfx.surface!.updateElement(id, { xywh: '[850,450,160,120]', rotate: 45 });
  }, ids[1]!);
  await expect.poll(async () => (await connected()).end).not.toEqual(before.end);
  expect((await connected()).end?.every(Number.isFinite)).toBe(true);
});

test('PNG export preserves a star silhouette and transparent corners', async ({ page }, testInfo) => {
  await page.goto('/');
  await draw(page, 'Star');
  await page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const star = gfx.gfxElements.find(m => 'type' in m && m.type === 'shape')!;
    gfx.surface!.updateElement(star.id, { xywh: '[0,0,200,200]', filled: true, fillColor: '#ff0000', strokeWidth: 0 });
  });
  await fileAction(page, 'Export board');
  await page.getByRole('radio', { name: 'PNG image' }).check();
  await page.locator('input[name="export-scope"][value="selection"]').check();
  await page.getByLabel('Selection padding').fill('0');
  await page.getByRole('radio', { name: '1×', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Transparent background' }).check();
  const pending = page.waitForEvent('download');
  await page.getByRole('dialog').getByRole('button', { name: 'Download', exact: true }).click();
  const file = await pending;
  await file.saveAs(testInfo.outputPath('star-export.png'));
  const chunks: Buffer[] = [];
  for await (const chunk of (await file.createReadStream())!) chunks.push(Buffer.from(chunk));
  const pixels = await page.evaluate(async base64 => {
    const image = new Image(); image.src = `data:image/png;base64,${base64}`; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext('2d')!; ctx.drawImage(image, 0, 0);
    const pixel = (x: number, y: number) => [...ctx.getImageData(x, y, 1, 1).data];
    return { width: image.width, height: image.height, center: pixel(100, 100), corner: pixel(10, 10), notch: pixel(100, 190), tip: pixel(100, 10) };
  }, Buffer.concat(chunks).toString('base64'));
  expect(pixels).toEqual({ width: 200, height: 200, center: [255, 0, 0, 255], corner: [0, 0, 0, 0], notch: [0, 0, 0, 0], tip: [255, 0, 0, 255] });
});

test('polygon native fill controls and connected quick-add retain its type', async ({ page }) => {
  await page.goto('/');
  await draw(page, 'Hexagon');
  const color = () => page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    return String((gfx.gfxElements.find(m => 'type' in m && m.type === 'shape') as ShapeElementModel).fillColor);
  });
  const originalColor = await color();
  await page.getByRole('button', { name: 'Color', exact: true }).click();
  await page.getByRole('listbox', { name: 'Fill color', exact: true }).locator('edgeless-color-button').nth(3).click();
  await expect.poll(color).not.toBe(originalColor);
  // Dismiss the native color popover through its supported outside-click path.
  await page.mouse.click(1000, 650);
  await page.mouse.click(470, 305);
  await expect.poll(() => page.locator('affine-edgeless-root').evaluate(el => (el as HTMLElement & { gfx: GfxController }).gfx.selection.selectedElements.length)).toBe(1);
  const add = page.locator('edgeless-auto-complete .edgeless-auto-complete-arrow').first();
  await add.hover();
  // Hover renders the connected-shape preview before clicking it.
  await expect(add).toBeVisible();
  await add.click();
  await expect.poll(async () => (await shapes(page)).length).toBe(2);
  expect((await shapes(page)).every(shape => shape.shape === 'dali:hexagon')).toBe(true);
});
