import { replaceIdMiddleware } from '@blocksuite/affine/shared/adapters';
import type { Store } from '@blocksuite/affine/store';
import { getLegacyCanvasRuntime, initializeBlankBoard } from '../canvas/legacy-runtime';
import { validateMindmapDocument } from '../canvas/mindmap-compatibility';
import { forgetPersistedDoc, updateWorkspaceDocMeta } from '../canvas/workspace';
import { requestBoardOpen, setActiveBoardId } from './preferences';
import {
  reconcileBoardCatalog,
  removeBoardCatalogEntry,
  setBoardCatalogEntry,
  updateBoardCatalogEntry,
} from './catalog';
import {
  applyBoardTemplate,
  boardTemplate,
  templatePreviewKinds,
  type TemplateId,
} from './templates';
import { validSummary, type BoardDescriptor } from './BoardLibrary';
import * as Y from 'yjs';
import { createAccountWorkspace, createStagingWorkspace } from '../canvas/account/board-workspace';
import { synchronizeActiveBoard } from '../canvas/runtime';
import { authenticatedRecoveryEpoch, RecoveryEpochError, validRecoveryEpoch } from '../canvas/account/doc-source';

export function validateBoardTitle(draft: string, acknowledged: string): string {
  const title = draft.trim() || acknowledged;
  if ([...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(title)].length > 200) throw new Error('Use a board name of 200 characters or fewer.');
  return title;
}
export class BoardActionError extends Error {
  constructor(message: string, readonly uncertain = false) { super(message); }
}
const encodeBytes = (bytes: Uint8Array) => { let value = ''; for (const byte of bytes) value += String.fromCharCode(byte); return btoa(value); };
const decodeBytes = (value: string) => Uint8Array.from(atob(value), char => char.charCodeAt(0));

/** Pinned native middleware replaces blocks, but preserves surface element IDs.
 * Remap only identity-bearing fields; text and image hashes stay verbatim. */
export function regenerateSurfaceIdentities<T>(snapshot: T): T {
  const copy = structuredClone(snapshot);
  type Block = { flavour?: string; props?: Record<string, unknown>; children?: Block[] };
  const blocks: Block[] = []; const visit = (block: Block) => { blocks.push(block); block.children?.forEach(visit); };
  visit((copy as { blocks: Block }).blocks);
  const ids = new Map<string, string>();
  for (const block of blocks) if (block.flavour === 'affine:surface') for (const id of Object.keys(block.props?.elements ?? {})) ids.set(id, crypto.randomUUID());
  const replace = (id: unknown) => typeof id === 'string' ? ids.get(id) ?? id : id;
  for (const block of blocks) {
    if (block.props && typeof block.props.reference === 'string') block.props.reference = replace(block.props.reference);
    if (block.flavour !== 'affine:surface') continue;
    const elements = block.props!.elements as Record<string, Record<string, unknown>>;
    block.props!.elements = Object.fromEntries(Object.entries(elements).map(([id, element]) => {
      if ('id' in element) element.id = replace(element.id);
      if (element.type === 'connector') for (const end of ['source', 'target']) { const value = element[end] as { id?: string }; if (value?.id) value.id = replace(value.id) as string; }
      if (element.type === 'group' || element.type === 'mindmap') {
        const children = element.children as { json?: Record<string, unknown> };
        if (children?.json) children.json = Object.fromEntries(Object.entries(children.json).map(([child, detail]) => {
          if (element.type === 'mindmap' && detail && typeof detail === 'object' && 'parent' in detail) (detail as { parent: unknown }).parent = replace((detail as { parent: unknown }).parent);
          return [replace(child), detail];
        }));
      }
      return [replace(id), element];
    }));
  }
  return copy;
}

