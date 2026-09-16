import * as Y from 'yjs';
import { TestWorkspace } from '@blocksuite/affine/store/test';
import { StoreExtensionManager } from '@blocksuite/affine/ext-loader';
import { storeExtensions } from '../canvas/extensions';
import { validateMindmapDocument } from '../canvas/mindmap-compatibility';
import { createStagingWorkspace } from '../canvas/account/board-workspace';
import { regenerateSurfaceIdentities } from './operations';
import { validSummary, type BoardDescriptor } from './BoardLibrary';
import { getSessionState } from '../auth/session';

export type LocalBoard = { id: string; title: string; updatedAt: number };
type StoredDoc = { id: string; updates: { update: Uint8Array }[] };
const encode = (bytes: Uint8Array) => { let text = ''; for (const byte of bytes) text += String.fromCharCode(byte); return btoa(text); };

/** Inspect only existing legacy databases. Abort any raced creation before it commits. */
async function readExisting<T>(name: string, store: string, key: string): Promise<T | undefined> {
  if (!(await indexedDB.databases()).some(db => db.name === name)) return undefined;
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name);
    request.onupgradeneeded = () => { request.transaction?.abort(); reject(new Error('Local storage changed. Try again.')); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Local storage is unavailable.'));
    request.onblocked = () => reject(new Error('Local storage is blocked.'));
  });
  try {
    if (!db.objectStoreNames.contains(store)) throw new Error('Local storage is unavailable.');
    return await new Promise<T | undefined>((resolve, reject) => {
      const request = db.transaction(store, 'readonly').objectStore(store).get(key);
      request.onsuccess = () => resolve(request.result as T | undefined);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}
async function rootBytes() { return readExisting<StoredDoc>('djai-storyboard', 'collection', 'djai-storyboard'); }
export async function listLocalBoards(): Promise<LocalBoard[]> {
  const stored = await rootBytes(); if (!stored) return [];
  const root = new Y.Doc();
  try {
    stored.updates.forEach(row => Y.applyUpdate(root, row.update));
    const pages = root.getMap('meta').get('pages');
    if (!(pages instanceof Y.Array)) throw new Error('Local board inventory is unavailable.');
    return (pages.toJSON() as { id: string; title: string; createDate: number; updatedDate?: number }[]).map(meta => {
      if (typeof meta.id !== 'string' || typeof meta.title !== 'string') throw new Error('Local board inventory is unavailable.');
      return { id: meta.id, title: meta.title || 'Untitled board', updatedAt: meta.updatedDate ?? meta.createDate };
    });
  } finally { root.destroy(); }
}
async function captureLocal(id: string) {
  const stored = await rootBytes(); const content = await readExisting<StoredDoc>('djai-storyboard', 'collection', id);
  if (!stored || !content) throw new Error('This local board is unavailable.');
  // No persisted sources, start(), metadata initialization, or graceful-stop writes.
  const workspace = new TestWorkspace({ id: 'djai-storyboard' });
  workspace.storeExtensions = new StoreExtensionManager(storeExtensions).get('store');
  try {
    stored.updates.forEach(row => Y.applyUpdate(workspace.doc, row.update));
    const doc = workspace.getDoc(id); if (!doc) throw new Error('This local board is unavailable.');
    content.updates.forEach(row => Y.applyUpdate(doc.spaceDoc, row.update));
    const store = doc.getStore(); store.load(); store.readonly = true;
    validateMindmapDocument(store);
    const reader = store.getTransformer();
    let snapshot;
    try { snapshot = reader.docToSnapshot(store); } finally { reader[Symbol.dispose](); }
    if (!snapshot) throw new Error('This local board could not be read.');
    const keys = new Set<string>();
    doc.spaceDoc.getMap<Y.Map<unknown>>('blocks').forEach(block => {
      if (block.get('sys:flavour') === 'affine:image') { const key = block.get('prop:sourceId'); if (typeof key !== 'string') throw new Error('The image reference is invalid.'); keys.add(key); }
    });
    if (keys.size > 10000 || JSON.stringify(snapshot).length > 8 * 1024 * 1024) throw new Error('This board exceeds the copy limit.');
    const blobs = new Map<string, Blob>(); let total = 0;
    for (const key of keys) {
      const bytes = await readExisting<ArrayBuffer>('djai-storyboard_blob', 'blob', key);
      const mime = await readExisting<string>('djai-storyboard_blob_mime', 'blob_mime', key);
      if (!bytes || !['image/png', 'image/jpeg'].includes(mime ?? '')) throw new Error('A local image is missing. Your original remains in this browser.');
      const hash = encode(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).replace(/\+/g, '-').replace(/\//g, '_');
      if (hash !== key || (total += bytes.byteLength) > 256 * 1024 * 1024) throw new Error('The local images could not be verified.');
      blobs.set(key, new Blob([bytes], { type: mime }));
    }
    return { snapshot, schema: store.schema, blobs };
  } finally { workspace.forceStop(); workspace.dispose(); workspace.doc.destroy(); }
}

export class LocalBoardCopy {
  readonly operationId = crypto.randomUUID();
  constructor(readonly accountId: string, readonly source: LocalBoard) {}
  private assertAccount() {
    const session = getSessionState();
    if (session.phase !== 'authenticated' || session.member?.accountId !== this.accountId || session.member.expiresAt <= Date.now()) throw new Error('Sign in with the original account to resume this copy.');
  }
  private async request(path: string, init?: RequestInit) {
    this.assertAccount();
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(path, { ...init, signal: controller.signal, cache: 'no-store', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Dali-Request': '1', 'X-Dali-Account': this.accountId, ...init?.headers } });
      if (!response.ok) throw new Error('We couldn’t copy this board. Try again.');
      this.assertAccount(); return response;
    } finally { clearTimeout(timer); }
  }
  async run(): Promise<BoardDescriptor> {
    const path = '/api/imports/' + this.operationId;
    const check = async () => (await this.request(path)).json() as Promise<{ status: string; result?: BoardDescriptor }>;
    const validate = (result: BoardDescriptor) => {
      this.assertAccount();
      if (!validSummary(result.summary, this.accountId) || result.summary.access !== 'private' || result.summary.role !== 'owner') throw new Error('The private copy could not be confirmed.');
      return result;
    };
    const known = await check(); if (known.status === 'completed') return validate(known.result!);
    const captured = await captureLocal(this.source.id); this.assertAccount();
    const manifest = [...captured.blobs.keys()];
    const reserved = known.status === 'staging' ? known : await (await this.request('/api/imports', { method: 'POST', body: JSON.stringify({ operationId: this.operationId, title: this.source.title, manifest }) })).json() as { status: string; result: BoardDescriptor };
    if (reserved.status === 'completed') return validate(reserved.result!);
    const staging = createStagingWorkspace({ descriptor: reserved.result!, accountId: this.accountId, generation: 0 });
    const transformer = staging.createImportTransformer(captured.schema);
    try {
      for (const [key, blob] of captured.blobs) await staging.blobSync.set(key, blob);
      const copy = await transformer.snapshotToDoc(regenerateSurfaceIdentities(captured.snapshot));
      if (!copy) throw new Error('This board could not be copied.'); validateMindmapDocument(copy);
      await this.request(path + '/document', { method: 'PUT', body: JSON.stringify({ root: encode(Y.encodeStateAsUpdate(staging.doc)), content: encode(Y.encodeStateAsUpdate(copy.spaceDoc)), manifest }) });
      for (const [key, blob] of captured.blobs) await this.request(path + '/blobs/' + encodeURIComponent(key), { method: 'PUT', headers: { 'Content-Type': blob.type }, body: blob });
    } finally { transformer[Symbol.dispose](); staging.dispose(); }
    try { return validate(await (await this.request(path + '/commit', { method: 'POST', body: '{}' })).json() as BoardDescriptor); }
    catch (error) { const known = await check(); if (known.status === 'completed') return validate(known.result!); throw error; }
  }
}
