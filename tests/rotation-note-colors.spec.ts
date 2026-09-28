import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import type { GfxController } from '@blocksuite/affine/std/gfx';
import type { NoteBlockModel } from '@blocksuite/affine/model';
import type { EditorHost } from '@blocksuite/affine/std';
import { addStickyNote } from './sticky-tool';

test.use({ actionTimeout: 15000 });

const elements = (page: Page) => page.locator('affine-edgeless-root').evaluate(el => {
  const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
  return gfx.gfxElements.filter(m => 'type' in m && ['text', 'shape'].includes(String(m.type))).map(m => ({ id: m.id, rotate: m.rotate, xywh: m.xywh }));
});
const notes = (page: Page) => page.locator('editor-host').evaluate(el =>
  (el as EditorHost).std.store.getBlocksByFlavour('affine:note').map(({ model }) => ({ id: model.id, background: (model as NoteBlockModel).props.background })));

for (const kind of ['text', 'shape']) test(`${kind} corner rotation supports drag, undo, redo and saving`, async ({ page }, info) => {
  await page.goto('/');
  if (kind === 'text') await page.getByRole('button', { name: 'Add text', exact: true }).click();
  else {
    await page.getByRole('button', { name: 'Shapes', exact: true }).click();
    await page.getByRole('dialog', { name: 'Shapes palette' }).getByRole('button', { name: 'Square / rectangle', exact: true }).click();
  }
  await page.mouse.move(350, 330); await page.mouse.down(); await page.mouse.move(630, 460, { steps: 8 }); await page.mouse.up();
  if (kind === 'text') { await page.keyboard.type('Rotate this text'); await page.mouse.click(950, 650); }
  await page.mouse.click(420, 345);
  const grip = page.locator('.handle[aria-label="bottom-right"] .rotate');
  await expect(grip).toHaveAttribute('title', 'Drag to rotate');
  const initial = (await elements(page))[0]!;
  const target = (await grip.boundingBox())!;
  expect(target.width).toBeGreaterThanOrEqual(25);
  await page.screenshot({ path: info.outputPath(`${kind}-rotation-grip.png`) });
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2); await page.mouse.down();
  await page.mouse.move(target.x - 100, target.y + 100, { steps: 12 }); await page.mouse.up();
  await expect.poll(async () => Math.abs((await elements(page))[0]!.rotate)).toBeGreaterThan(10);
  const rotated = (await elements(page))[0]!;
  expect(JSON.parse(rotated.xywh).slice(2)).toEqual(JSON.parse(initial.xywh).slice(2));
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(async () => (await elements(page))[0]?.rotate).toBe(initial.rotate);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect.poll(async () => (await elements(page))[0]?.rotate).toBe(rotated.rotate);
  await expect(page.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
  await page.reload(); await expect.poll(() => elements(page)).toEqual([rotated]);
});

test('note palette selects native colors, remembers choice and persists', async ({ page }, info) => {
  await page.setViewportSize({ width: 707, height: 998 }); await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Add sticky note', exact: true });
  await trigger.click();
  const palette = page.getByRole('dialog', { name: 'Note colors', exact: true });
  await expect(palette).toBeVisible(); expect(await notes(page)).toEqual([]);
  await expect(palette.getByRole('button', { name: 'Yellow note', exact: true })).toBeFocused();
  const bounds = (await palette.boundingBox())!; expect(bounds.x + bounds.width).toBeLessThanOrEqual(707);
  const swatches = await palette.locator('button > span:first-child').evaluateAll(els => els.map(el => getComputedStyle(el).backgroundColor));
  expect(new Set(swatches).size).toBe(8); expect(swatches).not.toContain('rgba(0, 0, 0, 0)');
  await page.screenshot({ path: info.outputPath('note-color-palette.png') });
  await page.keyboard.press('Escape'); await expect(palette).toHaveCount(0); await expect(trigger).toBeFocused(); expect(await notes(page)).toEqual([]);
  await trigger.click(); await page.mouse.click(600, 750); await expect(palette).toHaveCount(0); expect(await notes(page)).toEqual([]);
  await addStickyNote(page, 'Blue'); const blue = await notes(page); expect(blue).toHaveLength(1);
  await trigger.click(); await expect(palette.getByRole('button', { name: 'Blue note', exact: true })).toBeFocused();
  await page.keyboard.press('Home'); await page.keyboard.press('Enter');
  await expect.poll(async () => (await notes(page)).length).toBe(2);
  const saved = await notes(page); expect(saved[0]!.background).not.toEqual(saved[1]!.background);
  await expect(page.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
  await page.reload(); await expect.poll(() => notes(page)).toEqual(saved);
});