/** One user intent keeps one ID across transport failures and reconciliation. */
export class AccountBoardAction {
  readonly operationId = crypto.randomUUID();
  private payload?: { title?: string; revision: number; operationId: string };
  private assertActive?: () => void;
  private epoch?: string;
  constructor(readonly accountId: string, readonly boardId: string, readonly kind: 'rename' | 'delete' | 'duplicate') {}
  private async request(path: string, init: RequestInit = {}) {
    this.assertActive?.();
    let response: Response;
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 10000);
    try { response = await fetch(path, { ...init, signal: controller.signal, cache: 'no-store', headers: { 'X-Dali-Account': this.accountId, 'X-Dali-Request': '1', 'Content-Type': 'application/json', ...(this.epoch ? { 'X-Dali-Recovery-Epoch': this.epoch } : {}), ...init.headers } }); }
    catch { throw new BoardActionError("We couldn't confirm this change. Check again before retrying.", true); }
    finally { clearTimeout(timer); }
    this.assertActive?.();
    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as { code?: string };
      if (error.code === 'RECOVERY_EPOCH_REQUIRED' || error.code === 'RECOVERY_EPOCH_MISMATCH') throw new RecoveryEpochError(error.code);
      throw new BoardActionError(error.code === 'TITLE_TOO_LONG' ? 'Use a board name of 200 characters or fewer.' : ['SOURCE_CHANGED', 'BOARD_CHANGED'].includes(error.code ?? '') ? 'This board changed. Try again with a fresh copy.' : response.status >= 500 ? "We couldn't confirm this change. Check again before retrying." : 'This change could not be saved. Refresh board access and try again.', response.status >= 500);
    }
    if (init.method && init.method !== 'GET' && this.epoch && response.headers.get('X-Dali-Recovery-Epoch') !== this.epoch) throw new RecoveryEpochError('RECOVERY_EPOCH_MISMATCH');
    return response;
  }
  async check(): Promise<{ status: string; result?: BoardDescriptor & { deleted?: boolean; boardId?: string } }> {
    return (await this.request('/api/operations/' + this.operationId)).json();
  }
  async run(title?: string): Promise<BoardDescriptor & { deleted?: boolean; boardId?: string }> {
    const previous = await this.check(); if (previous.status === 'completed') return previous.result!;
    const path = '/api/boards/' + encodeURIComponent(this.boardId);
    if (this.kind !== 'duplicate') {
      if (!this.payload) {
        const descriptor = await (await this.request(path)).json() as BoardDescriptor;
        if (!validRecoveryEpoch(descriptor.recoveryEpoch)) throw new RecoveryEpochError('RECOVERY_EPOCH_REQUIRED');
        this.epoch = descriptor.recoveryEpoch;
        this.payload = { operationId: this.operationId, revision: descriptor.revision, ...(this.kind === 'rename' ? { title: validateBoardTitle(title ?? '', descriptor.summary.title) } : {}) };
      }
      try { return await (await this.request(path, { method: this.kind === 'rename' ? 'PATCH' : 'DELETE', body: JSON.stringify(this.payload) })).json(); }
      catch (cause) { if (cause instanceof BoardActionError && cause.uncertain) { const known = await this.check(); if (known.status === 'completed') return known.result!; } throw cause; }
    }
    this.assertActive = await synchronizeActiveBoard(this.accountId, this.boardId);
    const exported = await (await this.request(path + '/editable-export')).json() as { descriptor: BoardDescriptor; root: string; content: string; manifest: string[] };
    if (!validRecoveryEpoch(exported.descriptor.recoveryEpoch)) throw new RecoveryEpochError('RECOVERY_EPOCH_REQUIRED');
    if (this.epoch && this.epoch !== exported.descriptor.recoveryEpoch) throw new RecoveryEpochError('RECOVERY_EPOCH_MISMATCH');
    this.epoch ??= exported.descriptor.recoveryEpoch;
    const copyTitle = validateBoardTitle(title ?? exported.descriptor.summary.title, exported.descriptor.summary.title);
    const reserved = previous.status === 'staging' ? previous : await (await this.request(path + '/duplicate', { method: 'POST', body: JSON.stringify({ operationId: this.operationId, revision: exported.descriptor.revision, title: copyTitle }) })).json() as { status: string; result: BoardDescriptor };
    if (reserved.status === 'completed') return reserved.result!;
    const destination = reserved.result!;
    const headers = { 'X-Dali-Account': this.accountId };
    const blobs = new Map<string, Blob>();
    for (const key of exported.manifest) {
      const response = await this.request(path + '/blobs/' + encodeURIComponent(key), { headers }); const blob = await response.blob();
      const hash = encodeBytes(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))).replace(/\+/g, '-').replace(/\//g, '_');
      if (hash !== key) throw new Error('The image copy could not be verified.'); blobs.set(key, blob);
    }
    // Hydrate an immutable snapshot reader from captured bytes. No source pushes,
    // catalog updates or source workspace membership changes are possible.
    const sourceDescriptor = structuredClone(exported.descriptor); sourceDescriptor.summary.role = 'viewer';
    const source = await createAccountWorkspace({ descriptor: sourceDescriptor, accountId: this.accountId, generation: 0,
      fetch: async (input, init) => {
        const url = String(input);
        if (url.endsWith('/pull') && init?.method === 'POST') {
          const bytes = url.includes(encodeURIComponent(sourceDescriptor.rootDocId)) ? exported.root : exported.content;
          return new Response(decodeBytes(bytes), { headers: { 'Content-Type': 'application/octet-stream' } });
        }
        throw new Error('Snapshot reader cannot write or fetch outside its captured documents.');
      } });
    const staging = createStagingWorkspace({ descriptor: destination, accountId: this.accountId, generation: 0 });
    let transformer: ReturnType<typeof staging.createImportTransformer> | undefined;
    try {
      const store = source.getDoc(sourceDescriptor.contentDocId)!.getStore(); validateMindmapDocument(store);
      const reader = store.getTransformer();
      const snapshot = reader.docToSnapshot(store); if (!snapshot) throw new Error('The board could not be copied.');
      reader[Symbol.dispose]();
      for (const [key, blob] of blobs) await staging.blobSync.set(key, blob);
      transformer = staging.createImportTransformer(store.schema);
      const copied = await transformer.snapshotToDoc(regenerateSurfaceIdentities(snapshot)); if (!copied) throw new Error('The board could not be copied.');
      validateMindmapDocument(copied); copied.resetHistory();
      const root = encodeBytes(Y.encodeStateAsUpdate(staging.doc)); const content = encodeBytes(Y.encodeStateAsUpdate(copied.spaceDoc));
      await this.request('/api/imports/' + this.operationId + '/document', { method: 'PUT', body: JSON.stringify({ root, content, manifest: exported.manifest }) });
      for (const [key, blob] of blobs) await this.request('/api/imports/' + this.operationId + '/blobs/' + encodeURIComponent(key), { method: 'PUT', headers: { 'Content-Type': blob.type }, body: blob });
    } finally { transformer?.[Symbol.dispose](); staging.dispose(); source.dispose(); }
    try { return await (await this.request('/api/imports/' + this.operationId + '/commit', { method: 'POST', body: '{}' })).json(); }
    catch (cause) { if (cause instanceof BoardActionError && cause.uncertain) { const known = await this.check(); if (known.status === 'completed') return known.result!; } throw cause; }
  }
}

