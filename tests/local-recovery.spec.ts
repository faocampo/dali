import { test, expect, type Page } from '@playwright/test';
import { build } from 'esbuild';
import type * as Recovery from '../src/canvas/account/outbox';
import type * as Capture from '../src/canvas/account/local-capture';
import * as Y from 'yjs';
import { fixtureRecoveryEpoch } from './fixtures';
import { randomUUID } from 'node:crypto';

declare global { interface Window { RecoveryHarness: typeof Recovery & typeof Capture & { Y: typeof Y } } }
let harness: string;
const scope = { accountId: 'synthetic-member', boardId: 'synthetic-board', generation: 1, recoveryEpoch: '11111111-1111-4111-8111-111111111111' };
test.beforeAll(async () => {
  const result = await build({ stdin: { contents: "export * from './src/canvas/account/outbox'; export * from './src/canvas/account/local-capture'; export * as Y from 'yjs';", resolveDir: process.cwd() }, bundle: true, write: false, format: 'iife', globalName: 'RecoveryHarness', platform: 'browser' });
  harness = result.outputFiles[0]!.text;
});

test('@04-03-01 native transaction abort retains memory and completion survives reload', async ({ page }) => {
  await storagePage(page);
  const before = await page.evaluate(async scope => {
    const journal = new window.RecoveryHarness.AccountJournal(scope, () => {});
    const prototype = IDBObjectStore.prototype; const put = prototype.put; let succeeded = false;
    prototype.put = function(value, key) {
      const request = key === undefined ? put.call(this, value) : put.call(this, value, key);
      if (this.name === 'journal') request.addEventListener('success', () => { succeeded = true; this.transaction.abort(); });
      return request;
    };
    let confirmed = false; try { await journal.captureUpdate('content', new Uint8Array([0, 0])); confirmed = true; } catch { /* Expected real abort. */ }
    prototype.put = put;
    const retained = journal.pendingMemory().map(row => ({ id: row.id, data: [...row.data as Uint8Array] }));
    const persisted = await window.RecoveryHarness.pendingRecords(scope.accountId, scope.boardId);
    await journal.preserve();
    return { succeeded, confirmed, retained, persisted: persisted.length };
  }, scope);
  expect(before).toMatchObject({ succeeded: true, confirmed: false, persisted: 0 }); expect(before.retained).toHaveLength(1);
  await page.reload(); await page.addScriptTag({ content: harness });
  const records = await page.evaluate(async scope => (await window.RecoveryHarness.pendingRecords(scope.accountId, scope.boardId)).map(row => ({ id: row.id, data: [...row.data as Uint8Array], schemaVersion: row.schemaVersion })), scope);
  expect(records).toEqual([{ ...before.retained[0], schemaVersion: 2 }]);
});

test('@04-03-01 corrupt and unknown records remain intact and never reach replay', async ({ page }) => {
  await storagePage(page);
  const result = await page.evaluate(async scope => {
    const R = window.RecoveryHarness; const journal = new R.AccountJournal(scope, () => {});
    const id = await journal.captureUpdate('content', new Uint8Array([0, 0]));
    await new Promise<void>((resolve, reject) => {
      const opening = indexedDB.open(R.recoveryDatabaseName, 2); opening.onerror = () => reject(opening.error);
      opening.onsuccess = () => { const db = opening.result; const tx = db.transaction('journal', 'readwrite'); const store = tx.objectStore('journal'); const get = store.get(id); get.onsuccess = () => store.put({ ...get.result, schemaVersion: 999, data: new Uint8Array([255]) }); tx.oncomplete = () => { db.close(); resolve(); }; };
    });
    const original = window.fetch; let requests = 0; window.fetch = async () => { requests++; throw new Error('Unexpected replay'); };
    let rejected = false;
    try { await R.replayJournal({ summary: { id: scope.boardId, accountId: scope.accountId, role: 'owner' }, rootDocId: 'root', contentDocId: 'content', recoveryEpoch: scope.recoveryEpoch, capabilities: ['write'] } as Parameters<typeof R.replayJournal>[0], scope.accountId, new AbortController().signal); } catch { rejected = true; }
    finally { window.fetch = original; }
    return { rejected, requests, records: (await R.pendingRecords(scope.accountId, scope.boardId)).map(row => ({ id: row.id, schemaVersion: row.schemaVersion, data: [...row.data as Uint8Array] })), scopes: await R.inspectPendingScopes(scope.accountId) };
  }, scope);
  expect(result.rejected).toBe(true); expect(result.requests).toBe(0); expect(result.records).toHaveLength(1);
  expect(result.records[0]).toMatchObject({ schemaVersion: 999, data: [255] }); expect(result.scopes[0]).toMatchObject({ corrupt: true });
});

