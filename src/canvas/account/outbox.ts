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
const tabId = crypto.randomUUID();
export class RecoveryStorageError extends Error {
  constructor(readonly code: 'BLOCKED' | 'CORRUPT' | 'LEGACY' | 'FAILED') { super('Recovery storage ' + code.toLowerCase()); this.name = 'RecoveryStorageError'; }
}
const bounded = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 256;
const scopeKey = (scope: JournalScope) => JSON.stringify([scope.accountId, scope.boardId, scope.recoveryEpoch]);
const checkpointId = (scope: JournalScope, tab: string = tabId) => JSON.stringify([scope.accountId, scope.boardId, scope.recoveryEpoch, tab]);
function assertScope(scope: JournalScope) {
  if (!bounded(scope.accountId) || !bounded(scope.boardId) || !validRecoveryEpoch(scope.recoveryEpoch) || !Number.isSafeInteger(scope.generation) || scope.generation < 0) throw new RecoveryStorageError('CORRUPT');
}
function validRecord(record: JournalRecord): boolean {
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
      tx.oncomplete = () => resolve(value);
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
export async function acknowledgeRecord(id: string) { await transaction(['journal'], 'readwrite', (tx, done) => { tx.objectStore('journal').delete(id); done(undefined); }); }
export async function discardRecords(accountId: string, boardId: string) {
  for (const record of await pendingRecords(accountId, boardId)) await acknowledgeRecord(record.id);
}
async function persistRecord(record: JournalRecord) {
  // Some engines cannot persist file-backed Blobs. Copy their bytes before
  // opening the transaction; retain the original in memory if copying fails.
  const stored = record.data instanceof Blob
    ? { ...record, data: new Uint8Array(await record.data.arrayBuffer()), mime: record.data.type }
    : record;
  return transaction<string>(['journal', 'sequences'], 'readwrite', (tx, done) => {
    const sequences = tx.objectStore('sequences'); const id = scopeKey(record); const request = sequences.get(id);
    request.onsuccess = () => {
      try {
        const sequence = (request.result?.sequence ?? 0) + 1;
        if (!Number.isSafeInteger(sequence)) throw new RecoveryStorageError('CORRUPT');
        stored.sequence = sequence; record.sequence = sequence;
        if (!validRecord(stored)) throw new RecoveryStorageError('CORRUPT');
        sequences.put({ id, sequence }); tx.objectStore('journal').put(stored); done(record.id);
      } catch { tx.abort(); }
    };
  });
}
/** Failed captures remain in memory until a successful explicit preservation retry. */
export class AccountJournal {
  private memory = new Map<string, JournalRecord>();
  private writes = new Set<Promise<unknown>>();
  private baseline?: RecoveryCheckpoint;
  private baselinePending = false;
  constructor(readonly scope: JournalScope, private onFailure: () => void) { assertScope(scope); this.scope = Object.freeze({ ...scope }); }
  get tabId() { return tabId; }
  pendingMemory() { return [...this.memory.values()].map(record => structuredClone(record)); }
  captureUpdate(resource: string, data: Uint8Array) { return this.capture('document', resource, data); }
  async checkpoint(value: Pick<RecoveryCheckpoint, 'root' | 'content' | 'title' | 'assets'>) {
    const baseline: RecoveryCheckpoint = { ...structuredClone(value), schemaVersion: 2, accountId: this.scope.accountId, boardId: this.scope.boardId, epoch: this.scope.recoveryEpoch!, tabId };
    assertCheckpoint(baseline); this.baseline = baseline; this.baselinePending = true;
    const write = this.persistCheckpoint(baseline); this.writes.add(write);
    try { await write; if (this.baseline === baseline) this.baselinePending = false; }
    catch (error) { this.onFailure(); throw error; } finally { this.writes.delete(write); }
  }
  private persistCheckpoint(value: RecoveryCheckpoint) {
    return transaction(['checkpoints'], 'readwrite', (tx, done) => { tx.objectStore('checkpoints').put({ ...value, id: checkpointId(this.scope) }); done(undefined); });
  }
  async capture(kind: JournalRecord['kind'], resource: string, data: Uint8Array | Blob): Promise<string> {
    const record: JournalRecord = { ...this.scope, schemaVersion: 2, epoch: this.scope.recoveryEpoch, tabId, coveredIds: [], id: crypto.randomUUID(), sequence: 0, kind, resource,
      data: data instanceof Uint8Array ? new Uint8Array(data) : data };
    this.memory.set(record.id, record);
    const write = persistRecord(record); this.writes.add(write);
    try { await write; this.memory.delete(record.id); return record.id; }
    catch (error) { this.onFailure(); throw error; }
    finally { this.writes.delete(write); }
  }
  async preserve() {
    await Promise.allSettled([...this.writes]);
    if (this.baselinePending && this.baseline) { await this.persistCheckpoint(this.baseline); this.baselinePending = false; }
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
    await acknowledgeRecord(record.id);
  }
  return true;
}
