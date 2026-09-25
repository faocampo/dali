import { test, expect, type Page } from '@playwright/test';
import { build } from 'esbuild';
import type * as Recovery from '../src/canvas/account/outbox';

declare global { interface Window { RecoveryHarness: typeof Recovery } }
let harness: string;
const scope = { accountId: 'synthetic-member', boardId: 'synthetic-board', generation: 1, recoveryEpoch: '11111111-1111-4111-8111-111111111111' };
test.beforeAll(async () => {
  const result = await build({ entryPoints: ['src/canvas/account/outbox.ts'], bundle: true, write: false, format: 'iife', globalName: 'RecoveryHarness', platform: 'browser' });
  harness = result.outputFiles[0]!.text;
});
async function storagePage(page: Page) {
  await page.route('**/recovery-fixture', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Synthetic recovery fixture</title>' }));
  await page.goto('/recovery-fixture'); await page.addScriptTag({ content: harness });
}
test('@04-03-01 native upgrade retains legacy bytes without adopting an epoch', async ({ page }) => {
  await storagePage(page);
  const result = await page.evaluate(async scope => {
    const legacy = { ...scope, id: 'legacy', sequence: 1, kind: 'document', resource: 'content', data: new Uint8Array([0, 0]) };
    delete (legacy as Partial<typeof scope>).recoveryEpoch;
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('dali-account-recovery-v1', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('journal', { keyPath: 'id' });
      request.onerror = () => reject(request.error);
      request.onsuccess = () => { const db = request.result; const tx = db.transaction('journal', 'readwrite'); tx.objectStore('journal').put(legacy); tx.oncomplete = () => { db.close(); resolve(); }; };
    });
    const records = await window.RecoveryHarness.pendingRecords(scope.accountId, scope.boardId);
    const databases = await indexedDB.databases();
    return { version: databases.find(db => db.name === 'dali-account-recovery-v1')!.version, legacy: records.map(row => ({ ...row, data: [...row.data as Uint8Array] })) };
  }, scope);
  expect(result.version).toBe(2);
  expect(result.legacy).toHaveLength(1); expect(result.legacy[0]).not.toHaveProperty('epoch'); expect(result.legacy[0]!.data).toEqual([0, 0]);
});
