import { test, expect } from './fixtures';
import { addStickyNote } from './sticky-tool';
import { saveDetailsBoard, addDetailImages, openSaveDetails, saveTrigger } from './save-details-fixtures';
import type { GfxController } from '@blocksuite/affine/std/gfx';
import type { TextElementModel } from '@blocksuite/affine/model';

test.use({ expectErrors: ['the server responded with a status of 503'] });

test('cold pending recovery confirms the complete server document and clears Save failed', async ({ page, baseURL }, testInfo) => {
  await saveDetailsBoard(page, baseURL!); await addDetailImages(page);
  await expect(saveTrigger(page)).toContainText('Saved');
  let fail = true;
  await page.route('**/docs/*/push', route => fail ? route.fulfill({ status: 503, json: { code: 'SYNTHETIC_OUTAGE' } }) : route.continue());
  await addStickyNote(page); await expect(saveTrigger(page)).toContainText('Save failed');
  await page.route('**/docs/*/pull', route => fail ? route.fulfill({ status: 503, json: { code: 'SYNTHETIC_OUTAGE' } }) : route.continue());
  await page.reload(); await expect(page.locator('editor-host')).toBeVisible();
  // Recovery must also finish while the native sync peer is disconnected.
  await page.locator('editor-host').evaluate(el => ((el as import('@blocksuite/affine/std').EditorHost).std.workspace as import('../src/canvas/account/board-workspace').BoardWorkspace).docSync.forceStop());
  await expect(saveTrigger(page)).toContainText('Save failed');
  const details = await openSaveDetails(page);
  await expect(details.getByRole('button', { name: /Select image/ })).toHaveCount(0);
  await expect(details).toContainText('Image uploads are tracked separately from board changes.');
  await expect(details).toContainText("We couldn't confirm that all board changes are saved.");
  await page.screenshot({ path: testInfo.outputPath('save-details-confirmation.png') });
  fail = false; await details.getByRole('button', { name: 'Retry now', exact: true }).click();
  await expect(saveTrigger(page)).toContainText('Saved', { timeout: 25000 });
  await expect(details).toContainText('Last saved to the server:');
  await expect(details).not.toContainText('Image is no longer');
  await page.reload(); await expect(page.locator('affine-edgeless-note')).toHaveCount(1);
  await expect(page.locator('affine-edgeless-image')).toHaveCount(1);
  await expect(saveTrigger(page)).toContainText('Saved');
});

test('text offers bundled fonts and working font style choices with persistence', async ({ page }, testInfo) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Add text', exact: true }).click();
  await page.mouse.move(330, 320); await page.mouse.down(); await page.mouse.move(660, 420, { steps: 6 }); await page.mouse.up();
  await page.keyboard.type('Font style sample'); await page.mouse.click(900, 650); await page.mouse.click(350, 335);
  const font = page.getByRole('combobox', { name: 'Font', exact: true });
  const style = page.getByRole('combobox', { name: 'Font style', exact: true });
  await expect(font.locator('option')).toHaveCount(6);
  await font.selectOption({ label: 'Kalam' }); await expect(style.locator('option')).toHaveCount(2);
  await style.selectOption({ label: 'Bold' });
  await font.selectOption({ label: 'Lora' }); await style.selectOption({ label: 'Bold Italic' });
  const model = () => page.locator('affine-edgeless-root').evaluate(el => {
    const m = (el as HTMLElement & { gfx: GfxController }).gfx.gfxElements.find(m => 'type' in m && m.type === 'text') as TextElementModel;
    return { font: m.fontFamily, weight: m.fontWeight, style: m.fontStyle, width: m.w, height: m.h };
  });
  await expect.poll(model).toMatchObject({ font: 'blocksuite:surface:Lora', weight: '700', style: 'italic' });
  await page.screenshot({ path: testInfo.outputPath('font-style-lora-bold-italic.png') });
  await expect(saveTrigger(page)).toContainText('Saved'); const saved = await model();
  await page.reload(); await expect.poll(model).toEqual(saved);
});
