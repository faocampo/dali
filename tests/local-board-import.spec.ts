import { readRecoveryEpoch } from '../server/storage/recovery-state';
import { fileAction, openBoardImport } from './app-menu';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import * as Y from 'yjs';
import type { Page } from '@playwright/test';
import type { GfxController } from '@blocksuite/affine/std/gfx';
import type { MindmapElementModel, ShapeElementModel } from '@blocksuite/affine/model';
import { proxyApplicationAssets, syntheticCanaries } from './access-fixtures';
import type { FastifyInstance } from 'fastify';
import { test, expect } from './fixtures';
import { createOidcProvider } from './oidc-provider';
import { buildApp } from '../server/app';
import { openDatabase, type AccountDatabase } from '../server/storage/database';
import { IMAGE_LIMITS } from '../server/boards/blobs';
let closeProxy: (() => void) | undefined;
let app: FastifyInstance; let database: AccountDatabase; let provider: Awaited<ReturnType<typeof createOidcProvider>>;
const origin = 'http://127.0.0.1:5499';
let accountId: string;
test.use({ expectErrors: ['the server responded with a status of 400', 'the server responded with a status of 401', 'the server responded with a status of 403', 'the server responded with a status of 404', 'the server responded with a status of 409', 'the server responded with a status of 413', 'the server responded with a status of 500', 'the server responded with a status of 503'] });
test.beforeEach(async ({ page, baseURL }) => {
  const registration = { clientId: 'synthetic-actions', clientSecret: randomBytes(32).toString('hex'), redirectUri: origin + '/auth/callback' };
  provider = await createOidcProvider({ clients: [registration] }); database = openDatabase(':memory:');
  app = await buildApp({ storagePolicy: { kind: 'fixture' }, database, config: { DALI_ORIGIN: origin, DALI_DATABASE_PATH: ':memory:', DALI_SESSION_SECRET: randomBytes(32).toString('hex'), DALI_SESSION_TTL_MS: '86400000', DALI_OIDC_ISSUER: provider.issuer, DALI_OIDC_CLIENT_ID: registration.clientId, DALI_OIDC_CLIENT_SECRET: registration.clientSecret, DALI_OIDC_CALLBACK_URL: registration.redirectUri, DALI_INTERNAL_CLAIM: 'membership', DALI_INTERNAL_VALUES_JSON: '["internal"]', DALI_INTERNAL_EMAIL_DOMAINS_JSON: '["example.org"]', DALI_ROLE_CLAIM: 'app_role', DALI_EDITOR_VALUES_JSON: '["editor"]' } });
  closeProxy = proxyApplicationAssets(app, baseURL!);
  await app.listen({ host: '127.0.0.1', port: 5499 });
  await page.goto(origin); await page.getByRole('link', { name: 'Synthetic Owner', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
  accountId = (await (await page.request.get(origin + '/api/session')).json()).accountId;
});

import { unzipSync, zipSync } from 'fflate';

test.afterEach(async ({ page }) => { await page.unrouteAll({ behavior: 'ignoreErrors' }); closeProxy?.(); closeProxy = undefined; await app?.close(); database?.close(); await provider?.close(); });

async function seedLocal(page: Page, titles = ['Legacy map canary', 'Unselected canary']) {
  const response = await page.request.post(origin + '/api/boards', { headers: { Origin: origin, 'X-Dali-Account': accountId, 'X-Dali-Recovery-Epoch': readRecoveryEpoch(database), 'X-Dali-Request': '1' }, data: { title: 'Fixture source', operationId: randomUUID() } });
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
  const semantic = await nativeSemantic(page);
  await fileAction(page, 'Export board'); const pending = page.waitForEvent('download');
  await page.getByRole('dialog', { name: 'Export board', exact: true }).getByRole('button', { name: 'Download', exact: true }).click();
  const download = await pending; const chunks: Buffer[] = [];
  for await (const chunk of (await download.createReadStream())!) chunks.push(Buffer.from(chunk));
  const archive = { name: 'Imported canary.bs.zip', mimeType: 'application/zip', buffer: Buffer.concat(chunks) };
  await page.getByRole('button', { name: 'Close', exact: true }).click();
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
  return { ids, key, image, semantic, archive };
}
async function nativeSemantic(page: Page) {
  return page.locator('affine-edgeless-root').evaluate(el => {
    const surface = (el as HTMLElement & { gfx: GfxController }).gfx.surface!;
    const map = surface.elementModels.find(model => model.type === 'mindmap') as MindmapElementModel;
    const text = (id?: string) => id ? (surface.getElementById(id) as ShapeElementModel)?.text?.toString() : undefined;
    return [...map.children].map(([id, detail]) => {
      const shape = surface.getElementById(id) as ShapeElementModel;
      return { ...detail, parent: text(detail.parent), text: text(id), fontSize: shape.fontSize, fontWeight: shape.fontWeight, color: shape.color };
    }).sort((a, b) => a.text!.localeCompare(b.text!));
  });
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

// The library's legacy-selection UI was retired. Keep source preservation and
// staged-import coverage, now exercised through real exported files.
const importDialog = (page: Page) => page.getByRole('dialog', { name: 'Import board', exact: true });
async function chooseArchive(page: Page, archive: { name: string; mimeType: string; buffer: Buffer }) {
  await openBoardImport(page);
  const pending = page.waitForEvent('filechooser'); await importDialog(page).getByRole('button', { name: 'Choose board file' }).click();
  await (await pending).setFiles(archive);
}
async function dropFiles(page: Page, files: { name: string; mimeType: string; buffer: Buffer }[]) {
  const dataTransfer = await page.evaluateHandle(files => {
    const transfer = new DataTransfer();
    for (const file of files) transfer.items.add(new File([new Uint8Array(file.bytes)], file.name, { type: file.mimeType }));
    return transfer;
  }, files.map(file => ({ name: file.name, mimeType: file.mimeType, bytes: [...file.buffer] })));
  try { await importDialog(page).getByRole('button', { name: 'Choose board file' }).dispatchEvent('drop', { dataTransfer }); }
  finally { await dataTransfer.dispose(); }
}
for (const method of ['picker', 'drop'] as const) test(`file import by ${method} preserves native objects and images with new private ownership`, async ({ page }) => {
  const local = await seedLocal(page); const before = await originalState(page);
  await expect(page.getByRole('button', { name: 'Copy local boards', exact: true })).toHaveCount(0);
  if (method === 'picker') await chooseArchive(page, local.archive);
  else { await openBoardImport(page); await dropFiles(page, [local.archive]); }
  const dialog = importDialog(page);
  expect(database.prepare('SELECT count(*) AS n FROM boards').get()).toEqual({ n: 0 });
  await dialog.getByRole('button', { name: 'Import board', exact: true }).dblclick();
  await expect(dialog.getByRole('link', { name: 'Open board', exact: true })).toBeVisible();
  const copies = database.prepare('SELECT * FROM boards').all() as { id: string; title: string; owner_id: string }[];
  expect(copies).toHaveLength(1); expect(copies[0]).toMatchObject({ title: 'Imported canary', owner_id: accountId });
  expect(database.prepare('SELECT * FROM board_grants').all()).toEqual([]); expect(database.prepare('SELECT * FROM pending_grants').all()).toEqual([]);
  expect((database.prepare('SELECT bytes FROM board_blobs WHERE board_id=?').get(copies[0]!.id) as { bytes: Buffer }).bytes).toEqual(local.image);
  expect(await originalState(page)).toEqual(before);
  await dialog.getByRole('link', { name: 'Open board', exact: true }).click();
  await expect(page.locator('affine-edgeless-root')).toBeVisible(); expect(await nativeSemantic(page)).toEqual(local.semantic);
  await page.reload(); await expect(page.locator('affine-edgeless-root')).toBeVisible(); expect(await nativeSemantic(page)).toEqual(local.semantic);
  expect(await originalState(page)).toEqual(before);
});

test('import opens without reading local boards, cancels and restores focus at narrow widths', async ({ page }, info) => {
  const before = await page.evaluate(async () => ({ dbs: await indexedDB.databases(), catalog: localStorage.getItem('djai-design.board-catalog.v1') }));
  for (const width of [1404, 707, 320]) {
    await page.setViewportSize({ width, height: 700 }); await openBoardImport(page); const dialog = importDialog(page);
    await expect(dialog.getByRole('button', { name: 'Choose board file' })).toBeFocused();
    await expect(dialog.getByRole('button', { name: 'Import board', exact: true })).toBeDisabled();
    const box = (await dialog.boundingBox())!; expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.y + box.height).toBeLessThanOrEqual(700);
    await page.screenshot({ path: info.outputPath(`file-import-${width}.png`) });
    await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(page.getByRole('button', { name: 'Import', exact: true })).toBeFocused();
  }
  expect(await page.evaluate(async () => ({ dbs: await indexedDB.databases(), catalog: localStorage.getItem('djai-design.board-catalog.v1') }))).toEqual(before);
  expect(database.prepare('SELECT * FROM boards').all()).toEqual([]);
});

test('unsupported, empty and multiple files are rejected before creating an import', async ({ page }) => {
  await openBoardImport(page); const dialog = importDialog(page);
  for (const [files, message] of [
    [[{ name: 'photo.png', mimeType: 'image/png', buffer: syntheticCanaries().imageBytes }], 'exported Dalí board'],
    [[{ name: 'empty.zip', mimeType: 'application/zip', buffer: Buffer.alloc(0) }], 'non-empty'],
    [[{ name: 'one.zip', mimeType: 'application/zip', buffer: Buffer.from('x') }, { name: 'two.zip', mimeType: 'application/zip', buffer: Buffer.from('y') }], 'one board file'],
  ] as const) {
    await dropFiles(page, [...files]); await expect(dialog.getByRole('alert')).toContainText(message);
    await expect(dialog.getByRole('button', { name: 'Import board', exact: true })).toBeDisabled();
  }
  expect(database.prepare('SELECT * FROM operations').all()).toEqual([]);
});

for (const invalid of ['corrupt', 'missing-image', 'multiple-boards'] as const) test(`${invalid} archive does not publish a board and another file can be selected`, async ({ page }) => {
  const local = await seedLocal(page); const before = await originalState(page);
  const files = unzipSync(local.archive.buffer);
  if (invalid === 'missing-image') for (const key of Object.keys(files)) if (key.startsWith('assets/')) delete files[key];
  if (invalid === 'multiple-boards') { const key = Object.keys(files).find(key => key.endsWith('.snapshot.json'))!; const second = JSON.parse(Buffer.from(files[key]!).toString()); second.meta.id = randomUUID(); files['second.snapshot.json'] = new TextEncoder().encode(JSON.stringify(second)); }
  const bad = { ...local.archive, buffer: invalid === 'corrupt' ? Buffer.from('invalid zip') : Buffer.from(zipSync(files)) };
  await chooseArchive(page, bad); const dialog = importDialog(page);
  await dialog.getByRole('button', { name: 'Import board', exact: true }).click(); await expect(dialog.getByRole('alert')).toBeVisible();
  expect(database.prepare('SELECT * FROM boards').all()).toEqual([]); expect(await originalState(page)).toEqual(before);
  await dialog.locator('input[type=file]').setInputFiles(local.archive);
  await dialog.getByRole('button', { name: 'Import board', exact: true }).click(); await expect(dialog.getByRole('link', { name: 'Open board', exact: true })).toBeVisible();
  expect(database.prepare('SELECT count(*) AS n FROM boards').get()).toEqual({ n: 1 });
});

for (const failure of ['upload', 'commit', 'quota'] as const) test(`${failure} failure retries the same operation and preserves original data`, async ({ page }) => {
  const local = await seedLocal(page); const before = await originalState(page); const limit = IMAGE_LIMITS.boardBytes;
  if (failure === 'upload') await page.route('**/api/imports/*/blobs/*', route => route.fulfill({ status: 503, json: {} }));
  if (failure === 'commit') database.exec("CREATE TRIGGER synthetic_import_failure BEFORE INSERT ON board_documents BEGIN SELECT RAISE(ABORT, 'synthetic commit failure'); END");
  if (failure === 'quota') IMAGE_LIMITS.boardBytes = 1;
  try {
    await chooseArchive(page, local.archive); const dialog = importDialog(page);
    await dialog.getByRole('button', { name: 'Import board', exact: true }).click(); await expect(dialog.getByRole('alert')).toBeVisible();
    expect(database.prepare('SELECT * FROM boards').all()).toEqual([]); expect(database.prepare('SELECT * FROM board_documents').all()).toEqual([]); expect(await originalState(page)).toEqual(before);
    await page.unrouteAll({ behavior: 'ignoreErrors' }); if (failure === 'commit') database.exec('DROP TRIGGER synthetic_import_failure'); IMAGE_LIMITS.boardBytes = limit;
    await dialog.getByRole('button', { name: 'Import board', exact: true }).click(); await expect(dialog.getByRole('link', { name: 'Open board', exact: true })).toBeVisible();
    expect(database.prepare("SELECT count(*) AS n FROM operations WHERE kind='import'").get()).toEqual({ n: 1 }); expect(await originalState(page)).toEqual(before);
  } finally { IMAGE_LIMITS.boardBytes = limit; }
});

test('uncertain completed import preserves the file until reconciliation and never duplicates it', async ({ page }) => {
  const local = await seedLocal(page); let committed = false;
  await page.route('**/api/imports/*', route => route.request().method() === 'GET' && committed ? route.fulfill({ status: 503, json: {} }) : route.continue());
  await page.route('**/api/imports/*/commit', async route => { await route.fetch(); committed = true; await route.fulfill({ status: 503, json: {} }); });
  await chooseArchive(page, local.archive); const dialog = importDialog(page);
  await dialog.getByRole('button', { name: 'Import board', exact: true }).click(); await expect(dialog.getByRole('alert')).toContainText('could not be confirmed');
  await expect(dialog.getByRole('button', { name: 'Close import', exact: true })).toBeDisabled(); await expect(dialog.getByRole('button', { name: 'Choose board file' })).toBeDisabled();
  await page.keyboard.press('Escape'); await expect(dialog).toBeVisible(); expect(database.prepare('SELECT count(*) AS n FROM boards').get()).toEqual({ n: 1 });
  await page.unrouteAll({ behavior: 'ignoreErrors' }); await dialog.getByRole('button', { name: 'Check import again', exact: true }).click();
  await expect(dialog.getByRole('link', { name: 'Open board', exact: true })).toBeVisible(); expect(database.prepare('SELECT count(*) AS n FROM boards').get()).toEqual({ n: 1 });
});

test('system Viewers cannot open or submit library imports', async ({ page, context }) => {
  await context.clearCookies(); await page.goto(origin + '/auth/start'); await page.getByRole('link', { name: 'Synthetic Viewer', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Import', exact: true })).toHaveCount(0);
  const member = await (await page.request.get(origin + '/api/session')).json();
  const response = await page.request.post(origin + '/api/imports', { headers: { Origin: origin, 'X-Dali-Account': member.accountId, 'X-Dali-Recovery-Epoch': readRecoveryEpoch(database), 'X-Dali-Request': '1' }, data: { operationId: randomUUID(), title: 'Denied import', manifest: [] } });
  expect(response.status()).toBe(403); expect(database.prepare('SELECT * FROM boards').all()).toEqual([]);
});

test('@03-11-01 staging validates complete manifest and binds every operation to the authenticated importer', async ({ page, browser }) => {
  const local = await seedLocal(page); const before = await originalState(page);
  const headers = { Origin: origin, 'X-Dali-Account': accountId, 'X-Dali-Recovery-Epoch': readRecoveryEpoch(database), 'X-Dali-Request': '1' };
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

test('oversized files are rejected before creating an import', async ({ page }) => {
  await openBoardImport(page); const dialog = importDialog(page);
  await dialog.locator('input[type=file]').setInputFiles({ name: 'oversized.zip', mimeType: 'application/zip', buffer: Buffer.alloc(32 * 1024 * 1024 + 1) });
  await expect(dialog.getByRole('alert')).toContainText('up to 32 MB');
  await expect(dialog.getByRole('button', { name: 'Import board', exact: true })).toBeDisabled();
  expect(database.prepare('SELECT * FROM operations').all()).toEqual([]);
});

for (const identity of ['same', 'different'] as const) test(`expiry hides the import and ${identity} account must choose its own file`, async ({ page, context }) => {
  const local = await seedLocal(page); const before = await originalState(page);
  await page.route('**/api/imports/*/commit', async route => { database.prepare('UPDATE sessions SET expires_at=0').run(); await route.continue(); });
  await chooseArchive(page, local.archive); await importDialog(page).getByRole('button', { name: 'Import board', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in to continue', exact: true })).toBeVisible();
  await expect(importDialog(page)).toHaveCount(0); expect(database.prepare('SELECT * FROM boards').all()).toEqual([]); expect(await originalState(page)).toEqual(before);
  await page.unroute('**/api/imports/*/commit');
  if (identity === 'different') await context.clearCookies({ name: 'dali_fixture_identity' });
  await page.getByRole('button', { name: 'Sign in to continue', exact: true }).click();
  if (identity === 'different') { await page.getByRole('link', { name: 'Synthetic Editor', exact: true }).click(); await page.getByRole('button', { name: 'Back to your boards', exact: true }).click(); }
  await expect(page.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
  await openBoardImport(page); const dialog = importDialog(page);
  await expect(dialog.getByRole('button', { name: 'Import board', exact: true })).toBeDisabled(); await expect(dialog.getByRole('link')).toHaveCount(0);
  await dialog.locator('input[type=file]').setInputFiles(local.archive);
  await dialog.getByRole('button', { name: 'Import board', exact: true }).click(); await expect(dialog.getByRole('link', { name: 'Open board', exact: true })).toBeVisible();
  const current = await (await page.request.get(origin + '/api/session')).json();
  expect(database.prepare('SELECT owner_id FROM boards').all()).toEqual([{ owner_id: current.accountId }]); expect(await originalState(page)).toEqual(before);
});
