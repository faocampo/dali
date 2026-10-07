import type { EditorHost } from '@blocksuite/affine/std';
import { randomUUID, createHash } from 'node:crypto';
import type { Browser, Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { acceptanceService, createIdentityContexts, syntheticCanaries } from './access-fixtures';
import { seedCollaborationShapes, moveLocalShape, moveNativeShape, shapeBounds } from './collaboration-fixtures';
import { journalRows } from './recovery-fixtures';
import { readRecoveryEpoch } from '../server/storage/recovery-state';
import { addStickyNote } from './sticky-tool';

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
      data: { operationId: randomUUID(), title: 'Synthetic recovery boundaries' },
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

for (const boundary of ['sequential', 'simultaneous'] as const) test(`@05-05-02 ${boundary} recovery keeps two same-account tab candidates separate`, async ({ browser, browserName, baseURL }) => {
  const f = await fixture(browser, baseURL!); const other = await f.ownerContext.newPage();
  const interruptOwner = await holdPoll(f.owner); const interruptOther = await holdPoll(other);
  let release = () => {}; let failure: unknown;
  try {
    await openBoard([f.owner, other, f.editor], f.board); await expect.poll(() => journalRows(f.owner)).toEqual([]); interruptOwner(); interruptOther();
    for (const page of [f.owner, other]) await expect(page.getByRole('button', { name: 'Reconnect', exact: true })).toBeVisible();
    await moveLocalShape(f.owner, f.first, 70); await expect.poll(() => shapeBounds(f.owner, f.first)).toBe('[70,40,160,120]');
    await expect.poll(async () => (await journalRows(f.owner)).length).toBeGreaterThan(0);
    const firstRows = await journalRows(f.owner);
    await moveLocalShape(other, f.second, 45); await expect.poll(() => shapeBounds(other, f.second)).toBe('[445,40,160,120]');
    await expect.poll(async () => (await journalRows(other)).length).toBeGreaterThan(firstRows.length);
    const secondRows = (await journalRows(other)).filter(row => !firstRows.some(first => first.id === row.id));
    expect(await shapeBounds(f.editor, f.first)).toBe('[0,0,160,120]'); expect(await shapeBounds(f.editor, f.second)).toBe('[400,0,160,120]');
    await f.owner.unroute('**/live/poll'); await other.unroute('**/live/poll');
    let rejected: { status: number; code: string } | undefined; const otherPushes: string[] = [];
    other.on('request', request => { if (/\/docs\/[^/]+\/push$/.test(new URL(request.url()).pathname)) otherPushes.push(request.url()); });
    if (boundary === 'simultaneous') {
      let entered!: () => void; const waiting = new Promise<void>(resolve => { entered = resolve; }); const held = new Promise<void>(resolve => { release = resolve; });
      await other.route('**/docs/*/push', async route => {
        entered(); await held; const response = await route.fetch(); rejected = { status: response.status(), code: (await response.json()).code };
        await route.fulfill({ response });
      });
      await other.getByRole('button', { name: 'Reconnect', exact: true }).click(); await waiting;
    }
    await f.owner.getByRole('button', { name: 'Reconnect', exact: true }).click();
    await expect(f.owner.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
    await expect.poll(() => shapeBounds(f.editor, f.first)).toBe('[70,40,160,120]');
    expect(await shapeBounds(f.editor, f.second)).toBe('[400,0,160,120]');
    await expect.poll(async () => (await journalRows(f.owner)).some(row => firstRows.some(first => first.id === row.id))).toBe(false);
    expect(await journalRows(f.owner)).toEqual(expect.arrayContaining(secondRows));
    if (boundary === 'simultaneous') release();
    else await other.getByRole('button', { name: 'Reconnect', exact: true }).click();
    const choice = other.getByRole('dialog', { name: 'This board changed while you were away', exact: true });
    await expect(choice).toBeVisible();
    expect(await shapeBounds(other, f.first)).toBe('[0,0,160,120]'); expect(await shapeBounds(other, f.second)).toBe('[445,40,160,120]');
    expect(await shapeBounds(f.owner, f.first)).toBe('[70,40,160,120]'); expect(await shapeBounds(f.owner, f.second)).toBe('[400,0,160,120]');
    expect(await journalRows(other)).toEqual(expect.arrayContaining(secondRows));
    expect(otherPushes).toHaveLength(boundary === 'simultaneous' ? 1 : 0);
    if (boundary === 'simultaneous') expect(rejected).toEqual({ status: 409, code: 'RECOVERY_DIVERGED' });
    await choice.getByRole('button', { name: 'Decide later', exact: true }).click();
    await expect(other.getByRole('button', { name: 'Saved, Open save details', exact: true })).toHaveCount(0);
    expect(f.identities.runtimeErrors).toEqual(boundary === 'simultaneous' && browserName !== 'firefox' ? ['owner: Failed to load resource: the server responded with a status of 409 (Conflict)'] : []);
    f.identities.runtimeErrors.length = 0;
  } catch (error) { failure = error; throw error; }
  finally { release(); interruptOwner(); interruptOther(); await f.close(failure); }
});

for (const transition of ['board-navigation', 'account-change'] as const) test(`@05-05-02 ${transition} cancels a held recovery response without consuming its candidate`, async ({ browser, browserName, baseURL }) => {
  const f = await fixture(browser, baseURL!); const interrupt = await holdPoll(f.owner);
  let release = () => {}; let failure: unknown;
  try {
    await openBoard([f.owner, f.editor], f.board); interrupt();
    await expect(f.owner.getByRole('button', { name: 'Reconnect', exact: true })).toBeVisible();
    await moveLocalShape(f.owner, f.first, 70); await expect.poll(() => shapeBounds(f.owner, f.first)).toBe('[70,40,160,120]');
    await expect.poll(async () => (await journalRows(f.owner)).length).toBeGreaterThan(0); const retained = await journalRows(f.owner);
    let entered!: () => void; let finished!: () => void;
    const waiting = new Promise<void>(resolve => { entered = resolve; }); const settled = new Promise<void>(resolve => { finished = resolve; });
    const held = new Promise<void>(resolve => { release = resolve; }); const pushes: string[] = [];
    f.owner.on('request', request => { if (request.url().includes(`/api/boards/${f.board}/docs/`) && request.url().endsWith('/push')) pushes.push(request.url()); });
    await f.owner.route('**/recovery/baseline', async route => {
      const response = await route.fetch(); expect(response.status()).toBe(200); entered(); await held;
      try { await route.fulfill({ response }); } catch { /* The original fetch is aborted by the real navigation boundary. */ } finally { finished(); }
    });
    await f.owner.unroute('**/live/poll'); await f.owner.getByRole('button', { name: 'Reconnect', exact: true }).click(); await waiting;
    if (transition === 'board-navigation') {
      const created = await f.ownerContext.request.post('/api/boards', {
        headers: { Origin: f.service.origin, 'X-Dali-Request': '1', 'X-Dali-Account': f.account, 'X-Dali-Recovery-Epoch': readRecoveryEpoch(f.service.database) },
        data: { operationId: randomUUID(), title: 'Synthetic recovery destination' },
      });
      expect(created.status()).toBe(201); const destination = (await created.json()).summary.id as string;
      await f.owner.getByRole('link', { name: 'Dalí', exact: true }).click();
      // Reconnecting has already suspended the editing scope; navigation
      // preserves the candidate and goes straight to the library.
      await expect(f.owner.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
      await f.owner.locator(`[data-board-id="${destination}"]`).getByRole('link', { name: 'Open Synthetic recovery destination', exact: true }).click();
      await expect(f.owner.locator('affine-edgeless-root')).toBeVisible(); release(); await settled;
      await addStickyNote(f.owner); await expect(f.owner.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
      await expect(f.owner.getByRole('button', { name: 'Rename board: Synthetic recovery destination', exact: true })).toBeVisible();
    } else {
      const changed = f.owner.waitForResponse(response => response.url().endsWith('/api/session') && response.status() === 409);
      const retired = f.owner.waitForResponse(response => response.url().endsWith('/live/disconnect') && response.status() === 409);
      await f.ownerContext.clearCookies(); const switched = await f.ownerContext.newPage();
      await switched.goto('/auth/start'); await switched.getByRole('link', { name: 'Synthetic Editor', exact: true }).click();
      await expect(switched.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
      // Session revalidation consumes this response while aborting the old
      // generation. Assert status plus the native identity boundary below.
      expect((await changed).status()).toBe(409);
      await expect(f.owner.getByRole('heading', { name: 'Account changed', exact: true })).toBeVisible();
      await expect(f.owner.locator('editor-host')).toHaveCount(0); expect((await retired).status()).toBe(409); release(); await settled;
      await switched.goto(`/?board=${f.board}`); await expect(switched.locator('affine-edgeless-root')).toBeVisible();
      expect(await shapeBounds(switched, f.first)).toBe('[0,0,160,120]');
      const released = switched.waitForResponse(response => response.url().endsWith('/live/release') && response.ok());
      await moveNativeShape(switched, f.second, 25); await released;
      await expect.poll(() => shapeBounds(f.editor, f.second)).toBe('[425,40,160,120]');
    }
    expect(await journalRows(f.owner)).toEqual(expect.arrayContaining(retained));
    expect(await shapeBounds(f.editor, f.first)).toBe('[0,0,160,120]'); expect(pushes).toEqual([]);
    expect(f.identities.runtimeErrors).toEqual(transition === 'account-change' && browserName !== 'firefox' ? Array(2).fill('owner: Failed to load resource: the server responded with a status of 409 (Conflict)') : []);
    f.identities.runtimeErrors.length = 0;
  } catch (error) { failure = error; throw error; }
  finally { release(); interrupt(); await f.close(failure); }
});

test('@05-05-02 presence and grant changes alone permit unchanged canvas recovery', async ({ browser, baseURL }) => {
  const f = await fixture(browser, baseURL!); const interrupt = await holdPoll(f.owner); let failure: unknown;
  try {
    await openBoard([f.owner, f.editor], f.board); interrupt();
    await expect(f.owner.getByRole('button', { name: 'Reconnect', exact: true })).toBeVisible();
    await moveLocalShape(f.owner, f.first, 70); await expect.poll(() => shapeBounds(f.owner, f.first)).toBe('[70,40,160,120]');
    const documents = () => f.service.database.prepare('SELECT doc_id,update_bytes FROM board_documents WHERE board_id=? ORDER BY doc_id').all(f.board);
    const before = documents();
    const headers = { Origin: f.service.origin, 'X-Dali-Request': '1', 'X-Dali-Account': f.account, 'X-Dali-Recovery-Epoch': readRecoveryEpoch(f.service.database) };
    const previous = await (await f.ownerContext.request.get(`/api/boards/${f.board}/grants`, { headers })).json();
    const viewer = await (await f.identities.contexts.viewer.request.get('/api/session')).json();
    const granted = await f.ownerContext.request.post(`/api/boards/${f.board}/grants`, { headers,
      data: { operationId: randomUUID(), revision: previous.revision, memberId: viewer.accountId, role: 'viewer' } });
    expect(granted.status()).toBe(200); expect((await granted.json()).revision).toBeGreaterThan(previous.revision);
    const heartbeat = f.editor.waitForResponse(response => response.url().endsWith('/live/presence') && response.ok());
    await f.editor.mouse.move(310, 360); await heartbeat;
    expect(documents()).toEqual(before);
    await f.owner.unroute('**/live/poll'); await f.owner.getByRole('button', { name: 'Reconnect', exact: true }).click();
    await expect(f.owner.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
    await expect(f.owner.getByRole('dialog', { name: 'This board changed while you were away', exact: true })).toHaveCount(0);
    await expect.poll(() => shapeBounds(f.editor, f.first)).toBe('[70,40,160,120]');
    await expect.poll(() => journalRows(f.owner)).toEqual([]);
    await f.owner.reload(); expect(await shapeBounds(f.owner, f.first)).toBe('[70,40,160,120]');
    expect(f.identities.runtimeErrors).toEqual([]);
  } catch (error) { failure = error; throw error; }
  finally { interrupt(); await f.close(failure); }
});

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
for (const version of ['unchanged', 'divergent'] as const) test(`@05-05-02 ${version} offline image stays local until authorized recovery`, async ({ browser, baseURL }) => {
  const f = await fixture(browser, baseURL!); const interrupt = await holdPoll(f.owner); let failure: unknown;
  try {
    await openBoard([f.owner, f.editor], f.board); interrupt();
    await expect(f.owner.getByRole('button', { name: 'Reconnect', exact: true })).toBeVisible();
    const writes: string[] = [];
    f.owner.on('request', request => { const path = new URL(request.url()).pathname;
      if (path.startsWith(`/api/boards/${f.board}/`) && (path.endsWith('/push') || path.endsWith('/reserve') || path.includes('/blobs/') && request.method() === 'PUT')) writes.push(path); });
    const bytes = syntheticCanaries().imageBytes; const hashes = [createHash('sha256').update(bytes).digest('hex')];
    await f.owner.locator('input[type=file][accept="image/*"]').setInputFiles({ name: 'synthetic-local.png', mimeType: 'image/png', buffer: bytes });
    await expect.poll(() => imageHashes(f.owner)).toEqual(hashes);
    await expect.poll(async () => (await journalRows(f.owner)).length).toBeGreaterThan(0); const retained = await journalRows(f.owner);
    expect(writes).toEqual([]);
    expect(f.service.database.prepare('SELECT blob_key FROM board_blobs WHERE board_id=?').all(f.board)).toEqual([]);
    expect(await imageHashes(f.editor)).toEqual([]);
    if (version === 'divergent') {
      const released = f.editor.waitForResponse(response => response.url().endsWith('/live/release') && response.ok());
      await moveNativeShape(f.editor, f.first, 70); await released;
    }
    await f.owner.unroute('**/live/poll'); await f.owner.getByRole('button', { name: 'Reconnect', exact: true }).click();
    if (version === 'unchanged') {
      await expect(f.owner.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
      await expect.poll(() => imageHashes(f.editor)).toEqual(hashes); await expect.poll(() => journalRows(f.owner)).toEqual([]);
      await f.owner.reload(); expect(await imageHashes(f.owner)).toEqual(hashes);
    } else {
      await expect(f.owner.getByRole('dialog', { name: 'This board changed while you were away', exact: true })).toBeVisible();
      expect(await imageHashes(f.owner)).toEqual(hashes); expect(await imageHashes(f.editor)).toEqual([]);
      expect(await shapeBounds(f.owner, f.first)).toBe('[0,0,160,120]'); expect(writes).toEqual([]);
      expect(await journalRows(f.owner)).toEqual(expect.arrayContaining(retained));
      expect(f.service.database.prepare('SELECT blob_key FROM board_blobs WHERE board_id=?').all(f.board)).toEqual([]);
    }
    expect(f.identities.runtimeErrors).toEqual([]);
  } catch (error) { failure = error; throw error; }
  finally { interrupt(); await f.close(failure); }
});
