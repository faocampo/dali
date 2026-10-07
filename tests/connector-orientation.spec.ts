import { test, expect } from './fixtures';
import type { GfxController } from '@blocksuite/affine/std/gfx';
import type { ConnectorElementModel } from '@blocksuite/affine/model';

for (const [name, mode] of [['straight', 0], ['angled', 1], ['curved', 2]] as const) {
  test(`${name} connector text orientation persists and matches rendered and editable text`, async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      const original = CanvasRenderingContext2D.prototype.fillText;
      const evidence = window as unknown as { labelAngles: number[] }; evidence.labelAngles = [];
      CanvasRenderingContext2D.prototype.fillText = function(...args: Parameters<typeof original>) {
        if (args[0] === 'Release plan') { const m = this.getTransform(); evidence.labelAngles.push(Math.atan2(m.b, m.a) * 180 / Math.PI); evidence.labelAngles = evidence.labelAngles.slice(-30); }
        return original.apply(this, args);
      };
    });
    await page.goto('/');
    await page.locator('affine-edgeless-root').evaluate((element, mode) => {
      const gfx = (element as HTMLElement & { gfx: GfxController }).gfx;
      const id = gfx.surface!.addElement({ type: 'connector', source: { position: [350, 250] }, target: { position: [650, 650] }, mode, text: 'Release plan', labelXYWH: [0, 0, 16, 16] });
      gfx.selection.set({ elements: [id], editing: false });
    }, mode);
    const state = () => page.locator('affine-edgeless-root').evaluate(element => {
      const gfx = (element as HTMLElement & { gfx: GfxController }).gfx;
      const model = gfx.gfxElements.find(m => 'type' in m && m.type === 'connector') as ConnectorElementModel;
      const center = model.getPointByOffsetDistance(model.labelOffset.distance);
      const a = model.getPointByOffsetDistance(Math.max(0, model.labelOffset.distance - .001));
      const b = model.getPointByOffsetDistance(Math.min(1, model.labelOffset.distance + .001));
      let angle = Math.atan2(b[1]! - a[1]!, b[0]! - a[0]!) * 180 / Math.PI;
      if (angle > 90) angle -= 180; if (angle < -90) angle += 180;
      const [x, y] = gfx.viewport.toViewCoord(center[0]!, center[1]!); const rect = element.getBoundingClientRect();
      return { orientation: (model.labelStyle as { orientation?: string }).orientation ?? 'screen', angle, x: x + rect.left, y: y + rect.top, bounds: model.labelXYWH };
    });
    const control = page.getByRole('combobox', { name: 'Text orientation', exact: true });
    await expect(control).toHaveValue('screen');
    await control.selectOption('line'); await expect.poll(async () => (await state()).orientation).toBe('line');
    const expected = (await state()).angle;
    await expect.poll(() => page.evaluate(() => (window as unknown as { labelAngles: number[] }).labelAngles.at(-1))).toBeCloseTo(expected, 1);
    if (name === 'straight') await page.screenshot({ path: testInfo.outputPath('follow-line.png') });
    await expect(page.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
    await page.reload(); await expect.poll(async () => (await state()).orientation).toBe('line');
    const center = await state(); await page.mouse.dblclick(center.x, center.y);
    const editor = page.locator('edgeless-connector-label-editor .edgeless-connector-label-editor');
    await expect(editor).toBeVisible();
    const editingBounds = await editor.boundingBox();
    expect(Math.abs(editingBounds!.x + editingBounds!.width / 2 - center.x)).toBeLessThan(3);
    expect(Math.abs(editingBounds!.y + editingBounds!.height / 2 - center.y)).toBeLessThan(3);
    if (name === 'straight') await page.screenshot({ path: testInfo.outputPath('editing-follow-line.png') });
    await expect.poll(() => editor.evaluate(el => parseFloat((el as HTMLElement).style.transform.match(/rotate\(([-.\d]+)deg\)/)![1]!))).toBeCloseTo(expected, 1);
    await page.keyboard.press('ControlOrMeta+Enter'); await expect(editor).toHaveCount(0);
    await page.mouse.click(center.x, center.y);
    await expect(control).toHaveValue('line'); await control.selectOption('screen');
    await expect.poll(async () => (await state()).orientation).toBe('screen');
    await expect.poll(() => page.evaluate(() => (window as unknown as { labelAngles: number[] }).labelAngles.at(-1))).toBeCloseTo(0, 1);
  });
}
