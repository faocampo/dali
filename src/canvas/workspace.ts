/**
 * Persisted workspace for the canvas.
 *
 * BlockSuite 0.22 ships exactly one Workspace/Doc/Meta implementation and it
 * lives under the `test` subpath. The only genuinely test-shaped thing about it
 * is its DEFAULTS -- `NoopDocSource` (drops every update) and
 * `MemoryBlobSource` (loses images on reload). Both are constructor-injectable,
 * and the real IndexedDB sources are public API on `@blocksuite/affine/sync`,
 * so swapping them in gives real persistence without touching AFFiNE internals.
 */
import { IndexedDBBlobSource, IndexedDBDocSource } from '@blocksuite/affine/sync';
import { TestWorkspace } from '@blocksuite/affine/store/test';
import type { DocMeta, ExtensionType } from '@blocksuite/affine/store';
import {
  beginBlobWrite,
  finishBlobWrite,
  reportDocWriteFailure,
} from './save-status';

/**
 * The IndexedDB database name. DO NOT RENAME without a migration: it is the
 * only key to every board a user has already made, and changing it would make
 * their work vanish rather than fail loudly. The stale product name is
 * deliberate.
 */
const DB_NAME = 'djai-storyboard';

/** How long to wait for the initial read from disk before giving up. */
const SYNC_TIMEOUT_MS = 20_000;

class ReportingIndexedDBDocSource extends IndexedDBDocSource {
  override async push(docId: string, data: Uint8Array): Promise<void> {
    try {
      await super.push(docId, data);
    } catch (error) {
      reportDocWriteFailure(error);
      throw error;
    }
  }
}

class ReportingIndexedDBBlobSource extends IndexedDBBlobSource {
  private readonly failedWrites = new Map<string, Blob>();

  override async set(key: string, value: Blob): Promise<string> {
    beginBlobWrite();
    try {
      const stored = await super.set(key, value);
      this.failedWrites.delete(key);
      finishBlobWrite();
      return stored;
    } catch (error) {
      this.failedWrites.set(key, value);
      finishBlobWrite(error);
      throw error;
    }
  }

  async retryFailedWrites(): Promise<void> {
    for (const [key, value] of [...this.failedWrites]) {
      await this.set(key, value);
    }
  }
}

/**
 * Fail fast and clearly when the browser has no usable IndexedDB.
 *
 * Without this the failure surfaces as a hang, not an error: DocEngine catches
 * its own exceptions internally, so a broken storage layer leaves
 * `waitForSynced()` pending forever and the user stares at a blank page.
 */
async function assertStorageAvailable(): Promise<void> {
  let db: IDBFactory;
  try {
    // Merely READING window.indexedDB throws in some locked-down contexts.
    db = indexedDB;
    if (!db) throw new Error('indexedDB is not available');
  } catch (cause) {
    throw new Error(
      `This browser is not allowing local storage, so boards cannot be saved. (${
        cause instanceof Error ? cause.message : String(cause)
      })`
    );
  }

  await new Promise<void>((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = db.open(`${DB_NAME}-probe`);
    } catch (cause) {
      reject(cause instanceof Error ? cause : new Error(String(cause)));
      return;
    }
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
    request.onblocked = () => reject(new Error('IndexedDB is blocked'));
  });
}

