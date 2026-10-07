import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import type { GfxController } from '@blocksuite/affine/std/gfx';
import type { ConnectorElementModel } from '@blocksuite/affine/model';

async function labels(page: Page) {
  return page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    return gfx.gfxElements.filter(m => 'type' in m && m.type === 'connector').map(m => {
      const model = m as ConnectorElementModel;
      return { id: model.id, text: model.text?.toString(), bounds: model.labelXYWH, constraints: model.labelConstraints, style: model.labelStyle };
    });
  });
}

for (const [name, mode] of [['straight', 0], ['angled', 1], ['curved', 2]] as const) {
  test(`${name} connector label wraps and unwraps with path length and preserves history`, async ({ page }) => {
    await page.goto('/');
    await page.locator('affine-edgeless-root').evaluate((el, mode) => {
      const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
      gfx.surface!.addElement({ type: 'connector', source: { position: [300, 300] }, target: { position: [390, 340] }, mode, text: 'Plan the next release together', labelXYWH: [330, 300, 16, 16] });
    }, mode);
    await expect.poll(async () => (await labels(page))[0]?.bounds?.[3]).toBeGreaterThan(40);
    const short = (await labels(page))[0]!;
    await page.locator('affine-edgeless-root').evaluate(el => {
      const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
      const model = gfx.gfxElements.find(m => 'type' in m && m.type === 'connector')!;
      gfx.doc.resetHistory();
      gfx.doc.captureSync();
      gfx.surface!.updateElement(model.id, { target: { position: [950, 340] } });
    });
    await expect.poll(async () => (await labels(page))[0]?.bounds?.[3]).toBeLessThan(30);
    const long = (await labels(page))[0]!;
    expect(long.bounds![2]).toBeGreaterThan(short.bounds![2] * 2);
    expect(long.text).toBe(short.text); expect(long.style).toEqual(short.style);
    await page.locator('affine-edgeless-root').evaluate(el => (el as HTMLElement & { gfx: GfxController }).gfx.doc.undo());
    await expect.poll(async () => (await labels(page))[0]?.bounds?.[3]).toBeGreaterThan(40);
    await page.locator('affine-edgeless-root').evaluate(el => (el as HTMLElement & { gfx: GfxController }).gfx.doc.redo());
    await expect.poll(async () => (await labels(page))[0]?.bounds?.[3]).toBeLessThan(30);
    await page.getByRole('button', { name: 'Saved, Open save details', exact: true }).waitFor();
    await page.reload();
    await expect.poll(async () => (await labels(page))[0]?.bounds).toEqual(long.bounds);
  });
}

test('typing a connector label uses matching font and avoids viewport-edge wrapping', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Lines', exact: true }).click();
  await page.getByRole('button', { name: 'Straight arrow', exact: true }).click();
  await page.mouse.move(400, 320); await page.mouse.down(); await page.mouse.move(1050, 320, { steps: 8 }); await page.mouse.up();
  await page.mouse.dblclick(725, 320);
  const editor = page.locator('edgeless-connector-label-editor');
  await expect(editor.locator('.edgeless-connector-label-editor')).toBeVisible();
  await page.keyboard.type('Release plan');
  await expect.poll(async () => (await labels(page))[0]?.text).toBe('Release plan');
  const rich = editor.locator('rich-text');
  expect(await rich.evaluate(el => getComputedStyle(el).fontFamily)).toContain('Inter');
  await page.keyboard.press('ControlOrMeta+Enter');
  await expect(editor).toHaveCount(0);
  await expect.poll(async () => (await labels(page))[0]?.bounds?.[3]).toBeLessThan(30);
  await page.screenshot({ path: testInfo.outputPath('connector-label.png') });
});

test('label layout retains explicit line breaks and stays stable under zoom', async ({ page }) => {
  await page.goto('/');
  await page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const id = gfx.surface!.addElement({ type: 'connector', source: { position: [250, 250] }, target: { position: [1100, 350] }, mode: 2, text: 'Release\nplan', labelXYWH: [0, 0, 16, 16] });
    const model = gfx.surface!.getElementById(id) as ConnectorElementModel;
    model.labelStyle = { ...model.labelStyle, fontSize: 24, fontWeight: '700' as typeof model.labelStyle.fontWeight, color: '#6030b0' };
  });
  await expect.poll(async () => (await labels(page))[0]?.bounds?.[2]).toBeGreaterThan(70);
  const before = (await labels(page))[0]!;
  expect(before.bounds![3]).toBeGreaterThan(45);
  expect(before.text).toBe('Release\nplan');
  await page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    gfx.viewport.setZoom(.5); gfx.viewport.setCenter(700, 300);
  });
  expect((await labels(page))[0]).toEqual(before);
  await page.reload();
  await expect.poll(async () => (await labels(page))[0]).toEqual(before);
});

for (const timeout of [false, true]) test(`slow bundled fonts preserve connector geometry${timeout ? ' after timeout and retry' : ' on reload'}`, async ({ page }) => {
  // Install before the editor creates RxJS/native timers so cancellation uses
  // the same clock that scheduled each action throughout navigation.
  if (timeout) await page.clock.install();
  await page.goto('/');
  await page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    gfx.surface!.addElement({ type: 'connector', source: { position: [250, 250] }, target: { position: [1000, 350] }, mode: 0, text: 'Release\nplan', labelXYWH: [0, 0, 16, 16] });
  });
  await expect.poll(async () => (await labels(page))[0]?.bounds?.[3]).toBeGreaterThan(30);
  await page.getByRole('button', { name: 'Saved, Open save details', exact: true }).waitFor();
  const before = (await labels(page))[0]!;
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let requests = 0;
  await page.route('**/*.ttf*', async route => {
    if (route.request().resourceType() === 'font') { requests++; await held; }
    await route.continue();
  });
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => requests).toBeGreaterThan(0);
    await expect(page.getByText('Opening board…', { exact: true })).toBeVisible();
    await expect(page.locator('editor-host')).toHaveCount(0);
    if (timeout) {
      await page.clock.fastForward(15_001);
      await expect(page.getByRole('heading', { name: 'The canvas could not start' })).toBeVisible();
      await expect(page.getByText('Canvas fonts could not be loaded. Please try opening the board again.', { exact: true })).toBeVisible();
      await expect(page.locator('editor-host')).toHaveCount(0);
    }
    release();
    if (timeout) { await page.clock.resume(); await page.getByRole('button', { name: 'Try again', exact: true }).click(); }
    await expect.poll(async () => (await labels(page))[0]).toEqual(before);
  } finally { release(); }
});