/** Retries reconcile the caller-owned operation before submitting any new create. */
export async function createAccountBoard(accountId: string, operationId: string, signal?: AbortSignal): Promise<BoardDescriptor> {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(operationId)) throw new Error('Invalid creation request');
  const headers = { 'X-Dali-Account': accountId, 'X-Dali-Request': '1', 'Content-Type': 'application/json' };
  const validate = (result: BoardDescriptor) => {
    if (!result || !validSummary(result.summary, accountId) || result.summary.role !== 'owner' || !result.rootDocId || !result.contentDocId || signal?.aborted) throw new Error('Board creation is unavailable');
    return result;
  };
  const reconcile = async (): Promise<BoardDescriptor | undefined> => {
    const response = await fetch('/api/operations/' + encodeURIComponent(operationId), { headers, cache: 'no-store', signal });
    if (!response.ok) throw new Error('Board creation is unavailable');
    const known = await response.json() as { status: string; result?: BoardDescriptor };
    if (known.status === 'completed') return validate(known.result!);
    if (known.status !== 'unknown') throw new Error('Board creation is pending');
  };
  const previous = await reconcile(); if (previous) return previous;
  const epoch = await authenticatedRecoveryEpoch(accountId, signal);
  const timeout = new AbortController(); const abort = () => timeout.abort();
  signal?.addEventListener('abort', abort, { once: true }); const timer = setTimeout(abort, 10_000);
  try {
    const response = await fetch('/api/boards', { method: 'POST', headers: { ...headers, 'X-Dali-Recovery-Epoch': epoch }, signal: timeout.signal, body: JSON.stringify({ operationId, title: 'Untitled board' }) });
    if (!response.ok) throw new Error('Board creation is unavailable');
    return validate(await response.json() as BoardDescriptor);
  } catch (cause) {
    if (signal?.aborted) throw cause;
    const committed = await reconcile(); if (committed) return committed;
    throw cause;
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}

