import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import type { GfxController } from '@blocksuite/affine/std/gfx';

async function models(page: Page) {
  return page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    return gfx.gfxElements.map(model => ({
      id: model.id, type: 'type' in model ? model.type : model.flavour,
      xywh: model.xywh, text: 'text' in model ? String(model.text ?? '') : '',
    }));
  });
}

async function drag(page: Page, x: number, y: number, dx: number, dy: number) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 12 });
  await page.mouse.up();
}

test('native drawing tools create editable shapes, frames, arrows and freehand', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Frame', exact: true }).click();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Shapes', exact: true })).toBeFocused();
  await page.keyboard.press('Space');
  await page.getByRole('button', { name: 'Square / rectangle', exact: true }).click();
  await drag(page, 240, 180, 160, 100);
  await expect.poll(async () => (await models(page)).filter(m => m.type === 'shape').length).toBe(1);
  const currentShapePoint=()=>page.locator('affine-edgeless-root').evaluate(el=>{
    const gfx=(el as HTMLElement & {gfx:GfxController}).gfx;
    const shape=gfx.gfxElements.find(m=>'type' in m&&m.type==='shape')!;
    const b=shape.elementBound;const [x,y]=gfx.viewport.toViewCoord(b.x+b.w/2,b.y+b.h/2);
    const rect=el.getBoundingClientRect();return {x:x+rect.x,y:y+rect.y};
  });
  const shapeCenter=await currentShapePoint();
  expect(shapeCenter.x).toBeCloseTo(320,0);
  expect(shapeCenter.y).toBeCloseTo(230,0);
  await page.mouse.dblclick(shapeCenter.x, shapeCenter.y);
  await expect(page.locator('edgeless-shape-text-editor')).toHaveCount(1);
  await page.keyboard.insertText('Synthetic shape');
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await models(page)).find(m => m.type === 'shape')?.text).toBe('Synthetic shape');
  await page.getByRole('button', { name: 'Frame', exact: true }).click();
  await drag(page, 450, 180, 200, 150);
  await page.getByRole('button', { name: 'Lines', exact: true }).click();
  await page.getByRole('button', { name: 'Straight arrow', exact: true }).click();
  await drag(page, 260, 380, 200, 50);
  await page.getByRole('button', { name: 'Freehand', exact: true }).click();
  await drag(page, 450, 470, 170, -30);
  await expect.poll(async () => (await models(page)).map(m => m.type).sort()).toEqual(['affine:frame', 'brush', 'connector', 'shape']);
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  const fittedCenter=await currentShapePoint();
  await page.mouse.click(fittedCenter.x, fittedCenter.y);
  await expect(page.getByRole('button', { name: 'Switch shape type', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  const before = await models(page);
  await page.reload();
  await expect(page.getByTestId('board-action-menu')).toBeVisible();
  await expect.poll(() => models(page)).toEqual(before);
});

for (const size of [{ width: 1280, height: 800 }, { width: 900, height: 700 }]) {
  test(`formatted Unicode text and sticky notes preserve editing focus at ${size.width}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/');
    const text = 'Café e\u0301 👩🏽‍💻 🏳️‍🌈';
    await page.getByRole('button', { name: 'Add sticky note', exact: true }).click();
    await page.locator('affine-edgeless-note').dblclick();
    await page.keyboard.insertText(text);
    await page.keyboard.press('ControlOrMeta+b');
    await page.keyboard.insertText(' bold');
    await page.keyboard.press('ControlOrMeta+b');
    await page.keyboard.type('v');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Escape');
    const read = () => page.locator('editor-host').evaluate(el => {
      const store = (el as unknown as import('@blocksuite/affine/std').EditorHost).std.store;
      return store.getBlocksByFlavour('affine:paragraph').map(({ model }) => ({ text: model.text?.toString(), delta: model.text?.toDelta() }));
    });
    await expect.poll(async () => (await read()).map(m => m.text)).toContain(text + ' bold');
    expect(JSON.stringify(await read())).toContain('"bold":true');
    await page.getByRole('button', { name: 'Add text', exact: true }).click();
    await page.keyboard.insertText('Editable text');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
    const before = await read();
    await page.reload();
    await expect(page.getByTestId('board-action-menu')).toBeVisible();
    await expect.poll(read).toEqual(before);
  });
}

test('drawing palette stays on the left at both supported sizes', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('board-action-menu')).toBeVisible();
  for (const viewport of [{ width: 1280, height: 800 }, { width: 900, height: 700 }]) {
    await page.setViewportSize(viewport);
    const palette = page.getByRole('toolbar', { name: 'Drawing and board tools' });
    await expect(palette).toBeVisible();
    await expect.poll(async () => (await palette.boundingBox())!.x).toBeLessThan(120);
    const box = (await palette.boundingBox())!;
    expect(box.width).toBeLessThan(120);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  }
});

test('pointer-centered zoom and space or middle-button panning use native viewport', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('board-action-menu')).toBeVisible();
  const viewport = () => page.locator('affine-edgeless-root').evaluate(el => {
    const { viewport } = (el as HTMLElement & { gfx: GfxController }).gfx;
    const rect = el.getBoundingClientRect();
    return { zoom: viewport.zoom, center: viewport.center, anchor: viewport.toModelCoord(420 - rect.x, 320 - rect.y) };
  });
  const before = await viewport();
  await page.mouse.move(420, 320);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -150);
  await page.keyboard.up('Control');
  await expect.poll(async () => (await viewport()).zoom).toBeGreaterThan(before.zoom);
  const zoomed = await viewport();
  expect(zoomed.anchor[0]).toBeCloseTo(before.anchor[0], 0);
  expect(zoomed.anchor[1]).toBeCloseTo(before.anchor[1], 0);
  await page.keyboard.down('Space');
  await drag(page, 420, 320, 100, 70);
  await page.keyboard.up('Space');
  await expect.poll(async () => (await viewport()).center).not.toEqual(zoomed.center);
  const panned = await viewport();
  await page.mouse.move(420, 320);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(480, 360, { steps: 10 });
  await page.mouse.up({ button: 'middle' });
  await expect.poll(async () => (await viewport()).center).not.toEqual(panned.center);
});

test('pasted HTML stays inert in native rich text', async ({ page, context, browserName }, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add sticky note', exact: true }).click();
  await page.locator('affine-edgeless-note').dblclick();
  const html='<b onclick="document.body.dataset.executed=1">Synthetic markup</b><script>document.body.dataset.executed=1</script>';
  if(browserName==='chromium') {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.evaluate(async html => navigator.clipboard.write([new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob(['Synthetic markup'], { type: 'text/plain' }),
    })]),html);
    await page.keyboard.press('ControlOrMeta+v');
    testInfo.annotations.push({type:'input-evidence',description:'Chromium browser Clipboard API write and native keyboard paste.'});
  } else {
    await page.locator('[contenteditable="true"]').last().evaluate((el,html)=>{
      const data=new DataTransfer();data.setData('text/html',html);data.setData('text/plain','Synthetic markup');
      const event=new ClipboardEvent('paste',{bubbles:true,composed:true,cancelable:true,clipboardData:data});
      Object.defineProperty(event,'clipboardData',{value:data});el.dispatchEvent(event);
    },html);
    testInfo.annotations.push({type:'input-evidence',description:'Constructed paste event validates HTML routing and sanitization; OS clipboard integration remains unverified.'});
  }
  await expect(page.locator('affine-edgeless-note')).toContainText('Synthetic markup');
  expect(await page.locator('body').getAttribute('data-executed')).toBeNull();
  await expect(page.locator('affine-edgeless-note [onclick], affine-edgeless-note script')).toHaveCount(0);
});
