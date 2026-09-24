import { test, expect } from './fixtures';
import type { GfxController } from '@blocksuite/affine/std/gfx';
import type { ShapeElementModel } from '@blocksuite/affine/model';
import type { Page } from '@playwright/test';
test.use({ actionTimeout: 15000 });

const shapeState = (page: Page) => page.locator('affine-edgeless-root').evaluate(el => {
  const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
  const shape = gfx.gfxElements.find(m => 'type' in m && m.type === 'shape') as ShapeElementModel;
  return { xywh: shape.xywh, fontSize: shape.fontSize, family: shape.fontFamily, text: shape.text?.toString() };
});
test('shape typography preserves geometry, accepts small fonts and persists', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Shapes', exact: true }).click();
  await page.getByRole('button', { name: 'Circle / ellipse', exact: true }).click();
  await page.mouse.move(360, 300); await page.mouse.down(); await page.mouse.move(560, 420, { steps: 8 }); await page.mouse.up();
  const original = await shapeState(page);
  await page.mouse.dblclick(460, 360); await page.keyboard.insertText('Text that stays inside the original shape even when enlarged.'); await page.keyboard.press('Escape');
  await expect.poll(async () => (await shapeState(page)).xywh).toBe(original.xywh);
  await page.mouse.click(900, 600);
  await page.mouse.click(460, 360);
  const size = page.getByRole('spinbutton', { name: 'Font size', exact: true });
  await size.fill('64'); await size.press('Enter');
  await expect.poll(async () => (await shapeState(page)).fontSize).toBe(64);
  expect((await shapeState(page)).xywh).toBe(original.xywh);
  await size.fill('10'); await size.press('Enter');
  await expect.poll(async () => (await shapeState(page)).fontSize).toBe(10);
  expect((await shapeState(page)).xywh).toBe(original.xywh);
  await page.getByRole('combobox', { name: 'Font', exact: true }).selectOption({ label: 'Kalam' });
  await expect.poll(async () => (await shapeState(page)).family).toContain('Kalam');
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  await page.reload(); await expect(page.locator('affine-edgeless-root')).toBeVisible();
  await expect.poll(async () => (await shapeState(page)).fontSize).toBe(10);
  expect((await shapeState(page)).xywh).toBe(original.xywh);
});

test('notes offer t-shirt sizes with proportional text and no page action', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Add sticky note', exact: true }).click();
  await page.locator('affine-edgeless-note').dblclick(); await page.keyboard.insertText('A readable note'); await page.keyboard.press('Escape');
  await page.mouse.click(900, 600); await page.locator('affine-edgeless-note').click();
  const size = page.getByRole('combobox', { name: 'Note size', exact: true });
  await expect(size).toBeVisible();
  await expect(size.locator('option')).toHaveText(['XS', 'S', 'M', 'L', 'XL']);
  const metrics = () => page.locator('affine-edgeless-note').evaluate(el => {
    const container = el.querySelector('[data-testid="edgeless-note-container"]')!;
    return { width: container.getBoundingClientRect().width, scale: Number(container.getAttribute('data-scale')), font: getComputedStyle(el.querySelector('affine-paragraph')!).fontSize };
  });
  await size.selectOption({ label: 'S' }); await expect.poll(async () => (await metrics()).scale).toBe(.75); const small = await metrics();
  await size.selectOption({ label: 'L' });
  await expect.poll(async () => (await metrics()).scale).toBe(1.5);
  const large = await metrics(); expect(large.width / small.width).toBeCloseTo(2, 1); expect(large.scale / small.scale).toBe(2);
  await expect(page.getByRole('button', { name: /Display in Page|Insert into Page/ })).toHaveCount(0);
});

