import { randomUUID } from 'node:crypto';
import type { GfxController } from '@blocksuite/affine/std/gfx';
import type { ShapeElementModel } from '@blocksuite/affine/model';
import { test, expect } from './fixtures';
import { acceptanceService, createIdentityContexts } from './access-fixtures';
import { seedCollaborationShapes, shapeBounds, moveNativeShape } from './collaboration-fixtures';
import { readRecoveryEpoch } from '../server/storage/recovery-state';
import type { Page } from '@playwright/test';

async function shapePoint(page: Page, id: string) {
  return page.locator('affine-edgeless-root').evaluate((element, objectId) => {
    const gfx = (element as HTMLElement & { gfx: GfxController }).gfx;
    const model = gfx.getElementById(objectId) as ShapeElementModel;
    const [x, y] = gfx.viewport.toViewCoord(model.x + model.w / 2, model.y + model.h / 2);
    const rect = element.closest('.affine-edgeless-viewport')!.getBoundingClientRect(); return { x: x + rect.left, y: y + rect.top };
  }, id);
}
async function selectShape(page: Page, id: string) {
  const point = await shapePoint(page, id);
  const released = page.waitForResponse(response => response.url().endsWith('/live/release') && response.ok());
  await page.mouse.click(point.x, point.y); await released;
}
async function completedMove(page: Page, id: string, dx: number, dy = 40) {
  const released = page.waitForResponse(response => response.url().endsWith('/live/release') && response.ok());
  await moveNativeShape(page, id, dx, dy); await released;
  await expect(page.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
}
const objects = (page: Page) => page.locator('affine-edgeless-root').evaluate(element => {
  const gfx = (element as HTMLElement & { gfx: GfxController }).gfx;
  return gfx.gfxElements.map(model => model.id).sort();
});

for (const scenario of ['independent-property', 'conflicting-step', 'redo-conflict', 'same-account-tab', 'created-then-remote-edited', 'deletion', 'aba', 'group-remote-edit', 'text-replacement'] as const)
test(`@05-04-02 native personal history preserves ${scenario}`, async ({ browser, baseURL }) => {
  const service = await acceptanceService(baseURL!); const identities = await createIdentityContexts(browser, service.origin);
  let failure: unknown;
  try {
    const ownerContext = identities.contexts.owner; const editorContext = identities.contexts.editor;
    const ownerAccount = (await (await ownerContext.request.get('/api/session')).json()).accountId;
    const editorAccount = (await (await editorContext.request.get('/api/session')).json()).accountId;
    const created = await ownerContext.request.post('/api/boards', {
      headers: { Origin: service.origin, 'X-Dali-Request': '1', 'X-Dali-Account': ownerAccount, 'X-Dali-Recovery-Epoch': readRecoveryEpoch(service.database) },
      data: { operationId: randomUUID(), title: 'Synthetic property history' },
    });
    expect(created.status()).toBe(201); const board = (await created.json()).summary.id as string;
    service.database.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?)').run(board, editorAccount, 'editor');
    const owner = ownerContext.pages()[0]!;
    const editor = scenario === 'same-account-tab' ? await ownerContext.newPage() : editorContext.pages()[0]!;
    const [shape, second] = await seedCollaborationShapes(owner, service.database, board);
    for (const page of [owner, editor]) { await page.goto(`/?board=${board}`); await expect(page.locator('affine-edgeless-root')).toBeVisible(); }
    const original = await shapeBounds(owner, shape!);
    if (scenario === 'created-then-remote-edited' || scenario === 'deletion' || scenario === 'group-remote-edit') {
      await selectShape(owner, shape!); await owner.locator('editor-host').focus();
      if (scenario === 'group-remote-edit') await owner.keyboard.press('ControlOrMeta+a');
      const released = owner.waitForResponse(response => response.url().endsWith('/live/release') && response.ok());
      await owner.keyboard.press(scenario === 'deletion' ? 'Delete' : scenario === 'group-remote-edit' ? 'ControlOrMeta+g' : 'ControlOrMeta+d'); await released;
      if (scenario === 'deletion') {
        for (const page of [owner, editor]) await expect.poll(() => objects(page)).toHaveLength(1);
        await owner.getByRole('button', { name: 'Undo', exact: true }).click();
        for (const page of [owner, editor]) { await expect.poll(() => objects(page)).toContain(shape); expect(await shapeBounds(page, shape!)).toBe(original); }
        await owner.getByRole('button', { name: 'Redo', exact: true }).click();
        for (const page of [owner, editor]) await expect.poll(() => objects(page)).toEqual([second]);
      } else {
        await expect.poll(() => objects(editor)).toHaveLength(3);
        const newId = (await objects(editor)).find(id => id !== shape && id !== second)!;
        await completedMove(editor, newId, 50);
        const protectedIds = scenario === 'group-remote-edit' ? [shape!, second!] : [newId];
        const remote = await Promise.all(protectedIds.map(id => shapeBounds(editor, id)));
        for (const [index, id] of protectedIds.entries()) await expect.poll(() => shapeBounds(owner, id)).toBe(remote[index]);
        await owner.getByRole('button', { name: 'Undo', exact: true }).click();
        await expect(owner.getByRole('status').filter({ hasText: "Skipped an undo step to preserve someone else's changes." })).toBeVisible();
        for (const page of [owner, editor]) {
          expect(await objects(page)).toHaveLength(3);
          for (const [index, id] of protectedIds.entries()) expect(await shapeBounds(page, id)).toBe(remote[index]);
        }
      }
    } else {
      await completedMove(owner, shape!, 70); const local = await shapeBounds(owner, shape!);
      await expect.poll(() => shapeBounds(editor, shape!)).toBe(local);
      if (scenario === 'independent-property') {
        await selectShape(editor, shape!);
        const fill = (page: Page) => page.locator('affine-edgeless-root').evaluate((element, id) => ((element as HTMLElement & { gfx: GfxController }).gfx.getElementById(id!) as ShapeElementModel).fillColor, shape);
        const previous = await fill(editor); await editor.getByRole('button', { name: 'Color', exact: true }).click();
        const released = editor.waitForResponse(response => response.url().endsWith('/live/release') && response.ok());
        await editor.getByRole('listbox', { name: 'Fill color', exact: true }).locator('edgeless-color-button').nth(3).click(); await released;
        await expect.poll(() => fill(editor)).not.toBe(previous); const remote = await fill(editor);
        await expect.poll(() => fill(owner)).toBe(remote);
        await owner.getByRole('button', { name: 'Undo', exact: true }).click();
        for (const page of [owner, editor]) { await expect.poll(() => shapeBounds(page, shape!)).toBe(original); expect(await fill(page)).toBe(remote); }
        await owner.getByRole('button', { name: 'Redo', exact: true }).click();
        for (const page of [owner, editor]) { await expect.poll(() => shapeBounds(page, shape!)).toBe(local); expect(await fill(page)).toBe(remote); }
      } else if (scenario === 'aba') {
        await completedMove(editor, shape!, 35); await completedMove(editor, shape!, -35, -40);
        await expect.poll(() => shapeBounds(owner, shape!)).toBe(local);
        await owner.getByRole('button', { name: 'Undo', exact: true }).click();
        await expect(owner.getByRole('status').filter({ hasText: "Skipped an undo step to preserve someone else's changes." })).toBeVisible();
        for (const page of [owner, editor]) expect(await shapeBounds(page, shape!)).toBe(local);
        await expect(owner.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
      } else if (scenario === 'text-replacement') {
        const write = async (page: Page, value: string, replace: boolean) => {
          const point = await shapePoint(page, shape!); await page.mouse.dblclick(point.x, point.y);
          await expect(page.locator('edgeless-shape-text-editor [contenteditable=true]')).toBeFocused();
          if (replace) await page.keyboard.press('ControlOrMeta+a');
          await page.keyboard.insertText(value);
          const released = page.waitForResponse(response => response.url().endsWith('/live/release') && response.ok());
          await page.keyboard.press('Escape'); await released;
        };
        const text = (page: Page) => page.locator('affine-edgeless-root').evaluate((element, id) => ((element as HTMLElement & { gfx: GfxController }).gfx.getElementById(id!) as ShapeElementModel).text?.toString() ?? '', shape);
        await write(owner, 'Local', false); await expect.poll(() => text(editor)).toBe('Local');
        await write(editor, 'Remote', true); await expect.poll(() => text(owner)).toBe('Remote');
        await owner.getByRole('button', { name: 'Undo', exact: true }).click();
        await expect(owner.getByRole('status').filter({ hasText: "Skipped an undo step to preserve someone else's changes." })).toBeVisible();
        for (const page of [owner, editor]) { await expect.poll(() => shapeBounds(page, shape!)).toBe(original); expect(await text(page)).toBe('Remote'); }
      } else if (scenario === 'redo-conflict') {
        await owner.getByRole('button', { name: 'Undo', exact: true }).click();
        await expect(owner.getByRole('button', { name: 'Redo', exact: true })).toBeEnabled();
        await expect.poll(() => shapeBounds(editor, shape!)).toBe(original);
        await completedMove(editor, shape!, 35); const remote = await shapeBounds(editor, shape!);
        await expect.poll(() => shapeBounds(owner, shape!)).toBe(remote);
        await owner.getByRole('button', { name: 'Redo', exact: true }).click();
        await expect(owner.getByRole('status').filter({ hasText: "Skipped a redo step to preserve someone else's changes." })).toBeVisible();
        expect(await shapeBounds(owner, shape!)).toBe(remote); await expect(owner.getByRole('button', { name: 'Redo', exact: true })).toBeDisabled();
      } else {
        await completedMove(owner, second!, 60); const next = await shapeBounds(owner, second!);
        await expect.poll(() => shapeBounds(editor, second!)).toBe(next);
        await completedMove(editor, second!, 35); const remote = await shapeBounds(editor, second!);
        await expect.poll(() => shapeBounds(owner, second!)).toBe(remote);
        await owner.getByRole('button', { name: 'Undo', exact: true }).click();
        await expect(owner.getByRole('status').filter({ hasText: "Skipped an undo step to preserve someone else's changes." })).toBeVisible();
        for (const page of [owner, editor]) { await expect.poll(() => shapeBounds(page, shape!)).toBe(original); expect(await shapeBounds(page, second!)).toBe(remote); }
        await expect(owner.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
      }
    }
    await expect(owner.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
    const expected = await objects(owner); const surviving = [shape!, second!].filter(id => expected.includes(id));
    const geometry = await Promise.all(surviving.map(id => shapeBounds(owner, id)));
    await owner.reload(); await expect.poll(() => objects(owner)).toEqual(expected);
    for (const [index, id] of surviving.entries()) expect(await shapeBounds(owner, id)).toBe(geometry[index]);
    await expect(owner.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
    expect(identities.runtimeErrors).toEqual([]);
  } catch (error) { failure = error; throw error; }
  finally { try { await identities.close(); } catch (error) { if (!failure) throw error; } finally { await service.close(); } }
});

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
