import { test, expect } from './fixtures';
import { fileAction } from './app-menu';
import type { Page } from '@playwright/test';
import type { GfxController } from '@blocksuite/affine/std/gfx';
import type { ShapeElementModel } from '@blocksuite/affine/model';

const editor = (page: Page) => page.locator('edgeless-shape-text-editor [contenteditable="true"]');

async function startTopic(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add mind map', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('Central topic');
}

test('inline topic font matches the canvas fallback while typing and reopening', async ({ page }) => {
  await startTopic(page);
  const font = () => editor(page).evaluate(el => getComputedStyle(el).fontFamily);
  await expect.poll(font).toMatch(/sans-serif$/);
  await page.keyboard.type('Synthetic typography');
  await page.keyboard.press('Enter');
  const center = await page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const shape = gfx.selection.selectedElements[0] as ShapeElementModel;
    shape.fontStyle = 'italic' as ShapeElementModel['fontStyle'];
    const b = gfx.viewport.toViewBound(shape.elementBound);
    const host = el.closest('editor-host')!.getBoundingClientRect();
    return { x: host.x + b.x + b.w / 2, y: host.y + b.y + b.h / 2 };
  });
  await page.mouse.dblclick(center.x, center.y);
  await expect(editor(page)).toBeVisible();
  await expect.poll(font).toMatch(/sans-serif$/);
  await expect(editor(page)).toHaveCSS('font-style', 'italic');
  await page.keyboard.press('Escape');
});

for (const [width, zoom] of [[1280, 0.65], [800, 1.4]] as const) {
  test(`created topics retain focus and center at ${width}px and ${zoom} zoom`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await startTopic(page);
    await page.keyboard.type('Synthetic root'); await page.keyboard.press('Enter');
    await page.locator('affine-edgeless-root').evaluate((el, zoom) => {
      const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
      gfx.viewport.setZoom(zoom);
      gfx.viewport.setCenter(gfx.viewport.center.x - 900, gfx.viewport.center.y + 700);
    }, zoom);
    for (const [index, key] of ['Tab', 'Enter', 'Tab'].entries()) {
      await page.keyboard.press(key);
      await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('New topic');
      await expect.poll(() => page.locator('affine-edgeless-root').evaluate(el => {
        const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
        const b = gfx.viewport.toViewBound(gfx.selection.selectedElements[0]!.elementBound);
        return Math.hypot(b.x + b.w / 2 - gfx.viewport.width / 2, b.y + b.h / 2 - gfx.viewport.height / 2);
      })).toBeLessThan(3);
      await expect(editor(page)).toBeFocused();
      const geometry = await page.locator('affine-edgeless-root').evaluate(el => {
        const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
        const viewport = el.closest('.affine-edgeless-viewport')!;
        return { zoom: gfx.viewport.zoom, scroll: [viewport.scrollLeft, viewport.scrollTop, window.scrollX, window.scrollY] };
      });
      expect(geometry.zoom).toBeCloseTo(zoom);
      expect(geometry.scroll).toEqual([0, 0, 0, 0]);
      await page.keyboard.type(`Created ${index}`);
      await page.keyboard.press('Enter');
      expect(await page.locator('affine-edgeless-root').evaluate(el =>
        ((el as HTMLElement & { gfx: GfxController }).gfx.selection.selectedElements[0] as ShapeElementModel).text?.toString()
      )).toBe(`Created ${index}`);
    }
  });
}

test('File New opens a blank independent board and both tabs survive reload', async ({ page }) => {
  await startTopic(page);
  await page.keyboard.type('Original content'); await page.keyboard.press('Enter');
  await page.getByRole('textbox', { name: 'Board name' }).fill('Original board');
  await page.getByRole('textbox', { name: 'Board name' }).press('Enter');
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  const sourceURL = page.url();
  const popupPromise = page.waitForEvent('popup');
  await fileAction(page, 'New');
  const popup = await popupPromise;
  const popupErrors: string[] = [];
  popup.on('pageerror', error => popupErrors.push(error.message));
  popup.on('console', message => { if (message.type() === 'error') popupErrors.push(message.text()); });
  await expect(popup.locator('affine-edgeless-root')).toHaveCount(1);
  expect(await popup.evaluate(() => window.opener === null)).toBe(true);
  expect(popup.url()).not.toBe(sourceURL);
  const boardId = new URL(popup.url()).searchParams.get('board');
  expect(boardId).toBeTruthy();
  expect(new URL(popup.url()).searchParams.has('new')).toBe(false);
  expect(await popup.locator('affine-edgeless-root').evaluate(el =>
    (el as HTMLElement & { gfx: GfxController }).gfx.surface!.elementModels.length)).toBe(0);
  await popup.getByRole('textbox', { name: 'Board name' }).fill('New board');
  await popup.getByRole('textbox', { name: 'Board name' }).press('Enter');
  await popup.getByRole('button', { name: 'Add mind map', exact: true }).click();
  await expect.poll(() => popup.evaluate(() => window.getSelection()?.toString())).toBe('Central topic');
  await popup.keyboard.type('New content'); await popup.keyboard.press('Enter');
  await expect(popup.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  // The destination updated the shared last-opened preference. Imports must
  // still target the source tab's pinned board and remain isolated on reload.
  const bitmap = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 16; canvas.height = 16;
    canvas.getContext('2d')!.fillRect(0, 0, 16, 16);
    return canvas.toDataURL('image/png').split(',')[1]!;
  });
  await page.locator('input[type=file][accept="image/*"]').setInputFiles({
    name: 'synthetic-tab-image.png', mimeType: 'image/png', buffer: Buffer.from(bitmap, 'base64'),
  });
  await expect(page.locator('affine-edgeless-image')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  await page.reload(); await popup.reload();
  await expect(page.getByRole('textbox', { name: 'Board name' })).toHaveValue('Original board');
  await expect(popup.getByRole('textbox', { name: 'Board name' })).toHaveValue('New board');
  expect(page.url()).toBe(sourceURL);
  expect(new URL(popup.url()).searchParams.get('board')).toBe(boardId);
  for (const [tab, text] of [[page, 'Original content'], [popup, 'New content']] as const) {
    await expect.poll(() => tab.locator('affine-edgeless-root').evaluate(el =>
      (el as HTMLElement & { gfx: GfxController }).gfx.surface!.elementModels
        .filter(e => e.type === 'shape').map(e => (e as ShapeElementModel).text?.toString())
    )).toEqual([text]);
  }
  await expect(page.locator('affine-edgeless-image')).toHaveCount(1);
  await expect(popup.locator('affine-edgeless-image')).toHaveCount(0);
  expect(popupErrors).toEqual([]);
});