test('font options, thickness, connector endpoint position and eraser are usable', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Add text', exact: true }).click();
  await page.getByRole('combobox', { name: 'Font', exact: true }).selectOption({ label: 'Kalam' });
  await expect.poll(() => page.evaluate(() => document.fonts.check('16px "blocksuite:surface:Kalam"'))).toBe(true);
  await page.getByRole('button', { name: 'Lines', exact: true }).click(); await page.getByRole('button', { name: 'Straight arrow', exact: true }).click();
  await page.mouse.move(350, 300); await page.mouse.down(); await page.mouse.move(550, 450, { steps: 8 }); await page.mouse.up();
  const plus = (await page.getByRole('button', { name: 'Add shape at connector end', exact: true }).boundingBox())!;
  expect(Math.abs(plus.y + plus.height / 2 - 450)).toBeLessThan(5);
  expect(plus.x - 550).toBeLessThan(40);
  await page.getByRole('button', { name: 'Stroke style', exact: true }).click();
  const thickness = page.getByRole('spinbutton', { name: 'Thickness', exact: true });
  await expect(thickness).toBeVisible(); await thickness.fill('4'); await thickness.press('Enter');
  await expect.poll(() => page.locator('affine-edgeless-root').evaluate(el => { const model = (el as HTMLElement & { gfx: GfxController }).gfx.gfxElements.find(m => 'type' in m && m.type === 'connector'); return model && 'strokeWidth' in model ? model.strokeWidth : null; })).toBe(4);
  await page.mouse.click(1000, 600);
  await page.getByRole('button', { name: 'Freehand', exact: true }).click(); await page.getByRole('button', { name: 'Pen', exact: true }).click();
  await page.mouse.move(700, 500); await page.mouse.down(); await page.mouse.move(800, 500, { steps: 8 }); await page.mouse.up();
  const brushes = () => page.locator('affine-edgeless-root').evaluate(el => (el as HTMLElement & { gfx: GfxController }).gfx.gfxElements.filter(m => 'type' in m && m.type === 'brush').length);
  await expect.poll(brushes).toBe(1);
  await page.getByRole('button', { name: 'Freehand', exact: true }).click(); await page.getByRole('button', { name: 'Eraser', exact: true }).click();
  await expect.poll(() => page.locator('affine-edgeless-root').evaluate(el => (el as HTMLElement & { gfx: GfxController }).gfx.tool.currentToolName$.value)).toBe('eraser');
  await page.mouse.move(750, 480); await page.mouse.down(); await page.mouse.move(750, 520, { steps: 8 }); await page.mouse.up();
  await expect.poll(brushes).toBe(0);
  await page.keyboard.press('ControlOrMeta+z'); await expect.poll(brushes).toBe(1);
});

for (const width of [1400, 390]) test(`compact header and image recovery at ${width}`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 850 }); await page.goto('/');
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  await expect(page.locator('.board-document-heading .save-age')).toHaveText('just now');
  const titleBox = (await page.locator('.board-title-control').boundingBox())!; const savedBox = (await page.getByRole('button', { name: 'Saved', exact: true }).boundingBox())!;
  if (width > 900) expect(savedBox.x - (titleBox.x + titleBox.width)).toBeLessThan(24);
  await expect(page.locator('.djai-header-actions > .board-role')).toHaveCount(0);
  await page.getByLabel('Account for Synthetic Owner').click(); await expect(page.locator('.board-account .board-role')).toHaveText('Owner');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Main Menu', exact: true }).click(); await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
  await expect(page.locator('.dali-submenu kbd')).toHaveCount(2); await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  const before = (await page.getByTestId('board-action-menu').boundingBox())!.width;
  await page.locator('input[type=file][accept="image/*"]').setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('invalid image') });
  await expect(page.getByTestId('image-import-error')).toBeVisible();
  expect((await page.getByTestId('board-action-menu').boundingBox())!.width).toBe(before);
  await page.screenshot({ path: info.outputPath(`refined-header-${width}.png`) });
  await page.getByRole('button', { name: 'Dismiss error', exact: true }).click();
  await expect(page.getByTestId('image-import-error')).toHaveCount(0);
});
