import { fileAction } from './app-menu';
import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import type { GfxController } from '@blocksuite/affine/std/gfx';
import { writeFileSync } from 'node:fs';

async function pngDownload(page: Page, scale: 1 | 2 | 4, transparent = true, scope = 'board', padding = 0, expectedIds?: string[]) {
  await fileAction(page, 'Export board');
  await page.getByRole('radio', { name: 'PNG image' }).check();
  await page.locator(`input[name="export-scope"][value="${scope}"]`).check();
  if(scope==='selection') await page.getByLabel('Selection padding').fill(String(padding));
  if(expectedIds) expect(JSON.parse((await page.getByTestId('export-dimensions').getAttribute('data-export-ids'))!)).toEqual(expectedIds);
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
  await page.getByRole('button', { name: 'Saved, Open save details', exact: true }).waitFor();
}

test('selection nested groups exclude overlapping landmarks and support padding at every scale', async ({page}) => {
  await page.goto('/');
  const ids=await page.locator('affine-edgeless-root').evaluate(el=>{
    const gfx=(el as HTMLElement & {gfx:GfxController}).gfx;
    const shape=(xywh:string,color:string)=>gfx.surface!.addElement({type:'shape',xywh,shapeType:'rect',shapeStyle:'General',filled:true,fillColor:color,strokeWidth:0});
    const red=shape('[0,0,100,100]','#ff0000');
    const blue=shape('[100,0,100,100]','#0000ff');
    const inner=gfx.surface!.addElement({type:'group',children:{[red]:true},title:''});
    const outer=gfx.surface!.addElement({type:'group',children:{[inner]:true,[blue]:true},title:''});
    const excluded=shape('[20,20,160,60]','#00ff00');
    gfx.selection.set({elements:[outer],editing:false});
    const expected=gfx.layer.layers.flatMap<{id:string}>(layer=>layer.elements).filter(m=>[red,blue,inner,outer].includes(m.id)).map(m=>m.id);
    return {red,blue,inner,outer,excluded,expected};
  });
  for(const scale of [1,2,4] as const) for(const padding of [0,16]) {
    const png=await pngDownload(page,scale,true,'selection',padding,ids.expected);
    expect([png.readUInt32BE(16),png.readUInt32BE(20)]).toEqual([(200+padding*2)*scale,(100+padding*2)*scale]);
    const colors=await pixelCounts(page,png);
    expect(colors.red).toBeGreaterThan(9000*scale*scale);
    expect(colors.blue).toBeGreaterThan(9000*scale*scale);
    expect(colors.green).toBe(0);
  }
  expect(new Set([ids.red,ids.blue,ids.inner,ids.outer,ids.excluded]).size).toBe(5);
});

test('selection connector membership excludes endpoints and endpoint-only selection excludes the connector',async({page})=>{
  await page.goto('/');
  const ids=await page.locator('affine-edgeless-root').evaluate(el=>{
    const gfx=(el as HTMLElement & {gfx:GfxController}).gfx;
    const a=gfx.surface!.addElement({type:'shape',xywh:'[0,0,50,50]',shapeType:'rect',shapeStyle:'General',filled:true,fillColor:'#ff0000',strokeWidth:0});
    const b=gfx.surface!.addElement({type:'shape',xywh:'[200,0,50,50]',shapeType:'rect',shapeStyle:'General',filled:true,fillColor:'#0000ff',strokeWidth:0});
    const link=gfx.surface!.addElement({type:'connector',source:{id:a,position:[1,0.5]},target:{id:b,position:[0,0.5]},mode:0,stroke:'#00ff00',strokeWidth:3,text:'Link',labelDisplay:true,labelXYWH:[95,10,60,24]});
    gfx.selection.set({elements:[link],editing:false});return {a,b,link};
  });
  let colors=await pixelCounts(page,await pngDownload(page,2,true,'selection',0,[ids.link]));
  expect(colors.red).toBe(0);expect(colors.blue).toBe(0);expect(colors.green).toBeGreaterThan(200);
  for(const elements of [[ids.a,ids.b],[ids.b,ids.a]]) {
    await page.locator('affine-edgeless-root').evaluate((el,elements)=>{(el as HTMLElement & {gfx:GfxController}).gfx.selection.set({elements,editing:false});},elements);
    colors=await pixelCounts(page,await pngDownload(page,1,true,'selection',0,[ids.a,ids.b]));
    expect(colors.red).toBeGreaterThan(2000);expect(colors.blue).toBeGreaterThan(2000);expect(colors.green).toBe(0);
  }
  const groupedIds=await page.locator('affine-edgeless-root').evaluate((el,link)=>{
    const gfx=(el as HTMLElement & {gfx:GfxController}).gfx;
    const group=gfx.surface!.addElement({type:'group',children:{[link]:true},title:''});
    gfx.selection.set({elements:[group],editing:false});
    return gfx.layer.layers.flatMap<{id:string}>(layer=>layer.elements).filter(m=>[group,link].includes(m.id)).map(m=>m.id);
  },ids.link);
  colors=await pixelCounts(page,await pngDownload(page,1,true,'selection',0,groupedIds));
  expect(colors.green).toBeGreaterThan(200);expect(colors.red).toBe(0);expect(colors.blue).toBe(0);
});

