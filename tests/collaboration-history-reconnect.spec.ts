import { randomUUID } from 'node:crypto';
import { test, expect } from './fixtures';
import { acceptanceService, createIdentityContexts } from './access-fixtures';
import { seedCollaborationShapes, moveNativeShape, shapeBounds } from './collaboration-fixtures';
import { readRecoveryEpoch } from '../server/storage/recovery-state';

for (const remote of ['independent', 'conflicting'] as const) test(`@05-04-02 same-tab history survives an interrupted live response and ${remote} changes`, async ({ browser, baseURL }) => {
  const service = await acceptanceService(baseURL!); const identities = await createIdentityContexts(browser, service.origin);
  let failure: unknown;
  try {
    const ownerContext = identities.contexts.owner; const editorContext = identities.contexts.editor;
    const ownerAccount = (await (await ownerContext.request.get('/api/session')).json()).accountId;
    const editorAccount = (await (await editorContext.request.get('/api/session')).json()).accountId;
    const created = await ownerContext.request.post('/api/boards', {
      headers: { Origin: service.origin, 'X-Dali-Request': '1', 'X-Dali-Account': ownerAccount, 'X-Dali-Recovery-Epoch': readRecoveryEpoch(service.database) },
      data: { operationId: randomUUID(), title: 'Synthetic retained personal history' },
    });
    expect(created.status()).toBe(201); const board = (await created.json()).summary.id as string;
    service.database.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?)').run(board, editorAccount, 'editor');
    const owner = ownerContext.pages()[0]!; const editor = editorContext.pages()[0]!;
    const [shape, second] = await seedCollaborationShapes(owner, service.database, board);
    for (const page of [owner, editor]) { await page.goto(`/?board=${board}`); await expect(page.locator('affine-edgeless-root')).toBeVisible(); }
    const original = await shapeBounds(owner, shape!);
    const released = owner.waitForResponse(response => response.url().endsWith('/live/release') && response.ok());
    await moveNativeShape(owner, shape!, 70); await released;
    const moved = await shapeBounds(owner, shape!); await expect.poll(() => shapeBounds(editor, shape!)).toBe(moved);
    await expect(owner.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
    let interrupted = false;
    await owner.route('**/live/poll', async route => {
      if (interrupted) { await route.continue(); return; }
      interrupted = true;
      // A truncated response exercises the real live-source interruption path
      // without manufacturing a browser console error or mutating native state.
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{' });
    });
    await owner.mouse.move(280, 340);
    await expect(owner.getByRole('button', { name: 'Reconnect', exact: true })).toBeVisible({ timeout: 30000 });
    await expect(owner.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
    const changedId = remote === 'independent' ? second! : shape!;
    const remoteReleased = editor.waitForResponse(response => response.url().endsWith('/live/release') && response.ok());
    await moveNativeShape(editor, changedId, 35); await remoteReleased;
    const changed = await shapeBounds(editor, changedId);
    const connected = owner.waitForResponse(response => response.url().endsWith('/live/connect') && response.ok());
    await owner.getByRole('button', { name: 'Reconnect', exact: true }).click(); await connected;
    await expect(owner.getByRole('button', { name: 'Reconnect', exact: true })).toHaveCount(0);
    await expect.poll(() => shapeBounds(owner, changedId)).toBe(changed);
    await expect(owner.getByRole('button', { name: 'Undo', exact: true })).toBeEnabled();
    await owner.getByRole('button', { name: 'Undo', exact: true }).click();
    if (remote === 'independent') {
      for (const page of [owner, editor]) await expect.poll(() => shapeBounds(page, shape!)).toBe(original);
      await owner.getByRole('button', { name: 'Redo', exact: true }).click();
      for (const page of [owner, editor]) await expect.poll(() => shapeBounds(page, shape!)).toBe(moved);
    } else {
      await expect(owner.getByRole('status').filter({ hasText: "Skipped an undo step to preserve someone else's changes." })).toBeVisible();
      await expect(owner.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
    }
    for (const page of [owner, editor]) expect(await shapeBounds(page, changedId)).toBe(changed);
    await expect(owner.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
    await owner.reload(); await expect.poll(() => shapeBounds(owner, changedId)).toBe(changed);
    await expect(owner.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
    expect(identities.runtimeErrors).toEqual([]);
  } catch (error) { failure = error; throw error; }
  finally { try { await identities.close(); } catch (error) { if (!failure) throw error; } finally { await service.close(); } }
});
