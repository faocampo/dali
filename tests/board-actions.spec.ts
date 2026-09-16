import { randomBytes, randomUUID, createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Page } from '@playwright/test';
import type { EditorHost } from '@blocksuite/affine/std';
import type { GfxController } from '@blocksuite/affine/std/gfx';
import type { MindmapElementModel, ShapeElementModel, ConnectorElementModel } from '@blocksuite/affine/model';
import { test, expect } from './fixtures';
import { createOidcProvider } from './oidc-provider';
import { syntheticCanaries } from './access-fixtures';
import { buildApp } from '../server/app';
import { openDatabase, type AccountDatabase } from '../server/storage/database';
let app: FastifyInstance; let database: AccountDatabase; let provider: Awaited<ReturnType<typeof createOidcProvider>>;
let accountId: string; const origin = 'http://127.0.0.1:5499';
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
test.afterEach(async ({ page }) => { await page.unrouteAll({ behavior: 'ignoreErrors' }); await app?.close(); database?.close(); await provider?.close(); });
const headers = () => ({ Origin: origin, 'X-Dali-Account': accountId, 'X-Dali-Request': '1' });
async function create(page: Page, title = 'Synthetic actions') {
  const response = await page.request.post(origin + '/api/boards', { headers: headers(), data: { title, operationId: randomUUID() } }); expect(response.status()).toBe(201); return response.json();
}
const card = (page: Page, id: string) => page.locator('[data-board-id="' + id + '"]');
const sourceState = (id: string) => ['boards', 'board_documents', 'board_blobs', 'board_grants', 'pending_grants'].map(table => database.prepare(`SELECT * FROM ${table} WHERE ${table === 'boards' ? 'id' : 'board_id'}=?`).all(id));
test('@03-08-01 Unicode rename blank bounds acknowledgment and named safe-focus deletion', async ({ page }) => {
  const board = await create(page); await page.reload();
  const open = async () => { await card(page, board.summary.id).getByRole('button', { name: 'Rename board' }).click(); return page.getByRole('dialog', { name: 'Rename board' }); };
  let dialog = await open(); const title = '👩🏽‍💻'.repeat(200);
  await dialog.getByRole('textbox').fill(title + '界'); await dialog.getByRole('button', { name: 'Save name' }).click();
  await expect(dialog.getByRole('alert')).toContainText('200'); await expect(dialog.getByRole('textbox')).toHaveValue(title + '界');
  await dialog.getByRole('textbox').fill(title); await dialog.getByRole('button', { name: 'Save name' }).click(); await expect(dialog).not.toBeVisible();
  await expect(card(page, board.summary.id).getByRole('link', { name: 'Open ' + title, exact: true })).toBeVisible();
  dialog = await open(); await dialog.getByRole('textbox').fill('   '); await dialog.getByRole('button', { name: 'Save name' }).click(); await expect(dialog).not.toBeVisible();
  expect((await (await page.request.get(origin + '/api/boards/' + board.summary.id, { headers: headers() })).json()).summary.title).toBe(title);
  await card(page, board.summary.id).getByRole('button', { name: 'Delete board' }).click(); dialog = page.getByRole('dialog', { name: 'Delete board' });
  await expect(dialog).toContainText(title); await expect(dialog.getByRole('button', { name: 'Keep board' })).toBeFocused();
  await dialog.getByRole('button', { name: 'Keep board' }).click(); await expect(card(page, board.summary.id).getByRole('button', { name: 'Delete board' })).toBeFocused();
  await card(page, board.summary.id).getByRole('button', { name: 'Delete board' }).click(); await dialog.getByRole('button', { name: 'Delete board', exact: true }).click();
  await expect(card(page, board.summary.id)).toHaveCount(0); await expect(page.getByRole('button', { name: 'New board', exact: true })).toBeFocused();
  expect(sourceState(board.summary.id)).toEqual([[], [], [], [], []]);
});
test('@03-08-01 visible role controls and crafted denials preserve canary content', async ({ page }) => {
  const board = await create(page, 'Role canary'); const id = board.summary.id;
  database.prepare('INSERT INTO members(id,issuer,subject,email,canonical_email,display_name) VALUES(?,?,?,?,?,?)').run('synthetic-other', provider.issuer, 'other', 'other@example.org', 'other@example.org', 'Synthetic Other');
  database.prepare('UPDATE boards SET owner_id=? WHERE id=?').run('synthetic-other', id);
  for (const role of ['viewer', 'editor']) {
    database.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?) ON CONFLICT(board_id,member_id) DO UPDATE SET role=excluded.role').run(id, accountId, role);
    await page.reload(); await expect(card(page, id).getByRole('button', { name: 'Delete board' })).toHaveCount(0); await expect(card(page, id).getByRole('button', { name: 'Share board' })).toHaveCount(0);
    await expect(card(page, id).getByRole('button', { name: 'Rename board' })).toHaveCount(role === 'editor' ? 1 : 0); await expect(card(page, id).getByRole('button', { name: 'Duplicate board' })).toHaveCount(role === 'editor' ? 1 : 0);
    const before = sourceState(id);
    const denied = await page.request.delete(origin + '/api/boards/' + id, { headers: headers(), data: { revision: 1, operationId: randomUUID() } }); expect(denied.status()).toBe(403);
    if (role === 'viewer') {
      for (const [method, suffix] of [['PATCH', ''], ['POST', '/duplicate'], ['GET', '/editable-export']] as const) {
        const response = await page.request.fetch(origin + '/api/boards/' + id + suffix, { method, headers: headers(), ...(method !== 'GET' ? { data: { revision: 1, title: 'Denied title', operationId: randomUUID() } } : {}) }); expect(response.status()).toBe(403); expect(await response.text()).not.toContain('Role canary');
      }
    }
    expect(sourceState(id)).toEqual(before);
  }
});
test('@03-08-01 lost rename response reconciles one result and failure retains draft and source', async ({ page }) => {
  const board = await create(page); await page.reload();
  await card(page, board.summary.id).getByRole('button', { name: 'Rename board' }).click(); const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox').fill('Acknowledged canary'); let writes = 0;
  await page.route('**/api/boards/' + board.summary.id, async route => { if (route.request().method() !== 'PATCH') return route.continue(); writes++; await route.fetch(); await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }); });
  await dialog.getByRole('button', { name: 'Save name' }).click(); await expect(dialog).not.toBeVisible(); expect(writes).toBe(1);
  await expect(card(page, board.summary.id).getByRole('link', { name: 'Open Acknowledged canary', exact: true })).toBeVisible();
  expect(database.prepare("SELECT count(*) AS n FROM operations WHERE kind='rename'").get()).toEqual({ n: 1 });
  await page.unroute('**/api/boards/' + board.summary.id); const before = sourceState(board.summary.id);
  await card(page, board.summary.id).getByRole('button', { name: 'Rename board' }).click(); await dialog.getByRole('textbox').fill('Draft retained');
  await page.route('**/api/boards/' + board.summary.id, route => route.request().method() === 'PATCH' ? route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }) : route.continue());
  await dialog.getByRole('button', { name: 'Save name' }).click(); await expect(dialog.getByRole('button', { name: 'Check again' })).toBeVisible(); await expect(dialog.getByRole('textbox')).toHaveValue('Draft retained');
  expect(sourceState(board.summary.id)).toEqual(before); await dialog.getByRole('button', { name: 'Check again' }).click(); await expect(dialog.getByRole('button', { name: 'Save name' })).toBeVisible();
  await page.unroute('**/api/boards/' + board.summary.id); await dialog.getByRole('button', { name: 'Save name' }).click(); await expect(dialog).not.toBeVisible();
  await expect(card(page, board.summary.id).getByRole('link', { name: 'Open Draft retained', exact: true })).toBeVisible();
});
test('@03-08-01 native map image duplicate has fresh identities private ownership and byte-stable source after disposal', async ({ page }) => {
  const board = await create(page, 'Native source'); await page.goto(origin + '/?board=' + board.summary.id);
  await expect(page.locator('affine-edgeless-root')).toBeVisible();
  await page.getByRole('button', { name: 'Add mind map', exact: true }).click(); await page.keyboard.type('Map canary'); await page.keyboard.press('Enter');
  await page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx; const surface = gfx.surface!;
    const map = surface.elementModels.find(model => model.type === 'mindmap') as MindmapElementModel;
    const branch = map.addNode(map.tree.id, undefined, 'after', { text: 'Branch canary' }); map.addNode(branch, undefined, 'after', { text: 'Hidden canary' }); map.addNode(map.tree.id, undefined, 'after', { text: 'Ordered canary' });
    surface.updateElement(branch, { fontSize: 27, fontWeight: '700', color: '#234567' }); map.toggleCollapse(map.getNode(branch)!, { layout: true });
    const one = surface.addElement({ type: 'shape', shapeType: 'rect', xywh: '[10,600,100,80]' });
    const two = surface.addElement({ type: 'shape', shapeType: 'rect', xywh: '[310,600,100,80]' });
    surface.addElement({ type: 'connector', source: { id: one, position: [1, 0.5] }, target: { id: two, position: [0, 0.5] } });
    gfx.doc.captureSync();
  });
  const image = syntheticCanaries().imageBytes;
  await page.locator('input[type=file][accept="image/*"]').setInputFiles({ name: 'synthetic-canary.png', mimeType: 'image/png', buffer: image });
  await expect.poll(() => database.prepare('SELECT count(*) AS n FROM board_blobs WHERE board_id=?').get(board.summary.id)).toEqual({ n: 1 });
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  const native = () => page.locator('editor-host').evaluate(el => {
    const host = el as EditorHost; const root = host.querySelector('affine-edgeless-root') as HTMLElement & { gfx: GfxController }; const surface = root.gfx.surface!;
    const map = surface.elementModels.find(model => model.type === 'mindmap') as MindmapElementModel;
    const text = (id?: string) => id ? (surface.getElementById(id) as ShapeElementModel)?.text?.toString() : undefined;
    const relationships = [...map.children].map(([id, detail]) => { const shape = surface.getElementById(id) as ShapeElementModel; return { ...detail, parent: text(detail.parent), text: text(id), fontSize: shape.fontSize, fontWeight: shape.fontWeight, color: shape.color }; }).sort((a, b) => a.text!.localeCompare(b.text!));
    const connectors = surface.elementModels.filter(model => model.type === 'connector') as ConnectorElementModel[];
    const transformer = host.store.getTransformer(); const snapshot = transformer.docToSnapshot(host.store); transformer[Symbol.dispose]();
    return { snapshot, relationships, connected: connectors.map(connector => [surface.getElementById(connector.source.id!)?.type, surface.getElementById(connector.target.id!)?.type]), ids: [...surface.elementModels].map(el => el.id), docs: [...host.store.workspace.docs.keys()] };
  });
  const original = await native(); await page.goto(origin); const before = sourceState(board.summary.id);
  await card(page, board.summary.id).getByRole('button', { name: 'Duplicate board' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Duplicate board', exact: true }).click();
  await expect(page.getByText('Private copy created.', { exact: true })).toBeVisible();
  const rows = database.prepare('SELECT * FROM boards WHERE id<>?').all(board.summary.id) as { id: string; root_doc_id: string; content_doc_id: string; owner_id: string }[];
  expect(rows).toHaveLength(1); const copy = rows[0]!; expect(copy.owner_id).toBe(accountId); expect(copy.root_doc_id).not.toBe(board.rootDocId); expect(copy.content_doc_id).not.toBe(board.contentDocId);
  expect(database.prepare('SELECT * FROM board_grants WHERE board_id=?').all(copy.id)).toEqual([]); expect(database.prepare('SELECT * FROM pending_grants WHERE board_id=?').all(copy.id)).toEqual([]);
  expect(sourceState(board.summary.id)).toEqual(before);
  const copiedBlob = database.prepare('SELECT bytes FROM board_blobs WHERE board_id=?').get(copy.id) as { bytes: Buffer }; expect(createHash('sha256').update(copiedBlob.bytes).digest('hex')).toBe(createHash('sha256').update(image).digest('hex'));
  await expect(card(page, copy.id).getByRole('link')).toBeFocused(); await card(page, copy.id).getByRole('link').click();
  await expect(page.locator('affine-edgeless-root')).toBeVisible(); const copied = await native();
  expect(JSON.stringify(copied.snapshot)).toContain('Map canary'); expect(copied.ids.every(id => !original.ids.includes(id))).toBe(true); expect(copied.docs).toEqual([copy.content_doc_id]);
  expect(copied.relationships).toEqual(original.relationships); expect(copied.connected).toEqual([['shape', 'shape']]); expect(copied.connected).toEqual(original.connected);
  await page.goto(origin + '/?board=' + board.summary.id); await expect(page.locator('affine-edgeless-root')).toBeVisible(); const reopened = await native();
  expect(reopened.snapshot).toEqual(original.snapshot); expect(reopened.docs).toEqual(original.docs); expect(sourceState(board.summary.id)).toEqual(before);
});
