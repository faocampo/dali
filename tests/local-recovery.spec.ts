import { test, expect, type Page } from '@playwright/test';
import { build } from 'esbuild';
import type * as Recovery from '../src/canvas/account/outbox';
import type * as Capture from '../src/canvas/account/local-capture';
import * as Y from 'yjs';
import { fixtureRecoveryEpoch } from './fixtures';
import { randomUUID } from 'node:crypto';

declare global { interface Window { RecoveryHarness: typeof Recovery & typeof Capture & { Y: typeof Y }; recoveryJournal?: Recovery.AccountJournal; recoveryBlocker?: IDBDatabase; recoverySignals?: unknown[] } }
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
    return { succeeded, confirmed, retained, persisted: persisted.length, tabId: journal.tabId };
  }, scope);
  expect(before).toMatchObject({ succeeded: true, confirmed: false, persisted: 0 }); expect(before.retained).toHaveLength(1);
  await page.reload(); await page.addScriptTag({ content: harness });
  const records = await page.evaluate(async scope => (await window.RecoveryHarness.pendingRecords(scope.accountId, scope.boardId)).map(row => ({ id: row.id, data: [...row.data as Uint8Array], schemaVersion: row.schemaVersion })), scope);
  expect(records).toEqual([{ ...before.retained[0], schemaVersion: 2 }]);
  expect(await page.evaluate(scope => new window.RecoveryHarness.AccountJournal(scope, () => {}).tabId, scope)).toBe(before.tabId);
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
test('@04-03-02 acknowledged image bytes remain available to pending reconstruction', async ({ page }) => {
  await storagePage(page);
  const result = await page.evaluate(async scope => {
    const R = window.RecoveryHarness; const journal = new R.AccountJournal(scope, () => {});
    const bytes = new Uint8Array([1, 2, 255]); const key = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))).replace(/\+/g, '-').replace(/\//g, '_');
    await journal.checkpoint({ root: { docId: 'root', data: new Uint8Array([0, 0]) }, content: { docId: 'content', data: new Uint8Array([0, 0]) }, title: 'Synthetic images', assets: { [key]: {} } });
    const image = await journal.capture('blob', key, new Blob([bytes], { type: 'image/png' }));
    await journal.captureUpdate('content', new Uint8Array([0, 0]));
    await R.acknowledgeRecords(scope, [image]);
    // A later hydrated manifest contains references; it must keep cached bytes.
    await journal.checkpoint({ root: { docId: 'root', data: new Uint8Array([0, 0]) }, content: { docId: 'content', data: new Uint8Array([0, 0]) }, title: 'Synthetic images reopened', assets: { [key]: {} } });
    const checkpoint = await R.readCheckpoint(scope, journal.tabId);
    return { bytes: checkpoint?.assets[key]?.data ? [...checkpoint.assets[key].data!] : null, pending: (await R.pendingRecords(scope.accountId, scope.boardId)).length };
  }, scope);
  expect(result.bytes).toEqual([1, 2, 255]); expect(result.pending).toBe(1);
});

test('@04-03-02 two tabs allocate unique sequences and exact compaction retains other-tab work', async ({ page, context }) => {
  const other = await context.newPage(); await storagePage(page); await storagePage(other);
  for (const tab of [page, other]) await tab.evaluate(scope => {
    window.recoveryJournal = new window.RecoveryHarness.AccountJournal(scope, () => {});
    window.recoverySignals = []; const channel = new BroadcastChannel('dali-recovery-invalidation-v2');
    channel.onmessage = event => window.recoverySignals!.push(event.data);
  }, scope);
  const append = (tab: Page) => tab.evaluate(async () => window.recoveryJournal!.captureUpdate('content', new Uint8Array([0, 0])));
  const [a, b] = await Promise.all([append(page), append(other)]); const [a2, b2] = await Promise.all([append(page), append(other)]);
  const rows = await page.evaluate(async scope => (await window.RecoveryHarness.pendingRecords(scope.accountId, scope.boardId)).map(row => ({ id: row.id, sequence: row.sequence, tabId: row.tabId })), scope);
  expect(new Set(rows.map(row => row.sequence)).size).toBe(4); expect(new Set(rows.map(row => row.tabId)).size).toBe(2);
  const compacted = await page.evaluate(ids => window.recoveryJournal!.compact(ids), [a, a2, b, b2]);
  const newer = await append(page);
  await page.evaluate(ids => window.recoveryJournal!.acknowledge(ids), [a, a2]);
  await other.evaluate(id => window.recoveryJournal!.acknowledge([id]), b);
  const retained = await page.evaluate(async scope => (await window.RecoveryHarness.pendingRecords(scope.accountId, scope.boardId)).map(row => row.id).sort(), scope);
  expect(retained).toEqual([compacted, newer, b2].sort());
  await expect.poll(() => other.evaluate(() => window.recoverySignals!.length)).toBeGreaterThan(0);
  expect(await other.evaluate(() => window.recoverySignals)).toEqual(expect.arrayContaining([{ type: 'changed' }]));
  expect(await other.evaluate(() => window.recoverySignals!.every(value => JSON.stringify(value) === '{"type":"changed"}'))).toBe(true);
  expect(await other.evaluate(scope => window.RecoveryHarness.pendingRecords('unrelated-account', scope.boardId), scope)).toEqual([]);
  await other.close();
});