export async function createPersistedWorkspace(
  storeExtensions: ExtensionType[]
): Promise<TestWorkspace> {
  await assertStorageAvailable();

  const workspace = new TestWorkspace({
    id: DB_NAME,
    docSources: { main: new ReportingIndexedDBDocSource(DB_NAME) },
    blobSources: { main: new ReportingIndexedDBBlobSource(DB_NAME) },
  });

  try {
    // Doc.getStore() reads extensions off the workspace, not off getStore().
    workspace.storeExtensions = storeExtensions;

    // Nothing is read from or written to IndexedDB until the engines start.
    workspace.start();
    // Bounded: DocEngine swallows its own errors, so an unreadable store would
    // otherwise leave this pending forever with nothing shown to the user.
    await withTimeout(
      workspace.waitForSynced(),
      SYNC_TIMEOUT_MS,
      'Timed out reading your saved board from local storage.'
    );

    // ORDER MATTERS. meta.initialize() does `_proxy.pages = []` when `pages` is
    // absent, and TestWorkspace never calls it itself (without it addDocMeta()
    // silently no-ops and createDoc() returns null). Run it BEFORE the restored
    // state arrives and that fresh empty Y.Array competes with the persisted
    // `pages` array on merge and can win -- the board is then silently empty on
    // every reload even though IndexedDB still holds it. After sync it is a
    // no-op whenever a board already exists.
    workspace.meta.initialize();

    return workspace;
  } catch (error) {
    // A half-started workspace still holds a live sync engine and an open
    // IndexedDB handle. Leaving it running would keep writing under a workspace
    // nobody owns.
    await disposeWorkspace(workspace);
    throw error;
  }
}

/** Retry failed blob writes, then restart document persistence from memory. */
export async function retryWorkspacePersistence(workspace: TestWorkspace): Promise<void> {
  const blobSource = workspace.blobSync.main;
  if (blobSource instanceof ReportingIndexedDBBlobSource) {
    await blobSource.retryFailedWrites();
  }
  workspace.docSync.forceStop();
  workspace.docSync.start();
  await withTimeout(
    workspace.waitForSynced(),
    SYNC_TIMEOUT_MS,
    'Timed out retrying local board storage.'
  );
}

/**
 * Delete a document's stored updates.
 *
 * `IndexedDBDocSource` implements pull/push and nothing else -- there is no
 * delete -- so `workspace.removeDoc()` only drops the doc from the workspace
 * META. Doc selection stays correct, because that reads the meta list, but the
 * row itself survives in IndexedDB forever. Import replaces the board every
 * time it is used, so without this each import would strand the whole previous
 * board, history included, and the database would grow without bound.
 *
 * Best-effort by design: this is a cleanup, and failing it must never cost the
 * user the import that just succeeded.
 */
export async function forgetPersistedDoc(docId: string): Promise<void> {
  try {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
    });
    try {
      if (![...db.objectStoreNames].includes('collection')) return;
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('collection', 'readwrite');
        tx.objectStore('collection').delete(docId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('IndexedDB delete failed'));
      });
    } finally {
      db.close();
    }
  } catch {
    // Leaving a stale row behind is untidy, not harmful: the workspace meta no
    // longer lists this doc, so nothing will open it.
  }
}

/**
 * Reliably replace one workspace metadata record.
 *
 * TestMeta.setDocMeta() mutates fields on the object returned from its reactive
 * array. In BlockSuite 0.22.4 those nested objects are plain snapshots, so the
 * mutation neither reaches the Y.Array nor emits docMetaUpdated. Replacing the
 * array entry through its public `docs` proxy does both. Keeping this workaround
 * here prevents titles and updated dates from looking correct until reload and
 * then silently reverting.
 */
export function updateWorkspaceDocMeta(
  workspace: TestWorkspace,
  id: string,
  props: Partial<DocMeta>
): void {
  const docs = workspace.meta.docs as DocMeta[] | undefined;
  if (!docs) throw new Error('Local board metadata is unavailable.');
  const index = docs.findIndex((meta) => meta.id === id);
  if (index === -1) throw new Error(`Local board "${id}" is not registered.`);
  docs.splice(index, 1, { ...docs[index]!, ...props });
}

/**
 * Flush anything outstanding, then stop the sync/awareness engines and release
 * the workspace. Safe to call on a partially constructed workspace.
 */
export async function disposeWorkspace(workspace: TestWorkspace): Promise<void> {
  try {
    // Best-effort flush. Bounded, because a wedged sync engine must not stop
    // teardown -- forceStop below runs either way.
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 2000);
    await workspace.waitForGracefulStop(abort.signal).catch(() => undefined);
    clearTimeout(timer);
  } finally {
    try {
      workspace.forceStop();
    } catch {
      // already stopped
    }
    try {
      workspace.dispose();
    } catch {
      // already disposed
    }
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    );
  });
}
