import { afterEach, expect, it, vi } from 'vitest';
import { AccountJournal, acknowledgeRecords, acknowledgeRecoveredTitle, preserveRecoverySubmission, readCheckpoint, replayJournal, requestRecoveryStorage, titleIntentStore, markRecoveryPermissionLoss, recoveryPermissionConfirmation, resolveRecoveryPermission, type JournalRecord, recoveryForkStore, resolveRecoveryCandidate, type RecoveryForkIntent } from './outbox';
import { attachLocalCapture, RECOVERY_REPLAY_ORIGIN } from './local-capture';
import * as Y from 'yjs';
import { createHash } from 'node:crypto';
import type { BoardDescriptor } from '../../boards/BoardLibrary';
import { recoveryDigest, recoveryVersionsDiffer, type SharedRecoveryBaseline } from './recovery-baseline';

// Browser regressions cover native storage. This strict transaction double
// exercises failure retention and migration from already persisted Blob rows.
function storage(initial: JournalRecord[] = []) {
  const rows = new Map(initial.map(row => [row.id, row]));
  const stores = new Map<string, Map<string, unknown>>([['journal', rows], ['sequences', new Map()], ['checkpoints', new Map()]]);
  let fail = false;
  const db = {
    close() {},
    transaction(_names: string[], _mode: string, options: { durability: string }) {
      expect(options.durability).toBe('strict');
      const draft = new Map([...stores].map(([name, values]) => [name, new Map(values)]));
      let pending = 0; let aborted = false;
      const tx = { oncomplete: null as null | (() => void), onabort: null as null | (() => void), onerror: null as null | (() => void), error: null as Error | null,
        abort() { aborted = true; queueMicrotask(() => tx.onabort?.()); },
        objectStore(name: string) { const values = draft.get(name)!; return {
          put(row: { id: string; data?: unknown }) {
            if (fail || row.data instanceof Blob) { tx.error = new DOMException('Storage unavailable', 'UnknownError'); throw tx.error; }
            values.set(row.id, structuredClone(row)); return request(row.id);
          },
          get(id: string) { return request(values.get(id)); },
          getAll() { return request([...values.values()]); },
          delete(id: string) { values.delete(id); return request(undefined); },
          index(index: string) { return { getAll(query: string | string[]) {
            return request([...values.values()].filter(value => { const row = value as JournalRecord; const key = index === 'account' ? row.accountId : index === 'board' ? [row.accountId, row.boardId] : [row.accountId, row.boardId, row.epoch]; return JSON.stringify(key) === JSON.stringify(query); }));
          } }; },
        }; },
      };
      function request<T>(result: T) {
        pending++; const req = { result: structuredClone(result), onsuccess: null as null | (() => void) };
        queueMicrotask(() => { if (aborted) return; pending--; req.onsuccess?.(); queueMicrotask(() => {
          if (!aborted && !pending) { for (const [name, values] of draft) { const target = stores.get(name)!; target.clear(); for (const [id, value] of values) target.set(id, value); } tx.oncomplete?.(); }
        }); }); return req;
      }
      return tx;
    },
  };
  vi.stubGlobal('indexedDB', {
    databases: async () => [{ name: 'dali-account-recovery-v1' }],
    open() { const request = { result: db, onsuccess: null as null | (() => void) }; queueMicrotask(() => request.onsuccess?.()); return request; },
  });
  return { rows, fail(value: boolean) { fail = value; } };
}
afterEach(() => { vi.unstubAllGlobals(); });
it('@05-05-02 restored-write consent belongs to one candidate and cannot resolve a later permission loss', async () => {
  storage(); expect(await recoveryPermissionConfirmation(scope, 'a')).toBeUndefined();
  await markRecoveryPermissionLoss(scope); const first = (await recoveryPermissionConfirmation(scope, 'a'))!;
  expect(first).toBeTruthy(); expect(await recoveryPermissionConfirmation(scope, 'b')).toBe(first);
  await resolveRecoveryPermission(scope, 'a', first);
  expect(await recoveryPermissionConfirmation(scope, 'a')).toBeUndefined(); expect(await recoveryPermissionConfirmation(scope, 'b')).toBe(first);
  await markRecoveryPermissionLoss(scope); const later = (await recoveryPermissionConfirmation(scope, 'a'))!; expect(later).not.toBe(first);
  await expect(resolveRecoveryPermission(scope, 'a', first)).rejects.toMatchObject({ code: 'RECOVERY_CHOICE' });
  expect(await recoveryPermissionConfirmation(scope, 'a')).toBe(later);
});
it('@05-05-02 collaborative title intents remain in their original tab and preserve legacy metadata', async () => {
  storage(); const legacy = titleIntentStore(scope); const a = titleIntentStore(scope, 'tab-a'); const b = titleIntentStore(scope, 'tab-b');
  const intent = { schemaVersion: 1 as const, accountId: scope.accountId, boardId: scope.boardId, epoch: scope.recoveryEpoch!, operationId: 'legacy-name', baseRevision: 1, title: 'Legacy name' };
  await legacy.write(intent); await a.write({ ...intent, operationId: 'tab-a-name', title: 'Tab A name' });
  expect(await b.read()).toBeUndefined(); expect((await a.read())?.title).toBe('Tab A name'); expect((await legacy.read())?.title).toBe('Legacy name');
  await b.write({ ...intent, operationId: 'tab-b-name', title: 'Tab B name' }); await a.acknowledge('tab-a-name');
  expect(await a.read()).toBeUndefined(); expect((await b.read())?.title).toBe('Tab B name'); expect((await legacy.read())?.title).toBe('Legacy name');
});
it('@05-05-02 a title receipt atomically advances its baseline and preserves newer or other-tab intents on failure', async () => {
  const db = storage(); const journal = new AccountJournal(scope, () => {}); const doc = new Y.Doc();
  const base: SharedRecoveryBaseline = { version: 1, epoch: scope.recoveryEpoch!, root: { docId: 'root', data: Y.encodeStateAsUpdate(doc) }, content: { docId: 'content', data: Y.encodeStateAsUpdate(doc) }, title: 'Original', revision: 1, titleRevision: 1 };
  await journal.checkpoint({ root: base.root, content: base.content, title: base.title, assets: {} }); await journal.observeShared(base);
  const own = titleIntentStore(scope, journal.tabId); const other = titleIntentStore(scope, 'other-tab');
  const intent = { schemaVersion: 1 as const, accountId: scope.accountId, boardId: scope.boardId, epoch: scope.recoveryEpoch!, operationId: 'own-name', baseRevision: 1, title: 'Own name' };
  await own.write(intent); await other.write({ ...intent, operationId: 'foreign-name', title: 'Other tab name' });
  const proof = { operationId: intent.operationId, title: intent.title, revision: 2 };
  db.fail(true); await expect(acknowledgeRecoveredTitle(scope, journal.tabId, proof)).rejects.toThrow(); db.fail(false);
  expect((await own.read())?.operationId).toBe(intent.operationId); expect((await readCheckpoint(scope, journal.tabId))?.shared?.title).toBe('Original');
  await own.write({ ...intent, operationId: 'newer', title: 'Newer local name' });
  await acknowledgeRecoveredTitle(scope, journal.tabId, proof);
  expect((await own.read())?.operationId).toBe('newer'); expect((await other.read())?.operationId).toBe('foreign-name');
  expect((await readCheckpoint(scope, journal.tabId))?.shared).toMatchObject({ title: 'Own name', titleRevision: 2 });
  await acknowledgeRecoveredTitle(scope, journal.tabId, { operationId: 'newer', title: 'Newer local name', revision: 3 });
  expect(await own.read()).toBeUndefined(); await acknowledgeRecoveredTitle(scope, journal.tabId, proof);
  expect((await readCheckpoint(scope, journal.tabId))?.shared).toMatchObject({ title: 'Newer local name', titleRevision: 3 });
  expect((await other.read())?.operationId).toBe('foreign-name'); doc.destroy();
});
it('@05-05-01 records remote baseline updates without losing pending local edits', async () => {
  const db = storage(); const journal = new AccountJournal(scope, () => {});
  const root = new Y.Doc(); const content = new Y.Doc(); content.getMap('shapes').set('a', 0);
  const base: SharedRecoveryBaseline = { version: 1, epoch: scope.recoveryEpoch!, root: { docId: 'root', data: Y.encodeStateAsUpdate(root) }, content: { docId: 'content', data: Y.encodeStateAsUpdate(content) }, title: 'Synthetic baseline', revision: 1, titleRevision: 1 };
  await journal.checkpoint({ root: base.root, content: base.content, title: base.title, assets: {} });
  await journal.observeShared(base);
  const local = new Y.Doc(); Y.applyUpdate(local, base.content.data); const localVector = Y.encodeStateVector(local); local.getMap('shapes').set('a', 3);
  const localId = await journal.captureUpdate('content', Y.encodeStateAsUpdate(local, localVector));
  content.getMap('shapes').set('b', 7);
  const remote = { ...base, content: { ...base.content, data: Y.encodeStateAsUpdate(content) }, revision: 2, titleRevision: 2 };
  await journal.observeShared(remote);
  const checkpoint = (await readCheckpoint(scope, journal.tabId))!;
  expect(recoveryVersionsDiffer(checkpoint.shared, remote)).toBe(false);
  const restored = new Y.Doc(); Y.applyUpdate(restored, checkpoint.content.data); Y.applyUpdate(restored, db.rows.get(localId)!.data as Uint8Array);
  expect(restored.getMap('shapes').toJSON()).toEqual({ a: 3, b: 7 });
  expect(db.rows.has(localId)).toBe(true);
  root.destroy(); content.destroy(); local.destroy(); restored.destroy();
});
it('@05-05-02 a replay preserves its action identity before sending and keeps originals on storage failure', async () => {
  const db = storage(); const journal = new AccountJournal(scope, () => {}); const doc = new Y.Doc(); doc.getText('text').insert(0, 'Synthetic recovery');
  const data = Y.encodeStateAsUpdate(doc); const id = await journal.captureUpdate('content', data, 'original-action');
  const original = structuredClone(db.rows.get(id)!); const attempt = { tabId: 'original-transport', operationId: 'recovery-operation', digest: await recoveryDigest(data) };
  const submission = await preserveRecoverySubmission(scope, journal.tabId, [original], data, attempt, 'committed-fragment');
  expect(db.rows.get(submission.id)).toMatchObject({ actionId: 'original-action', recoveryActionId: 'committed-fragment', attempt, coveredIds: [id] });
  expect(db.rows.get(id)).toEqual(original); const preserved = [...db.rows.keys()]; db.fail(true);
  await expect(preserveRecoverySubmission(scope, journal.tabId, [original], data, attempt, 'another-fragment')).rejects.toThrow();
  expect([...db.rows.keys()]).toEqual(preserved); expect(db.rows.get(id)).toEqual(original); doc.destroy();
});
it('@05-05-01 exact transport identities persist separately and cannot be compacted into another receipt', async () => {
  const db = storage(); const journal = new AccountJournal(scope, () => {}); const doc = new Y.Doc(); doc.getText('text').insert(0, 'Synthetic uncertain update');
  const data = Y.encodeStateAsUpdate(doc); const attempt = { tabId: 'actual-live-tab', operationId: 'uncertain-operation', digest: await recoveryDigest(data) };
  const token = await journal.captureSubmission('content', data, attempt);
  const row = db.rows.get(token.ids[0]!)!; expect(row.attempt).toEqual(attempt); expect(row.tabId).toBe(journal.tabId);
  await expect(journal.compact(token.ids)).rejects.toThrow(); expect(db.rows.has(row.id)).toBe(true); doc.destroy();
});
it('@05-05-01 failed baseline persistence leaves the previous checkpoint and all pending rows intact', async () => {
  const db = storage(); const failed = vi.fn(); const journal = new AccountJournal(scope, failed); const doc = new Y.Doc();
  const base: SharedRecoveryBaseline = { version: 1, epoch: scope.recoveryEpoch!, root: { docId: 'root', data: Y.encodeStateAsUpdate(doc) }, content: { docId: 'content', data: Y.encodeStateAsUpdate(doc) }, title: 'Synthetic baseline', revision: 1, titleRevision: 1 };
  await journal.checkpoint({ root: base.root, content: base.content, title: base.title, assets: {} });
  const id = await journal.captureUpdate('content', Y.encodeStateAsUpdate(doc)); db.fail(true);
  await expect(journal.observeShared(base)).rejects.toThrow(); expect(failed).toHaveBeenCalledOnce();
  expect((await readCheckpoint(scope, journal.tabId))!.shared).toBeUndefined(); expect(db.rows.has(id)).toBe(true);
  db.fail(false); await journal.observeShared(base); expect((await readCheckpoint(scope, journal.tabId))!.shared).toEqual(base); doc.destroy();
});
function documentRows(doc: Y.Doc, count: number, resource = 'content'): JournalRecord[] {
  const rows: JournalRecord[] = [];
  const capture = (data: Uint8Array) => rows.push({ ...scope, schemaVersion: 2, epoch: scope.recoveryEpoch, tabId: 'batch-tab', coveredIds: [], id: `${resource}-${rows.length}`, sequence: rows.length + 1, kind: 'document', resource, data });
  doc.on('update', capture);
  for (let i = 0; i < count; i++) doc.getText('text').insert(doc.getText('text').length, String(i) + ',');
  doc.off('update', capture);
  return rows;
}