async function pixelCounts(page:Page,png:Buffer) {
  return page.evaluate(async base64=>{
    const image=new Image();image.src=`data:image/png;base64,${base64}`;await image.decode();
    const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
    const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0);
    const p=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    const counts={red:0,blue:0,green:0,magenta:0,dark:0};
    for(let i=0;i<p.length;i+=4) {if(p[i+3]!<200)continue;const r=p[i]!,g=p[i+1]!,b=p[i+2]!;
      if(r>220&&g<30&&b<30)counts.red++;if(b>220&&r<30&&g<30)counts.blue++;
      if(g>220&&r<30&&b<30)counts.green++;if(r>220&&b>220&&g<30)counts.magenta++;
      if(r<100&&g<100&&b<100)counts.dark++;
    }return counts;
  },png.toString('base64'));
}

test('frame workflow clips all four edges and preserves picker-imported image pixels',async({page})=>{
  await mixedBoard(page);
  const ids=await page.locator('affine-edgeless-root').evaluate(el=>{
    const gfx=(el as HTMLElement & {gfx:GfxController}).gfx;
    const image=gfx.doc.getBlocksByFlavour('affine:image')[0]!.model;
    for(const model of gfx.gfxElements) if('type' in model && model.type==='shape') gfx.surface!.updateElement(model.id,{xywh:'[500,500,100,100]'});
    gfx.doc.updateBlock(image,{xywh:'[60,40,80,80]'});
    const note=gfx.doc.getBlocksByFlavour('affine:note')[0]!.model;
    gfx.doc.updateBlock(note,{xywh:'[150,60,100,100]'});
    const shape=(xywh:string,color:string,rotate=0)=>gfx.surface!.addElement({type:'shape',xywh,shapeType:'rect',shapeStyle:'General',filled:true,fillColor:color,strokeWidth:0,rotate});
    // Edge-crossing landmarks are added above existing content and below the image DOM layer.
    shape('[-20,-20,240,30]','#ff0000');shape('[-20,150,240,30]','#ff0000');
    shape('[-20,10,30,140]','#0000ff');shape('[190,10,30,140]','#0000ff');
    const touching=shape('[200,20,20,20]','#00ffff');
    const outside=shape('[400,400,30,30]','#00ffff');
    const rotated=shape('[20,60,20,20]','#800080',45);
    const group=gfx.surface!.addElement({type:'group',children:{[rotated]:true,[outside]:true},title:''});
    const frame=gfx.doc.addBlock('affine:frame',{xywh:'[0,0,200,160]'},gfx.surface!.id);
    gfx.selection.set({elements:[frame],editing:false});
    return {frame,touching,outside,image:image.id,group};
  });
  for(const scale of [1,2,4] as const) {
    const png=await pngDownload(page,scale,true,'frame');
    expect([png.readUInt32BE(16),png.readUInt32BE(20)]).toEqual([200*scale,160*scale]);
    const counts=await pixelCounts(page,png);
    expect(counts.green).toBeGreaterThan(4000*scale*scale);expect(counts.magenta).toBeGreaterThan(1400*scale*scale);
    const edges=await page.evaluate(async base64=>{
      const image=new Image();image.src=`data:image/png;base64,${base64}`;await image.decode();
      const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
      const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0);
      return [[canvas.width/2,0],[canvas.width/2,canvas.height-1],[0,canvas.height/2],[canvas.width-1,20*canvas.height/160]].map(([x,y])=>[...ctx.getImageData(x!,y!,1,1).data]);
    },png.toString('base64'));
    expect(edges).toEqual([[255,0,0,255],[255,0,0,255],[0,0,255,255],[0,0,255,255]]);
  }
  await fileAction(page, 'Export board');
  await page.getByRole('radio',{name:'PNG image'}).check();
  await page.locator('input[value="frame"]').check();
  const membership=JSON.parse((await page.getByTestId('export-dimensions').getAttribute('data-export-ids'))!) as string[];
  expect(membership).toContain(ids.image);expect(membership).not.toContain(ids.frame);
  expect(membership).not.toContain(ids.touching);expect(membership).not.toContain(ids.outside);
  await expect(page.getByLabel('Selection padding')).toHaveCount(0);
});

