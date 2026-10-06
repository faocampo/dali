import { randomUUID } from 'node:crypto';
import type { GfxController } from '@blocksuite/affine/std/gfx';
import type { ShapeElementModel } from '@blocksuite/affine/model';
import { test, expect } from './fixtures';
import { acceptanceService, createIdentityContexts } from './access-fixtures';
import { seedCollaborationShapes } from './collaboration-fixtures';
import { readRecoveryEpoch } from '../server/storage/recovery-state';

for (const boundary of ['save', 'release', 'competing-owner'] as const) test(`@05-02-02 explicit consecutive typography at ${boundary}`, async ({ browser, baseURL }) => {
  const service = await acceptanceService(baseURL!);
  const identities = await createIdentityContexts(browser, service.origin);
  let unblock = () => {};
  let failure: unknown;
  try {
    const ownerContext = identities.contexts.owner;
    const editorContext = identities.contexts.editor;
    const ownerAccount = (await (await ownerContext.request.get('/api/session')).json()).accountId;
    const editorAccount = (await (await editorContext.request.get('/api/session')).json()).accountId;
    const headers = { Origin: service.origin, 'X-Dali-Request': '1', 'X-Dali-Account': ownerAccount, 'X-Dali-Recovery-Epoch': readRecoveryEpoch(service.database) };
    const created = await ownerContext.request.post('/api/boards', { headers, data: { operationId: randomUUID(), title: 'Synthetic consecutive typography' } });
    expect(created.status()).toBe(201); const board = (await created.json()).summary.id as string;
    service.database.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?)').run(board, editorAccount, 'editor');
    const owner = ownerContext.pages()[0]!; const editor = editorContext.pages()[0]!;
    const [shape] = await seedCollaborationShapes(owner, service.database, board);
    for (const page of [owner, editor]) { await page.goto(`/?board=${board}`); await expect(page.locator('affine-edgeless-root')).toBeVisible(); }
    const point = await editor.locator('affine-edgeless-root').evaluate((element, id) => {
      const gfx = (element as HTMLElement & { gfx: GfxController }).gfx;
      const model = gfx.getElementById(id!) as ShapeElementModel;
      const [x, y] = gfx.viewport.toViewCoord(model.x + model.w / 2, model.y + model.h / 2);
      const rect = element.getBoundingClientRect(); return { x: x + rect.left, y: y + rect.top };
    }, shape);
    await editor.mouse.dblclick(point.x, point.y);
    await expect(editor.locator('edgeless-shape-text-editor [contenteditable=true]')).toBeFocused();
    await editor.keyboard.insertText('Synthetic text');
    const initialRelease = editor.waitForResponse(response => response.url().endsWith('/live/release') && response.ok());
    await editor.keyboard.press('Escape'); await initialRelease;
    const value = (page: typeof editor) => page.locator('affine-edgeless-root').evaluate((element, id) => {
      const model = (element as HTMLElement & { gfx: GfxController }).gfx.getElementById(id!) as ShapeElementModel;
      return { fontSize: model.fontSize, fontWeight: model.fontWeight };
    }, shape);

    let held!: () => void;
    const started = new Promise<void>(resolve => { held = resolve; });
    const gate = new Promise<void>(resolve => { unblock = resolve; });
    const url = boundary === 'save' ? '**/docs/*/push' : '**/live/release';
    let intercepted = false;
    let competingConnection: string | undefined; let competingToken: string | undefined;
    await editor.route(url, async route => {
      if (intercepted) { await route.continue(); return; }
      intercepted = true;
      const response = await route.fetch();
      expect(response.ok()).toBe(true);
      if (boundary === 'competing-owner') {
        const connected = await ownerContext.request.post(`/api/boards/${board}/live/connect`, { headers, data: { tabId: randomUUID() } });
        expect(connected.ok()).toBe(true); competingConnection = (await connected.json()).connectionId;
        const reserved = await ownerContext.request.post(`/api/boards/${board}/live/reserve`, { headers, data: { connectionId: competingConnection, objectIds: [shape] } });
        expect(reserved.ok()).toBe(true); competingToken = (await reserved.json()).token;
      }
      held(); await gate; await route.fulfill({ response });
    });
    await editor.getByRole('spinbutton', { name: 'Font size', exact: true }).fill('48');
    await editor.getByRole('spinbutton', { name: 'Font size', exact: true }).press('Enter');
    await started;
    await expect.poll(() => value(editor)).toMatchObject({ fontSize: 48 });
    // This is a new explicit input while the preceding local operation still
    // awaits acknowledgment. Its eventual admission must use a fresh lease.
    await editor.getByRole('combobox', { name: 'Font style', exact: true }).selectOption({ label: 'Bold' });
    const next = editor.waitForResponse(response => response.url().endsWith('/live/reserve') && response.status() === (boundary === 'competing-owner' ? 409 : 200), { timeout: 10000 });
    unblock(); await next;
    if (boundary === 'competing-owner') {
      await expect(editor.getByRole('status').filter({ hasText: 'Synthetic Owner is editing this object' })).toBeVisible();
      expect(await value(editor)).toEqual({ fontSize: 48, fontWeight: '400' });
      expect((await ownerContext.request.post(`/api/boards/${board}/live/release`, { headers, data: { connectionId: competingConnection, token: competingToken } })).ok()).toBe(true);
      // A fresh, unrelated format action acts as an ordering barrier. The
      // denied Bold must never be retried when its competitor releases.
      await editor.getByRole('spinbutton', { name: 'Font size', exact: true }).fill('49');
      await editor.getByRole('spinbutton', { name: 'Font size', exact: true }).press('Enter');
    }
    const expected = boundary === 'competing-owner' ? { fontSize: 49, fontWeight: '400' } : { fontSize: 48, fontWeight: '700' };
    for (const page of [editor, owner]) await expect.poll(() => value(page)).toEqual(expected);
    await expect(editor.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
    await editor.reload(); await expect.poll(() => value(editor)).toEqual(expected);
    expect(identities.runtimeErrors).toEqual(boundary === 'competing-owner' ? ['editor: Failed to load resource: the server responded with a status of 409 (Conflict)'] : []);
    identities.runtimeErrors.length = 0;
  } catch (error) { failure = error; throw error; }
  finally { unblock(); try { await identities.close(); } catch (error) { if (!failure) throw error; } finally { await service.close(); } }
});
