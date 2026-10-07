import { validDocumentRevisionReceipt, type DocumentRevisionReceipt } from './title-intent';
import type { BoardDescriptor } from '../../boards/BoardLibrary';
import type { DocSnapshot } from '@blocksuite/store';
import { SourceAccessError, RecoveryEpochError, validRecoveryEpoch } from './doc-source';
import * as Y from 'yjs';
import { validTitleIntent, type TitleIntent, type TitleStore } from './title-intent';
import { advanceSharedBaseline, canonicalRecoveryUpdate, validRecoveryAttempt, validRecoveryTitleAttempt, validSharedRecoveryBaseline, type RecoveryAttempt, type RecoveryTitleReceipt, type SharedRecoveryBaseline } from './recovery-baseline';

export type JournalScope = { accountId: string; boardId: string; generation: number; recoveryEpoch?: string };
export type JournalRecord = JournalScope & { id: string; sequence: number; kind: 'document' | 'blob'; resource: string; data: Uint8Array | Blob; mime?: string;
  schemaVersion?: number; epoch?: string; tabId?: string; coveredIds?: string[]; attempt?: RecoveryAttempt; actionId?: string; recoveryActionId?: string };
export type RecoveryCheckpoint = { schemaVersion: 2; accountId: string; boardId: string; epoch: string; tabId: string;
  root: { docId: string; data: Uint8Array }; content: { docId: string; data: Uint8Array }; title: string;
  assets: Record<string, { mime?: string; data?: Uint8Array }>; shared?: SharedRecoveryBaseline };
