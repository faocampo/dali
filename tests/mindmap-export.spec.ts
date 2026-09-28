import { addStickyNote } from './sticky-tool';
import { fileAction } from './app-menu';
import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import type { GfxController } from '@blocksuite/affine/std/gfx';
import type { MindmapElementModel } from '@blocksuite/affine/model';
import { writeFileSync } from 'node:fs';

async function seed(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add mind map', exact: true }).click();
  await page.keyboard.press('Escape');
  return page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const map = gfx.surface!.elementModels.find(e => e.type === 'mindmap') as MindmapElementModel;
    const root = map.tree.id;
    const branch = map.addNode(root, undefined, 'after', { text: 'Visible branch' });
    const hidden = map.addNode(branch, undefined, 'after', { text: 'Hidden detail' });
    const sibling = map.addNode(root, undefined, 'after', { text: 'Visible sibling' });
    map.addNode(hidden, undefined, 'after', { text: 'Nested hidden' });
    map.addNode(sibling, undefined, 'after', { text: 'Visible leaf' });
    map.addNode(hidden, undefined, 'after', { text: 'Other hidden' });
    map.children.set(branch, { ...map.children.get(branch)!, collapsed: true });
    map.buildTree(); map.layout();
    // Distant retained hidden geometry must not affect membership or allocation.
    gfx.surface!.updateElement(hidden, { xywh: '[20000,20000,100,40]', fillColor: '#ff00ff', filled: true });
    gfx.selection.set({ elements: [map.id], editing: false });
    return { root, branch, sibling, hidden, map: map.id };
  });
}

async function preview(page: Page, scope = 'board') {
  await fileAction(page, 'Export board');
  await page.getByRole('radio', { name: 'PNG image' }).check();
  await page.locator(`input[name="export-scope"][value="${scope}"]`).check();
  return page.getByTestId('export-dimensions');
}

async function download(page: Page) {
  const pending = page.waitForEvent('download');
  await page.getByRole('dialog').getByRole('button', {name:'Download',exact:true}).click();
  const file = await pending;
  expect(await file.failure()).toBeNull();
  const chunks: Buffer[] = [];
  for await (const chunk of (await file.createReadStream())!) chunks.push(Buffer.from(chunk));
  const png = Buffer.concat(chunks);
  expect(png.subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');
  await page.getByRole('dialog').getByRole('button', {name:'Close',exact:true}).click();
  return png;
}

async function pixels(page: Page, png: Buffer, regions: number[][] = []) {
  return page.evaluate(async ({base64,regions}) => {
    const image = new Image(); image.src = `data:image/png;base64,${base64}`; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width=image.width;canvas.height=image.height;
    const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0);
    const count=(rect:number[])=>{
      const p=ctx.getImageData(rect[0]!,rect[1]!,rect[2]!,rect[3]!).data;
      let opaque=0,magenta=0,dark=0;
      for(let i=0;i<p.length;i+=4)if(p[i+3]!>128){opaque++;if(p[i]!>240&&p[i+1]!<20&&p[i+2]!>240)magenta++;if(p[i]!<100&&p[i+1]!<100&&p[i+2]!<100)dark++;}
      return {opaque,magenta,dark};
    };
    return {width:image.width,height:image.height,all:count([0,0,image.width,image.height]),regions:regions.map(count)};
  }, {base64:png.toString('base64'),regions});
}

test('@02-06-01 hidden distant topics are excluded before board bounds and allocations', async ({ page }) => {
  const ids = await seed(page);
  const before = await page.locator('editor-host').evaluate((host: any) => JSON.stringify(host.store.spaceDoc.toJSON()));
  const dimensions = await preview(page);
  const members = JSON.parse((await dimensions.getAttribute('data-export-ids'))!);
  expect(members).not.toContain(ids.hidden);
  expect(members).toContain(ids.branch);
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Download', exact: true })).toBeEnabled();
  expect(await page.locator('editor-host').evaluate((host: any) => JSON.stringify(host.store.spaceDoc.toJSON()))).toBe(before);
});