export type BoardPreviewKind = 'image' | 'sticky' | 'shape' | 'text';

export type LocalBoardSummary = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  preview: BoardPreviewKind[];
};

function displayTitle(title: string): string {
  return title.trim() || 'Untitled board';
}

function previewFor(store: Store): BoardPreviewKind[] {
  const preview = new Set<BoardPreviewKind>();
  const surface = store.getBlocksByFlavour('affine:surface')[0]?.model as
    | { elementModels?: Array<{ type?: string }> }
    | undefined;

  for (const element of surface?.elementModels ?? []) {
    if (element.type === 'shape') preview.add('shape');
    if (element.type === 'text') preview.add('text');
  }
  if (store.getBlocksByFlavour('affine:image').length) preview.add('image');
  if (store.getBlocksByFlavour('affine:note').length) preview.add('sticky');
  if (store.getBlocksByFlavour('affine:edgeless-text').length) preview.add('text');

  return [...preview].slice(0, 5);
}

const THUMBNAIL_PREFIX = 'preview:v1:';

function encodeThumbnail(preview: BoardPreviewKind[]): string {
  return `${THUMBNAIL_PREFIX}${preview.join(',')}`;
}

function decodeThumbnail(value?: string): BoardPreviewKind[] | null {
  if (!value?.startsWith(THUMBNAIL_PREFIX)) return null;
  const allowed = new Set<BoardPreviewKind>(['image', 'sticky', 'shape', 'text']);
  return value
    .slice(THUMBNAIL_PREFIX.length)
    .split(',')
    .filter((kind): kind is BoardPreviewKind => allowed.has(kind as BoardPreviewKind));
}