export type RecoveryCandidate = { scope: JournalScope; tab: string; ids: string[]; titleOperationId?: string };
export type RecoveryForkIntent = {
  operationId: string; snapshotDigest: string; title: string; snapshot: DocSnapshot;
  assets: Record<string, { mime: string; data: Uint8Array }>;
  candidateIds: string[]; titleOperationId?: string;
  prepared?: { descriptor: BoardDescriptor; root: string; content: string; manifest: string[] };
};
export const recoveryDatabaseName = 'dali-account-recovery-v1';
const tabId = (() => {
  const fresh = crypto.randomUUID();
  try {
    if (typeof window === 'undefined') return fresh;
    const key = 'dali-recovery-tab-v2'; const previous = sessionStorage.getItem(key);
    // A new opener can inherit sessionStorage; give that document its own identity.
    const opened = !!window.opener && (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type === 'navigate';
    const id = previous && !opened ? previous : fresh; sessionStorage.setItem(key, id); return id;
  } catch { return fresh; }
})();
const invalidationChannel = 'dali-recovery-invalidation-v2';
function invalidate() {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
  const channel = new BroadcastChannel(invalidationChannel); channel.postMessage({ type: 'changed' }); channel.close();
}
/** Signals carry no account, document or image data. Consumers reauthorize and reread. */
export function subscribeJournalInvalidation(listener: () => void) {
  if (typeof BroadcastChannel === 'undefined') return () => {};
  const channel = new BroadcastChannel(invalidationChannel);
  channel.onmessage = event => { if (event.data?.type === 'changed' && Object.keys(event.data).length === 1) listener(); };
  return () => channel.close();
}
export async function requestRecoveryStorage() {
  const storage = globalThis.navigator?.storage;
  const persistent = await storage?.persist?.().catch(() => false) ?? false;
  const estimate = await storage?.estimate?.().catch(() => undefined);
  return { persistent, usage: estimate?.usage, quota: estimate?.quota };
}
export class RecoveryStorageError extends Error {
  constructor(readonly code: 'BLOCKED' | 'CORRUPT' | 'LEGACY' | 'FAILED') { super('Recovery storage ' + code.toLowerCase()); this.name = 'RecoveryStorageError'; }
}
const bounded = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 256;
const scopeKey = (scope: JournalScope) => JSON.stringify([scope.accountId, scope.boardId, scope.recoveryEpoch]);
const checkpointId = (scope: JournalScope, tab: string = tabId) => JSON.stringify([scope.accountId, scope.boardId, scope.recoveryEpoch, tab]);
function assertScope(scope: JournalScope) {
  if (!bounded(scope.accountId) || !bounded(scope.boardId) || !validRecoveryEpoch(scope.recoveryEpoch) || !Number.isSafeInteger(scope.generation) || scope.generation < 0) throw new RecoveryStorageError('CORRUPT');
}
export function validRecord(record: JournalRecord): boolean {
  if (record.actionId !== undefined && !bounded(record.actionId)) return false;
  if (record.recoveryActionId !== undefined && (!bounded(record.recoveryActionId) || record.kind !== 'document' || !record.attempt)) return false;
  if (record.attempt !== undefined && (record.kind !== 'document' || !validRecoveryAttempt(record.attempt))) return false;
  if (record.schemaVersion !== 2 || !validRecoveryEpoch(record.epoch) || record.epoch !== record.recoveryEpoch || !bounded(record.id) || !bounded(record.tabId) || !bounded(record.accountId) || !bounded(record.boardId) || !bounded(record.resource) || !Number.isSafeInteger(record.sequence) || record.sequence < 1 || !Array.isArray(record.coveredIds) || record.coveredIds.length > 10000 || !record.coveredIds.every(bounded)) return false;
  if (!(record.data instanceof Uint8Array || record.data instanceof Blob)) return false;
  const size = record.data instanceof Blob ? record.data.size : record.data.byteLength;
  if (!size || size > 16 * 1024 * 1024) return false;
  if (record.kind === 'blob') return /^[A-Za-z0-9_-]{43}=?$/.test(record.resource) && ['image/png', 'image/jpeg'].includes(record.data instanceof Blob ? record.data.type : record.mime ?? '');
  if (record.kind !== 'document' || !(record.data instanceof Uint8Array)) return false;
  try { Y.decodeUpdate(record.data); return true; } catch { return false; }
}
function assertCheckpoint(value: RecoveryCheckpoint) {
  if (value.shared !== undefined && (!validSharedRecoveryBaseline(value.shared) || value.shared.epoch !== value.epoch || value.shared.root.docId !== value.root?.docId || value.shared.content.docId !== value.content?.docId)) throw new RecoveryStorageError('CORRUPT');
  if (value.schemaVersion !== 2 || !bounded(value.accountId) || !bounded(value.boardId) || !validRecoveryEpoch(value.epoch) || !bounded(value.tabId) || !bounded(value.root?.docId) || !bounded(value.content?.docId) || value.root.docId === value.content.docId || typeof value.title !== 'string' || value.title.length > 4000 || !value.assets || typeof value.assets !== 'object' || Array.isArray(value.assets) || Object.keys(value.assets).length > 10000) throw new RecoveryStorageError('CORRUPT');
  for (const doc of [value.root, value.content]) {
    if (!(doc.data instanceof Uint8Array) || !doc.data.byteLength || doc.data.byteLength > 8 * 1024 * 1024) throw new RecoveryStorageError('CORRUPT');
    try { Y.decodeUpdate(doc.data); } catch { throw new RecoveryStorageError('CORRUPT'); }
  }
  let total = 0;
  for (const [key, asset] of Object.entries(value.assets)) {
    if (!/^[A-Za-z0-9_-]{43}=?$/.test(key) || !asset || typeof asset !== 'object' || (asset.data !== undefined && (!(asset.data instanceof Uint8Array) || !['image/png', 'image/jpeg'].includes(asset.mime ?? '') || !asset.data.byteLength || asset.data.byteLength > 16 * 1024 * 1024))) throw new RecoveryStorageError('CORRUPT');
    total += asset.data?.byteLength ?? 0;
  }
  if (total > 256 * 1024 * 1024) throw new RecoveryStorageError('CORRUPT');
}
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let failed = false;
    const request = indexedDB.open(recoveryDatabaseName, 2);
    request.onupgradeneeded = () => {
      if (failed) { request.transaction?.abort(); return; }
      const db = request.result;
      // Preserve every existing row verbatim. Missing schema/epoch stays quarantined.
      const journal = db.objectStoreNames.contains('journal') ? request.transaction!.objectStore('journal') : db.createObjectStore('journal', { keyPath: 'id' });
      if (!journal.indexNames.contains('account')) journal.createIndex('account', 'accountId');
      if (!journal.indexNames.contains('board')) journal.createIndex('board', ['accountId', 'boardId']);
      if (!journal.indexNames.contains('scope')) journal.createIndex('scope', ['accountId', 'boardId', 'epoch']);
      const checkpoints = db.createObjectStore('checkpoints', { keyPath: 'id' });
      checkpoints.createIndex('scope', ['accountId', 'boardId', 'epoch']);
      db.createObjectStore('sequences', { keyPath: 'id' });
    };
    request.onsuccess = () => {
      const db = request.result; db.onversionchange = () => db.close();
      if (failed) { db.close(); return; }
      resolve(db);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => { failed = true; reject(new RecoveryStorageError('BLOCKED')); };
  });
}
const transactionFailures = new WeakMap<IDBTransaction, unknown>();
function abortWithFailure(tx: IDBTransaction, error: unknown) {
  transactionFailures.set(tx, error);
  tx.abort();
}
async function transaction<T>(stores: string[], mode: IDBTransactionMode, action: (tx: IDBTransaction, result: (value: T) => void) => void): Promise<T> {
  const db = await database();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(stores, mode, { durability: 'strict' }); let value: T;
      tx.oncomplete = () => { if (mode === 'readwrite') invalidate(); resolve(value); };
      tx.onabort = tx.onerror = () => reject(transactionFailures.get(tx) ?? tx.error ?? new RecoveryStorageError('FAILED'));
      try { action(tx, result => { value = result; }); } catch (error) { tx.abort(); reject(error); }
    });
  } finally { db.close(); }
}
export async function pendingRecords(accountId: string, boardId: string): Promise<JournalRecord[]> {
  if (!bounded(accountId) || !bounded(boardId)) throw new RecoveryStorageError('CORRUPT');
  if (indexedDB.databases && !(await indexedDB.databases()).some(db => db.name === recoveryDatabaseName)) return [];
  return transaction(['journal'], 'readonly', (tx, done) => {
    const request = tx.objectStore('journal').index('board').getAll([accountId, boardId]);
    request.onsuccess = () => done((request.result as JournalRecord[]).sort((a, b) => a.sequence - b.sequence || String(a.id).localeCompare(String(b.id))));
  });
}
export async function inspectPendingScopes(accountId: string) {
  if (!bounded(accountId)) throw new RecoveryStorageError('CORRUPT');
  const records = await transaction<JournalRecord[]>(['journal'], 'readonly', (tx, done) => { const request = tx.objectStore('journal').index('account').getAll(accountId); request.onsuccess = () => done(request.result); });
  const scopes = new Map<string, { accountId: string; boardId: string; epoch?: string; count: number; legacy: boolean; corrupt: boolean }>();
  for (const record of records) {
    const key = JSON.stringify([record.boardId, record.epoch]);
    const scope = scopes.get(key) ?? { accountId, boardId: record.boardId, epoch: record.epoch, count: 0, legacy: false, corrupt: false };
    scope.count++; scope.legacy ||= record.schemaVersion === undefined; scope.corrupt ||= record.schemaVersion !== undefined && !validRecord(record); scopes.set(key, scope);
  }
  const titles = await transaction<(TitleIntent & { id: string })[]>(['sequences'], 'readonly', (tx, done) => { const request = tx.objectStore('sequences').getAll(); request.onsuccess = () => done(request.result); });
  for (const title of titles.filter(row => row.id.startsWith('title:') && row.accountId === accountId)) {
    const key = JSON.stringify([title.boardId, title.epoch]);
    const scope = scopes.get(key) ?? { accountId, boardId: title.boardId, epoch: title.epoch, count: 0, legacy: false, corrupt: false };
    scope.count++; scope.corrupt ||= !validTitleIntent(title); scopes.set(key, scope);
  }
  return [...scopes.values()];
}
/** Metadata shares the existing strict journal database and transactional ID acknowledgment. */
export function titleIntentStore(scope: JournalScope, tab?: string): TitleStore {
  assertScope(scope); if (tab !== undefined && !bounded(tab)) throw new RecoveryStorageError('CORRUPT');
  const id = 'title:' + JSON.stringify([scope.accountId, scope.boardId, scope.recoveryEpoch, ...(tab ? [tab] : [])]);
  return {
    ...(tab ? { tabId: tab } : {}),
    read: () => transaction(['sequences'], 'readonly', (tx, done) => {
      const request = tx.objectStore('sequences').get(id);
      request.onsuccess = () => { const row = request.result; if (row && (!validTitleIntent(row) || row.accountId !== scope.accountId || row.boardId !== scope.boardId || row.epoch !== scope.recoveryEpoch || row.tabId !== tab)) { tx.abort(); return; } done(row); };
    }),
    write: value => transaction(['sequences'], 'readwrite', (tx, done) => {
      if (!validTitleIntent(value) || value.accountId !== scope.accountId || value.boardId !== scope.boardId || value.epoch !== scope.recoveryEpoch) throw new RecoveryStorageError('CORRUPT');
      if (value.tabId !== undefined && value.tabId !== tab) throw new RecoveryStorageError('CORRUPT');
      tx.objectStore('sequences').put({ ...value, ...(tab ? { tabId: tab } : {}), id }); done(undefined);
    }),
    advance: (operationId, previousRevision, revision) => transaction(['sequences'], 'readwrite', (tx, done) => {
      if (!validDocumentRevisionReceipt({ previousRevision, revision })) throw new RecoveryStorageError('CORRUPT');
      const store = tx.objectStore('sequences'); const request = store.get(id);
      request.onsuccess = () => {
        const row = request.result as (TitleIntent & { id: string }) | undefined;
        if (!row || row.operationId !== operationId || row.baseRevision !== previousRevision) { done(undefined); return; }
        if (!validTitleIntent(row) || row.accountId !== scope.accountId || row.boardId !== scope.boardId || row.epoch !== scope.recoveryEpoch || row.tabId !== tab) { tx.abort(); return; }
        const next = { ...row, baseRevision: revision }; store.put(next); done(next);
      };
    }),
    acknowledge: operationId => transaction(['sequences'], 'readwrite', (tx, done) => {
      const store = tx.objectStore('sequences'); const request = store.get(id);
      request.onsuccess = () => { if (request.result?.operationId === operationId) store.delete(id); done(undefined); };
    }),
  };
}
export async function pendingTitleIntents(accountId: string, boardId: string): Promise<TitleIntent[]> {
  if (!bounded(accountId) || !bounded(boardId)) throw new RecoveryStorageError('CORRUPT');
  const prefix = 'title:' + JSON.stringify([accountId, boardId]).slice(0, -1) + ',';
  return transaction(['sequences'], 'readonly', (tx, done) => {
    const request = tx.objectStore('sequences').getAll(IDBKeyRange.bound(prefix, prefix + '\uffff'));
    request.onsuccess = () => done(request.result);
  });
}
/** Commit proof and intent removal together; a newer local title remains pending. */
export async function acknowledgeRecoveredTitle(scope: JournalScope, tab: string, receipt: RecoveryTitleReceipt) {
  assertScope(scope);
  if (!bounded(tab) || !validRecoveryTitleAttempt(receipt) || !Number.isSafeInteger(receipt.revision) || receipt.revision < 1) throw new RecoveryStorageError('CORRUPT');
  const id = 'title:' + JSON.stringify([scope.accountId, scope.boardId, scope.recoveryEpoch, tab]);
  return transaction<void>(['checkpoints', 'sequences'], 'readwrite', (tx, done) => {
    const checkpoints = tx.objectStore('checkpoints'); const request = checkpoints.get(checkpointId(scope, tab));
    request.onsuccess = () => {
      try {
        const checkpoint = request.result as RecoveryCheckpoint | undefined;
        if (!checkpoint) throw new RecoveryStorageError('CORRUPT');
        assertCheckpoint(checkpoint);
        if (!checkpoint.shared || checkpoint.accountId !== scope.accountId || checkpoint.boardId !== scope.boardId || checkpoint.epoch !== scope.recoveryEpoch || checkpoint.tabId !== tab) throw new RecoveryStorageError('CORRUPT');
        const store = tx.objectStore('sequences'); const pending = store.get(id);
        pending.onsuccess = () => {
          try {
            const row = pending.result as TitleIntent | undefined;
            if (row && (!validTitleIntent(row) || row.accountId !== scope.accountId || row.boardId !== scope.boardId || row.epoch !== scope.recoveryEpoch || row.tabId !== tab)) throw new RecoveryStorageError('CORRUPT');
            if (row?.operationId === receipt.operationId) {
              if (row.title !== receipt.title) throw new RecoveryStorageError('CORRUPT');
              store.delete(id);
            }
            if (receipt.revision >= checkpoint.shared!.titleRevision) {
              const value = { ...checkpoint, ...(!row || row.operationId === receipt.operationId ? { title: receipt.title } : {}), shared: { ...checkpoint.shared!, title: receipt.title, titleRevision: receipt.revision, revision: Math.max(checkpoint.shared!.revision, receipt.revision) } };
              assertCheckpoint(value); checkpoints.put({ ...value, id: checkpointId(scope, tab) });
            }
            done(undefined);
          } catch (error) { abortWithFailure(tx, error); }
        };
      } catch (error) { abortWithFailure(tx, error); }
    };
  });
}
type RecoveryPermissionMarker = { id: string; version: string; resolvedTabs: string[] };
/** Permission markers contain no canvas bytes and survive closing a denied tab. */
export async function markRecoveryPermissionLoss(scope: JournalScope) {
  assertScope(scope); const id = 'permission:' + scopeKey(scope);
  return transaction<void>(['sequences'], 'readwrite', (tx, done) => {
    tx.objectStore('sequences').put({ id, version: crypto.randomUUID(), resolvedTabs: [] }); done(undefined);
  });
}
export async function recoveryPermissionConfirmation(scope: JournalScope, tab: string): Promise<string | undefined> {
  assertScope(scope); if (!bounded(tab)) throw new RecoveryStorageError('CORRUPT');
  return transaction(['sequences'], 'readonly', (tx, done) => {
    const request = tx.objectStore('sequences').get('permission:' + scopeKey(scope));
    request.onsuccess = () => {
      const row = request.result as RecoveryPermissionMarker | undefined;
      if (row && (!bounded(row.version) || !Array.isArray(row.resolvedTabs) || !row.resolvedTabs.every(bounded))) { abortWithFailure(tx, new RecoveryStorageError('CORRUPT')); return; }
      done(row && !row.resolvedTabs.includes(tab) ? row.version : undefined);
    };
  });
}
export async function resolveRecoveryPermission(scope: JournalScope, tab: string, version: string) {
  assertScope(scope); if (!bounded(tab) || !bounded(version)) throw new RecoveryStorageError('CORRUPT');
  return transaction<void>(['sequences'], 'readwrite', (tx, done) => {
    const store = tx.objectStore('sequences'); const request = store.get('permission:' + scopeKey(scope));
    request.onsuccess = () => {
      const row = request.result as RecoveryPermissionMarker | undefined;
      if (!row || row.version !== version) { abortWithFailure(tx, Object.assign(new Error('Access changed again'), { code: 'RECOVERY_CHOICE' })); return; }
      if (!Array.isArray(row.resolvedTabs) || !row.resolvedTabs.every(bounded)) { abortWithFailure(tx, new RecoveryStorageError('CORRUPT')); return; }
      store.put({ ...row, resolvedTabs: [...new Set([...row.resolvedTabs, tab])] }); done(undefined);
    };
  });
}
export async function readCheckpoint(scope: JournalScope, tab: string): Promise<RecoveryCheckpoint | undefined> {
  assertScope(scope);
  return transaction(['checkpoints'], 'readonly', (tx, done) => {
    const request = tx.objectStore('checkpoints').get(checkpointId(scope, tab));
    request.onsuccess = () => {
      try {
        if (request.result) {
          assertCheckpoint(request.result);
          if (request.result.accountId !== scope.accountId || request.result.boardId !== scope.boardId || request.result.epoch !== scope.recoveryEpoch || request.result.tabId !== tab) throw new RecoveryStorageError('CORRUPT');
        }
        done(request.result);
      }
      catch (error) { abortWithFailure(tx, error); }
    };
  });
}
function assertForkIntent(value: RecoveryForkIntent, scope: JournalScope) {
  if (!value || !bounded(value.operationId) || !/^[a-f0-9]{64}$/.test(value.snapshotDigest) || typeof value.title !== 'string' || !value.title || value.title.length > 4000 ||
      !value.snapshot?.blocks || !value.snapshot.meta || !Array.isArray(value.candidateIds) || value.candidateIds.length > 10000 || !value.candidateIds.every(bounded) ||
      value.titleOperationId !== undefined && !bounded(value.titleOperationId) || !value.assets || typeof value.assets !== 'object' || Array.isArray(value.assets)) throw new RecoveryStorageError('CORRUPT');
  let total = 0; const keys = Object.keys(value.assets);
  if (keys.length > 10000) throw new RecoveryStorageError('CORRUPT');
  for (const [key, asset] of Object.entries(value.assets)) {
    if (!/^[A-Za-z0-9_-]{43}=$/.test(key) || !asset || !(asset.data instanceof Uint8Array) || !['image/png', 'image/jpeg'].includes(asset.mime) || !asset.data.length || asset.data.length > 16 * 1024 * 1024) throw new RecoveryStorageError('CORRUPT');
    total += asset.data.length;
  }
  if (total > 256 * 1024 * 1024) throw new RecoveryStorageError('CORRUPT');
  if (value.prepared) {
    const { descriptor: d, root, content, manifest } = value.prepared;
    if (!d || d.summary?.accountId !== scope.accountId || d.summary.role !== 'owner' || d.summary.access !== 'private' || d.recoveryEpoch !== scope.recoveryEpoch ||
        !bounded(d.summary.id) || !bounded(d.rootDocId) || !bounded(d.contentDocId) || d.rootDocId === d.contentDocId ||
        typeof root !== 'string' || typeof content !== 'string' || !root || !content || root.length > 12 * 1024 * 1024 || content.length > 12 * 1024 * 1024 ||
        !Array.isArray(manifest) || JSON.stringify([...manifest].sort()) !== JSON.stringify(keys.sort())) throw new RecoveryStorageError('CORRUPT');
  }
}
/** Durable operation and transformed bytes survive transport failure and reload. */
export function recoveryForkStore(scope: JournalScope, tab: string) {
  assertScope(scope); if (!bounded(tab)) throw new RecoveryStorageError('CORRUPT');
  const id = 'fork:' + checkpointId(scope, tab);
  const readRow = (row: { value: RecoveryForkIntent } | undefined) => { if (row) assertForkIntent(row.value, scope); return row?.value; };
  return {
    read: () => transaction<RecoveryForkIntent | undefined>(['sequences'], 'readonly', (tx, done) => {
      const request = tx.objectStore('sequences').get(id);
      request.onsuccess = () => { try { done(readRow(request.result)); } catch (error) { abortWithFailure(tx, error); } };
    }),
    write: (value: RecoveryForkIntent) => transaction<RecoveryForkIntent>(['sequences'], 'readwrite', (tx, done) => {
      assertForkIntent(value, scope); const store = tx.objectStore('sequences'); const request = store.get(id);
      request.onsuccess = () => {
        try {
          const old = readRow(request.result);
          if (old && (old.operationId !== value.operationId || old.snapshotDigest !== value.snapshotDigest || JSON.stringify(old.candidateIds) !== JSON.stringify(value.candidateIds) || old.titleOperationId !== value.titleOperationId || old.prepared && JSON.stringify(old.prepared) !== JSON.stringify(value.prepared))) throw new RecoveryStorageError('CORRUPT');
          if (old && (old.title !== value.title || JSON.stringify(old.snapshot) !== JSON.stringify(value.snapshot) ||
              JSON.stringify(Object.keys(old.assets).sort()) !== JSON.stringify(Object.keys(value.assets).sort()) ||
              Object.entries(old.assets).some(([key, asset]) => asset.mime !== value.assets[key]!.mime || asset.data.length !== value.assets[key]!.data.length || asset.data.some((byte, index) => byte !== value.assets[key]!.data[index])))) throw new RecoveryStorageError('CORRUPT');
          store.put({ id, value: structuredClone(value) }); done(value);
        } catch (error) { abortWithFailure(tx, error); }
      };
    }),
  };
}
/** Resolve only the exact displayed candidate after confirmed copy or hydration.
 * New rows or a newer title in the same tab abort the entire transaction. */
