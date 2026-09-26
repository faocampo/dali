import type { Store, Workspace } from '@blocksuite/affine/store';
import { validDescriptor, type BoardDescriptor, type BoardSummary } from '../boards/BoardLibrary';
import type { AccountWorkspaceOptions, BoardWorkspace } from './account/board-workspace';
import { reportDocEngineStatus, resetSaveStatus } from './save-status';
import * as Y from 'yjs';
import { AccountJournal, replayJournal, requestRecoveryStorage, pendingRecords, readCheckpoint, validRecord, RecoveryStorageError } from './account/outbox';
import { RecoveryCoordinator, type RecoveryOutcome } from './account/recovery';
import { RecoveryEpochError, SourceAccessError } from './account/doc-source';
import { interruptSession, revalidateSession } from '../auth/session';
import { attachLocalCapture } from './account/local-capture';

export type BoardRole = BoardSummary['role'];
export type AccessScope = Readonly<{ accountId: string; boardId: string; generation: number; role: BoardRole; canWrite: boolean; phase: 'active' | 'paused' | 'disposed'; recoveryState?: RecoveryOutcome; stalled?: boolean }>;
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
export const retryRecovery = () => recovery?.retryRecovery();
export function pauseRecoveryStorage() {
  if (!scope || scope.phase !== 'active') return;
  storagePaused = true;
  if (current) { current.store.readonly = true; current.workspace.docSync.forceStop(); }
  publish({ ...scope, canWrite: false, recoveryState: 'storage-paused' });
}
const listeners = new Set<() => void>();
export const getActiveAccessScope = (): AccessScope | null => scope;
export const getRecoveryBoard = () => current ? { accountId: current.scope.accountId, boardId: current.descriptor.summary.id, title: current.descriptor.summary.title } : null;
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
  abort?.abort();
}
export async function preserveCanvasRuntime() { await Promise.all(capture); await journal?.preserve(); }
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
          await replayJournal(runtime.descriptor, accountId, controller.signal); assertCurrent();
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
  recovery?.dispose(); recovery = undefined;
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
  publish(initial); resetSaveStatus();
  abort = new AbortController(); const requestAbort = abort;
  options.signal?.addEventListener('abort', () => requestAbort.abort(), { once: true });
  capture = [];
  storagePaused = false;
  const scopedJournal = new AccountJournal({ ...initial, recoveryEpoch: options.descriptor.recoveryEpoch }, () => { if (scope?.generation === initial.generation) pauseRecoveryStorage(); });
  journal = scopedJournal;
  const isCurrent = () => scope?.generation === initial.generation && scope.phase === 'active';
  let baseline: AccountWorkspaceOptions['recoveryBaseline'];
  let initializing = true;
  let authorizedDescriptor = options.descriptor;
  const coordinator = recovery = new RecoveryCoordinator({
    current: isCurrent,
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
    preserve: () => scopedJournal.preserve(),
    drain: async (authority, signal) => {
      await replayJournal(authority.descriptor, initial.accountId, signal, false, options.openRestored);
      const remaining = await pendingRecords(initial.accountId, initial.boardId);
      if (remaining.some(row => !options.openRestored || row.epoch === authority.descriptor.recoveryEpoch)) throw new Error('New changes are waiting to save');
    },
    changed: (recoveryState, stalled) => {
      if (!isCurrent()) return;
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
    fetch: (input, init) => {
      const url = new URL(String(input), location.href); const key = decodeURIComponent(url.pathname.split('/blobs/')[1] ?? '');
      const local = baseline?.assets.get(key);
      if (isCurrent() && init?.method === 'GET' && local) return Promise.resolve(new Response(local, { headers: { 'Content-Type': local.type } }));
      return (options.fetch ?? fetch)(input, { ...init, signal: requestAbort.signal });
    },
    onPendingDocument: (id, data) => scopedJournal.captureSubmission(id, data),
    onPendingBlob: (key, value) => scopedJournal.capture('blob', key, value),
    onFetchedBlob: authorizedDescriptor.summary.role !== 'viewer' ? async (key, value) => {
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
    reportDocEngineStatus(workspace.docSync.status);
    const subscription = workspace.docSync.onStatusChange.subscribe(reportDocEngineStatus);
    const value: CanvasRuntime = { workspace, store, descriptor: structuredClone(authorizedDescriptor), scope: scope!,
      stopSaveStatus: () => subscription.unsubscribe(), dispose: () => { local?.dispose(); subscription.unsubscribe(); workspace.dispose(); } };
    current = value;
    if (storagePaused) { store.readonly = true; workspace.docSync.forceStop(); }
    return value;
  }).catch(error => { if (pending?.key === key) pending = null; throw error; });
  pending = { key, promise }; return promise;
}
