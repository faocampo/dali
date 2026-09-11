import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import type { GfxController } from '@blocksuite/affine/std/gfx';

async function images(page: Page) {
  return page.locator('affine-edgeless-root').evaluate(async el=>{
    const gfx=(el as HTMLElement & {gfx:GfxController}).gfx;
    return Promise.all(gfx.doc.getBlocksByFlavour('affine:image').map(async ({model})=>{
      const m=model as typeof model & {xywh:string;props:{sourceId:string}};
      const blob=await gfx.doc.blobSync.get(m.props.sourceId);
      return {id:m.id,bounds:JSON.parse(m.xywh) as number[],bytes:blob?.size ?? 0};
    }));
  });
}

async function raster(page: Page, mimeType = 'image/png', width = 320, height = 160) {
  const data = await page.evaluate(({mimeType,width,height}) => {
    const canvas = document.createElement('canvas'); canvas.width=width; canvas.height=height;
    const ctx=canvas.getContext('2d')!; ctx.fillStyle='#00ff00';ctx.fillRect(0,0,width,height);
    ctx.fillStyle='#ff00ff';ctx.fillRect(0,0,width/2,height/2);
    return canvas.toDataURL(mimeType).split(',')[1]!;
  }, {mimeType,width,height});
  return {name:'synthetic-reference.png',mimeType,buffer:Buffer.from(data,'base64')};
}

test('picker rejects corrupt bytes with an actionable error and permits retry', async ({page}) => {
  await page.goto('/');
  const input=page.getByTestId('board-action-menu').locator('input[type=file][accept="image/*"]');
  await input.setInputFiles({name:'synthetic-corrupt.png',mimeType:'image/png',buffer:Buffer.from('invalid')});
  await expect(page.getByTestId('image-import-error')).toContainText('PNG or JPEG');
  await expect(page.locator('affine-edgeless-image')).toHaveCount(0);
  await input.setInputFiles(await raster(page));
  await expect(page.locator('affine-edgeless-image')).toHaveCount(1);
  await expect(page.getByTestId('image-import-error')).toHaveCount(0);
});

test('picker centers proportional images, supports repeated selection and persists arranged pixels', async ({page})=> {
  await page.goto('/');
  const input=page.getByTestId('board-action-menu').locator('input[type=file][accept="image/*"]');
  const file=await raster(page);
  await input.setInputFiles(file);
  await expect(page.locator('affine-edgeless-image')).toHaveCount(1);
  const first=(await images(page))[0]!;
  expect(first.bounds[2]!/first.bounds[3]!).toBeCloseTo(2,4);
  expect(first.bytes).toBe(file.buffer.length);
  const center=await page.locator('affine-edgeless-root').evaluate(el=>(el as HTMLElement & {gfx:GfxController}).gfx.viewport.center);
  expect(first.bounds[0]!+first.bounds[2]!/2).toBeCloseTo(center.x,0);
  expect(first.bounds[1]!+first.bounds[3]!/2).toBeCloseTo(center.y,0);
  const bounds=await page.locator('affine-edgeless-image').boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds!.x+bounds!.width/2,bounds!.y+bounds!.height/2);
  await page.mouse.down();await page.mouse.move(bounds!.x+bounds!.width/2+70,bounds!.y+bounds!.height/2+40,{steps:10});await page.mouse.up();
  await expect.poll(async()=>(await images(page))[0]!.bounds[0]).not.toBe(first.bounds[0]);
  const handle=await page.locator('.handle[aria-label="bottom-right"] .resize').boundingBox();
  await page.mouse.move(handle!.x+handle!.width/2,handle!.y+handle!.height/2);
  await page.mouse.down();await page.mouse.move(handle!.x+handle!.width/2+40,handle!.y+handle!.height/2+20,{steps:10});await page.mouse.up();
  await expect.poll(async()=>(await images(page))[0]!.bounds[2]).toBeGreaterThan(first.bounds[2]!);
  const moved=(await images(page))[0]!;
  expect(moved.bounds[2]!/moved.bounds[3]!).toBeCloseTo(2,2);
  await input.setInputFiles(file);
  await expect(page.locator('affine-edgeless-image')).toHaveCount(2);
  expect((await images(page))[1]!.id).not.toBe(first.id);
  await page.getByRole('button',{name:'Saved locally',exact:true}).waitFor();
  await page.reload();
  await expect(page.locator('affine-edgeless-image')).toHaveCount(2);
  expect((await images(page)).find(i=>i.id===first.id)).toEqual(moved);
  await input.setInputFiles(await raster(page,'image/jpeg',160,320));
  await expect(page.locator('affine-edgeless-image')).toHaveCount(3);
  expect((await images(page))[2]!.bounds[2]!/(await images(page))[2]!.bounds[3]!).toBeCloseTo(0.5,4);
});
