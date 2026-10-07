import { expect, type Page } from '@playwright/test';
import type { EditorHost } from '@blocksuite/affine/std';
import { randomUUID } from 'node:crypto';
import { fixtureRecoveryEpoch } from './fixtures';

export async function recoveryBoardFixture(page: Page, origin: string, title = 'Synthetic recovery board') {
  await page.goto('/auth/start'); await page.getByRole('link', { name: 'Synthetic Owner', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
  const member = await (await page.request.get('/api/session')).json();
  const epoch = await fixtureRecoveryEpoch(page.request, member.accountId);
  const response = await page.request.post('/api/boards', { headers: { Origin: origin, 'X-Dali-Account': member.accountId, 'X-Dali-Request': '1', 'X-Dali-Recovery-Epoch': epoch }, data: { operationId: randomUUID(), title } });
  expect(response.status()).toBe(201); const descriptor = await response.json();
  await page.goto('/?board=' + descriptor.summary.id); await expect(page.locator('editor-host')).toBeVisible();
  return { member, descriptor };
}
export async function nativeRecoveryModel(page: Page) {
  return page.locator('editor-host').evaluate(el => JSON.stringify((el as EditorHost).store.spaceDoc.toJSON()));
}
export async function failRecoveryStorage(page: Page, mode: 'quota' | 'abort') {
  await page.evaluate(mode => {
    const put = IDBObjectStore.prototype.put;
    Object.assign(window, { restoreRecoveryStorage: () => { IDBObjectStore.prototype.put = put; } });
    IDBObjectStore.prototype.put = function(value, key) {
      if (this.transaction.db.name === 'dali-account-recovery-v1' && mode === 'quota') throw new DOMException('Synthetic quota', 'QuotaExceededError');
      const request = key === undefined ? put.call(this, value) : put.call(this, value, key);
      if (this.transaction.db.name === 'dali-account-recovery-v1') request.addEventListener('success', () => this.transaction.abort());
      return request;
    };
  }, mode);
}
export async function restoreRecoveryStorage(page: Page) { await page.evaluate(() => (window as unknown as { restoreRecoveryStorage: () => void }).restoreRecoveryStorage()); }
export async function journalRows(page: Page) {
  return page.evaluate(() => new Promise<{ id: string; epoch?: string; data: number[] }[]>((resolve, reject) => {
    const request = indexedDB.open('dali-account-recovery-v1', 2); request.onerror = () => reject(request.error);
    request.onsuccess = () => { const db = request.result; const tx = db.transaction('journal'); const get = tx.objectStore('journal').getAll(); tx.oncomplete = () => { db.close(); resolve(get.result.map(row => ({ id: row.id, epoch: row.epoch, data: Array.from(row.data) }))); }; };
  }));
}
