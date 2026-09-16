import type { BoardDescriptor } from '../../boards/BoardLibrary';
import { SourceAccessError } from './doc-source';

export type JournalScope = { accountId: string; boardId: string; generation: number };
export type JournalRecord = JournalScope & { id: string; sequence: number; kind: 'document' | 'blob'; resource: string; data: Uint8Array | Blob };
const databaseName = 'dali-account-recovery-v1';
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('journal', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Recovery storage is blocked'));
  });
}
async function transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction('journal', mode, { durability: 'strict' });
      let request: IDBRequest<T>;
      try { request = action(tx.objectStore('journal')); } catch (error) { tx.abort(); reject(error); return; }
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('Recovery storage failed'));
    });
  } finally { db.close(); }
}
export async function pendingRecords(accountId: string, boardId: string): Promise<JournalRecord[]> {
  if (!(await indexedDB.databases()).some(db => db.name === databaseName)) return [];
  const records = await transaction<JournalRecord[]>('readonly', store => store.getAll());
  return records.filter(record => record.accountId === accountId && record.boardId === boardId)
    .sort((a, b) => a.generation - b.generation || a.sequence - b.sequence || a.id.localeCompare(b.id));
}
export async function acknowledgeRecord(id: string) { await transaction('readwrite', store => store.delete(id)); }
export async function discardRecords(accountId: string, boardId: string) {
  for (const record of await pendingRecords(accountId, boardId)) await acknowledgeRecord(record.id);
}
/** Failed captures remain in memory until a successful explicit preservation retry. */
export class AccountJournal {
  private sequence = 0;
  private memory = new Map<string, JournalRecord>();
  private writes = new Set<Promise<unknown>>();
  constructor(readonly scope: JournalScope, private onFailure: () => void) {}
  async capture(kind: JournalRecord['kind'], resource: string, data: Uint8Array | Blob): Promise<string> {
    const record: JournalRecord = { ...this.scope, id: crypto.randomUUID(), sequence: ++this.sequence, kind, resource,
      data: data instanceof Uint8Array ? new Uint8Array(data) : data };
    this.memory.set(record.id, record);
    const write = transaction('readwrite', store => store.put(record)); this.writes.add(write);
    try { await write; this.memory.delete(record.id); return record.id; }
    catch (error) { this.onFailure(); throw error; }
    finally { this.writes.delete(write); }
  }
  async preserve() {
    await Promise.allSettled([...this.writes]);
    for (const record of this.memory.values()) {
      await transaction('readwrite', store => store.put(record)); this.memory.delete(record.id);
    }
  }
}
/** Fresh descriptor and expected identity precede every replay; Yjs/hash keys are idempotent. */
export async function replayJournal(descriptor: BoardDescriptor, accountId: string, signal: AbortSignal, blobsOnly = false): Promise<boolean> {
  if (descriptor.summary.accountId !== accountId) throw new SourceAccessError(409);
  const records = (await pendingRecords(accountId, descriptor.summary.id)).filter(record => !blobsOnly || record.kind === 'blob');
  if (!records.length) return false;
  if (descriptor.summary.role === 'viewer' || !descriptor.capabilities.includes('write')) throw new SourceAccessError(403);
  const ordered = [...records.filter(r => r.kind === 'blob'), ...records.filter(r => r.kind === 'document')];
  for (const record of ordered) {
    if (signal.aborted) throw new Error('Recovery interrupted');
    if (record.kind === 'document' && ![descriptor.rootDocId, descriptor.contentDocId].includes(record.resource)) throw new Error('Recovery document unavailable');
    const base = `/api/boards/${encodeURIComponent(descriptor.summary.id)}`;
    const response = await fetch(record.kind === 'blob' ? `${base}/blobs/${encodeURIComponent(record.resource)}` : `${base}/docs/${encodeURIComponent(record.resource)}/push`, {
      method: record.kind === 'blob' ? 'PUT' : 'POST', credentials: 'same-origin', cache: 'no-store', signal,
      headers: { 'X-Dali-Account': accountId, 'X-Dali-Request': '1', 'Content-Type': record.data instanceof Blob ? record.data.type : 'application/octet-stream' },
      body: record.data instanceof Blob ? record.data : new Uint8Array(record.data),
    });
    if (!response.ok) throw [401, 403, 404, 409].includes(response.status) ? new SourceAccessError(response.status) : new Error('Pending changes could not be applied. Try again.');
    const result: unknown = await response.json();
    if (signal.aborted) throw new Error('Recovery interrupted');
    if (!result || typeof result !== 'object' || !('acknowledged' in result) || result.acknowledged !== true ||
      (record.kind === 'blob' && (!('key' in result) || result.key !== record.resource))) throw new Error('Recovery commit unconfirmed');
    await acknowledgeRecord(record.id);
  }
  return true;
}