export async function listLocalBoards(): Promise<LocalBoardSummary[]> {
  const { workspace } = await getLegacyCanvasRuntime();
  const catalog = reconcileBoardCatalog(workspace.meta.docMetas);
  return workspace.meta.docMetas
    .map((meta) => {
      const doc = workspace.getDoc(meta.id);
      const store = doc?.getStore();
      let preview = decodeThumbnail(catalog[meta.id]?.thumbnail);
      if (!preview && store) {
        try {
          // Generate on first library visit, then keep only a small visual
          // descriptor in the index. A malformed board can still be opened;
          // its card merely falls back to the empty preview.
          store.load();
          preview = previewFor(store);
          updateBoardCatalogEntry(meta.id, { thumbnail: encodeThumbnail(preview) });
        } catch {
          preview = [];
        }
      }
      return {
        id: meta.id,
        title: catalog[meta.id]?.title ?? displayTitle(meta.title),
        createdAt: catalog[meta.id]?.createdAt ?? meta.createDate,
        updatedAt: catalog[meta.id]?.updatedAt ?? meta.updatedDate ?? meta.createDate,
        preview: preview ?? [],
      };
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

function nextUntitledTitle(titles: string[]): string {
  const used = new Set(titles);
  if (!used.has('Untitled board')) return 'Untitled board';
  let suffix = 2;
  while (used.has(`Untitled board ${suffix}`)) suffix += 1;
  return `Untitled board ${suffix}`;
}

export async function createLocalBoard(templateId: TemplateId = 'blank'): Promise<string> {
  const { workspace } = await getLegacyCanvasRuntime();
  const catalog = reconcileBoardCatalog(workspace.meta.docMetas);
  const template = boardTemplate(templateId);
  const titles = Object.values(catalog).map(entry => entry.title);
  const title = templateId === 'blank'
    ? nextUntitledTitle(titles)
    : nextAvailableTitle(template.boardTitle, titles);
  const store = initializeBlankBoard(workspace);
  applyBoardTemplate(store, template);
  const now = Date.now();
  setBoardCatalogEntry(store.id, {
    title,
    createdAt: now,
    updatedAt: now,
    thumbnail: encodeThumbnail(templatePreviewKinds(template)),
  });
  updateWorkspaceDocMeta(workspace, store.id, { title, updatedDate: now });
  await workspace.waitForSynced();
  if (workspace.meta.getDocMeta(store.id)?.title !== title) {
    throw new Error('The new board title could not be stored.');
  }
  return store.id;
}

function nextAvailableTitle(base: string, titles: string[]): string {
  const used = new Set(titles);
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base} ${suffix}`)) suffix += 1;
  return `${base} ${suffix}`;
}

export async function renameLocalBoard(id: string, title: string): Promise<void> {
  const clean = displayTitle(title);
  const { workspace } = await getLegacyCanvasRuntime();
  if (!workspace.meta.getDocMeta(id)) throw new Error('That local board no longer exists.');
  reconcileBoardCatalog(workspace.meta.docMetas);
  updateBoardCatalogEntry(id, { title: clean, updatedAt: Date.now() });
  updateWorkspaceDocMeta(workspace, id, { title: clean, updatedDate: Date.now() });
  await workspace.waitForSynced();
  if (workspace.meta.getDocMeta(id)?.title !== clean) {
    throw new Error('The board name could not be stored.');
  }
}

export async function duplicateLocalBoard(id: string): Promise<string> {
  const { workspace } = await getLegacyCanvasRuntime();
  const sourceDoc = workspace.getDoc(id);
  const sourceMeta = workspace.meta.getDocMeta(id);
  if (!sourceDoc || !sourceMeta) throw new Error('That local board no longer exists.');

  const source = sourceDoc.getStore();
  const catalog = reconcileBoardCatalog(workspace.meta.docMetas);
  source.load();
  validateMindmapDocument(source);
  const transformer = source.getTransformer([replaceIdMiddleware(workspace.idGenerator)]);
  const snapshot = transformer.docToSnapshot(source);
  if (!snapshot) throw new Error('The board could not be copied.');

  const duplicate = await transformer.snapshotToDoc(structuredClone(snapshot));
  if (!duplicate) throw new Error('The board could not be copied.');
  duplicate.resetHistory();
  const now = Date.now();
  setBoardCatalogEntry(duplicate.id, {
    title: `${catalog[id]?.title ?? displayTitle(sourceMeta.title)} copy`,
    createdAt: now,
    updatedAt: now,
    thumbnail: catalog[id]?.thumbnail,
  });
  updateWorkspaceDocMeta(workspace, duplicate.id, {
    title: `${catalog[id]?.title ?? displayTitle(sourceMeta.title)} copy`,
    createDate: now,
    updatedDate: now,
  });
  await workspace.waitForSynced();
  return duplicate.id;
}

export async function deleteLocalBoard(id: string): Promise<string> {
  const { workspace } = await getLegacyCanvasRuntime();
  if (!workspace.meta.getDocMeta(id)) throw new Error('That local board no longer exists.');

  workspace.removeDoc(id);
  removeBoardCatalogEntry(id);
  let fallback = workspace.meta.docMetas[0]?.id;
  if (!fallback) {
    const replacement = initializeBlankBoard(workspace);
    updateWorkspaceDocMeta(workspace, replacement.id, {
      title: 'Untitled board',
      updatedDate: Date.now(),
    });
    fallback = replacement.id;
  }
  setActiveBoardId(fallback);
  await workspace.waitForSynced();
  await forgetPersistedDoc(id);
  return fallback;
}

export function openLocalBoard(id: string): void {
  setActiveBoardId(id);
  requestBoardOpen();
  window.location.reload();
}