it('batches document replay with exact reconstruction and retains records captured after submission', async () => {
  const content = new Y.Doc(); const root = new Y.Doc();
  const rows = [...documentRows(content, 520), ...documentRows(root, 2, 'root')];
  content.once('update', data => rows.push({ ...rows[0]!, id: 'content-delete', sequence: 521, data }));
  content.getText('text').delete(0, 10);
  const db = storage(rows); const received = new Map([['content', new Y.Doc()], ['root', new Y.Doc()]]);
  const late = { ...rows[0]!, id: 'late-capture' }; const observer = vi.fn();
  const request = vi.fn(async (url: string, init: RequestInit) => {
    db.rows.set(late.id, late);
    const id = url.includes('/docs/content/') ? 'content' : 'root';
    Y.applyUpdate(received.get(id)!, new Uint8Array(await new Response(init.body).arrayBuffer()));
    return Response.json({ acknowledged: true }, { headers: { 'X-Dali-Recovery-Epoch': scope.recoveryEpoch } });
  });
  vi.stubGlobal('fetch', request);
  await expect(replayJournal(descriptor, scope.accountId, new AbortController().signal, false, false, observer)).resolves.toBe(true);
  expect(request).toHaveBeenCalledTimes(4);
  expect(received.get('content')!.getText('text').toString()).toBe(content.getText('text').toString());
  expect(received.get('root')!.getText('text').toString()).toBe(root.getText('text').toString());
  expect([...db.rows.keys()]).toEqual([late.id]);
  for (const row of rows) expect(observer.mock.calls.filter(([record, outcome]) => record.id === row.id && outcome === 'acknowledged')).toHaveLength(1);
  [content, root, ...received.values()].forEach(doc => doc.destroy());
});