test('@02-06-01 board PNG contains native branch pixels without collapsed tails and preserves state', async ({page}, testInfo) => {
  const ids=await seed(page);
  const geometry=await page.locator('affine-edgeless-root').evaluate((el,ids)=>{
    const gfx=(el as HTMLElement & {gfx:GfxController}).gfx;
    const map=gfx.surface!.getElementById(ids.map) as MindmapElementModel;
    const visible=[...map.children.keys()].filter(id=>{
      let parent=map.children.get(id)?.parent;
      while(parent){if(map.children.get(parent)?.collapsed)return false;parent=map.children.get(parent)?.parent;}
      return true;
    }).map(id=>map.getNode(id)!.element);
    visible.forEach(s=>gfx.surface!.updateElement(s.id,{strokeWidth:0}));
    const x=Math.min(...visible.map(s=>s.elementBound.x)),y=Math.min(...visible.map(s=>s.elementBound.y));
    const root=map.getNode(ids.root)!.element, branch=map.getNode(ids.branch)!.element;
    return {x,y,w:Math.max(...visible.map(s=>s.elementBound.maxX))-x,h:Math.max(...visible.map(s=>s.elementBound.maxY))-y,
      gap:[root.elementBound.maxX-x+5,Math.min(root.y,branch.y)-y,branch.x-root.elementBound.maxX-10,Math.max(root.h,branch.y+branch.h-root.y)],
      tail:[branch.elementBound.maxX-x+1,branch.y+branch.h/2-y-2,5,4],doc:JSON.stringify(gfx.doc.spaceDoc.toJSON())};
  },ids);
  await preview(page);await page.getByRole('checkbox',{name:'Transparent background'}).check();
  const png=await download(page);const decoded=await pixels(page,png,[geometry.gap,geometry.tail]);
  expect([decoded.width,decoded.height]).toEqual([Math.ceil(geometry.w),Math.ceil(geometry.h)]);
  expect(decoded.all.magenta).toBe(0);expect(decoded.all.dark).toBeGreaterThan(20);
  expect(decoded.regions[0]!.opaque).toBeGreaterThan(20);expect(decoded.regions[1]!.opaque).toBe(0);
  expect(await page.locator('editor-host').evaluate((host:any)=>JSON.stringify(host.store.spaceDoc.toJSON()))).toBe(geometry.doc);
  await testInfo.attach('synthetic-visible-map.png',{body:png,contentType:'image/png'});
  writeFileSync(testInfo.outputPath('synthetic-visible-map.png'),png);
});

test('@02-06-01 frame crops visible map and crossing content at every edge', async ({page})=>{
  await seed(page);
  await page.locator('affine-edgeless-root').evaluate(el=>{
    const gfx=(el as HTMLElement & {gfx:GfxController}).gfx;
    const shape=(xywh:string,color:string)=>gfx.surface!.addElement({type:'shape',xywh,shapeType:'rect',shapeStyle:'General',filled:true,fillColor:color,strokeWidth:0});
    shape('[-20,-20,240,30]','#ff0000');shape('[-20,150,240,30]','#ff0000');
    shape('[-20,10,30,140]','#0000ff');shape('[190,10,30,140]','#0000ff');
    const frame=gfx.doc.addBlock('affine:frame',{xywh:'[0,0,200,160]'},gfx.surface!.id);gfx.selection.set({elements:[frame],editing:false});
  });
  for(const scale of [1,2,4]) {
    await preview(page,'frame');await page.getByRole('radio',{name:`${scale}×`,exact:true}).check();
    const png=await download(page);const result=await pixels(page,png);
    expect([result.width,result.height]).toEqual([200*scale,160*scale]);
    expect(result.all.magenta).toBe(0);
    const edges=await page.evaluate(async({base64,scale})=>{
      const image=new Image();image.src=`data:image/png;base64,${base64}`;await image.decode();const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d')!;ctx.drawImage(image,0,0);
      return [[100*scale,0],[100*scale,160*scale-1],[0,80*scale],[200*scale-1,20*scale]].map(([x,y])=>[...ctx.getImageData(x!,y!,1,1).data]);
    },{base64:png.toString('base64'),scale});
    expect(edges).toEqual([[255,0,0,255],[255,0,0,255],[0,0,255,255],[0,0,255,255]]);
  }
});

