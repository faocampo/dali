import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import type { GfxController } from '@blocksuite/affine/std/gfx';
import { writeFileSync } from 'node:fs';

async function pngDownload(page: Page, scale: 1 | 2 | 4, transparent = true) {
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByRole('radio', { name: 'PNG image' }).check();
  await page.getByRole('radio', { name: `${scale}×`, exact: true }).check();
  await page.getByRole('checkbox', { name: 'Transparent background' }).setChecked(transparent);
  const preview = await page.getByTestId('export-dimensions').textContent();
  const pending = page.waitForEvent('download');
  await page.getByRole('dialog').getByRole('button', { name: 'Download', exact: true }).click();
  const download = await pending;
  expect(await download.failure()).toBeNull();
  const stream = await download.createReadStream();
  const parts: Buffer[] = [];
  for await (const part of stream!) parts.push(Buffer.from(part));
  const png = Buffer.concat(parts);
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(preview).toContain(`${png.readUInt32BE(16)} × ${png.readUInt32BE(20)}`);
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  return png;
}

async function mixedBoard(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add sticky note', exact: true }).click();
  await page.locator('affine-edgeless-note').dblclick();
  await page.keyboard.insertText('Café Fine text 123');
  await page.keyboard.press('Escape');
  const imageData = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width=80;canvas.height=80;
    const ctx=canvas.getContext('2d')!;ctx.fillStyle='#00ff00';ctx.fillRect(0,0,80,80);
    ctx.fillStyle='#ff00ff';ctx.fillRect(20,20,40,40);
    return canvas.toDataURL('image/png').split(',')[1]!;
  });
  await page.locator('input[type=file][accept="image/*"]').setInputFiles({name:'synthetic-landmark.png',mimeType:'image/png',buffer:Buffer.from(imageData,'base64')});
  await expect(page.locator('affine-edgeless-image')).toHaveCount(1);
  await page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const note = gfx.doc.getBlocksByFlavour('affine:note')[0]!.model;
    gfx.doc.updateBlock(note, { xywh: '[300,0,260,260]' });
    gfx.doc.updateBlock(gfx.doc.getBlocksByFlavour('affine:image')[0]!.model, { xywh: '[650,0,80,80]' });
    gfx.surface!.addElement({ type: 'shape', xywh: '[0,0,200,120]', shapeType: 'rect', shapeStyle: 'General', filled: true, fillColor: '#ff0000', strokeColor: '#000000', strokeWidth: 1 });
    gfx.surface!.addElement({ type: 'shape', xywh: '[0,180,120,80]', rotate: 25, shapeType: 'rect', shapeStyle: 'General', filled: true, fillColor: '#0000ff', strokeWidth: 1 });
    gfx.surface!.addElement({ type: 'connector', source: { position: [20,320] }, target: { position: [240,370] }, mode: 0, stroke: '#000000', strokeWidth: 1, text: 'Link', labelDisplay: true, labelXYWH: [100,333,60,24] });
    gfx.surface!.addElement({ type: 'brush', points: [[20,420],[80,425],[130,415],[220,430]], color: '#800080', lineWidth: 1 });
    gfx.viewport.setCenter(300,200);
  });
  await page.getByRole('button', { name: 'Saved locally', exact: true }).waitFor();
}

test('whole board source scale preserves primitive and DOM detail at every scale', async ({ page }, testInfo) => {
  await mixedBoard(page);
  const downloads: string[] = [];
  for (const scale of [1,2,4] as const) downloads.push((await pngDownload(page, scale)).toString('base64'));
  const evidence = await page.evaluate(async data => {
    const canvases = await Promise.all(data.map(async base64 => {
      const image = new Image(); image.src = `data:image/png;base64,${base64}`; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      canvas.getContext('2d')!.drawImage(image,0,0); return canvas;
    }));
    const metrics = canvases.map(canvas => {
      const pixels = canvas.getContext('2d')!.getImageData(0,0,canvas.width,canvas.height).data;
      let red=0,blue=0,yellow=0,dark=0,green=0,magenta=0;
      for(let i=0;i<pixels.length;i+=4) {
        if(pixels[i+3]!<200) continue;
        const [r,g,b]=[pixels[i]!,pixels[i+1]!,pixels[i+2]!];
        if(r>220&&g<30&&b<30) red++;
        if(b>220&&r<30&&g<30) blue++;
        if(r>180&&g>150&&b<160) yellow++;
        if(r<100&&g<100&&b<100) dark++;
        if(g>220&&r<30&&b<30) green++;
        if(r>220&&b>220&&g<30) magenta++;
      }
      return {red,blue,yellow,dark,green,magenta,width:canvas.width,height:canvas.height,corner:[...pixels.slice(-4)]};
    });
    // Compare a DOM text crop against both nearest and bilinear 1x enlargement.
    // Real high-resolution text must differ in >1% of crop pixels by >20/channel.
    const high=canvases[2]!;
    const compareCrop=(crop:number[])=>[false,true].map(smoothing=>{
      const control=document.createElement('canvas');control.width=high.width;control.height=high.height;
      const ctx=control.getContext('2d')!;ctx.imageSmoothingEnabled=smoothing;ctx.drawImage(canvases[0]!,0,0,high.width,high.height);
      const a=high.getContext('2d')!.getImageData(crop[0]!,crop[1]!,crop[2]!,crop[3]!).data;
      const b=ctx.getImageData(crop[0]!,crop[1]!,crop[2]!,crop[3]!).data;
      let changed=0;for(let i=0;i<a.length;i+=4) if([0,1,2,3].some(c=>Math.abs(a[i+c]!-b[i+c]!)>20))changed++;
      return changed/(a.length/4);
    });
    return {metrics,differences:compareCrop([1250,50,800,160]),lineDifferences:compareCrop([0,1260,1000,280])};
  }, downloads);
  for(const [index,m] of evidence.metrics.entries()) {
    const area=([1,2,4][index]!)**2;
    expect(m.red/area).toBeGreaterThan(20_000);
    expect(m.blue/area).toBeGreaterThan(7_000);
    expect(m.yellow/area).toBeGreaterThan(40_000);
    expect(m.dark/area).toBeGreaterThan(300);
    expect(m.green/area).toBeGreaterThan(4_000);
    expect(m.magenta/area).toBeGreaterThan(1_400);
    expect(m.corner[3]).toBe(0);
  }
  for(const difference of evidence.differences) expect(difference).toBeGreaterThan(0.01);
  for(const difference of evidence.lineDifferences) expect(difference).toBeGreaterThan(0.002);
  await testInfo.attach('scale-proof.json', {body:JSON.stringify(evidence),contentType:'application/json'});
  writeFileSync(testInfo.outputPath('scale-proof.json'),JSON.stringify(evidence));
  for(const [index,base64] of downloads.entries()) await testInfo.attach(`synthetic-${[1,2,4][index]}x.png`, {body:Buffer.from(base64,'base64'),contentType:'image/png'});
});

