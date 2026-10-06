import { randomUUID } from 'node:crypto';
import type { GfxController } from '@blocksuite/affine/std/gfx';
import type { ShapeElementModel } from '@blocksuite/affine/model';
import { test, expect } from './fixtures';
import { acceptanceService, createIdentityContexts } from './access-fixtures';
import { seedCollaborationShapes, moveNativeShape, shapeBounds } from './collaboration-fixtures';
import { readRecoveryEpoch } from '../server/storage/recovery-state';

test('@05-04-02 a denied history action never replays after another editor releases, and fresh input remains usable', async ({ browser, browserName, baseURL }) => {
  const service = await acceptanceService(baseURL!); const identities = await createIdentityContexts(browser, service.origin);
  let failure: unknown;
  try {
    const ownerContext = identities.contexts.owner; const editorContext = identities.contexts.editor;
    const ownerAccount = (await (await ownerContext.request.get('/api/session')).json()).accountId;
    const editorAccount = (await (await editorContext.request.get('/api/session')).json()).accountId;
    const created = await ownerContext.request.post('/api/boards', {
      headers: { Origin: service.origin, 'X-Dali-Request': '1', 'X-Dali-Account': ownerAccount, 'X-Dali-Recovery-Epoch': readRecoveryEpoch(service.database) },
      data: { operationId: randomUUID(), title: 'Synthetic history reservation' },
    });
    expect(created.status()).toBe(201); const board = (await created.json()).summary.id as string;
    service.database.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?)').run(board, editorAccount, 'editor');
    const owner = ownerContext.pages()[0]!; const editor = editorContext.pages()[0]!;
    const [shape, second] = await seedCollaborationShapes(owner, service.database, board);
    for (const page of [owner, editor]) { await page.goto(`/?board=${board}`); await expect(page.locator('affine-edgeless-root')).toBeVisible(); }
    const original = await shapeBounds(owner, shape!); const secondOriginal = await shapeBounds(owner, second!);
    const firstRelease = owner.waitForResponse(response => response.url().endsWith('/live/release') && response.ok());
    await moveNativeShape(owner, shape!, 60); await firstRelease;
    const moved = await shapeBounds(owner, shape!); await expect.poll(() => shapeBounds(editor, shape!)).toBe(moved);
    const point = await editor.locator('affine-edgeless-root').evaluate((element, id) => {
      const gfx = (element as HTMLElement & { gfx: GfxController }).gfx; const model = gfx.getElementById(id!) as ShapeElementModel;
      const [x, y] = gfx.viewport.toViewCoord(model.x + model.w / 2, model.y + model.h / 2);
      const rect = element.closest('.affine-edgeless-viewport')!.getBoundingClientRect(); return { x: x + rect.left, y: y + rect.top };
    }, shape);
    await editor.mouse.dblclick(point.x, point.y);
    await expect(editor.locator('edgeless-shape-text-editor [contenteditable=true]')).toBeFocused();
    const denial = owner.waitForResponse(response => response.url().endsWith('/live/reserve') && response.status() === 409);
    await owner.getByRole('button', { name: 'Undo', exact: true }).click(); await denial;
    const status = owner.getByRole('status').filter({ hasText: 'Synthetic Editor is editing this object' });
    await expect(status).toBeVisible(); expect(await shapeBounds(owner, shape!)).toBe(moved);
    await owner.setViewportSize({ width: 390, height: 844 });
    await expect.poll(async () => {
      const bounds = await status.boundingBox(); return !!bounds && bounds.x >= 0 && bounds.x + bounds.width <= 390;
    }).toBe(true);
    expect(await status.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await expect(status).not.toBeFocused();
    await owner.screenshot({ path: test.info().outputPath('history-reservation-narrow.png') });
    await owner.setViewportSize({ width: 1280, height: 800 });
    const released = editor.waitForResponse(response => response.url().endsWith('/live/release') && response.ok());
    await editor.keyboard.press('Escape'); await released;
    const independentRelease = owner.waitForResponse(response => response.url().endsWith('/live/release') && response.ok());
    await moveNativeShape(owner, second!, 25); await independentRelease;
    expect(await shapeBounds(owner, shape!)).toBe(moved);
    await owner.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect.poll(() => shapeBounds(owner, second!)).toBe(secondOriginal);
    expect(await shapeBounds(owner, shape!)).toBe(moved);
    await owner.getByRole('button', { name: 'Undo', exact: true }).click();
    for (const page of [owner, editor]) await expect.poll(() => shapeBounds(page, shape!)).toBe(original);
    await expect(owner.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
    await owner.reload(); await expect.poll(() => shapeBounds(owner, shape!)).toBe(original);
    expect(identities.runtimeErrors).toEqual(browserName === 'firefox' ? [] : ['owner: Failed to load resource: the server responded with a status of 409 (Conflict)']);
    identities.runtimeErrors.length = 0;
  } catch (error) { failure = error; throw error; }
  finally { try { await identities.close(); } catch (error) { if (!failure) throw error; } finally { await service.close(); } }
});
