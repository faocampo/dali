import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import type { GfxController } from '@blocksuite/affine/std/gfx';

async function raster(page: Page, width = 200, height = 100) {
  const data = await page.evaluate(({ width, height }) => {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#80a040'; ctx.fillRect(0, 0, width, height);
    return canvas.toDataURL().split(',')[1]!;
  }, { width, height });
  return { name: 'synthetic-edit.png', mimeType: 'image/png', buffer: Buffer.from(data, 'base64') };
}

async function setup(page: Page) {
  await page.goto('/');
  await page.getByTestId('board-action-menu').locator('input[type=file][accept="image/*"]').setInputFiles(await raster(page));
  await expect(page.locator('affine-edgeless-image')).toHaveCount(1);
  await page.locator('affine-edgeless-image').click();
}

async function state(page: Page) {
  return page.locator('affine-edgeless-root').evaluate(el => {
    const store = (el as HTMLElement & { gfx: GfxController }).gfx.doc;
    return {
      images: store.getBlocksByFlavour('affine:image').map(({ model }) => ({
        id: model.id, ...model.props, bounds: JSON.parse((model.props as { xywh: string }).xywh) as number[],
      })),
      edits: store.getBlocksByFlavour('djai:image-visual-edit').map(({ model }) => ({ id: model.id, ...model.props })),
    };
  });
}

async function crop(page: Page) {
  await page.locator('.selection-inspector').getByRole('button', { name: 'Crop', exact: true }).click();
  await page.getByTestId('image-crop-controls').getByLabel('Left').fill('10');
  await page.getByRole('button', { name: 'Apply crop', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Reset edits', exact: true })).toBeEnabled();
}

async function brighten(page: Page) {
  await page.locator('.image-slider').filter({ hasText: 'Brightness' }).locator('input').fill('20');
  await page.getByRole('button', { name: 'Apply adjustments', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Apply adjustments', exact: true })).toBeEnabled();
}

function closeBounds(actual: number[], expected: number[]) {
  expected.forEach((value, index) => expect(actual[index]).toBeCloseTo(value, 5));
}

test('crop edits preserve native movement and resize through brightness and reset', async ({ page }) => {
  await setup(page); await crop(page);
  const box = await page.locator('affine-edgeless-image').boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + 60, box!.y + box!.height / 2 + 30, { steps: 10 });
  await page.mouse.up();
  const handle = await page.locator('.handle[aria-label="bottom-right"] .resize').boundingBox();
  await page.mouse.move(handle!.x + handle!.width / 2, handle!.y + handle!.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle!.x + 40, handle!.y + 20, { steps: 10 });
  await page.mouse.up();
  const arranged = (await state(page)).images[0]!.bounds;
  await brighten(page);
  closeBounds((await state(page)).images[0]!.bounds, arranged);
  await page.getByRole('button', { name: 'Reset edits', exact: true }).click();
  const [x, y, w, h] = arranged as [number, number, number, number];
  closeBounds((await state(page)).images[0]!.bounds, [x - w / 9, y, w / 0.9, h]);
});
