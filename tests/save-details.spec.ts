import { test, expect } from '@playwright/test';
import { saveDetailsBoard, openSaveDetails, saveTrigger, addDetailImages } from './save-details-fixtures';
import { documentResponseBarrier } from './save-status-fixtures';
import { recoveryAuthorizationBarrier } from './recovery-archive-fixtures';
import { journalRows, nativeRecoveryModel } from './recovery-fixtures';
import type { EditorHost } from '@blocksuite/affine/std';
import { randomUUID } from 'node:crypto';

test('@04-07-01 saved empty board opens named details with keyboard focus and acknowledged time', async ({ page, baseURL }) => {
  await saveDetailsBoard(page, baseURL!);
  await expect(saveTrigger(page)).toContainText('Saved');
  const dialog = await openSaveDetails(page);
  await expect(dialog.getByRole('heading', { name: 'Save details' })).toBeFocused();
  await expect(dialog).toContainText('All changes and images are saved to the server.');
  await expect(dialog).toContainText('Last saved to the server:');
  await expect(dialog.getByRole('list')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Retry now' })).toHaveCount(0);
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(saveTrigger(page)).toBeFocused();
});

test('@04-07-01 pending details preserve age and focus through acknowledgement and light dismissal', async ({ page, baseURL }) => {
  await saveDetailsBoard(page, baseURL!); await expect(saveTrigger(page)).toContainText('Saved');
  const age = await saveTrigger(page).getAttribute('title'); const barrier = await documentResponseBarrier(page);
  await page.getByRole('button', { name: 'Add sticky note', exact: true }).click(); await expect.poll(barrier.held).toBeGreaterThan(0);
  const dialog = await openSaveDetails(page); await expect(dialog).toContainText('Last saved to the server:');
  expect(await saveTrigger(page).getAttribute('title')).toBe(age);
  const close = dialog.getByRole('button', { name: 'Close save details' }); await close.focus();
  await barrier.releaseAll(); await expect(saveTrigger(page)).toContainText('Saved'); await expect(close).toBeFocused();
  await close.click(); await expect(saveTrigger(page)).toBeFocused(); await saveTrigger(page).press('Space');
  await expect(dialog).toBeVisible(); await page.getByRole('button', { name: 'Share board', exact: true }).focus();
  await expect(dialog).toHaveCount(0); await expect(page.getByRole('button', { name: 'Share board', exact: true })).toBeFocused();
  await openSaveDetails(page); await page.locator('.dali-menu-trigger').click(); await expect(dialog).toHaveCount(0);
});

test('@04-07-01 failed image rows retain focus during retry and select without mutation', async ({ page, baseURL }) => {
  await saveDetailsBoard(page, baseURL!); await addDetailImages(page, 2); await expect(saveTrigger(page)).toContainText('Saved');
  const key = await page.locator('editor-host').evaluate(el => ((el as EditorHost).store.getBlocksByFlavour('affine:image')[0]!.model.props as { sourceId: string }).sourceId);
  let fail = true; let held = 0; let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/blobs/*', async route => {
    if (route.request().method() !== 'GET' || !decodeURIComponent(route.request().url()).endsWith(key)) return route.continue();
    if (fail) return route.fulfill({ status: 503, json: { code: 'SYNTHETIC_IMAGE_FAILURE' } });
    const response = await route.fetch(); held++; await gate; await route.fulfill({ response }).catch(() => undefined);
  });
  await page.reload(); await expect(saveTrigger(page)).toContainText('Image not saved');
  const dialog = await openSaveDetails(page); await expect(dialog.getByRole('listitem')).toHaveCount(2);
  const first = dialog.getByRole('listitem').first(); await expect(first).toContainText('Image not saved');
  await expect(dialog.getByRole('listitem').last()).toContainText('Saved');
  fail = false; const retry = dialog.getByRole('button', { name: 'Retry now', exact: true }); await retry.click();
  await expect.poll(() => held).toBe(1); await expect(retry).toBeFocused(); await expect(first).toContainText('Image not saved');
  await expect(dialog.getByRole('button', { name: 'Download recovery copy' })).toBeEnabled();
  release(); await expect(saveTrigger(page)).toContainText('Saved'); await expect(first).toContainText('Saved');
  const before = await nativeRecoveryModel(page); await first.getByRole('button', { name: /Select image:/ }).click();
  await expect(dialog).toHaveCount(0); await expect(page.locator('editor-host')).toBeFocused(); expect(await nativeRecoveryModel(page)).toBe(before);
});

test('@04-07-01 actual dialog download coalesces preparation and retains pending work', async ({ page, baseURL }) => {
  await saveDetailsBoard(page, baseURL!);
  await page.route('**/docs/*/push', route => route.fulfill({ status: 503, json: { code: 'SYNTHETIC_OUTAGE' } }));
  await page.getByRole('button', { name: 'Add sticky note', exact: true }).click(); await expect(saveTrigger(page)).toContainText('Save failed');
  const dialog = await openSaveDetails(page); const before = (await journalRows(page)).map(row => row.id);
  const barrier = await recoveryAuthorizationBarrier(page); const downloads: import('@playwright/test').Download[] = []; page.on('download', item => downloads.push(item));
  const download = dialog.getByRole('button', { name: 'Download recovery copy' });
  await download.evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
  await expect.poll(barrier.held).toBe(1); await expect(download).toBeDisabled(); await expect(dialog).toContainText('Preparing recovery copy…');
  await dialog.getByRole('button', { name: 'Close save details' }).click(); await openSaveDetails(page); await expect(dialog).toContainText('Preparing recovery copy…');
  barrier.release(); await expect.poll(() => downloads.length).toBe(1); await expect(dialog).toContainText("Recovery copy ready. Check your browser's downloads.");
  expect(downloads[0]!.suggestedFilename()).toMatch(/\.bs\.zip$/); const after = (await journalRows(page)).map(row => row.id); expect(before.every(id => after.includes(id))).toBe(true);
  await expect(saveTrigger(page)).not.toContainText('Saved');
});

test('@04-07-01 missing image preparation fails through dialog with retry available', async ({ page, baseURL }) => {
  await saveDetailsBoard(page, baseURL!); await addDetailImages(page); await expect(saveTrigger(page)).toContainText('Saved');
  await page.route('**/blobs/*', route => route.request().method() === 'GET' ? route.fulfill({ status: 503, json: { code: 'SYNTHETIC_IMAGE_FAILURE' } }) : route.continue());
  await page.reload(); await expect(saveTrigger(page)).toContainText('Image not saved');
  await page.locator('editor-host').evaluate(el => { const store = (el as EditorHost).store; store.updateBlock(store.getBlocksByFlavour('affine:image')[0]!.model, { sourceId: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' }); });
  const dialog = await openSaveDetails(page);
  const downloads: unknown[] = []; page.on('download', value => downloads.push(value));
  await dialog.getByRole('button', { name: 'Download recovery copy' }).click(); await expect(dialog.getByRole('alert')).toContainText('Recovery copy could not be prepared');
  expect(downloads).toHaveLength(0); await expect(dialog.getByRole('button', { name: 'Download recovery copy' })).toBeEnabled();
});

test('@04-07-01 removed image action is omitted until reference removal is acknowledged', async ({ page, baseURL }) => {
  await saveDetailsBoard(page, baseURL!); await addDetailImages(page); await expect(saveTrigger(page)).toContainText('Saved');
  await page.route('**/blobs/*', route => route.request().method() === 'GET' ? route.fulfill({ status: 503, json: { code: 'SYNTHETIC_IMAGE_FAILURE' } }) : route.continue());
  await page.reload(); await expect(saveTrigger(page)).toContainText('Image not saved'); const dialog = await openSaveDetails(page);
  const barrier = await documentResponseBarrier(page);
  await page.locator('editor-host').evaluate(el => { const store = (el as EditorHost).store; store.deleteBlock(store.getBlocksByFlavour('affine:image')[0]!.model); });
  await expect.poll(barrier.held).toBeGreaterThan(0); await expect(dialog).toContainText('Image is no longer on this board.');
  await expect(dialog.getByRole('button', { name: /Select image:/ })).toHaveCount(0); expect(await dialog.getByRole('listitem').count()).toBeGreaterThan(0);
  await barrier.releaseAll(); await expect(dialog.getByRole('list')).toHaveCount(0);
});

test('@04-07-01 authorized Viewer sees read-only details without denied recovery or write actions', async ({ page, browser, baseURL }) => {
  const { member, descriptor } = await saveDetailsBoard(page, baseURL!);
  const grantState = await (await page.request.get(`/api/boards/${descriptor.summary.id}/grants`, { headers: { 'X-Dali-Account': member.accountId } })).json();
  const response = await page.request.post(`/api/boards/${descriptor.summary.id}/grants`, { headers: { Origin: baseURL!, 'X-Dali-Account': member.accountId, 'X-Dali-Request': '1', 'X-Dali-Recovery-Epoch': descriptor.recoveryEpoch }, data: { email: 'viewer@example.org', role: 'viewer', revision: grantState.revision, operationId: randomUUID() } }); expect(response.status()).toBe(200);
  const context = await browser.newContext(); const viewer = await context.newPage();
  await viewer.goto(baseURL! + '/auth/start'); await viewer.getByRole('link', { name: 'Synthetic Viewer', exact: true }).click();
  await expect(viewer.getByRole('heading', { name: 'Your boards' })).toBeVisible(); await viewer.goto(baseURL! + '/?board=' + descriptor.summary.id); await expect(viewer.locator('editor-host')).toBeVisible();
  await expect(saveTrigger(viewer)).toContainText('Read only'); await expect(viewer.getByText('Your access has changed', { exact: true })).toHaveCount(0);
  const dialog = await openSaveDetails(viewer); await expect(dialog.getByRole('button', { name: 'Download recovery copy' })).toHaveCount(0); await expect(dialog.getByRole('button', { name: /Retry/ })).toHaveCount(0);
  expect(await viewer.locator('editor-host').evaluate(el => (el as EditorHost).store.readonly)).toBe(true); await context.close();
});
