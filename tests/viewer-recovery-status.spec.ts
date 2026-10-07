import { randomUUID } from 'node:crypto';
import type { Browser, Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { recoveryBoardFixture } from './recovery-fixtures';
import { seedLibraryPending, libraryRecoveryBoard } from './library-recovery-fixtures';
import { openSaveDetails } from './save-details-fixtures';

async function fixture(page: Page, browser: Browser, origin: string) {
  const { member, descriptor } = await recoveryBoardFixture(page, origin, 'Authorized server title');
  const second = await libraryRecoveryBoard(page, origin, member.accountId, 'Second server board');
  for (const board of [descriptor, second]) {
    const path = `/api/boards/${board.summary.id}/grants`;
    const access = await (await page.request.get(path, { headers: { 'X-Dali-Account': member.accountId } })).json();
    const grant = await page.request.post(path, { headers: { Origin: origin, 'X-Dali-Account': member.accountId, 'X-Dali-Request': '1', 'X-Dali-Recovery-Epoch': board.recoveryEpoch }, data: { email: 'viewer@example.org', role: 'viewer', revision: access.revision, operationId: randomUUID() } });
    expect(grant.status()).toBe(200);
  }
  const context = await browser.newContext(); const viewer = await context.newPage();
  const errors: string[] = [];
  viewer.on('pageerror', error => errors.push(error.message));
  viewer.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await viewer.goto(origin + '/auth/start'); await viewer.getByRole('link', { name: 'Synthetic Viewer', exact: true }).click();
  await expect(viewer.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
  const accountId = (await (await viewer.request.get(origin + '/api/session')).json()).accountId as string;
  return { viewer, accountId, descriptor, second, close: async () => { await context.close(); expect(errors, 'unexpected Viewer page errors').toEqual([]); } };
}

async function seedTitle(page: Page, accountId: string, boardId: string, epoch: string) {
  // Reuse the native v2 store fixture, then retain only a title intent.
  await seedLibraryPending(page, accountId, [boardId], epoch);
  await page.evaluate(({ accountId, boardId, epoch }) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('dali-account-recovery-v1', 2);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result; const tx = db.transaction(['journal', 'sequences'], 'readwrite');
      tx.objectStore('journal').clear();
      tx.objectStore('sequences').put({ id: 'title:' + JSON.stringify([accountId, boardId, epoch]), schemaVersion: 1, accountId, boardId, epoch, operationId: crypto.randomUUID(), baseRevision: 1, title: 'Isolated pending title', capturedAt: Date.now() });
      tx.oncomplete = () => { db.close(); resolve(); }; tx.onabort = () => reject(tx.error);
    };
  }), { accountId, boardId, epoch });
}

async function retainedTitles(page: Page) {
  return page.evaluate(() => new Promise<unknown[]>((resolve, reject) => {
    const request = indexedDB.open('dali-account-recovery-v1', 2); request.onerror = () => reject(request.error);
    request.onsuccess = () => { const db = request.result; const tx = db.transaction('sequences'); const rows = tx.objectStore('sequences').getAll(); tx.oncomplete = () => { db.close(); resolve(rows.result.filter(row => String(row.id).startsWith('title:'))); }; };
  }));
}

