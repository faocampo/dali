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

for (const scenario of ['delete', 'created-conflict', 'group-conflict', 'same-account-tab', 'redo-conflict'] as const) test(`@05-04-02 ${scenario} preserves personal history boundaries`, async ({ browser, baseURL }) => {
  const service = await acceptanceService(baseURL!); const identities = await createIdentityContexts(browser, service.origin);
  try {
    const ownerAccount = (await (await identities.contexts.owner.request.get('/api/session')).json()).accountId;
    const editorAccount = (await (await identities.contexts.editor.request.get('/api/session')).json()).accountId;
    const created = await identities.contexts.owner.request.post('/api/boards', { headers: { Origin: service.origin, 'X-Dali-Request': '1', 'X-Dali-Account': ownerAccount, 'X-Dali-Recovery-Epoch': readRecoveryEpoch(service.database) }, data: { operationId: randomUUID(), title: 'Synthetic history boundaries' } });
    expect(created.status()).toBe(201); const board = await created.json();
    service.database.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?)').run(board.summary.id, editorAccount, 'editor');
    const owner = identities.contexts.owner.pages()[0]!;
    const other = scenario === 'same-account-tab' ? await identities.contexts.owner.newPage() : identities.contexts.editor.pages()[0]!;
    const [shape, independent] = await seedCollaborationShapes(owner, service.database, board.summary.id);
    for (const page of [owner, other]) { await page.goto(`/?board=${board.summary.id}`); await expect(page.locator('affine-edgeless-root')).toBeVisible(); }
    const ids = (page: typeof owner) => page.locator('affine-edgeless-root').evaluate(element => (element as HTMLElement & { gfx: GfxController }).gfx.gfxElements.map(model => model.id).sort());
    const saved = async (page: typeof owner) => { await expect(page.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible(); };
    const select = async (page: typeof owner, id: string) => {
      const point = await page.locator('affine-edgeless-root').evaluate((element, objectId) => {
        const gfx = (element as HTMLElement & { gfx: GfxController }).gfx; const model = gfx.getElementById(objectId)!;
        if (!('elementBound' in model)) throw new Error('Missing shape');
        const b = model.elementBound; const [x,y] = gfx.viewport.toViewCoord(b.x+b.w/2,b.y+b.h/2); const r=element.getBoundingClientRect(); return {x:x+r.left,y:y+r.top};
      },id);
      await page.mouse.click(point.x,point.y);
      await expect.poll(() => page.locator('affine-edgeless-root').evaluate(element => (element as HTMLElement & { gfx: GfxController }).gfx.selection.selectedElements.map(model => model.id))).toEqual([id]);
      await page.locator('editor-host').focus();
    };
    await expect(owner.getByRole('button', { name:'Undo', exact:true })).toBeDisabled();
    const before = await shapeBounds(owner, independent!);
    await moveNativeShape(owner, independent!, 45); await saved(owner);
    const moved = await shapeBounds(owner, independent!); await expect.poll(() => shapeBounds(other,independent!)).toBe(moved);
    if (scenario === 'delete') {
      await select(owner, shape!); await owner.keyboard.press('Backspace');
      await expect.poll(() => ids(other)).toEqual([independent]); await saved(owner);
      await owner.getByRole('button',{name:'Undo',exact:true}).click();
      await expect.poll(() => ids(other)).toEqual([shape!,independent!].sort());
      await owner.getByRole('button',{name:'Redo',exact:true}).click();
      await expect.poll(() => ids(other)).toEqual([independent]);
    } else if (scenario === 'redo-conflict') {
      await owner.getByRole('button',{name:'Undo',exact:true}).click();
      await expect.poll(() => shapeBounds(other,independent!)).toBe(before);
      await moveNativeShape(other,independent!,80); await saved(other);
      const remote = await shapeBounds(other,independent!); await expect.poll(() => shapeBounds(owner,independent!)).toBe(remote);
      await owner.setViewportSize({width:360,height:800});
      await owner.getByRole('button',{name:'Redo',exact:true}).click();
      const status = owner.getByRole('status').filter({hasText:'Skipped a redo step'});
      await expect(status).toBeVisible();
      const box = await status.boundingBox(); expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x+box!.width).toBeLessThanOrEqual(360);
      await expect(status).not.toBeFocused();
      expect(await shapeBounds(owner,independent!)).toBe(remote);
      await expect(owner.getByRole('button',{name:'Redo',exact:true})).toBeDisabled();
    } else if (scenario === 'same-account-tab') {
      await expect(other.getByRole('button',{name:'Undo',exact:true})).toBeDisabled();
      await moveNativeShape(other,independent!,45); await saved(other);
      const remote = await shapeBounds(other,independent!); await expect.poll(() => shapeBounds(owner,independent!)).toBe(remote);
      await owner.getByRole('button',{name:'Undo',exact:true}).click();
      await expect(owner.getByRole('status').filter({hasText:"Skipped an undo step"})).toBeVisible();
      expect(await shapeBounds(other,independent!)).toBe(remote);
      await expect(owner.getByRole('button',{name:'Undo',exact:true})).toBeDisabled();
      await other.reload(); await expect(other.locator('affine-edgeless-root')).toBeVisible();
      await expect(other.getByRole('button',{name:'Undo',exact:true})).toBeDisabled();
      await expect(other.getByRole('button',{name:'Redo',exact:true})).toBeDisabled();
    } else {
      await select(owner,shape!);
      if (scenario === 'group-conflict') {
        await owner.locator('editor-host').focus(); await owner.keyboard.press('ControlOrMeta+a');
        await expect.poll(() => owner.locator('affine-edgeless-root').evaluate(element => (element as HTMLElement & { gfx: GfxController }).gfx.selection.selectedElements.length)).toBe(2);
      }
      await owner.keyboard.press(scenario === 'group-conflict' ? 'ControlOrMeta+g' : 'ControlOrMeta+d');
      await expect.poll(() => ids(other)).toHaveLength(3); await saved(owner);
      const all = await ids(other); const added = all.find(id => id !== shape && id !== independent)!;
      await moveNativeShape(other,added,90); await saved(other);
      const foreign = await shapeBounds(other,added); await expect.poll(() => shapeBounds(owner,added)).toBe(foreign);
      await owner.getByRole('button',{name:'Undo',exact:true}).click();
      await expect(owner.getByRole('status').filter({hasText:"Skipped an undo step"})).toBeVisible();
      expect(await ids(owner)).toEqual(all); expect(await shapeBounds(owner,added)).toBe(foreign);
      if (scenario === 'created-conflict') await expect.poll(() => shapeBounds(other,independent!)).toBe(before);
    }
    expect(identities.runtimeErrors).toEqual([]);
  } finally { try { await identities.close(); } finally { await service.close(); } }
});
