import type { Store, Workspace } from '@blocksuite/affine/store';
import { validDescriptor, type BoardDescriptor, type BoardSummary } from '../boards/BoardLibrary';
import type { AccountWorkspaceOptions, BoardWorkspace } from './account/board-workspace';
import { resetSaveStatus, dispatchSaveEvent, reportSaveCoverage, reportImageOutcome, getAccountSaveSnapshot } from './save-status';
import { BoardBlobSource } from './account/blob-source';
import * as Y from 'yjs';
import { AccountJournal, replayJournal, requestRecoveryStorage, pendingRecords, readCheckpoint, validRecord, RecoveryStorageError, type ReplayObserver } from './account/outbox';
import { RecoveryCoordinator, recoveryStorageFailure, type RecoveryStorageFailure, type RecoveryOutcome } from './account/recovery';
import { BoardDocSource, RecoveryEpochError, SourceAccessError } from './account/doc-source';
import { acknowledgedUpdateCovered } from './account/acknowledged-update';
import { getSessionState, interruptSession, revalidateSession } from '../auth/session';
import { attachLocalCapture } from './account/local-capture';
import { titleIntentStore, inspectPendingScopes, pendingTitleIntents, acknowledgeRecoveredTitle, markRecoveryPermissionLoss, recoveryPermissionConfirmation, resolveRecoveryPermission } from './account/outbox';
import { captureTitleIntent, replayTitleIntent, advanceLiveTitleIntent, validDocumentRevisionReceipt, validTitleIntent, type DocumentRevisionReceipt, bufferedTitleStore } from './account/title-intent';
import { reconcileRecoveryReceipts, recoveryVersionsDiffer, validSharedRecoveryBaseline, type RecoveryReceipt, type SharedRecoveryBaseline } from './account/recovery-baseline';
import { replayLiveCandidate, RecoveryChoiceError } from './account/live-recovery';

let captureTitle: ((title: string) => Promise<void>) | undefined;
let preserveTitle: (() => Promise<void>) | undefined;
let confirmRestoredRecovery: (() => Promise<boolean>) | undefined;
export const restorePendingRecovery = () => confirmRestoredRecovery?.() ?? Promise.resolve(false);
export async function renameActiveBoard(title: string) { if (!captureTitle) throw new Error('Board access is unavailable'); await captureTitle(title); }