test('frame empty background and unavailable scopes are explained',async({page})=>{
  await page.goto('/');
  await fileAction(page, 'Export board');await page.getByRole('radio',{name:'PNG image'}).check();
  await expect(page.locator('input[value="selection"]')).toBeDisabled();await expect(page.locator('input[value="frame"]')).toBeDisabled();
  await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();
  await page.locator('affine-edgeless-root').evaluate(el=>{
    const gfx=(el as HTMLElement & {gfx:GfxController}).gfx;
    const frame=gfx.doc.addBlock('affine:frame',{xywh:'[0,0,100,80]'},gfx.surface!.id);gfx.selection.set({elements:[frame],editing:false});
  });
  for(const transparent of [false,true]) {
    const png=await pngDownload(page,1,transparent,'frame',0,[]);
    expect([png.readUInt32BE(16),png.readUInt32BE(20)]).toEqual([100,80]);
    const colors=await pixelCounts(page,png);expect(colors).toEqual({red:0,blue:0,green:0,magenta:0,dark:0});
    const sample=await page.evaluate(async base64=>{
      const image=new Image();image.src=`data:image/png;base64,${base64}`;await image.decode();
      const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
      const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0);return [...ctx.getImageData(50,40,1,1).data];
    },png.toString('base64'));
    expect(sample).toEqual(transparent?[0,0,0,0]:[255,255,255,255]);
  }
});

