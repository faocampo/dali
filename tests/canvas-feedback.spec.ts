import { test, expect } from './fixtures';
import type { GfxController } from '@blocksuite/affine/std/gfx';

const state = (page: import('@playwright/test').Page) => page.locator('affine-edgeless-root').evaluate(el => {
  const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
  return gfx.gfxElements.map(m => ({ id: m.id, type: 'type' in m ? m.type : '', w: m.w, h: m.h, fill: 'fillColor' in m ? m.fillColor : '', target: 'target' in m ? m.target : null }));
});
test('connector plus creates and attaches a shape with undo', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Lines', exact: true }).click();
  await page.getByRole('dialog', { name: 'Lines palette' }).getByRole('button', { name: 'Straight arrow' }).click();
  await page.mouse.move(350, 300); await page.mouse.down(); await page.mouse.move(550, 400, { steps: 8 }); await page.mouse.up();
  await page.getByRole('button', { name: 'Add shape at connector end', exact: true }).click();
  await expect.poll(async () => (await state(page)).filter(m => m.type === 'shape').length).toBe(1);
  const shapes = await state(page);
  expect(shapes.find(m => m.type === 'connector')?.target).toMatchObject({ id: shapes.find(m => m.type === 'shape')!.id });
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(async () => (await state(page)).filter(m => m.type === 'shape').length).toBe(0);
});
test('fill transparency applies immediately and survives reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Shapes', exact: true }).click();
  await page.getByRole('button', { name: 'Square / rectangle' }).click();
  await page.mouse.click(450, 300);
  await page.getByRole('button', { name: 'Color', exact: true }).click();
  const slider = page.getByRole('slider', { name: 'Fill transparency' });
  await expect(slider).toBeVisible();
  await slider.fill('100');
  await slider.fill('50');
  const track = (await slider.boundingBox())!;
  await page.mouse.move(track.x + track.width / 2, track.y + track.height / 2);
  await page.mouse.down();
  await page.mouse.move(track.x + track.width * 0.75, track.y + track.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => slider.inputValue()).not.toBe('50');
  await slider.fill('50');
  if (test.info().project.name === 'prod') {
    await expect(page.locator('editor-toolbar[data-open]').first()).toHaveCSS('opacity', '1');
    await page.screenshot({ path: test.info().outputPath('fill-transparency.png') });
  }
  await expect.poll(async () => (await state(page)).find(m => m.type === 'shape')?.fill).toMatch(/80$/);
  await expect(page.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
  await page.reload();
  await expect.poll(async () => (await state(page)).find(m => m.type === 'shape')?.fill).toMatch(/80$/);
});
test('toolbar tooltips are visible on hover', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add mind map', exact: true }).hover();
  await expect(page.getByRole('tooltip')).toHaveText('Add mind map');
});
test('mind map creation keys work after canvas selection and menu focus', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add mind map', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('Central topic');
  await page.keyboard.type('Root'); await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Main Menu', exact: true }).click(); await page.keyboard.press('Escape');
  const center = await page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const m = gfx.gfxElements.find(m => 'type' in m && m.type === 'shape')!;
    const p = gfx.viewport.toViewCoord(m.x + m.w / 2, m.y + m.h / 2); const r = el.getBoundingClientRect(); return [p[0] + r.x, p[1] + r.y];
  });
  await page.mouse.click(center[0]!, center[1]!); await page.keyboard.press('Tab');
  await expect.poll(async () => (await state(page)).filter(m => m.type === 'shape').length).toBe(2);
  await page.keyboard.type('Child'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
  await expect.poll(async () => (await state(page)).filter(m => m.type === 'shape').length).toBe(3);
});
test('text bounds shrink to the content after editing', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add text', exact: true }).click();
  await page.mouse.move(650, 500); await page.mouse.down(); await page.mouse.move(900, 560, { steps: 6 }); await page.mouse.up();
  await expect(page.locator('edgeless-text-editor [contenteditable="true"]')).toBeFocused();
  await page.keyboard.type('Text'); await page.mouse.click(1000, 650); await page.mouse.click(670, 520);
  await page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const m = gfx.gfxElements.find(m => 'type' in m && m.type === 'text')!;
    gfx.surface!.updateElement(m.id, { xywh: '[200,200,300,500]', hasMaxWidth: true });
  });
  await expect.poll(async () => (await state(page)).find(m => m.type === 'text')?.h).toBeLessThan(80);
  expect((await state(page)).find(m => m.type === 'text')!.w).toBe(300);
});