export type BoardRole = BoardSummary['role'];
export type AccessScope = Readonly<{ accountId: string; boardId: string; generation: number; role: BoardRole; canWrite: boolean; phase: 'active' | 'paused' | 'disposed'; recoveryState?: RecoveryOutcome; recoveryChoice?: 'divergent' | 'unknown' | 'unchanged' | 'restored'; storageFailure?: RecoveryStorageFailure; retainedPending?: boolean | 'unavailable'; stalled?: boolean; title?: string }>;
export type CanvasRuntime = { workspace: Workspace & Pick<BoardWorkspace, 'docSync' | 'waitForSynced' | 'live'>; store: Store; descriptor: BoardDescriptor; scope: AccessScope; captureUnacknowledged: () => Promise<unknown>[]; stopSaveStatus: () => void; dispose: () => void };
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
let replayDocumentCommit: ((receipt: DocumentRevisionReceipt) => Promise<void>) | undefined;
let recoveryAssets = new Map<string, Blob>();
export const retryRecovery = () => recovery?.retryRecovery();
export function pauseRecoveryStorage(error?: unknown) {
  if (!scope || scope.phase !== 'active') return;
  storagePaused = true;
  if (current) { current.store.readonly = true; current.workspace.docSync.forceStop(); }
  publish({ ...scope, canWrite: false, recoveryState: 'storage-paused', storageFailure: error === undefined ? scope.storageFailure ?? 'unavailable' : recoveryStorageFailure(error) });
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
    if (scope.canWrite && journal) capture.push(...current.captureUnacknowledged());
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
        if (runtime.descriptor.liveEnabled) {
          if (!runtime.workspace.live?.connected) throw new Error('Recovery needs a version decision');
          await runtime.workspace.waitForSynced(); assertCurrent();
          if (getAccountSaveSnapshot()?.state !== 'saved' || (await pendingRecords(accountId, boardId)).some(row => row.tabId === localJournal.tabId)) throw new Error('Changes are waiting to save');
          return;
        }
        for (let attempt = 0; attempt < 3; attempt++) {
          assertCurrent(); if (controller.signal.aborted) throw new Error('Copy synchronization timed out');
          const root = Y.encodeStateAsUpdate(runtime.workspace.doc); const content = Y.encodeStateAsUpdate(runtime.store.spaceDoc);
          await localJournal.capture('document', runtime.descriptor.rootDocId, root);
          await localJournal.capture('document', runtime.descriptor.contentDocId, content);
          await localJournal.preserve(); assertCurrent();
          await replayJournal(runtime.descriptor, accountId, controller.signal, false, false, replayObserver, replayDocumentCommit); assertCurrent();
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
  captureTitle = undefined; preserveTitle = undefined; replayDocumentCommit = undefined;
  confirmRestoredRecovery = undefined;
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
  const scopedJournal = new AccountJournal({ ...initial, recoveryEpoch: options.descriptor.recoveryEpoch }, error => { if (scope?.generation === initial.generation) pauseRecoveryStorage(error); });
  journal = scopedJournal;
  const isCurrent = () => scope?.generation === initial.generation && scope.phase === 'active';
  let baseline: AccountWorkspaceOptions['recoveryBaseline'];
  let quarantined = false;
  let chosenTab: string | undefined; let chosenConfirmation: string | undefined;
  let restoredConsentTab: string | undefined; let restoredConsentVersion: string | undefined;
  let captureReady = false;
  const sharedEvidence: (() => Promise<void>)[] = [];
  let sharedQueue = Promise.resolve();
  const persistSharedEvidence = () => {
    if (!captureReady || quarantined) return sharedQueue;
    sharedQueue = sharedQueue.catch(() => {}).then(async () => {
      while (sharedEvidence.length) {
        if (!isCurrent()) throw new Error('Stale committed evidence');
        await sharedEvidence[0]!(); sharedEvidence.shift();
      }
    });
    return sharedQueue;
  };
  let initializing = true;
  let authorizedDescriptor = options.descriptor;
  const liveTitleOperations = new Set<string>();
  const titles = bufferedTitleStore(titleIntentStore(scopedJournal.scope, options.descriptor.liveEnabled ? scopedJournal.tabId : undefined), error => {
    if (isCurrent()) pauseRecoveryStorage(error);
  }, value => liveTitleOperations.add(value.operationId));
  const documentCommit: NonNullable<AccountWorkspaceOptions['onDocumentCommit']> = async (receipt, document) => {
    if (!isCurrent() || !validDocumentRevisionReceipt(receipt)) throw new Error('Stale document receipt');
    if (authorizedDescriptor.revision === receipt.previousRevision) authorizedDescriptor.revision = receipt.revision;
    await advanceLiveTitleIntent(titles, liveTitleOperations, receipt);
    if (authorizedDescriptor.liveEnabled && document) {
      const data = new Uint8Array(document.data);
      sharedEvidence.push(() => scopedJournal.acknowledgeSharedUpdate(document.docId, data, receipt.revision));
      await persistSharedEvidence();
    }
    if (!isCurrent()) throw new Error('Stale document receipt');
  };
  preserveTitle = () => titles.preserve();
  replayDocumentCommit = documentCommit;
  let titleQueue = Promise.resolve();
  let attemptedTitle: string | undefined;
  let titlesInFlight = 0;
  let liveMetadataVersion = 0;
  let latestLiveMetadata: { title: string; revision: number } | undefined;
  let acknowledgedTitleRevision = 0;
  const projectLiveMetadata = () => {
    const metadata = latestLiveMetadata;
    if (!metadata || titlesInFlight) return;
    const version = liveMetadataVersion;
    void titles.read().then(intent => {
      if (!isCurrent() || version !== liveMetadataVersion || intent || titlesInFlight || metadata.revision < acknowledgedTitleRevision) return;
      authorizedDescriptor = { ...authorizedDescriptor, revision: Math.max(authorizedDescriptor.revision, metadata.revision), summary: { ...authorizedDescriptor.summary, title: metadata.title } };
      if (current) current.descriptor = structuredClone(authorizedDescriptor);
      publish({ ...scope!, title: metadata.title });
    }).catch(error => { if (isCurrent()) pauseRecoveryStorage(error); });
  };
  captureTitle = title => {
    titlesInFlight++;
    const work = titleQueue.then(async () => {
      if (!isCurrent() || !scope?.canWrite || storagePaused) throw new Error('Editing is paused. Retry saving before renaming.');
      const liveRuntime = current?.workspace.live?.connected ? current : undefined;
      const originalTitle = authorizedDescriptor.summary.title;
      const previous = liveRuntime ? await titles.read() : undefined;
      publish({ ...scope, title });
      dispatchSaveEvent({ type: 'title', scope: statusScope, id: crypto.randomUUID(), outcome: 'pending', at: Date.now() });
      const intent = await captureTitleIntent(titles, authorizedDescriptor, title, true);
      if (!isCurrent()) return;
      dispatchSaveEvent({ type: 'title', scope: statusScope, id: intent.operationId, outcome: 'pending', at: Date.now() });
      dispatchSaveEvent({ type: 'preserved', scope: statusScope });
      if (liveRuntime) {
        try {
          await liveRuntime.workspace.waitForSynced();
          const authority = await authorize(requestAbort.signal);
          if (!isCurrent() || !liveRuntime.workspace.live?.connected) throw new Error('Live editing is paused. Your pending name is preserved.');
          if (authority.descriptor.summary.title !== originalTitle && authority.descriptor.summary.title !== title)
            throw new Error('The board name changed. Your pending name is preserved; review the current name before retrying.');
          // A newly captured, never-submitted rename may use freshly checked
          // authority after preceding canvas saves. Existing uncertain attempts
          // keep their original identity and revision for receipt reconciliation.
          if (previous?.operationId !== intent.operationId && authority.descriptor.revision !== intent.baseRevision)
            await titles.advance?.(intent.operationId, intent.baseRevision, authority.descriptor.revision);
          const result = await replayTitleIntent(titles, authority, async (path, init) => {
            const response = await fetch(path, { ...init, signal: requestAbort.signal, cache: 'no-store', headers: { 'X-Dali-Account': initial.accountId, 'X-Dali-Request': '1', 'X-Dali-Recovery-Epoch': authority.descriptor.recoveryEpoch, 'Content-Type': 'application/json' } });
            if (!isCurrent()) throw new Error('Stale title update');
            if (!response.ok) {
              const body = await response.json().catch(() => ({})) as { editor?: unknown };
              if ([401,403,404].includes(response.status)) throw new SourceAccessError(response.status);
              throw new Error(typeof body.editor === 'string' ? `${body.editor} is editing the board name. Try again when they finish.` : 'The board changed. Your pending name is preserved; review the current board before retrying.');
            }
            if (init?.method === 'PATCH' && response.headers.get('X-Dali-Recovery-Epoch') !== authority.descriptor.recoveryEpoch) throw new RecoveryEpochError('RECOVERY_EPOCH_MISMATCH');
            return response.json();
          }, async (saved, result) => {
            if (!isCurrent()) throw new Error('Stale title receipt');
            try { await acknowledgeRecoveredTitle(scopedJournal.scope, scopedJournal.tabId, { operationId: saved.operationId, title: saved.title, revision: result.revision }); }
            catch (error) { if (isCurrent()) pauseRecoveryStorage(error); throw error; }
          });
          if (result) { acknowledgedTitleRevision = result.revision; authorizedDescriptor = result; if (current === liveRuntime) current.descriptor = result; }
          dispatchSaveEvent({ type: 'title', scope: statusScope, id: intent.operationId, outcome: 'acknowledged', at: Date.now() });
        } catch (error) {
          if (isCurrent()) dispatchSaveEvent({ type: 'title', scope: statusScope, id: intent.operationId, outcome: 'failed', at: Date.now(), message: error instanceof Error ? error.message : 'Your pending name could not be saved.' });
          if (error instanceof SourceAccessError || error instanceof RecoveryEpochError) suspendAccessScope('authorization');
          throw error;
        }
        return;
      }
      await coordinator.retryRecovery();
      // A recovery already in flight may have inspected before this capture.
      if (isCurrent() && attemptedTitle !== intent.operationId) await coordinator.retryRecovery();
    }).finally(() => { titlesInFlight--; projectLiveMetadata(); });
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
  const authorize = async (signal: AbortSignal) => {
      if (!isCurrent() || signal.aborted) throw new Error('Stale recovery');
      const session = await fetch('/api/session', { cache: 'no-store', signal, headers: { 'X-Dali-Account': options.accountId } });
      if (!session.ok) throw [401, 403, 404, 409].includes(session.status) ? new SourceAccessError(session.status) : new Error('Session unavailable');
      const member = await session.json() as { accountId: string; expiresAt: number };
      if (!isCurrent() || signal.aborted || member.accountId !== options.accountId) throw new SourceAccessError(409);
      if (!Number.isSafeInteger(member.expiresAt) || member.expiresAt <= Date.now()) throw new SourceAccessError(401);
      const response = await fetch(`/api/boards/${encodeURIComponent(initial.boardId)}`, { cache: 'no-store', signal, headers: { 'X-Dali-Account': options.accountId } });
      if (!response.ok) {
        if (options.descriptor.liveEnabled && [403, 404].includes(response.status)) await markRecoveryPermissionLoss(scopedJournal.scope);
        throw [401, 403, 404, 409].includes(response.status) ? new SourceAccessError(response.status) : new Error('Board unavailable');
      }
      const descriptor = await response.json() as BoardDescriptor;
      if (!isCurrent() || signal.aborted || !validDescriptor(descriptor, options.accountId) || descriptor.summary.id !== initial.boardId) throw new SourceAccessError(409);
      if (descriptor.recoveryEpoch !== options.descriptor.recoveryEpoch) throw new RecoveryEpochError('RECOVERY_EPOCH_MISMATCH');
      return { ...member, descriptor };
  };
  const coordinator = recovery = new RecoveryCoordinator({
    current: isCurrent,
    beforeReplay: async (authority, signal) => {
      if (!authority.descriptor.liveEnabled) return;
      if (!initializing && !quarantined && current?.workspace.live?.connected) return;
      if (current) {
        quarantined = true; current.store.readonly = true; current.workspace.docSync.forceStop();
        publish({ ...scope!, canWrite: false }); await scopedJournal.preserve();
      }
      const allRows = await pendingRecords(initial.accountId, initial.boardId);
      const rows = options.openRestored ? allRows.filter(row => row.epoch === authority.descriptor.recoveryEpoch) : allRows;
      const title = await titles.read();
      const titleRows = await pendingTitleIntents(initial.accountId, initial.boardId);
      if (!isCurrent() || signal.aborted) throw new Error('Stale recovery inspection');
      if (rows.some(row => row.epoch !== authority.descriptor.recoveryEpoch) || !options.openRestored && titleRows.some(row => row.epoch !== authority.descriptor.recoveryEpoch)) throw new RecoveryEpochError('RECOVERY_EPOCH_MISMATCH');
      if (rows.some(row => !validRecord(row)) || titleRows.some(row => !validTitleIntent(row) || row.accountId !== initial.accountId || row.boardId !== initial.boardId)) throw new RecoveryStorageError('CORRUPT');
      if (!rows.length && !titleRows.some(row => row.epoch === authority.descriptor.recoveryEpoch)) { quarantined = false; return; }
      // An online native send owns its own reservation and acknowledgement.
      // The generic recovery drain must never race that ordinary save.
      quarantined = true;
      if (current) { current.store.readonly = true; current.workspace.docSync.forceStop(); }
      publish({ ...scope!, canWrite: false });
      const tab = rows.some(row => row.tabId === scopedJournal.tabId) || title ? scopedJournal.tabId : rows[0]?.tabId ?? titleRows.find(row => row.epoch === authority.descriptor.recoveryEpoch)?.tabId ?? scopedJournal.tabId;
      const candidateTitle = titleRows.find(row => row.epoch === authority.descriptor.recoveryEpoch && row.tabId === tab);
      chosenTab = tab;
      const confirmation = await recoveryPermissionConfirmation(scopedJournal.scope, tab);
      chosenConfirmation = confirmation;
      const candidateRows = rows.filter(row => row.tabId === tab);
      const checkpoint = await readCheckpoint(scopedJournal.scope, tab);
      if (!checkpoint || checkpoint.root.docId !== authority.descriptor.rootDocId || checkpoint.content.docId !== authority.descriptor.contentDocId || candidateRows.some(row => row.kind === 'document' && ![checkpoint.root.docId, checkpoint.content.docId].includes(row.resource))) throw new RecoveryStorageError('CORRUPT');
      if (!isCurrent() || signal.aborted) throw new Error('Stale recovery candidate');
      const merged = (id: string, data: Uint8Array) => Y.mergeUpdates([data, ...candidateRows.filter(row => row.kind === 'document' && row.resource === id).map(row => row.data as Uint8Array)]);
      const assets = new Map<string, Blob>();
      for (const [id, asset] of Object.entries(checkpoint.assets)) if (asset.data) assets.set(id, new Blob([new Uint8Array(asset.data)], { type: asset.mime }));
      for (const row of candidateRows) if (row.kind === 'blob') assets.set(row.resource, row.data instanceof Blob ? row.data : new Blob([new Uint8Array(row.data)], { type: row.mime }));
      baseline = { root: merged(checkpoint.root.docId, checkpoint.root.data), content: merged(checkpoint.content.docId, checkpoint.content.data), assets };
      for (const [id, blob] of assets) retainedAssets.set(id, blob);
      const attempted = candidateRows.filter(row => row.attempt);
      const attempts = attempted.length <= 256 ? attempted.map(row => ({ ...row.attempt!, docId: row.resource })) : [];
      const response = await (options.fetch ?? fetch)(`/api/boards/${encodeURIComponent(initial.boardId)}/recovery/baseline`, {
        method: 'POST', credentials: 'same-origin', cache: 'no-store', signal,
        headers: { 'Content-Type': 'application/json', 'X-Dali-Account': initial.accountId, 'X-Dali-Request': '1', 'X-Dali-Recovery-Epoch': authority.descriptor.recoveryEpoch }, body: JSON.stringify({ attempts, ...(candidateTitle ? { titleAttempt: { operationId: candidateTitle.operationId, title: candidateTitle.title } } : {}) }),
      });
      if (!isCurrent() || signal.aborted) throw new Error('Stale recovery baseline');
      if (!response.ok) {
        const result = await response.json().catch(() => ({})) as { code?: string };
        if (result.code === 'RECOVERY_EPOCH_MISMATCH') throw new RecoveryEpochError('RECOVERY_EPOCH_MISMATCH');
        if ([401, 403, 404, 409].includes(response.status)) throw new SourceAccessError(response.status);
        throw new Error('Recovery baseline unavailable');
      }
      const wire = await response.json();
      const decode = (value: string) => Uint8Array.from(atob(value), c => c.charCodeAt(0));
      const latest: SharedRecoveryBaseline = { ...wire, root: { ...wire.root, data: decode(wire.root?.data) }, content: { ...wire.content, data: decode(wire.content?.data) } };
      if (!validSharedRecoveryBaseline(latest) || latest.epoch !== authority.descriptor.recoveryEpoch || latest.root.docId !== checkpoint.root.docId || latest.content.docId !== checkpoint.content.docId || !Array.isArray(wire.receipts) || wire.receipts.length > attempts.length) throw new Error('Invalid recovery baseline');
      const reconciled = checkpoint.shared && attempted.length <= 256 && !titleRows.some(row => !row.tabId) ? await reconcileRecoveryReceipts(checkpoint.shared, candidateRows, wire.receipts as RecoveryReceipt[], candidateTitle, wire.titleReceipt) : undefined;
      const expected = reconciled?.baseline;
      if (!isCurrent() || signal.aborted) throw new Error('Stale recovery decision');
      if (expected && !recoveryVersionsDiffer(expected, latest) && (!confirmation || restoredConsentTab === tab && restoredConsentVersion === confirmation)) {
        const originalLive = current?.workspace.live;
        for (const action of reconciled!.recoveredActions) originalLive?.recoverAction(action.original, action.committed);
        try {
          await replayLiveCandidate({ ...options, boardId: initial.boardId, rootDocId: authority.descriptor.rootDocId, contentDocId: authority.descriptor.contentDocId,
            scope: scopedJournal.scope, tab, baseline: latest, rows: candidateRows, signal, isCurrent, getRecoveryEpoch: () => authority.descriptor.recoveryEpoch,
            liveTabId: originalLive?.transportTabId, acknowledge: (ids, revision) => scopedJournal.acknowledge(ids, revision), outcome: observeReplay, committed: documentCommit,
            ...(candidateTitle ? { title: { intent: candidateTitle, receipt: reconciled?.acknowledgedTitle } } : {}),
            acknowledgeTitle: async receipt => {
              await acknowledgeRecoveredTitle(scopedJournal.scope, tab, receipt);
              if (isCurrent()) dispatchSaveEvent({ type: 'title', scope: statusScope, id: receipt.operationId, outcome: 'acknowledged', at: Date.now() });
            },
            recoveredAction: (original, committed) => originalLive?.recoverAction(original, committed),
          });
        } catch (error) {
          // A remote write can win after the initial comparison or at commit.
          // Keep the same isolated candidate and expose the fresh decision.
          if (error instanceof RecoveryChoiceError && isCurrent() && !signal.aborted)
            publish({ ...scope!, title: candidateTitle?.title ?? checkpoint.title, recoveryChoice: error.reason });
          throw error;
        }
        if (!isCurrent() || signal.aborted) throw new Error('Stale recovered version');
        const remaining = await pendingRecords(initial.accountId, initial.boardId);
        const remainingTitles = await pendingTitleIntents(initial.accountId, initial.boardId);
        if (remaining.some(row => row.epoch === authority.descriptor.recoveryEpoch && row.tabId === tab) || remainingTitles.some(row => row.epoch === authority.descriptor.recoveryEpoch && row.tabId === tab)) throw new Error('More changes are waiting to save');
        const fresh = await authorize(signal);
        if (fresh.descriptor.summary.role === 'viewer' || !fresh.descriptor.capabilities.includes('write')) throw new SourceAccessError(403);
        if (confirmation) await resolveRecoveryPermission(scopedJournal.scope, tab, confirmation);
        quarantined = false; await persistSharedEvidence();
        Object.assign(authority, fresh); authorizedDescriptor = fresh.descriptor;
        if (current) current.descriptor = fresh.descriptor;
        publish({ ...scope!, title: fresh.descriptor.summary.title, recoveryChoice: undefined });
        return;
      }
      publish({ ...scope!, title: candidateTitle?.title ?? checkpoint.title, recoveryChoice: !expected ? 'unknown' : recoveryVersionsDiffer(expected, latest) ? 'divergent' : confirmation ? 'restored' : 'unchanged' });
      throw Object.assign(new Error('Choose a recovery version'), { code: 'RECOVERY_CHOICE' });
    },
    title: async (authority, signal) => {
      const titleScopes = await inspectPendingScopes(initial.accountId);
      if (!isCurrent() || signal.aborted) throw new Error('Stale title recovery');
      if (!options.openRestored && titleScopes.some(row => row.boardId === initial.boardId && row.epoch !== authority.descriptor.recoveryEpoch)) throw new RecoveryEpochError('RECOVERY_EPOCH_MISMATCH');
      const intent = await titles.read();
      if (!isCurrent() || signal.aborted) throw new Error('Stale title recovery');
      if (!intent) { authorizedDescriptor = authority.descriptor; if (current) current.descriptor = authority.descriptor; return; }
      attemptedTitle = intent.operationId;
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
        const newer = await titles.read();
        if (isCurrent() && newer && newer.operationId !== intent.operationId) {
          publish({ ...scope!, title: newer.title });
          dispatchSaveEvent({ type: 'title', scope: statusScope, id: newer.operationId, outcome: 'pending', at: Date.now() });
          clearTimeout(timers.get('title-retry'));
          timers.set('title-retry', setTimeout(() => { timers.delete('title-retry'); if (isCurrent()) coordinator.retryIfIdle(); }, 0));
        }
      } catch (error) {
        if (isCurrent()) dispatchSaveEvent({ type: 'title', scope: statusScope, id: intent.operationId, outcome: 'failed', at: Date.now(), message: error instanceof Error ? error.message : 'Your pending name could not be saved.' });
        // A rejected title remains pending independently of document hydration.
        // Authority/epoch/storage failures still fence the entire recovery scope.
        if (error instanceof SourceAccessError || error instanceof RecoveryEpochError || error instanceof RecoveryStorageError) throw error;
        clearTimeout(timers.get('title-retry'));
        timers.set('title-retry', setTimeout(() => { timers.delete('title-retry'); if (isCurrent()) coordinator.retryIfIdle(); }, 5000));
      }
    },
    authorize,
    inspect: async authority => {
      if (authority.descriptor.liveEnabled) return false; // Pending live candidates are handled by the version gate.
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
    preserve: async () => { await scopedJournal.preserve(); await titles.preserve(); await persistSharedEvidence(); },
    verify: async (authority, signal) => {
      const snapshot = getAccountSaveSnapshot();
      if (snapshot?.scope !== statusScope) return;
      // Rebuild missing acknowledgment history from the server, never from a
      // local checkpoint. Incremental replay alone may lack its base structs.
      const documents = new BoardDocSource({ ...authority.descriptor, boardId: initial.boardId, accountId: initial.accountId, generation: initial.generation,
        signal, isCurrent, fetch: options.fetch, onDocumentOutcome: documentOutcome });
      for (const id of [authority.descriptor.rootDocId, authority.descriptor.contentDocId]) {
        if (!covered(id)) await documents.pull(id, new Uint8Array([0]));
      }
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
      await replayJournal(authority.descriptor, initial.accountId, signal, false, options.openRestored, observeReplay, documentCommit);
      const remaining = await pendingRecords(initial.accountId, initial.boardId);
      if (remaining.some(row => !options.openRestored || row.epoch === authority.descriptor.recoveryEpoch)) throw new Error('New changes are waiting to save');
      // Document commits advance the board revision. Keep the next rename's
      // conflict baseline aligned with that committed state before Saved.
      const fresh = await authorize(signal);
      if (fresh.descriptor.summary.role === 'viewer' || !fresh.descriptor.capabilities.includes('write')) throw new SourceAccessError(403);
      const arrived = await pendingRecords(initial.accountId, initial.boardId);
      if (!isCurrent() || signal.aborted) throw new Error('Stale recovery');
      if (arrived.some(row => !options.openRestored || row.epoch === fresh.descriptor.recoveryEpoch)) throw new Error('New changes are waiting to save');
      Object.assign(authority, fresh);
      authorizedDescriptor = fresh.descriptor;
      if (current) current.descriptor = fresh.descriptor;
    },
    changed: (recoveryState, stalled, error) => {
      if (!isCurrent()) return;
      dispatchSaveEvent({ type: 'recovery', scope: statusScope, state: recoveryState, stalled, at: Date.now() });
      if (recoveryState === 'storage-paused') { pauseRecoveryStorage(error); return; }
      if (recoveryState === 'saved' && storagePaused) {
        storagePaused = false;
        if (current) { current.store.readonly = false; current.workspace.docSync.start(); }
      }
      const blocked = storagePaused || quarantined || ['choice', 'corrupt', 'epoch-mismatch', 'expired', 'denied'].includes(recoveryState);
      if (current && blocked) current.store.readonly = true;
      else if (current && recoveryState === 'saved' && scope?.role !== 'viewer') current.store.readonly = false;
      publish({ ...scope!, canWrite: !blocked && initial.role !== 'viewer', recoveryState: storagePaused ? 'storage-paused' : recoveryState, storageFailure: storagePaused ? scope?.storageFailure : undefined, stalled });
      if (recoveryState === 'expired') void interruptSession();
    },
  });
  confirmRestoredRecovery = async () => {
    if (!isCurrent() || scope?.recoveryState !== 'choice' || scope.recoveryChoice !== 'restored' || !chosenTab) return false;
    restoredConsentTab = chosenTab; restoredConsentVersion = chosenConfirmation;
    try { await coordinator.retryRecovery(); return isCurrent() && getActiveAccessScope()?.recoveryState === 'saved'; }
    finally { restoredConsentTab = undefined; restoredConsentVersion = undefined; }
  };
  requestAbort.signal.addEventListener('abort', () => coordinator.dispose(), { once: true });
  const promise = coordinator.open().then(async authority => {
    if (!authority) { if (scope?.recoveryState === 'denied') throw new SourceAccessError(404); throw new Error('Board unavailable'); }
    if (scope?.recoveryState === 'denied' && authority.descriptor.summary.role !== 'viewer') throw new SourceAccessError(403);
    if (['corrupt', 'epoch-mismatch'].includes(scope?.recoveryState ?? '')) throw Object.assign(new Error('Recovery needs attention'), { recoveryState: scope!.recoveryState });
    // Once replay is acknowledged, ordinary server hydration owns freshness and
    // image loading/error feedback. Local hydration is reserved for pending work.
    if (scope?.recoveryState === 'saved') baseline = undefined;
    if (!isCurrent() || requestAbort.signal.aborted || scope?.accountId !== authority.accountId || scope.boardId !== authority.descriptor.summary.id) throw new SourceAccessError(409);
    let retainedPending: AccessScope['retainedPending'];
    if (authority.descriptor.summary.role === 'viewer') {
      // Inspect only metadata after fresh read authorization. Pending content
      // remains isolated; a Viewer always hydrates the authorized server copy.
      try {
        const pending = await inspectPendingScopes(authority.accountId);
        retainedPending = pending.some(row => row.accountId === authority.accountId && row.boardId === authority.descriptor.summary.id && row.count > 0);
        if (retainedPending && authority.descriptor.liveEnabled) await markRecoveryPermissionLoss(scopedJournal.scope);
      } catch { retainedPending = 'unavailable'; }
    }
    if (!isCurrent() || requestAbort.signal.aborted || scope?.accountId !== authority.accountId || scope.boardId !== authority.descriptor.summary.id) throw new SourceAccessError(409);
    initializing = false;
    authorizedDescriptor = authority.descriptor;
    publish({ ...scope!, role: authority.descriptor.summary.role, canWrite: !storagePaused && !quarantined && authority.descriptor.summary.role !== 'viewer', retainedPending });
    return import('./account/board-workspace');
  }).then(({ createAccountWorkspace }) => createAccountWorkspace({ ...options, descriptor: authorizedDescriptor, isCurrent, recoveryBaseline: baseline, recoveryQuarantined: quarantined,
    // Workspace lifetime is distinct from request cancellation while preservation is pending.
    durableLocalBlobs: true,
    // pagehide pauses this runtime before the live-source cleanup listener.
    // Retirement must not inherit the requestAbort signal from the wrapper below.
    disconnectFetch: options.disconnectFetch ?? options.fetch ?? fetch,
    onDocumentOutcome: documentOutcome,
    canEditDisconnected: () => {
      const session = getSessionState();
      return isCurrent() && !initializing && !quarantined && !storagePaused && scope?.canWrite === true && scope.role !== 'viewer' &&
        session.phase === 'authenticated' && session.member?.accountId === initial.accountId && session.member.expiresAt > Date.now();
    },
    preserveLocal: async () => {
      try { await scopedJournal.preserve(); await titles.preserve(); await persistSharedEvidence(); }
      catch (error) { if (isCurrent()) pauseRecoveryStorage(error); throw error; }
    },
    canReconnectLive: async () => {
      const clean = () => isCurrent() && !initializing && !storagePaused && scope?.phase === 'active' &&
        (scope.role === 'viewer' || (getAccountSaveSnapshot()?.scope === statusScope && getAccountSaveSnapshot()?.state === 'saved' &&
          live.size === 2 && [...live.keys()].every(covered) && !titlesInFlight && !scopedJournal.pendingMemory().length));
      if (!clean()) await coordinator.retryRecovery();
      if (!clean()) return false;
      const rows = await pendingRecords(initial.accountId, initial.boardId); const title = await titles.read();
      return clean() && !title && !rows.some(row => row.tabId === scopedJournal.tabId);
    },
    onDocumentCommit: documentCommit,
    onLiveSnapshot: observed => {
      const snapshot = structuredClone(observed);
      sharedEvidence.push(() => scopedJournal.observeShared(snapshot));
      void persistSharedEvidence().catch(error => { if (isCurrent()) pauseRecoveryStorage(error); });
    },
    onLiveMetadata: metadata => {
      ++liveMetadataVersion; latestLiveMetadata = metadata;
      projectLiveMetadata();
    },
    onImageOutcome: imageOutcome,
    fetch: (input, init) => {
      const url = new URL(String(input), location.href); const key = decodeURIComponent(url.pathname.split('/blobs/')[1] ?? '');
      const local = baseline?.assets.get(key);
      if (isCurrent() && init?.method === 'GET' && local) return Promise.resolve(new Response(local, { headers: { 'Content-Type': local.type } }));
      return (options.fetch ?? fetch)(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, requestAbort.signal]) : requestAbort.signal });
    },
    onPendingDocument: (id, data, attempt, actionId) => scopedJournal.captureSubmission(id, data, attempt, actionId),
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
    beforeDocumentWrite: async (docId, data, live) => {
      if (quarantined) throw new Error('Choose a recovery version before saving');
      if (live) {
        await persistSharedEvidence();
        const authority = await authorize(requestAbort.signal);
        if (!isCurrent() || authority.descriptor.summary.role === 'viewer' || !authority.descriptor.capabilities.includes('write')) throw new SourceAccessError(403);
        if (authority.descriptor.recoveryEpoch !== authorizedDescriptor.recoveryEpoch) throw new RecoveryEpochError('RECOVERY_EPOCH_MISMATCH');
        return;
      }
      const epoch = authorizedDescriptor.recoveryEpoch;
      // A delayed native callback can arrive after replay has already committed
      // its exact bytes. Complete that no-op before starting another request.
      if (isCurrent() && scope?.canWrite && scope.role !== 'viewer' &&
          epoch === options.descriptor.recoveryEpoch && acknowledgedUpdateCovered(confirmed.get(docId), data)) return 'acknowledged';
      const authority = await coordinator.retryRecovery();
      if (!isCurrent() || scope?.recoveryState !== 'saved' || !scope.canWrite || scope.role === 'viewer' ||
          !authority || authority.accountId !== initial.accountId || authority.descriptor.summary.id !== initial.boardId)
        throw new Error('Recovery is pending');
      if (authority.descriptor.recoveryEpoch !== epoch || authorizedDescriptor.recoveryEpoch !== epoch)
        throw new RecoveryEpochError('RECOVERY_EPOCH_MISMATCH');
      // The journal may already have submitted this exact update while the
      // native sync peer waited for recovery. Avoid another transport only
      // when actual server acknowledgments cover its operations and deletes.
      if (acknowledgedUpdateCovered(confirmed.get(docId), data)) return 'acknowledged';
    },
    onAuthorizationLost: error => {
      if (isCurrent() && authorizedDescriptor.liveEnabled && [403, 404].includes(error.status)) {
        const preserving = markRecoveryPermissionLoss(scopedJournal.scope); capture.push(preserving); void preserving.catch(() => {});
      }
      if (isCurrent()) { suspendAccessScope('authorization'); if (error.status === 401) void interruptSession(); else if (error.status === 409) void revalidateSession(); }
      if (![401, 409].includes(error.status)) options.onAuthorizationLost?.(error);
    },
  })).then(async workspace => {
    if (!isCurrent()) { workspace.dispose(); throw new Error('Board access changed'); }
    const store = workspace.getDoc(options.descriptor.contentDocId)!.getStore();
    const local = authorizedDescriptor.summary.role !== 'viewer' && !quarantined ? attachLocalCapture({ journal: scopedJournal, root: workspace.doc, content: store.spaceDoc, title: authorizedDescriptor.summary.title, isCurrent, actionId: () => workspace.live?.actionId }) : undefined;
    try {
      try { await local?.ready; captureReady = !!local; await persistSharedEvidence(); } catch (error) { pauseRecoveryStorage(error); }
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
    let preservationQueued = false;
    const changed = (_data: Uint8Array, _origin: unknown, doc: Y.Doc) => {
      if (!isCurrent()) return;
      revisions.set(doc.guid, (revisions.get(doc.guid) ?? 0) + 1); coverage();
      // Capture remains synchronous for every update. One status check per
      // burst avoids repeatedly awaiting the same growing set of local writes.
      if (preservationQueued) return;
      preservationQueued = true;
      queueMicrotask(() => {
        preservationQueued = false;
        if (!isCurrent()) return;
        const version = JSON.stringify([...revisions]);
        void scopedJournal.preserve().then(() => { if (isCurrent() && JSON.stringify([...revisions]) === version) dispatchSaveEvent({ type: 'preserved', scope: statusScope }); }).catch(() => undefined);
      });
    };
    workspace.doc.on('update', changed); store.spaceDoc.on('update', changed); coverage();
    const stopStatus = () => { workspace.doc.off('update', changed); store.spaceDoc.off('update', changed); for (const timer of timers.values()) clearTimeout(timer); timers.clear(); for (const doc of confirmed.values()) doc.destroy(); confirmed.clear(); };
    const value: CanvasRuntime = { workspace, store, descriptor: structuredClone(authorizedDescriptor), scope: scope!,
      captureUnacknowledged: () => [...live].flatMap(([id, doc]) => {
        const data = Y.encodeStateAsUpdate(doc);
        // Leaving must preserve uncertain work without manufacturing pending
        // records for documents already covered by actual server receipts.
        return acknowledgedUpdateCovered(confirmed.get(id), data) ? [] :
          [scopedJournal.capture('document', id, data).catch(() => undefined)];
      }),
      stopSaveStatus: stopStatus, dispose: () => { local?.dispose(); stopStatus(); workspace.dispose(); } };
    current = value;
    if (storagePaused || quarantined) { store.readonly = true; workspace.docSync.forceStop(); }
    return value;
  }).catch(error => { for (const timer of timers.values()) clearTimeout(timer); for (const doc of confirmed.values()) doc.destroy(); if (pending?.key === key) pending = null; throw error; });
  pending = { key, promise }; return promise;
}