test('frame rejects oversized intermediate objects before allocation and offers explicit lower scale',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Add sticky note',exact:true}).click();
  await page.locator('affine-edgeless-root').evaluate(el=>{
    const gfx=(el as HTMLElement & {gfx:GfxController}).gfx;
    gfx.doc.updateBlock(gfx.doc.getBlocksByFlavour('affine:note')[0]!.model,{xywh:'[0,0,3000,1000]'});
    const frame=gfx.doc.addBlock('affine:frame',{xywh:'[0,0,100,80]'},gfx.surface!.id);gfx.selection.set({elements:[frame],editing:false});
  });
  await fileAction(page, 'Export board');await page.getByRole('radio',{name:'PNG image'}).check();
  await page.locator('input[value="frame"]').check();await page.getByRole('radio',{name:'4×',exact:true}).check();
  await expect(page.getByTestId('export-dimensions')).toHaveText('400 × 320 pixels');
  await expect(page.getByRole('dialog').getByRole('button',{name:'Download',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Use 2×',exact:true}).click();
  expect(await currentDialogDownload(page)).toEqual([200,160]);
});

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
  await page.getByRole('button', { name: 'Shapes', exact: true }).click();
  await page.getByRole('button', { name: 'Square / rectangle', exact: true }).click();
  await page.mouse.move(250, 200);
  await page.mouse.down();
  await page.mouse.move(450, 320, { steps: 10 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Add sticky note', exact: true }).click();
  await page.locator('affine-edgeless-note').dblclick();
  await page.keyboard.insertText('Café Fine text 123');
  await page.keyboard.press('Escape');
  await fileAction(page, 'Export board');
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

async function currentDialogDownload(page: Page) {
  const pending=page.waitForEvent('download');
  await page.getByRole('dialog').getByRole('button',{name:'Download',exact:true}).click();
  const download=await pending;
  expect(await download.failure()).toBeNull();
  const parts:Buffer[]=[];
  for await(const chunk of (await download.createReadStream())!)parts.push(Buffer.from(chunk));
  const png=Buffer.concat(parts);
  expect(png.subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');
  const decoded=await page.evaluate(async base64=>{
    const image=new Image();image.src=`data:image/png;base64,${base64}`;await image.decode();
    return [image.naturalWidth,image.naturalHeight];
  },png.toString('base64'));
  expect(decoded).toEqual([png.readUInt32BE(16),png.readUInt32BE(20)]);
  return decoded;
}

test('limits reject empty and oversized output and require explicit lower scale',async({page})=>{
  await page.goto('/');
  await fileAction(page, 'Export board');
  await page.getByRole('radio',{name:'PNG image'}).check();
  await expect(page.getByRole('dialog').getByRole('button',{name:'Download',exact:true})).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('nothing');
  await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();
  await page.locator('affine-edgeless-root').evaluate(el=>{
    const gfx=(el as HTMLElement & {gfx:GfxController}).gfx;
    gfx.surface!.addElement({type:'shape',xywh:'[0,0,3000,1000]',shapeType:'rect',shapeStyle:'General',filled:true,fillColor:'#ff0000',strokeWidth:1});
  });
  await fileAction(page, 'Export board');
  await page.getByRole('radio',{name:'PNG image'}).check();
  await page.getByRole('radio',{name:'4×',exact:true}).check();
  await expect(page.getByRole('radio',{name:'4×',exact:true})).toBeChecked();
  await expect(page.getByRole('dialog').getByRole('button',{name:'Download',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Use 2×',exact:true}).click();
  await expect(page.getByRole('radio',{name:'2×',exact:true})).toBeChecked();
  const dimensions=await currentDialogDownload(page);
  expect(dimensions).toEqual([6002,2002]);
});

test('limits bounded allocation probes encode the conservative two-layer budget',async({page,browser},testInfo)=>{
  await page.goto('/');
  const probes=await page.evaluate(async()=>{
    const results=[];
    for(const [w,h] of [[1024,1024],[2048,2048],[4096,4096],[8192,2048]]) {
      const layers=[document.createElement('canvas'),document.createElement('canvas')];
      try {
        for(const canvas of layers){canvas.width=w!;canvas.height=h!;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#12ab34';ctx.fillRect(0,0,w!,h!);}
        layers[0]!.getContext('2d')!.drawImage(layers[1]!,0,0);
        const blob=await new Promise<Blob|null>(resolve=>layers[0]!.toBlob(resolve,'image/png'));
        if(!blob)throw new Error('Probe encoding failed');
        const image=await createImageBitmap(blob);
        results.push({width:image.width,height:image.height,bytes:blob.size,peakLayerBytes:w!*h!*8});image.close();
      } finally {for(const canvas of layers){canvas.width=0;canvas.height=0;}}
    }
    return results;
  });
  expect(probes).toHaveLength(4);
  const evidence={browser:browser.version(),probes,policy:'8192 maximum side, 16777216 maximum pixels; conservative tested working budget, not exhaustive browser maximum'};
  writeFileSync(testInfo.outputPath('allocation-probes.json'),JSON.stringify(evidence));
});

for(const fault of ['encoder-null','encoder-throw','tainted','missing-blob','stale','font-timeout','image-timeout'] as const) {
  test(`recovery ${fault} retains controls and downloads decoded pixels on retry`,async({page})=>{
    await mixedBoard(page);
    await fileAction(page, 'Export board');
    await page.getByRole('radio',{name:'PNG image'}).check();
    await page.locator('affine-edgeless-root').evaluate((el,kind)=>{
      const gfx=(el as HTMLElement & {gfx:GfxController}).gfx;
      const state=window as typeof window & {restoreExportFault?:()=>void};
      if(kind==='encoder-null'||kind==='encoder-throw'){
        const original=HTMLCanvasElement.prototype.toBlob;
        HTMLCanvasElement.prototype.toBlob=function(callback){if(kind==='encoder-throw')throw new DOMException('Synthetic origin-clean encoding failure','SecurityError');callback(null);};
        state.restoreExportFault=()=>{HTMLCanvasElement.prototype.toBlob=original;};
      }else if(kind==='tainted'){
        const original=CanvasRenderingContext2D.prototype.getImageData;
        CanvasRenderingContext2D.prototype.getImageData=function(...args:Parameters<typeof original>){if(args[2]===1&&args[3]===1)throw new DOMException('Synthetic origin-clean pixel failure','SecurityError');return original.apply(this,args);};
        state.restoreExportFault=()=>{CanvasRenderingContext2D.prototype.getImageData=original;};
      }else if(kind==='missing-blob'||kind==='image-timeout'){
        const sync=gfx.doc.blobSync;const original=sync.get;
        sync.get=kind==='missing-blob'?async()=>null:()=>new Promise(()=>{});
        state.restoreExportFault=()=>{sync.get=original;};
      }else if(kind==='font-timeout'){
        Object.defineProperty(document.fonts,'ready',{configurable:true,value:new Promise(()=>{})});
        state.restoreExportFault=()=>{delete (document.fonts as unknown as {ready?:unknown}).ready;};
      }else{
        const note=gfx.doc.getBlocksByFlavour('affine:note')[0]!.model;
        gfx.doc.updateBlock(note,{xywh:'[301,0,260,260]'});
        state.restoreExportFault=()=>{};
      }
    },fault);
    let downloads=0;page.on('download',()=>downloads++);
    const button=page.getByRole('dialog').getByRole('button',{name:'Download',exact:true});
    await button.click();
    await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();
    await expect(button).toBeEnabled();
    expect(downloads).toBe(0);
    await page.evaluate(()=>{(window as typeof window & {restoreExportFault:()=>void}).restoreExportFault();});
    await currentDialogDownload(page);
    expect(downloads).toBe(1);
  });
}
