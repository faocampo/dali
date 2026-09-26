import type { Store, Workspace } from '@blocksuite/affine/store';
import { validDescriptor, type BoardDescriptor, type BoardSummary } from '../boards/BoardLibrary';
import type { AccountWorkspaceOptions, BoardWorkspace } from './account/board-workspace';
import { resetSaveStatus, dispatchSaveEvent, reportSaveCoverage, reportImageOutcome, getAccountSaveSnapshot } from './save-status';
import { BoardBlobSource } from './account/blob-source';
import * as Y from 'yjs';
import { AccountJournal, replayJournal, requestRecoveryStorage, pendingRecords, readCheckpoint, validRecord, RecoveryStorageError, type ReplayObserver } from './account/outbox';
import { RecoveryCoordinator, type RecoveryOutcome } from './account/recovery';
import { RecoveryEpochError, SourceAccessError } from './account/doc-source';
import { interruptSession, revalidateSession } from '../auth/session';
import { attachLocalCapture } from './account/local-capture';
import { titleIntentStore, inspectPendingScopes } from './account/outbox';
import { captureTitleIntent, replayTitleIntent, type TitleIntent, type TitleStore } from './account/title-intent';

let captureTitle: ((title: string) => Promise<void>) | undefined;
let preserveTitle: (() => Promise<void>) | undefined;
export async function renameActiveBoard(title: string) { if (!captureTitle) throw new Error('Board access is unavailable'); await captureTitle(title); }

