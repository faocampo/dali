import { boardAction, openBoardActions, editBoardTitle, fileAction } from './app-menu';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Page } from '@playwright/test';
import type { EditorHost } from '@blocksuite/affine/std';
import type { GfxController } from '@blocksuite/affine/std/gfx';
import type { MindmapElementModel, ShapeElementModel, ConnectorElementModel } from '@blocksuite/affine/model';
import { test, expect } from './fixtures';
import { createOidcProvider } from './oidc-provider';
import { proxyApplicationAssets, syntheticCanaries } from './access-fixtures';
import { buildApp } from '../server/app';
import { openDatabase, type AccountDatabase } from '../server/storage/database';
import * as Y from 'yjs';
import { unzipSync, zipSync } from 'fflate';
let closeProxy: (() => void) | undefined;
let app: FastifyInstance; let database: AccountDatabase; let provider: Awaited<ReturnType<typeof createOidcProvider>>;
let accountId: string; const origin = 'http://127.0.0.1:5499';
test.use({ expectErrors: ['the server responded with a status of 400', 'the server responded with a status of 401', 'the server responded with a status of 403', 'the server responded with a status of 404', 'the server responded with a status of 409', 'the server responded with a status of 503'] });
test.beforeEach(async ({ page, baseURL }) => {
  const registration = { clientId: 'synthetic-actions', clientSecret: randomBytes(32).toString('hex'), redirectUri: origin + '/auth/callback' };
  provider = await createOidcProvider({ clients: [registration] }); database = openDatabase(':memory:');
  app = await buildApp({ database, config: { DALI_ORIGIN: origin, DALI_DATABASE_PATH: ':memory:', DALI_SESSION_SECRET: randomBytes(32).toString('hex'), DALI_SESSION_TTL_MS: '86400000', DALI_OIDC_ISSUER: provider.issuer, DALI_OIDC_CLIENT_ID: registration.clientId, DALI_OIDC_CLIENT_SECRET: registration.clientSecret, DALI_OIDC_CALLBACK_URL: registration.redirectUri, DALI_INTERNAL_CLAIM: 'membership', DALI_INTERNAL_VALUES_JSON: '["internal"]', DALI_INTERNAL_EMAIL_DOMAINS_JSON: '["example.org"]' } });
  closeProxy = proxyApplicationAssets(app, baseURL!);
  await app.listen({ host: '127.0.0.1', port: 5499 });
  await page.goto(origin); await page.getByRole('link', { name: 'Synthetic Owner', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
  accountId = (await (await page.request.get(origin + '/api/session')).json()).accountId;
});
test.afterEach(async ({ page }) => { await page.unrouteAll({ behavior: 'ignoreErrors' }); closeProxy?.(); closeProxy = undefined; await app?.close(); database?.close(); await provider?.close(); });
const headers = () => ({ Origin: origin, 'X-Dali-Account': accountId, 'X-Dali-Request': '1' });
async function create(page: Page, title = 'Synthetic actions') {
  const response = await page.request.post(origin + '/api/boards', { headers: headers(), data: { title, operationId: randomUUID() } }); expect(response.status()).toBe(201); return response.json();
}
const card = (page: Page, id: string) => page.locator('[data-board-id="' + id + '"]');
const sourceState = (id: string) => ['boards', 'board_documents', 'board_blobs', 'board_grants', 'pending_grants'].map(table => database.prepare(`SELECT * FROM ${table} WHERE ${table === 'boards' ? 'id' : 'board_id'}=?`).all(id));
test('@CR-01 rejected malformed root still opens in the native account editor', async ({ page }) => {
  const board = await create(page, 'Reopen canary'); const before = sourceState(board.summary.id);
  const stored = database.prepare('SELECT update_bytes FROM board_documents WHERE doc_id=?').get(board.rootDocId) as { update_bytes: Buffer };
  for (const pages of [undefined, [], [{ id: board.contentDocId }]]) {
    const root = new Y.Doc(); Y.applyUpdate(root, stored.update_bytes);
    if (pages) root.getMap('meta').set('pages', Y.Array.from(pages)); else root.getMap('meta').delete('pages');
    const response = await page.request.post(`${origin}/api/boards/${board.summary.id}/docs/${board.rootDocId}/push`, { headers: { ...headers(), 'Content-Type': 'application/octet-stream' }, data: Buffer.from(Y.encodeStateAsUpdate(root)) });
    expect(response.status()).toBe(400); expect(sourceState(board.summary.id)).toEqual(before); root.destroy();
  }
  await page.goto(origin + '/?board=' + board.summary.id); await expect(page.locator('affine-edgeless-root')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Rename board:/ })).toHaveText('Reopen canary');
  expect(sourceState(board.summary.id)).toEqual(before);
});
for (const sourceRole of ['owner', 'editor']) test(`@CR-02 @CR-07 ${sourceRole} editable download restores a private copy through the file picker`, async ({ page }) => {
  const board = await create(page, 'Archive canary'); await page.goto(origin + '/?board=' + board.summary.id);
  await expect(page.locator('affine-edgeless-root')).toBeVisible();
  await page.getByRole('button', { name: 'Add mind map', exact: true }).click(); await page.keyboard.type('Archive topic'); await page.keyboard.press('Escape');
  await page.locator('affine-edgeless-root').evaluate(el => { const surface = (el as HTMLElement & { gfx: GfxController }).gfx.surface!; const map = surface.elementModels.find(model => model.type === 'mindmap') as MindmapElementModel; map.addNode(map.tree.id, undefined, 'after', { text: 'Archive child' }); });
  const image = syntheticCanaries().imageBytes;
  await page.locator('input[type=file][accept="image/*"]').setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: image });
  await expect.poll(async () => {
    const response = await page.request.get(`${origin}/api/boards/${board.summary.id}/editable-export`, { headers: { 'X-Dali-Account': accountId } });
    return response.ok() ? (await response.json()).manifest.length : 0;
  }).toBe(1);
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  if (sourceRole === 'editor') {
    await page.context().clearCookies(); await page.goto(origin + '/auth/start'); await page.getByRole('link', { name: 'Synthetic Editor', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
    accountId = (await (await page.request.get(origin + '/api/session')).json()).accountId;
    database.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?)').run(board.summary.id, accountId, 'editor');
    await page.goto(origin + '/?board=' + board.summary.id); await expect(page.locator('affine-edgeless-root')).toBeVisible();
  }
  const native = () => page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx; const map = gfx.surface!.elementModels.find(model => model.type === 'mindmap') as MindmapElementModel;
    const text = (id?: string) => id ? (gfx.surface!.getElementById(id) as ShapeElementModel).text?.toString() : null;
    return { ids: gfx.surface!.elementModels.map(model => model.id), hierarchy: [...map.children].map(([id, detail]) => ({ ...detail, parent: text(detail.parent), text: text(id) })).sort((a, b) => a.text!.localeCompare(b.text!)) };
  });
  const originalNative = await native();
  await fileAction(page, 'Export board'); const pending = page.waitForEvent('download'); await page.getByRole('dialog', { name: 'Export board', exact: true }).getByRole('button', { name: 'Download', exact: true }).click();
  const download = await pending; const chunks: Buffer[] = []; for await (const chunk of (await download.createReadStream())!) chunks.push(Buffer.from(chunk));
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  const before = sourceState(board.summary.id);
  const archiveBytes = Buffer.concat(chunks); const missing = unzipSync(archiveBytes); for (const key of Object.keys(missing)) if (key.startsWith('assets/')) delete missing[key];
  const badPicker = page.waitForEvent('filechooser'); await fileAction(page, 'Import board'); await (await badPicker).setFiles({ name: 'missing.bs.zip', mimeType: 'application/zip', buffer: Buffer.from(zipSync(missing)) });
  await page.getByRole('button', { name: 'Import private copy', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Import board', exact: true }).getByRole('alert')).toContainText('image');
  expect(database.prepare('SELECT count(*) AS n FROM boards').get()).toEqual({ n: 1 }); expect(sourceState(board.summary.id)).toEqual(before);
  await page.getByRole('button', { name: 'Close import', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Main Menu', exact: true })).toBeFocused();
  const picker = page.waitForEvent('filechooser'); await fileAction(page, 'Import board');
  await (await picker).setFiles({ name: download.suggestedFilename(), mimeType: 'application/zip', buffer: archiveBytes });
  await expect(page.getByRole('button', { name: 'Import private copy', exact: true })).toBeVisible();
  await page.route('**/api/imports/*/blobs/*', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.getByRole('button', { name: 'Import private copy', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Import board', exact: true }).getByRole('alert')).toContainText('Try again');
  expect(database.prepare('SELECT count(*) AS n FROM boards').get()).toEqual({ n: 1 }); expect(sourceState(board.summary.id)).toEqual(before);
  await page.unroute('**/api/imports/*/blobs/*'); await page.getByRole('button', { name: 'Import private copy', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Open imported board', exact: true })).toBeVisible();
  expect((await page.getByRole('link', { name: 'Open imported board', exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(sourceState(board.summary.id)).toEqual(before);
  const rows = database.prepare('SELECT * FROM boards WHERE id<>?').all(board.summary.id) as { id: string; owner_id: string; content_doc_id: string }[];
  expect(rows).toHaveLength(1); expect(rows[0]!.owner_id).toBe(accountId); expect(rows[0]!.content_doc_id).not.toBe(board.contentDocId);
  expect((database.prepare('SELECT bytes FROM board_blobs WHERE board_id=?').get(rows[0]!.id) as { bytes: Buffer }).bytes).toEqual(image);
  await page.getByRole('link', { name: 'Open imported board', exact: true }).click(); await page.waitForURL('**/?board=' + rows[0]!.id); await expect(page.locator('affine-edgeless-root')).toBeVisible();
  expect(await page.locator('editor-host').evaluate(el => JSON.stringify((el as EditorHost).store.spaceDoc.toJSON()))).toContain('Archive topic');
  const copiedNative = await native(); expect(copiedNative.hierarchy).toEqual(originalNative.hierarchy); expect(copiedNative.ids.every(id => !originalNative.ids.includes(id))).toBe(true);
  expect(sourceState(board.summary.id)).toEqual(before);
});
for (const failure of ['failed', 'held']) test(`@CR-03 active duplicate preserves visible pending edits with ${failure} pushes`, async ({ page }) => {
  const board = await create(page, 'Pending source'); await page.goto(origin + '/?board=' + board.summary.id); await expect(page.locator('affine-edgeless-root')).toBeVisible();
  await page.getByRole('button', { name: 'Add mind map', exact: true }).click(); await page.keyboard.type('Acknowledged A'); await page.keyboard.press('Escape'); await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  const acknowledged = sourceState(board.summary.id); let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; }); let pushes = 0;
  const pattern = '**/api/boards/' + board.summary.id + '/docs/*/push';
  await page.route(pattern, async route => { pushes++; if (failure === 'held') { await gate; return route.continue(); } return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }); });
  await page.locator('affine-edgeless-root').evaluate(el => { const gfx = (el as HTMLElement & { gfx: GfxController }).gfx; const map = gfx.surface!.elementModels.find(model => model.type === 'mindmap') as MindmapElementModel; map.addNode(map.tree.id, undefined, 'after', { text: 'Visible pending B' }); gfx.doc.captureSync(); });
  const texts = () => page.locator('affine-edgeless-root').evaluate(el => (el as HTMLElement & { gfx: GfxController }).gfx.surface!.elementModels.filter(model => model.type === 'shape').map(model => (model as ShapeElementModel).text?.toString()).sort());
  const visible = await texts(); expect(visible).toEqual(['Acknowledged A', 'Visible pending B']);
  await expect.poll(() => pushes).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Main Menu', exact: true }).click(); await page.getByRole('menuitem', { name: 'File', exact: true }).click(); await page.getByRole('menuitem', { name: 'Duplicate board', exact: true }).click();
  await page.getByRole('dialog', { name: 'Duplicate board', exact: true }).getByRole('button', { name: 'Duplicate board', exact: true }).click();
  if (failure === 'failed') {
    await expect(page.getByRole('dialog', { name: 'Duplicate board', exact: true }).getByRole('alert')).toContainText('pending changes');
    expect(new URL(page.url()).searchParams.get('board')).toBe(board.summary.id); expect(await texts()).toEqual(visible); expect(sourceState(board.summary.id)).toEqual(acknowledged);
    expect(database.prepare('SELECT count(*) AS n FROM boards').get()).toEqual({ n: 1 });
    await page.unroute(pattern); await page.getByRole('dialog', { name: 'Duplicate board', exact: true }).getByRole('button', { name: 'Duplicate board', exact: true }).click();
  } else { await expect(page.getByRole('dialog', { name: 'Duplicate board', exact: true })).toContainText('Copying board'); expect(database.prepare('SELECT count(*) AS n FROM boards').get()).toEqual({ n: 1 }); release(); }
  await expect(page.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
  const copy = database.prepare('SELECT id FROM boards WHERE id<>?').get(board.summary.id) as { id: string }; expect(copy).toBeTruthy();
  await card(page, copy.id).getByRole('link').click(); await page.waitForURL('**/?board=' + copy.id); await expect(page.locator('affine-edgeless-root')).toBeVisible(); expect(await texts()).toEqual(visible);
  await page.goto(origin + '/?board=' + board.summary.id); await expect(page.locator('affine-edgeless-root')).toBeVisible(); expect(await texts()).toEqual(visible);
});
for (const changed of ['role', 'account']) test(`@CR-02 archive import rejects stale ${changed} before publication`, async ({ page }) => {
  const board = await create(page, 'Archive access canary'); await page.goto(origin + '/?board=' + board.summary.id); await expect(page.locator('affine-edgeless-root')).toBeVisible();
  await fileAction(page, 'Export board'); const pending = page.waitForEvent('download'); await page.getByRole('dialog', { name: 'Export board', exact: true }).getByRole('button', { name: 'Download', exact: true }).click();
  const chunks: Buffer[] = []; for await (const chunk of (await (await pending).createReadStream())!) chunks.push(Buffer.from(chunk));
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  const picker = page.waitForEvent('filechooser'); await fileAction(page, 'Import board'); await (await picker).setFiles({ name: 'access.bs.zip', mimeType: 'application/zip', buffer: Buffer.concat(chunks) });
  if (changed === 'role') {
    database.prepare('INSERT INTO members(id,issuer,subject,email,canonical_email,display_name) VALUES(?,?,?,?,?,?)').run('synthetic-next-owner', provider.issuer, 'next-owner', 'next@example.org', 'next@example.org', 'Next Owner');
    database.prepare('UPDATE boards SET owner_id=? WHERE id=?').run('synthetic-next-owner', board.summary.id);
    database.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?)').run(board.summary.id, accountId, 'viewer');
  } else {
    let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; }); let entered = false;
    await page.route('**/api/boards/' + board.summary.id, async route => { const response = await route.fetch(); entered = true; await gate; await route.fulfill({ response }); });
    await page.getByRole('button', { name: 'Import private copy', exact: true }).click(); await expect.poll(() => entered).toBe(true);
    const second = await page.context().newPage(); await page.context().clearCookies(); await second.goto(origin + '/auth/start');
    await second.getByRole('link', { name: 'Synthetic Editor', exact: true }).click(); await expect(second.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible(); release(); await second.close();
  }
  const before = sourceState(board.summary.id);
  if (changed === 'role') { await page.getByRole('button', { name: 'Import private copy', exact: true }).click(); await expect(page.getByRole('dialog', { name: 'Import board', exact: true }).getByRole('alert')).toContainText('access changed'); }
  else await expect(page.locator('affine-edgeless-root')).toHaveCount(0);
  expect(database.prepare('SELECT count(*) AS n FROM boards').get()).toEqual({ n: 1 });
  expect(database.prepare('SELECT count(*) AS n FROM import_staging').get()).toEqual({ n: 0 }); expect(sourceState(board.summary.id)).toEqual(before);
});
test('@CR-05 acknowledged rename follows authoritative recent order including ties', async ({ page }) => {
  const first = await create(page, 'Older board'); const second = await create(page, 'Newer board');
  database.prepare('UPDATE boards SET updated_at=1 WHERE id=?').run(first.summary.id); database.prepare('UPDATE boards SET updated_at=2 WHERE id=?').run(second.summary.id); await page.reload();
  const ids = () => page.locator('[data-board-id]').evaluateAll(rows => rows.map(row => row.getAttribute('data-board-id')));
  await expect.poll(ids).toEqual([second.summary.id, first.summary.id]);
  const rename = async (id: string, name: string) => { await boardAction(card(page, id), 'Rename board'); const dialog = page.getByRole('dialog', { name: 'Rename board', exact: true }); await dialog.getByRole('textbox').fill(name); await dialog.getByRole('button', { name: 'Save name', exact: true }).click(); await expect(dialog).not.toBeVisible(); };
  await rename(first.summary.id, 'Newest board'); await expect.poll(ids).toEqual([first.summary.id, second.summary.id]);
  await page.route('**/api/boards/' + second.summary.id, async route => { if (route.request().method() !== 'PATCH') return route.continue(); const response = await route.fetch(); const value = await response.json(); database.prepare('UPDATE boards SET updated_at=? WHERE id=?').run(value.summary.updatedAt, first.summary.id); await route.fulfill({ response }); });
  await rename(second.summary.id, 'Tied board');
  const authoritative = await (await page.request.get(origin + '/api/boards?filter=all', { headers: headers() })).json();
  expect(authoritative[0].updatedAt).toBe(authoritative[1].updatedAt); await expect.poll(ids).toEqual(authoritative.map((row: { id: string }) => row.id));
});
test('@CR-05 duplicate retains Shared with me membership without the private owner copy', async ({ page }) => {
  const board = await create(page, 'Shared source');
  database.prepare('INSERT INTO members(id,issuer,subject,email,canonical_email,display_name) VALUES(?,?,?,?,?,?)').run('synthetic-source-owner', provider.issuer, 'source-owner', 'source@example.org', 'source@example.org', 'Source Owner');
  database.prepare('UPDATE boards SET owner_id=? WHERE id=?').run('synthetic-source-owner', board.summary.id); database.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?)').run(board.summary.id, accountId, 'editor');
  await page.reload(); await page.getByRole('button', { name: 'Shared with me', exact: true }).click(); await expect(card(page, board.summary.id)).toBeVisible();
  await boardAction(card(page, board.summary.id), 'Duplicate board'); await page.getByRole('dialog').getByRole('button', { name: 'Duplicate board', exact: true }).click(); await expect(page.getByText('Private copy created.', { exact: true })).toBeVisible();
  const authoritative = await (await page.request.get(origin + '/api/boards?filter=shared', { headers: headers() })).json();
  await expect(page.getByRole('button', { name: 'Shared with me', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.locator('[data-board-id]').evaluateAll(rows => rows.map(row => row.getAttribute('data-board-id')))).toEqual(authoritative.map((row: { id: string }) => row.id));
  expect(database.prepare('SELECT count(*) AS n FROM boards').get()).toEqual({ n: 2 });
});
test('@03-08-01 Unicode rename blank bounds acknowledgment and named safe-focus deletion', async ({ page }) => {
  const board = await create(page); await page.reload();
  const open = async () => { await boardAction(card(page, board.summary.id), 'Rename board'); return page.getByRole('dialog', { name: 'Rename board' }); };
  let dialog = await open(); const title = '👩🏽‍💻'.repeat(200);
  await dialog.getByRole('textbox').fill(title + '界'); await dialog.getByRole('button', { name: 'Save name' }).click();
  await expect(dialog.getByRole('alert')).toContainText('200'); await expect(dialog.getByRole('textbox')).toHaveValue(title + '界');
  await expect(dialog.getByRole('textbox')).toHaveAttribute('aria-describedby', 'board-action-error');
  await dialog.getByRole('textbox').fill(title); await dialog.getByRole('button', { name: 'Save name' }).click(); await expect(dialog).not.toBeVisible();
  await expect(card(page, board.summary.id).getByRole('link', { name: 'Open ' + title, exact: true })).toBeVisible();
  dialog = await open(); await dialog.getByRole('textbox').fill('   '); await dialog.getByRole('button', { name: 'Save name' }).click(); await expect(dialog).not.toBeVisible();
  expect((await (await page.request.get(origin + '/api/boards/' + board.summary.id, { headers: headers() })).json()).summary.title).toBe(title);
  await boardAction(card(page, board.summary.id), 'Delete board'); dialog = page.getByRole('dialog', { name: 'Delete board' });
  await expect(dialog).toContainText(title); await expect(dialog.getByRole('button', { name: 'Keep board' })).toBeFocused();
  await expect(dialog).toContainText(`Delete “${title}”? This removes the board and its access grants for everyone. This cannot be undone.`);
  await expect(dialog.getByRole('button', { name: 'Delete board', exact: true })).toHaveCSS('color', 'rgb(178, 59, 50)');
  await dialog.getByRole('button', { name: 'Keep board' }).click(); await expect(card(page, board.summary.id).locator('.board-card__actions summary')).toBeFocused();
  await boardAction(card(page, board.summary.id), 'Delete board'); await dialog.getByRole('button', { name: 'Delete board', exact: true }).click();
  await expect(card(page, board.summary.id)).toHaveCount(0); await expect(page.getByRole('button', { name: 'New board', exact: true })).toBeFocused();
  expect(sourceState(board.summary.id)).toEqual([[], [], [], [], []]);
});
test('@03-08-01 visible role controls and crafted denials preserve canary content', async ({ page }) => {
  const board = await create(page, 'Role canary'); const id = board.summary.id;
  database.prepare('INSERT INTO members(id,issuer,subject,email,canonical_email,display_name) VALUES(?,?,?,?,?,?)').run('synthetic-other', provider.issuer, 'other', 'other@example.org', 'other@example.org', 'Synthetic Other');
  database.prepare('UPDATE boards SET owner_id=? WHERE id=?').run('synthetic-other', id);
  for (const role of ['viewer', 'editor']) {
    database.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?) ON CONFLICT(board_id,member_id) DO UPDATE SET role=excluded.role').run(id, accountId, role);
    await page.reload(); if (role === 'editor') await openBoardActions(card(page, id)); await expect(card(page, id).getByRole('button', { name: 'Delete board' })).toHaveCount(0); await expect(card(page, id).getByRole('button', { name: 'Share board' })).toHaveCount(0);
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
  await boardAction(card(page, board.summary.id), 'Rename board'); const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox').fill('Acknowledged canary'); let writes = 0;
  await page.route('**/api/boards/' + board.summary.id, async route => { if (route.request().method() !== 'PATCH') return route.continue(); writes++; await route.fetch(); await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }); });
  await dialog.getByRole('button', { name: 'Save name' }).click(); await expect(dialog).not.toBeVisible(); expect(writes).toBe(1);
  await expect(card(page, board.summary.id).getByRole('link', { name: 'Open Acknowledged canary', exact: true })).toBeVisible();
  expect(database.prepare("SELECT count(*) AS n FROM operations WHERE kind='rename'").get()).toEqual({ n: 1 });
  await page.unroute('**/api/boards/' + board.summary.id); const before = sourceState(board.summary.id);
  await boardAction(card(page, board.summary.id), 'Rename board'); await dialog.getByRole('textbox').fill('Draft retained');
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
  await boardAction(card(page, board.summary.id), 'Duplicate board');
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
test('@03-08-02 inline naming is acknowledged composition-safe and responsive with account role and sharing', async ({ page }) => {
  const board = await create(page, 'Inline source'); await page.goto(origin + '/?board=' + board.summary.id);
  await expect(page.locator('affine-edgeless-root')).toBeVisible(); const input = await editBoardTitle(page);
  await expect(input).toBeVisible();
  await input.fill('Uncommitted'); expect((database.prepare('SELECT title FROM boards WHERE id=?').get(board.summary.id) as { title: string }).title).toBe('Inline source');
  await input.press('Escape'); await expect(page.locator('.board-title-label')).toHaveText('Inline source'); await editBoardTitle(page);
  await input.fill('Composition'); await input.dispatchEvent('compositionstart'); await input.dispatchEvent('keydown', { key: 'Enter', isComposing: true }); await input.dispatchEvent('blur');
  expect(database.prepare('SELECT title FROM boards WHERE id=?').get(board.summary.id)).toEqual({ title: 'Inline source' });
  await input.dispatchEvent('compositionend'); await input.focus(); await input.press('Escape'); await editBoardTitle(page);
  const title = '👩🏽‍💻'.repeat(200); await input.fill('  ' + title + '  '); await input.press('Enter'); await expect(page.locator('.board-title-label')).toHaveText(title);
  await expect.poll(() => database.prepare('SELECT title FROM boards WHERE id=?').get(board.summary.id)).toEqual({ title });
  await editBoardTitle(page); await input.fill(' '); await input.press('Tab'); await expect(page.locator('.board-title-label')).toHaveText(title);
  await page.setViewportSize({ width: 490, height: 800 });
  await editBoardTitle(page); await expect(input).toBeFocused();
  // Collapse the initially selected name to its end; End only scrolls on macOS Firefox.
  await input.press('ArrowRight');
  expect(await input.evaluate(el => { const field = el as HTMLInputElement; return { caret: field.selectionStart, length: field.value.length, scroll: field.scrollLeft > 0 }; })).toEqual({ caret: title.length, length: title.length, scroll: true });
  await expect(page.getByText('Owner', { exact: true })).toBeVisible(); await page.getByRole('button', { name: 'Share board', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Share board' })).toBeVisible(); await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Share board', exact: true })).toBeFocused();
  await page.locator('.board-account summary').click(); await expect(page.getByRole('button', { name: 'Sign out of Dalí', exact: true })).toBeVisible();
  expect(await page.locator('.djai-header').evaluate(el => { const bounds = el.getBoundingClientRect(); return [...el.querySelectorAll('button, summary, input')].filter(node => (node as HTMLElement).offsetParent).every(node => { const rect = node.getBoundingClientRect(); return rect.x >= 0 && rect.right <= innerWidth && rect.height >= 44 && rect.y >= bounds.y; }); })).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('@03-08-02 long library rename labels and errors wrap within 490px without losing draft', async ({ page }) => {
  const title = '👩🏽‍💻'.repeat(200); const board = await create(page, title); await page.setViewportSize({ width: 490, height: 800 }); await page.reload();
  await boardAction(card(page, board.summary.id), 'Rename board'); const dialog = page.getByRole('dialog', { name: 'Rename board' });
  await dialog.getByRole('textbox').fill(title + '界'); await dialog.getByRole('button', { name: 'Save name' }).click(); await expect(dialog.getByRole('alert')).toContainText('200'); await expect(dialog.getByRole('textbox')).toHaveValue(title + '界');
  expect(await dialog.evaluate(el => { const r = el.getBoundingClientRect(); return r.x >= 0 && r.right <= innerWidth && el.scrollWidth <= el.clientWidth; })).toBe(true);
  await dialog.getByRole('button', { name: 'Keep name' }).click(); await expect(card(page, board.summary.id).locator('.board-card__actions summary')).toBeFocused();
  expect(database.prepare('SELECT title FROM boards WHERE id=?').get(board.summary.id)).toEqual({ title });
});
test('@03-08-02 inline loading guards repeated commits and uncertain failure retains a correctable draft', async ({ page }) => {
  const board = await create(page); await page.goto(origin + '/?board=' + board.summary.id); const input = await editBoardTitle(page); await expect(input).toBeVisible();
  let release!: () => void; const wait = new Promise<void>(resolve => { release = resolve; }); let writes = 0;
  await page.route('**/api/boards/' + board.summary.id, async route => { if (route.request().method() !== 'PATCH') return route.continue(); writes++; await wait; await route.continue(); });
  await input.fill('Pending name'); await input.press('Enter'); await expect(page.getByRole('status', { name: '' }).filter({ hasText: 'Saving name' })).toBeVisible(); await expect(input).toBeDisabled();
  expect(database.prepare('SELECT title FROM boards WHERE id=?').get(board.summary.id)).toEqual({ title: 'Synthetic actions' }); release(); await expect(page.locator('.board-title-label')).toHaveText('Pending name'); await editBoardTitle(page); expect(writes).toBe(1);
  await page.unroute('**/api/boards/' + board.summary.id);
  await input.fill('Failed draft'); await page.route('**/api/boards/' + board.summary.id, route => route.request().method() === 'PATCH' ? route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }) : route.continue());
  await input.press('Enter'); await expect(page.getByRole('button', { name: 'Check again' })).toBeVisible(); await expect(input).toHaveValue('Failed draft');
  expect(database.prepare('SELECT title FROM boards WHERE id=?').get(board.summary.id)).toEqual({ title: 'Pending name' }); await page.getByRole('button', { name: 'Check again' }).click(); await expect(input).toBeEnabled();
  await page.unroute('**/api/boards/' + board.summary.id); await input.fill('Corrected draft'); await input.press('Tab');
  await expect.poll(() => database.prepare('SELECT title FROM boards WHERE id=?').get(board.summary.id)).toEqual({ title: 'Corrected draft' });
  await expect(page.getByRole('button', { name: 'Share board', exact: true })).toBeFocused();
  await editBoardTitle(page); await input.fill('界'.repeat(201)); await input.press('Enter'); await expect(input).toHaveValue('界'.repeat(201)); await expect(page.getByRole('alert')).toContainText('200');
  await expect(input).toHaveAttribute('aria-describedby', 'board-title-error');
  await input.fill(' '); await input.press('Enter');
  await expect(page.locator('.board-title-label')).toHaveText('Corrected draft'); await expect(page.locator('#board-title-error')).toHaveCount(0);
});
test('@03-08-02 Viewer readable title account controls and Main Menu preserve role restrictions at 490px', async ({ page }) => {
  const title = '長い名前👩🏽‍💻'.repeat(30); const board = await create(page, title);
  database.prepare('INSERT INTO members(id,issuer,subject,email,canonical_email,display_name) VALUES(?,?,?,?,?,?)').run('synthetic-other', provider.issuer, 'other', 'other@example.org', 'other@example.org', 'Synthetic Other');
  database.prepare('UPDATE boards SET owner_id=? WHERE id=?').run('synthetic-other', board.summary.id);
  database.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?)').run(board.summary.id, accountId, 'viewer');
  await page.setViewportSize({ width: 490, height: 800 }); await page.goto(origin + '/?board=' + board.summary.id);
  await expect(page.locator('affine-edgeless-root')).toBeVisible(); await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: title, exact: true })).toHaveCSS('font-weight', '600');
  await expect(page.getByRole('textbox', { name: 'Board name' })).toHaveCount(0); await expect(page.getByText('Viewer · View only', { exact: true })).toBeVisible(); await expect(page.getByRole('button', { name: 'Share board' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Main Menu', exact: true }).click(); await page.getByRole('menuitem', { name: 'File', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'New', exact: true })).toBeVisible(); await expect(page.getByRole('menuitem', { name: 'Duplicate board' })).toHaveCount(0); await expect(page.getByRole('menuitem', { name: 'Delete board' })).toHaveCount(0);
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await page.locator('.board-account summary').click(); await expect(page.getByRole('button', { name: 'Sign out of Dalí' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
