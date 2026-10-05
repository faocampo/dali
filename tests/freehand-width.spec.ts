import { test, expect } from './fixtures';
import type { GfxController } from '@blocksuite/affine/std/gfx';

test('freehand width controls affect new strokes and preserve saved existing strokes', async ({ page }, testInfo) => {
  await page.goto('/');
  const widths = () => page.locator('affine-edgeless-root').evaluate(element =>
    (element as HTMLElement & { gfx: GfxController }).gfx.gfxElements
      .filter(model => 'type' in model && model.type === 'brush')
      .map(model => (model as unknown as { lineWidth: number }).lineWidth).sort((a, b) => a - b));
  const draw = async (y: number) => {
    await page.mouse.move(450, y); await page.mouse.down();
    await page.mouse.move(700, y + 40, { steps: 12 }); await page.mouse.up();
  };
  await page.getByRole('button', { name: 'Freehand', exact: true }).click();
  await page.getByRole('button', { name: '12 pixel pen', exact: true }).click();
  await expect(page.getByRole('button', { name: '12 pixel pen' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('slider', { name: 'Pen width' })).toHaveValue('12');
  await expect(page.locator('.freehand-width-preview path')).toHaveAttribute('stroke-width', '12');
  await page.getByRole('button', { name: 'Pen', exact: true }).click(); await draw(300);
  await expect.poll(widths).toEqual([12]);
  await page.getByRole('button', { name: 'Freehand', exact: true }).click();
  const slider = page.getByRole('slider', { name: 'Pen width' });
  await slider.focus(); await slider.press('Home'); await slider.press('ArrowRight');
  await expect(slider).toHaveValue('4');
  await slider.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Freehand palette' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Freehand', exact: true })).toBeFocused();
  await draw(430); await expect.poll(widths).toEqual([4, 12]);
  await page.getByRole('button', { name: 'Freehand', exact: true }).click();
  await page.getByRole('button', { name: 'Eraser', exact: true }).click();
  await page.getByRole('button', { name: 'Freehand', exact: true }).click();
  await expect(slider).toHaveValue('4');
  await page.getByRole('button', { name: 'Pen', exact: true }).click(); await draw(550);
  await expect.poll(widths).toEqual([4, 4, 12]);
  await expect(page.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
  await page.reload(); await expect.poll(widths).toEqual([4, 4, 12]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Freehand', exact: true }).click();
  const box = await page.getByRole('dialog', { name: 'Freehand palette' }).boundingBox();
  expect(box).toBeTruthy(); expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  await expect(page.getByRole('slider', { name: 'Pen width' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('freehand-width.png') });
});
