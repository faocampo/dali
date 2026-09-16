import type { Store, Workspace } from '@blocksuite/affine/store';
import type { BoardDescriptor, BoardSummary } from '../boards/BoardLibrary';
import type { AccountWorkspaceOptions, BoardWorkspace } from './account/board-workspace';
import { reportDocEngineStatus, resetSaveStatus } from './save-status';
import * as Y from 'yjs';
import { AccountJournal, acknowledgeRecord, replayJournal } from './account/outbox';
import { interruptSession, revalidateSession } from '../auth/session';

export type BoardRole = BoardSummary['role'];
export type AccessScope = Readonly<{ accountId: string; boardId: string; generation: number; role: BoardRole; canWrite: boolean; phase: 'active' | 'paused' | 'disposed' }>;
export type CanvasRuntime = { workspace: Workspace & Pick<BoardWorkspace, 'docSync' | 'waitForSynced'>; store: Store; descriptor: BoardDescriptor; scope: AccessScope; stopSaveStatus: () => void; dispose: () => void };
let scope: AccessScope | null = null;
let current: CanvasRuntime | null = null;
let pending: { key: string; promise: Promise<CanvasRuntime> } | null = null;
let generation = 0;
let journal: AccountJournal | undefined;
let abort: AbortController | undefined;
let capture: Promise<unknown>[] = [];
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
  const scopedJournal = new AccountJournal(initial, () => { queueMicrotask(() => { void interruptSession(); }); });
  journal = scopedJournal;
  const isCurrent = () => scope?.generation === initial.generation && scope.phase === 'active';
  const promise = replayJournal(options.descriptor, options.accountId, requestAbort.signal).then(() => import('./account/board-workspace')).then(({ createAccountWorkspace }) => createAccountWorkspace({ ...options, isCurrent,
    // Workspace lifetime is distinct from request cancellation while preservation is pending.
    durableLocalBlobs: true,
    fetch: (input, init) => (options.fetch ?? fetch)(input, { ...init, signal: requestAbort.signal }),
    onPendingDocument: (id, data) => scopedJournal.capture('document', id, data),
    onPendingBlob: (key, value) => scopedJournal.capture('blob', key, value),
    onAcknowledged: token => typeof token === 'string' ? acknowledgeRecord(token) : Promise.resolve(),
    beforeDocumentWrite: () => replayJournal(options.descriptor, options.accountId, requestAbort.signal, true).then(() => undefined),
    onAuthorizationLost: error => {
      if (isCurrent()) { suspendAccessScope('authorization'); if (error.status === 401) void interruptSession(); else if (error.status === 409) void revalidateSession(); }
      if (![401, 409].includes(error.status)) options.onAuthorizationLost?.(error);
    },
  })).then(workspace => {
    if (!isCurrent()) { workspace.dispose(); throw new Error('Board access changed'); }
    const store = workspace.getDoc(options.descriptor.contentDocId)!.getStore();
    reportDocEngineStatus(workspace.docSync.status);
    const subscription = workspace.docSync.onStatusChange.subscribe(reportDocEngineStatus);
    const value: CanvasRuntime = { workspace, store, descriptor: structuredClone(options.descriptor), scope: scope!,
      stopSaveStatus: () => subscription.unsubscribe(), dispose: () => { subscription.unsubscribe(); workspace.dispose(); } };
    current = value; return value;
  }).catch(error => { if (pending?.key === key) pending = null; throw error; });
  pending = { key, promise }; return promise;
}