for (const failure of ['unconfirmed', 'epoch', 'missing-epoch', 'unauthorized', 'abort', 'checkpoint'] as const) it(`retains every batched row when ${failure} prevents a durable acknowledgment`, async () => {
  const content = new Y.Doc(); const root = new Y.Doc(); const journal = new AccountJournal(scope, vi.fn());
  const rows = documentRows(content, 4).map(row => ({ ...row, tabId: journal.tabId }));
  const db = storage(rows);
  await journal.checkpoint({ root: { docId: 'root', data: Y.encodeStateAsUpdate(root) }, content: { docId: 'content', data: Y.encodeStateAsUpdate(new Y.Doc()) }, title: 'Synthetic batch', assets: {} });
  const controller = new AbortController(); const observer = vi.fn();
  vi.stubGlobal('fetch', vi.fn(async () => {
    if (failure === 'abort') controller.abort();
    if (failure === 'checkpoint') db.fail(true);
    return Response.json({ acknowledged: failure !== 'unconfirmed' }, { status: failure === 'unauthorized' ? 401 : 200, headers: failure === 'missing-epoch' ? {} : { 'X-Dali-Recovery-Epoch': failure === 'epoch' ? '22222222-2222-4222-8222-222222222222' : scope.recoveryEpoch } });
  }));
  await expect(replayJournal(descriptor, scope.accountId, controller.signal, false, false, observer)).rejects.toThrow();
  expect([...db.rows.keys()]).toEqual(rows.map(row => row.id));
  expect(observer.mock.calls.filter(([, outcome]) => outcome === 'acknowledged')).toHaveLength(0);
  expect(observer.mock.calls.filter(([, outcome]) => outcome === 'failed')).toHaveLength(rows.length);
  db.fail(false);
  const checkpoint = await readCheckpoint(scope, journal.tabId); const restored = new Y.Doc(); Y.applyUpdate(restored, checkpoint!.content.data);
  expect(restored.getText('text').toString()).toBe('');
  [root, content, restored].forEach(doc => doc.destroy());
});

