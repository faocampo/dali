import { readLegacyValue, createLegacyReader } from '../canvas/workspace';
import { readLegacyCatalog } from './catalog';
import * as Y from 'yjs';
import { Transformer, type Store, type DocSnapshot, type BlockSnapshot } from '@blocksuite/affine/store';
import { replaceIdMiddleware } from '@blocksuite/affine/shared/adapters';
import { validateMindmapDocument } from '../canvas/mindmap-compatibility';
import { createStagingWorkspace } from '../canvas/account/board-workspace';
import { regenerateSurfaceIdentities } from './operations';
import { validDescriptor, type BoardDescriptor } from './BoardLibrary';
import { authenticatedRecoveryEpoch, RecoveryEpochError } from '../canvas/account/doc-source';
import { getSessionState } from '../auth/session';
import { unzipSync } from 'fflate';

export type LocalBoard = { id: string; title: string; updatedAt: number };
type StoredDoc = { id: string; updates: { update: Uint8Array }[] };
const encode = (bytes: Uint8Array) => { let text = ''; for (const byte of bytes) text += String.fromCharCode(byte); return btoa(text); };

async function rootBytes() { return readLegacyValue<StoredDoc>('djai-storyboard', 'collection', 'djai-storyboard'); }
export async function listLocalBoards(): Promise<LocalBoard[]> {
  const catalog = readLegacyCatalog();
  const stored = await rootBytes(); if (!stored) return [];
  const root = new Y.Doc();
  try {
    stored.updates.forEach(row => Y.applyUpdate(root, row.update));
    const pages = root.getMap('meta').get('pages');
    if (!(pages instanceof Y.Array)) throw new Error('Local board inventory is unavailable.');
    return (pages.toJSON() as { id: string; title: string; createDate: number; updatedDate?: number }[]).map(meta => {
      if (typeof meta.id !== 'string' || typeof meta.title !== 'string') throw new Error('Local board inventory is unavailable.');
      const entry = catalog[meta.id];
      if (entry && (typeof entry.title !== 'string' || !Number.isFinite(entry.updatedAt))) throw new Error('Local board catalog is unavailable.');
      return { id: meta.id, title: entry?.title || meta.title || 'Untitled board', updatedAt: entry?.updatedAt ?? meta.updatedDate ?? meta.createDate };
    });
  } finally { root.destroy(); }
}
async function captureLocal(id: string) {
  const stored = await rootBytes(); const content = await readLegacyValue<StoredDoc>('djai-storyboard', 'collection', id);
  if (!stored || !content) throw new Error('This local board is unavailable.');
  // No persisted sources, start(), metadata initialization, or graceful-stop writes.
  const workspace = createLegacyReader();
  let sourceStore: Store | undefined;
  try {
    stored.updates.forEach(row => Y.applyUpdate(workspace.doc, row.update));
    const doc = workspace.getDoc(id); if (!doc) throw new Error('This local board is unavailable.');
    content.updates.forEach(row => Y.applyUpdate(doc.spaceDoc, row.update));
    const store = doc.getStore(); sourceStore = store; store.load(); store.readonly = true;
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
      const bytes = await readLegacyValue<ArrayBuffer>('djai-storyboard_blob', 'blob', key);
      const mime = await readLegacyValue<string>('djai-storyboard_blob_mime', 'blob_mime', key);
      if (!bytes || !['image/png', 'image/jpeg'].includes(mime ?? '')) throw new Error('A local image is missing. Your original remains in this browser.');
      const hash = encode(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).replace(/\+/g, '-').replace(/\//g, '_');
      if (hash !== key || (total += bytes.byteLength) > 256 * 1024 * 1024) throw new Error('The local images could not be verified.');
      blobs.set(key, new Blob([bytes], { type: mime }));
    }
    return { snapshot, schema: store.schema, blobs };
  } finally { workspace.forceStop(); sourceStore?.dispose(); workspace.dispose(); workspace.doc.destroy(); }
}

