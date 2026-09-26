import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { expect, fixtureRecoveryEpoch } from './fixtures';

export async function libraryRecoveryMember(page: Page, origin: string) {
  await page.goto(origin + '/auth/start');
  await page.getByRole('link', { name: 'Synthetic Owner', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
  return (await (await page.request.get(origin + '/api/session')).json()).accountId as string;
}
export async function libraryRecoveryBoard(page: Page, origin: string, accountId: string, title = 'Synthetic pending board') {
  const epoch = await fixtureRecoveryEpoch(page.request, accountId, origin);
  const response = await page.request.post(origin + '/api/boards', { headers: { Origin: origin, 'X-Dali-Account': accountId, 'X-Dali-Request': '1', 'X-Dali-Recovery-Epoch': epoch }, data: { title, operationId: randomUUID() } });
  expect(response.status()).toBe(201); return response.json();
}
/** Native IndexedDB fixture preserves the production v2 stores and indexes. */
export async function seedLibraryPending(page: Page, accountId: string, boardIds: string[], epoch = '11111111-1111-4111-8111-111111111111') {
  return page.evaluate(async ({ accountId, boardIds, epoch }) => {
    const request = indexedDB.open('dali-account-recovery-v1', 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      const journal = db.createObjectStore('journal', { keyPath: 'id' });
      journal.createIndex('account', 'accountId'); journal.createIndex('board', ['accountId', 'boardId']); journal.createIndex('scope', ['accountId', 'boardId', 'epoch']);
      db.createObjectStore('checkpoints', { keyPath: 'id' }).createIndex('scope', ['accountId', 'boardId', 'epoch']);
      db.createObjectStore('sequences', { keyPath: 'id' });
    };
    const db = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const ids = boardIds.map(() => crypto.randomUUID());
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('journal', 'readwrite');
      boardIds.forEach((boardId, index) => tx.objectStore('journal').put({ id: ids[index], accountId, boardId, generation: 1, epoch, recoveryEpoch: epoch, schemaVersion: 2, tabId: 'synthetic-tab', sequence: index + 1, coveredIds: [], kind: 'document', resource: 'synthetic-content', data: new Uint8Array([0, 0]) }));
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
    });
    db.close(); const channel = new BroadcastChannel('dali-recovery-invalidation-v2'); channel.postMessage({ type: 'changed' }); channel.close(); return ids;
  }, { accountId, boardIds, epoch });
}
