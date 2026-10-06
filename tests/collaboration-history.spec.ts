import { randomUUID } from 'node:crypto';
import type { GfxController } from '@blocksuite/affine/std/gfx';
import { test, expect } from './fixtures';
import { acceptanceService, createIdentityContexts } from './access-fixtures';
import { seedCollaborationShapes, shapeBounds, moveNativeShape } from './collaboration-fixtures';
import { readRecoveryEpoch } from '../server/storage/recovery-state';

test('@05-04-01 whole text session undo preserves independent movement and skips later conflicting text', async ({ browser, baseURL }) => {
  const service = await acceptanceService(baseURL!); const identities = await createIdentityContexts(browser, service.origin);
  try {
    const ownerAccount = (await (await identities.contexts.owner.request.get('/api/session')).json()).accountId;
    const editorAccount = (await (await identities.contexts.editor.request.get('/api/session')).json()).accountId;
    const created = await identities.contexts.owner.request.post('/api/boards', { headers: { Origin: service.origin, 'X-Dali-Request': '1', 'X-Dali-Account': ownerAccount, 'X-Dali-Recovery-Epoch': readRecoveryEpoch(service.database) }, data: { operationId: randomUUID(), title: 'Synthetic personal history' } });
    expect(created.status()).toBe(201); const board = await created.json();
    service.database.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?)').run(board.summary.id, editorAccount, 'editor');
    const owner = identities.contexts.owner.pages()[0]!; const editor = identities.contexts.editor.pages()[0]!;
    const [shape] = await seedCollaborationShapes(owner, service.database, board.summary.id);
    for (const page of [owner, editor]) { await page.goto(`/?board=${board.summary.id}`); await expect(page.locator('affine-edgeless-root')).toBeVisible(); }
    const readText = (page: typeof owner) => page.locator('affine-edgeless-root').evaluate((element, id) => {
      const model = (element as HTMLElement & { gfx: GfxController }).gfx.getElementById(id!)!;
      return 'text' in model ? String(model.text ?? '') : '';
    }, shape);
    const editText = async (page: typeof owner) => {
      const point = await page.locator('affine-edgeless-root').evaluate((element, id) => {
        const gfx = (element as HTMLElement & { gfx: GfxController }).gfx; const model = gfx.getElementById(id!)!;
        if (!('elementBound' in model)) throw new Error('Missing shape');
        const b = model.elementBound; const [x,y] = gfx.viewport.toViewCoord(b.x + b.w / 2, b.y + b.h / 2); const r = element.getBoundingClientRect();
        return { x: x+r.left, y:y+r.top };
      }, shape);
      await page.mouse.dblclick(point.x, point.y);
      await expect(page.locator('edgeless-shape-text-editor [contenteditable=true]')).toBeFocused();
    };
    const finish = async (page: typeof owner) => {
      const release = page.waitForResponse(response => response.url().endsWith('/live/release') && response.ok());
      await page.keyboard.press('Escape'); await release;
    };
    await editText(owner); await owner.keyboard.insertText('first');
    await owner.waitForTimeout(750); // Deliberately exceed the native history capture timeout.
    await owner.keyboard.insertText(' second'); await finish(owner);
    await expect.poll(() => readText(editor)).toBe('first second');
    await moveNativeShape(editor, shape!, 60);
    await expect(editor.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
    const moved = await shapeBounds(editor, shape!); await expect.poll(() => shapeBounds(owner, shape!)).toBe(moved);
    await owner.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect.poll(() => readText(owner)).toBe(''); await expect.poll(() => readText(editor)).toBe('');
    expect(await shapeBounds(owner, shape!)).toBe(moved);
    await owner.getByRole('button', { name: 'Redo', exact: true }).click();
    await expect.poll(() => readText(editor)).toBe('first second');
    await editText(editor); await editor.keyboard.press('ControlOrMeta+a'); await editor.keyboard.insertText('remote replacement'); await finish(editor);
    await expect.poll(() => readText(owner)).toBe('remote replacement');
    await owner.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(owner.getByRole('status').filter({ hasText: "Skipped an undo step to preserve someone else's changes." })).toBeVisible();
    expect(await readText(owner)).toBe('remote replacement'); expect(await readText(editor)).toBe('remote replacement');
    expect(identities.runtimeErrors).toEqual([]);
  } finally { try { await identities.close(); } finally { await service.close(); } }
});
