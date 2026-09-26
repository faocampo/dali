import { readRecoveryEpoch } from '../server/storage/recovery-state';
import { editBoardTitle, fileAction } from './app-menu';
import { randomBytes, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { request, type Page, type APIRequestContext } from '@playwright/test';
import type { EditorHost } from '@blocksuite/affine/std';
import type { GfxController } from '@blocksuite/affine/std/gfx';
import type { MindmapElementModel, ShapeElementModel, ImageBlockModel } from '@blocksuite/affine/model';
import { test, expect } from './fixtures';
import { createOidcProvider } from './oidc-provider';
import { buildApp } from '../server/app';
import { openDatabase, type AccountDatabase } from '../server/storage/database';
import { proxyApplicationAssets, syntheticCanaries } from './access-fixtures';
import { prepareClipboard, pasteClipboard } from './clipboard-route';
import { PDFDocument, PDFRawStream, PDFName, decodePDFRawStream } from 'pdf-lib';
import { unzipSync, strFromU8 } from 'fflate';
let closeProxy: (() => void) | undefined;
let app: FastifyInstance; let database: AccountDatabase; let provider: Awaited<ReturnType<typeof createOidcProvider>>;
let accountId: string; const origin = 'http://127.0.0.1:5499';
let ownerRequest: APIRequestContext | undefined; let ownerId: string;
test.use({ expectErrors: ['the server responded with a status of 400', 'the server responded with a status of 401', 'the server responded with a status of 403', 'the server responded with a status of 404', 'the server responded with a status of 409', 'the server responded with a status of 503'] });
test.beforeEach(async ({ page, baseURL }) => {
  const registration = { clientId: 'synthetic-actions', clientSecret: randomBytes(32).toString('hex'), redirectUri: origin + '/auth/callback' };
  provider = await createOidcProvider({ clients: [registration] }); database = openDatabase(':memory:');
  app = await buildApp({ storagePolicy: { kind: 'fixture' }, database, config: { DALI_ORIGIN: origin, DALI_DATABASE_PATH: ':memory:', DALI_SESSION_SECRET: randomBytes(32).toString('hex'), DALI_SESSION_TTL_MS: '86400000', DALI_OIDC_ISSUER: provider.issuer, DALI_OIDC_CLIENT_ID: registration.clientId, DALI_OIDC_CLIENT_SECRET: registration.clientSecret, DALI_OIDC_CALLBACK_URL: registration.redirectUri, DALI_INTERNAL_CLAIM: 'membership', DALI_INTERNAL_VALUES_JSON: '["internal"]', DALI_INTERNAL_EMAIL_DOMAINS_JSON: '["example.org"]' } });
  closeProxy = proxyApplicationAssets(app, baseURL!);
  await app.listen({ host: '127.0.0.1', port: 5499 });
  await page.goto(origin); await page.getByRole('link', { name: 'Synthetic Owner', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
  accountId = (await (await page.request.get(origin + '/api/session')).json()).accountId;
});
test.afterEach(async ({ page }) => { await page.unrouteAll({ behavior: 'ignoreErrors' }); await ownerRequest?.dispose(); ownerRequest = undefined; closeProxy?.(); closeProxy = undefined; await app?.close(); database?.close(); await provider?.close(); });
const headers = () => ({ Origin: origin, 'X-Dali-Account': accountId, 'X-Dali-Recovery-Epoch': readRecoveryEpoch(database), 'X-Dali-Request': '1' });
async function create(page: Page, title = 'Synthetic actions') {
  const response = await page.request.post(origin + '/api/boards', { headers: headers(), data: { title, operationId: randomUUID() } }); expect(response.status()).toBe(201); return response.json();
}
const sourceState = (id: string) => ['boards', 'board_documents', 'board_blobs', 'board_grants', 'pending_grants'].map(table => database.prepare(`SELECT * FROM ${table} WHERE ${table === 'boards' ? 'id' : 'board_id'}=?`).all(id));
async function localState(page: Page) {
  return page.locator('editor-host').evaluate(el => {
    const doc = (el as EditorHost).store.spaceDoc;
    return { model: JSON.stringify(doc.toJSON()), vector: [...doc.store.clients].map(([id, structs]) => [id, structs.at(-1)!.id.clock + structs.at(-1)!.length]) };
  });
}
async function role(page: Page, id: string, value: 'viewer' | 'editor') {
  ownerId = accountId; ownerRequest = await request.newContext({ storageState: await page.context().storageState() });
  await page.context().clearCookies(); await page.goto(origin + '/auth/start');
  await page.getByRole('link', { name: value === 'viewer' ? 'Synthetic Viewer' : 'Synthetic Editor', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
  accountId = (await (await page.request.get(origin + '/api/session')).json()).accountId;
  database.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?) ON CONFLICT(board_id,member_id) DO UPDATE SET role=excluded.role').run(id, accountId, value);
  await page.goto(origin + '/?board=' + id); await expect(page.locator('affine-edgeless-root')).toBeVisible();
}
async function ownerRead(id: string) {
  const response = await ownerRequest!.get(origin + '/api/boards/' + id + '/editable-export', { headers: { 'X-Dali-Account': ownerId } });
  expect(response.status()).toBe(200); return response.json();
}
test('@CR-07 Viewer import is disabled with an accessible reason and keyboard navigation preserves source', async ({ page }) => {
  const board = await create(page, 'Viewer import canary'); await page.goto(origin + '/?board=' + board.summary.id);
  await page.getByRole('button', { name: 'Add mind map', exact: true }).click(); await page.keyboard.type('Protected import source'); await page.keyboard.press('Escape'); await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  await role(page, board.summary.id, 'viewer'); const before = await localState(page); const server = await ownerRead(board.summary.id);
  let choosers = 0; let imports = 0; page.on('filechooser', () => { choosers++; }); page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/imports')) imports++; });
  await page.getByRole('button', { name: 'Main Menu', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem', { name: 'File', exact: true })).toBeFocused(); await page.keyboard.press('ArrowRight');
  const item = page.getByRole('menuitem', { name: 'Import board', exact: true });
  await expect(item).toBeDisabled(); await expect(item).toHaveAccessibleDescription('Board import requires permission to create boards.');
  await expect(page.getByText('Board import requires permission to create boards.', { exact: true })).toBeHidden();
  await expect(page.getByRole('menuitem', { name: 'New', exact: true })).toBeFocused(); await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'All boards', exact: true })).toBeFocused(); await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Export board', exact: true })).toBeFocused(); await page.keyboard.press('ArrowUp');
  await expect(page.getByRole('menuitem', { name: 'All boards', exact: true })).toBeFocused();
  await item.evaluate(element => (element as HTMLButtonElement).click());
  await expect(item).toBeVisible(); expect(choosers).toBe(0); expect(imports).toBe(0);
  await expect(page.getByRole('dialog', { name: 'Import board', exact: true })).toHaveCount(0);
  expect(await localState(page)).toEqual(before); expect(await ownerRead(board.summary.id)).toEqual(server);
});
test('@CR-06 immediate rename updates all download names and decoded archive metadata', async ({ page }) => {
  const board = await create(page, 'Synthetic old'); await page.goto(origin + '/?board=' + board.summary.id);
  await page.getByRole('button', { name: 'Add mind map', exact: true }).click(); await page.keyboard.type('Rename export canary'); await page.keyboard.press('Escape'); await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  const name = await editBoardTitle(page); await name.fill('Synthetic new'); await page.getByRole('button', { name: 'Saved', exact: true }).click();
  await expect.poll(() => database.prepare('SELECT title FROM boards WHERE id=?').get(board.summary.id)).toEqual({ title: 'Synthetic new' });
  for (const format of ['board', 'png', 'pdf']) {
    await fileAction(page, 'Export board'); const dialog = page.getByRole('dialog', { name: 'Export board', exact: true });
    if (format !== 'board') await dialog.getByRole('radio', { name: format === 'png' ? 'PNG image' : 'PDF document' }).check();
    const pending = page.waitForEvent('download'); await dialog.getByRole('button', { name: 'Download', exact: true }).click(); const download = await pending;
    expect(download.suggestedFilename()).toBe('Synthetic new.' + (format === 'board' ? 'bs.zip' : format));
    if (format === 'board') { const chunks: Buffer[] = []; for await (const chunk of (await download.createReadStream())!) chunks.push(Buffer.from(chunk)); const archive = unzipSync(Buffer.concat(chunks)); const entry = Object.entries(archive).find(([path]) => path.endsWith('.snapshot.json'))!; expect(JSON.parse(strFromU8(entry[1])).meta.title).toBe('Synthetic new'); }
    await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  }
});
test('@CR-04 Viewer menu zoom and fit navigate without native or server mutations', async ({ page }) => {
  const board = await create(page); await page.goto(origin + '/?board=' + board.summary.id);
  await page.getByRole('button', { name: 'Add mind map', exact: true }).click(); await page.keyboard.type('Viewer fit canary'); await page.keyboard.press('Escape'); await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  await role(page, board.summary.id, 'viewer'); const before = await localState(page); const server = await ownerRead(board.summary.id);
  const viewport = () => page.locator('affine-edgeless-root').evaluate(el => { const v = (el as HTMLElement & { gfx: GfxController }).gfx.viewport; return { zoom: v.zoom, center: { ...v.center } }; });
  await page.locator('affine-edgeless-root').evaluate(el => (el as HTMLElement & { gfx: GfxController }).gfx.viewport.setZoom(0.5));
  const view = async () => { await page.getByRole('button', { name: 'Main Menu', exact: true }).click(); await page.getByRole('menuitem', { name: 'View', exact: true }).click(); };
  await view(); await page.getByRole('menuitem', { name: 'Reset zoom to 100%', exact: true }).click(); await expect.poll(async () => (await viewport()).zoom).toBe(1);
  await page.mouse.move(600, 400); await page.mouse.down({ button: 'middle' }); await page.mouse.move(900, 650, { steps: 5 }); await page.mouse.up({ button: 'middle' }); const moved = await viewport();
  await view(); await page.getByRole('menuitem', { name: 'Fit to screen', exact: true }).click(); await expect.poll(viewport).not.toEqual(moved);
  await view(); await expect(page.getByRole('menuitem', { name: 'Layers', exact: true })).toBeDisabled(); await expect(page.getByText('Layer editing requires Owner or Editor access.', { exact: true })).toBeHidden();
  await page.keyboard.press('Escape'); await page.getByRole('menuitem', { name: 'Edit', exact: true }).click(); await expect(page.getByRole('menuitem', { name: 'Undo', exact: true })).toBeDisabled(); await expect(page.getByRole('menuitem', { name: 'Redo', exact: true })).toBeDisabled();
  expect(await localState(page)).toEqual(before); expect(await ownerRead(board.summary.id)).toEqual(server);
});
test('@03-09-01 Viewer native keyboard clipboard drop and history preserve model and server while navigation works', async ({ page, context, browserName }, testInfo) => {
  await prepareClipboard(page, context, browserName, testInfo, []);
  const board = await create(page); await page.goto(origin + '/?board=' + board.summary.id);
  await page.getByRole('button', { name: 'Add mind map', exact: true }).click(); await page.keyboard.type('Role map canary'); await page.keyboard.press('Enter');
  await page.keyboard.press('Tab'); await page.keyboard.type('Child canary'); await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  await role(page, board.summary.id, 'viewer');
  await expect(page.getByRole('button', { name: 'Add sticky note', exact: true })).toHaveCount(0);
  const before = await localState(page); const server = sourceState(board.summary.id); const owner = await ownerRead(board.summary.id);
  await page.locator('affine-edgeless-root').evaluate(el => { const gfx = (el as HTMLElement & { gfx: GfxController }).gfx; const map = gfx.surface!.elementModels.find(el => el.type === 'mindmap') as MindmapElementModel; gfx.selection.set({ elements: [map.tree.id], editing: false }); });
  for (const key of ['Tab', 'Enter', 'Delete', 'Backspace', 'ControlOrMeta+d', 'ControlOrMeta+z', 'ControlOrMeta+Shift+z', 'ControlOrMeta+b']) {
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    await page.keyboard.press(key); expect(await localState(page), key).toEqual(before); expect(sourceState(board.summary.id), key).toEqual(server); expect(await ownerRead(board.summary.id)).toEqual(owner);
  }
  await page.evaluate(() => navigator.clipboard.writeText('Native clipboard canary'));
  await page.mouse.click(600, 400); await pasteClipboard(page, browserName);
  await page.locator('editor-host').evaluate(el => { const data = new DataTransfer(); data.setData('text/plain', 'Constructed drop canary'); el.dispatchEvent(new DragEvent('drop', { dataTransfer: data, bubbles: true, cancelable: true })); el.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertCompositionText', data: 'Composition canary', bubbles: true, cancelable: true })); });
  await page.evaluate(() => { for (const detail of ['undo', 'redo']) window.dispatchEvent(new CustomEvent('dali:board-command', { detail })); });
  expect(await localState(page)).toEqual(before); expect(sourceState(board.summary.id)).toEqual(server);
  // Native setters and collection methods bypass the app's buttons entirely.
  for (const action of ['style', 'move', 'text', 'children', 'collapse', 'transaction', 'history']) {
    await page.locator('affine-edgeless-root').evaluate((el, action) => {
      const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
      const map = gfx.surface!.elementModels.find(el => el.type === 'mindmap') as MindmapElementModel;
      const shape = map.tree.element as ShapeElementModel;
      if (action === 'style') shape.fillColor = '#ff00ff';
      if (action === 'move') shape.xywh = '[999,999,100,40]';
      if (action === 'text') shape.text!.insert(0, 'DENIED');
      if (action === 'children') map.children.set(map.tree.id, { ...map.children.get(map.tree.id)!, collapsed: true });
      if (action === 'collapse') map.toggleCollapse(map.tree);
      if (action === 'transaction') gfx.doc.transact(() => shape.strokeWidth = 20);
      if (action === 'history') gfx.doc.history.undoManager.undo();
    }, action);
    expect(await localState(page), action).toEqual(before); expect(sourceState(board.summary.id), action).toEqual(server); expect(await ownerRead(board.summary.id)).toEqual(owner);
  }
  const zoom = await page.locator('affine-edgeless-root').evaluate(el => (el as HTMLElement & { gfx: GfxController }).gfx.viewport.zoom);
  await page.mouse.move(600, 400); await page.mouse.wheel(0, -150);
  await expect.poll(() => page.locator('affine-edgeless-root').evaluate(el => (el as HTMLElement & { gfx: GfxController }).gfx.viewport.zoom)).not.toBe(zoom);
  const center = await page.locator('affine-edgeless-root').evaluate(el => ({ ...(el as HTMLElement & { gfx: GfxController }).gfx.viewport.center }));
  await page.mouse.move(600, 400); await page.mouse.down({ button: 'middle' }); await page.mouse.move(680, 460, { steps: 5 }); await page.mouse.up({ button: 'middle' });
  await expect.poll(() => page.locator('affine-edgeless-root').evaluate(el => ({ ...(el as HTMLElement & { gfx: GfxController }).gfx.viewport.center }))).not.toEqual(center);
  expect(await localState(page)).toEqual(before); expect(sourceState(board.summary.id)).toEqual(server);
});
for (const access of ['owner', 'editor'] as const) test(`@03-09-01 ${access} native creation typing styling collection history and clipboard remain writable`, async ({ page, context, browserName, expectErrors, pageErrors }, testInfo) => {
  await prepareClipboard(page, context, browserName, testInfo, []);
  const board = await create(page); await page.goto(origin + '/?board=' + board.summary.id);
  if (access === 'editor') await role(page, board.summary.id, access);
  await page.getByRole('button', { name: 'Add mind map', exact: true }).click(); await page.keyboard.type('Writable map'); await page.keyboard.press('Enter');
  const before = await localState(page);
  await page.keyboard.press('Tab'); await page.keyboard.type('Writable child'); await page.keyboard.press('Escape');
  expect(await localState(page)).not.toEqual(before);
  const result = await page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx; const map = gfx.surface!.elementModels.find(el => el.type === 'mindmap') as MindmapElementModel;
    const root = map.tree.element as ShapeElementModel; root.fillColor = '#123456'; map.children.set(map.tree.id, { ...map.children.get(map.tree.id)!, collapsed: true });
    return { fill: root.fillColor, collapsed: map.children.get(map.tree.id)!.collapsed, count: map.children.size };
  });
  expect(result).toEqual({ fill: '#123456', collapsed: true, count: 2 });
  const parserErrors: { text: string; pasting: boolean }[] = []; let pasting = false;
  if (browserName === 'firefox') {
    expect(pageErrors.filter(error => !expectErrors.some(allowed => error.includes(allowed)))).toEqual([]);
    // The pinned native paste handler probes plain text as SVG before pasting
    // it as text. Observe that exact parser call without changing its result.
    await page.evaluate(() => {
      const original = DOMParser.prototype.parseFromString;
      const probe = { inputs: [] as string[], restore: () => { DOMParser.prototype.parseFromString = original; } };
      Object.assign(window, { rolePasteProbe: probe });
      DOMParser.prototype.parseFromString = function (input, type) { if (type === 'image/svg+xml') probe.inputs.push(String(input)); return original.call(this, input, type); };
    });
    page.on('console', message => { if (message.type() === 'error' && message.text().includes('XML Parsing Error: syntax error')) parserErrors.push({ text: message.text(), pasting }); });
    expectErrors.push('XML Parsing Error: syntax error\nLocation: ' + page.url());
  }
  pasting = true;
  await page.evaluate(() => navigator.clipboard.writeText('Writable native clipboard'));
  await page.mouse.click(700, 600); await pasteClipboard(page, browserName);
  await expect.poll(async () => (await localState(page)).model).toContain('Writable native clipboard');
  pasting = false;
  if (browserName === 'firefox') {
    const inputs = await page.evaluate(() => { const probe = (window as unknown as { rolePasteProbe: { inputs: string[]; restore(): void } }).rolePasteProbe; probe.restore(); return probe.inputs; });
    expect(inputs).toEqual(['Writable native clipboard']);
  }
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  const saved = await localState(page); await page.reload(); await expect(page.locator('affine-edgeless-root')).toHaveCount(1); await expect(page.locator('affine-edgeless-root')).toBeVisible(); expect((await localState(page)).model).toBe(saved.model);
  if (browserName === 'firefox') { expect(parserErrors).toHaveLength(1); expect(parserErrors[0]!.pasting).toBe(true); }
});
test('@03-09-01 Viewer native shape drawing image properties groups connectors and map creation preserve each state', async ({ page }) => {
  const board = await create(page); await page.goto(origin + '/?board=' + board.summary.id);
  await page.getByRole('button', { name: 'Add mind map', exact: true }).click(); await page.keyboard.press('Escape');
  await page.locator('input[type=file][accept="image/*"]').setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: syntheticCanaries().imageBytes });
  await expect(page.locator('affine-edgeless-image')).toHaveCount(1);
  await page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx; const surface = gfx.surface!;
    const a = surface.addElement({ type: 'shape', xywh: '[0,500,100,100]' }); const b = surface.addElement({ type: 'shape', xywh: '[200,500,100,100]' });
    surface.addElement({ type: 'connector', source: { id: a }, target: { id: b } }); surface.addElement({ type: 'group', children: { [a]: true, [b]: true }, title: 'Group canary' });
  });
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible(); await role(page, board.summary.id, 'viewer');
  const before = await localState(page); const server = sourceState(board.summary.id); const owner = await ownerRead(board.summary.id);
  const actions = ['image', 'connector', 'group', 'create', 'delete', 'map-child'] as const;
  for (const action of actions) {
    await page.locator('affine-edgeless-root').evaluate((el, action) => {
      const gfx = (el as HTMLElement & { gfx: GfxController }).gfx; const surface = gfx.surface!;
      if (action === 'image') gfx.doc.transact(() => { const image = gfx.doc.getBlocksByFlavour('affine:image')[0]!.model as ImageBlockModel; image.xywh = '[900,900,50,50]'; image.rotate = 90; });
      if (action === 'connector') { const connector = surface.elementModels.find(el => el.type === 'connector')!; connector.yMap.set('source', { position: [999,999] }); }
      if (action === 'group') { const group = surface.elementModels.find(el => el.type === 'group')!; group.yMap.set('children', {}); group.yMap.set('index', 'zz'); }
      if (action === 'create') gfx.doc.transact(() => surface.addElement({ type: 'shape', xywh: '[0,0,40,40]' }));
      if (action === 'delete') gfx.doc.transact(() => surface.deleteElement(surface.elementModels[0]!.id));
      if (action === 'map-child') gfx.doc.transact(() => (surface.elementModels.find(el => el.type === 'mindmap') as MindmapElementModel).addNode(null, undefined, 'after', { text: 'Denied child' }));
    }, action);
    expect(await localState(page), action).toEqual(before); expect(sourceState(board.summary.id), action).toEqual(server); expect(await ownerRead(board.summary.id)).toEqual(owner);
  }
  for (const key of ['s', 'n', 't', 'c', 'f', 'p']) {
    await page.mouse.click(800, 550); await page.keyboard.press(key); await page.mouse.move(800, 550); await page.mouse.down(); await page.mouse.move(900, 620, { steps: 5 }); await page.mouse.up();
    expect(await localState(page), key).toEqual(before); expect(sourceState(board.summary.id), key).toEqual(server);
  }
});
async function exportSeed(page: Page) {
  const board = await create(page, 'Export canary'); await page.goto(origin + '/?board=' + board.summary.id);
  await page.getByRole('button', { name: 'Add mind map', exact: true }).click(); await page.keyboard.type('Map text canary'); await page.keyboard.press('Escape');
  const png = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = canvas.height = 80; const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#00ff00'; ctx.fillRect(0, 0, 80, 80); return canvas.toDataURL().split(',')[1]!; });
  await page.locator('input[type=file][accept="image/*"]').setInputFiles({ name: 'green-canary.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await expect(page.locator('affine-edgeless-image')).toHaveCount(1);
  const ids = await page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx; const surface = gfx.surface!;
    const map = surface.elementModels.find(el => el.type === 'mindmap') as MindmapElementModel; const root = map.tree.element as ShapeElementModel;
    root.fillColor = '#0000ff'; root.color = '#000000';
    const image = gfx.doc.getBlocksByFlavour('affine:image')[0]!.model as ImageBlockModel;
    gfx.doc.updateBlock(image, { xywh: `[${root.x + root.w + 40},${root.y},80,80]` });
    const frame = gfx.doc.addBlock('affine:frame', { xywh: `[${root.x - 20},${root.y - 20},${root.w + 160},${Math.max(root.h, 80) + 40}]` }, surface.id);
    surface.addElement({ type: 'shape', shapeType: 'rect', shapeStyle: 'General', filled: true, fillColor: '#ff0000', strokeWidth: 0, xywh: `[${root.x + root.w + 350},${root.y},100,100]` });
    return { frame, image: image.id, map: map.id };
  });
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible(); return { board, ids };
}
async function downloadBytes(page: Page) {
  const downloading = page.waitForEvent('download'); await page.getByRole('dialog').getByRole('button', { name: 'Download', exact: true }).click();
  const file = await downloading; expect(await file.failure()).toBeNull(); const parts: Buffer[] = [];
  for await (const part of (await file.createReadStream())!) parts.push(Buffer.from(part));
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click(); return Buffer.concat(parts);
}
const colors = (bytes: Uint8Array, stride: number) => {
  const result = { red: 0, green: 0, blue: 0, dark: 0 };
  for (let i = 0; i < bytes.length; i += stride) { const [r, g, b] = [bytes[i]!, bytes[i + 1]!, bytes[i + 2]!]; if (stride === 4 && bytes[i + 3]! < 128) continue;
    if (r > 240 && g < 20 && b < 20) result.red++; if (r < 20 && g > 240 && b < 20) result.green++; if (r < 20 && g < 20 && b > 240) result.blue++; if (r < 70 && g < 70 && b < 70) result.dark++;
  } return result;
};
test('@03-09-02 Viewer decoded PNG and PDF preserve authorized map text image and board frame selection scopes', async ({ page }) => {
  const { board, ids } = await exportSeed(page); await role(page, board.summary.id, 'viewer');
  const before = await localState(page); const server = await ownerRead(board.summary.id);
  for (const format of ['png', 'pdf']) for (const scope of ['board', 'frame', 'selection']) {
    await page.locator('affine-edgeless-root').evaluate((el, id) => (el as HTMLElement & { gfx: GfxController }).gfx.selection.set({ elements: [id], editing: false }), scope === 'selection' ? ids.image : ids.frame);
    await fileAction(page, 'Export board'); await expect(page.getByRole('radio', { name: 'Editable board file' })).toHaveCount(0);
    await page.getByRole('radio', { name: format === 'png' ? 'PNG image' : 'PDF document' }).check();
    await page.locator(`input[name="export-scope"][value="${scope}"]`).check();
    if (format === 'png') { await page.getByRole('radio', { name: '2×', exact: true }).check(); await page.getByRole('checkbox', { name: 'Transparent background' }).check(); }
    const artifact = await downloadBytes(page); let decoded: ReturnType<typeof colors>;
    if (format === 'png') {
      const pixels = await page.evaluate(async base64 => { const img = new Image(); img.src = 'data:image/png;base64,' + base64; await img.decode(); const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height; const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0); return [...ctx.getImageData(0, 0, canvas.width, canvas.height).data]; }, artifact.toString('base64'));
      decoded = colors(Uint8Array.from(pixels), 4);
    } else {
      const pdf = await PDFDocument.load(artifact); expect(pdf.getPageCount()).toBeGreaterThan(0);
      const images = pdf.context.enumerateIndirectObjects().map(([, value]) => value).filter((value): value is PDFRawStream => value instanceof PDFRawStream && value.dict.get(PDFName.of('Subtype')) === PDFName.of('Image') && value.dict.get(PDFName.of('ColorSpace')) === PDFName.of('DeviceRGB'));
      expect(images.length).toBeGreaterThan(0); decoded = colors(Uint8Array.from(images.flatMap(image => [...decodePDFRawStream(image).decode()])), 3);
    }
    expect(decoded.green, `${format}/${scope} image`).toBeGreaterThan(1000);
    if (scope !== 'selection') { expect(decoded.blue, 'map fill').toBeGreaterThan(1000); expect(decoded.dark, 'map text pixels').toBeGreaterThan(20); } else expect(decoded.blue).toBe(0);
    if (scope === 'board') expect(decoded.red).toBeGreaterThan(1000); else expect(decoded.red).toBe(0);
    expect(await localState(page)).toEqual(before); expect(await ownerRead(board.summary.id)).toEqual(server);
  }
});
for (const access of ['owner', 'editor'] as const) test(`@03-09-02 ${access} editable archive retains map and image while server revoked role yields no artifact`, async ({ page }) => {
  const { board } = await exportSeed(page); if (access === 'editor') await role(page, board.summary.id, access);
  await fileAction(page, 'Export board'); const archive = unzipSync(await downloadBytes(page));
  expect(Object.keys(archive).filter(key => key.startsWith('assets/'))).toHaveLength(1);
  expect(Object.entries(archive).filter(([key]) => key.endsWith('.snapshot.json')).map(([, value]) => strFromU8(value)).join('')).toContain('Map text canary');
  await fileAction(page, 'Export board');
  if (access === 'owner') { database.prepare('INSERT INTO members(id,issuer,subject,email,canonical_email,display_name) VALUES(?,?,?,?,?,?)').run('synthetic-next-owner', provider.issuer, 'next-owner', 'next@example.org', 'next@example.org', 'Next Owner'); database.prepare('UPDATE boards SET owner_id=? WHERE id=?').run('synthetic-next-owner', board.summary.id); }
  database.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?) ON CONFLICT(board_id,member_id) DO UPDATE SET role=excluded.role').run(board.summary.id, accountId, 'viewer');
  const downloads: string[] = []; page.on('download', file => downloads.push(file.suggestedFilename()));
  await page.getByRole('dialog').getByRole('button', { name: 'Download', exact: true }).click(); await expect(page.getByRole('dialog').getByRole('alert')).toContainText('access'); expect(downloads).toEqual([]);
});
test('@03-09-02 denied image and identity change during image resolution produce no artifact', async ({ page }) => {
  const { board } = await exportSeed(page); await role(page, board.summary.id, 'viewer');
  const downloads: string[] = []; page.on('download', file => downloads.push(file.suggestedFilename()));
  const pattern = '**/api/boards/' + board.summary.id + '/blobs/*';
  await page.route(pattern, route => route.fulfill({ status: 404, contentType: 'application/json', body: '{"code":"IMAGE_UNAVAILABLE"}' }));
  await fileAction(page, 'Export board'); await page.getByRole('dialog').getByRole('button', { name: 'Download', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('image'); expect(downloads).toEqual([]);
  await page.unroute(pattern); await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; }); let entered = false;
  await page.route(pattern, async route => { const authorized = await route.fetch(); entered = true; await gate; await route.fulfill({ response: authorized }); });
  await fileAction(page, 'Export board'); await page.getByRole('dialog').getByRole('button', { name: 'Download', exact: true }).click();
  await expect.poll(() => entered).toBe(true);
  // A second tab signs in another account while authorized image bytes are in flight.
  const second = await page.context().newPage(); await page.context().clearCookies(); await second.goto(origin + '/auth/start');
  await second.getByRole('link', { name: 'Synthetic Editor', exact: true }).click(); await expect(second.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
  release();
  await expect(page.getByRole('alert')).toHaveText("You're signed in with a different account. Return to your boards or sign in with the previous account to recover its pending changes.");
  await expect(page.locator('affine-edgeless-root, editor-host')).toHaveCount(0);
  expect(downloads).toEqual([]); await second.close();
});

test('system Viewer creator retains Owner controls and owns an independent copy', async ({ page }) => {
  const board = await create(page, 'Legacy creator board');
  database.prepare("UPDATE members SET system_role='viewer' WHERE id=?").run(accountId);
  await page.goto(origin + '/?board=' + board.summary.id);
  await expect(page.getByRole('button', { name: 'Add sticky note', exact: true })).toBeVisible();
  await page.getByLabel('Account for Synthetic Owner').click();
  await expect(page.locator('.board-account .board-role')).toHaveText('Owner');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Add sticky note', exact: true }).click();
  await page.locator('affine-edgeless-note').dblclick(); await page.keyboard.insertText('Owned content'); await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Main Menu', exact: true }).click();
  await page.getByRole('menuitem', { name: 'File', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Duplicate board', exact: true }).click();
  await page.getByRole('dialog', { name: 'Duplicate board', exact: true }).getByRole('button', { name: 'Duplicate board', exact: true }).click();
  await page.getByRole('link', { name: 'Open Legacy creator board (copy)', exact: true }).click();
  await expect(page.locator('affine-edgeless-note')).toContainText('Owned content');
  const boards = database.prepare('SELECT id,owner_id FROM boards').all() as { id: string; owner_id: string }[];
  expect(boards).toHaveLength(2); expect(boards.every(row => row.owner_id === accountId)).toBe(true);
  await page.getByRole('button', { name: 'Main Menu', exact: true }).click(); await page.getByRole('menuitem', { name: 'File', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'New', exact: true })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: 'Import board', exact: true })).toBeDisabled();
  await expect(page.getByRole('menuitem', { name: 'Duplicate board', exact: true })).toBeVisible();
});
