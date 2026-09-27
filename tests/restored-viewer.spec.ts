import { test, expect } from '@playwright/test';
import type { GfxController } from '@blocksuite/affine/std/gfx';
import { createRepresentativeRecoveryService } from './durability-fixtures';
import { accessIdentityLabels } from './access-fixtures';

test('@04-15-22 cold Viewer opens restored boards before any writer without mutations or runtime errors', async ({ browser, baseURL }, testInfo) => {
  test.setTimeout(300_000);
  const { service, manifest, boards, graph } = await createRepresentativeRecoveryService(baseURL!);
  try {
    const original = graph();
    const selected = await service.backup();
    await service.restore(selected, undefined, true);
    expect(graph()).toEqual(original);
    // Seeded through HTTP only: no writer browser has hydrated/normalized either board.
    for (const sample of [{ index: 2, identity: 'editor' }, { index: 0, identity: 'viewer' }] as const) {
      await test.step(`Viewer-first board ${sample.index}`, async () => {
        const board = boards[sample.index]!;
        const spec = manifest.boardSpecs[sample.index]!;
        const context = await browser.newContext({ baseURL: service.origin, extraHTTPHeaders: service.operatorHeaders });
        try {
          expect((await context.storageState()).origins).toEqual([]);
          const page = await context.newPage();
          const errors: string[] = [];
          const writes: string[] = [];
          page.on('pageerror', error => errors.push(error.stack ?? error.message));
          page.on('request', request => {
            if (request.url().includes(`/api/boards/${board.summary.id}/`) &&
                (request.url().endsWith('/push') || request.method() === 'PUT' || request.method() === 'PATCH' || request.method() === 'DELETE')) writes.push(request.method() + ' ' + new URL(request.url()).pathname);
          });
          await page.goto('/auth/start');
          await page.getByRole('link', { name: accessIdentityLabels[sample.identity], exact: true }).click();
          await expect(page.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
          const member = await (await context.request.get('/api/session')).json();
          const headers = { 'X-Dali-Account': member.accountId };
          const descriptor = await context.request.get('/api/boards/' + board.summary.id, { headers });
          expect(descriptor.status()).toBe(200);
          expect((await descriptor.json()).summary.role).toBe('viewer');
          const denied = await context.request.post(`/api/boards/${board.summary.id}/docs/${board.contentDocId}/push`, {
            headers: { ...headers, Origin: service.origin, 'X-Dali-Request': '1', 'X-Dali-Recovery-Epoch': service.currentEpoch(), 'Content-Type': 'application/octet-stream' }, data: Buffer.from([0, 0]),
          });
          expect(denied.status()).toBe(403);
          await page.goto('/?board=' + board.summary.id);
          // Wait for either a usable canvas or an explicit application failure, rather than a blind delay.
          await expect(page.locator('editor-host').or(page.getByRole('heading', { name: "We couldn't open this board.", exact: true }))).toBeVisible();
          const opened = await page.locator('editor-host').isVisible();
          expect.soft(opened, `board ${sample.index}: Viewer-first hydration must open`).toBe(true);
          if (opened) {
            await expect.poll(() => page.locator('affine-edgeless-root').evaluate(el => (el as HTMLElement & { gfx: GfxController }).gfx.surface!.elementModels.length))
              .toBe(spec.ordinaryObjects - 1 + spec.mindmapNodes + (spec.mindmapNodes ? 1 : 0));
            // Frames are blocks, while mind maps include an additional surface container.
            expect(await page.locator('affine-edgeless-root').evaluate(el => (el as HTMLElement & { gfx: GfxController }).gfx.doc.getBlocksByFlavour('affine:frame').length)).toBe(1);
            const images = await page.locator('affine-edgeless-root').evaluate(async el => {
              const doc = (el as HTMLElement & { gfx: GfxController }).gfx.doc;
              return Promise.all(doc.getBlocksByFlavour('affine:image').map(async ({ model }) => {
                const source = (model as typeof model & { props: { sourceId: string } }).props.sourceId;
                const blob = await doc.blobSync.get(source); if (!blob) throw new Error('Restored image absent');
                const bitmap = await createImageBitmap(blob);
                const result = { source, width: bitmap.width, height: bitmap.height,
                  sha256: Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())), n => n.toString(16).padStart(2, '0')).join('') };
                bitmap.close(); return result;
              }));
            });
            expect(images).toHaveLength(spec.imageIndexes.length);
            for (const image of images) { const expected = manifest.imageSpecs.find(s => s.key === image.source)!;
              expect(image).toEqual({ source: expected.key, width: expected.width, height: expected.height, sha256: expected.sha256 }); }
          }
          await testInfo.attach(`viewer-first-board-${sample.index}`, { body: JSON.stringify({ opened, errors, writes, body: await page.locator('body').innerText() }), contentType: 'application/json' });
          await testInfo.attach(`viewer-first-board-${sample.index}-screenshot`, { body: await page.screenshot(), contentType: 'image/png' });
          expect.soft(errors, `board ${sample.index}: no read-only runtime errors`).toEqual([]);
          expect.soft(writes, `board ${sample.index}: Viewer hydration must not submit changes`).toEqual([]);
        } finally { await context.close(); }
        expect(graph(), `board ${sample.index}: restored content and grants stay unchanged`).toEqual(original);
      });
    }
  } finally { await service.close(); }
});
