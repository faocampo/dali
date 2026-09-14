import { openObjectActions } from './object-actions';
import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import type { GfxController } from '@blocksuite/affine/std/gfx';
import type { ImageBlockModel } from '@blocksuite/affine/model';

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
  await page.getByRole('button', {name:'Crop left',exact:true}).press('Shift+ArrowRight');
  await page.getByRole('button', { name: 'Apply crop', exact: true }).click();
  await expect(page.getByTestId('image-crop-controls')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reset edits', exact: true })).toBeEnabled();
}

async function brighten(page: Page) {
  await page.locator('.image-slider').filter({ hasText: 'Brightness' }).locator('input').fill('20');
  await expect.poll(async () => (await state(page)).edits.some(e => (e as {brightness?:number}).brightness === 20)).toBe(true);
  await expect(page.getByText('Saving changes…', {exact:true})).toHaveCount(0);
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
  await openObjectActions(page);
  await page.getByRole('menuitem', { name: 'Duplicate', exact: true }).click();
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

test('Replace preflights raster dimensions and preserves edited pixels on rejection', async ({ page }) => {
  await setup(page); await crop(page);
  const before = await state(page);
  const file = await raster(page);
  const huge = Buffer.from(file.buffer); huge.writeUInt32BE(100000, 16);
  await page.evaluate(() => {
    const original = HTMLImageElement.prototype.decode;
    HTMLImageElement.prototype.decode = function () {
      document.body.dataset.syntheticDecodeCalls = String(Number(document.body.dataset.syntheticDecodeCalls ?? 0) + 1);
      return original.call(this);
    };
  });
  const input = page.locator('.selection-inspector input[type=file]');
  await input.setInputFiles({ ...file, buffer: huge });
  await expect(page.locator('.selection-inspector [role=alert]')).toContainText('8192');
  expect(await page.locator('body').getAttribute('data-synthetic-decode-calls')).toBeNull();
  expect(await state(page)).toEqual(before);
  await input.setInputFiles({ name: 'synthetic.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
  await expect(page.locator('.selection-inspector [role=alert]')).toContainText('PNG or JPEG');
  expect(await state(page)).toEqual(before);
  await input.setInputFiles(file);
  await expect.poll(async () => (await state(page)).edits.length).toBe(0);
});

test('Replace rejects a changed board after blob storage and permits retry', async ({ page }) => {
  await setup(page); await crop(page);
  const before = await state(page);
  await page.locator('affine-edgeless-root').evaluate(el => {
    const sync = (el as HTMLElement & { gfx: GfxController }).gfx.doc.blobSync;
    const original = sync.set.bind(sync);
    sync.set = (async (...args: unknown[]) => {
      sync.set = original;
      const id = await Reflect.apply(original, sync, args);
      localStorage.setItem('djai-design.active-board', 'synthetic-other-board');
      return id;
    }) as typeof sync.set;
  });
  const file = await raster(page, 80, 160);
  const input = page.locator('.selection-inspector input[type=file]');
  await input.setInputFiles(file);
  await expect(page.locator('.selection-inspector [role=alert]')).toContainText('board changed');
  expect(await state(page)).toEqual(before);
  await page.locator('affine-edgeless-root').evaluate(el => {
    localStorage.setItem('djai-design.active-board', (el as HTMLElement & { gfx: GfxController }).gfx.doc.id);
  });
  await input.setInputFiles(file);
  await expect.poll(async () => (await state(page)).edits.length).toBe(0);
});

test('Replace cannot mutate a disconnected board when blob storage finishes', async ({ page }) => {
  await setup(page);
  await page.locator('affine-edgeless-root').evaluate(el => {
    const store = (el as HTMLElement & { gfx: GfxController }).gfx.doc;
    const image = store.getBlocksByFlavour('affine:image')[0]!.model as ImageBlockModel;
    const sync = store.blobSync;
    const original = sync.set.bind(sync);
    const hook = window as Window & { finishSyntheticReplacement?: () => void; syntheticSource?: () => unknown };
    hook.syntheticSource = () => image.props.sourceId;
    sync.set = (async (...args: unknown[]) => {
      sync.set = original;
      const id = await Reflect.apply(original, sync, args);
      document.body.dataset.syntheticReplacement = 'pending';
      await new Promise<void>(resolve => { hook.finishSyntheticReplacement = resolve; });
      return id;
    }) as typeof sync.set;
  });
  const source = await page.evaluate(() => (window as Window & { syntheticSource?: () => unknown }).syntheticSource!());
  await page.locator('.selection-inspector input[type=file]').setInputFiles(await raster(page, 80, 160));
  await expect(page.locator('body')).toHaveAttribute('data-synthetic-replacement', 'pending');
  await page.locator('.djai-board-switcher').click();
  await expect(page.locator('affine-edgeless-root')).toHaveCount(0);
  await page.evaluate(async () => {
    (window as Window & { finishSyntheticReplacement?: () => void }).finishSyntheticReplacement!();
    await new Promise(resolve => setTimeout(resolve, 50));
  });
  expect(await page.evaluate(() => (window as Window & { syntheticSource?: () => unknown }).syntheticSource!())).toEqual(source);
});

test('visual crop handles resize the crop, cancel leaves pixels unchanged, and reopening permits expansion', async ({page}) => {
  await setup(page);
  const before = await state(page);
  await page.locator('.selection-inspector').getByRole('button',{name:'Crop',exact:true}).click();
  const source = await page.locator('.image-crop-source').boundingBox();
  const handle = await page.getByRole('button',{name:'Crop left',exact:true}).boundingBox();
  await page.mouse.move(handle!.x + handle!.width / 2 + 2, handle!.y + handle!.height / 2);
  await page.mouse.down(); await page.mouse.move(handle!.x + handle!.width / 2 + source!.width * 0.2, handle!.y + handle!.height / 2, {steps:8}); await page.mouse.up();
  await expect.poll(async () => parseFloat(await page.locator('.image-crop-window').evaluate(el => (el as HTMLElement).style.left))).toBeGreaterThan(10);
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  expect(await state(page)).toEqual(before);
  await crop(page);
  const cropped = await state(page);
  expect(cropped.images[0]!.bounds[2]).toBeLessThan(before.images[0]!.bounds[2]!);
  await page.locator('.selection-inspector').getByRole('button',{name:'Crop',exact:true}).click();
  await page.getByRole('button',{name:'Crop left',exact:true}).press('Shift+ArrowLeft');
  await page.getByRole('button',{name:'Apply crop',exact:true}).click();
  await expect.poll(async () => (await state(page)).images[0]!.bounds[2]).toBeCloseTo(before.images[0]!.bounds[2]!,4);
});

test('live slider changes persist the newest value and reset cancels pending work', async ({page}) => {
  await setup(page);
  const brightness=page.getByRole('slider',{name:'Brightness',exact:true});
  await brightness.fill('10'); await brightness.fill('35'); await brightness.fill('-20');
  await expect.poll(async () => ((await state(page)).edits[0] as {brightness?:number}|undefined)?.brightness).toBe(-20);
  await brightness.fill('80');
  await page.getByRole('button',{name:'Reset edits',exact:true}).click();
  await expect.poll(async () => (await state(page)).edits.length).toBe(0);
  await expect(brightness).toHaveValue('0');
  await page.waitForTimeout(150);
  expect((await state(page)).edits).toHaveLength(0);
  await page.reload();
  expect((await state(page)).edits).toHaveLength(0);
});
