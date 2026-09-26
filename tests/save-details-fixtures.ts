import { expect, type Page } from '@playwright/test';
import type { EditorHost } from '@blocksuite/affine/std';
export { recoveryBoardFixture as saveDetailsBoard } from './recovery-fixtures';

export const saveDetailsFixtures = { title: 'Synthetic save details '.padEnd(200, 'T'), name: 'I'.repeat(120), count: 50, widths: [1440, 900, 600, 490, 320] };
export const saveTrigger = (page: Page) => page.locator('.djai-save__status');
export async function openSaveDetails(page: Page) {
  await saveTrigger(page).click();
  const dialog = page.getByRole('dialog', { name: 'Save details', exact: true });
  await expect(dialog).toBeVisible(); return dialog;
}

export async function addDetailImages(page: Page, count = 1, caption?: string) {
  const files = await page.evaluate(count => Array.from({ length: count }, (_, index) => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 8;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = `rgb(${index + 30},80,140)`; ctx.fillRect(0, 0, 8, 8);
    return canvas.toDataURL().split(',')[1]!;
  }), count);
  await page.locator('input[type=file][accept="image/*"]').setInputFiles(files.map((data, index) => ({ name: `Synthetic ${index + 1}.png`, mimeType: 'image/png', buffer: Buffer.from(data, 'base64') })));
  await expect(page.locator('affine-edgeless-image')).toHaveCount(count);
  if (caption) await page.locator('editor-host').evaluate((el, caption) => {
    const store = (el as EditorHost).store; store.getBlocksByFlavour('affine:image').forEach(({ model }) => store.updateBlock(model, { caption }));
  }, caption);
}