it('bounds merged replay bytes, keeps blobs first and advances each tab checkpoint with exact document content', async () => {
  const content = new Y.Doc(); const root = new Y.Doc(); const updates: Uint8Array[] = [];
  content.on('update', data => updates.push(data));
  content.getText('text').insert(0, 'a'.repeat(600000)); content.getText('text').insert(600000, 'b'.repeat(600000));
  const journal = new AccountJournal(scope, vi.fn());
  const rows = updates.map((data, index): JournalRecord => ({ ...scope, schemaVersion: 2, epoch: scope.recoveryEpoch, tabId: journal.tabId, coveredIds: [], id: `large-${index}`, sequence: index + 1, kind: 'document', resource: 'content', data }));
  const blob: JournalRecord = { ...rows[0]!, id: 'image', kind: 'blob', resource: imageKey, data: new Uint8Array([0, 128, 255]), mime: 'image/png' };
  const db = storage([...rows, blob]);
  await journal.checkpoint({ root: { docId: 'root', data: Y.encodeStateAsUpdate(root) }, content: { docId: 'content', data: Y.encodeStateAsUpdate(root) }, title: 'Synthetic bytes', assets: {} });
  const received = new Y.Doc(); const urls: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    urls.push(url);
    if (url.includes('/docs/')) { const data = new Uint8Array(await new Response(init.body).arrayBuffer()); expect(data.byteLength).toBeLessThanOrEqual(1024 * 1024); Y.applyUpdate(received, data); }
    return Response.json({ acknowledged: true, key: imageKey }, { headers: { 'X-Dali-Recovery-Epoch': scope.recoveryEpoch } });
  }));
  await replayJournal(descriptor, scope.accountId, new AbortController().signal);
  expect(urls).toHaveLength(3); expect(urls[0]).toContain('/blobs/'); expect(db.rows.size).toBe(0);
  const checkpoint = await readCheckpoint(scope, journal.tabId); const restored = new Y.Doc(); Y.applyUpdate(restored, checkpoint!.content.data);
  expect(restored.getText('text').toString()).toBe(content.getText('text').toString());
  expect(received.getText('text').toString()).toBe(content.getText('text').toString());
  expect(checkpoint!.assets[imageKey]!.data).toEqual(blob.data);
  [content, root, received, restored].forEach(doc => doc.destroy());
});
const imageKey = createHash('sha256').update(new Uint8Array([0, 128, 255])).digest('base64url') + '=';
const scope = { accountId: 'member', boardId: 'board', generation: 1, recoveryEpoch: '11111111-1111-4111-8111-111111111111' };
const descriptor = { summary: { id: 'board', accountId: 'member', role: 'owner' }, rootDocId: 'root', contentDocId: 'content', capabilities: ['write'], recoveryEpoch: scope.recoveryEpoch } as BoardDescriptor;

