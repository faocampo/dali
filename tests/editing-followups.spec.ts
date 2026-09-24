import { test, expect } from './fixtures';
import type { GfxController } from '@blocksuite/affine/std/gfx';
import type { ShapeElementModel } from '@blocksuite/affine/model';

test.use({ actionTimeout: 15000 });
const root = (page: import('@playwright/test').Page) => page.locator('affine-edgeless-root');
async function draw(page: import('@playwright/test').Page, x = 300, y = 300, shape = 'Square / rectangle') {
  await page.getByRole('button', { name: 'Shapes', exact: true }).click();
  await page.getByRole('button', { name: shape, exact: true }).click();
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 160, y + 120, { steps: 5 }); await page.mouse.up();
}

test('zoom popup survives pointer travel and shortcuts fit selection or reset zoom', async ({ page }) => {
  await page.goto('/'); await draw(page);
  const trigger = page.getByRole('button', { name: /^Zoom, current/ });
  await trigger.click();
  const box = (await trigger.boundingBox())!;
  const option = page.getByRole('menuitemradio', { name: '200%', exact: true });
  const target = (await option.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y - 6, { steps: 10 });
  await page.mouse.move(target.x + 30, target.y + target.height / 2, { steps: 10 });
  await expect(option).toBeVisible(); await option.click();
  await expect(trigger).toHaveText('200%');
  await page.keyboard.press('Control+0'); await expect(trigger).toHaveText('100%');
  await page.keyboard.press('Control+1');
  await expect.poll(async () => Number((await trigger.textContent())!.replace('%', ''))).toBeGreaterThan(100);
  await page.keyboard.press('Control+0'); await expect(trigger).toHaveText('100%');
});

test('custom fill applies on blur and new shapes inherit that color', async ({ page }, info) => {
  await page.goto('/'); await draw(page);
  await page.locator('edgeless-shape-color-picker editor-menu-button > editor-icon-button').click();
  await page.locator('edgeless-shape-color-picker edgeless-color-custom-button').first().click();
  const picker = page.locator('edgeless-color-picker');
  await expect(picker.locator('.modes')).toBeHidden();
  const hex = picker.locator('.field.color input');
  await hex.fill('239f85'); await hex.press('Tab');
  const colors = () => root(page).evaluate(el => (el as HTMLElement & { gfx: GfxController }).gfx.gfxElements.filter(m => 'type' in m && m.type === 'shape').map(m => (m as ShapeElementModel).fillColor));
  await expect.poll(async () => JSON.stringify(await colors())).toContain('239f85');
  const beforeDrag = JSON.stringify(await colors());
  await picker.locator('.color-palette').click({ position: { x: 50, y: 35 } });
  await expect.poll(async () => JSON.stringify(await colors())).not.toBe(beforeDrag);
  await page.mouse.click(850, 650);
  await page.screenshot({ path: info.outputPath('custom-fill.png') });
  await draw(page, 620, 330, 'Circle / ellipse');
  const result = await colors(); expect(result).toHaveLength(2); expect(result[1]).toEqual(result[0]);
});

test('blank note area focuses text and shape text has a visible editable caret', async ({ page }, info) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add sticky note', exact: true }).click();
  const note = page.locator('affine-edgeless-note');
  await note.dblclick({ position: { x: 90, y: 180 } }); await page.keyboard.type('Focused note');
  await expect(note).toContainText('Focused note'); await page.keyboard.press('Escape');
  await page.mouse.click(1000, 650);
  await draw(page, 250, 250); await page.mouse.dblclick(330, 310);
  await expect(page.locator('edgeless-shape-text-editor')).toHaveCount(1);
  await page.keyboard.insertText('Visible caret');
  const richText = page.locator('edgeless-shape-text-editor rich-text');
  await expect(richText).toContainText('Visible caret');
  expect(await richText.evaluate(el => getComputedStyle(el).getPropertyValue('user-select') || getComputedStyle(el).getPropertyValue('-webkit-user-select'))).toBe('text');
  const caret = await richText.evaluate(el => ({ color: getComputedStyle(el).caretColor, range: (el as any).inlineEditor?.getInlineRange() }));
  expect(caret.color).not.toBe('rgba(0, 0, 0, 0)'); expect(caret.range.length).toBe(0);
  await page.screenshot({ caret: 'initial', path: info.outputPath('text-caret.png') });
});

test('line tool previews native connection points before drawing', async ({ page }) => {
  await page.goto('/'); await draw(page);
  await page.getByRole('button', { name: 'Lines', exact: true }).click();
  await page.getByRole('button', { name: 'Straight line', exact: true }).click();
  await page.mouse.move(300, 360, { steps: 5 });
  const points = () => root(page).evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    return (gfx.tool.currentTool$.peek() as any)?._overlay?.points?.length ?? 0;
  });
  await expect.poll(points).toBeGreaterThan(0);
  await page.mouse.move(900, 600, { steps: 5 }); await expect.poll(points).toBe(0);
});
