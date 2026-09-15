import { openMindmapProperties } from "./mindmap-properties";
import {test,expect} from './fixtures';
import type {Page} from '@playwright/test';
import type {GfxController} from '@blocksuite/affine/std/gfx';
import type {MindmapElementModel,ShapeElementModel} from '@blocksuite/affine/model';
import {writeFileSync} from 'node:fs';

async function maps(page:Page){
  // Reload briefly overlaps native editor hydration and teardown.
  await expect(page.locator('affine-edgeless-root')).toHaveCount(1);
  return page.locator('affine-edgeless-root').evaluate(el=>{
  const gfx=(el as HTMLElement & {gfx:GfxController}).gfx;
  return gfx.surface!.elementModels.filter(e=>e.type==='mindmap').map(e=>{
    const map=e as MindmapElementModel;return {id:map.id,layout:map.layoutType,style:map.style,nodes:[...map.children].map(([id,detail])=>{
      const s=map.getNode(id)!.element as ShapeElementModel;return {id,...detail,text:s.text?.toString(),size:s.fontSize,weight:s.fontWeight,color:s.color};
    })};
  });
});}
async function selectLayer(page:Page,id:string){
  await page.getByRole('button',{name:'Layers',exact:true}).click();
  await page.locator(`[data-layer-id="${id}"] .layers-list__select`).click();
  await page.getByRole('button',{name:'Close layers',exact:true}).click();
}
async function typeTopic(page:Page,text:string){
  await expect(page.locator('edgeless-shape-text-editor')).toHaveCount(1);
  await page.keyboard.press('ControlOrMeta+a');await page.keyboard.type(text);await page.keyboard.press('Enter');
  await expect(page.locator('edgeless-shape-text-editor')).toHaveCount(0);
}

test('@02-06-03 daily workflow retains formatted collapsed independent maps beside ordinary content',async({page},testInfo)=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Shape',exact:true}).click();
  await page.mouse.move(200,150);await page.mouse.down();await page.mouse.move(300,220,{steps:8});await page.mouse.up();
  await page.getByRole('button',{name:'Arrow / connector',exact:true}).click();
  await page.mouse.move(220,300);await page.mouse.down();await page.mouse.move(330,340,{steps:8});await page.mouse.up();
  const image=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=32;c.height=32;const ctx=c.getContext('2d')!;ctx.fillStyle='#12ab34';ctx.fillRect(0,0,32,32);return c.toDataURL().split(',')[1]!;});
  await page.locator('input[type=file][accept="image/*"]').setInputFiles({name:'synthetic-workflow.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')});
  await expect(page.locator('affine-edgeless-image')).toHaveCount(1);
  await page.getByRole('button',{name:'Add mind map',exact:true}).click();await typeTopic(page,'Daily plan');
  await openMindmapProperties(page);
  await page.getByRole('button',{name:'Add child',exact:true}).click();await typeTopic(page,'Research');
  await openMindmapProperties(page);
  await page.getByRole('button',{name:'Add child',exact:true}).click();
  await page.keyboard.press('ControlOrMeta+a');await page.keyboard.type('Evidence');await page.keyboard.press('Shift+Enter');await page.keyboard.type('Next line');await page.keyboard.press('Enter');
  await expect(page.locator('edgeless-shape-text-editor')).toHaveCount(0);
  await openMindmapProperties(page);
  await page.getByLabel('Font size',{exact:true}).fill('31');await page.getByLabel('Font size',{exact:true}).press('Tab');
  await page.getByRole('combobox',{name:'Font weight',exact:true}).selectOption('700');
  await page.getByLabel('Text color',{exact:true}).fill('#234567');
  const original=(await maps(page))[0]!;const branch=original.nodes.find(n=>n.text==='Research')!;
  await selectLayer(page,branch.id);await page.getByRole('button',{name:'Collapse branch',exact:true}).click();
  await page.getByRole('group',{name:'Mind-map layout',exact:true}).getByRole('button',{name:'Left',exact:true}).click();
  await page.getByRole('button',{name:'Style 3',exact:true}).click();
  const source=(await maps(page))[0]!;
  expect(source.nodes.find(n=>n.text==='Evidence\nNext line')).toMatchObject({size:31,weight:'700',color:'#234567'});
  await selectLayer(page,source.id);
  await page.keyboard.press('ControlOrMeta+d');await expect.poll(async()=> (await maps(page)).length).toBe(2);
  const copy=(await maps(page)).find(m=>m.id!==source.id)!;
  expect(copy.nodes.map(n=>n.text).sort()).toEqual(source.nodes.map(n=>n.text).sort());
  expect(copy.nodes.every(n=>!source.nodes.some(s=>s.id===n.id))).toBe(true);
  await selectLayer(page,copy.nodes.find(n=>!n.parent)!.id);
  await openMindmapProperties(page);
  await page.getByLabel('Font size',{exact:true}).fill('40');await page.getByLabel('Font size',{exact:true}).press('Tab');
  expect((await maps(page)).find(m=>m.id===source.id)).toEqual(source);
  await page.getByRole('button',{name:'Saved locally',exact:true}).waitFor();const saved=await maps(page);
  await page.reload();await expect.poll(()=>maps(page)).toEqual(saved);
  await selectLayer(page,copy.id);
  await page.getByRole('button',{name: 'Export board', exact: true}).click();await page.getByRole('radio',{name:'PNG image'}).check();
  await page.locator('input[name="export-scope"][value="selection"]').check();
  await expect(page.getByText('Only visible topics are exported. Expand branches to include their hidden topics.',{exact:true})).toBeVisible();
  const members=JSON.parse((await page.getByTestId('export-dimensions').getAttribute('data-export-ids'))!);
  expect(members).toHaveLength(2);expect(members.every((id:string)=>copy.nodes.some(n=>n.id===id))).toBe(true);
  const pending=page.waitForEvent('download');await page.getByRole('dialog').getByRole('button',{name:'Download',exact:true}).click();
  const download=await pending;expect(await download.failure()).toBeNull();const chunks:Buffer[]=[];for await(const chunk of (await download.createReadStream())!)chunks.push(Buffer.from(chunk));const png=Buffer.concat(chunks);
  const decoded=await page.evaluate(async base64=>{const i=new Image();i.src=`data:image/png;base64,${base64}`;await i.decode();const c=document.createElement('canvas');c.width=i.width;c.height=i.height;const ctx=c.getContext('2d')!;ctx.drawImage(i,0,0);const p=ctx.getImageData(0,0,c.width,c.height).data;let ink=0;for(let n=0;n<p.length;n+=4)if(p[n]!<180&&p[n+1]!<180&&p[n+2]!<180)ink++;return {w:i.width,h:i.height,ink};},png.toString('base64'));
  expect([decoded.w,decoded.h]).toEqual([png.readUInt32BE(16),png.readUInt32BE(20)]);expect(decoded.ink).toBeGreaterThan(20);
  expect(await maps(page)).toEqual(saved);
  await testInfo.attach('synthetic-daily-workflow.png',{body:png,contentType:'image/png'});
  writeFileSync(testInfo.outputPath('synthetic-daily-workflow.png'),png);
});
