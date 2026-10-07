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

for (const scenario of ['unchanged', 'divergent', 'quota', 'expired', 'lost-at-authorize', 'lost-at-baseline', 'lost-at-reserve', 'lost-at-commit'] as const) test(`@05-05-02 new offline gestures remain private before ${scenario} reconnect`, async ({ browser, browserName, baseURL }) => {
  const service = await acceptanceService(baseURL!); const identities = await createIdentityContexts(browser, service.origin);
  let interrupt = () => {}; let failure: unknown;
  try {
    const lostAccess = scenario.startsWith('lost-at-');
    const ownerContext = lostAccess ? identities.contexts.editor : identities.contexts.owner;
    const editorContext = lostAccess ? identities.contexts.owner : identities.contexts.editor;
    const creatorContext = identities.contexts.owner;
    const owner = ownerContext.pages()[0]!; const editor = editorContext.pages()[0]!;
    if (scenario === 'expired') await owner.clock.install();
    const ownerAccount = (await (await ownerContext.request.get('/api/session')).json()).accountId;
    const editorAccount = (await (await editorContext.request.get('/api/session')).json()).accountId;
    const created = await creatorContext.request.post('/api/boards', {
      headers: { Origin: service.origin, 'X-Dali-Request': '1', 'X-Dali-Account': lostAccess ? editorAccount : ownerAccount, 'X-Dali-Recovery-Epoch': readRecoveryEpoch(service.database) },
      data: { operationId: randomUUID(), title: 'Synthetic offline editing' },
    });
    expect(created.status()).toBe(201); const board = (await created.json()).summary.id as string;
    service.database.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?)').run(board, lostAccess ? ownerAccount : editorAccount, 'editor');
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
    if (lostAccess) {
      const boundary = scenario === 'lost-at-authorize' ? `**/api/boards/${board}` : scenario === 'lost-at-baseline' ? '**/recovery/baseline' : scenario === 'lost-at-reserve' ? '**/live/reserve' : '**/docs/*/push';
      let rejected: { status: number; code?: string } | undefined;
      await owner.route(boundary, async route => {
        if (rejected) { await route.continue(); return; }
        service.database.prepare("UPDATE board_grants SET role='viewer',revision=revision+1 WHERE board_id=? AND member_id=?").run(board, ownerAccount);
        const response = await route.fetch(); const body = await response.json(); rejected = { status: response.status(), code: body.code };
        await route.fulfill({ response });
      });
      await owner.unroute('**/live/poll'); await owner.getByRole('button', { name: 'Reconnect', exact: true }).click();
      await expect(owner.getByRole('heading', { name: 'Your access has changed', exact: true })).toBeVisible();
      expect(rejected?.status).toBe(scenario === 'lost-at-authorize' ? 200 : 403);
      expect(await shapeBounds(editor, shape!)).toBe(original);
      expect(await journalRows(owner)).toEqual(expect.arrayContaining(retained));
      await owner.unroute(boundary);
      service.database.prepare("UPDATE board_grants SET role='editor',revision=revision+1 WHERE board_id=? AND member_id=?").run(board, ownerAccount);
      const beforeChoice = writes.length; owner.once('dialog', dialog => dialog.accept()); await owner.reload();
      const choice = owner.getByRole('dialog', { name: 'Editing access restored', exact: true });
      await expect(choice).toBeVisible(); expect(writes).toHaveLength(beforeChoice);
      expect(await shapeBounds(owner, shape!)).toBe('[90,50,160,120]'); expect(await shapeBounds(editor, shape!)).toBe(original);
      await choice.getByRole('button', { name: 'Restore pending edits', exact: true }).click();
      await expect(owner.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
      await expect.poll(() => shapeBounds(editor, shape!)).toBe('[90,50,160,120]');
      await expect.poll(() => journalRows(owner)).toEqual([]);
      await expect(owner.getByRole('button', { name: 'People on this board: 2', exact: true })).toBeVisible();
      const released = owner.waitForResponse(response => response.url().endsWith('/live/release') && response.ok());
      await moveNativeShape(owner, second!, 25); await released;
      await expect.poll(() => shapeBounds(editor, second!)).toBe('[425,40,160,120]');
      await owner.reload(); expect(await shapeBounds(owner, shape!)).toBe('[90,50,160,120]'); expect(await shapeBounds(owner, second!)).toBe('[425,40,160,120]');
      expect(identities.runtimeErrors).toEqual(scenario !== 'lost-at-authorize' && browserName !== 'firefox' ? ['editor: Failed to load resource: the server responded with a status of 403 (Forbidden)'] : []);
      identities.runtimeErrors.length = 0; return;
    }
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
