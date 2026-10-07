import { randomUUID } from 'node:crypto';
import type { GfxController } from '@blocksuite/affine/std/gfx';
import { test, expect } from './fixtures';
import { acceptanceService, createIdentityContexts } from './access-fixtures';
import { seedCollaborationShapes } from './collaboration-fixtures';
import { readRecoveryEpoch } from '../server/storage/recovery-state';

for (const cancelled of [false, true]) test(`@05-02-02 second click during release ${cancelled ? 'can be cancelled' : 'keeps native input timing'}`, async ({ browser, baseURL }) => {
  const service = await acceptanceService(baseURL!);
  const identities = await createIdentityContexts(browser, service.origin);
  let unblock = () => {}; let failure: unknown;
  try {
    const context = identities.contexts.owner;
    const account = (await (await context.request.get('/api/session')).json()).accountId;
    const created = await context.request.post('/api/boards', {
      headers: { Origin: service.origin, 'X-Dali-Request': '1', 'X-Dali-Account': account, 'X-Dali-Recovery-Epoch': readRecoveryEpoch(service.database) },
      data: { operationId: randomUUID(), title: 'Synthetic consecutive pointer input' },
    });
    expect(created.status()).toBe(201); const board = (await created.json()).summary.id as string;
    const page = context.pages()[0]!;
    const [shape, independent] = await seedCollaborationShapes(page, service.database, board);
    await page.goto(`/?board=${board}`); await expect(page.locator('affine-edgeless-root')).toBeVisible();
    const point = (id: string) => page.locator('affine-edgeless-root').evaluate((element, id) => {
      const gfx = (element as HTMLElement & { gfx: GfxController }).gfx;
      const model = gfx.getElementById(id)!;
      if (!('elementBound' in model)) throw new Error('Missing native object');
      const bound = model.elementBound; const [x, y] = gfx.viewport.toViewCoord(bound.x + bound.w / 2, bound.y + bound.h / 2);
      const rect = element.closest('.affine-edgeless-viewport')!.getBoundingClientRect();
      return { x: x + rect.left, y: y + rect.top };
    }, id);
    let held!: () => void; const started = new Promise<void>(resolve => { held = resolve; });
    const gate = new Promise<void>(resolve => { unblock = resolve; });
    let intercepted = false; let acquisitions = 0;
    page.on('request', request => { if (request.url().endsWith('/live/reserve')) acquisitions++; });
    await page.route('**/live/release', async route => {
      if (intercepted) { await route.continue(); return; }
      intercepted = true; const response = await route.fetch(); expect(response.ok()).toBe(true);
      held(); await gate; await route.fulfill({ response });
    });
    const at = await point(shape!);
    await page.mouse.click(at.x, at.y); await started;
    await page.mouse.click(at.x, at.y);
    const text = page.locator('edgeless-shape-text-editor [contenteditable=true]');
    expect(acquisitions).toBe(1); await expect(text).toHaveCount(0);
    if (cancelled) await page.keyboard.press('Escape');
    // Exceed the pinned native 500ms multi-click timeout at the server barrier.
    // The two original input events still belong to one double click.
    await new Promise(resolve => setTimeout(resolve, 600));
    const released = page.waitForResponse(response => response.url().endsWith('/live/release') && response.ok());
    unblock(); await released;
    if (cancelled) {
      const next = await point(independent!);
      const reserved = page.waitForResponse(response => response.url().endsWith('/live/reserve') && response.ok());
      await page.mouse.click(next.x, next.y); await reserved;
      await expect.poll(() => page.locator('affine-edgeless-root').evaluate(element => {
        const gfx = (element as HTMLElement & { gfx: GfxController }).gfx;
        return { ids: gfx.selection.selectedElements.map(model => model.id), editing: gfx.selection.editing };
      })).toEqual({ ids: [independent], editing: false });
      expect(acquisitions).toBe(2); await expect(text).toHaveCount(0);
    } else {
      await expect(text).toBeFocused(); expect(acquisitions).toBe(2);
      await page.keyboard.insertText('Synthetic double click');
      const finished = page.waitForResponse(response => response.url().endsWith('/live/release') && response.ok());
      await page.keyboard.press('Escape'); await finished;
      await expect(page.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
    }
    expect(identities.runtimeErrors).toEqual([]);
  } catch (error) { failure = error; throw error; }
  finally { unblock(); try { await identities.close(); } catch (error) { if (!failure) throw error; } finally { await service.close(); } }
});