it('@04-03-01 captures immutable versioned epoch and tab identity', async () => {
  const db = storage(); const journal = new AccountJournal(scope, vi.fn());
  const data = new Uint8Array([0, 0]); const first = journal.capture('document', 'content', data); data[0] = 255;
  await first; await journal.capture('document', 'content', new Uint8Array([0, 0]));
  const records = [...db.rows.values()];
  expect(records[0]).toMatchObject({ schemaVersion: 2, epoch: scope.recoveryEpoch, data: new Uint8Array([0, 0]) });
  expect(records[0]).toHaveProperty('tabId'); expect(records[1]!.sequence).toBeGreaterThan(records[0]!.sequence);
});

it('@04-03-01 captures local updates independently and skips hydration and replay origins', async () => {
  const db = storage(); const journal = new AccountJournal(scope, vi.fn());
  const root = new Y.Doc({ guid: 'root' }); const content = new Y.Doc({ guid: 'content' });
  const capture = attachLocalCapture({ journal, root, content, title: 'Synthetic baseline' }); await capture.ready;
  content.getText('canary').insert(0, 'local');
  root.transact(() => root.getMap('meta').set('remote', true), RECOVERY_REPLAY_ORIGIN);
  const remote = new Y.Doc(); remote.getText('remote').insert(0, 'hydrated'); Y.applyUpdate(content, Y.encodeStateAsUpdate(remote), 'load');
  await capture.preserve(); expect(db.rows.size).toBe(1);
  const checkpoint = await readCheckpoint(scope, journal.tabId); expect(checkpoint?.title).toBe('Synthetic baseline');
  const rebuilt = new Y.Doc(); Y.applyUpdate(rebuilt, checkpoint!.content.data);
  for (const record of db.rows.values()) Y.applyUpdate(rebuilt, record.data as Uint8Array);
  expect(rebuilt.getText('canary').toString()).toBe('local'); expect(rebuilt.getText('remote').toString()).toBe('');
  capture.dispose(); content.getText('canary').insert(0, 'after dispose'); await capture.preserve(); expect(db.rows.size).toBe(1);
  [root, content, remote, rebuilt].forEach(doc => doc.destroy());
});

