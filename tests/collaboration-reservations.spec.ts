import { randomUUID } from 'node:crypto';
import type { GfxController, GfxModel } from '@blocksuite/affine/std/gfx';
import { test, expect } from './fixtures';
import { acceptanceService, createIdentityContexts, syntheticCanaries } from './access-fixtures';
import { seedCollaborationShapes, shapeBounds, moveNativeShape } from './collaboration-fixtures';
import { readRecoveryEpoch } from '../server/storage/recovery-state';
import { openObjectActions } from './object-actions';
import { editBoardTitle } from './app-menu';

for (const action of ['text-session', 'delete', 'note', 'image', 'drawing', 'formatting', 'resize', 'rotate', 'duplicate', 'group', 'align', 'paste', 'frame', 'freehand', 'text', 'history', 'connector', 'populated-frame', 'layer', 'lock', 'rename', 'thickness', 'typography', 'cut', 'rename-race', 'native-duplicate', 'native-frame', 'eraser', 'note-size', 'image-edit', 'connector-retarget', 'connector-quick-add', 'native-group', 'native-group-lock', 'cancel-acquisition', 'frame-transform', 'disconnect-release', 'frame-resize', 'release-from-group', 'footprint-revalidation'] as const) test(`${action !== 'text-session' ? '@05-02-02' : '@05-02-01'} a native text session fences ${action === 'text-session' ? 'competing movement' : `${action} after release`}`, async ({ browser, baseURL }) => {
  const service = await acceptanceService(baseURL!); const identities = await createIdentityContexts(browser, service.origin);
  let failure: unknown;
  let releaseGesture = () => {};
  try {
    const ownerAccount = (await (await identities.contexts.owner.request.get('/api/session')).json()).accountId;
    const editorAccount = (await (await identities.contexts.editor.request.get('/api/session')).json()).accountId;
    const created = await identities.contexts.owner.request.post('/api/boards', { headers: { Origin: service.origin, 'X-Dali-Request': '1', 'X-Dali-Account': ownerAccount, 'X-Dali-Recovery-Epoch': readRecoveryEpoch(service.database) }, data: { operationId: randomUUID(), title: 'Synthetic text reservation' } });
    expect(created.status()).toBe(201); const board = await created.json();
    service.database.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?)').run(board.summary.id, editorAccount, 'editor');
    const owner = identities.contexts.owner.pages()[0]!; const editor = identities.contexts.editor.pages()[0]!;
    const [shape, independent, third] = await seedCollaborationShapes(owner, service.database, board.summary.id, action === 'connector-retarget' || action === 'frame-resize' || action === 'footprint-revalidation' ? [0, 400, 800] : undefined);
    for (const page of [owner, editor]) { await page.goto(`/?board=${board.summary.id}`); await expect(page.locator('affine-edgeless-root')).toBeVisible(); }
    const point = async (page: typeof owner, objectId = shape) => page.locator('affine-edgeless-root').evaluate((element, id) => {
      const gfx = (element as HTMLElement & { gfx: GfxController }).gfx; const model = gfx.getElementById(id!)!;
      if (!('elementBound' in model)) throw new Error('Missing native bound');
      const bound = model.elementBound; const [x, y] = gfx.viewport.toViewCoord(bound.x + bound.w / 2, bound.y + bound.h / 2); const rect = element.getBoundingClientRect();
      return { x: x + rect.left, y: y + rect.top };
    }, objectId);
    const position = await point(owner); await owner.mouse.dblclick(position.x, position.y);
    await expect(owner.locator('edgeless-shape-text-editor [contenteditable=true]')).toBeFocused();
    await owner.keyboard.insertText('Shared text session');
    await expect(owner.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
    const before = await shapeBounds(editor, shape!); const conflict = editor.waitForResponse(response => response.url().endsWith('/live/reserve') && response.status() === 409, { timeout: 10000 });
    const other = await point(editor); await editor.mouse.move(other.x, other.y); await editor.mouse.down(); await conflict;
    await editor.mouse.move(other.x + 70, other.y + 35); await editor.mouse.up();
    await expect(editor.getByRole('status').filter({ hasText: 'Synthetic Owner is editing this object' })).toBeVisible();
    expect(await shapeBounds(editor, shape!)).toBe(before);
    await moveNativeShape(editor, independent!, -40);
    expect(await shapeBounds(editor, shape!)).toBe(before);
    if (action === 'group') {
      await editor.locator('editor-host').focus(); await editor.keyboard.press('ControlOrMeta+a');
      const deniedGroup = editor.waitForResponse(response => response.url().endsWith('/live/reserve') && response.status() === 409, { timeout: 10000 });
      await editor.keyboard.press('ControlOrMeta+g'); await deniedGroup;
      await expect(editor.getByRole('status').filter({ hasText: 'Synthetic Owner is editing this object' })).toBeVisible();
      expect(await editor.locator('affine-edgeless-root').evaluate(element => (element as HTMLElement & { gfx: GfxController }).gfx.gfxElements.length)).toBe(2);
    }
    if (action === 'connector') {
      const start = await point(editor); const finish = await point(editor, independent);
      await editor.getByRole('button', { name: 'Lines', exact: true }).click(); await editor.getByRole('button', { name: 'Straight arrow', exact: true }).click();
      await editor.mouse.move(start.x, start.y); await editor.mouse.down(); await editor.mouse.move(finish.x, finish.y, { steps: 8 });
      await expect(editor.locator('.live-creation-preview')).toBeVisible();
      await editor.keyboard.press('Escape'); await editor.mouse.up(); await expect(editor.locator('.live-creation-preview')).toHaveCount(0);
      expect(await editor.locator('affine-edgeless-root').evaluate(element => (element as HTMLElement & { gfx: GfxController }).gfx.gfxElements.length)).toBe(2);
      await editor.getByRole('button', { name: 'Lines', exact: true }).click(); await editor.getByRole('button', { name: 'Straight arrow', exact: true }).click();
      await editor.mouse.move(start.x, start.y); await editor.mouse.down(); await editor.mouse.move(finish.x, finish.y, { steps: 8 });
      const deniedConnector = editor.waitForResponse(response => response.url().endsWith('/live/reserve') && response.status() === 409, { timeout: 10000 });
      await editor.mouse.up(); await deniedConnector;
      await expect(editor.getByRole('status').filter({ hasText: 'Synthetic Owner is editing this object' })).toBeVisible();
      for (const page of [owner, editor]) expect(await page.locator('affine-edgeless-root').evaluate(element => (element as HTMLElement & { gfx: GfxController }).gfx.gfxElements.length)).toBe(2);
      await editor.getByRole('button', { name: 'Select', exact: true }).click();
    }
    if (action === 'eraser') {
      const start = await point(editor); const end = await point(editor, independent);
      await editor.getByRole('button', { name: 'Freehand', exact: true }).click(); await editor.getByRole('button', { name: 'Eraser', exact: true }).click();
      await editor.mouse.move(start.x - 100, start.y); await editor.mouse.down(); await editor.mouse.move(end.x + 100, end.y, { steps: 15 });
      const deniedErase = editor.waitForResponse(response => response.url().endsWith('/live/reserve') && response.status() === 409, { timeout: 10000 });
      await editor.mouse.up(); await deniedErase;
      await expect(editor.getByRole('status').filter({ hasText: 'Synthetic Owner is editing this object' })).toBeVisible();
      for (const page of [owner, editor]) expect(await page.locator('affine-edgeless-root').evaluate(element => (element as HTMLElement & { gfx: GfxController }).gfx.gfxElements.map(model => 'opacity' in model ? model.opacity : undefined))).toEqual([1, 1]);
      await editor.getByRole('button', { name: 'Select', exact: true }).click();
    }
    if (action === 'disconnect-release') {
      await owner.goto('/');
      await expect(owner.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
      await moveNativeShape(editor, shape!, 50);
      await expect.poll(() => shapeBounds(editor, shape!)).not.toBe(before);
      const moved = await shapeBounds(editor, shape!);
      await expect(editor.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
      await owner.goto(`/?board=${board.summary.id}`);
      await expect.poll(() => shapeBounds(owner, shape!)).toBe(moved);
      expect(identities.runtimeErrors).toEqual(['editor: Failed to load resource: the server responded with a status of 409 (Conflict)']);
      identities.runtimeErrors.length = 0;
      return;
    }
    const released = owner.waitForResponse(response => response.url().endsWith('/live/release') && response.ok(), { timeout: 10000 });
    await owner.keyboard.press('Escape'); await released;
    let releaseStarted: Promise<void> | undefined;
    if (action === 'delete') {
      let started!: () => void;
      releaseStarted = new Promise<void>(resolve => { started = resolve; });
      const gate = new Promise<void>(resolve => { releaseGesture = resolve; });
      await editor.route('**/live/release', async route => { started(); await gate; await route.continue(); });
    }
    await moveNativeShape(editor, shape!, 50);
    await expect.poll(() => shapeBounds(editor, shape!)).not.toBe(before);
    if (action === 'cancel-acquisition') {
      await expect(editor.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
      const unchanged = await shapeBounds(editor, shape!);
      await expect.poll(() => shapeBounds(owner, shape!)).toBe(unchanged);
      let admitted!: () => void;
      const acquired = new Promise<void>(resolve => { admitted = resolve; });
      const gate = new Promise<void>(resolve => { releaseGesture = resolve; });
      await editor.route('**/live/reserve', async route => {
        const response = await route.fetch();
        expect(response.status()).toBe(200); admitted();
        await gate; await route.fulfill({ response });
      });
      const at = await point(editor);
      await editor.locator('editor-host').focus();
      await editor.mouse.move(at.x, at.y); await editor.mouse.down(); await acquired;
      await editor.mouse.move(at.x + 100, at.y + 30, { steps: 8 });
      await editor.keyboard.press('Escape'); await editor.mouse.up();
      const releasedCancelled = editor.waitForResponse(response => response.url().endsWith('/live/release') && response.ok());
      releaseGesture(); await releasedCancelled;
      for (const page of [owner, editor]) expect(await shapeBounds(page, shape!)).toBe(unchanged);
      await editor.unroute('**/live/reserve');
      await moveNativeShape(owner, shape!, 35);
      await expect.poll(() => shapeBounds(owner, shape!)).not.toBe(unchanged);
      const moved = await shapeBounds(owner, shape!);
      await expect.poll(() => shapeBounds(editor, shape!)).toBe(moved);
    }
    if (action === 'delete') {
      await releaseStarted;
      await editor.keyboard.press('Delete');
      releaseGesture();
      for (const page of [owner, editor]) await expect.poll(() => page.locator('affine-edgeless-root').evaluate((element, id) => {
        const gfx = (element as HTMLElement & { gfx: GfxController }).gfx; return !!gfx.getElementById(id!);
      }, shape)).toBe(false);
    }

    if (action === 'native-duplicate' || action === 'native-frame' || action === 'eraser') {
      const objects = (page: typeof editor) => page.locator('affine-edgeless-root').evaluate(element => (element as HTMLElement & { gfx: GfxController }).gfx.gfxElements.map(model => ({ id: model.id, type: 'type' in model ? model.type : model.flavour })).sort((a, b) => a.id.localeCompare(b.id)));
      if (action === 'eraser') {
        await editor.getByRole('button', { name: 'Freehand', exact: true }).click(); await editor.getByRole('button', { name: 'Eraser', exact: true }).click();
        const center = await point(editor);
        await editor.mouse.move(center.x - 100, center.y); await editor.mouse.down(); await editor.mouse.move(center.x + 100, center.y, { steps: 10 }); await editor.mouse.up();
        await expect.poll(() => objects(editor)).toHaveLength(1);
      } else {
        await editor.getByRole('button', { name: 'More', exact: true }).click({ timeout: 10000 });
        await editor.getByRole('button', { name: action === 'native-duplicate' ? 'Duplicate' : 'Frame selection', exact: true }).click({ timeout: 10000 });
        await expect.poll(() => objects(editor)).toHaveLength(3);
        if (action === 'native-frame') expect((await objects(editor)).some(model => model.type === 'affine:frame')).toBe(true);
      }
      const expected = await objects(editor); await expect.poll(() => objects(owner)).toEqual(expected);
    }

    if (action === 'native-group' || action === 'native-group-lock' || action === 'release-from-group') {
      const objects = (page: typeof editor) => page.locator('affine-edgeless-root').evaluate(element =>
        (element as HTMLElement & { gfx: GfxController }).gfx.gfxElements.map(model => ({
          id: model.id, type: 'type' in model ? model.type : model.flavour, locked: model.isLocked(),
        })).sort((a, b) => a.id.localeCompare(b.id)));
      await expect(editor.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
      await editor.locator('editor-host').focus(); await editor.keyboard.press('ControlOrMeta+a');
      await editor.getByRole('button', { name: action === 'native-group-lock' ? 'Lock' : 'Group', exact: true }).click();
      await expect.poll(() => objects(editor)).toHaveLength(3);
      const expected = await objects(editor);
      expect(expected.filter(model => model.type === 'group')).toHaveLength(1);
      expect(expected.find(model => model.type === 'group')!.locked).toBe(action === 'native-group-lock');
      await expect.poll(() => objects(owner)).toEqual(expected);
      await expect(editor.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
      if (action === 'release-from-group') {
        await editor.locator('affine-edgeless-root').evaluate((element, id) => {
          (element as HTMLElement & { gfx: GfxController }).gfx.selection.set({ elements: [id!], editing: false });
        }, shape);
        await editor.getByRole('button', { name: 'Release from group', exact: true }).click();
        const membership = (page: typeof editor) => page.locator('affine-edgeless-root').evaluate((element, id) => {
          const model = (element as HTMLElement & { gfx: GfxController }).gfx.getElementById(id!) as import('@blocksuite/affine/model').ShapeElementModel;
          return model.group?.id ?? null;
        }, shape);
        for (const page of [editor, owner]) await expect.poll(() => membership(page)).toBeNull();
      } else {
      // Native multi-object locking creates a temporary group; unlocking releases it.
      await editor.getByRole('button', { name: action === 'native-group-lock' ? 'Click to unlock' : 'Ungroup', exact: true }).click();
      await expect.poll(() => objects(editor)).toHaveLength(2);
      const ungrouped = await objects(editor); await expect.poll(() => objects(owner)).toEqual(ungrouped);
      }
    }

    if (action === 'thickness' || action === 'typography') {
      const value = (page: typeof editor) => page.locator('affine-edgeless-root').evaluate((element, args) => {
        const model = (element as HTMLElement & { gfx: GfxController }).gfx.getElementById(args.id!) as import('@blocksuite/affine/model').ShapeElementModel;
        return args.action === 'thickness' ? model.strokeWidth : { fontSize: model.fontSize, fontWeight: model.fontWeight };
      }, { id: shape, action });
      if (action === 'thickness') {
        await editor.getByRole('button', { name: 'Color', exact: true }).click();
        await editor.getByRole('spinbutton', { name: 'Thickness', exact: true }).fill('7');
        await expect.poll(() => value(editor)).toBe(7);
      } else {
        await editor.getByRole('spinbutton', { name: 'Font size', exact: true }).fill('48');
        await editor.getByRole('spinbutton', { name: 'Font size', exact: true }).press('Enter');
        await expect.poll(() => value(editor)).toMatchObject({ fontSize: 48 });
        await editor.getByRole('combobox', { name: 'Font style', exact: true }).selectOption({ label: 'Bold' });
        await expect.poll(() => value(editor)).toMatchObject({ fontWeight: '700' });
      }
      const expected = await value(editor); await expect.poll(() => value(owner)).toEqual(expected);
    }
    if (action === 'cut') {
      await editor.context().grantPermissions(['clipboard-read', 'clipboard-write']);
      await editor.locator('editor-host').focus(); await editor.keyboard.press('ControlOrMeta+x');
      for (const page of [owner, editor]) await expect.poll(() => page.locator('affine-edgeless-root').evaluate((element, id) => !!(element as HTMLElement & { gfx: GfxController }).gfx.getElementById(id!), shape)).toBe(false);
      expect(await editor.evaluate(async () => (await navigator.clipboard.read()).some(item => item.types.includes('text/html')))).toBe(true);
    }

    if (action === 'rename-race') {
      let committed!: () => void;
      const written = new Promise<void>(resolve => { committed = resolve; });
      const responseGate = new Promise<void>(resolve => { releaseGesture = resolve; });
      await editor.route(`**/api/boards/${board.summary.id}`, async route => {
        if (route.request().method() !== 'PATCH') { await route.continue(); return; }
        const response = await route.fetch(); committed(); await responseGate; await route.fulfill({ response });
      });
      const first = await editBoardTitle(editor); await first.fill('Synthetic first rename'); await first.press('Enter'); await written;
      await expect(owner.getByRole('button', { name: /^Rename board:/ })).toHaveText('Synthetic first rename');
      const delivered = editor.waitForResponse(async response => response.url().endsWith('/live/poll') && response.ok() && (await response.json()).title === 'Synthetic later rename');
      const second = await editBoardTitle(owner); await second.fill('Synthetic later rename'); await second.press('Enter'); await delivered;
      releaseGesture();
      for (const page of [owner, editor]) await expect(page.getByRole('button', { name: /^Rename board:/ })).toHaveText('Synthetic later rename');
    }

    if (action === 'rename') {
      const title = await editBoardTitle(editor); await title.fill('Synthetic shared renamed board'); await title.press('Enter');
      await expect.poll(() => service.database.prepare('SELECT title FROM boards WHERE id=?').get(board.summary.id)).toEqual({ title: 'Synthetic shared renamed board' });
      for (const page of [owner, editor]) await expect(page.getByRole('button', { name: /^Rename board:/ })).toHaveText('Synthetic shared renamed board');
    }

    if (action === 'layer' || action === 'lock') {
      const value = (page: typeof editor) => page.locator('affine-edgeless-root').evaluate((element, id) => {
        const model = (element as HTMLElement & { gfx: GfxController }).gfx.getElementById<GfxModel>(id!)!;
        return { index: model.index, locked: model.isLocked() };
      }, shape);
      const original = await value(editor);
      await openObjectActions(editor);
      await editor.getByRole('menuitem', { name: action === 'layer' ? 'To front' : 'Lock object', exact: true }).click();
      await expect.poll(() => value(editor)).not.toEqual(original);
      const expected = await value(editor); await expect.poll(() => value(owner)).toEqual(expected);
      if (action === 'lock') {
        expect(expected.locked).toBe(true);
        await editor.getByRole('menuitem', { name: 'Unlock object', exact: true }).click();
        await expect.poll(() => value(editor)).toEqual(original); await expect.poll(() => value(owner)).toEqual(original);
      }
    }

    if (action === 'connector' || action === 'connector-retarget' || action === 'connector-quick-add' || action === 'populated-frame' || action === 'frame-transform' || action === 'frame-resize' || action === 'footprint-revalidation') {
      const isConnector = action !== 'populated-frame' && action !== 'frame-transform' && action !== 'frame-resize' && action !== 'footprint-revalidation';
      const bounds = [JSON.parse(await shapeBounds(editor, shape!)), JSON.parse(await shapeBounds(editor, independent!))] as number[][];
      const positions = await editor.locator('affine-edgeless-root').evaluate((element, boxes) => {
        const gfx = (element as HTMLElement & { gfx: GfxController }).gfx; const rect = element.getBoundingClientRect();
        return boxes.map(([x, y, w, h]) => { const top = gfx.viewport.toViewCoord(x! - 30, y! - 30); const bottom = gfx.viewport.toViewCoord(x! + w! + 30, y! + h! + 30); return { x: top[0] + rect.x, y: top[1] + rect.y, right: bottom[0] + rect.x, bottom: bottom[1] + rect.y }; });
      }, bounds);
      if (isConnector) {
        await editor.getByRole('button', { name: 'Lines', exact: true }).click(); await editor.getByRole('button', { name: 'Straight arrow', exact: true }).click();
      } else await editor.getByRole('button', { name: 'Frame', exact: true }).click();
      const from = isConnector ? { x: (positions[0]!.x + positions[0]!.right) / 2, y: (positions[0]!.y + positions[0]!.bottom) / 2 } : { x: Math.min(...positions.map(p => p.x)), y: Math.min(...positions.map(p => p.y)) };
      const to = isConnector ? { x: (positions[1]!.x + positions[1]!.right) / 2, y: (positions[1]!.y + positions[1]!.bottom) / 2 } : { x: Math.max(...positions.map(p => p.right)), y: Math.max(...positions.map(p => p.bottom)) };
      if (action === 'frame-resize') from.y -= 60;
      if (action === 'connector-quick-add') to.y += 220;
      let admitted: Promise<void> | undefined;
      if (action === 'footprint-revalidation') {
        let signal = () => {};
        admitted = new Promise<void>(resolve => { signal = resolve; });
        const gate = new Promise<void>(resolve => { releaseGesture = resolve; });
        await editor.route('**/live/reserve', async route => {
          const response = await route.fetch(); expect(response.status()).toBe(200);
          signal(); await gate; await route.fulfill({ response });
        });
      }
      await editor.mouse.move(from.x, from.y); await editor.mouse.down(); await editor.mouse.move(to.x, to.y, { steps: 8 }); await editor.mouse.up();
      if (action === 'footprint-revalidation') {
        await admitted;
        await owner.getByRole('button', { name: 'Fit to screen', exact: true }).click();
        const dx = await owner.locator('affine-edgeless-root').evaluate(element =>
          -550 * (element as HTMLElement & { gfx: GfxController }).gfx.viewport.zoom);
        await moveNativeShape(owner, third!, dx);
        await expect(owner.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
        await expect.poll(() => shapeBounds(editor, third!)).toBe(await shapeBounds(owner, third!));
        releaseGesture();
        await expect(editor.getByRole('status').filter({ hasText: 'Objects changed while waiting. Draw again.' })).toBeVisible();
        for (const page of [editor, owner]) expect(await page.locator('affine-frame').count()).toBe(0);
        expect(identities.runtimeErrors).toEqual(['editor: Failed to load resource: the server responded with a status of 409 (Conflict)']);
        identities.runtimeErrors.length = 0;
        return;
      }

      const result = (page: typeof editor) => page.locator('affine-edgeless-root').evaluate((element, type) => {
        const gfx = (element as HTMLElement & { gfx: GfxController }).gfx;
        const model = gfx.gfxElements.find(model => 'type' in model ? model.type === type : model.flavour === type);
        if (!model) return null;
        if ('type' in model && model.type === 'connector') { const line = model as import('@blocksuite/affine/model').ConnectorElementModel; return { id: line.id, ids: [line.source.id, line.target.id].filter((id): id is string => typeof id === 'string').sort() }; }
        return { id: model.id, ids: (model as import('@blocksuite/affine/model').FrameBlockModel).childElements.map(child => child.id).sort() };
      }, isConnector ? 'connector' : 'affine:frame');
      await expect.poll(async () => (await result(editor))?.ids).toEqual(action === 'connector-quick-add' ? [shape] : [shape, independent].sort());
      const expected = await result(editor); await expect.poll(() => result(owner)).toEqual(expected);
      if (action === 'frame-resize') {
        await editor.getByRole('button', { name: 'Fit to screen', exact: true }).click();
        await expect(editor.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
        const handle = await editor.locator('.handle[aria-label="bottom-right"] .resize').first().boundingBox(); expect(handle).not.toBeNull();
        const target = await point(editor, third);
        await editor.mouse.move(handle!.x + handle!.width / 2, handle!.y + handle!.height / 2); await editor.mouse.down();
        expect(target.x + 100).toBeLessThan(editor.viewportSize()!.width);
        await editor.mouse.move(target.x + 100, target.y + 100, { steps: 12 });
        await expect(editor.locator('.live-creation-preview')).toBeVisible();
        await editor.mouse.up();
        for (const page of [editor, owner]) await expect.poll(async () => (await result(page))?.ids).toEqual([shape, independent, third].sort());
      }
      if (action === 'frame-transform') {
        await expect(editor.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
        const frameId = expected!.id;
        const frameState = (page: typeof editor) => page.locator('affine-edgeless-root').evaluate((element, id) => {
          const gfx = (element as HTMLElement & { gfx: GfxController }).gfx;
          const frame = gfx.getElementById(id) as import('@blocksuite/affine/model').FrameBlockModel | undefined;
          return frame ? { bounds: frame.xywh, children: frame.childElements.map(m => ({ id: m.id, xywh: m.xywh })).sort((a,b) => a.id.localeCompare(b.id)) } : null;
        }, frameId);
        const original = await frameState(editor);
        // Native frame titles drag the frame together with its children.
        const titleBox = await editor.locator('affine-frame-title').boundingBox(); expect(titleBox).not.toBeNull();
        const edge = { x: titleBox!.x + titleBox!.width / 2, y: titleBox!.y + titleBox!.height / 2 };
        const admitted = editor.waitForResponse(r => r.url().endsWith('/live/reserve') && r.ok());
        await editor.mouse.move(edge.x, edge.y); await editor.mouse.down(); await admitted;
        await editor.mouse.move(edge.x + 40, edge.y + 60, { steps: 8 }); await editor.mouse.up();
        await expect.poll(() => frameState(editor)).not.toEqual(original);
        const moved = await frameState(editor); expect(moved!.children).not.toEqual(original!.children);
        await expect.poll(() => frameState(owner)).toEqual(moved);
        await expect(editor.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
        await editor.keyboard.press('Delete');
        for (const page of [owner, editor]) await expect.poll(() => frameState(page)).toBeNull();
      }
      if (action === 'connector-quick-add') {
        await editor.getByRole('button', { name: 'Add shape at connector end', exact: true }).click();
        await expect.poll(async () => (await result(editor))?.ids.length).toBe(2);
        const connected = await result(editor); expect(connected?.ids).toContain(shape);
        await expect.poll(() => result(owner)).toEqual(connected);
        for (const page of [owner, editor]) expect(await page.locator('affine-edgeless-root').evaluate(element => (element as HTMLElement & { gfx: GfxController }).gfx.gfxElements.length)).toBe(4);
      }
      if (action === 'connector-retarget') {
        const target = await point(owner, third); await owner.mouse.dblclick(target.x, target.y);
        await expect(owner.locator('edgeless-shape-text-editor [contenteditable=true]')).toBeFocused(); await owner.keyboard.insertText('Reserved destination');
        await expect(owner.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
        const dragEnd = async () => {
          const handle = await editor.locator('edgeless-connector-handle .line-end').boundingBox(); expect(handle).not.toBeNull();
          const destination = await point(editor, third);
          await editor.mouse.move(handle!.x + handle!.width / 2, handle!.y + handle!.height / 2); await editor.mouse.down(); await editor.mouse.move(destination.x, destination.y, { steps: 10 }); await editor.mouse.up();
        };
        const denied = editor.waitForResponse(response => response.url().endsWith('/live/reserve') && response.status() === 409, { timeout: 10000 });
        await dragEnd(); await denied;
        for (const page of [owner, editor]) expect(await result(page)).toEqual(expected);
        const release = owner.waitForResponse(response => response.url().endsWith('/live/release') && response.ok(), { timeout: 10000 }); await owner.keyboard.press('Escape'); await release;
        await dragEnd();
        for (const page of [owner, editor]) await expect.poll(async () => (await result(page))?.ids).toEqual([shape, third].sort());
      }

    }

    if (action === 'history') {
      await expect(editor.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
      const moved = await shapeBounds(editor, shape!);
      await editor.mouse.click(950, 650);
      const undoGate = new Promise<void>(resolve => { releaseGesture = resolve; });
      await editor.route('**/live/release', async route => { if (await shapeBounds(editor, shape!) === before) await undoGate; await route.continue(); });
      await editor.keyboard.press('ControlOrMeta+z');
      await expect.poll(() => shapeBounds(editor, shape!)).toBe(before);
      await expect.poll(() => shapeBounds(owner, shape!)).toBe(before);
      await editor.keyboard.press('ControlOrMeta+Shift+z');
      releaseGesture();
      await expect.poll(() => shapeBounds(editor, shape!)).toBe(moved);
      await expect.poll(() => shapeBounds(owner, shape!)).toBe(moved);
    }

    if (action === 'align') {
      await editor.locator('editor-host').focus(); await editor.keyboard.press('ControlOrMeta+a');
      await openObjectActions(editor);
      await editor.getByRole('menuitem', { name: 'Align left', exact: true }).click();
      const positions = async (page: typeof editor) => [JSON.parse(await shapeBounds(page, shape!))[0], JSON.parse(await shapeBounds(page, independent!))[0]];
      await expect.poll(async () => new Set(await positions(editor)).size).toBe(1);
      const expected = await positions(editor); await expect.poll(() => positions(owner)).toEqual(expected);
    }

    if (action === 'duplicate' || action === 'group' || action === 'paste') {
      await expect(editor.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
      const objects = (page: typeof editor) => page.locator('affine-edgeless-root').evaluate(element => {
        const gfx = (element as HTMLElement & { gfx: GfxController }).gfx;
        return gfx.gfxElements.map(model => ({ id: model.id, type: 'type' in model ? model.type : model.flavour })).sort((a, b) => a.id.localeCompare(b.id));
      });
      await editor.locator('editor-host').focus();
      if (action === 'group') await editor.keyboard.press('ControlOrMeta+a');
      if (action === 'paste') {
        await editor.context().grantPermissions(['clipboard-read', 'clipboard-write']);
        await editor.keyboard.press('ControlOrMeta+c');
        await expect.poll(() => editor.evaluate(async () => (await navigator.clipboard.read()).some(item => item.types.includes('text/html')))).toBe(true);
        await editor.keyboard.press('ControlOrMeta+v');
      } else await editor.keyboard.press(action === 'group' ? 'ControlOrMeta+g' : 'ControlOrMeta+d');
      await expect.poll(() => objects(editor)).toHaveLength(3);
      const expected = await objects(editor); await expect.poll(() => objects(owner)).toEqual(expected);
      if (action === 'group') {
        expect(expected.filter(model => model.type === 'group')).toHaveLength(1);
        await expect(editor.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
        await editor.keyboard.press('ControlOrMeta+Shift+g');
        await expect.poll(() => objects(editor)).toHaveLength(2);
        const ungrouped = await objects(editor); await expect.poll(() => objects(owner)).toEqual(ungrouped);
      }
    }

    if (action === 'resize' || action === 'rotate') {
      await expect(editor.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
      const value = (page: typeof editor) => page.locator('affine-edgeless-root').evaluate((element, id) => {
        const gfx = (element as HTMLElement & { gfx: GfxController }).gfx;
        const model = gfx.getElementById(id!) as import('@blocksuite/affine/model').ShapeElementModel;
        return { width: model.w, rotation: model.rotate };
      }, shape);
      const original = await value(editor);
      const handle = editor.locator(`.handle[aria-label="bottom-right"] .${action}`).first();
      const bounds = await handle.boundingBox(); expect(bounds).not.toBeNull();
      const admitted = editor.waitForResponse(response => response.url().endsWith('/live/reserve') && response.ok(), { timeout: 10000 });
      await editor.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2); await editor.mouse.down(); await admitted;
      await editor.mouse.move(bounds!.x + bounds!.width / 2 + 65, bounds!.y + bounds!.height / 2 - 30, { steps: 8 }); await editor.mouse.up();
      await expect.poll(() => value(editor)).not.toEqual(original);
      const expected = await value(editor); await expect.poll(() => value(owner)).toEqual(expected);
    }

    if (action === 'formatting') {
      await expect(editor.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
      const fill = (page: typeof editor) => page.locator('affine-edgeless-root').evaluate((element, id) => {
        const gfx = (element as HTMLElement & { gfx: GfxController }).gfx;
        return (gfx.getElementById(id!) as import('@blocksuite/affine/model').ShapeElementModel).fillColor;
      }, shape);
      const original = await fill(editor);
      await editor.getByRole('button', { name: 'Color', exact: true }).click({ timeout: 10000 });
      await editor.getByRole('listbox', { name: 'Fill color', exact: true }).locator('edgeless-color-button').nth(3).click({ timeout: 10000 });
      await expect.poll(() => fill(editor)).not.toEqual(original);
      const expected = await fill(editor);
      await expect.poll(() => fill(owner)).toEqual(expected);
    }

    if (action === 'frame' || action === 'freehand' || action === 'text') {
      await expect(editor.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
      await editor.getByRole('button', { name: action === 'text' ? 'Add text' : action === 'frame' ? 'Frame' : 'Freehand', exact: true }).click();
      if (action === 'freehand') await editor.getByRole('button', { name: 'Pen', exact: true }).click();
      const rect = await editor.locator('affine-edgeless-root').boundingBox();
      const admitted = editor.waitForResponse(response => response.url().endsWith('/live/reserve') && response.ok(), { timeout: 10000 });
      await editor.mouse.move(rect!.x + 220, rect!.y + 340); await editor.mouse.down();
      if (action !== 'frame') await admitted;
      await editor.mouse.move(rect!.x + 420, rect!.y + 440, { steps: 8 }); await editor.mouse.up();
      if (action === 'frame') await admitted;
      if (action === 'text') {
        await expect(editor.locator('edgeless-text-editor [contenteditable=true]')).toBeFocused();
        await editor.keyboard.insertText('Synthetic shared text box');
        await editor.keyboard.press('Escape');
      }
      const objects = (page: typeof editor) => page.locator('affine-edgeless-root').evaluate(element => {
        const gfx = (element as HTMLElement & { gfx: GfxController }).gfx;
        return gfx.gfxElements.map(model => ({ id: model.id, xywh: model.xywh, text: 'text' in model ? String(model.text ?? '') : '' })).sort((a, b) => a.id.localeCompare(b.id));
      });
      await expect.poll(() => objects(editor)).toHaveLength(3);
      const expected = await objects(editor); await expect.poll(() => objects(owner)).toEqual(expected);
      if (action === 'text') expect(expected.some(model => model.text === 'Synthetic shared text box')).toBe(true);
    }

    if (action === 'drawing') {
      await expect(editor.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
      await editor.getByRole('button', { name: 'Shapes', exact: true }).click();
      await editor.getByRole('button', { name: 'Square / rectangle', exact: true }).click();
      const rect = await editor.locator('affine-edgeless-root').boundingBox();
      const held = editor.waitForResponse(response => response.url().endsWith('/live/reserve') && response.ok(), { timeout: 10000 });
      await editor.mouse.move(rect!.x + 220, rect!.y + 340); await editor.mouse.down(); await held;
      await editor.mouse.move(rect!.x + 320, rect!.y + 410, { steps: 8 });
      await expect(editor.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
      await editor.mouse.move(rect!.x + 380, rect!.y + 470, { steps: 8 }); await editor.mouse.up();
      const shapes = (page: typeof editor) => page.locator('editor-host').evaluate(element => {
        const blocks = (element as import('@blocksuite/affine/std').EditorHost).store.spaceDoc.getMap('blocks').toJSON() as Record<string, Record<string, unknown>>;
        const surface = Object.values(blocks).find(block => block['sys:flavour'] === 'affine:surface')!;
        return (surface['prop:elements'] as { value: Record<string, unknown> }).value;
      });
      await expect.poll(async () => Object.keys(await shapes(editor))).toHaveLength(3);
      await expect(editor.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
      const expected = await shapes(editor);
      await expect.poll(() => shapes(owner)).toEqual(expected);
    }

    if (action === 'note' || action === 'image' || action === 'note-size' || action === 'image-edit') {
      await expect(editor.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
      if (action === 'note' || action === 'note-size') {
        await editor.getByRole('button', { name: 'Add sticky note', exact: true }).click();
        await editor.getByRole('button', { name: 'Yellow note', exact: true }).click();
      } else {
        let bytes = syntheticCanaries().imageBytes;
        if (action === 'image-edit') bytes = Buffer.from(await editor.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 100; const context = canvas.getContext('2d')!; context.fillStyle = '#80a040'; context.fillRect(0, 0, 200, 100); return canvas.toDataURL().split(',')[1]!; }), 'base64');
        await editor.locator('input[type=file][accept="image/*"]').setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: bytes });
      }
      const notes = (page: typeof editor) => page.locator('affine-edgeless-root').evaluate((element, flavour) => {
        const gfx = (element as HTMLElement & { gfx: GfxController }).gfx;
        return gfx.std.store.getBlocksByFlavour(flavour).map(block => block.id).sort();
      }, action === 'note' || action === 'note-size' ? 'affine:note' : 'affine:image');
      await expect.poll(() => notes(editor)).toHaveLength(1);
      const ids = await notes(editor);
      await expect.poll(() => notes(owner)).toEqual(ids);
      if (action === 'note-size') {
        await editor.locator('affine-edgeless-note').click();
        await editor.getByRole('combobox', { name: 'Note size', exact: true }).selectOption({ label: 'L' });
        const scale = (page: typeof editor) => page.locator('affine-edgeless-note [data-testid="edgeless-note-container"]').getAttribute('data-scale');
        for (const page of [owner, editor]) await expect.poll(() => scale(page)).toBe('1.5');
      }
      if (action === 'image-edit') {
        await editor.locator('affine-edgeless-image').click();
        await editor.locator('.selection-inspector').getByRole('spinbutton', { name: 'W', exact: true }).fill('180');
        await editor.getByRole('button', { name: 'Apply position & size', exact: true }).click();
        const imageState = (page: typeof editor) => page.locator('editor-host').evaluate(element => {
          const store = (element as import('@blocksuite/affine/std').EditorHost).store;
          const model = store.getBlocksByFlavour('affine:image')[0]!.model as import('@blocksuite/affine/model').ImageBlockModel;
          return { width: JSON.parse(model.xywh)[2], brightness: store.getBlocksByFlavour('djai:image-visual-edit').map(({ model }) => (model.props as { brightness: number }).brightness) };
        });
        await expect.poll(() => imageState(editor)).toMatchObject({ width: 180 });
        await editor.locator('.image-slider').filter({ hasText: 'Brightness' }).locator('input').fill('20');
        await expect.poll(() => imageState(editor)).toMatchObject({ brightness: [20] });
        const expected = await imageState(editor); await expect.poll(() => imageState(owner)).toEqual(expected);
        await editor.locator('.selection-inspector').getByRole('button', { name: 'Crop', exact: true }).click();
        await editor.getByRole('button', { name: 'Crop left', exact: true }).press('Shift+ArrowRight');
        await editor.getByRole('button', { name: 'Apply crop', exact: true }).click();
        await expect.poll(async () => (await imageState(editor)).width).toBeCloseTo(162);
        await expect.poll(() => imageState(owner)).toEqual(await imageState(editor));
        await editor.getByRole('button', { name: 'Reset edits', exact: true }).click();
        await expect.poll(() => imageState(editor)).toMatchObject({ width: 180, brightness: [] });
        await expect.poll(() => imageState(owner)).toEqual(await imageState(editor));
        const replacement = Buffer.from(await editor.evaluate(() => {
          const canvas = document.createElement('canvas'); canvas.width = 80; canvas.height = 160;
          const context = canvas.getContext('2d')!; context.fillStyle = '#506090'; context.fillRect(0, 0, 80, 160);
          return canvas.toDataURL().split(',')[1]!;
        }), 'base64');
        const oldSource = await editor.locator('affine-edgeless-root').evaluate(element =>
          ((element as HTMLElement & { gfx: GfxController }).gfx.doc.getBlocksByFlavour('affine:image')[0]!.model as import('@blocksuite/affine/model').ImageBlockModel).props.sourceId);
        await editor.locator('.selection-inspector input[type=file]').setInputFiles({ name: 'synthetic-replacement.png', mimeType: 'image/png', buffer: replacement });
        const imageSource = (page: typeof editor) => page.locator('affine-edgeless-root').evaluate(element => {
          const model = (element as HTMLElement & { gfx: GfxController }).gfx.doc.getBlocksByFlavour('affine:image')[0]!.model as import('@blocksuite/affine/model').ImageBlockModel;
          return { source: model.props.sourceId, bounds: model.xywh };
        });
        await expect.poll(async () => (await imageSource(editor)).source).not.toBe(oldSource);
        const replaced = await imageSource(editor); expect(JSON.parse(replaced.bounds)[3]).toBe(360);
        await expect.poll(() => imageSource(owner)).toEqual(replaced);

      }

      await expect(editor.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
      await editor.reload();
      await expect.poll(() => notes(editor)).toEqual(ids);
    }

    expect(identities.runtimeErrors).toEqual(Array(action === 'group' || action === 'connector' || action === 'eraser' || action === 'connector-retarget' ? 2 : 1).fill('editor: Failed to load resource: the server responded with a status of 409 (Conflict)'));
    identities.runtimeErrors.length = 0;
  } catch (error) { failure = error; throw error; } finally {
    releaseGesture();
    try { await identities.close(); } catch (error) { if (!failure) throw error; } finally { await service.close(); }
  }
});
