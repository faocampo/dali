import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import type { GfxController } from '@blocksuite/affine/std/gfx';
import type { TextElementModel } from '@blocksuite/affine/model';

test.use({ actionTimeout: 15000 });
const root = (page: Page) => page.locator('affine-edgeless-root');
const editor = (page: Page) => page.locator('edgeless-text-editor [contenteditable="true"]');
const texts = (page: Page) => root(page).evaluate(el => {
  const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
  const r = el.getBoundingClientRect();
  return gfx.gfxElements.filter(m => 'type' in m && m.type === 'text').map(m => {
    const model = m as TextElementModel;
    const p = gfx.viewport.toViewCoord(model.x, model.y);
    const { fontFamily, fontSize, fontWeight, fontStyle, textAlign, color, w, hasMaxWidth } = model;
    return { id: model.id, text: model.text.toString(), fontFamily, fontSize, fontWeight, fontStyle, textAlign, color, w, hasMaxWidth, x: p[0] + r.x, y: p[1] + r.y };
  });
});
async function draw(page: Page, from = [310, 310], to = [610, 420]) {
  await page.mouse.move(from[0]!, from[1]!); await page.mouse.down();
  await page.mouse.move(to[0]!, to[1]!, { steps: 8 }); await page.mouse.up();
  await expect(editor(page)).toBeFocused();
}

test('draws before creation, focuses a visible caret, wraps, reopens and persists text', async ({ page }, info) => {
  await page.goto('/');
  const button = page.getByRole('button', { name: 'Add text', exact: true });
  await button.click(); await expect(button).toHaveAttribute('aria-pressed', 'true');
  expect(await texts(page)).toEqual([]);
  await page.mouse.move(310, 310); await page.mouse.down(); await page.mouse.move(610, 420, { steps: 8 });
  await expect(page.locator('.text-box-preview')).toBeVisible();
  expect(await texts(page)).toEqual([]);
  const preview = (await page.locator('.text-box-preview').boundingBox())!;
  expect(preview.x).toBeCloseTo(310, 0); expect(preview.y).toBeCloseTo(310, 0);
  expect(preview.width).toBeCloseTo(300, 0);
  await page.mouse.up();
  await expect(page.locator('.text-box-preview')).toHaveCount(0);
  await expect(editor(page)).toBeFocused();
  await page.keyboard.type('A text box placed by drawing, with wrapping words.');
  await expect.poll(async () => (await texts(page))[0]?.text).toBe('A text box placed by drawing, with wrapping words.');
  await expect(editor(page)).not.toHaveCSS('caret-color', 'rgba(0, 0, 0, 0)');
  const state = (await texts(page))[0]!;
  expect(state.hasMaxWidth).toBe(true); expect(state.w).toBeCloseTo(300, 0);
  expect(state.x).toBeCloseTo(310, 0); expect(state.y).toBeCloseTo(310, 0);
  await page.screenshot({ path: info.outputPath('drawn-text-editing.png') });
  await page.mouse.click(850, 650); await expect(editor(page)).toHaveCount(0);
  await page.mouse.dblclick(state.x + 20, state.y + 20);
  await expect(editor(page)).toBeFocused();
  await page.keyboard.press('ControlOrMeta+End'); await page.keyboard.type(' Reopened.');
  await page.mouse.click(850, 650);
  await expect.poll(async () => (await texts(page))[0]?.text).toContain('Reopened.');
  await expect(page.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
  const saved = await texts(page); await page.reload();
  await expect.poll(async () => (await texts(page)).map(t => [t.id, t.text, t.w])).toEqual(saved.map(t => [t.id, t.text, t.w]));
});

test('reuses locally selected typography, color and alignment with the T shortcut', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Add text', exact: true }).click();
  await draw(page); await page.keyboard.type('Styled text'); await page.mouse.click(900, 650);
  const initial = (await texts(page))[0]!;
  await page.mouse.click(initial.x + 20, initial.y + 20);
  await page.getByRole('combobox', { name: 'Font', exact: true }).selectOption({ label: 'Kalam' });
  await page.getByRole('spinbutton', { name: 'Font size', exact: true }).fill('12');
  await page.getByRole('spinbutton', { name: 'Font size', exact: true }).press('Enter');
  await page.getByRole('button', { name: 'Alignment', exact: true }).click();
  await page.getByRole('button', { name: 'Right', exact: true }).click();
  await page.getByRole('button', { name: 'Text color', exact: true }).click();
  await page.locator('edgeless-color-picker-button.text-color edgeless-color-button').nth(12).click();
  const styled = (await texts(page))[0]!;
  expect(styled.fontSize).toBe(12); expect(styled.fontFamily).toContain('Kalam'); expect(styled.textAlign).toBe('right');
  expect(styled.color).not.toEqual(initial.color);
  await page.mouse.click(900, 650); await page.keyboard.press('t');
  await expect(page.getByRole('button', { name: 'Add text', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await draw(page, [750, 500], [1050, 600]); await page.keyboard.type('Next text');
  const next = (await texts(page)).find(t => t.id !== styled.id)!;
  for (const key of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'textAlign', 'color'] as const) expect(next[key], key).toEqual(styled[key]);
});

test('reverse drag respects zoom, cancellation adds nothing, and blank drafts disappear', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Zoom, current/ }).click();
  await page.getByRole('menuitemradio', { name: '50%', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Zoom, current 50%', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add text', exact: true }).click();
  await page.mouse.move(600, 480); await page.mouse.down(); await page.mouse.move(350, 320, { steps: 8 });
  await expect(page.locator('.text-box-preview')).toBeVisible(); await page.keyboard.press('Escape'); await page.mouse.up();
  await expect(page.locator('.text-box-preview')).toHaveCount(0); expect(await texts(page)).toEqual([]);
  await page.getByRole('button', { name: 'Add text', exact: true }).click();
  await draw(page, [600, 480], [350, 320]); await page.keyboard.type('Zoomed placement');
  const state = (await texts(page))[0]!;
  expect(state.x).toBeCloseTo(350, 0); expect(state.y).toBeCloseTo(320, 0); expect(state.w).toBeCloseTo(500, 0);
  await page.mouse.click(900, 650);
  await page.getByRole('button', { name: 'Add text', exact: true }).click();
  await draw(page, [750, 400], [1000, 500]);
  await page.mouse.click(900, 650); await expect.poll(async () => (await texts(page)).length).toBe(1);
});

test('click placement supports undo and redo; losing write access during a drag adds no text', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Add text', exact: true }).click();
  await page.mouse.click(320, 300); await expect(editor(page)).toBeFocused();
  await page.keyboard.type('Undoable text'); await page.mouse.click(900, 650);
  const before = await texts(page);
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(async () => (await texts(page)).map(t => t.text)).not.toEqual(['Undoable text']);
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect.poll(async () => (await texts(page)).map(t => [t.id, t.text])).toEqual(before.map(t => [t.id, t.text]));
  await page.getByRole('button', { name: 'Add text', exact: true }).click();
  await page.mouse.move(750, 400); await page.mouse.down(); await page.mouse.move(1000, 500, { steps: 8 });
  await root(page).evaluate(el => { (el as HTMLElement & { gfx: GfxController }).gfx.doc.readonly = true; });
  await page.mouse.up();
  expect((await texts(page)).map(t => t.id)).toEqual(before.map(t => t.id));
  await expect(editor(page)).toHaveCount(0);
});