export async function resolveRecoveryCandidate(candidate: RecoveryCandidate) {
  const { scope, tab, ids, titleOperationId } = candidate;
  assertScope(scope); if (!bounded(tab) || ids.length > 10000 || !ids.every(bounded)) throw new RecoveryStorageError('CORRUPT');
  return transaction<void>(['journal', 'checkpoints', 'sequences'], 'readwrite', (tx, done) => {
    const journal = tx.objectStore('journal'); const sequences = tx.objectStore('sequences');
    const records = journal.index('scope').getAll([scope.accountId, scope.boardId, scope.recoveryEpoch!]);
    records.onsuccess = () => {
      const selected = (records.result as JournalRecord[]).filter(row => row.tabId === tab);
      if (selected.some(row => !validRecord(row)) || JSON.stringify(selected.map(row => row.id).sort()) !== JSON.stringify([...ids].sort())) { abortWithFailure(tx, new Error('The local version changed. Review it again.')); return; }
      const titleId = 'title:' + checkpointId(scope, tab); const title = sequences.get(titleId);
      title.onsuccess = () => {
        if (title.result?.operationId !== titleOperationId || title.result && !validTitleIntent(title.result)) { abortWithFailure(tx, new Error('The local title changed. Review it again.')); return; }
        for (const row of selected) journal.delete(row.id);
        sequences.delete(titleId); sequences.delete('fork:' + checkpointId(scope, tab));
        tx.objectStore('checkpoints').delete(checkpointId(scope, tab)); done(undefined);
      };
    };
  });
}
const matchesScope = (record: JournalRecord, scope: JournalScope) => record.accountId === scope.accountId && record.boardId === scope.boardId && record.epoch === scope.recoveryEpoch;
export async function acknowledgeRecords(scope: JournalScope, ids: readonly string[], revision?: number) {
  assertScope(scope); const exact = [...new Set(ids)];
  if (exact.length > 10000 || !exact.every(bounded)) throw new RecoveryStorageError('CORRUPT');
  if (!exact.length) return;
  await transaction(['journal', 'checkpoints'], 'readwrite', (tx, done) => {
    const store = tx.objectStore('journal'); const records: JournalRecord[] = []; let pending = exact.length;
    for (const id of exact) {
      const request = store.get(id);
      request.onsuccess = () => {
        if (request.result && matchesScope(request.result, scope)) records.push(request.result);
        if (--pending) return;
        if (records.some(record => !validRecord(record))) { tx.abort(); return; }
        const tabs = [...new Set(records.map(record => record.tabId!))];
        if (!tabs.length) { done(undefined); return; }
        let baselines = tabs.length;
        for (const tab of tabs) {
          const checkpoints = tx.objectStore('checkpoints'); const cp = checkpoints.get(checkpointId(scope, tab));
          cp.onsuccess = () => {
            try {
              if (cp.result) {
                const value = cp.result as RecoveryCheckpoint; assertCheckpoint(value);
                if (value.accountId !== scope.accountId || value.boardId !== scope.boardId || value.epoch !== scope.recoveryEpoch || value.tabId !== tab) throw new RecoveryStorageError('CORRUPT');
                const updates = new Map<string, Uint8Array[]>();
                for (const record of records.filter(row => row.tabId === tab)) {
                  if (record.kind === 'document') {
                    const doc = [value.root, value.content].find(doc => doc.docId === record.resource);
                    if (!doc || !(record.data instanceof Uint8Array)) throw new RecoveryStorageError('CORRUPT');
                    const pending = updates.get(doc.docId) ?? [doc.data];
                    pending.push(record.data); updates.set(doc.docId, pending);
                  } else if (record.data instanceof Uint8Array) value.assets[record.resource] = { data: record.data, mime: record.mime };
                }
                for (const doc of [value.root, value.content]) {
                  const pending = updates.get(doc.docId); if (pending) doc.data = Y.mergeUpdates(pending);
                }
                if (value.shared) {
                  for (const doc of [value.shared.root, value.shared.content]) {
                    const committed = records.filter(row => row.tabId === tab && row.kind === 'document' && row.resource === doc.docId).map(row => row.data as Uint8Array);
                    if (committed.length) doc.data = canonicalRecoveryUpdate([doc.data, ...committed]);
                  }
                  if (revision !== undefined) {
                    if (!Number.isSafeInteger(revision) || revision < 0) throw new RecoveryStorageError('CORRUPT');
                    value.shared.revision = Math.max(value.shared.revision, revision);
                  }
                }
                assertCheckpoint(value); checkpoints.put({ ...value, id: checkpointId(scope, tab) });
              }
              if (--baselines === 0) { for (const record of records) store.delete(record.id); done(undefined); }
            } catch (error) { abortWithFailure(tx, error); }
          };
        }
      };
    }
  });
}
/** Explicit single-record compatibility wrapper also requires its captured scope. */
export async function acknowledgeRecord(id: string, scope: JournalScope) { await acknowledgeRecords(scope, [id]); }
export async function discardRecords(accountId: string, boardId: string) {
  const ids = (await pendingRecords(accountId, boardId)).map(record => record.id);
  const titles = await pendingTitleIntents(accountId, boardId);
  // Explicit authorized discard also covers quarantined rows, without trusting epochs.
  await transaction(['journal', 'sequences'], 'readwrite', (tx, done) => {
    for (const title of titles) {
      const store = tx.objectStore('sequences'); const id = 'title:' + JSON.stringify([accountId, boardId, title.epoch, ...(title.tabId ? [title.tabId] : [])]);
      const request = store.get(id); request.onsuccess = () => { if (request.result?.operationId === title.operationId) store.delete(id); };
    }
    for (const id of ids) {
      const store = tx.objectStore('journal'); const request = store.get(id);
      request.onsuccess = () => { if (request.result?.accountId === accountId && request.result?.boardId === boardId) store.delete(id); };
    }
    done(undefined);
  });
}
async function persistRecord(record: JournalRecord) {
  // Some engines cannot persist file-backed Blobs. Copy their bytes before
  // opening the transaction; retain the original in memory if copying fails.
  const stored = record.data instanceof Blob
    ? { ...record, data: new Uint8Array(await record.data.arrayBuffer()), mime: record.data.type }
    : record;
  return transaction<string>(['journal', 'sequences'], 'readwrite', (tx, done) => {
    const journal = tx.objectStore('journal'); const existing = journal.get(record.id);
    existing.onsuccess = () => {
      if (existing.result) {
        if (!validRecord(existing.result) || !matchesScope(existing.result, record)) { tx.abort(); return; }
        record.sequence = existing.result.sequence; done(record.id); return;
      }
      const sequences = tx.objectStore('sequences'); const id = scopeKey(record); const request = sequences.get(id);
      request.onsuccess = () => {
        try {
          const sequence = (request.result?.sequence ?? 0) + 1;
          if (!Number.isSafeInteger(sequence)) throw new RecoveryStorageError('CORRUPT');
          stored.sequence = sequence; record.sequence = sequence;
          if (!validRecord(stored)) throw new RecoveryStorageError('CORRUPT');
          sequences.put({ id, sequence }); journal.put(stored); done(record.id);
        } catch (error) { abortWithFailure(tx, error); }
      };
    };
  });
}
/** A retry's exact bytes and identity survive reload before any network send. */
export async function preserveRecoverySubmission(scope: JournalScope, tab: string, records: readonly JournalRecord[], data: Uint8Array, attempt: RecoveryAttempt, recoveryActionId?: string) {
  assertScope(scope);
  if (!records.length || records.length > 10000 || !bounded(tab) || !validRecoveryAttempt(attempt) || recoveryActionId !== undefined && !bounded(recoveryActionId) || records.some(row => !validRecord(row) || !matchesScope(row, scope) || row.tabId !== tab || row.kind !== 'document' || row.resource !== records[0]!.resource || row.actionId !== records[0]!.actionId)) throw new RecoveryStorageError('CORRUPT');
  const record: JournalRecord = { ...scope, schemaVersion: 2, epoch: scope.recoveryEpoch, tabId: tab, id: crypto.randomUUID(), sequence: 0, kind: 'document', resource: records[0]!.resource,
    data: new Uint8Array(data), attempt: { ...attempt }, coveredIds: records.map(row => row.id), ...(records[0]!.actionId ? { actionId: records[0]!.actionId } : {}), ...(recoveryActionId ? { recoveryActionId } : {}) };
  await persistRecord(record);
  return record;
}
/** Failed captures remain in memory until a successful explicit preservation retry. */
export class AccountJournal {
  private memory = new Map<string, JournalRecord>();
  private owned = new Map<string, JournalRecord>();
  private assets = new Map<string, { mime: string; data: Uint8Array }>();
  private writes = new Set<Promise<unknown>>();
  private baseline?: RecoveryCheckpoint;
  private baselinePending = false;
  constructor(readonly scope: JournalScope, private onFailure: (error: unknown) => void) { assertScope(scope); this.scope = Object.freeze({ ...scope }); }
  get tabId() { return tabId; }
  pendingMemory() { return [...this.memory.values()].map(record => structuredClone(record)); }
  captureUpdate(resource: string, data: Uint8Array, actionId?: string) { return this.capture('document', resource, data, [], undefined, actionId); }
  async captureSubmission(resource: string, data: Uint8Array, attempt?: RecoveryAttempt, actionId?: string) {
    const update = new Uint8Array(data);
    // Native sync may observe a Yjs event before the independent listener.
    // Let all synchronous listeners capture it before freezing exact coverage.
    await Promise.resolve();
    const checkpoint = await readCheckpoint(this.scope, tabId);
    const confirmed = checkpoint && [checkpoint.root, checkpoint.content].find(doc => doc.docId === resource);
    const candidate = new Y.Doc();
    let covered: string[];
    try {
      // Native sync may split one captured transaction or garbage-collect its
      // deleted items. Compare operation clocks and deletes, not encoded bytes.
      if (confirmed) Y.applyUpdate(candidate, confirmed.data);
      Y.applyUpdate(candidate, update);
      const snapshot = Y.snapshot(candidate);
      covered = [...this.owned.values()].filter(record => record.kind === 'document' && record.resource === resource && record.data instanceof Uint8Array && Y.snapshotContainsUpdate(snapshot, record.data)).map(record => record.id);
    } finally { candidate.destroy(); }
    const id = await this.capture('document', resource, update, covered, attempt, actionId);
    await this.preserve();
    return Object.freeze({ scope: this.scope, ids: Object.freeze([id, ...covered]) });
  }
  async acknowledge(ids: readonly string[], revision?: number) {
    await acknowledgeRecords(this.scope, ids, revision);
    for (const id of ids) { this.owned.delete(id); this.memory.delete(id); }
  }
  async compact(ids: readonly string[]): Promise<string | undefined> {
    const exact = [...new Set(ids)]; if (!exact.length) return;
    if (exact.length > 10000 || !exact.every(bounded)) throw new RecoveryStorageError('CORRUPT');
    const result = await transaction<{ record: JournalRecord; removed: string[] } | undefined>(['journal', 'sequences'], 'readwrite', (tx, done) => {
      const store = tx.objectStore('journal'); const records: JournalRecord[] = []; let pending = exact.length;
      for (const id of exact) {
        const request = store.get(id);
        request.onsuccess = () => {
          const record = request.result as JournalRecord | undefined;
          if (record && matchesScope(record, this.scope) && record.tabId === tabId) records.push(record);
          if (--pending) return;
          if (!records.length) { done(undefined); return; }
          // Exact uncertain transport attempts must remain separately provable.
          if (records.some(record => !validRecord(record) || record.kind !== 'document' || record.attempt || record.resource !== records[0]!.resource)) { tx.abort(); return; }
          const sequences = tx.objectStore('sequences'); const key = scopeKey(this.scope); const sequence = sequences.get(key);
          sequence.onsuccess = () => {
            try {
              const next: JournalRecord = { ...records[0]!, id: crypto.randomUUID(), sequence: (sequence.result?.sequence ?? 0) + 1, data: Y.mergeUpdates(records.map(record => record.data as Uint8Array)), coveredIds: records.map(record => record.id) };
              if (!validRecord(next)) throw new RecoveryStorageError('CORRUPT');
              sequences.put({ id: key, sequence: next.sequence }); store.put(next);
              for (const record of records) store.delete(record.id);
              done({ record: next, removed: next.coveredIds! });
            } catch (error) { abortWithFailure(tx, error); }
          };
        };
      }
    });
    if (!result) return;
    for (const id of result.removed) this.owned.delete(id);
    this.owned.set(result.record.id, result.record); return result.record.id;
  }
  async cacheAsset(key: string, blob: Blob) {
    // Retain a private copy before asynchronous validation or storage admission.
    const asset = { mime: blob.type, data: new Uint8Array(await blob.arrayBuffer()) };
    const hash = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256', asset.data)))).replace(/\+/g, '-').replace(/\//g, '_');
    if (hash !== key || !['image/png', 'image/jpeg'].includes(asset.mime) || !asset.data.length || asset.data.length > 16 * 1024 * 1024) throw new RecoveryStorageError('CORRUPT');
    this.assets.set(key, asset);
    if (!this.baseline) return;
    const write = this.persistAsset(key, asset); this.writes.add(write);
    try { await write; if (this.assets.get(key) === asset) this.assets.delete(key); }
    catch (error) { this.onFailure(error); throw error; } finally { this.writes.delete(write); }
  }
  private persistAsset(key: string, asset: { mime: string; data: Uint8Array }) {
    return transaction(['checkpoints'], 'readwrite', (tx, done) => {
      const store = tx.objectStore('checkpoints'); const request = store.get(checkpointId(this.scope));
      request.onsuccess = () => {
        try {
          const value = request.result ?? this.baseline; if (!value) throw new RecoveryStorageError('FAILED');
          assertCheckpoint(value);
          if (value.accountId !== this.scope.accountId || value.boardId !== this.scope.boardId || value.epoch !== this.scope.recoveryEpoch || value.tabId !== tabId) throw new RecoveryStorageError('CORRUPT');
          value.assets[key] = asset; assertCheckpoint(value);
          store.put({ ...value, id: checkpointId(this.scope) }); done(undefined);
        } catch (error) { abortWithFailure(tx, error); }
      };
    });
  }
  async checkpoint(value: Pick<RecoveryCheckpoint, 'root' | 'content' | 'title' | 'assets'>) {
    const baseline: RecoveryCheckpoint = { ...structuredClone(value), schemaVersion: 2, accountId: this.scope.accountId, boardId: this.scope.boardId, epoch: this.scope.recoveryEpoch!, tabId };
    for (const [key, asset] of this.assets) baseline.assets[key] = asset;
    assertCheckpoint(baseline); this.baseline = baseline; this.baselinePending = true;
    const write = this.persistCheckpoint(baseline); this.writes.add(write);
    try { await write; if (this.baseline === baseline) this.baselinePending = false; }
    catch (error) { this.onFailure(error); throw error; } finally { this.writes.delete(write); }
  }
  private persistCheckpoint(value: RecoveryCheckpoint) {
    return transaction(['checkpoints'], 'readwrite', (tx, done) => {
      const store = tx.objectStore('checkpoints'); const request = store.get(checkpointId(this.scope));
      request.onsuccess = () => {
        try {
          if (request.result) {
            assertCheckpoint(request.result);
            if (request.result.accountId !== this.scope.accountId || request.result.boardId !== this.scope.boardId || request.result.epoch !== this.scope.recoveryEpoch || request.result.tabId !== tabId) throw new RecoveryStorageError('CORRUPT');
          }
          const assets = { ...request.result?.assets };
          for (const [key, asset] of Object.entries(value.assets)) assets[key] = asset.data ? asset : assets[key] ?? asset;
          const merged = { ...value, assets, id: checkpointId(this.scope) };
          assertCheckpoint(merged); store.put(merged); done(undefined);
        } catch (error) { abortWithFailure(tx, error); }
      };
    });
  }
  async capture(kind: JournalRecord['kind'], resource: string, data: Uint8Array | Blob, coveredIds: string[] = [], attempt?: RecoveryAttempt, actionId?: string): Promise<string> {
    const record: JournalRecord = { ...this.scope, schemaVersion: 2, epoch: this.scope.recoveryEpoch, tabId, coveredIds: [...coveredIds], ...(attempt ? { attempt: { ...attempt } } : {}), ...(actionId ? { actionId } : {}), id: crypto.randomUUID(), sequence: 0, kind, resource,
      data: data instanceof Uint8Array ? new Uint8Array(data) : data };
    this.memory.set(record.id, record); this.owned.set(record.id, record);
    const write = (async () => { if (kind === 'blob' && data instanceof Blob) await this.cacheAsset(resource, data); await persistRecord(record); })(); this.writes.add(write);
    try { await write; this.memory.delete(record.id); return record.id; }
    catch (error) { this.onFailure(error); throw error; }
    finally { this.writes.delete(write); }
  }
  async preserve() {
    await Promise.allSettled([...this.writes]);
    if (this.baselinePending && this.baseline) { await this.persistCheckpoint(this.baseline); this.baselinePending = false; }
    if (this.baseline) for (const [key, asset] of this.assets) { await this.persistAsset(key, asset); if (this.assets.get(key) === asset) this.assets.delete(key); }
    for (const record of this.memory.values()) {
      await persistRecord(record); this.memory.delete(record.id);
    }
  }
  /** Advance only committed evidence and already received remote content. */
  async observeShared(observed: SharedRecoveryBaseline) {
    if (!validSharedRecoveryBaseline(observed) || observed.epoch !== this.scope.recoveryEpoch) throw new RecoveryStorageError('CORRUPT');
    return this.updateShared(value => advanceSharedBaseline(value, observed));
  }
  async acknowledgeSharedUpdate(resource: string, data: Uint8Array, revision: number) {
    return this.updateShared(value => {
      if (!value) return undefined; // Legacy checkpoints remain conservative.
      const key = resource === value.root.docId ? 'root' : resource === value.content.docId ? 'content' : undefined;
      if (!key || !Number.isSafeInteger(revision) || revision < 0) throw new RecoveryStorageError('CORRUPT');
      return { ...value, revision: Math.max(revision, value.revision), [key]: { docId: resource, data: canonicalRecoveryUpdate([value[key].data, data]) } };
    });
  }
  private async updateShared(update: (previous?: SharedRecoveryBaseline) => SharedRecoveryBaseline | undefined) {
    const write = transaction<void>(['checkpoints'], 'readwrite', (tx, done) => {
      const store = tx.objectStore('checkpoints'); const request = store.get(checkpointId(this.scope));
      request.onsuccess = () => {
        try {
          const value = request.result as RecoveryCheckpoint | undefined;
          if (!value) throw new RecoveryStorageError('FAILED');
          assertCheckpoint(value);
          if (value.accountId !== this.scope.accountId || value.boardId !== this.scope.boardId || value.epoch !== this.scope.recoveryEpoch || value.tabId !== tabId) throw new RecoveryStorageError('CORRUPT');
          const shared = update(value.shared);
          if (shared) {
            value.shared = shared;
            value.root.data = canonicalRecoveryUpdate([value.root.data, shared.root.data]);
            value.content.data = canonicalRecoveryUpdate([value.content.data, shared.content.data]);
            assertCheckpoint(value); store.put({ ...value, id: checkpointId(this.scope) });
          }
          done(undefined);
        } catch (error) { abortWithFailure(tx, error); }
      };
    });
    this.writes.add(write);
    try { await write; } catch (error) { this.onFailure(error); throw error; } finally { this.writes.delete(write); }
  }
}
/** Fresh descriptor and expected identity precede every replay; Yjs/hash keys are idempotent. */
export type ReplayObserver = (record: JournalRecord, outcome: 'sending' | 'acknowledged' | 'failed', attempt: string) => void | Promise<void>;
// Bound merge work and acknowledgment transactions independently of backlog size.
// Individual existing updates may use the server's full 8 MiB document limit.
const REPLAY_BATCH_RECORDS = 256;
const REPLAY_BATCH_BYTES = 1024 * 1024;
const REPLAY_DOCUMENT_BYTES = 8 * 1024 * 1024;
function replayBatches(records: JournalRecord[]): JournalRecord[][] {
  const batches = records.filter(record => record.kind === 'blob').map(record => [record]);
  const documents = new Map<string, JournalRecord[]>();
  for (const record of records.filter(record => record.kind === 'document')) {
    const key = JSON.stringify([record.accountId, record.boardId, record.epoch, record.resource]);
    const group = documents.get(key) ?? []; group.push(record); documents.set(key, group);
  }
  for (const group of documents.values()) {
    let batch: JournalRecord[] = []; let bytes = 0;
    for (const record of group) {
      const size = (record.data as Uint8Array).byteLength;
      if (size > REPLAY_DOCUMENT_BYTES) throw new RecoveryStorageError('CORRUPT');
      if (batch.length && (batch.length >= REPLAY_BATCH_RECORDS || bytes + size > REPLAY_BATCH_BYTES)) {
        batches.push(batch); batch = []; bytes = 0;
      }
      batch.push(record); bytes += size;
    }
    if (batch.length) batches.push(batch);
  }
  return batches;
}
export async function replayJournal(descriptor: BoardDescriptor, accountId: string, signal: AbortSignal, blobsOnly = false, currentEpochOnly = false, observer?: ReplayObserver, onDocumentCommit?: (receipt: DocumentRevisionReceipt) => Promise<void>): Promise<boolean> {
  if (descriptor.summary.accountId !== accountId) throw new SourceAccessError(409);
  const records = (await pendingRecords(accountId, descriptor.summary.id)).filter(record => (!blobsOnly || record.kind === 'blob') && (!currentEpochOnly || record.epoch === descriptor.recoveryEpoch));
  if (!records.length) return false;
  if (descriptor.summary.role === 'viewer' || !descriptor.capabilities.includes('write')) throw new SourceAccessError(403);
  const epoch = descriptor.recoveryEpoch;
  if (!validRecoveryEpoch(epoch) || records.some(record => record.epoch !== epoch)) throw new RecoveryEpochError('RECOVERY_EPOCH_MISMATCH');
  if (records.some(record => !validRecord(record) || record.accountId !== accountId || record.boardId !== descriptor.summary.id)) throw new RecoveryStorageError('CORRUPT');
  for (const batch of replayBatches(records)) {
    const record = batch[0]!;
    const attempts = batch.map(row => ({ record: row, id: crypto.randomUUID() }));
    for (const attempt of attempts) await observer?.(attempt.record, 'sending', attempt.id);
    try {
    if (signal.aborted) throw new Error('Recovery interrupted');
    if (record.kind === 'document' && ![descriptor.rootDocId, descriptor.contentDocId].includes(record.resource)) throw new Error('Recovery document unavailable');
    const data = record.kind === 'document' && batch.length > 1 ? Y.mergeUpdates(batch.map(row => row.data as Uint8Array)) : record.data;
    if (record.kind === 'document' && (data as Uint8Array).byteLength > REPLAY_DOCUMENT_BYTES) throw new RecoveryStorageError('CORRUPT');
    const base = `/api/boards/${encodeURIComponent(descriptor.summary.id)}`;
    const response = await fetch(record.kind === 'blob' ? `${base}/blobs/${encodeURIComponent(record.resource)}` : `${base}/docs/${encodeURIComponent(record.resource)}/push`, {
      method: record.kind === 'blob' ? 'PUT' : 'POST', credentials: 'same-origin', cache: 'no-store', signal,
      headers: { 'X-Dali-Account': accountId, 'X-Dali-Request': '1', 'X-Dali-Recovery-Epoch': epoch, 'Content-Type': record.data instanceof Blob ? record.data.type : record.kind === 'blob' ? record.mime || 'application/octet-stream' : 'application/octet-stream' },
      body: data instanceof Blob ? data : new Uint8Array(data),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { code?: string };
      if (body.code === 'RECOVERY_EPOCH_REQUIRED' || body.code === 'RECOVERY_EPOCH_MISMATCH') throw new RecoveryEpochError(body.code);
      throw [401, 403, 404].includes(response.status) || (response.status === 409 && body.code === 'IDENTITY_CHANGED') ? new SourceAccessError(response.status) : new Error('Pending changes could not be applied. Try again.');
    }
    const result: unknown = await response.json();
    if (signal.aborted) throw new Error('Recovery interrupted');
    if (descriptor.recoveryEpoch !== epoch || response.headers.get('X-Dali-Recovery-Epoch') !== epoch) throw new RecoveryEpochError('RECOVERY_EPOCH_MISMATCH');
    if (!result || typeof result !== 'object' || !('acknowledged' in result) || result.acknowledged !== true ||
      (record.kind === 'blob' && (!('key' in result) || result.key !== record.resource))) throw new Error('Recovery commit unconfirmed');
    // Persist dependent title revision proof before deleting replayable bytes.
    if (record.kind === 'document' && validDocumentRevisionReceipt(result)) await onDocumentCommit?.(result);
    await acknowledgeRecords({ accountId, boardId: descriptor.summary.id, recoveryEpoch: epoch, generation: record.generation }, batch.map(row => row.id));
    for (const attempt of attempts) await observer?.(attempt.record, 'acknowledged', attempt.id);
    } catch (error) { for (const attempt of attempts) await observer?.(attempt.record, 'failed', attempt.id); throw error; }
  }
  return true;
}
