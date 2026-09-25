import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { GfxController } from '@blocksuite/affine/std/gfx';
import { createHash, randomUUID } from 'node:crypto';
import { createDurabilityService } from './durability-fixtures';
import { syntheticCanaries } from './access-fixtures';

async function snapshot(page: Page) {
  return page.locator('affine-edgeless-root').evaluate(async el => {
    const doc = (el as HTMLElement & { gfx: GfxController }).gfx.doc;
    const images = await Promise.all(doc.getBlocksByFlavour('affine:image').map(async ({ model }) => {
      const image = model as typeof model & { xywh: string; props: { sourceId: string } };
      const blob = await doc.blobSync.get(image.props.sourceId);
      const hash = blob ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())), n => n.toString(16).padStart(2, '0')).join('') : '';
      return { id: image.id, xywh: image.xywh, hash };
    }));
    return { id: doc.id, images, notes: doc.getBlocksByFlavour('affine:note').map(({ model }) => ({ id: model.id, xywh: (model as typeof model & { xywh: string }).xywh })) };
  });
}

test('@04-01-01 acknowledged native sticky and PNG survive SIGKILL and cold sign-in', async ({ browser, baseURL }) => {
  const service = await createDurabilityService(baseURL!);
  const first = await browser.newContext({ baseURL: service.origin });
  try {
    expect(service.pragmas, 'persistent connections require verified WAL/FULL/foreign keys').toEqual({ journal: 'wal', synchronous: 2, foreignKeys: 1 });
    const page = await first.newPage(); await page.goto('/auth/start');
    await page.getByRole('link', { name: 'Synthetic Owner', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
    const member = await (await first.request.get('/api/session')).json();
    const headers = { Origin: service.origin, 'X-Dali-Account': member.accountId, 'X-Dali-Request': '1' };
    const created = await first.request.post('/api/boards', { headers, data: { operationId: randomUUID(), title: 'Durable synthetic canvas' } });
    expect(created.status()).toBe(201); const board = await created.json();
    await page.goto('/?board=' + board.summary.id); await expect(page.locator('editor-host')).toBeVisible();
    const pushed = page.waitForResponse(r => r.url().endsWith('/push') && r.request().method() === 'POST' && r.ok());
    await page.getByRole('button', { name: 'Add sticky note', exact: true }).click();
    await page.locator('affine-edgeless-note').dblclick(); await page.keyboard.type('Durable synthetic sticky'); await page.keyboard.press('Escape');
    expect(await (await pushed).json()).toEqual({ acknowledged: true });
    const png = syntheticCanaries().imageBytes;
    const uploaded = page.waitForResponse(r => r.url().includes('/blobs/') && r.request().method() === 'PUT' && r.ok());
    await page.locator('input[type=file][accept="image/*"]').setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: png });
    expect(await (await uploaded).json()).toMatchObject({ acknowledged: true });
    await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
    const before = await snapshot(page); expect(before.images).toHaveLength(1);
    expect(before.images[0]!.hash).toBe(createHash('sha256').update(png).digest('hex'));
    await first.close(); await service.killAndRestart();
    const cold = await browser.newContext({ baseURL: service.origin });
    try {
      expect((await cold.storageState()).origins).toEqual([]);
      const reopened = await cold.newPage(); await reopened.goto('/?board=' + board.summary.id);
      await reopened.getByRole('link', { name: 'Synthetic Owner', exact: true }).click();
      await expect(reopened.locator('affine-edgeless-note')).toContainText('Durable synthetic sticky');
      await expect(reopened.locator('affine-edgeless-image img')).toBeVisible();
      expect(await snapshot(reopened)).toEqual(before);
      const descriptor = await (await cold.request.get('/api/boards/' + board.summary.id, { headers })).json();
      expect(descriptor.rootDocId).toBe(board.rootDocId); expect(descriptor.contentDocId).toBe(board.contentDocId);
    } finally { await cold.close(); }
  } finally { await first.close(); await service.close(); }
});
