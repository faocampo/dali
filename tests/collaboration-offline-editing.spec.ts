import { randomUUID } from 'node:crypto';
import type { GfxController } from '@blocksuite/affine/std/gfx';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { acceptanceService, createIdentityContexts } from './access-fixtures';
import { seedCollaborationShapes, moveNativeShape, shapeBounds } from './collaboration-fixtures';
import { failRecoveryStorage, restoreRecoveryStorage, journalRows } from './recovery-fixtures';
import { readRecoveryEpoch } from '../server/storage/recovery-state';

async function moveOffline(page: Page, id: string, dx: number, dy: number) {
  const position = await page.locator('affine-edgeless-root').evaluate((element, objectId) => {
    const gfx = (element as HTMLElement & { gfx: GfxController }).gfx;
    const model = gfx.getElementById(objectId);
    if (!model || !('x' in model)) throw new Error('Missing native shape');
    const point = gfx.viewport.toViewCoord(model.x + model.w / 2, model.y + model.h / 2);
    const rect = element.getBoundingClientRect(); return { x: point[0] + rect.left, y: point[1] + rect.top };
  }, id);
  await page.mouse.move(position.x, position.y); await page.mouse.down();
  await page.mouse.move(position.x + dx, position.y + dy, { steps: 8 }); await page.mouse.up();
}

for (const scenario of ['unchanged', 'divergent', 'quota', 'expired'] as const) test(`@05-05-02 new offline gestures remain private before ${scenario} reconnect`, async ({ browser, baseURL }) => {
  const service = await acceptanceService(baseURL!); const identities = await createIdentityContexts(browser, service.origin);
  let interrupt = () => {}; let failure: unknown;
  try {
    const ownerContext = identities.contexts.owner; const editorContext = identities.contexts.editor;
    const owner = ownerContext.pages()[0]!; const editor = editorContext.pages()[0]!;
    if (scenario === 'expired') await owner.clock.install();
    const ownerAccount = (await (await ownerContext.request.get('/api/session')).json()).accountId;
    const editorAccount = (await (await editorContext.request.get('/api/session')).json()).accountId;
    const created = await ownerContext.request.post('/api/boards', {
      headers: { Origin: service.origin, 'X-Dali-Request': '1', 'X-Dali-Account': ownerAccount, 'X-Dali-Recovery-Epoch': readRecoveryEpoch(service.database) },
      data: { operationId: randomUUID(), title: 'Synthetic offline editing' },
    });
    expect(created.status()).toBe(201); const board = (await created.json()).summary.id as string;
    service.database.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?)').run(board, editorAccount, 'editor');
    const [shape, second] = await seedCollaborationShapes(owner, service.database, board);
    const interrupted = new Promise<void>(resolve => { interrupt = resolve; });
    await owner.route('**/live/poll', async route => { await interrupted; await route.fulfill({ status: 200, contentType: 'application/json', body: '{' }); });
    for (const page of [owner, editor]) { await page.goto(`/?board=${board}`); await expect(page.locator('affine-edgeless-root')).toBeVisible(); }
    await expect(owner.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
    const original = await shapeBounds(owner, shape!); const otherOriginal = await shapeBounds(owner, second!);
    interrupt(); await expect(owner.getByRole('button', { name: 'Reconnect', exact: true })).toBeVisible();
    const writes: string[] = [];
    owner.on('request', request => { if (/\/live\/reserve$|\/docs\/[^/]+\/push$/.test(new URL(request.url()).pathname)) writes.push(request.url()); });
    await moveOffline(owner, shape!, 70, 40);
    await expect.poll(() => shapeBounds(owner, shape!)).toBe('[70,40,160,120]');
    await expect.poll(async () => (await journalRows(owner)).length).toBeGreaterThan(0);
    await moveOffline(owner, shape!, 20, 10);
    await expect.poll(() => shapeBounds(owner, shape!)).toBe('[90,50,160,120]');
    await expect(owner.getByRole('button', { name: 'Saved, Open save details', exact: true })).toHaveCount(0);
    const retained = await journalRows(owner); expect(retained.length).toBeGreaterThan(0);
    expect(await shapeBounds(editor, shape!)).toBe(original); expect(writes).toEqual([]);
    await expect(owner.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
    if (scenario === 'quota' || scenario === 'expired') {
      if (scenario === 'expired') {
        await owner.clock.fastForward(86400001);
        await expect(owner.getByRole('dialog', { name: 'Session expired — sign in to continue.', exact: true })).toBeVisible();
        await expect(owner.locator('editor-host')).toBeHidden();
        await owner.keyboard.press('Delete');
      } else {
        await failRecoveryStorage(owner, 'quota'); await moveOffline(owner, shape!, 15, 10);
        await expect(owner.getByRole('button', { name: 'Editing paused, Open save details', exact: true })).toBeVisible();
        const paused = await shapeBounds(owner, shape!); await moveOffline(owner, shape!, 20, 20); await owner.keyboard.press('Delete');
        expect(await shapeBounds(owner, shape!)).toBe(paused);
        await restoreRecoveryStorage(owner);
      }
      expect(await journalRows(owner)).toEqual(expect.arrayContaining(retained));
      expect(await shapeBounds(editor, shape!)).toBe(original); expect(writes).toEqual([]);
      expect(identities.runtimeErrors).toEqual([]); return;
    }
    if (scenario === 'divergent') {
      const released = editor.waitForResponse(response => response.url().endsWith('/live/release') && response.ok());
      await moveNativeShape(editor, second!, 45); await released;
    }
    await owner.unroute('**/live/poll'); await owner.getByRole('button', { name: 'Reconnect', exact: true }).click();
    if (scenario === 'unchanged') {
      await expect(owner.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
      await expect(owner.getByRole('button', { name: 'Reconnect', exact: true })).toHaveCount(0);
      await expect.poll(() => shapeBounds(editor, shape!)).toBe('[90,50,160,120]');
      await owner.getByRole('button', { name: 'Undo', exact: true }).click();
      for (const page of [owner, editor]) await expect.poll(() => shapeBounds(page, shape!)).toBe('[70,40,160,120]');
      await owner.getByRole('button', { name: 'Redo', exact: true }).click();
      for (const page of [owner, editor]) await expect.poll(() => shapeBounds(page, shape!)).toBe('[90,50,160,120]');
      await expect(owner.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
      await expect.poll(() => journalRows(owner)).toEqual([]);
      await owner.reload(); expect(await shapeBounds(owner, shape!)).toBe('[90,50,160,120]');
    } else {
      await expect(owner.getByRole('dialog', { name: 'This board changed while you were away', exact: true })).toBeVisible();
      expect(await shapeBounds(owner, shape!)).toBe('[90,50,160,120]'); expect(await shapeBounds(owner, second!)).toBe(otherOriginal);
      expect(await shapeBounds(editor, shape!)).toBe(original); expect(await shapeBounds(editor, second!)).not.toBe(otherOriginal);
      expect(await journalRows(owner)).toEqual(expect.arrayContaining(retained)); expect(writes).toEqual([]);
    }
    expect(identities.runtimeErrors).toEqual([]);
  } catch (error) { failure = error; throw error; }
  finally { interrupt(); try { await identities.close(); } catch (error) { if (!failure) throw error; } finally { await service.close(); } }
});
