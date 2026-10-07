import { unzipSync } from 'fflate';
import { prepareRichRecoverySeed, richRecoveryCanvas, recoveryAssetHashes } from './collaboration-fork-native';
import type { EditorHost } from '@blocksuite/affine/std';
import { randomUUID, createHash } from 'node:crypto';
import type { Browser, Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { acceptanceService, createIdentityContexts, syntheticCanaries } from './access-fixtures';
import { seedCollaborationShapes, moveLocalShape, moveNativeShape, shapeBounds } from './collaboration-fixtures';
import { journalRows, failRecoveryStorage, restoreRecoveryStorage } from './recovery-fixtures';
import { readRecoveryEpoch } from '../server/storage/recovery-state';
import type { GfxController } from '@blocksuite/affine/std/gfx';

async function fixture(browser: Browser, baseURL: string) {
  const service = await acceptanceService(baseURL); let identities: Awaited<ReturnType<typeof createIdentityContexts>> | undefined;
  try {
    identities = await createIdentityContexts(browser, service.origin);
    const ownerContext = identities.contexts.owner; const editorContext = identities.contexts.editor;
    const owner = ownerContext.pages()[0]!; const editor = editorContext.pages()[0]!;
    const account = (await (await ownerContext.request.get('/api/session')).json()).accountId as string;
    const editorAccount = (await (await editorContext.request.get('/api/session')).json()).accountId as string;
    const created = await ownerContext.request.post('/api/boards', {
      headers: { Origin: service.origin, 'X-Dali-Request': '1', 'X-Dali-Account': account, 'X-Dali-Recovery-Epoch': readRecoveryEpoch(service.database) },
      data: { operationId: randomUUID(), title: 'Synthetic recovery fork' },
    });
    expect(created.status()).toBe(201); const board = (await created.json()).summary.id as string;
    service.database.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?)').run(board, editorAccount, 'editor');
    const [first, second] = await seedCollaborationShapes(owner, service.database, board);
    const actors = identities;
    return { service, identities: actors, ownerContext, owner, editor, account, board, first: first!, second: second!,
      async close(failure?: unknown) { try { await actors.close(); } catch (error) { if (!failure) throw error; } finally { await service.close(); } } };
  } catch (error) { await identities?.close().catch(() => {}); await service.close(); throw error; }
}

