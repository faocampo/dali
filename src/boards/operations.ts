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
  const timeout = new AbortController(); const abort = () => timeout.abort();
  signal?.addEventListener('abort', abort, { once: true }); const timer = setTimeout(abort, 10_000);
  try {
    const response = await fetch('/api/boards', { method: 'POST', headers, signal: timeout.signal, body: JSON.stringify({ operationId, title: 'Untitled board' }) });
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