test('@02-06-01 frame includes crossing branch when both topic boxes are outside', async ({page})=>{
  const ids=await seed(page);
  await page.locator('affine-edgeless-root').evaluate((el,ids)=>{
    const gfx=(el as HTMLElement & {gfx:GfxController}).gfx;const map=gfx.surface!.getElementById(ids.map) as MindmapElementModel;
    const root=map.getNode(ids.root)!.element,branch=map.getNode(ids.branch)!.element;
    const x=root.elementBound.maxX+10,w=branch.x-x-10;
    const y=Math.min(root.y,branch.y)-10,h=Math.max(root.y+root.h,branch.y+branch.h)-y+10;
    const frame=gfx.doc.addBlock('affine:frame',{xywh:JSON.stringify([x,y,w,h])},gfx.surface!.id);gfx.selection.set({elements:[frame],editing:false});
  },ids);
  const dimensions=await preview(page,'frame');
  const members=JSON.parse((await dimensions.getAttribute('data-export-ids'))!);
  expect(members).not.toContain(ids.root);expect(members).not.toContain(ids.branch);
  await page.getByRole('checkbox',{name:'Transparent background'}).check();
  const decoded=await pixels(page,await download(page));expect(decoded.all.opaque).toBeGreaterThan(20);
});

test('@02-06-02 selected parent and child include their native edge and exclude overlapping siblings', async ({page})=>{
  const ids=await seed(page);
  const region=await page.locator('affine-edgeless-root').evaluate((el,ids)=>{
    const gfx=(el as HTMLElement & {gfx:GfxController}).gfx;const map=gfx.surface!.getElementById(ids.map) as MindmapElementModel;
    const root=map.getNode(ids.root)!.element,branch=map.getNode(ids.branch)!.element;
    for(const shape of [root,branch])gfx.surface!.updateElement(shape.id,{strokeWidth:0});
    const x=Math.min(root.x,branch.x),y=Math.min(root.y,branch.y);
    gfx.surface!.updateElement(ids.sibling,{xywh:root.xywh,fillColor:'#ff00ff',filled:true});
    gfx.surface!.addElement({type:'shape',xywh:branch.xywh,filled:true,fillColor:'#ff00ff'});
    gfx.selection.set({elements:[ids.root,ids.branch],editing:false});
    return [root.elementBound.maxX-x+5,0,branch.x-root.elementBound.maxX-10,Math.max(root.y+root.h,branch.y+branch.h)-y];
  },ids);
  const dimensions=await preview(page,'selection');
  expect(new Set(JSON.parse((await dimensions.getAttribute('data-export-ids'))!))).toEqual(new Set([ids.root,ids.branch]));
  await page.getByRole('checkbox',{name:'Transparent background'}).check();
  const decoded=await pixels(page,await download(page),[region]);
  expect(decoded.regions[0]!.opaque).toBeGreaterThan(20);
  expect(decoded.all.magenta).toBe(0);
});

for(const selection of ['single','subtree','map','mixed'] as const) test(`@02-06-02 ${selection} membership keeps exact visible identity order`,async({page})=>{
  const ids=await seed(page);
  const expected=await page.locator('affine-edgeless-root').evaluate((el,{ids,selection})=>{
    const gfx=(el as HTMLElement & {gfx:GfxController}).gfx;const map=gfx.surface!.getElementById(ids.map) as MindmapElementModel;
    const visible=[...map.children.keys()].filter(id=>{let p=map.children.get(id)?.parent;while(p){if(map.children.get(p)?.collapsed)return false;p=map.children.get(p)?.parent;}return true;});
    let selected=selection==='single'?[ids.branch]:selection==='subtree'?[ids.sibling,...map.getNode(ids.sibling)!.children.map(n=>n.id)]:[ids.map];
    let authorized=selection==='map'||selection==='mixed'?visible:[...selected];
    if(selection==='mixed'){
      const shape=gfx.surface!.addElement({type:'shape',xywh:'[-400,0,80,40]',filled:true,fillColor:'#ff0000'});
      const connector=gfx.surface!.addElement({type:'connector',source:{position:[-400,60]},target:{position:[-300,80]},stroke:'#ff0000',strokeWidth:2});
      const group=gfx.surface!.addElement({type:'group',children:{[shape]:true},title:''});
      selected=[...selected,group,connector];authorized=[...authorized,group,shape,connector];
    }
    gfx.selection.set({elements:selected,editing:false});
    return gfx.layer.layers.flatMap<{id:string}>(layer=>layer.elements).filter(m=>authorized.includes(m.id)).map(m=>m.id);
  },{ids,selection});
  const dimensions=await preview(page,'selection');
  expect(JSON.parse((await dimensions.getAttribute('data-export-ids'))!)).toEqual(expected);
  expect(new Set(expected).size).toBe(expected.length);
  await page.getByRole('checkbox',{name:'Transparent background'}).check();
  const decoded=await pixels(page,await download(page));expect(decoded.all.opaque).toBeGreaterThan(20);expect(decoded.all.magenta).toBe(0);
});

