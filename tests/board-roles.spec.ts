import { randomBytes, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Page } from '@playwright/test';
import type { EditorHost } from '@blocksuite/affine/std';
import type { GfxController } from '@blocksuite/affine/std/gfx';
import type { MindmapElementModel } from '@blocksuite/affine/model';
import { test, expect } from './fixtures';
import { createOidcProvider } from './oidc-provider';
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
const sourceState = (id: string) => ['boards', 'board_documents', 'board_blobs', 'board_grants', 'pending_grants'].map(table => database.prepare(`SELECT * FROM ${table} WHERE ${table === 'boards' ? 'id' : 'board_id'}=?`).all(id));
async function localState(page: Page) {
  return page.locator('editor-host').evaluate(el => {
    const doc = (el as EditorHost).store.spaceDoc;
    return { model: JSON.stringify(doc.toJSON()), vector: [...doc.store.clients].map(([id, structs]) => [id, structs.at(-1)!.id.clock + structs.at(-1)!.length]) };
  });
}
async function role(page: Page, id: string, value: 'viewer' | 'editor') {
  database.prepare('INSERT OR IGNORE INTO members(id,issuer,subject,email,canonical_email,display_name) VALUES(?,?,?,?,?,?)').run('synthetic-other', provider.issuer, 'other', 'other@example.org', 'other@example.org', 'Synthetic Other');
  database.prepare('UPDATE boards SET owner_id=? WHERE id=?').run('synthetic-other', id);
  database.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?) ON CONFLICT(board_id,member_id) DO UPDATE SET role=excluded.role').run(id, accountId, value);
  await page.reload(); await expect(page.locator('affine-edgeless-root')).toBeVisible();
}
test('@03-09-01 Viewer native keyboard clipboard drop and history preserve model and server while navigation works', async ({ page, context }) => {
  const board = await create(page); await page.goto(origin + '/?board=' + board.summary.id);
  await page.getByRole('button', { name: 'Add mind map', exact: true }).click(); await page.keyboard.type('Role map canary'); await page.keyboard.press('Enter');
  await page.keyboard.press('Tab'); await page.keyboard.type('Child canary'); await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  await role(page, board.summary.id, 'viewer');
  await expect(page.getByRole('button', { name: 'Add sticky note', exact: true })).toHaveCount(0);
  const before = await localState(page); const server = sourceState(board.summary.id);
  await page.locator('affine-edgeless-root').evaluate(el => { const gfx = (el as HTMLElement & { gfx: GfxController }).gfx; const map = gfx.surface!.elementModels.find(el => el.type === 'mindmap') as MindmapElementModel; gfx.selection.set({ elements: [map.tree.id], editing: false }); });
  for (const key of ['Tab', 'Enter', 'Delete', 'Backspace', 'ControlOrMeta+d', 'ControlOrMeta+z', 'ControlOrMeta+Shift+z', 'ControlOrMeta+b']) {
    await page.keyboard.press(key); expect(await localState(page), key).toEqual(before); expect(sourceState(board.summary.id), key).toEqual(server);
  }
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.evaluate(() => navigator.clipboard.writeText('Native clipboard canary'));
  await page.mouse.click(600, 400); await page.keyboard.press('ControlOrMeta+v');
  await page.locator('editor-host').evaluate(el => { const data = new DataTransfer(); data.setData('text/plain', 'Constructed drop canary'); el.dispatchEvent(new DragEvent('drop', { dataTransfer: data, bubbles: true, cancelable: true })); el.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertCompositionText', data: 'Composition canary', bubbles: true, cancelable: true })); });
  await page.evaluate(() => { for (const detail of ['undo', 'redo']) window.dispatchEvent(new CustomEvent('dali:board-command', { detail })); });
  expect(await localState(page)).toEqual(before); expect(sourceState(board.summary.id)).toEqual(server);
  const zoom = await page.locator('affine-edgeless-root').evaluate(el => (el as HTMLElement & { gfx: GfxController }).gfx.viewport.zoom);
  await page.mouse.move(600, 400); await page.mouse.wheel(0, -150);
  await expect.poll(() => page.locator('affine-edgeless-root').evaluate(el => (el as HTMLElement & { gfx: GfxController }).gfx.viewport.zoom)).not.toBe(zoom);
  expect(await localState(page)).toEqual(before); expect(sourceState(board.summary.id)).toEqual(server);
});
