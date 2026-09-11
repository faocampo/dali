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

async function setup(page: Page, rotate = 0) {
  await page.goto('/');
  await page.getByTestId('board-action-menu').locator('input[type=file][accept="image/*"]').setInputFiles(await raster(page));
  await expect(page.locator('affine-edgeless-image')).toHaveCount(1);
  if (rotate) await page.locator('affine-edgeless-root').evaluate((el, rotate) => {
    const store = (el as HTMLElement & { gfx: GfxController }).gfx.doc;
    store.updateBlock(store.getBlocksByFlavour('affine:image')[0]!.model, { rotate });
  }, rotate);
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

for (const angle of [90, 37]) test(`rotated ${angle} degree image keeps native geometry across edits and replacement`, async ({ page }) => {
  await setup(page, angle);
  const initial = (await state(page)).images[0]!.bounds;
  await page.getByRole('button', { name: 'Apply position & size', exact: true }).click();
  closeBounds((await state(page)).images[0]!.bounds, initial);
  await brighten(page);
  closeBounds((await state(page)).images[0]!.bounds, initial);
  await crop(page);
  const [x, y, w, h] = initial as [number, number, number, number];
  const radians = angle * Math.PI / 180;
  closeBounds((await state(page)).images[0]!.bounds, [
    x + w / 2 + w * 0.05 * Math.cos(radians) - w * 0.9 / 2,
    y + w * 0.05 * Math.sin(radians), w * 0.9, h,
  ]);
  await page.getByRole('button', { name: 'Reset edits', exact: true }).click();
  closeBounds((await state(page)).images[0]!.bounds, initial);
  await page.locator('.selection-inspector input[type=file]').setInputFiles(await raster(page, 80, 160));
  await expect.poll(async () => (await state(page)).images[0]!.bounds[3]).toBe(w * 2);
  closeBounds((await state(page)).images[0]!.bounds, [x, y, w, w * 2]);
});

test('Duplicate gives edited images independent history and placement', async ({ page }) => {
  await setup(page); await crop(page);
  const original = (await state(page)).images[0]!;
  await page.locator('.selection-inspector').getByRole('button', { name: 'Duplicate', exact: true }).click();
  await expect(page.locator('affine-edgeless-image')).toHaveCount(2);
  await expect.poll(async () => (await state(page)).edits.length).toBe(2);
  const copied = (await state(page)).images.find(image => image.id !== original.id)!;
  const records = (await state(page)).edits;
  expect(new Set(records.map(record => record.id)).size).toBe(2);
  await brighten(page);
  closeBounds((await state(page)).images.find(image => image.id === copied.id)!.bounds, copied.bounds);
  expect((await state(page)).images.find(image => image.id === original.id)).toEqual(original);
  await page.getByRole('button', { name: 'Reset edits', exact: true }).click();
  const reset = await state(page);
  expect(reset.edits).toHaveLength(1);
  expect(reset.images.find(image => image.id === original.id)).toEqual(original);
  const [x, y, w, h] = copied.bounds as [number, number, number, number];
  closeBounds(reset.images.find(image => image.id === copied.id)!.bounds, [x - w / 9, y, w / 0.9, h]);
  // Original reset history remains available after resetting its copy.
  await page.locator('affine-edgeless-root').evaluate((el, id) => {
    (el as HTMLElement & { gfx: GfxController }).gfx.selection.set({ elements: [id], editing: false });
  }, original.id);
  await expect(page.getByRole('button', { name: 'Reset edits', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Reset edits', exact: true }).click();
  expect((await state(page)).edits).toHaveLength(0);
});