test('whole board offers explicit source scale and exact downloaded dimensions', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Shape', exact: true }).click();
  await page.mouse.move(250, 200);
  await page.mouse.down();
  await page.mouse.move(450, 320, { steps: 10 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Add sticky note', exact: true }).click();
  await page.locator('affine-edgeless-note').dblclick();
  await page.keyboard.insertText('Café Fine text 123');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByRole('radio', { name: 'PNG image' }).check();
  await expect(page.getByRole('radio', { name: '4×', exact: true })).toBeVisible();
  await page.getByRole('radio', { name: '4×', exact: true }).check();
  const preview = await page.getByTestId('export-dimensions').textContent();
  const result = page.waitForEvent('download');
  await page.getByRole('dialog').getByRole('button', { name: 'Download', exact: true }).click();
  const download = await result;
  expect(await download.failure()).toBeNull();
  const stream = await download.createReadStream();
  const parts: Buffer[] = [];
  for await (const part of stream!) parts.push(Buffer.from(part));
  const png = Buffer.concat(parts);
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(preview).toContain(`${png.readUInt32BE(16)} × ${png.readUInt32BE(20)}`);
});

for (const dpr of [1,2]) {
  test.describe(`screen DPR ${dpr}`, () => {
    test.use({ deviceScaleFactor: dpr });
    test('whole board white output stays identical across zoom and offscreen position', async ({ page }, testInfo) => {
      await mixedBoard(page);
      for (const scale of [1,2,4] as const) {
        await page.locator('affine-edgeless-root').evaluate(el => {
          const gfx=(el as HTMLElement & {gfx:GfxController}).gfx;
          gfx.viewport.setZoom(0.5);gfx.viewport.setCenter(300,200);
        });
        const first=await pngDownload(page,scale,false);
        await page.locator('affine-edgeless-root').evaluate(el => {
          const gfx=(el as HTMLElement & {gfx:GfxController}).gfx;
          gfx.viewport.setZoom(1.5);gfx.viewport.setCenter(1600,1200);
        });
        const second=await pngDownload(page,scale,false);
        writeFileSync(testInfo.outputPath('before.png'),first);
        writeFileSync(testInfo.outputPath('after.png'),second);
        await testInfo.attach(`zoom-before-${scale}.png`,{body:first,contentType:'image/png'});
        await testInfo.attach(`zoom-after-${scale}.png`,{body:second,contentType:'image/png'});
        const pixels=await page.evaluate(async data=>{
          const decoded=await Promise.all(data.map(async base64=>{
            const image=new Image();image.src=`data:image/png;base64,${base64}`;await image.decode();
            const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
            const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0);
            return ctx.getImageData(0,0,canvas.width,canvas.height).data;
          }));
          let changed=0;for(let i=0;i<decoded[0]!.length;i++)if(decoded[0]![i]!==decoded[1]![i])changed++;
          return {ratio:changed/decoded[0]!.length,corner:[...decoded[1]!.slice(-4)]};
        },[first.toString('base64'),second.toString('base64')]);
        expect(second.readUInt32BE(16)).toBe(first.readUInt32BE(16));
        expect(second.readUInt32BE(20)).toBe(first.readUInt32BE(20));
        expect(pixels.corner).toEqual([255,255,255,255]);
        expect(pixels.ratio).toBeLessThan(0.001);
      }
    });
  });
}