export type BoardRole = BoardSummary['role'];
export type AccessScope = Readonly<{ accountId: string; boardId: string; generation: number; role: BoardRole; canWrite: boolean; phase: 'active' | 'paused' | 'disposed'; recoveryState?: RecoveryOutcome; stalled?: boolean; title?: string }>;
export type CanvasRuntime = { workspace: Workspace & Pick<BoardWorkspace, 'docSync' | 'waitForSynced'>; store: Store; descriptor: BoardDescriptor; scope: AccessScope; stopSaveStatus: () => void; dispose: () => void };
let scope: AccessScope | null = null;
let current: CanvasRuntime | null = null;
let pending: { key: string; promise: Promise<CanvasRuntime> } | null = null;
let generation = 0;
let journal: AccountJournal | undefined;
let abort: AbortController | undefined;
let capture: Promise<unknown>[] = [];
let recovery: RecoveryCoordinator | undefined;
let storagePaused = false;
let saveScope: string | undefined;
let replayObserver: ReplayObserver | undefined;
let recoveryAssets = new Map<string, Blob>();
export const retryRecovery = () => recovery?.retryRecovery();
export function pauseRecoveryStorage() {
  if (!scope || scope.phase !== 'active') return;
  storagePaused = true;
  if (current) { current.store.readonly = true; current.workspace.docSync.forceStop(); }
  publish({ ...scope, canWrite: false, recoveryState: 'storage-paused' });
  if (saveScope) dispatchSaveEvent({ type: 'recovery', scope: saveScope, state: 'storage-paused' });
}
const listeners = new Set<() => void>();
export const getActiveAccessScope = (): AccessScope | null => scope;
export const getRecoveryBoard = () => current ? { accountId: current.scope.accountId, boardId: current.descriptor.summary.id, title: scope?.title ?? current.descriptor.summary.title } : null;
/** Synchronous acquisition freezes the visible board before any asynchronous work. */
export function getRecoveryRuntime() {
  if (!current || scope?.phase !== 'active' || !journal) throw new Error('Open the authorized board before preparing a recovery copy.');
  const runtime = current; const capturedJournal = journal; const retained = recoveryAssets;
  return { runtime, readLocalAsset: async (id: string) => {
    if (retained.has(id)) return retained.get(id)!;
    const memory = capturedJournal.pendingMemory().find(row => row.kind === 'blob' && row.resource === id);
    if (memory?.data instanceof Blob) return memory.data;
    const checkpoint = await readCheckpoint(capturedJournal.scope, capturedJournal.tabId).catch(() => undefined);
    const asset = checkpoint?.assets[id];
    if (asset?.data) return new Blob([new Uint8Array(asset.data)], { type: asset.mime });
    return null;
  } };
}
export function subscribeAccessScope(listener: () => void): () => void { listeners.add(listener); return () => { listeners.delete(listener); }; }
function publish(value: AccessScope) { scope = Object.freeze(value); listeners.forEach(listener => listener()); }
export function nextAccessGeneration() { return ++generation; }
export function suspendAccessScope(_reason: string): void {
  if (!scope || scope.phase !== 'active') return;
  if (current) {
    current.store.readonly = true;
    if (scope.canWrite && journal) capture.push(
      journal.capture('document', current.descriptor.rootDocId, Y.encodeStateAsUpdate(current.workspace.doc)).catch(() => undefined),
      journal.capture('document', current.descriptor.contentDocId, Y.encodeStateAsUpdate(current.store.spaceDoc)).catch(() => undefined));
    current.workspace.docSync.forceStop(); current.workspace.blobSync.stop();
  }
  publish({ ...scope, phase: 'paused', canWrite: false });
  if (saveScope) dispatchSaveEvent({ type: 'recovery', scope: saveScope, state: 'denied' });
  abort?.abort();
}
export async function preserveCanvasRuntime() { await Promise.all(capture); await journal?.preserve(); await preserveTitle?.(); }
/** Copying an open board requires acknowledgment of its visible native state. */
export async function synchronizeActiveBoard(accountId: string, boardId: string): Promise<(() => void) | undefined> {
  if (!current || current.scope.accountId !== accountId || current.scope.boardId !== boardId) return;
  const runtime = current; const expected = runtime.scope; const localJournal = journal;
  const assertCurrent = () => {
    if (current !== runtime || scope?.generation !== expected.generation || scope.phase !== 'active' || !scope.canWrite) throw new Error('Board access changed. Reopen the board before copying.');
  };
  assertCurrent();
  const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
  const same = (left: Uint8Array, right: Uint8Array) => left.length === right.length && left.every((byte, index) => byte === right[index]);
  try {
    await Promise.race([
      (async () => {
        if (!localJournal) throw new Error('Pending changes are unavailable');
        for (let attempt = 0; attempt < 3; attempt++) {
          assertCurrent(); if (controller.signal.aborted) throw new Error('Copy synchronization timed out');
          const root = Y.encodeStateAsUpdate(runtime.workspace.doc); const content = Y.encodeStateAsUpdate(runtime.store.spaceDoc);
          await localJournal.capture('document', runtime.descriptor.rootDocId, root);
          await localJournal.capture('document', runtime.descriptor.contentDocId, content);
          await localJournal.preserve(); assertCurrent();
          await replayJournal(runtime.descriptor, accountId, controller.signal, false, false, replayObserver); assertCurrent();
          if (same(root, Y.encodeStateAsUpdate(runtime.workspace.doc)) && same(content, Y.encodeStateAsUpdate(runtime.store.spaceDoc))) return;
        }
        throw new Error('The board is still changing');
      })(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('Copy synchronization timed out')); }, 10000); }),
    ]);
    assertCurrent(); return assertCurrent;
  } catch {
    throw new Error('The pending changes could not be saved. Your source is still open. Retry copying when saving is available.');
  } finally { clearTimeout(timer); controller.abort(); }
}
export function disposeCanvasRuntime(expectedGeneration = scope?.generation): void {
  if (!scope || scope.generation !== expectedGeneration) return;
  const old = current; current = null; pending = null;
  captureTitle = undefined; preserveTitle = undefined;
  recoveryAssets = new Map();
  recovery?.dispose(); recovery = undefined;
  if (saveScope) dispatchSaveEvent({ type: 'recovery', scope: saveScope, state: 'disposed' });
  publish({ ...scope, phase: 'disposed', canWrite: false });
  old?.dispose();
}
/** Native consumers can only acquire the already-authorized active scope. */
export function getCanvasRuntime(options?: AccountWorkspaceOptions): Promise<CanvasRuntime> {
  if (!options) {
    if (scope?.phase !== 'active' || !pending) return Promise.reject(new Error('Board access is unavailable'));
    return pending.promise;
  }
  const key = JSON.stringify([options.accountId, options.descriptor.summary.id, options.generation]);
  if (pending?.key === key && scope?.phase === 'active') return pending.promise;
  disposeCanvasRuntime();
  const initial: AccessScope = { accountId: options.accountId, boardId: options.descriptor.summary.id, generation: options.generation,
    role: options.descriptor.summary.role, canWrite: options.descriptor.summary.role !== 'viewer', phase: 'active' };
  publish(initial); const statusScope = JSON.stringify([key, options.descriptor.recoveryEpoch]); saveScope = statusScope; resetSaveStatus(statusScope);
  abort = new AbortController(); const requestAbort = abort;
  options.signal?.addEventListener('abort', () => requestAbort.abort(), { once: true });
  capture = [];
  storagePaused = false;
  const retainedAssets = recoveryAssets = new Map<string, Blob>();
  const scopedJournal = new AccountJournal({ ...initial, recoveryEpoch: options.descriptor.recoveryEpoch }, () => { if (scope?.generation === initial.generation) pauseRecoveryStorage(); });
  journal = scopedJournal;
  const isCurrent = () => scope?.generation === initial.generation && scope.phase === 'active';
  let baseline: AccountWorkspaceOptions['recoveryBaseline'];
  let initializing = true;
  let authorizedDescriptor = options.descriptor;
  const durableTitles = titleIntentStore(scopedJournal.scope);
  let unpreservedTitle: TitleIntent | undefined;
  const titles: TitleStore = { ...durableTitles, read: async () => unpreservedTitle ?? durableTitles.read(), write: async value => {
    unpreservedTitle = value;
    try { await durableTitles.write(value); if (unpreservedTitle?.operationId === value.operationId) unpreservedTitle = undefined; }
    catch (error) { if (isCurrent()) pauseRecoveryStorage(); throw error; }
  } };
  preserveTitle = async () => { if (unpreservedTitle) await titles.write(unpreservedTitle); };
  let titleQueue = Promise.resolve();
  captureTitle = title => {
    const work = titleQueue.then(async () => {
      if (!isCurrent() || !scope?.canWrite || storagePaused) throw new Error('Editing is paused. Retry saving before renaming.');
      publish({ ...scope, title });
      dispatchSaveEvent({ type: 'title', scope: statusScope, id: crypto.randomUUID(), outcome: 'pending', at: Date.now() });
      const intent = await captureTitleIntent(titles, authorizedDescriptor, title, true);
      if (!isCurrent()) return;
      dispatchSaveEvent({ type: 'title', scope: statusScope, id: intent.operationId, outcome: 'pending', at: Date.now() });
      dispatchSaveEvent({ type: 'preserved', scope: statusScope });
      void coordinator.retryRecovery();
    });
    titleQueue = work.catch(() => {}); capture.push(work.catch(() => {})); return work;
  };
  const confirmed = new Map<string, Y.Doc>();
  const live = new Map<string, Y.Doc>();
  const revisions = new Map<string, number>();
  const imageLabels = new Map<string, string>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const covered = (id: string) => {
    const known = confirmed.get(id); const doc = live.get(id);
    return !!known && !!doc && !known.store.pendingStructs && !known.store.pendingDs && Y.snapshotContainsUpdate(Y.snapshot(known), Y.encodeStateAsUpdate(doc));
  };
  const coverage = () => {
    if (!isCurrent() || live.size !== 2) return;
    const images: { id: string; label: string }[] = [];
    live.get(options.descriptor.contentDocId)!.getMap<Y.Map<unknown>>('blocks').forEach(block => {
      const id = block.get('prop:sourceId'); if (block.get('sys:flavour') !== 'affine:image' || typeof id !== 'string') return;
      if (!imageLabels.has(id)) imageLabels.set(id, `Image ${imageLabels.size + 1}`);
      if (!images.some(image => image.id === id)) images.push({ id, label: imageLabels.get(id)! });
    });
    reportSaveCoverage({ type: 'coverage', scope: statusScope, documents: Object.fromEntries([...live.keys()].map(id => [id, { revision: revisions.get(id) ?? 0, acknowledged: covered(id) }])), images, at: Date.now() });
  };
  const documentOutcome: NonNullable<AccountWorkspaceOptions['onDocumentOutcome']> = (id, data, outcome, attempt) => {
    if (!isCurrent()) return;
    if (outcome === 'sending') timers.set(attempt, setTimeout(() => { if (isCurrent() && !covered(id)) dispatchSaveEvent({ type: 'document-failure', scope: statusScope, docId: id }); }, 15000));
    else { clearTimeout(timers.get(attempt)); timers.delete(attempt); }
    if (outcome === 'loaded' || outcome === 'acknowledged') {
      const doc = confirmed.get(id) ?? new Y.Doc({ guid: id }); confirmed.set(id, doc); Y.applyUpdate(doc, new Uint8Array(data)); coverage();
    } else if (outcome === 'failed' && !covered(id)) dispatchSaveEvent({ type: 'document-failure', scope: statusScope, docId: id });
  };
  const imageOutcome: NonNullable<AccountWorkspaceOptions['onImageOutcome']> = (id, outcome, attempt) => {
    if (!isCurrent()) return;
    if (outcome === 'sending') timers.set(attempt, setTimeout(() => { if (isCurrent()) { reportImageOutcome({ type: 'image', scope: statusScope, id, outcome: 'failed', attempt, at: Date.now() }); coordinator.retryIfIdle(); } }, 15000));
    else { clearTimeout(timers.get(attempt)); timers.delete(attempt); }
    if (outcome === 'loaded' && baseline?.assets.has(id)) return;
    reportImageOutcome({ type: 'image', scope: statusScope, id, outcome: outcome === 'loaded' ? 'acknowledged' : outcome, attempt, at: Date.now() });
    if (outcome === 'failed') queueMicrotask(() => { if (isCurrent()) coordinator.retryIfIdle(); });
  };
  const observeReplay: ReplayObserver = (record, outcome, attempt) => {
    if (record.kind === 'blob') imageOutcome(record.resource, outcome, attempt);
    else documentOutcome(record.resource, record.data as Uint8Array, outcome, attempt);
  };
  replayObserver = observeReplay;
  const coordinator = recovery = new RecoveryCoordinator({
    current: isCurrent,
    title: async (authority, signal) => {
      const titleScopes = await inspectPendingScopes(initial.accountId);
      if (!options.openRestored && titleScopes.some(row => row.boardId === initial.boardId && row.epoch !== authority.descriptor.recoveryEpoch)) throw new RecoveryEpochError('RECOVERY_EPOCH_MISMATCH');
      const intent = await titles.read(); if (!intent) { authorizedDescriptor = authority.descriptor; return; }
      if (!isCurrent()) throw new Error('Stale title recovery');
      publish({ ...scope!, title: intent.title });
      dispatchSaveEvent({ type: 'title', scope: statusScope, id: intent.operationId, outcome: 'pending', at: Date.now() });
      dispatchSaveEvent({ type: 'preserved', scope: statusScope });
      try {
        const result = await replayTitleIntent(titles, authority, async (path, init) => {
          if (!isCurrent() || signal.aborted) throw new Error('Stale title recovery');
          const response = await fetch(path, { ...init, signal, cache: 'no-store', headers: { 'X-Dali-Account': initial.accountId, 'X-Dali-Request': '1', 'X-Dali-Recovery-Epoch': authority.descriptor.recoveryEpoch, 'Content-Type': 'application/json' } });
          if (!isCurrent() || signal.aborted) throw new Error('Stale title recovery');
          if (!response.ok) throw [401,403,404].includes(response.status) ? new SourceAccessError(response.status) : new Error('Your pending name could not be saved.');
          if (init?.method === 'PATCH' && response.headers.get('X-Dali-Recovery-Epoch') !== authority.descriptor.recoveryEpoch) throw new RecoveryEpochError('RECOVERY_EPOCH_MISMATCH');
          return response.json();
        });
        if (!isCurrent()) return;
        if (result) { authorizedDescriptor = result; authority.descriptor = result; if (current) current.descriptor = result; }
        dispatchSaveEvent({ type: 'title', scope: statusScope, id: intent.operationId, outcome: 'acknowledged', at: Date.now() });
      } catch (error) {
        if (isCurrent()) dispatchSaveEvent({ type: 'title', scope: statusScope, id: intent.operationId, outcome: 'failed', at: Date.now() });
        throw error;
      }
    },
    authorize: async signal => {
      const session = await fetch('/api/session', { cache: 'no-store', signal, headers: { 'X-Dali-Account': options.accountId } });
      if (!session.ok) throw [401, 403, 404, 409].includes(session.status) ? new SourceAccessError(session.status) : new Error('Session unavailable');
      const member = await session.json() as { accountId: string; expiresAt: number };
      if (!isCurrent() || member.accountId !== options.accountId) throw new SourceAccessError(409);
      if (!Number.isSafeInteger(member.expiresAt) || member.expiresAt <= Date.now()) throw new SourceAccessError(401);
      const response = await fetch(`/api/boards/${encodeURIComponent(initial.boardId)}`, { cache: 'no-store', signal, headers: { 'X-Dali-Account': options.accountId } });
      if (!response.ok) throw [401, 403, 404, 409].includes(response.status) ? new SourceAccessError(response.status) : new Error('Board unavailable');
      const descriptor = await response.json() as BoardDescriptor;
      if (!isCurrent() || !validDescriptor(descriptor, options.accountId) || descriptor.summary.id !== initial.boardId) throw new SourceAccessError(409);
      if (descriptor.recoveryEpoch !== options.descriptor.recoveryEpoch) throw new RecoveryEpochError('RECOVERY_EPOCH_MISMATCH');
      return { ...member, descriptor };
    },
    inspect: async authority => {
      const allRows = await pendingRecords(initial.accountId, initial.boardId);
      const rows = options.openRestored ? allRows.filter(row => row.epoch === authority.descriptor.recoveryEpoch) : allRows;
      if (!isCurrent()) throw new Error('Stale recovery');
      if (rows.some(row => row.epoch !== authority.descriptor.recoveryEpoch)) throw new RecoveryEpochError('RECOVERY_EPOCH_MISMATCH');
      if (rows.some(row => !validRecord(row))) throw new RecoveryStorageError('CORRUPT');
      if (rows.length && initializing) {
        const checkpoints = await Promise.all([...new Set([scopedJournal.tabId, ...rows.map(row => row.tabId!)])].map(tab => readCheckpoint(scopedJournal.scope, tab)));
        if (!isCurrent()) throw new Error('Stale recovery');
        const checkpoint = checkpoints.find(Boolean);
        if (checkpoint) {
          if (checkpoint.root.docId !== options.descriptor.rootDocId || checkpoint.content.docId !== options.descriptor.contentDocId || rows.some(row => row.kind === 'document' && ![checkpoint.root.docId, checkpoint.content.docId].includes(row.resource))) throw new RecoveryStorageError('CORRUPT');
          const merged = (id: string, data: Uint8Array) => Y.mergeUpdates([data, ...rows.filter(row => row.kind === 'document' && row.resource === id).map(row => row.data as Uint8Array)]);
          const assets = new Map<string, Blob>();
          for (const [key, asset] of Object.entries(checkpoint.assets)) if (asset.data) assets.set(key, new Blob([new Uint8Array(asset.data)], { type: asset.mime }));
          for (const row of rows) if (row.kind === 'blob') assets.set(row.resource, row.data instanceof Blob ? row.data : new Blob([new Uint8Array(row.data)], { type: row.mime }));
          baseline = { root: merged(checkpoint.root.docId, checkpoint.root.data), content: merged(checkpoint.content.docId, checkpoint.content.data), assets };
        }
      }
      return rows.length > 0;
    },
    preserve: async () => { await scopedJournal.preserve(); if (unpreservedTitle) await titles.write(unpreservedTitle); },
    verify: async (authority, signal) => {
      const snapshot = getAccountSaveSnapshot();
      if (snapshot?.scope !== statusScope) return;
      const source = new BoardBlobSource({ ...authority.descriptor, boardId: initial.boardId, accountId: initial.accountId, generation: initial.generation,
        signal, isCurrent, fetch: options.fetch, onImageOutcome: (id, outcome, attempt) => imageOutcome(id, outcome === 'loaded' ? 'acknowledged' : outcome, attempt),
        onFetchedBlob: (id, value) => scopedJournal.cacheAsset(id, value) });
      try {
        for (const row of Object.values(snapshot.images)) if (row.required && row.state !== 'saved') {
          if (!await source.get(row.id)) throw new Error('Required image unavailable');
        }
      } finally { source.dispose(); }
    },
    drain: async (authority, signal) => {
      await replayJournal(authority.descriptor, initial.accountId, signal, false, options.openRestored, observeReplay);
      const remaining = await pendingRecords(initial.accountId, initial.boardId);
      if (remaining.some(row => !options.openRestored || row.epoch === authority.descriptor.recoveryEpoch)) throw new Error('New changes are waiting to save');
    },
    changed: (recoveryState, stalled) => {
      if (!isCurrent()) return;
      dispatchSaveEvent({ type: 'recovery', scope: statusScope, state: recoveryState, stalled });
      if (recoveryState === 'storage-paused') { pauseRecoveryStorage(); return; }
      if (recoveryState === 'saved' && storagePaused) {
        storagePaused = false;
        if (current) { current.store.readonly = false; current.workspace.docSync.start(); }
      }
      const blocked = storagePaused || ['corrupt', 'epoch-mismatch', 'expired', 'denied'].includes(recoveryState);
      if (current && blocked) current.store.readonly = true;
      publish({ ...scope!, canWrite: !blocked && initial.role !== 'viewer', recoveryState: storagePaused ? 'storage-paused' : recoveryState, stalled });
      if (recoveryState === 'expired') void interruptSession();
    },
  });
  requestAbort.signal.addEventListener('abort', () => coordinator.dispose(), { once: true });
  const promise = coordinator.open().then(authority => {
    if (!authority) { if (scope?.recoveryState === 'denied') throw new SourceAccessError(404); throw new Error('Board unavailable'); }
    if (scope?.recoveryState === 'denied' && authority.descriptor.summary.role !== 'viewer') throw new SourceAccessError(403);
    if (['corrupt', 'epoch-mismatch'].includes(scope?.recoveryState ?? '')) throw Object.assign(new Error('Recovery needs attention'), { recoveryState: scope!.recoveryState });
    // Once replay is acknowledged, ordinary server hydration owns freshness and
    // image loading/error feedback. Local hydration is reserved for pending work.
    if (scope?.recoveryState === 'saved') baseline = undefined;
    initializing = false;
    authorizedDescriptor = authority.descriptor;
    publish({ ...scope!, role: authority.descriptor.summary.role, canWrite: !storagePaused && authority.descriptor.summary.role !== 'viewer' });
    return import('./account/board-workspace');
  }).then(({ createAccountWorkspace }) => createAccountWorkspace({ ...options, descriptor: authorizedDescriptor, isCurrent, recoveryBaseline: baseline,
    // Workspace lifetime is distinct from request cancellation while preservation is pending.
    durableLocalBlobs: true,
    onDocumentOutcome: documentOutcome,
    onImageOutcome: imageOutcome,
    fetch: (input, init) => {
      const url = new URL(String(input), location.href); const key = decodeURIComponent(url.pathname.split('/blobs/')[1] ?? '');
      const local = baseline?.assets.get(key);
      if (isCurrent() && init?.method === 'GET' && local) return Promise.resolve(new Response(local, { headers: { 'Content-Type': local.type } }));
      return (options.fetch ?? fetch)(input, { ...init, signal: requestAbort.signal });
    },
    onPendingDocument: (id, data) => scopedJournal.captureSubmission(id, data),
    onPendingBlob: (key, value) => { retainedAssets.set(key, value); return scopedJournal.capture('blob', key, value); },
    onFetchedBlob: authorizedDescriptor.summary.role !== 'viewer' ? async (key, value) => {
      retainedAssets.set(key, value);
      try { await scopedJournal.cacheAsset(key, value); }
      catch (error) {
        // Admission failure already retains bytes and pauses edits. Reading an
        // authorized image must still work for inspection and recovery export.
        if (error instanceof RecoveryStorageError && error.code === 'CORRUPT') throw error;
      }
    } : undefined,
    onAcknowledged: token => {
      if (typeof token === 'string') return scopedJournal.acknowledge([token]);
      const receipt = token as Awaited<ReturnType<AccountJournal['captureSubmission']>>;
      if (receipt?.scope !== scopedJournal.scope || !Array.isArray(receipt.ids)) return Promise.reject(new Error('Recovery acknowledgment scope changed'));
      return scopedJournal.acknowledge(receipt.ids);
    },
    beforeDocumentWrite: async () => { await coordinator.retryRecovery(); if (!isCurrent() || scope?.recoveryState !== 'saved') throw new Error('Recovery is pending'); },
    onAuthorizationLost: error => {
      if (isCurrent()) { suspendAccessScope('authorization'); if (error.status === 401) void interruptSession(); else if (error.status === 409) void revalidateSession(); }
      if (![401, 409].includes(error.status)) options.onAuthorizationLost?.(error);
    },
  })).then(async workspace => {
    if (!isCurrent()) { workspace.dispose(); throw new Error('Board access changed'); }
    const store = workspace.getDoc(options.descriptor.contentDocId)!.getStore();
    const local = authorizedDescriptor.summary.role !== 'viewer' ? attachLocalCapture({ journal: scopedJournal, root: workspace.doc, content: store.spaceDoc, title: options.descriptor.summary.title, isCurrent }) : undefined;
    try {
      try { await local?.ready; } catch { pauseRecoveryStorage(); }
      if (local) {
        void requestRecoveryStorage();
        const keys = new Set<string>();
        store.spaceDoc.getMap<Y.Map<unknown>>('blocks').forEach(block => { if (block.get('sys:flavour') === 'affine:image' && typeof block.get('prop:sourceId') === 'string') keys.add(block.get('prop:sourceId') as string); });
        // Fetches cache available bytes; loading/missing images keep their existing visible retry flow.
        void Promise.all([...keys].map(key => workspace.blobSync.get(key))).catch(() => undefined);
      }
      if (!isCurrent()) throw new Error('Board access changed');
    }
    catch (error) { local?.dispose(); workspace.dispose(); throw error; }
    live.set(workspace.doc.guid, workspace.doc); live.set(store.spaceDoc.guid, store.spaceDoc);
    const changed = (_data: Uint8Array, _origin: unknown, doc: Y.Doc) => {
      if (!isCurrent()) return;
      revisions.set(doc.guid, (revisions.get(doc.guid) ?? 0) + 1); coverage();
      const version = JSON.stringify([...revisions]);
      void scopedJournal.preserve().then(() => { if (isCurrent() && JSON.stringify([...revisions]) === version) dispatchSaveEvent({ type: 'preserved', scope: statusScope }); }).catch(() => undefined);
    };
    workspace.doc.on('update', changed); store.spaceDoc.on('update', changed); coverage();
    const stopStatus = () => { workspace.doc.off('update', changed); store.spaceDoc.off('update', changed); for (const timer of timers.values()) clearTimeout(timer); timers.clear(); for (const doc of confirmed.values()) doc.destroy(); confirmed.clear(); };
    const value: CanvasRuntime = { workspace, store, descriptor: structuredClone(authorizedDescriptor), scope: scope!,
      stopSaveStatus: stopStatus, dispose: () => { local?.dispose(); stopStatus(); workspace.dispose(); } };
    current = value;
    if (storagePaused) { store.readonly = true; workspace.docSync.forceStop(); }
    return value;
  }).catch(error => { for (const timer of timers.values()) clearTimeout(timer); for (const doc of confirmed.values()) doc.destroy(); if (pending?.key === key) pending = null; throw error; });
  pending = { key, promise }; return promise;
}