it('@04-03-02 late exact acknowledgment advances the baseline and retains newer edits', async () => {
  const db = storage(); const journal = new AccountJournal(scope, vi.fn());
  const root = new Y.Doc({ guid: 'root' }); const content = new Y.Doc({ guid: 'content' });
  const capture = attachLocalCapture({ journal, root, content, title: 'Synthetic late acknowledgment' }); await capture.ready;
  content.getText('canary').insert(0, 'first'); await capture.preserve();
  const submission = await journal.captureSubmission('content', Y.encodeStateAsUpdate(content));
  content.getText('canary').insert(5, ' second'); await capture.preserve();
  const later = [...db.rows.values()].find(row => !submission.ids.includes(row.id))!;
  await journal.acknowledge(submission.ids); await journal.acknowledge(submission.ids);
  expect([...db.rows.keys()]).toEqual([later.id]);
  await acknowledgeRecords({ ...scope, accountId: 'another-account' }, [later.id]); expect(db.rows.has(later.id)).toBe(true);
  const checkpoint = await readCheckpoint(scope, journal.tabId); const restored = new Y.Doc(); Y.applyUpdate(restored, checkpoint!.content.data);
  expect(restored.getText('canary').toString()).toBe('first'); Y.applyUpdate(restored, later.data as Uint8Array);
  expect(restored.getText('canary').toString()).toBe('first second');
  capture.dispose(); [root, content, restored].forEach(doc => doc.destroy());
});

it('@04-03-02 compaction replaces exact own inputs while other-tab and newer rows survive', async () => {
  const foreign: JournalRecord = { ...scope, schemaVersion: 2, epoch: scope.recoveryEpoch, tabId: 'other-tab', coveredIds: [], id: 'other-record', sequence: 1, kind: 'document', resource: 'content', data: new Uint8Array([0, 0]) };
  const db = storage([foreign]); const journal = new AccountJournal(scope, vi.fn());
  const first = await journal.captureUpdate('content', new Uint8Array([0, 0])); const second = await journal.captureUpdate('content', new Uint8Array([0, 0]));
  const compacted = await journal.compact([first, second, foreign.id]);
  const later = await journal.captureUpdate('content', new Uint8Array([0, 0]));
  await journal.acknowledge([first, second]);
  expect([...db.rows.keys()].sort()).toEqual([compacted, later, foreign.id].sort());
});

