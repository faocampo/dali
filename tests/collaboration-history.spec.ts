import { randomUUID } from 'node:crypto';
import type { GfxController } from '@blocksuite/affine/std/gfx';
import type { ShapeElementModel } from '@blocksuite/affine/model';
import { test, expect } from './fixtures';
import { acceptanceService, createIdentityContexts } from './access-fixtures';
import { seedCollaborationShapes, shapeBounds, moveNativeShape } from './collaboration-fixtures';
import { readRecoveryEpoch } from '../server/storage/recovery-state';

test('@05-04-01 a complete text session is one personal step across pauses and independent remote edits', async ({ browser, baseURL }) => {
  const service = await acceptanceService(baseURL!);
  const identities = await createIdentityContexts(browser, service.origin);
  let failure: unknown;
  try {
    const ownerContext = identities.contexts.owner; const editorContext = identities.contexts.editor;
    const ownerAccount = (await (await ownerContext.request.get('/api/session')).json()).accountId;
    const editorAccount = (await (await editorContext.request.get('/api/session')).json()).accountId;
    const created = await ownerContext.request.post('/api/boards', {
      headers: { Origin: service.origin, 'X-Dali-Request': '1', 'X-Dali-Account': ownerAccount, 'X-Dali-Recovery-Epoch': readRecoveryEpoch(service.database) },
      data: { operationId: randomUUID(), title: 'Synthetic personal history' },
    });
    expect(created.status()).toBe(201); const board = (await created.json()).summary.id as string;
    service.database.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?)').run(board, editorAccount, 'editor');
    const owner = ownerContext.pages()[0]!; const editor = editorContext.pages()[0]!;
    const [shape, independent] = await seedCollaborationShapes(owner, service.database, board);
    for (const page of [owner, editor]) { await page.goto(`/?board=${board}`); await expect(page.locator('affine-edgeless-root')).toBeVisible(); }
    const value = (page: typeof owner) => page.locator('affine-edgeless-root').evaluate((element, id) => {
      const model = (element as HTMLElement & { gfx: GfxController }).gfx.getElementById(id!) as ShapeElementModel;
      return model.text?.toString() ?? '';
    }, shape);
    const point = await owner.locator('affine-edgeless-root').evaluate((element, id) => {
      const gfx = (element as HTMLElement & { gfx: GfxController }).gfx;
      const model = gfx.getElementById(id!) as ShapeElementModel;
      const [x, y] = gfx.viewport.toViewCoord(model.x + model.w / 2, model.y + model.h / 2);
      const rect = element.closest('.affine-edgeless-viewport')!.getBoundingClientRect();
      return { x: x + rect.left, y: y + rect.top };
    }, shape);
    await owner.mouse.dblclick(point.x, point.y);
    const text = owner.locator('edgeless-shape-text-editor [contenteditable=true]');
    await expect(text).toBeFocused(); await owner.keyboard.insertText('First');
    await expect(owner.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
    // The approved session boundary is leaving the field, not the pinned
    // native UndoManager's default 500ms capture timeout.
    await new Promise(resolve => setTimeout(resolve, 650));
    await expect(text).toBeFocused(); await owner.keyboard.insertText('Second');
    await expect.poll(() => value(editor)).toBe('FirstSecond');
    await moveNativeShape(editor, independent!, 70);
    const moved = await shapeBounds(editor, independent!);
    await expect.poll(() => shapeBounds(owner, independent!)).toBe(moved);
    const released = owner.waitForResponse(response => response.url().endsWith('/live/release') && response.ok());
    await owner.keyboard.press('Escape'); await released;
    await owner.getByRole('button', { name: 'Undo', exact: true }).click();
    for (const page of [owner, editor]) {
      await expect.poll(() => value(page)).toBe('');
      expect(await shapeBounds(page, independent!)).toBe(moved);
    }
    await owner.getByRole('button', { name: 'Redo', exact: true }).click();
    for (const page of [owner, editor]) await expect.poll(() => value(page)).toBe('FirstSecond');
    await expect(owner.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
    await owner.reload(); await expect.poll(() => value(owner)).toBe('FirstSecond');
    expect(await shapeBounds(owner, independent!)).toBe(moved);
    await expect(owner.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
    expect(identities.runtimeErrors).toEqual([]);
  } catch (error) { failure = error; throw error; }
  finally { try { await identities.close(); } catch (error) { if (!failure) throw error; } finally { await service.close(); } }
});
