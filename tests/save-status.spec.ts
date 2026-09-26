import { test, expect } from '@playwright/test';
import { saveBoardFixture, addSavedImage, documentResponseBarrier } from './save-status-fixtures';
import type { EditorHost } from '@blocksuite/affine/std';
import { randomUUID } from 'node:crypto';

async function secondImage(page: import('@playwright/test').Page) {
  const png = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = canvas.height = 4; const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#438eaa'; ctx.fillRect(0, 0, 4, 4); return canvas.toDataURL().split(',')[1]!; });
  await page.locator('input[type=file][accept="image/*"]').setInputFiles({ name: 'Second synthetic image.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await expect(page.locator('affine-edgeless-image')).toHaveCount(2);
}

test('@04-05-02 manual retry confirms an individual image after a real read failure', async ({ page, baseURL }) => {
  await saveBoardFixture(page, baseURL!); await addSavedImage(page);
  let fail = true; let reads = 0;
  await page.route('**/blobs/*', async route => {
    if (route.request().method() !== 'GET') return route.continue();
    reads++; if (fail) return route.fulfill({ status: 503, json: { code: 'SYNTHETIC_IMAGE_UNAVAILABLE' } });
    return route.continue();
  });
  await page.reload(); await expect(page.locator('editor-host')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Image not saved, Open save details', exact: true })).toBeVisible();
  expect(reads).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Image not saved, Open save details', exact: true }).click();
  const failedReads = reads; fail = false;
  await page.getByRole('button', { name: 'Retry now', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
  expect(reads).toBeGreaterThan(failedReads);
});

test('@04-05-02 older document acknowledgment cannot save newer native edits or change the last saved age', async ({ page, baseURL }) => {
  await saveBoardFixture(page, baseURL!);
  const saved = page.getByRole('button', { name: 'Saved, Open save details', exact: true }); await expect(saved).toBeVisible();
  const age = await saved.getAttribute('title'); const barrier = await documentResponseBarrier(page);
  await page.getByRole('button', { name: 'Add sticky note', exact: true }).click();
  await expect.poll(barrier.held).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Add sticky note', exact: true }).click();
  await expect(page.locator('affine-edgeless-note')).toHaveCount(2);
  await expect(saved).toHaveCount(0); expect(await page.locator('.djai-save__status').getAttribute('title')).toBe(age);
  await barrier.release(0); await expect(saved).toHaveCount(0);
  await barrier.releaseAll(); await expect(saved).toBeVisible();
});

test('@04-05-02 real response stall becomes failed at fifteen seconds and retains age until receipt', async ({ page, baseURL }) => {
  await saveBoardFixture(page, baseURL!); await expect(page.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
  const age = await page.locator('.djai-save__status').getAttribute('title');
  const barrier = await documentResponseBarrier(page); const started = Date.now();
  await page.getByRole('button', { name: 'Add sticky note', exact: true }).click(); await expect.poll(barrier.held).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: 'Save failed, Open save details', exact: true })).toBeVisible({ timeout: 18000 });
  expect(Date.now() - started).toBeGreaterThanOrEqual(14500);
  expect(await page.locator('.djai-save__status').getAttribute('title')).toBe(age);
  await barrier.releaseAll(); await expect(page.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
});

test('@04-05-02 a valid empty board waits for its initial server document responses', async ({ page, baseURL }) => {
  await saveBoardFixture(page, baseURL!); let release!: () => void; let requests = 0;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/docs/*/pull', async route => { const response = await route.fetch(); expect(response.status()).toBe(200); requests++; await gate; await route.fulfill({ response }); });
  await page.reload(); await expect.poll(() => requests).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: 'Saved, Open save details', exact: true })).toHaveCount(0);
  release(); await expect(page.locator('editor-host')).toBeVisible(); await expect(page.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
});

test('@04-05-02 obsolete image failure clears only when its native reference removal is acknowledged', async ({ page, baseURL }) => {
  await saveBoardFixture(page, baseURL!); await addSavedImage(page);
  await page.route('**/blobs/*', route => route.request().method() === 'GET' ? route.fulfill({ status: 503, json: { code: 'SYNTHETIC_IMAGE_UNAVAILABLE' } }) : route.continue());
  await page.reload(); await expect(page.getByRole('button', { name: 'Image not saved, Open save details', exact: true })).toBeVisible();
  const barrier = await documentResponseBarrier(page);
  await page.locator('editor-host').evaluate(el => { const store = (el as EditorHost).store; for (const block of store.getBlocksByFlavour('affine:image')) store.deleteBlock(block.model); });
  await expect(page.locator('affine-edgeless-image')).toHaveCount(0); await expect.poll(barrier.held).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: 'Save failed, Open save details', exact: true })).toBeVisible();
  await barrier.releaseAll(); await expect(page.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
});

test('@04-05-02 unrelated image success retains the failed image through coalesced automatic and manual retry', async ({ page, baseURL }) => {
  await saveBoardFixture(page, baseURL!); await addSavedImage(page); await secondImage(page);
  await expect(page.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
  const failedId = await page.locator('editor-host').evaluate(el => ((el as EditorHost).store.getBlocksByFlavour('affine:image')[0]!.model.props as { sourceId: string }).sourceId);
  let fail = true; let successes = 0; let held = 0; let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/blobs/*', async route => {
    if (route.request().method() !== 'GET') return route.continue();
    const id = decodeURIComponent(new URL(route.request().url()).pathname.split('/').at(-1)!);
    if (id === failedId && fail) return route.fulfill({ status: 503, json: { code: 'SYNTHETIC_IMAGE_UNAVAILABLE' } });
    const response = await route.fetch(); expect(response.status()).toBe(200);
    if (id === failedId) { held++; await gate; } else successes++;
    await route.fulfill({ response });
  });
  await page.reload(); await expect.poll(() => successes).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: 'Image not saved, Open save details', exact: true })).toBeVisible();
  fail = false; await expect.poll(() => held).toBe(1);
  await page.getByRole('button', { name: 'Image not saved, Open save details', exact: true }).click();
  await page.getByRole('button', { name: 'Retry now', exact: true }).click({ clickCount: 3 });
  await expect(page.getByRole('button', { name: 'Image not saved, Open save details', exact: true })).toBeVisible();
  expect(held).toBe(1); release(); await expect(page.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible(); expect(held).toBe(1);
});

test('@04-05-02 combined image and document failure retains newer edits until the matching upload is confirmed', async ({ page, baseURL }) => {
  const { member, descriptor } = await saveBoardFixture(page, baseURL!); await addSavedImage(page);
  let fail = true; let failedKey = ''; let failures = 0; let committed = 0;
  await page.route('**/blobs/*', async route => {
    if (route.request().method() !== 'PUT') return route.continue();
    failedKey = decodeURIComponent(new URL(route.request().url()).pathname.split('/').at(-1)!);
    if (fail) { failures++; return route.fulfill({ status: 503, json: { code: 'SYNTHETIC_IMAGE_UNAVAILABLE' } }); }
    const response = await route.fetch(); expect(response.status()).toBe(200); committed++; await route.fulfill({ response });
  });
  await secondImage(page); await expect.poll(() => failures).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: 'Save failed, Open save details', exact: true })).toBeVisible();
  const absent = await page.request.get(`/api/boards/${descriptor.summary.id}/blobs/${encodeURIComponent(failedKey)}`, { headers: { 'X-Dali-Account': member.accountId } }); expect(absent.status()).toBe(404);
  await page.getByRole('button', { name: 'Add sticky note', exact: true }).click();
  await page.getByRole('button', { name: 'Save failed, Open save details', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Save details' })).toContainText('Board changes and');
  fail = false; await page.getByRole('button', { name: 'Retry now', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible(); expect(committed).toBeGreaterThan(0);
  await page.reload(); await expect(page.locator('affine-edgeless-image')).toHaveCount(2); await expect(page.locator('affine-edgeless-note')).toHaveCount(1);
});

test('@04-05-02 late old-board response cannot change the active board save state', async ({ page, baseURL }) => {
  const { member, descriptor } = await saveBoardFixture(page, baseURL!);
  const created = await page.request.post('/api/boards', { headers: { Origin: baseURL!, 'X-Dali-Account': member.accountId, 'X-Dali-Request': '1', 'X-Dali-Recovery-Epoch': descriptor.recoveryEpoch }, data: { title: 'Synthetic next board', operationId: randomUUID() } });
  expect(created.status()).toBe(201); const next = await created.json();
  const barrier = await documentResponseBarrier(page, descriptor.summary.id); await page.getByRole('button', { name: 'Add sticky note', exact: true }).click(); await expect.poll(barrier.held).toBeGreaterThan(0);
  await page.evaluate(id => { history.pushState(null, '', '/?board=' + id); dispatchEvent(new PopStateEvent('popstate')); }, next.summary.id);
  await expect(page.locator('.djai-app')).toHaveAttribute('data-board-id', next.summary.id);
  await expect(page.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible(); const age = await page.locator('.djai-save__status').getAttribute('title');
  await barrier.releaseAll(); await expect(page.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible(); expect(await page.locator('.djai-save__status').getAttribute('title')).toBe(age);
  await expect(page.locator('affine-edgeless-note')).toHaveCount(0);
});

test('@04-05-02 late previous-account acknowledgment cannot restore Saved after identity changes', async ({ page, context, baseURL }) => {
  await saveBoardFixture(page, baseURL!); const barrier = await documentResponseBarrier(page);
  await page.getByRole('button', { name: 'Add sticky note', exact: true }).click(); await expect.poll(barrier.held).toBeGreaterThan(0);
  await context.clearCookies({ name: 'dali_fixture_identity' }); const other = await context.newPage();
  await other.goto(baseURL! + '/auth/start'); await other.getByRole('link', { name: 'Synthetic Editor', exact: true }).click();
  await expect(other.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Account changed', exact: true })).toBeVisible();
  await barrier.releaseAll(); await expect(page.locator('editor-host')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Saved, Open save details', exact: true })).toHaveCount(0); await other.close();
});