test('@04-03-01 independent capture reconstructs the second edit after native sync failure and reload', async ({ page, baseURL }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/auth/start'); await page.getByRole('link', { name: 'Synthetic Owner', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
  const member = await (await page.request.get('/api/session')).json(); const epoch = await fixtureRecoveryEpoch(page.request, member.accountId);
  const response = await page.request.post('/api/boards', { headers: { Origin: baseURL!, 'X-Dali-Account': member.accountId, 'X-Dali-Request': '1', 'X-Dali-Recovery-Epoch': epoch }, data: { operationId: randomUUID(), title: 'Synthetic local recovery' } });
  expect(response.status()).toBe(201); const descriptor = await response.json();
  await page.goto('/?board=' + descriptor.summary.id); await expect(page.locator('editor-host')).toBeVisible();
  let failed = 0; await page.route('**/docs/*/push', route => { failed++; return route.fulfill({ status: 503, json: { code: 'SYNTHETIC_OUTAGE' } }); });
  await page.getByRole('button', { name: 'Add sticky note', exact: true }).click();
  await page.locator('affine-edgeless-note').dblclick(); await page.keyboard.type('First local canary'); await page.keyboard.press('Escape');
  await expect.poll(() => failed).toBeGreaterThan(0);
  await page.locator('affine-edgeless-note').dblclick(); await page.keyboard.press('End'); await page.keyboard.type(' Second local canary'); await page.keyboard.press('Escape');
  const stored = async () => page.evaluate(async () => new Promise<{ checkpoints: Recovery.RecoveryCheckpoint[]; rows: Recovery.JournalRecord[] }>((resolve, reject) => {
    const request = indexedDB.open('dali-account-recovery-v1', 2); request.onerror = () => reject(request.error);
    request.onsuccess = () => { const db = request.result; const tx = db.transaction(['journal', 'checkpoints'], 'readonly'); const rows = tx.objectStore('journal').getAll(); const checkpoints = tx.objectStore('checkpoints').getAll(); tx.oncomplete = () => { db.close(); resolve({ checkpoints: checkpoints.result, rows: rows.result }); }; };
  })).then(value => value);
  // Browser serialization needs explicit byte arrays for independent reconstruction.
  const reconstruct = async () => page.evaluate(async ({ accountId, boardId }) => new Promise<{ root: number[]; content: number[]; updates: number[][]; tabId: string; title: string }>((resolve, reject) => {
    const request = indexedDB.open('dali-account-recovery-v1', 2); request.onerror = () => reject(request.error);
    request.onsuccess = () => { const db = request.result; const tx = db.transaction(['journal', 'checkpoints']); const checkpoints = tx.objectStore('checkpoints').getAll(); const records = tx.objectStore('journal').index('board').getAll([accountId, boardId]); tx.oncomplete = () => {
      const cp = (checkpoints.result as Recovery.RecoveryCheckpoint[]).find(row => row.accountId === accountId && row.boardId === boardId)!;
      db.close(); resolve({ root: [...cp.root.data], content: [...cp.content.data], updates: (records.result as Recovery.JournalRecord[]).filter(row => row.resource === cp.content.docId).map(row => [...row.data as Uint8Array]), tabId: cp.tabId, title: cp.title });
    }; };
  }), { accountId: member.accountId, boardId: descriptor.summary.id });
  const text = async () => { const value = await reconstruct(); const doc = new Y.Doc(); try { Y.applyUpdate(doc, new Uint8Array(value.content)); value.updates.forEach(update => Y.applyUpdate(doc, new Uint8Array(update))); return JSON.stringify(doc.getMap('blocks').toJSON()); } finally { doc.destroy(); } };
  await expect.poll(text).toContain('Second local canary');
  expect((await stored()).checkpoints).toHaveLength(1);
  await page.reload(); await expect.poll(text).toContain('First local canary'); expect(await text()).toContain('Second local canary'); expect(errors).toEqual([]);
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
