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
import { syntheticCanaries } from './access-fixtures';
let app: FastifyInstance; let database: AccountDatabase; let provider: Awaited<ReturnType<typeof createOidcProvider>>;
let accountId: string; const origin = 'http://127.0.0.1:5499';
let ownerRequest: APIRequestContext | undefined; let ownerId: string;
test.use({ expectErrors: ['the server responded with a status of 400', 'the server responded with a status of 401', 'the server responded with a status of 403', 'the server responded with a status of 404', 'the server responded with a status of 409', 'the server responded with a status of 503'] });
test.beforeEach(async ({ page, baseURL }) => {
  const registration = { clientId: 'synthetic-actions', clientSecret: randomBytes(32).toString('hex'), redirectUri: origin + '/auth/callback' };
  provider = await createOidcProvider({ clients: [registration] }); database = openDatabase(':memory:');
  app = await buildApp({ database, config: { DALI_ORIGIN: origin, DALI_DATABASE_PATH: ':memory:', DALI_SESSION_SECRET: randomBytes(32).toString('hex'), DALI_SESSION_TTL_MS: '86400000', DALI_OIDC_ISSUER: provider.issuer, DALI_OIDC_CLIENT_ID: registration.clientId, DALI_OIDC_CLIENT_SECRET: registration.clientSecret, DALI_OIDC_CALLBACK_URL: registration.redirectUri, DALI_INTERNAL_CLAIM: 'membership', DALI_INTERNAL_VALUES_JSON: '["internal"]', DALI_INTERNAL_EMAIL_DOMAINS_JSON: '["example.org"]' } });
  app.get('/*', async (request, reply) => { const response = await fetch(baseURL! + request.url); return reply.type(response.headers.get('content-type') ?? 'text/html').send(Buffer.from(await response.arrayBuffer())); });
  await app.listen({ host: '127.0.0.1', port: 5499 });
  await page.goto(origin); await page.getByRole('link', { name: 'Synthetic Owner', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
  accountId = (await (await page.request.get(origin + '/api/session')).json()).accountId;
});
test.afterEach(async ({ page }) => { await page.unrouteAll({ behavior: 'ignoreErrors' }); await ownerRequest?.dispose(); ownerRequest = undefined; await app?.close(); database?.close(); await provider?.close(); });
const headers = () => ({ Origin: origin, 'X-Dali-Account': accountId, 'X-Dali-Request': '1' });
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
test('@03-09-01 Viewer native keyboard clipboard drop and history preserve model and server while navigation works', async ({ page, context }) => {
  const board = await create(page); await page.goto(origin + '/?board=' + board.summary.id);
  await page.getByRole('button', { name: 'Add mind map', exact: true }).click(); await page.keyboard.type('Role map canary'); await page.keyboard.press('Enter');
  await page.keyboard.press('Tab'); await page.keyboard.type('Child canary'); await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  await role(page, board.summary.id, 'viewer');
  await expect(page.getByRole('button', { name: 'Add sticky note', exact: true })).toHaveCount(0);
  const before = await localState(page); const server = sourceState(board.summary.id); const owner = await ownerRead(board.summary.id);
  await page.locator('affine-edgeless-root').evaluate(el => { const gfx = (el as HTMLElement & { gfx: GfxController }).gfx; const map = gfx.surface!.elementModels.find(el => el.type === 'mindmap') as MindmapElementModel; gfx.selection.set({ elements: [map.tree.id], editing: false }); });
  for (const key of ['Tab', 'Enter', 'Delete', 'Backspace', 'ControlOrMeta+d', 'ControlOrMeta+z', 'ControlOrMeta+Shift+z', 'ControlOrMeta+b']) {
    await page.keyboard.press(key); expect(await localState(page), key).toEqual(before); expect(sourceState(board.summary.id), key).toEqual(server); expect(await ownerRead(board.summary.id)).toEqual(owner);
  }
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.evaluate(() => navigator.clipboard.writeText('Native clipboard canary'));
  await page.mouse.click(600, 400); await page.keyboard.press('ControlOrMeta+v');
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
  expect(await localState(page)).toEqual(before); expect(sourceState(board.summary.id)).toEqual(server);
});
for (const access of ['owner', 'editor'] as const) test(`@03-09-01 ${access} native creation typing styling collection history and clipboard remain writable`, async ({ page, context }) => {
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
  await context.grantPermissions(['clipboard-read', 'clipboard-write']); await page.evaluate(() => navigator.clipboard.writeText('Writable native clipboard'));
  await page.mouse.click(700, 600); await page.keyboard.press('ControlOrMeta+v');
  await expect.poll(async () => (await localState(page)).model).toContain('Writable native clipboard');
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  const saved = await localState(page); await page.reload(); await expect(page.locator('affine-edgeless-root')).toBeVisible(); expect((await localState(page)).model).toBe(saved.model);
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