async function noRecoveryActions(page: Page) {
  const details = await openSaveDetails(page);
  await expect(details.getByRole('button', { name: /Retry|Download recovery copy|Open restored board/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add mind map', exact: true })).toHaveCount(0);
  return details;
}

test('ordinary Viewer opens the authorized server board with read-only feedback', async ({ page, browser, baseURL }) => {
  const f = await fixture(page, browser, baseURL!);
  try {
    await f.viewer.goto(baseURL! + '/?board=' + f.descriptor.summary.id);
    await expect(f.viewer.locator('editor-host')).toBeVisible();
    await expect(f.viewer.getByRole('button', { name: 'Read only, Open save details', exact: true })).toBeVisible();
    await expect(await noRecoveryActions(f.viewer)).toContainText('You can view this board. Editing requires access from the board owner.');
  } finally { await f.close(); }
});

for (const oldEpoch of [false, true]) test(`Viewer retains title-only ${oldEpoch ? 'old-epoch' : 'current-epoch'} work without replay`, async ({ page, browser, baseURL }) => {
  const f = await fixture(page, browser, baseURL!);
  try {
    await seedTitle(f.viewer, f.accountId, f.descriptor.summary.id, oldEpoch ? '22222222-2222-4222-8222-222222222222' : f.descriptor.recoveryEpoch);
    const before = await retainedTitles(f.viewer); const writes: string[] = [];
    f.viewer.on('request', request => { if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method()) && request.url().includes('/api/boards/') && !/\/docs\/[^/]+\/pull$/.test(new URL(request.url()).pathname)) writes.push(request.url()); });
    await f.viewer.goto(baseURL! + '/?board=' + f.descriptor.summary.id);
    await expect(f.viewer.locator('editor-host')).toBeVisible();
    await expect(f.viewer.getByRole('button', { name: 'Your access has changed, Open save details', exact: true })).toBeVisible();
    await expect(await noRecoveryActions(f.viewer)).toContainText('Your access has changed. Pending changes have not been applied. Contact the board owner to restore editing access.');
    await expect(f.viewer.getByText('Isolated pending title', { exact: true })).toHaveCount(0);
    expect(await retainedTitles(f.viewer)).toEqual(before); expect(writes).toEqual([]);
    const server = await (await f.viewer.request.get(baseURL! + '/api/boards/' + f.descriptor.summary.id, { headers: { 'X-Dali-Account': f.accountId } })).json();
    expect(server.summary.title).toBe('Authorized server title');
  } finally { await f.close(); }
});

test('Viewer inspection failure remains explicit while the server board opens', async ({ page, browser, baseURL }) => {
  const f = await fixture(page, browser, baseURL!);
  try {
    await f.viewer.addInitScript(() => { const open = indexedDB.open.bind(indexedDB); indexedDB.open = ((name: string, version?: number) => { if (name === 'dali-account-recovery-v1') throw new DOMException('Synthetic inspection unavailable', 'UnknownError'); return open(name, version); }) as typeof indexedDB.open; });
    await f.viewer.goto(baseURL! + '/?board=' + f.descriptor.summary.id);
    await expect(f.viewer.locator('editor-host')).toBeVisible();
    await expect(f.viewer.getByRole('button', { name: 'Recovery status unavailable, Open save details', exact: true })).toBeVisible();
    await expect(await noRecoveryActions(f.viewer)).toContainText('this browser could not check for pending changes');
  } finally { await f.close(); }
});

test('late Viewer metadata cannot carry a pending warning into another board', async ({ page, browser, baseURL }) => {
  const f = await fixture(page, browser, baseURL!);
  try {
    await seedTitle(f.viewer, f.accountId, f.descriptor.summary.id, f.descriptor.recoveryEpoch);
    await f.viewer.addInitScript(() => {
      const open = indexedDB.open.bind(indexedDB); let held = false; let released = false;
      let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
      Object.assign(window, { viewerInspectionHeld: false, releaseViewerInspection: () => { released = true; release(); } });
      indexedDB.open = ((name: string, version?: number) => {
        const request = open(name, version);
        if (name === 'dali-account-recovery-v1' && !held) {
          held = true;
          request.addEventListener('success', event => {
            if (released) return;
            event.stopImmediatePropagation(); Object.assign(window, { viewerInspectionHeld: true });
            void gate.then(() => request.dispatchEvent(new Event('success')));
          });
        }
        return request;
      }) as typeof indexedDB.open;
    });
    await f.viewer.goto(baseURL! + '/?board=' + f.descriptor.summary.id);
    await expect.poll(() => f.viewer.evaluate(() => (window as unknown as { viewerInspectionHeld: boolean }).viewerInspectionHeld)).toBe(true);
    await f.viewer.evaluate(id => { history.pushState(null, '', '/?board=' + id); dispatchEvent(new PopStateEvent('popstate')); }, f.second.summary.id);
    await expect(f.viewer.getByRole('button', { name: 'Read only, Open save details', exact: true })).toBeVisible();
    await f.viewer.evaluate(() => (window as unknown as { releaseViewerInspection(): void }).releaseViewerInspection());
    await expect(f.viewer.locator('editor-host')).toBeVisible();
    await expect(f.viewer.getByRole('button', { name: 'Read only, Open save details', exact: true })).toBeVisible();
    await expect(f.viewer.getByRole('button', { name: 'Your access has changed, Open save details', exact: true })).toHaveCount(0);
    expect(await retainedTitles(f.viewer)).toHaveLength(1);
  } finally { await f.close(); }
});