test('@04-03-02 blocked upgrade retains memory and succeeds after the old tab closes', async ({ page, context }) => {
  const blocker = await context.newPage(); await storagePage(blocker); await storagePage(page);
  await blocker.evaluate(async scope => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('dali-account-recovery-v1', 1); open.onerror = () => reject(open.error);
    open.onupgradeneeded = () => open.result.createObjectStore('journal', { keyPath: 'id' });
    open.onsuccess = () => {
      window.recoveryBlocker = open.result; const tx = open.result.transaction('journal', 'readwrite');
      tx.objectStore('journal').put({ accountId: scope.accountId, boardId: scope.boardId, id: 'untouched-legacy', data: new Uint8Array([0, 0]) }); tx.oncomplete = () => resolve();
    };
  }), scope);
  const failed = await page.evaluate(async scope => {
    const journal = window.recoveryJournal = new window.RecoveryHarness.AccountJournal(scope, () => {});
    let error = ''; try { await journal.captureUpdate('content', new Uint8Array([0, 0])); } catch (cause) { error = (cause as Error).message; }
    return { error, id: journal.pendingMemory()[0]!.id };
  }, scope);
  expect(failed.error).toContain('blocked'); await blocker.close();
  await page.evaluate(() => window.recoveryJournal!.preserve());
  const rows = await page.evaluate(scope => window.RecoveryHarness.pendingRecords(scope.accountId, scope.boardId), scope);
  expect(rows.map(row => row.id).sort()).toEqual([failed.id, 'untouched-legacy'].sort());
  expect(rows.find(row => row.id === 'untouched-legacy')).not.toHaveProperty('epoch');
});

test('@04-03-02 quota and acknowledgment abort retain bytes and roll back checkpoint compaction', async ({ page }) => {
  await storagePage(page);
  const result = await page.evaluate(async scope => {
    const R = window.RecoveryHarness; const journal = new R.AccountJournal(scope, () => {});
    await journal.checkpoint({ root: { docId: 'root', data: new Uint8Array([0, 0]) }, content: { docId: 'content', data: new Uint8Array([0, 0]) }, title: 'Synthetic quota', assets: {} });
    const doc = new R.Y.Doc(); doc.getText('canary').insert(0, 'retained'); const data = R.Y.encodeStateAsUpdate(doc); doc.destroy();
    const prototype = IDBObjectStore.prototype; const put = prototype.put;
    prototype.put = function(value, key) { if (this.name === 'journal') throw new DOMException('Synthetic quota', 'QuotaExceededError'); return key === undefined ? put.call(this, value) : put.call(this, value, key); };
    let quota = false; try { await journal.captureUpdate('content', data); } catch { quota = true; } finally { prototype.put = put; }
    const memory = journal.pendingMemory(); await journal.preserve();
    const before = await R.readCheckpoint(scope, journal.tabId); const remove = prototype.delete;
    prototype.delete = function(key) { const request = remove.call(this, key); if (this.name === 'journal') request.addEventListener('success', () => this.transaction.abort()); return request; };
    let aborted = false; try { await journal.acknowledge([memory[0]!.id]); } catch { aborted = true; } finally { prototype.delete = remove; }
    const after = await R.readCheckpoint(scope, journal.tabId); const retained = await R.pendingRecords(scope.accountId, scope.boardId);
    await journal.acknowledge([memory[0]!.id]); const committed = await R.readCheckpoint(scope, journal.tabId);
    const restored = new R.Y.Doc(); R.Y.applyUpdate(restored, committed!.content.data); const text = restored.getText('canary').toString(); restored.destroy();
    return { quota, memory: memory.length, aborted, baselineUnchanged: JSON.stringify([...before!.content.data]) === JSON.stringify([...after!.content.data]), retained: retained.map(row => row.id), expected: memory[0]!.id, text, remaining: (await R.pendingRecords(scope.accountId, scope.boardId)).length };
  }, scope);
  expect(result).toMatchObject({ quota: true, memory: 1, aborted: true, baselineUnchanged: true, text: 'retained', remaining: 0 }); expect(result.retained).toEqual([result.expected]);
});

test('@04-03-02 corrupt checkpoint manifest prevents acknowledgment and preserves the journal', async ({ page }) => {
  await storagePage(page);
  const result = await page.evaluate(async scope => {
    const R = window.RecoveryHarness; const journal = new R.AccountJournal(scope, () => {});
    await journal.checkpoint({ root: { docId: 'root', data: new Uint8Array([0, 0]) }, content: { docId: 'content', data: new Uint8Array([0, 0]) }, title: 'Synthetic corruption', assets: {} });
    const id = await journal.captureUpdate('content', new Uint8Array([0, 0]));
    await new Promise<void>((resolve, reject) => {
      const opening = indexedDB.open(R.recoveryDatabaseName, 2); opening.onerror = () => reject(opening.error);
      opening.onsuccess = () => { const db = opening.result; const tx = db.transaction('checkpoints', 'readwrite'); const store = tx.objectStore('checkpoints'); const request = store.getAll(); request.onsuccess = () => store.put({ ...request.result[0], assets: { 'corrupt/key': { mime: 'text/html', data: new Uint8Array([255]) } } }); tx.oncomplete = () => { db.close(); resolve(); }; };
    });
    let rejected = false; try { await journal.acknowledge([id]); } catch { rejected = true; }
    return { rejected, rows: (await R.pendingRecords(scope.accountId, scope.boardId)).map(row => row.id), id };
  }, scope);
  expect(result.rejected).toBe(true); expect(result.rows).toEqual([result.id]);
});
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
