import type { Store, Workspace } from '@blocksuite/affine/store';
import type { BoardDescriptor, BoardSummary } from '../boards/BoardLibrary';
import type { AccountWorkspaceOptions, BoardWorkspace } from './account/board-workspace';
import { reportDocEngineStatus, resetSaveStatus } from './save-status';

export type BoardRole = BoardSummary['role'];
export type AccessScope = Readonly<{ accountId: string; boardId: string; generation: number; role: BoardRole; canWrite: boolean; phase: 'active' | 'paused' | 'disposed' }>;
export type CanvasRuntime = { workspace: Workspace & Pick<BoardWorkspace, 'docSync' | 'waitForSynced'>; store: Store; descriptor: BoardDescriptor; scope: AccessScope; stopSaveStatus: () => void; dispose: () => void };
let scope: AccessScope | null = null;
let current: CanvasRuntime | null = null;
let pending: { key: string; promise: Promise<CanvasRuntime> } | null = null;
let generation = 0;
const listeners = new Set<() => void>();
export const getActiveAccessScope = (): AccessScope | null => scope;
export function subscribeAccessScope(listener: () => void): () => void { listeners.add(listener); return () => { listeners.delete(listener); }; }
function publish(value: AccessScope) { scope = Object.freeze(value); listeners.forEach(listener => listener()); }
export function nextAccessGeneration() { return ++generation; }
export function suspendAccessScope(_reason: string): void {
  if (!scope || scope.phase !== 'active') return;
  if (current) { current.store.readonly = true; current.workspace.docSync.forceStop(); }
  publish({ ...scope, phase: 'paused', canWrite: false });
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
  const isCurrent = () => scope?.generation === initial.generation && scope.phase === 'active';
  const promise = import('./account/board-workspace').then(({ createAccountWorkspace }) => createAccountWorkspace({ ...options, isCurrent,
    onAuthorizationLost: error => { if (isCurrent()) suspendAccessScope('authorization'); options.onAuthorizationLost?.(error); },
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