it('@04-03-02 submission coverage includes a later synchronous capture listener', async () => {
  const db = storage(); const journal = new AccountJournal(scope, vi.fn());
  const root = new Y.Doc({ guid: 'root' }); const content = new Y.Doc({ guid: 'content' });
  let submission!: ReturnType<AccountJournal['captureSubmission']>;
  content.on('update', data => { submission = journal.captureSubmission('content', data); });
  const capture = attachLocalCapture({ journal, root, content, title: 'Synthetic event order' }); await capture.ready;
  content.getText('canary').insert(0, 'captured');
  const receipt = await submission; await capture.preserve();
  expect(receipt.ids).toHaveLength(2);
  await journal.acknowledge(receipt.ids); expect(db.rows.size).toBe(0);
  capture.dispose(); root.destroy(); content.destroy();
});

it('@04-03-02 garbage-collected submissions cover the original captured operations', async () => {
  const db = storage(); const journal = new AccountJournal(scope, vi.fn());
  const root = new Y.Doc({ guid: 'root' }); const content = new Y.Doc({ guid: 'content' });
  const capture = attachLocalCapture({ journal, root, content, title: 'Synthetic deleted content' }); await capture.ready;
  content.getMap('values').set('key', new Y.Text('original'));
  content.getMap('values').delete('key'); await capture.preserve();
  const receipt = await journal.captureSubmission('content', Y.encodeStateAsUpdate(content));
  expect(receipt.ids).toHaveLength(3);
  await journal.acknowledge(receipt.ids); expect(db.rows.size).toBe(0);
  capture.dispose(); root.destroy(); content.destroy();
});

it('@04-03-02 storage persistence denial and estimates remain advisory', async () => {
  vi.stubGlobal('navigator', { storage: { persist: async () => false, estimate: async () => { throw new Error('unavailable'); } } });
  await expect(requestRecoveryStorage()).resolves.toEqual({ persistent: false, usage: undefined, quota: undefined });
});

it('persists file bytes and MIME before reporting success and retries the same record after storage failure', async () => {
  const db = storage(); const failure = vi.fn(); const journal = new AccountJournal(scope, failure);
  const bytes = new Uint8Array([0, 128, 255]); const blob = new Blob([bytes], { type: 'image/png' });
  db.fail(true); await expect(journal.capture('blob', imageKey, blob)).rejects.toThrow('Storage unavailable');
  expect(failure).toHaveBeenCalledOnce(); expect(db.rows.size).toBe(0);
  db.fail(false); await journal.preserve();
  expect(db.rows.size).toBe(1); const record = [...db.rows.values()][0]!;
  expect(record).toMatchObject({ ...scope, kind: 'blob', resource: imageKey, mime: 'image/png', data: bytes });
  await journal.preserve(); expect([...db.rows.values()]).toEqual([record]);
});

for (const legacy of [false, true]) it(`replays ${legacy ? 'legacy Blob' : 'byte'} records with exact MIME and only removes acknowledged rows`, async () => {
  const bytes = new Uint8Array([1, 2, 255]);
  const record: JournalRecord = { ...scope, schemaVersion: 2, epoch: scope.recoveryEpoch, tabId: 'synthetic-tab', coveredIds: [], id: 'pending', sequence: 1, kind: 'blob', resource: imageKey,
    data: legacy ? new Blob([bytes], { type: 'image/png' }) : bytes, ...(legacy ? {} : { mime: 'image/png' }) };
  const db = storage([record]); let acknowledge = false;
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
    expect(new Headers(init.headers).get('Content-Type')).toBe('image/png');
    expect(new Uint8Array(await new Response(init.body).arrayBuffer())).toEqual(bytes);
    return Response.json({ acknowledged: acknowledge, key: imageKey }, { headers: { 'X-Dali-Recovery-Epoch': scope.recoveryEpoch } });
  }));
  await expect(replayJournal(descriptor, 'member', new AbortController().signal)).rejects.toThrow('unconfirmed');
  expect(db.rows.get('pending')).toBe(record);
  acknowledge = true; await expect(replayJournal(descriptor, 'member', new AbortController().signal)).resolves.toBe(true);
  expect(db.rows.size).toBe(0);
});