async function holdPoll(page: Page) {
  let interrupt!: () => void; const held = new Promise<void>(resolve => { interrupt = resolve; });
  await page.route('**/live/poll', async route => { await held; await route.fulfill({ status: 200, contentType: 'application/json', body: '{' }); });
  return interrupt;
}
async function openBoard(pages: Page[], board: string) {
  for (const page of pages) {
    await page.goto(`/?board=${board}`); await expect(page.locator('affine-edgeless-root')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
  }
}

async function imageHashes(page: Page) {
  return page.locator('editor-host').evaluate(async element => {
    const store = (element as EditorHost).store;
    return Promise.all(store.getBlocksByFlavour('affine:image').map(async ({ model }) => {
      const key = (model.props as { sourceId: string }).sourceId; const blob = await store.blobSync.get(key);
      if (!blob) throw new Error('Synthetic local image missing');
      return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())), byte => byte.toString(16).padStart(2, '0')).join('');
    }));
  });
}
async function shapes(page: Page) {
  return page.locator('affine-edgeless-root').evaluate(element => (element as HTMLElement & { gfx: GfxController }).gfx.surface!.elementModels.filter(model => model.type === 'shape').map(model => ({ id: model.id, xywh: model.xywh })).sort((a, b) => a.xywh.localeCompare(b.xywh)));
}
for (const receipt of ['acknowledged', 'lost-response', 'lost-response-after-reload'] as const) test(`@05-06-01 ${receipt} creates a private local canvas and image copy without changing the shared source`, async ({ browser, baseURL, browserName }) => {
  const f = await fixture(browser, baseURL!); const local = f.editor; const peer = f.owner;
  const interrupt = await holdPoll(local); let release = () => {}; let failure: unknown;
  try {
    await openBoard([local, peer], f.board); interrupt();
    await expect(local.getByRole('button', { name: 'Reconnect', exact: true })).toBeVisible();
    await moveLocalShape(local, f.first, 70);
    const bytes = syntheticCanaries().imageBytes; const hashes = [createHash('sha256').update(bytes).digest('hex')];
    await local.locator('input[type=file][accept="image/*"]').setInputFiles({ name: 'synthetic-local.png', mimeType: 'image/png', buffer: bytes });
    await expect.poll(() => imageHashes(local)).toEqual(hashes);
    await expect.poll(async () => (await journalRows(local)).length).toBeGreaterThan(0); const retained = await journalRows(local); const localShapes = await shapes(local);
    const changed = peer.waitForResponse(response => response.url().endsWith('/live/release') && response.ok());
    await moveNativeShape(peer, f.second, 45); await changed;
    await local.unroute('**/live/poll'); await local.getByRole('button', { name: 'Reconnect', exact: true }).click();
    const choice = local.getByRole('dialog', { name: 'This board changed while you were away', exact: true }); await expect(choice).toBeVisible();
    const sharedBytes = f.service.database.prepare('SELECT doc_id,update_bytes FROM board_documents WHERE board_id=? ORDER BY doc_id').all(f.board);
    const sourceWrites: string[] = []; local.on('request', req => { if (req.url().includes(`/api/boards/${f.board}/`) && /\/(push|blobs)\b/.test(req.url()) && ['POST', 'PUT'].includes(req.method())) sourceWrites.push(req.url()); });
    let entered!: () => void; const waiting = new Promise<void>(resolve => { entered = resolve; }); const held = new Promise<void>(resolve => { release = resolve; });
    const commits: string[] = []; let committed = false;
    if (receipt === 'lost-response-after-reload') await local.route('**/api/operations/*', route => committed ? route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }) : route.continue());
    await local.route('**/api/imports/*/commit', async route => { commits.push(route.request().url()); entered(); await held; const response = await route.fetch(); expect(response.status()).toBe(200); committed = true; await route.fulfill(receipt !== 'acknowledged' ? { response, body: '{' } : { response }); });
    const create = choice.getByRole('button', { name: 'Create private copy', exact: true });
    await expect(create).toBeEnabled(); await create.click(); await waiting;
    await expect(choice.getByRole('status')).toContainText('Creating private copy'); await expect(create).toBeDisabled();
    await create.evaluate(button => (button as HTMLButtonElement).click());
    expect(await journalRows(local)).toEqual(expect.arrayContaining(retained));
    expect(f.service.database.prepare('SELECT id FROM boards').all()).toHaveLength(1);
    release();
    if (receipt === 'lost-response-after-reload') {
      await expect(choice.getByRole('alert')).toContainText('Your local work is still here');
      expect(await journalRows(local)).toEqual(expect.arrayContaining(retained));
      expect(f.service.database.prepare('SELECT id FROM boards').all()).toHaveLength(2);
      await local.reload(); await expect(choice).toBeVisible();
      await local.unroute('**/api/operations/*'); await choice.getByRole('button', { name: 'Create private copy', exact: true }).click();
    }
    await expect(local.getByRole('status').filter({ hasText: 'Private copy created' })).toBeVisible();
    await expect(local.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
    const copied = new URL(local.url()).searchParams.get('board')!; expect(copied).not.toBe(f.board);
    const copiedShapes = await shapes(local); expect(copiedShapes.map(s => s.xywh)).toEqual(localShapes.map(s => s.xywh)); expect(copiedShapes.every(s => localShapes.every(before => before.id !== s.id))).toBe(true);
    expect(await imageHashes(local)).toEqual(hashes); await expect.poll(() => journalRows(local)).toEqual([]);
    const owner = (await (await f.identities.contexts.editor.request.get('/api/session')).json()).accountId;
    expect(f.service.database.prepare('SELECT owner_id,title FROM boards WHERE id=?').get(copied)).toEqual({ owner_id: owner, title: 'Synthetic recovery fork' });
    expect(f.service.database.prepare('SELECT * FROM board_grants WHERE board_id=?').all(copied)).toEqual([]);
    expect(f.service.database.prepare('SELECT * FROM pending_grants WHERE board_id=?').all(copied)).toEqual([]);
    expect(f.service.database.prepare('SELECT doc_id,update_bytes FROM board_documents WHERE board_id=? ORDER BY doc_id').all(f.board)).toEqual(sharedBytes);
    expect(await shapeBounds(peer, f.first)).toBe('[0,0,160,120]'); expect(await imageHashes(peer)).toEqual([]); expect(sourceWrites).toEqual([]); expect(commits).toHaveLength(1);
    await local.reload(); await expect(local.locator('affine-edgeless-root')).toBeVisible(); expect(await imageHashes(local)).toEqual(hashes); expect(await shapes(local)).toEqual(copiedShapes);
    expect((await f.ownerContext.request.get(`/api/boards/${copied}`, { headers: { 'X-Dali-Account': f.account } })).status()).toBe(404);
    expect(f.identities.runtimeErrors).toEqual(receipt === 'lost-response-after-reload' && browserName !== 'firefox' ? ['editor: Failed to load resource: the server responded with a status of 503 (Service Unavailable)'] : []);
    f.identities.runtimeErrors.length = 0;
  } catch (error) { failure = error; throw error; }
  finally { release(); interrupt(); await f.close(failure); }
});

