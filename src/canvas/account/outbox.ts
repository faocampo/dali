import type { BoardDescriptor } from '../../boards/BoardLibrary';
import { SourceAccessError, RecoveryEpochError, validRecoveryEpoch } from './doc-source';
import * as Y from 'yjs';

export type JournalScope = { accountId: string; boardId: string; generation: number; recoveryEpoch?: string };
export type JournalRecord = JournalScope & { id: string; sequence: number; kind: 'document' | 'blob'; resource: string; data: Uint8Array | Blob; mime?: string;
  schemaVersion?: number; epoch?: string; tabId?: string; coveredIds?: string[] };
export type RecoveryCheckpoint = { schemaVersion: 2; accountId: string; boardId: string; epoch: string; tabId: string;
  root: { docId: string; data: Uint8Array }; content: { docId: string; data: Uint8Array }; title: string;
  assets: Record<string, { mime?: string; data?: Uint8Array }> };
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
  if (record.schemaVersion !== 2 || !validRecoveryEpoch(record.epoch) || record.epoch !== record.recoveryEpoch || !bounded(record.id) || !bounded(record.tabId) || !bounded(record.accountId) || !bounded(record.boardId) || !bounded(record.resource) || !Number.isSafeInteger(record.sequence) || record.sequence < 1 || !Array.isArray(record.coveredIds) || record.coveredIds.length > 10000 || !record.coveredIds.every(bounded)) return false;
  if (!(record.data instanceof Uint8Array || record.data instanceof Blob)) return false;
  const size = record.data instanceof Blob ? record.data.size : record.data.byteLength;
  if (!size || size > 16 * 1024 * 1024) return false;
  if (record.kind === 'blob') return /^[A-Za-z0-9_-]{43}=?$/.test(record.resource) && ['image/png', 'image/jpeg'].includes(record.data instanceof Blob ? record.data.type : record.mime ?? '');
  if (record.kind !== 'document' || !(record.data instanceof Uint8Array)) return false;
  try { Y.decodeUpdate(record.data); return true; } catch { return false; }
}
function assertCheckpoint(value: RecoveryCheckpoint) {
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
async function transaction<T>(stores: string[], mode: IDBTransactionMode, action: (tx: IDBTransaction, result: (value: T) => void) => void): Promise<T> {
  const db = await database();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(stores, mode, { durability: 'strict' }); let value: T;
      tx.oncomplete = () => { if (mode === 'readwrite') invalidate(); resolve(value); };
      tx.onabort = tx.onerror = () => reject(tx.error ?? new RecoveryStorageError('FAILED'));
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
  return [...scopes.values()];
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
      catch { tx.abort(); }
    };
  });
}
const matchesScope = (record: JournalRecord, scope: JournalScope) => record.accountId === scope.accountId && record.boardId === scope.boardId && record.epoch === scope.recoveryEpoch;
export async function acknowledgeRecords(scope: JournalScope, ids: readonly string[]) {
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
                for (const record of records.filter(row => row.tabId === tab)) {
                  if (record.kind === 'document') {
                    const doc = [value.root, value.content].find(doc => doc.docId === record.resource);
                    if (!doc || !(record.data instanceof Uint8Array)) throw new RecoveryStorageError('CORRUPT');
                    doc.data = Y.mergeUpdates([doc.data, record.data]);
                  } else if (record.data instanceof Uint8Array) value.assets[record.resource] = { data: record.data, mime: record.mime };
                }
                assertCheckpoint(value); checkpoints.put({ ...value, id: checkpointId(scope, tab) });
              }
              if (--baselines === 0) { for (const record of records) store.delete(record.id); done(undefined); }
            } catch { tx.abort(); }
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
  // Explicit authorized discard also covers quarantined rows, without trusting epochs.
  await transaction(['journal'], 'readwrite', (tx, done) => {
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
        } catch { tx.abort(); }
      };
    };
  });
}
/** Failed captures remain in memory until a successful explicit preservation retry. */
export class AccountJournal {
  private memory = new Map<string, JournalRecord>();
  private owned = new Map<string, JournalRecord>();
  private assets = new Map<string, { mime: string; data: Uint8Array }>();
  private writes = new Set<Promise<unknown>>();
  private baseline?: RecoveryCheckpoint;
  private baselinePending = false;
  constructor(readonly scope: JournalScope, private onFailure: () => void) { assertScope(scope); this.scope = Object.freeze({ ...scope }); }
  get tabId() { return tabId; }
  pendingMemory() { return [...this.memory.values()].map(record => structuredClone(record)); }
  captureUpdate(resource: string, data: Uint8Array) { return this.capture('document', resource, data); }
  async captureSubmission(resource: string, data: Uint8Array) {
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
    const id = await this.capture('document', resource, update, covered);
    await this.preserve();
    return Object.freeze({ scope: this.scope, ids: Object.freeze([id, ...covered]) });
  }
  async acknowledge(ids: readonly string[]) {
    await acknowledgeRecords(this.scope, ids);
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
          if (records.some(record => !validRecord(record) || record.kind !== 'document' || record.resource !== records[0]!.resource)) { tx.abort(); return; }
          const sequences = tx.objectStore('sequences'); const key = scopeKey(this.scope); const sequence = sequences.get(key);
          sequence.onsuccess = () => {
            try {
              const next: JournalRecord = { ...records[0]!, id: crypto.randomUUID(), sequence: (sequence.result?.sequence ?? 0) + 1, data: Y.mergeUpdates(records.map(record => record.data as Uint8Array)), coveredIds: records.map(record => record.id) };
              if (!validRecord(next)) throw new RecoveryStorageError('CORRUPT');
              sequences.put({ id: key, sequence: next.sequence }); store.put(next);
              for (const record of records) store.delete(record.id);
              done({ record: next, removed: next.coveredIds! });
            } catch { tx.abort(); }
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
    catch (error) { this.onFailure(); throw error; } finally { this.writes.delete(write); }
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
        } catch { tx.abort(); }
      };
    });
  }
  async checkpoint(value: Pick<RecoveryCheckpoint, 'root' | 'content' | 'title' | 'assets'>) {
    const baseline: RecoveryCheckpoint = { ...structuredClone(value), schemaVersion: 2, accountId: this.scope.accountId, boardId: this.scope.boardId, epoch: this.scope.recoveryEpoch!, tabId };
    for (const [key, asset] of this.assets) baseline.assets[key] = asset;
    assertCheckpoint(baseline); this.baseline = baseline; this.baselinePending = true;
    const write = this.persistCheckpoint(baseline); this.writes.add(write);
    try { await write; if (this.baseline === baseline) this.baselinePending = false; }
    catch (error) { this.onFailure(); throw error; } finally { this.writes.delete(write); }
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
        } catch { tx.abort(); }
      };
    });
  }
  async capture(kind: JournalRecord['kind'], resource: string, data: Uint8Array | Blob, coveredIds: string[] = []): Promise<string> {
    const record: JournalRecord = { ...this.scope, schemaVersion: 2, epoch: this.scope.recoveryEpoch, tabId, coveredIds: [...coveredIds], id: crypto.randomUUID(), sequence: 0, kind, resource,
      data: data instanceof Uint8Array ? new Uint8Array(data) : data };
    this.memory.set(record.id, record); this.owned.set(record.id, record);
    const write = (async () => { if (kind === 'blob' && data instanceof Blob) await this.cacheAsset(resource, data); await persistRecord(record); })(); this.writes.add(write);
    try { await write; this.memory.delete(record.id); return record.id; }
    catch (error) { this.onFailure(); throw error; }
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
}
/** Fresh descriptor and expected identity precede every replay; Yjs/hash keys are idempotent. */
export async function replayJournal(descriptor: BoardDescriptor, accountId: string, signal: AbortSignal, blobsOnly = false): Promise<boolean> {
  if (descriptor.summary.accountId !== accountId) throw new SourceAccessError(409);
  const records = (await pendingRecords(accountId, descriptor.summary.id)).filter(record => !blobsOnly || record.kind === 'blob');
  if (!records.length) return false;
  if (descriptor.summary.role === 'viewer' || !descriptor.capabilities.includes('write')) throw new SourceAccessError(403);
  const epoch = descriptor.recoveryEpoch;
  if (!validRecoveryEpoch(epoch) || records.some(record => record.epoch !== epoch)) throw new RecoveryEpochError('RECOVERY_EPOCH_MISMATCH');
  if (records.some(record => !validRecord(record))) throw new RecoveryStorageError('CORRUPT');
  const ordered = [...records.filter(r => r.kind === 'blob'), ...records.filter(r => r.kind === 'document')];
  for (const record of ordered) {
    if (signal.aborted) throw new Error('Recovery interrupted');
    if (record.kind === 'document' && ![descriptor.rootDocId, descriptor.contentDocId].includes(record.resource)) throw new Error('Recovery document unavailable');
    const base = `/api/boards/${encodeURIComponent(descriptor.summary.id)}`;
    const response = await fetch(record.kind === 'blob' ? `${base}/blobs/${encodeURIComponent(record.resource)}` : `${base}/docs/${encodeURIComponent(record.resource)}/push`, {
      method: record.kind === 'blob' ? 'PUT' : 'POST', credentials: 'same-origin', cache: 'no-store', signal,
      headers: { 'X-Dali-Account': accountId, 'X-Dali-Request': '1', 'X-Dali-Recovery-Epoch': epoch, 'Content-Type': record.data instanceof Blob ? record.data.type : record.kind === 'blob' ? record.mime || 'application/octet-stream' : 'application/octet-stream' },
      body: record.data instanceof Blob ? record.data : new Uint8Array(record.data),
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
    await acknowledgeRecords({ accountId, boardId: descriptor.summary.id, recoveryEpoch: epoch, generation: record.generation }, [record.id]);
  }
  return true;
}
