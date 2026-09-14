import { test, expect } from './fixtures';
import { openMindmapProperties } from './mindmap-properties';
import type { GfxController } from '@blocksuite/affine/std/gfx';
import type { ShapeElementModel } from '@blocksuite/affine/model';

for (const scenario of ['root Enter', 'root Tab', 'child Enter']) test(`new topic inherits selected typography immediately on ${scenario}`, async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Add mind map', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('Central topic');
  await page.keyboard.type('Source topic'); await page.keyboard.press('Enter');
  if (scenario === 'child Enter') { await page.keyboard.press('Tab'); await page.keyboard.type('Source child'); await page.keyboard.press('Enter'); }
  await openMindmapProperties(page);
  await page.getByRole('spinbutton', { name: 'Font size', exact: true }).fill('31');
  await page.getByRole('spinbutton', { name: 'Font size', exact: true }).press('Tab');
  await page.getByRole('combobox', { name: 'Font weight', exact: true }).selectOption('600');
  await page.getByLabel('Text color', { exact: true }).fill('#234567');
  await page.getByRole('button', { name: 'Close mind-map controls', exact: true }).click();
  const source = await page.locator('affine-edgeless-root').evaluate(el => {
    const shape = (el as HTMLElement & { gfx: GfxController }).gfx.selection.selectedElements[0] as ShapeElementModel;
    return { id: shape.id, fontSize: shape.fontSize, fontWeight: shape.fontWeight, color: shape.color, text: shape.text?.toString() };
  });
  await page.keyboard.press(scenario.endsWith('Tab') ? 'Tab' : 'Enter');
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('New topic');
  const read = () => page.locator('affine-edgeless-root').evaluate(el => {
    const shape = (el as HTMLElement & { gfx: GfxController }).gfx.selection.selectedElements[0] as ShapeElementModel;
    return { id: shape.id, fontSize: shape.fontSize, fontWeight: shape.fontWeight, color: shape.color };
  });
  await expect.poll(read).toMatchObject({ fontSize: 31, fontWeight: '600', color: '#234567' });
  expect((await read()).id).not.toBe(source.id);
  await page.keyboard.type('Inherited text'); await page.keyboard.press('Enter');
  await expect.poll(read).toMatchObject({ fontSize: 31, fontWeight: '600', color: '#234567' });
  expect(await page.locator('affine-edgeless-root').evaluate((el, id) => {
    const shape = (el as HTMLElement & { gfx: GfxController }).gfx.getElementById(id) as ShapeElementModel;
    return { id: shape.id, fontSize: shape.fontSize, fontWeight: shape.fontWeight, color: shape.color, text: shape.text?.toString() };
  }, source.id)).toEqual(source);
});

for (const exit of ['Enter', 'Escape']) test(`edited topic retains typography through ${exit}`, async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add mind map', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('Central topic');
  await page.keyboard.type('Synthetic topic'); await page.keyboard.press('Enter');
  await openMindmapProperties(page);
  await page.getByRole('spinbutton', { name: 'Font size', exact: true }).fill('31');
  await page.getByRole('spinbutton', { name: 'Font size', exact: true }).press('Tab');
  await page.getByRole('combobox', { name: 'Font weight', exact: true }).selectOption('400');
  await page.getByLabel('Text color', { exact: true }).fill('#234567');
  await page.getByRole('button', { name: 'Close mind-map controls', exact: true }).click();
  const read = () => page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const shape = gfx.selection.selectedElements[0] as ShapeElementModel;
    return { fontSize: shape.fontSize, fontWeight: shape.fontWeight, color: shape.color, text: shape.text?.toString() };
  });
  await expect.poll(read).toMatchObject({ fontSize: 31, fontWeight: '400', color: '#234567' });
  const center = await page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const b = gfx.viewport.toViewBound(gfx.selection.selectedElements[0]!.elementBound);
    const h = el.closest('editor-host')!.getBoundingClientRect();
    return { x: b.x + h.x + b.w / 2, y: b.y + h.y + b.h / 2 };
  });
  await page.mouse.dblclick(center.x, center.y);
  await expect(page.locator('edgeless-shape-text-editor [contenteditable="true"]')).toBeVisible();
  await expect.poll(read).toMatchObject({ fontSize: 31, fontWeight: '400', color: '#234567' });
  await page.keyboard.press('ControlOrMeta+a'); await page.keyboard.type('Edited synthetic topic');
  await page.keyboard.press('ControlOrMeta+a'); await page.keyboard.press('ControlOrMeta+b');
  const delta = await page.locator('affine-edgeless-root').evaluate(el =>
    ((el as HTMLElement & { gfx: GfxController }).gfx.selection.selectedElements[0] as ShapeElementModel).text?.toDelta());
  await page.keyboard.press(exit);
  await expect(page.locator('edgeless-shape-text-editor')).toHaveCount(0);
  await expect.poll(read).toEqual({ fontSize: 31, fontWeight: '400', color: '#234567', text: 'Edited synthetic topic' });
  expect(await page.locator('affine-edgeless-root').evaluate(el =>
    ((el as HTMLElement & { gfx: GfxController }).gfx.selection.selectedElements[0] as ShapeElementModel).text?.toDelta())).toEqual(delta);
});
