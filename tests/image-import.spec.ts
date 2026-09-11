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

async function transfer(page: Page, type: 'drop'|'paste', file: Awaited<ReturnType<typeof raster>>) {
  return page.locator('affine-edgeless-root').evaluate((el,{type,file})=>{
    const data=new DataTransfer();
    data.items.add(new File([Uint8Array.from(atob(file.base64),c=>c.charCodeAt(0))],file.name,{type:file.mimeType}));
    const event=type==='drop' ? new DragEvent('drop',{bubbles:true,cancelable:true,composed:true,dataTransfer:data,clientX:700,clientY:400}) :
      new ClipboardEvent('paste',{bubbles:true,cancelable:true,composed:true,clipboardData:data});
    el.dispatchEvent(event); return event.defaultPrevented;
  },{type,file:{name:file.name,mimeType:file.mimeType,base64:file.buffer.toString('base64')}});
}

test('paste centers one image after pan and zoom',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Insert image',exact:true}).waitFor();
  await page.locator('affine-edgeless-root').evaluate(el=>{
    const gfx=(el as HTMLElement & {gfx:GfxController}).gfx;
    gfx.viewport.setZoom(0.5);gfx.viewport.setCenter(1000,500);
  });
  const file=await raster(page);
  expect(await transfer(page,'paste',file)).toBe(true);
  await expect(page.locator('affine-edgeless-image')).toHaveCount(1);
  const bounds=(await images(page))[0]!.bounds;
  expect(bounds[0]!+bounds[2]!/2).toBeCloseTo(1000,0);
  expect(bounds[1]!+bounds[3]!/2).toBeCloseTo(500,0);
});

test('drop uses client coordinates once and recovers from active content',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Insert image',exact:true}).waitFor();
  const target=await page.locator('affine-edgeless-root').evaluate(el=>{
    const gfx=(el as HTMLElement & {gfx:GfxController}).gfx;
    gfx.viewport.setZoom(0.5);gfx.viewport.setCenter(1000,500);
    return gfx.viewport.toModelCoord(...gfx.viewport.toViewCoordFromClientCoord([700,400]));
  });
  await transfer(page,'drop',{name:'synthetic.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')});
  await expect(page.getByTestId('image-import-error')).toContainText('PNG or JPEG');
  expect(await images(page)).toHaveLength(0);
  expect(await transfer(page,'drop',await raster(page))).toBe(true);
  await expect(page.locator('affine-edgeless-image')).toHaveCount(1);
  const bounds=(await images(page))[0]!.bounds;
  expect(bounds[0]!+bounds[2]!/2).toBeCloseTo(target[0]!,0);
  expect(bounds[1]!+bounds[3]!/2).toBeCloseTo(target[1]!,0);
});

test('image input rejects size budgets and stale or failed storage then retries',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Insert image',exact:true}).waitFor();
  const input=page.getByTestId('board-action-menu').locator('input[type=file][accept="image/*"]');
  const file=await raster(page);
  await input.setInputFiles({...file,buffer:Buffer.alloc(16*1024*1024+1)});
  await expect(page.getByTestId('image-import-error')).toContainText('16 MiB');
  const huge=Buffer.from(file.buffer);huge.writeUInt32BE(8193,16);
  await input.setInputFiles({...file,buffer:huge});
  await expect(page.getByTestId('image-import-error')).toContainText('8192');
  expect(await images(page)).toHaveLength(0);
  for(const failure of ['storage','board'] as const) {
    await page.locator('affine-edgeless-root').evaluate((el,failure)=>{
      const gfx=(el as HTMLElement & {gfx:GfxController}).gfx;
      const sync=gfx.doc.blobSync;
      const original=sync.set.bind(sync);
      sync.set=(async (...args: unknown[])=>{
        sync.set=original;
        if(failure==='storage') throw new Error('Synthetic storage rejection');
        const id=await Reflect.apply(original,sync,args);
        localStorage.setItem('djai-design.active-board','synthetic-other-board');
        return id;
      }) as typeof sync.set;
    },failure);
    await input.setInputFiles(file);
    await expect(page.getByTestId('image-import-error')).toContainText(failure==='storage'?'could not be saved':'board changed');
    expect(await images(page)).toHaveLength(0);
    await page.locator('affine-edgeless-root').evaluate(el=>{
      localStorage.setItem('djai-design.active-board',(el as HTMLElement & {gfx:GfxController}).gfx.doc.id);
    });
  }
  await input.setInputFiles(file);
  await expect(page.locator('affine-edgeless-image')).toHaveCount(1);
});

test('clipboard keeps rich text paste and imports a bitmap once',async({page,context,browserName},testInfo)=>{
  await page.goto('/');await page.getByRole('button',{name:'Insert image',exact:true}).waitFor();
  await page.getByRole('button',{name:'Add sticky note',exact:true}).click();
  await page.locator('affine-edgeless-note').dblclick();
  if(browserName==='chromium') {
    await context.grantPermissions(['clipboard-read','clipboard-write']);
    await page.evaluate(()=>navigator.clipboard.writeText('Synthetic clipboard text'));
    await page.keyboard.press('ControlOrMeta+v');
  } else {
    await page.locator('[contenteditable="true"]').last().evaluate(el=>{
      const data=new DataTransfer();data.setData('text/plain','Synthetic clipboard text');
      el.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,composed:true,cancelable:true,clipboardData:data}));
    });
  }
  await expect(page.locator('affine-edgeless-note')).toContainText('Synthetic clipboard text');
  await page.keyboard.press('Escape');await page.mouse.click(1000,650);
  const file=await raster(page);
  if(browserName==='chromium') {
    await page.evaluate(async base64=>{
      const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
      await navigator.clipboard.write([new ClipboardItem({'image/png':new Blob([bytes],{type:'image/png'})})]);
    },file.buffer.toString('base64'));
    await page.keyboard.press('ControlOrMeta+v');
    testInfo.annotations.push({type:'input-evidence',description:'Browser Clipboard API write plus native keyboard paste in Chromium.'});
  } else {
    await transfer(page,'paste',file);
    testInfo.annotations.push({type:'input-evidence',description:'Constructed ClipboardEvent in this engine; OS clipboard integration remains unverified.'});
  }
  await expect(page.locator('affine-edgeless-image')).toHaveCount(1);
  expect((await images(page))[0]!.bytes).toBeGreaterThan(0);
});