test('@02-06-03 collapsed export hint reflects selected scope and settings decode faithfully',async({page})=>{
  const ids=await seed(page);
  await preview(page,'selection');
  await expect(page.getByText('Only visible topics are exported. Expand branches to include their hidden topics.',{exact:true})).toBeVisible();
  await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();
  await page.locator('affine-edgeless-root').evaluate((el,id)=>{
    const gfx=(el as HTMLElement & {gfx:GfxController}).gfx;gfx.selection.set({elements:[id],editing:false});
  },ids.sibling);
  for(const scale of [1,2,4])for(const transparent of [false,true]){
    await preview(page,'selection');
    await expect(page.getByText('Only visible topics are exported. Expand branches to include their hidden topics.',{exact:true})).toHaveCount(0);
    await page.getByLabel('Selection padding').fill('16');
    await page.getByRole('radio',{name:`${scale}×`,exact:true}).check();await page.getByRole('checkbox',{name:'Transparent background'}).setChecked(transparent);
    const expected=(await page.getByTestId('export-dimensions').textContent())!;
    const png=await download(page);const decoded=await pixels(page,png);expect(expected).toContain(`${decoded.width} × ${decoded.height}`);
    const corner=await page.evaluate(async base64=>{const i=new Image();i.src=`data:image/png;base64,${base64}`;await i.decode();const c=document.createElement('canvas');c.width=i.width;c.height=i.height;const ctx=c.getContext('2d')!;ctx.drawImage(i,0,0);return [...ctx.getImageData(0,0,1,1).data];},png.toString('base64'));
    expect(corner).toEqual(transparent?[0,0,0,0]:[255,255,255,255]);
  }
});

test('@02-06-03 stale map edits reject download and explicit retry uses current content',async({page})=>{
  const ids=await seed(page);await preview(page,'selection');
  await page.locator('affine-edgeless-root').evaluate((el,id)=>{
    const gfx=(el as HTMLElement & {gfx:GfxController}).gfx;gfx.surface!.updateElement(id,{fontSize:32});
  },ids.root);
  let downloads=0;page.on('download',()=>downloads++);
  await page.getByRole('dialog').getByRole('button',{name:'Download',exact:true}).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('changed');expect(downloads).toBe(0);
  const decoded=await pixels(page,await download(page));expect(decoded.all.opaque).toBeGreaterThan(20);expect(downloads).toBe(1);
});

test('@02-06-03 visible oversized content blocks allocation and requires explicit lower scale',async({page})=>{
  await seed(page);await addStickyNote(page);await page.keyboard.press('Escape');
  await page.locator('affine-edgeless-root').evaluate(el=>{
    const gfx=(el as HTMLElement & {gfx:GfxController}).gfx;
    gfx.doc.updateBlock(gfx.doc.getBlocksByFlavour('affine:note')[0]!.model,{xywh:'[0,0,3000,1000]'});
    const frame=gfx.doc.addBlock('affine:frame',{xywh:'[0,0,100,80]'},gfx.surface!.id);gfx.selection.set({elements:[frame],editing:false});
  });
  await preview(page,'frame');await page.getByRole('radio',{name:'4×',exact:true}).check();
  let downloads=0;page.on('download',()=>downloads++);
  await expect(page.getByRole('dialog').getByRole('button',{name:'Download',exact:true})).toBeDisabled();
  await expect(page.getByRole('radio',{name:'4×',exact:true})).toBeChecked();expect(downloads).toBe(0);
  await page.getByRole('button',{name:'Use 2×',exact:true}).click();
  const png=await download(page);const decoded=await pixels(page,png);expect([decoded.width,decoded.height]).toEqual([200,160]);expect(downloads).toBe(1);
});
