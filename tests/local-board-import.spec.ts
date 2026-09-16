import { randomBytes, randomUUID, createHash } from 'node:crypto';
import * as Y from 'yjs';
import type { Page } from '@playwright/test';
import type { GfxController } from '@blocksuite/affine/std/gfx';
import type { MindmapElementModel } from '@blocksuite/affine/model';
import { syntheticCanaries } from './access-fixtures';
import type { FastifyInstance } from 'fastify';
import { test, expect } from './fixtures';
import { createOidcProvider } from './oidc-provider';
import { buildApp } from '../server/app';
import { openDatabase, type AccountDatabase } from '../server/storage/database';
import { IMAGE_LIMITS } from '../server/boards/blobs';
let app: FastifyInstance; let database: AccountDatabase; let provider: Awaited<ReturnType<typeof createOidcProvider>>;
const origin = 'http://127.0.0.1:5499';
let accountId: string;
test.use({ expectErrors: ['the server responded with a status of 400', 'the server responded with a status of 401', 'the server responded with a status of 403', 'the server responded with a status of 404', 'the server responded with a status of 409', 'the server responded with a status of 413', 'the server responded with a status of 500', 'the server responded with a status of 503'] });
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

test('@03-11-01 actual commit rollback and lost acknowledgment reconcile the original operation', async ({ page }) => {
  await seedLocal(page); const before = await originalState(page);
  database.exec("CREATE TRIGGER synthetic_import_failure BEFORE INSERT ON board_documents BEGIN SELECT RAISE(ABORT, 'synthetic commit failure'); END");
  await page.getByRole('button', { name: 'Copy local boards', exact: true }).click(); const dialog = page.getByRole('dialog');
  await dialog.getByRole('checkbox', { name: 'Legacy map canary', exact: true }).check();
  await dialog.getByRole('button', { name: 'Copy selected boards', exact: true }).click(); await expect(dialog.getByText('Failed', { exact: true })).toBeVisible();
  expect(database.prepare('SELECT * FROM boards').all()).toEqual([]); expect(database.prepare('SELECT * FROM board_documents').all()).toEqual([]); expect(await originalState(page)).toEqual(before);
  database.exec('DROP TRIGGER synthetic_import_failure');
  await page.route('**/api/imports/*/commit', async route => { const response = await route.fetch(); expect(response.status()).toBe(200); await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }); });
  await dialog.getByRole('button', { name: 'Retry failed boards', exact: true }).click(); await expect(dialog.getByRole('link', { name: 'Open Legacy map canary', exact: true })).toBeVisible();
  expect(database.prepare("SELECT count(*) AS n FROM operations WHERE kind='import'").get()).toEqual({ n: 1 }); expect(database.prepare('SELECT count(*) AS n FROM boards').get()).toEqual({ n: 1 }); expect(await originalState(page)).toEqual(before);
});