test('@05-06-01 private fork retains whole local map groups connectors and original edited-image pixels', async ({ browser, baseURL }) => {
  const f = await fixture(browser, baseURL!); let interrupt = () => {}; let failure: unknown;
  try {
    f.service.database.prepare('UPDATE boards SET live_enabled=0 WHERE id=?').run(f.board);
    await f.owner.goto(`/?board=${f.board}`); await expect(f.owner.locator('affine-edgeless-root')).toBeVisible();
    await prepareRichRecoverySeed(f.owner); await f.owner.goto('/'); f.service.database.prepare('UPDATE boards SET live_enabled=1 WHERE id=?').run(f.board);
    interrupt = await holdPoll(f.editor); await openBoard([f.editor, f.owner], f.board); interrupt();
    await expect(f.editor.getByRole('button', { name: 'Reconnect', exact: true })).toBeVisible();
    await f.editor.locator('input[type=file][accept="image/*"]').setInputFiles({ name: 'Local second.png', mimeType: 'image/png', buffer: syntheticCanaries().imageBytes });
    await expect.poll(async () => (await imageHashes(f.editor)).length).toBe(2); const before = await richRecoveryCanvas(f.editor); const hashes = await recoveryAssetHashes(f.editor); expect(hashes).toHaveLength(3);
    expect(before.snapshot.edits.every(edit => edit.validImage)).toBe(true);
    const current = await f.ownerContext.request.get(`/api/boards/${f.board}`, { headers: { 'X-Dali-Account': f.account } }); expect(current.status()).toBe(200);
    const revision = (await current.json()).revision;
    const renamed = await f.ownerContext.request.patch(`/api/boards/${f.board}`, { headers: { Origin: f.service.origin, 'X-Dali-Request': '1', 'X-Dali-Account': f.account, 'X-Dali-Recovery-Epoch': readRecoveryEpoch(f.service.database) }, data: { operationId: randomUUID(), revision, title: 'Later shared title' } }); expect(renamed.status()).toBe(200);
    const source = f.service.database.prepare('SELECT doc_id,update_bytes FROM board_documents WHERE board_id=? ORDER BY doc_id').all(f.board);
    await f.editor.unroute('**/live/poll'); await f.editor.getByRole('button', { name: 'Reconnect', exact: true }).click();
    const dialog = f.editor.getByRole('dialog', { name: 'This board changed while you were away', exact: true }); await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Create private copy', exact: true }).click();
    await expect(f.editor.getByRole('status').filter({ hasText: 'Private copy created' })).toBeVisible();
    await expect(f.editor.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
    const after = await richRecoveryCanvas(f.editor); expect(after.snapshot).toEqual(before.snapshot); expect(after.ids.every(id => !before.ids.includes(id))).toBe(true); expect(await recoveryAssetHashes(f.editor)).toEqual(hashes);
    expect(f.service.database.prepare('SELECT doc_id,update_bytes FROM board_documents WHERE board_id=? ORDER BY doc_id').all(f.board)).toEqual(source);
    await f.editor.reload(); await expect(f.editor.locator('affine-edgeless-root')).toBeVisible(); expect((await richRecoveryCanvas(f.editor)).snapshot).toEqual(before.snapshot);
    expect(await recoveryAssetHashes(f.editor)).toEqual(hashes); expect(f.identities.runtimeErrors).toEqual([]);
  } catch (error) { failure = error; throw error; }
  finally { interrupt(); await f.close(failure); }
});

test('@05-06-02 latest offer cancels safely and retains the local version until the latest canvas opens', async ({ browser, baseURL }) => {
  const f = await fixture(browser, baseURL!); const local = f.editor; const interrupt = await holdPoll(local); let release = () => {}; let failure: unknown;
  try {
    await openBoard([local, f.owner], f.board); interrupt(); await expect(local.getByRole('button', { name: 'Reconnect', exact: true })).toBeVisible();
    await moveLocalShape(local, f.first, 70);
    const changed = f.owner.waitForResponse(response => response.url().endsWith('/live/release') && response.ok()); await moveNativeShape(f.owner, f.second, 45); await changed;
    await local.unroute('**/live/poll'); await local.getByRole('button', { name: 'Reconnect', exact: true }).click();
    const choice = local.getByRole('dialog', { name: 'This board changed while you were away', exact: true }); await expect(choice).toBeVisible();
    const retained = await journalRows(local); expect(retained.length).toBeGreaterThan(0);
    const source = f.service.database.prepare('SELECT doc_id,update_bytes FROM board_documents WHERE board_id=? ORDER BY doc_id').all(f.board);
    await expect(choice.getByRole('heading')).toBeFocused(); await local.keyboard.press('Escape'); await expect(choice).toHaveCount(0);
    await expect(local.getByRole('button', { name: 'Review pending changes', exact: true })).toBeFocused();
    expect(await journalRows(local)).toEqual(retained); await local.getByRole('button', { name: 'Review pending changes', exact: true }).click();
    await choice.getByRole('button', { name: 'Load latest changes', exact: true }).click();
    const offer = local.getByRole('dialog', { name: 'Download your local version?', exact: true }); await expect(offer.getByRole('heading')).toBeFocused();
    await expect(offer).toContainText('after the latest board opens successfully');
    await offer.getByRole('button', { name: 'Back to versions', exact: true }).click(); await expect(choice).toBeVisible(); expect(await journalRows(local)).toEqual(retained);
    await choice.getByRole('button', { name: 'Load latest changes', exact: true }).click();
    let entered!: () => void; const waiting = new Promise<void>(resolve => { entered = resolve; }); const held = new Promise<void>(resolve => { release = resolve; });
    await local.route('**/docs/*/pull', async route => { entered(); await held; await route.continue(); });
    await offer.getByRole('button', { name: 'Load latest without download', exact: true }).click(); await waiting;
    expect(await journalRows(local)).toEqual(retained); await expect(offer.getByRole('status')).toContainText('Loading latest');
    release(); await expect(offer).toHaveCount(0); await expect(local.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
    expect(await shapeBounds(local, f.first)).toBe('[0,0,160,120]'); expect(await shapeBounds(local, f.second)).toBe(await shapeBounds(f.owner, f.second));
    await expect.poll(() => journalRows(local)).toEqual([]);
    expect(f.service.database.prepare('SELECT doc_id,update_bytes FROM board_documents WHERE board_id=? ORDER BY doc_id').all(f.board)).toEqual(source);
    await local.reload(); await expect(local.locator('affine-edgeless-root')).toBeVisible(); expect(await shapeBounds(local, f.first)).toBe('[0,0,160,120]');
    expect(f.identities.runtimeErrors).toEqual([]);
  } catch (error) { failure = error; throw error; }
  finally { release(); interrupt(); await f.close(failure); }
});

async function divergentVersion(browser: Browser, baseURL: string) {
  const f = await fixture(browser, baseURL); const interrupt = await holdPoll(f.editor);
  try {
    await openBoard([f.editor, f.owner], f.board); interrupt(); await expect(f.editor.getByRole('button', { name: 'Reconnect', exact: true })).toBeVisible();
    await moveLocalShape(f.editor, f.first, 70);
    const imageBytes = syntheticCanaries().imageBytes;
    await f.editor.locator('input[type=file][accept="image/*"]').setInputFiles({ name: 'Retained local.png', mimeType: 'image/png', buffer: imageBytes });
    await expect.poll(async () => (await imageHashes(f.editor)).length).toBe(1);
    const changed = f.owner.waitForResponse(response => response.url().endsWith('/live/release') && response.ok()); await moveNativeShape(f.owner, f.second, 45); await changed;
    await f.editor.unroute('**/live/poll'); await f.editor.getByRole('button', { name: 'Reconnect', exact: true }).click();
    const choice = f.editor.getByRole('dialog', { name: 'This board changed while you were away', exact: true }); await expect(choice).toBeVisible();
    return { ...f, interrupt, choice, imageBytes, retained: await journalRows(f.editor) };
  } catch (error) { interrupt(); await f.close(error); throw error; }
}

for (const boundary of ['network', 'quota'] as const) test(`@05-06-02 failed latest ${boundary} retains the candidate and can retry or return to versions`, async ({ browser, baseURL, browserName }) => {
  const f = await divergentVersion(browser, baseURL!); let failure: unknown;
  try {
    await f.choice.getByRole('button', { name: 'Load latest changes', exact: true }).click();
    const offer = f.editor.getByRole('dialog', { name: 'Download your local version?', exact: true });
    if (boundary === 'network') await f.editor.route('**/docs/*/pull', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    else await failRecoveryStorage(f.editor, 'quota');
    await offer.getByRole('button', { name: 'Load latest without download', exact: true }).click();
    await expect(offer.getByRole('alert')).toContainText('The latest board could not be loaded. Your local work is still here.');
    expect(await journalRows(f.editor)).toEqual(f.retained);
    if (boundary === 'network') {
      await f.editor.unroute('**/docs/*/pull'); await offer.getByRole('button', { name: 'Back to versions', exact: true }).click();
      await expect(f.choice).toBeVisible(); expect(await shapeBounds(f.editor, f.first)).toBe('[70,40,160,120]'); expect(await imageHashes(f.editor)).toHaveLength(1);
      await f.choice.getByRole('button', { name: 'Load latest changes', exact: true }).click(); await offer.getByRole('button', { name: 'Load latest without download', exact: true }).click();
    } else { await restoreRecoveryStorage(f.editor); await offer.getByRole('button', { name: 'Retry loading', exact: true }).click(); }
    await expect(offer).toHaveCount(0); await expect(f.editor.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
    expect(await shapeBounds(f.editor, f.first)).toBe('[0,0,160,120]'); expect(await imageHashes(f.editor)).toEqual([]); expect(await journalRows(f.editor)).toEqual([]);
    expect(f.identities.runtimeErrors).toEqual(boundary === 'network' && browserName !== 'firefox' ? ['editor: Failed to load resource: the server responded with a status of 503 (Service Unavailable)'] : []); f.identities.runtimeErrors.length = 0;
  } catch (error) { failure = error; throw error; }
  finally { f.interrupt(); await f.close(failure); }
});

test('@05-06-02 failed download retries the exact local archive and latest requires a separate explicit action', async ({ browser, baseURL }) => {
  const f = await divergentVersion(browser, baseURL!); let failure: unknown;
  try {
    await f.choice.getByRole('button', { name: 'Load latest changes', exact: true }).click();
    const offer = f.editor.getByRole('dialog', { name: 'Download your local version?', exact: true });
    await f.editor.evaluate(() => { const create = URL.createObjectURL; Object.assign(window, { restoreDownload: () => { URL.createObjectURL = create; } }); URL.createObjectURL = value => { if (value instanceof Blob && value.type === 'application/zip') throw new Error('Synthetic download unavailable'); return create(value); }; });
    await offer.getByRole('button', { name: 'Download local copy', exact: true }).click();
    await expect(offer.getByRole('alert')).toContainText('The local copy could not be prepared. Your work is still here.'); expect(await journalRows(f.editor)).toEqual(f.retained);
    await f.editor.evaluate(() => (window as unknown as { restoreDownload(): void }).restoreDownload());
    const started = f.editor.waitForEvent('download'); await offer.getByRole('button', { name: 'Retry download', exact: true }).click();
    const download = await started; const chunks: Buffer[] = []; for await (const chunk of (await download.createReadStream())!) chunks.push(Buffer.from(chunk));
    const archive = unzipSync(Buffer.concat(chunks)); const snapshot = JSON.parse(Buffer.from(Object.entries(archive).find(([name]) => name.endsWith('.snapshot.json'))![1]).toString());
    expect(JSON.stringify(snapshot)).toContain('[70,40,160,120]');
    const assets = Object.entries(archive).filter(([name]) => name.startsWith('assets/')); expect(assets).toHaveLength(1);
    expect(createHash('sha256').update(assets[0]![1]).digest('hex')).toBe(createHash('sha256').update(f.imageBytes).digest('hex'));
    await expect(offer.getByRole('status')).toHaveText('Download started. You can now load the latest board.'); expect(await journalRows(f.editor)).toEqual(f.retained);
    const changed = f.owner.waitForResponse(response => response.url().endsWith('/live/release') && response.ok()); await moveNativeShape(f.owner, f.first, 25); await changed;
    await offer.getByRole('button', { name: 'Load latest changes', exact: true }).click(); await expect(offer).toHaveCount(0);
    await expect(f.editor.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible(); expect(await shapeBounds(f.editor, f.first)).toBe(await shapeBounds(f.owner, f.first));
    expect(await imageHashes(f.editor)).toEqual([]); expect(await journalRows(f.editor)).toEqual([]); expect(f.identities.runtimeErrors).toEqual([]);
  } catch (error) { failure = error; throw error; }
  finally { f.interrupt(); await f.close(failure); }
});

for (const boundary of ['stage', 'document', 'image', 'commit'] as const) test(`@05-06-02 source revocation at fork ${boundary} hides the canvas and retains local work`, async ({ browser, baseURL, browserName }) => {
  const f = await divergentVersion(browser, baseURL!); let failure: unknown;
  try {
    const routePattern = boundary === 'stage' ? '**/recovery-forks' : boundary === 'document' ? '**/api/imports/*/document' : boundary === 'image' ? '**/api/imports/*/blobs/*' : '**/api/imports/*/commit';
    await f.editor.route(routePattern, async route => { f.service.database.prepare('DELETE FROM board_grants WHERE board_id=?').run(f.board); await route.continue(); });
    await f.choice.getByRole('button', { name: 'Create private copy', exact: true }).click();
    await expect(f.editor.getByRole('heading', { name: 'Your access has changed', exact: true })).toBeVisible();
    await expect(f.editor.locator('editor-host')).toHaveCount(0); await expect(f.editor.getByRole('dialog')).toHaveCount(0);
    expect(await journalRows(f.editor)).toEqual(f.retained); expect(f.service.database.prepare('SELECT id FROM boards').all()).toHaveLength(1);
    expect(f.identities.runtimeErrors).toEqual(browserName !== 'firefox' ? ['editor: Failed to load resource: the server responded with a status of 404 (Not Found)'] : []); f.identities.runtimeErrors.length = 0;
  } catch (error) { failure = error; throw error; }
  finally { f.interrupt(); await f.close(failure); }
});
