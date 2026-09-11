/**
 * One canvas runtime per page load.
 *
 * React StrictMode invokes effects twice in development, and each invocation
 * used to start its own async mount. Because cancellation could only be checked
 * AFTER the await, both mounts had already created a workspace and a document
 * by the time the first was cancelled -- two sync engines writing to the same
 * IndexedDB, and a duplicate doc persisted forever.
 *
 * The fix is to make workspace and document creation happen exactly once,
 * rather than to cancel it faster: every caller awaits the same memoised
 * promise, so "cancelled" only ever means "does not attach a host". No amount
 * of double-invocation can produce a second document.
 */
import { Text } from '@blocksuite/affine/store';
import type { Store } from '@blocksuite/affine/store';
import type { TestWorkspace } from '@blocksuite/affine/store/test';
import { StoreExtensionManager } from '@blocksuite/affine/ext-loader';
import { storeExtensions } from './extensions';
import {
  createPersistedWorkspace,
  disposeWorkspace,
  forgetPersistedDoc,
  updateWorkspaceDocMeta,
} from './workspace';
import { consumeDeferredBoardRemoval, getActiveBoardId } from '../boards/preferences';
import {
  reconcileBoardCatalog,
  removeBoardCatalogEntry,
  updateBoardCatalogEntry,
} from '../boards/catalog';
import { reportDocEngineStatus, resetSaveStatus } from './save-status';

export type CanvasRuntime = {
  workspace: TestWorkspace;
  store: Store;
  stopSaveStatus: () => void;
};

let runtime: Promise<CanvasRuntime> | null = null;

/**
 * The shared runtime, created on first call. A rejection is not cached, so a
 * failed start (e.g. IndexedDB unavailable) can be retried.
 */
export function getCanvasRuntime(): Promise<CanvasRuntime> {
  runtime ??= createRuntime().catch((error: unknown) => {
    runtime = null;
    throw error;
  });
  return runtime;
}

async function createRuntime(): Promise<CanvasRuntime> {
  resetSaveStatus();
  const storeManager = new StoreExtensionManager(storeExtensions);
  const workspace = await createPersistedWorkspace(storeManager.get('store'));
  reportDocEngineStatus(workspace.docSync.status);
  const saveStatusSubscription = workspace.docSync.onStatusChange.subscribe(
    reportDocEngineStatus
  );

  try {
    const preferredId = getActiveBoardId();
    const deferredRemovalId = consumeDeferredBoardRemoval();
    if (
      deferredRemovalId &&
      deferredRemovalId !== preferredId &&
      workspace.docs.has(deferredRemovalId)
    ) {
      // This runs before an EditorHost exists, so BlockSuite never observes a
      // mounted document losing its page tree during an import replacement.
      workspace.removeDoc(deferredRemovalId);
      await workspace.waitForSynced();
      await forgetPersistedDoc(deferredRemovalId);
      removeBoardCatalogEntry(deferredRemovalId);
    }
    const existingId =
      (preferredId && workspace.docs.has(preferredId) ? preferredId : null) ??
      [...workspace.docs.keys()][0];
    const store = existingId
      ? loadExistingBoard(workspace, existingId)
      : initializeBlankBoard(workspace);
    ensureBoardMetadata(workspace, store);
    reconcileBoardCatalog(workspace.meta.docMetas);
    trackBoardUpdates(workspace, store);
    return {
      workspace,
      store,
      stopSaveStatus: () => saveStatusSubscription.unsubscribe(),
    };
  } catch (error) {
    saveStatusSubscription.unsubscribe();
    await disposeWorkspace(workspace);
    throw error;
  }
}

function loadExistingBoard(workspace: TestWorkspace, docId: string): Store {
  const doc = workspace.getDoc(docId);
  if (!doc) {
    throw new Error(`Local board "${docId}" is listed but could not be opened.`);
  }
  const store = doc.getStore();
  // A restored doc is metadata-only until loaded; its blocks are absent otherwise.
  store.load();
  return store;
}

/**
 * A genuinely blank board: the page root and the surface, and nothing else.
 *
 * `createDefaultDoc` also seeds an `affine:note` and an `affine:paragraph`,
 * which is a document-editor default, not a canvas one -- it makes a first run
 * open with a text box already sitting on the board.
 */
export function initializeBlankBoard(workspace: TestWorkspace): Store {
  const doc = workspace.createDoc();
  const store = doc.getStore();
  // NOTE: no doc.load() first -- the init callback below only runs while the
  // doc is still unloaded, so loading it here would silently skip it and the
  // editor would then throw "This doc is missing root block".
  //
  // store.load() -- NOT doc.load() -- is what runs every store extension's
  // loaded() hook. HistoryExtension.loaded() is where the undo manager's
  // observers are attached and its canUndo signal is first computed. Skip it and
  // canUndo stays permanently false: store.undo() still works, but Ctrl+Z is a
  // no-op forever, because the keybinding guards on canUndo.
  store.load(() => {
    const rootId = store.addBlock('affine:page', { title: new Text('') });
    // The surface IS the canvas; edgeless renders nothing without it.
    store.addBlock('affine:surface', {}, rootId);
  });

  // Without this the first undo deletes the page/surface the editor needs,
  // leaving a permanently broken board.
  store.resetHistory();
  return store;
}

function ensureBoardMetadata(workspace: TestWorkspace, store: Store): void {
  const meta = workspace.meta.getDocMeta(store.id);
  if (!meta) return;
  const changes: { title?: string; updatedDate?: number } = {};
  if (!meta.title.trim()) changes.title = 'Untitled board';
  if (!meta.updatedDate) changes.updatedDate = meta.createDate || Date.now();
  if (Object.keys(changes).length) updateWorkspaceDocMeta(workspace, store.id, changes);
}

function trackBoardUpdates(workspace: TestWorkspace, store: Store): void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  store.history.onUpdated.subscribe(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      updateWorkspaceDocMeta(workspace, store.id, { updatedDate: Date.now() });
      // Clear the cached card preview; the library recreates it lazily from
      // the newly persisted board content.
      updateBoardCatalogEntry(store.id, { updatedAt: Date.now(), thumbnail: undefined });
      timer = null;
    }, 400);
  });
}

/**
 * Tear the runtime down: flush, stop the engines, dispose. Idempotent.
 * Registered on pagehide, and called explicitly by tests.
 */
export async function disposeCanvasRuntime(): Promise<void> {
  const pending = runtime;
  if (!pending) return;
  runtime = null;
  try {
    const { workspace, stopSaveStatus } = await pending;
    stopSaveStatus();
    await disposeWorkspace(workspace);
  } catch {
    // Creation already failed; nothing was left running.
  }
}

if (typeof window !== 'undefined') {
  // pagehide (not beforeunload, which is unreliable on mobile Safari) fires both
  // when the page is genuinely going away AND when it is frozen into the
  // back/forward cache.
  //
  // `persisted === true` means bfcache: the document stays alive and can be
  // restored intact by pressing Back. Disposing then would force-stop the sync
  // engines under an editor that is about to be shown again, so the board would
  // silently stop saving. Keep the runtime and let the restore reuse it.
  window.addEventListener('pagehide', (event: PageTransitionEvent) => {
    if (event.persisted) return;
    void disposeCanvasRuntime();
  });
}