test('@03-11-01 staging validates complete manifest and binds every operation to the authenticated importer', async ({ page, browser }) => {
  const local = await seedLocal(page); const before = await originalState(page);
  const headers = { Origin: origin, 'X-Dali-Account': accountId, 'X-Dali-Request': '1' };
  const operationId = randomUUID();
  const reserved = await page.request.post(origin + '/api/imports', { headers, data: { operationId, title: 'Manifest canary', manifest: [local.key] } }); expect(reserved.status()).toBe(200);
  expect((await page.request.post(origin + '/api/imports/' + operationId + '/commit', { headers, data: {} })).status()).toBe(409);
  const foreign = await browser.newContext(); const other = await foreign.newPage();
  try {
    await other.goto(origin); await other.getByRole('link', { name: 'Synthetic Editor', exact: true }).click(); await expect(other.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
    const otherId = (await (await other.request.get(origin + '/api/session')).json()).accountId;
    const denied = await other.request.get(origin + '/api/imports/' + operationId, { headers: { 'X-Dali-Account': otherId } }); expect(await denied.json()).toEqual({ status: 'unknown' });
    expect((await other.request.post(origin + '/api/imports/' + operationId + '/commit', { headers: { ...headers, 'X-Dali-Account': otherId }, data: {} })).status()).toBe(404);
    expect((await other.request.post(origin + '/api/imports', { headers, data: { operationId: randomUUID(), title: 'Denied canary', manifest: [] } })).status()).toBe(409);
  } finally { await foreign.close(); }
  expect(database.prepare('SELECT * FROM boards').all()).toEqual([]); expect(await originalState(page)).toEqual(before);
});
test.afterEach(async ({ page }) => { await page.unrouteAll({ behavior: 'ignoreErrors' }); await app?.close(); database?.close(); await provider?.close(); });
test("@03-11-01 selected local copy entry requires deliberate selection", async ({ page }) => {
  await expect(page.getByRole("button", { name: "Copy local boards", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Copy local boards", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Copy local boards" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy selected boards", exact: true })).toBeDisabled();
});

async function seedLocal(page: Page, titles = ['Legacy map canary', 'Unselected canary']) {
  const response = await page.request.post(origin + '/api/boards', { headers: { Origin: origin, 'X-Dali-Account': accountId, 'X-Dali-Request': '1' }, data: { title: 'Fixture source', operationId: randomUUID() } });
  const board = await response.json();
  await page.goto(origin + '/?board=' + board.summary.id);
  await page.getByRole('button', { name: 'Add mind map', exact: true }).click();
  await page.keyboard.type('Root canary'); await page.keyboard.press('Enter');
  await page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const map = gfx.surface!.elementModels.find(model => model.type === 'mindmap') as MindmapElementModel;
    const branch = map.addNode(map.tree.id, undefined, 'after', { text: 'Branch canary' });
    map.addNode(branch, undefined, 'after', { text: 'Hidden canary' });
    map.addNode(map.tree.id, undefined, 'after', { text: 'Sibling canary' });
    gfx.surface!.updateElement(branch, { fontSize: 27, fontWeight: '700', color: '#234567' });
    map.toggleCollapse(map.getNode(branch)!, { layout: true }); gfx.doc.captureSync();
  });
  const image = syntheticCanaries().imageBytes;
  await page.locator('input[type=file][accept="image/*"]').setInputFiles({ name: 'canary.png', mimeType: 'image/png', buffer: image });
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  await expect.poll(() => database.prepare('SELECT count(*) AS n FROM board_blobs WHERE board_id=?').get(board.summary.id)).toEqual({ n: 1 });
  const content = (database.prepare('SELECT update_bytes FROM board_documents WHERE board_id=? AND doc_id=?').get(board.summary.id, board.contentDocId) as { update_bytes: Buffer }).update_bytes;
  const ids = titles.map(() => randomUUID()); const root = new Y.Doc({ guid: 'djai-storyboard' });
  const pages = new Y.Array(); root.getMap('meta').set('pages', pages);
  pages.push(ids.map((id, i) => ({ id, title: titles[i], createDate: 1000 + i, updatedDate: 2000 + i, tags: [] })));
  ids.forEach(id => root.getMap('spaces').set(id, new Y.Doc({ guid: id })));
  const rows = [{ id: 'djai-storyboard', bytes: [...Y.encodeStateAsUpdate(root)] }, ...ids.map(id => ({ id, bytes: [...content] }))]; root.destroy();
  const key = createHash('sha256').update(image).digest('base64url') + '=';
  await page.goto(origin);
  await page.evaluate(async ({ rows, image, key }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const req = indexedDB.open('djai-storyboard', 1); req.onupgradeneeded = () => req.result.createObjectStore('collection', { keyPath: 'id' }); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
    await new Promise<void>((resolve, reject) => { const tx = db.transaction('collection', 'readwrite'); rows.forEach(row => tx.objectStore('collection').put({ id: row.id, updates: [{ timestamp: 1000, update: new Uint8Array(row.bytes) }] })); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); db.close();
    for (const [name, store, value] of [['djai-storyboard_blob', 'blob', new Uint8Array(image).buffer], ['djai-storyboard_blob_mime', 'blob_mime', 'image/png']] as const) {
      const db = await new Promise<IDBDatabase>((resolve, reject) => { const req = indexedDB.open(name, 1); req.onupgradeneeded = () => req.result.createObjectStore(store); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
      await new Promise<void>((resolve, reject) => { const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).put(value, key); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); db.close();
    }
    localStorage.setItem('djai-design.board-catalog.v1', JSON.stringify({}));
  }, { rows, image: [...image], key });
  database.prepare('DELETE FROM boards WHERE id=?').run(board.summary.id);
  return { ids, key, image };
}
async function originalState(page: Page) {
  const snapshot = await page.evaluate(async () => {
    const result: [string, string, string][] = [];
    for (const name of ['djai-storyboard', 'djai-storyboard_blob', 'djai-storyboard_blob_mime']) {
      const db = await new Promise<IDBDatabase>((resolve, reject) => { const req = indexedDB.open(name); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
      for (const store of db.objectStoreNames) {
        const values = await new Promise<unknown[]>((resolve, reject) => { const req = db.transaction(store, 'readonly').objectStore(store).getAll(); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
        result.push([name, store, JSON.stringify(values, (_key, value: unknown) => value instanceof ArrayBuffer ? [...new Uint8Array(value)] : value instanceof Uint8Array ? [...value] : value)]);
      }
      db.close();
    }
    return { result, catalog: localStorage.getItem('djai-design.board-catalog.v1') };
  });
  const records = JSON.parse(snapshot.result.find(([name]) => name === 'djai-storyboard')![2]) as { id: string; updates: { update: number[] }[] }[];
  const normalized = records.map(record => {
    const doc = new Y.Doc(); doc.getMap('blocks'); doc.getMap('meta'); doc.getMap('spaces');
    try { record.updates.forEach(update => Y.applyUpdate(doc, new Uint8Array(update.update))); return { id: record.id, value: JSON.stringify(doc.toJSON(), (_key, value: unknown) => value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value) }; }
    finally { doc.destroy(); }
  });
  return { ...snapshot, normalized };
}
test('@03-11-01 selected map and image publish privately with unchanged original bytes and membership', async ({ page }) => {
  const local = await seedLocal(page); const before = await originalState(page);
  await expect(page.getByRole('button', { name: 'Copy local boards', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Copy local boards', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Copy local boards' });
  await dialog.getByRole('checkbox', { name: 'Legacy map canary', exact: true }).check();
  await dialog.getByRole('button', { name: 'Copy selected boards', exact: true }).click();
  await expect(dialog.getByRole('link', { name: 'Open Legacy map canary', exact: true })).toBeVisible();
  const copies = database.prepare('SELECT * FROM boards').all() as { id: string; title: string; owner_id: string }[];
  expect(copies).toHaveLength(1); expect(copies[0]).toMatchObject({ title: 'Legacy map canary', owner_id: accountId });
  expect(database.prepare('SELECT * FROM board_grants').all()).toEqual([]); expect(database.prepare('SELECT * FROM pending_grants').all()).toEqual([]);
  const blob = database.prepare('SELECT bytes FROM board_blobs WHERE board_id=?').get(copies[0]!.id) as { bytes: Buffer };
  expect(blob.bytes).toEqual(local.image); expect(await originalState(page)).toEqual(before);
  await dialog.getByRole('link', { name: 'Open Legacy map canary', exact: true }).click();
  await expect(page.locator('affine-edgeless-root')).toBeVisible();
  const model = await page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const map = gfx.surface!.elementModels.find(model => model.type === 'mindmap') as MindmapElementModel;
    return { count: map.children.size, collapsed: [...map.children.values()].some(detail => detail.collapsed), text: JSON.stringify(gfx.doc.spaceDoc.toJSON()) };
  });
  expect(model.count).toBe(4); expect(model.collapsed).toBe(true);
  for (const text of ['Root canary', 'Branch canary', 'Hidden canary', 'Sibling canary']) expect(model.text).toContain(text);
  expect(await originalState(page)).toEqual(before);
});

for (const failure of ['upload', 'commit', 'missing-image'] as const) test(`@03-11-01 ${failure} retains originals and publishes only a complete reconciled copy`, async ({ page }) => {
  const local = await seedLocal(page);
  if (failure === 'missing-image') await page.evaluate(async key => {
    const req = indexedDB.open('djai-storyboard_blob'); const db = await new Promise<IDBDatabase>(resolve => { req.onsuccess = () => resolve(req.result); });
    await new Promise<void>(resolve => { const tx = db.transaction('blob', 'readwrite'); tx.objectStore('blob').delete(key); tx.oncomplete = () => resolve(); }); db.close();
  }, local.key);
  const before = await originalState(page); const attempts: string[] = [];
  const routePattern = failure === 'upload' ? '**/api/imports/*/blobs/*' : '**/api/imports/*/commit';
  if (failure !== 'missing-image') await page.route(routePattern, route => { attempts.push(route.request().url()); return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }); });
  await page.getByRole('button', { name: 'Copy local boards', exact: true }).click(); const dialog = page.getByRole('dialog');
  await dialog.getByRole('checkbox', { name: 'Legacy map canary', exact: true }).check();
  await dialog.getByRole('button', { name: 'Copy selected boards', exact: true }).click();
  await expect(dialog.getByText('Failed', { exact: true })).toBeVisible();
  expect(database.prepare('SELECT * FROM boards').all()).toEqual([]); expect(await originalState(page)).toEqual(before);
  if (failure !== 'missing-image') {
    await page.unroute(routePattern); await dialog.getByRole('button', { name: 'Retry failed boards', exact: true }).click();
    await expect(dialog.getByRole('link', { name: 'Open Legacy map canary', exact: true })).toBeVisible();
    expect(database.prepare("SELECT count(*) AS n FROM operations WHERE kind='import'").get()).toEqual({ n: 1 });
    expect(database.prepare('SELECT count(*) AS n FROM boards').get()).toEqual({ n: 1 }); expect(attempts).toHaveLength(1);
    expect(await originalState(page)).toEqual(before);
  }
  await dialog.getByRole('button', { name: 'Close local copies', exact: true }).click(); expect(await originalState(page)).toEqual(before);
});

test('@03-11-02 empty inventory never creates legacy storage and stays distinct from unavailable storage', async ({ page }) => {
  const before = await page.evaluate(async () => ({ dbs: await indexedDB.databases(), catalog: localStorage.getItem('djai-design.board-catalog.v1') }));
  await page.getByRole('button', { name: 'Copy local boards', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('No local boards are available in this browser.', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Copy selected boards', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Close local copies', exact: true }).click();
  expect(await page.evaluate(async () => ({ dbs: await indexedDB.databases(), catalog: localStorage.getItem('djai-design.board-catalog.v1') }))).toEqual(before);
  const storage = await page.evaluateHandle(() => indexedDB);
  await page.evaluate(() => { Object.defineProperty(window, 'indexedDB', { configurable: true, get() { throw new Error('Synthetic unavailable storage'); } }); });
  await page.getByRole('button', { name: 'Copy local boards', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('read local boards'); await expect(dialog.getByText('No local boards are available in this browser.', { exact: true })).toHaveCount(0);
  await page.evaluate(storage => { Object.defineProperty(window, 'indexedDB', { configurable: true, value: storage }); }, storage);
  await storage.dispose();
  await dialog.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(dialog.getByText('No local boards are available in this browser.', { exact: true })).toBeVisible();
});

test('@03-11-02 multiple explicit selections retain per-row partial success and retry only the failed operation', async ({ page }) => {
  await seedLocal(page); const before = await originalState(page);
  let commits = 0; const paths: string[] = [];
  await page.route('**/api/imports/*/commit', route => { paths.push(route.request().url()); commits++; return commits === 2 ? route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }) : route.continue(); });
  await page.getByRole('button', { name: 'Copy local boards', exact: true }).click(); const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('checkbox', { checked: true })).toHaveCount(0);
  for (const title of ['Legacy map canary', 'Unselected canary']) await dialog.getByRole('checkbox', { name: title, exact: true }).check();
  await expect(dialog.getByText('2 boards selected.', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Copy selected boards', exact: true }).click();
  await expect(dialog.getByText('1 copied; 1 could not be copied. Retry the failed boards. Originals remain in this browser.', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'Open Legacy map canary', exact: true })).toBeVisible();
  expect(database.prepare('SELECT count(*) AS n FROM boards').get()).toEqual({ n: 1 }); expect(await originalState(page)).toEqual(before);
  await dialog.getByRole('button', { name: 'Retry failed boards', exact: true }).click();
  await expect(dialog.getByText('2 boards copied. Originals remain in this browser.', { exact: true })).toBeVisible();
  expect(paths).toHaveLength(3); expect(paths[2]).toBe(paths[1]); expect(paths[2]).not.toBe(paths[0]);
  expect(database.prepare('SELECT count(*) AS n FROM boards').get()).toEqual({ n: 2 }); expect(await originalState(page)).toEqual(before);
});

test('@03-11-02 inventory reads original catalog titles and excludes account recovery namespaces', async ({ page }) => {
  const local = await seedLocal(page, ['Root title']);
  await page.evaluate(async id => {
    localStorage.setItem('djai-design.board-catalog.v1', JSON.stringify({ [id]: { title: 'Exact catalog title 界', createdAt: 1000, updatedAt: 3000 } }));
    for (const name of ['dali-account-recovery-v1', 'dali-account-cache-canary']) await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open(name); req.onupgradeneeded = () => req.result.createObjectStore('canary').put({ title: 'Private recovery canary' }, 'secret'); req.onsuccess = () => { req.result.close(); resolve(); }; req.onerror = () => reject(req.error);
    });
  }, local.ids[0]!);
  const before = await originalState(page); await page.getByRole('button', { name: 'Copy local boards', exact: true }).click(); const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('checkbox', { name: 'Exact catalog title 界', exact: true })).toBeVisible(); await expect(dialog.getByRole('checkbox')).toHaveCount(1);
  await expect(dialog).not.toContainText('Private recovery canary'); await dialog.getByRole('button', { name: 'Close local copies', exact: true }).click(); expect(await originalState(page)).toEqual(before);
});

test('@03-11-03 in-flight close waits for the real outcome and stops before the next copy', async ({ page }) => {
  await seedLocal(page); const before = await originalState(page);
  let release!: () => void; const barrier = new Promise<void>(resolve => { release = resolve; }); let received = false;
  await page.route('**/api/imports/*/commit', async route => { received = true; await barrier; await route.continue(); });
  await page.getByRole('button', { name: 'Copy local boards', exact: true }).click(); const dialog = page.getByRole('dialog');
  for (const title of ['Legacy map canary', 'Unselected canary']) await dialog.getByRole('checkbox', { name: title, exact: true }).check();
  await dialog.getByRole('button', { name: 'Copy selected boards', exact: true }).click(); await expect.poll(() => received).toBe(true);
  try {
    await expect(dialog.getByText('Copying 0 of 2 boards…', { exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Close local copies', exact: true })).toBeEnabled();
    await dialog.getByRole('button', { name: 'Close local copies', exact: true }).click();
    await expect(dialog.getByRole('status')).toContainText('Finishing the current copy before closing');
    expect(database.prepare('SELECT * FROM boards').all()).toEqual([]);
  } finally { release(); }
  await expect(dialog).toHaveCount(0);
  expect(database.prepare('SELECT count(*) AS n FROM boards').get()).toEqual({ n: 1 }); expect(await originalState(page)).toEqual(before);
  await expect(page.getByRole('button', { name: 'Copy local boards', exact: true })).toBeFocused();
});

test('@03-11-03 fifty long rows fit at 490px with fixed actions keyboard focus and reduced motion', async ({ page }) => {
  await seedLocal(page, Array.from({ length: 50 }, (_, index) => `${index} ${'界'.repeat(120)}`)); const before = await originalState(page);
  await page.setViewportSize({ width: 490, height: 600 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Copy local boards', exact: true }).click(); const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Copy local boards', exact: true })).toBeFocused();
  await expect(dialog.getByRole('checkbox')).toHaveCount(50);
  const geometry = await dialog.evaluate(el => {
    const bounds = el.getBoundingClientRect(); const body = el.querySelector('.local-copy-dialog__body')!;
    return { left: bounds.left, right: bounds.right, height: bounds.height, overflow: body.scrollHeight > body.clientHeight,
      buttons: [...el.querySelectorAll('button')].map(button => ({ height: button.getBoundingClientRect().height, bottom: button.getBoundingClientRect().bottom })), animation: getComputedStyle(el).animationName };
  });
  expect(geometry.left).toBeGreaterThanOrEqual(16); expect(geometry.right).toBeLessThanOrEqual(474); expect(geometry.height).toBeLessThanOrEqual(568); expect(geometry.overflow).toBe(true);
  geometry.buttons.forEach(button => { expect(button.height).toBeGreaterThanOrEqual(44); expect(button.bottom).toBeLessThanOrEqual(584); }); expect(geometry.animation).toBe('none');
  await dialog.getByRole('checkbox').last().focus(); await page.keyboard.press('Space'); await expect(dialog.getByText('1 board selected.', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Close local copies', exact: true }).focus(); await page.keyboard.press('Tab');
  expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(page.getByRole('button', { name: 'Copy local boards', exact: true })).toBeFocused();
  expect(await originalState(page)).toEqual(before);
});

for (const identity of ['same', 'different'] as const) test(`@03-11-03 expiry stops new copies and ${identity} account requires deliberate authorized recovery`, async ({ page, context }) => {
  await seedLocal(page); const before = await originalState(page); let requests = 0;
  await page.route('**/api/imports/*/commit', async route => { requests++; database.prepare('UPDATE sessions SET expires_at=0').run(); await route.continue(); });
  await page.getByRole('button', { name: 'Copy local boards', exact: true }).click(); let dialog = page.getByRole('dialog', { name: 'Copy local boards' });
  for (const title of ['Legacy map canary', 'Unselected canary']) await dialog.getByRole('checkbox', { name: title, exact: true }).check();
  await dialog.getByRole('button', { name: 'Copy selected boards', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in to continue', exact: true })).toBeVisible();
  await expect(dialog).toHaveCount(0); expect(requests).toBe(1);
  expect(database.prepare('SELECT * FROM boards').all()).toEqual([]); expect(await originalState(page)).toEqual(before);
  const firstOperation = (database.prepare("SELECT operation_id FROM operations WHERE kind='import'").get() as { operation_id: string }).operation_id;
  await page.unroute('**/api/imports/*/commit');
  if (identity === 'different') await context.clearCookies({ name: 'dali_fixture_identity' });
  await page.getByRole('button', { name: 'Sign in to continue', exact: true }).click();
  if (identity === 'different') { await page.getByRole('link', { name: 'Synthetic Editor', exact: true }).click(); await page.getByRole('button', { name: 'Back to your boards', exact: true }).click(); }
  await expect(page.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Copy local boards', exact: true }).click(); dialog = page.getByRole('dialog', { name: 'Copy local boards' });
  if (identity === 'same') {
    await expect(dialog.getByRole('checkbox', { checked: true })).toHaveCount(2);
    await dialog.getByRole('button', { name: 'Resume copies', exact: true }).click();
    await expect(dialog.getByText('2 boards copied. Originals remain in this browser.', { exact: true })).toBeVisible();
    expect(database.prepare('SELECT status FROM operations WHERE operation_id=?').get(firstOperation)).toEqual({ status: 'completed' });
    expect(database.prepare("SELECT count(*) AS n FROM operations WHERE kind='import'").get()).toEqual({ n: 2 });
  } else {
    await expect(dialog.getByRole('checkbox', { checked: true })).toHaveCount(0); await expect(dialog.getByRole('link')).toHaveCount(0);
    await dialog.getByRole('checkbox', { name: 'Legacy map canary', exact: true }).check(); await dialog.getByRole('button', { name: 'Copy selected boards', exact: true }).click();
    await expect(dialog.getByRole('link', { name: 'Open Legacy map canary', exact: true })).toBeVisible();
    const owner = (database.prepare('SELECT owner_id FROM boards').get() as { owner_id: string }).owner_id; expect(owner).not.toBe(accountId);
    expect(database.prepare('SELECT status FROM operations WHERE operation_id=?').get(firstOperation)).toEqual({ status: 'staging' });
  }
  expect(await originalState(page)).toEqual(before);
});

test('@03-11-03 server image quota denial preserves originals and retries the same operation', async ({ page }) => {
  await seedLocal(page, ['Quota canary']); const before = await originalState(page); const limit = IMAGE_LIMITS.boardBytes;
  IMAGE_LIMITS.boardBytes = 1;
  try {
    await page.getByRole('button', { name: 'Copy local boards', exact: true }).click(); const dialog = page.getByRole('dialog');
    await dialog.getByRole('checkbox').check(); await dialog.getByRole('button', { name: 'Copy selected boards', exact: true }).click();
    await expect(dialog.getByText('Failed', { exact: true })).toBeVisible(); expect(database.prepare('SELECT * FROM boards').all()).toEqual([]); expect(await originalState(page)).toEqual(before);
    IMAGE_LIMITS.boardBytes = limit; await dialog.getByRole('button', { name: 'Retry failed boards', exact: true }).click();
    await expect(dialog.getByText('1 board copied. Originals remain in this browser.', { exact: true })).toBeVisible();
    expect(database.prepare("SELECT count(*) AS n FROM operations WHERE kind='import'").get()).toEqual({ n: 1 }); expect(await originalState(page)).toEqual(before);
  } finally { IMAGE_LIMITS.boardBytes = limit; }
});

test('@03-11-03 timed out commit checks authoritative status before acknowledging one copy', async ({ page }) => {
  await seedLocal(page, ['Timeout canary']); const before = await originalState(page); await page.clock.install();
  let release!: () => void; const barrier = new Promise<void>(resolve => { release = resolve; }); let committed = false;
  await page.route('**/api/imports/*/commit', async route => { const response = await route.fetch(); expect(response.status()).toBe(200); committed = true; await barrier; await route.fulfill({ response }).catch(() => {}); });
  try {
    await page.getByRole('button', { name: 'Copy local boards', exact: true }).click(); const dialog = page.getByRole('dialog');
    await dialog.getByRole('checkbox').check(); await dialog.getByRole('button', { name: 'Copy selected boards', exact: true }).click();
    await expect.poll(() => committed).toBe(true); await page.clock.fastForward(10001);
    await expect(dialog.getByText('1 board copied. Originals remain in this browser.', { exact: true })).toBeVisible();
    expect(database.prepare('SELECT count(*) AS n FROM boards').get()).toEqual({ n: 1 }); expect(await originalState(page)).toEqual(before);
  } finally { release(); }
});
