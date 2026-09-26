import { test, expect } from '@playwright/test';
import { recoveryBoardFixture, journalRows, failRecoveryStorage } from './recovery-fixtures';

test('@04-08-02 Stay and Escape retain pending work; Leave transitions once with destination focus', async ({ page, baseURL }) => {
  await recoveryBoardFixture(page, baseURL!);
  await page.route('**/docs/*/push', route => route.fulfill({ status: 503, json: { code: 'SYNTHETIC_OUTAGE' } }));
  await page.getByRole('button', { name: 'Add sticky note', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save failed, Open save details', exact: true })).toBeVisible();
  await expect.poll(async () => (await journalRows(page)).length).toBeGreaterThan(0);
  const open = async () => { await page.getByRole('button', { name: 'Main Menu', exact: true }).click(); await page.getByRole('menuitem', { name: 'File', exact: true }).click(); await page.getByRole('menuitem', { name: 'All boards', exact: true }).click(); };
  await open();
  const dialog = page.getByRole('dialog', { name: 'Leave with changes waiting to save?' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Stay on board' })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
  await expect(page.locator('editor-host')).toBeVisible();
  await open(); await dialog.getByRole('button', { name: 'Stay on board' }).click();
  await expect(page.locator('editor-host')).toBeVisible();
  await open(); await dialog.getByRole('button', { name: 'Leave board', exact: true }).dblclick();
  await expect(page.getByRole('heading', { name: 'Your boards', exact: true })).toBeFocused();
  expect((await journalRows(page)).length).toBeGreaterThan(0);
  await expect(page.getByText('Changes waiting to save', { exact: true }).first()).toBeVisible();
});

test('@04-08-02 title outage survives cold reopen with one receipt and exact saved coverage', async ({ page, baseURL }) => {
  const { descriptor, member } = await recoveryBoardFixture(page, baseURL!);
  const ids = new Set<string>();
  await page.route('**/api/boards/' + descriptor.summary.id, route => {
    if (route.request().method() !== 'PATCH') return route.continue();
    ids.add(route.request().postDataJSON().operationId); return route.fulfill({ status: 503, json: { code: 'SYNTHETIC_OUTAGE' } });
  });
  await page.getByRole('button', { name: /^Rename board:/ }).click();
  await page.getByRole('textbox', { name: 'Board name', exact: true }).fill('Retained outage title');
  await page.getByRole('textbox', { name: 'Board name', exact: true }).press('Enter');
  await expect(page.getByRole('button', { name: 'Rename board: Retained outage title', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save failed, Open save details', exact: true })).toBeVisible();
  const warning = page.waitForEvent('dialog'); const reload = page.reload();
  const native = await warning; expect(native.type()).toBe('beforeunload'); await native.accept(); await reload;
  await expect(page.getByRole('button', { name: 'Rename board: Retained outage title', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save failed, Open save details', exact: true })).toBeVisible();
  expect(ids.size).toBe(1);
  await page.unroute('**/api/boards/' + descriptor.summary.id);
  await page.getByRole('button', { name: 'Save failed, Open save details', exact: true }).click();
  await page.getByRole('button', { name: 'Retry now', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
  const saved = await (await page.request.get('/api/boards/' + descriptor.summary.id, { headers: { 'X-Dali-Account': member.accountId } })).json();
  expect(saved.summary.title).toBe('Retained outage title'); expect(saved.revision).toBe(descriptor.revision + 1);
  await page.reload(); await expect(page.getByRole('button', { name: 'Rename board: Retained outage title', exact: true })).toBeVisible();
});

test('@04-08-02 failed local title preservation keeps text and focus; narrow loss warning allows explicit Leave', async ({ page, baseURL }, testInfo) => {
  await recoveryBoardFixture(page, baseURL!, 'L'.repeat(200));
  await page.getByRole('button', { name: /^Rename board:/ }).click();
  await page.getByRole('textbox', { name: 'Board name', exact: true }).fill('Retained '.repeat(20));
  await failRecoveryStorage(page, 'quota');
  await page.getByRole('textbox', { name: 'Board name', exact: true }).press('Enter');
  await expect(page.getByRole('button', { name: 'Editing paused, Open save details', exact: true })).toBeVisible();
  const input = page.getByRole('textbox', { name: 'Board name', exact: true });
  await expect(input).toHaveValue('Retained '.repeat(20)); await expect(input).toHaveAttribute('readonly', '');
  await expect(input).toBeFocused();
  await page.setViewportSize({ width: 320, height: 480 });
  await page.getByRole('link', { name: 'Dalí', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Leave with changes waiting to save?' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('alert')).toHaveText('This browser could not preserve all pending changes. Leaving may lose them.');
  await expect(dialog.getByRole('button', { name: 'Stay on board' })).toBeFocused();
  await page.keyboard.press('Shift+Tab'); await expect(dialog.getByRole('button', { name: 'Leave board', exact: true })).toBeFocused();
  await page.keyboard.press('Tab'); await expect(dialog.getByRole('button', { name: 'Stay on board' })).toBeFocused();
  const box = await dialog.boundingBox(); expect(box!.x).toBeGreaterThanOrEqual(16); expect(box!.width).toBeLessThanOrEqual(288);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await dialog.screenshot({ path: testInfo.outputPath('leave-narrow.png') });
  await dialog.getByRole('button', { name: 'Stay on board' }).click();
  await expect(page.getByRole('link', { name: 'Dalí', exact: true })).toBeFocused();
  await page.getByRole('link', { name: 'Dalí', exact: true }).click();
  await dialog.getByRole('button', { name: 'Leave board', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your boards', exact: true })).toBeFocused();
});

test('@04-08-02 ordinary short saving navigates without confirmation', async ({ page, baseURL }) => {
  await recoveryBoardFixture(page, baseURL!);
  await expect(page.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
  await page.route('**/docs/*/push', async route => { await new Promise(resolve => setTimeout(resolve, 500)); await route.continue().catch(() => {}); });
  await page.getByRole('button', { name: 'Add sticky note', exact: true }).click();
  await page.getByRole('link', { name: 'Dalí', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your boards', exact: true })).toBeFocused();
  await expect(page.getByRole('dialog', { name: 'Leave with changes waiting to save?' })).toHaveCount(0);
});

test('@04-08-02 independent server title revision retains pending intent without overwriting', async ({ page, baseURL }) => {
  const { descriptor, member } = await recoveryBoardFixture(page, baseURL!);
  await expect(page.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
  const result = await page.request.patch('/api/boards/' + descriptor.summary.id, { headers: { Origin: baseURL!, 'X-Dali-Account': member.accountId, 'X-Dali-Request': '1', 'X-Dali-Recovery-Epoch': descriptor.recoveryEpoch }, data: { operationId: crypto.randomUUID(), revision: descriptor.revision, title: 'Independent server title' } });
  expect(result.ok()).toBe(true);
  let writes = 0; page.on('request', request => { if (request.method() === 'PATCH') writes++; });
  await page.getByRole('button', { name: /^Rename board:/ }).click();
  await page.getByRole('textbox', { name: 'Board name', exact: true }).fill('Retained conflicting title');
  await page.getByRole('textbox', { name: 'Board name', exact: true }).press('Enter');
  await expect(page.getByRole('button', { name: 'Save failed, Open save details', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rename board: Retained conflicting title', exact: true })).toBeVisible();
  const saved = await (await page.request.get('/api/boards/' + descriptor.summary.id, { headers: { 'X-Dali-Account': member.accountId } })).json();
  expect(saved.summary.title).toBe('Independent server title'); expect(writes).toBe(0);
  await page.getByRole('button', { name: 'Save failed, Open save details', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Save details' })).toContainText('The board changed. Your pending name is preserved; review the current board before retrying.');
});

test('@04-08-02 a late old title receipt cannot delete newer durable intent', async ({ page, baseURL }) => {
  const { descriptor } = await recoveryBoardFixture(page, baseURL!);
  let release!: () => void; const barrier = new Promise<void>(resolve => { release = resolve; }); let oldId = '';
  await page.route('**/api/boards/' + descriptor.summary.id, async route => {
    if (route.request().method() !== 'PATCH') return route.continue();
    oldId = route.request().postDataJSON().operationId; await barrier; await route.continue();
  });
  await page.getByRole('button', { name: /^Rename board:/ }).click(); await page.getByRole('textbox', { name: 'Board name', exact: true }).fill('First name'); await page.getByRole('textbox', { name: 'Board name', exact: true }).press('Enter');
  await expect.poll(() => oldId).not.toBe('');
  // A second tab's committed newer metadata races the first tab's held receipt.
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('dali-account-recovery-v1', 2); request.onerror = () => reject(request.error);
    request.onsuccess = () => { const db = request.result; const tx = db.transaction('sequences', 'readwrite'); const store = tx.objectStore('sequences'); const get = store.getAll(); get.onsuccess = () => { const row = get.result.find(row => row.id.startsWith('title:')); store.put({ ...row, title: 'Newer retained name', operationId: crypto.randomUUID() }); }; tx.oncomplete = () => { db.close(); resolve(); }; };
  }));
  release();
  const rows = () => page.evaluate(() => new Promise<{ operationId: string; title: string }[]>((resolve, reject) => {
    const request = indexedDB.open('dali-account-recovery-v1', 2); request.onerror = () => reject(request.error);
    request.onsuccess = () => { const db = request.result; const tx = db.transaction('sequences'); const get = tx.objectStore('sequences').getAll(); tx.oncomplete = () => { db.close(); resolve(get.result.filter(row => row.id.startsWith('title:'))); }; };
  }));
  await expect.poll(async () => (await rows()).map(row => row.title)).toContain('Newer retained name');
  await page.getByRole('button', { name: /Open save details$/ }).click();
  await page.getByRole('button', { name: 'Retry now', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save failed, Open save details', exact: true })).toBeVisible();
  const retained = (await rows()).find(row => row.title === 'Newer retained name'); expect(retained?.operationId).not.toBe(oldId);
});