it('@04-02-02 epoch-less and stale journal records remain intact without network replay', async () => {
  for (const recoveryEpoch of [undefined, '22222222-2222-4222-8222-222222222222']) {
    const record: JournalRecord = { ...scope, recoveryEpoch, id: 'retained', sequence: 1, kind: 'document', resource: 'content', data: new Uint8Array([0]) };
    const db = storage([record]); const request = vi.fn(); vi.stubGlobal('fetch', request);
    await expect(replayJournal(descriptor, 'member', new AbortController().signal)).rejects.toThrow('recovery state');
    expect(request).not.toHaveBeenCalled(); expect(db.rows.get(record.id)).toBe(record);
  }
});


it('@05-06-01 a durable fork intent is isolated and cannot change its frozen payload on retry', async () => {
  const db = storage(); const store = recoveryForkStore(scope, 'tab-a');
  const value: RecoveryForkIntent = { operationId: 'synthetic-fork', snapshotDigest: 'a'.repeat(64), title: 'Local version', candidateIds: ['local-row'], assets: { [imageKey]: { mime: 'image/png', data: new Uint8Array([0, 128, 255]) } },
    snapshot: { type: 'page', meta: { id: 'content', title: 'Local version', createDate: 1, tags: [] }, blocks: { type: 'block', id: 'local-page', flavour: 'affine:page', props: {}, children: [] } } };
  db.fail(true); await expect(store.write(value)).rejects.toThrow(); db.fail(false); expect(await store.read()).toBeUndefined();
  await store.write(value); expect(await recoveryForkStore(scope, 'tab-a').read()).toEqual(value);
  expect(await recoveryForkStore(scope, 'tab-b').read()).toBeUndefined(); expect(await recoveryForkStore({ ...scope, accountId: 'different' }, 'tab-a').read()).toBeUndefined();
  for (const changed of [{ operationId: 'new-operation' }, { title: 'Changed title' }, { snapshot: { ...value.snapshot, meta: { ...value.snapshot.meta, title: 'Changed snapshot' } } }, { assets: { [imageKey]: { mime: 'image/png', data: new Uint8Array([9]) } } }]) {
    await expect(store.write({ ...value, ...changed })).rejects.toThrow(); expect(await store.read()).toEqual(value);
  }
});

it('@05-06-01 resolving a confirmed candidate retains other tabs and rejects newly arrived rows or titles atomically', async () => {
  const db = storage(); const journal = new AccountJournal(scope, () => {}); const doc = new Y.Doc();
  await journal.checkpoint({ root: { docId: 'root', data: Y.encodeStateAsUpdate(doc) }, content: { docId: 'content', data: Y.encodeStateAsUpdate(doc) }, title: 'Original', assets: {} });
  const first = await journal.captureUpdate('content', new Uint8Array([0, 0]));
  const foreign = { ...db.rows.get(first)!, id: 'other-tab-row', tabId: 'other-tab' }; db.rows.set(foreign.id, foreign);
  const own = titleIntentStore(scope, journal.tabId); const other = titleIntentStore(scope, 'other-tab');
  const title = { schemaVersion: 1 as const, accountId: scope.accountId, boardId: scope.boardId, epoch: scope.recoveryEpoch!, operationId: 'original-title', baseRevision: 1, title: 'Local name' };
  await own.write(title); await other.write({ ...title, operationId: 'other-title' });
  const candidate = { scope, tab: journal.tabId, ids: [first], titleOperationId: title.operationId };
  const later = await journal.captureUpdate('content', new Uint8Array([0, 0]));
  await expect(resolveRecoveryCandidate(candidate)).rejects.toThrow('local version changed'); expect(db.rows.size).toBe(3); expect(await own.read()).toMatchObject(title);
  candidate.ids.push(later); await own.write({ ...title, operationId: 'later-title' });
  await expect(resolveRecoveryCandidate(candidate)).rejects.toThrow('local title changed'); expect(db.rows.size).toBe(3); expect(await readCheckpoint(scope, journal.tabId)).toBeTruthy();
  candidate.titleOperationId = 'later-title'; await resolveRecoveryCandidate(candidate);
  expect([...db.rows.values()]).toEqual([foreign]); expect(await own.read()).toBeUndefined(); expect((await other.read())?.operationId).toBe('other-title'); expect(await readCheckpoint(scope, journal.tabId)).toBeUndefined(); doc.destroy();
});