export class LocalCopyOutcomeUnknown extends Error {}
/** Native middleware regenerates blocks; custom image history must follow the exact image identity. */
async function importSnapshot(transformer: Transformer, snapshot: DocSnapshot) {
  const blocks = new Map<string, BlockSnapshot>();
  const visit = (block: BlockSnapshot) => { blocks.set(block.id, block); block.children.forEach(visit); }; visit(snapshot.blocks);
  const links = [...blocks.values()].filter(block => block.flavour === 'djai:image-visual-edit').map(block => {
    const image = blocks.get(block.props.imageId as string);
    if (!image || image.flavour !== 'affine:image') throw new Error('An image adjustment has an invalid image reference.');
    return { block, image };
  });
  const store = await transformer.snapshotToDoc(snapshot);
  if (!store) throw new Error('This board could not be imported.');
  for (const { block, image } of links) {
    const model = store.getBlock(block.id)?.model;
    if (!model || !store.getBlock(image.id)) throw new Error('An image adjustment could not be restored.');
    store.updateBlock(model, { imageId: image.id });
  }
  return store;
}
/** Archive conversion uses only a memory workspace; no legacy storage is opened. */
export async function captureArchive(file: File, schema?: Store['schema']) {
  if (file.size > 32 * 1024 * 1024) throw new Error('Choose a board archive smaller than 32 MB.');
  const workspace = createLegacyReader(); workspace.meta.initialize();
  const stores: Store[] = [];
  try {
    if (!schema) { const schemaStore = workspace.createDoc().getStore(); stores.push(schemaStore); schema = schemaStore.schema; }
    let totalUncompressed = 0;
    const files = unzipSync(new Uint8Array(await file.arrayBuffer()), { filter: entry => {
      if (entry.name.includes('__MACOSX') || entry.name.includes('DS_Store')) return false;
      const selected = entry.name.endsWith('.snapshot.json') || entry.name.startsWith('assets/');
      if (selected && (entry.originalSize > (entry.name.endsWith('.snapshot.json') ? 8 : 16) * 1024 * 1024 || (totalUncompressed += entry.originalSize) > 264 * 1024 * 1024)) throw new Error('This archive exceeds the import size limit.');
      return selected;
    } });
    const documents = Object.entries(files).filter(([path]) => path.endsWith('.snapshot.json'));
    if (documents.length !== 1) throw new Error('Choose an archive containing exactly one board.');
    const nativeSnapshot = JSON.parse(new TextDecoder().decode(documents[0]![1])) as DocSnapshot;
    const transformer = new Transformer({ schema, blobCRUD: workspace.blobSync,
      docCRUD: { create: id => workspace.createDoc(id).getStore(), get: id => workspace.getDoc(id)?.getStore() ?? null, delete: id => workspace.removeDoc(id) },
      middlewares: [replaceIdMiddleware(workspace.idGenerator)] });
    let store: Store;
    try {
      for (const [path, bytes] of Object.entries(files)) if (path.startsWith('assets/')) {
        const filename = path.slice(7); const extension = filename.split('.').at(-1); const mime = extension === 'png' ? 'image/png' : ['jpg', 'jpeg'].includes(extension ?? '') ? 'image/jpeg' : '';
        transformer.assets.set(filename.replace(/\.[^/.]+$/, ''), new Blob([new Uint8Array(bytes)], { type: mime }));
      }
      const legacyAssets: Promise<void>[] = [];
      transformer.walk(nativeSnapshot, block => {
        const source = block.props.sourceId;
        if (typeof source !== 'string' || !source.startsWith('/')) return;
        const blob = transformer.assets.get(source.replace(/^\//, ''));
        if (blob) legacyAssets.push((async () => { const key = encode(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))).replace(/\+/g, '-').replace(/\//g, '_'); transformer.assets.set(key, blob); block.props.sourceId = key; })());
      });
      await Promise.all(legacyAssets);
      store = await importSnapshot(transformer, nativeSnapshot); stores.push(store);
    } finally { transformer[Symbol.dispose](); }
    store.load(); validateMindmapDocument(store);
    const reader = store.getTransformer();
    let snapshot;
    try { snapshot = reader.docToSnapshot(store); } finally { reader[Symbol.dispose](); }
    if (!snapshot || JSON.stringify(snapshot).length > 8 * 1024 * 1024) throw new Error('This board exceeds the copy limit.');
    const blobs = new Map<string, Blob>(); let total = 0;
    for (const { model } of [...store.getBlocksByFlavour('affine:image'), ...store.getBlocksByFlavour('djai:image-visual-edit')]) {
      const key = (model.props as { sourceId: string }).sourceId;
      if (blobs.has(key)) continue;
      const blob = await workspace.blobSync.get(key);
      if (!blob || !['image/png', 'image/jpeg'].includes(blob.type)) throw new Error('An archive image is missing or unsupported. Choose a complete backup.');
      const hash = encode(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))).replace(/\+/g, '-').replace(/\//g, '_');
      if (hash !== key || (total += blob.size) > 256 * 1024 * 1024) throw new Error('The archive images could not be verified.');
      blobs.set(key, blob);
    }
    return { snapshot, schema, blobs };
  } finally { workspace.forceStop(); stores.forEach(store => store.dispose()); workspace.dispose(); workspace.doc.destroy(); }
}
export class LocalBoardCopy {
  private epoch?: string;
  constructor(readonly accountId: string, readonly source: LocalBoard, readonly operationId: string = crypto.randomUUID(),
    private capture?: () => ReturnType<typeof captureLocal>, private assertScope?: () => void, private authorize?: () => Promise<void>) {}
  private assertAccount() {
    this.assertScope?.();
    const session = getSessionState();
    if (session.phase !== 'authenticated' || session.member?.accountId !== this.accountId || session.member.expiresAt <= Date.now()) throw new Error('Sign in with the original account to resume this copy.');
  }
  private async request(path: string, init?: RequestInit) {
    this.assertAccount();
    await this.authorize?.(); this.assertAccount();
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(path, { ...init, signal: controller.signal, cache: 'no-store', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Dali-Request': '1', 'X-Dali-Account': this.accountId, ...(this.epoch ? { 'X-Dali-Recovery-Epoch': this.epoch } : {}), ...init?.headers } });
      if (response.status === 409) {
        const body = await response.clone().json() as { code?: string };
        if (body.code === 'RECOVERY_EPOCH_REQUIRED' || body.code === 'RECOVERY_EPOCH_MISMATCH') throw new RecoveryEpochError(body.code);
      }
      if (!response.ok) throw new Error('We couldn’t copy this board. Try again.');
      if (init?.method && init.method !== 'GET' && response.headers.get('X-Dali-Recovery-Epoch') !== this.epoch) throw new RecoveryEpochError('RECOVERY_EPOCH_MISMATCH');
      this.assertAccount(); return response;
    } finally { clearTimeout(timer); }
  }
  async run(): Promise<BoardDescriptor> {
    const path = '/api/imports/' + this.operationId;
    const check = async () => (await this.request(path)).json() as Promise<{ status: string; result?: BoardDescriptor }>;
    const validate = (result: BoardDescriptor) => {
      this.assertAccount();
      if (!validDescriptor(result, this.accountId) || result.summary.access !== 'private' || result.summary.role !== 'owner') throw new Error('The private copy could not be confirmed.');
      return result;
    };
    const known = await check(); if (known.status === 'completed') return validate(known.result!);
    const currentEpoch = await authenticatedRecoveryEpoch(this.accountId);
    this.epoch ??= known.status === 'staging' ? known.result?.recoveryEpoch : currentEpoch;
    if (this.epoch !== currentEpoch) throw new RecoveryEpochError('RECOVERY_EPOCH_MISMATCH');
    const captured = await (this.capture ? this.capture() : captureLocal(this.source.id)); this.assertAccount();
    const manifest = [...captured.blobs.keys()];
    const reserved = known.status === 'staging' ? known : await (await this.request('/api/imports', { method: 'POST', body: JSON.stringify({ operationId: this.operationId, title: this.source.title, manifest }) })).json() as { status: string; result: BoardDescriptor };
    if (reserved.status === 'completed') return validate(reserved.result!);
    if (reserved.result?.recoveryEpoch !== this.epoch) throw new RecoveryEpochError('RECOVERY_EPOCH_MISMATCH');
    const staging = createStagingWorkspace({ descriptor: reserved.result!, accountId: this.accountId, generation: 0 });
    const transformer = staging.createImportTransformer(captured.schema);
    try {
      for (const [key, blob] of captured.blobs) await staging.blobSync.set(key, blob);
      const copy = await importSnapshot(transformer, regenerateSurfaceIdentities(captured.snapshot));
      if (!copy) throw new Error('This board could not be copied.'); validateMindmapDocument(copy);
      await this.request(path + '/document', { method: 'PUT', body: JSON.stringify({ root: encode(Y.encodeStateAsUpdate(staging.doc)), content: encode(Y.encodeStateAsUpdate(copy.spaceDoc)), manifest }) });
      for (const [key, blob] of captured.blobs) await this.request(path + '/blobs/' + encodeURIComponent(key), { method: 'PUT', headers: { 'Content-Type': blob.type }, body: blob });
    } finally { transformer[Symbol.dispose](); staging.dispose(); }
    try { return validate(await (await this.request(path + '/commit', { method: 'POST', body: '{}' })).json() as BoardDescriptor); }
    catch (error) {
      let known;
      try { known = await check(); }
      catch { throw new LocalCopyOutcomeUnknown('The copy outcome is not confirmed. Check again before closing. Originals remain in this browser.'); }
      if (known.status === 'completed') return validate(known.result!); throw error;
    }
  }
}
