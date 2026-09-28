import type { DocEngineStatus } from '@blocksuite/affine/sync';

export type RecoveryDownloadState = Readonly<{ scope: string; phase: 'idle' | 'preparing' | 'ready' | 'error'; label: string; message?: string; capturedAt?: number }>;
const idleDownload: RecoveryDownloadState = Object.freeze({ scope: '', phase: 'idle', label: '' });
let recoveryDownload: RecoveryDownloadState = idleDownload;
const downloadListeners = new Set<() => void>();
export const getRecoveryDownloadState = () => recoveryDownload;
export function subscribeRecoveryDownloadState(listener: () => void) { downloadListeners.add(listener); return () => { downloadListeners.delete(listener); }; }
export function resetRecoveryDownloadState() { recoveryDownload = idleDownload; downloadListeners.forEach(listener => listener()); }
export function reportRecoveryDownloadState(next: RecoveryDownloadState) {
  // Completion from an old scope cannot replace a newer preparation or reset.
  if (next.phase !== 'preparing' && next.scope !== recoveryDownload.scope) return;
  recoveryDownload = Object.freeze({ ...next }); downloadListeners.forEach(listener => listener());
}

export type ImageSaveRow = Readonly<{ id: string; label: string; state: 'waiting' | 'uploading' | 'failed' | 'saved'; attempt?: string; required: boolean; wasRequired?: boolean }>;
type DocumentSaveRow = Readonly<{ revision: number; acknowledged: boolean; failure?: string }>;
export type SaveSnapshot = Readonly<{ scope: string; state: 'saving' | 'saved' | 'failed'; label: string; message?: string; savedAt?: number;
  documents: Readonly<Record<string, DocumentSaveRow>>; images: Readonly<Record<string, ImageSaveRow>>; preserved: boolean; retrying: boolean; recovery?: string; lastCoverage?: string; title?: { id: string; acknowledged: boolean; failed: boolean; message?: string } }>;
export type SaveEvent =
  | { type: 'title'; scope: string; id: string; outcome: 'pending' | 'acknowledged' | 'failed'; at: number; message?: string }
  | { type: 'coverage'; scope: string; documents: Record<string, { revision: number; acknowledged: boolean }>; images: { id: string; label: string }[]; at: number }
  | { type: 'image'; scope: string; id: string; label?: string; outcome: 'sending' | 'acknowledged' | 'failed'; attempt: string; at: number }
  | { type: 'document-failure'; scope: string; docId: string }
  | { type: 'recovery'; scope: string; state: string; stalled?: boolean; at?: number }
  | { type: 'preserved' | 'retry' | 'dispatched' | 'local-complete' | 'exported'; scope: string };
const freeze = (value: SaveSnapshot): SaveSnapshot => Object.freeze({ ...value, documents: Object.freeze(Object.fromEntries(Object.entries(value.documents).map(([id, row]) => [id, Object.freeze(row)]))), images: Object.freeze(Object.fromEntries(Object.entries(value.images).map(([id, row]) => [id, Object.freeze(row)]))) });
export function createSaveSnapshot(scope: string): SaveSnapshot { return freeze({ scope, state: 'saving', label: 'Saving…', documents: {}, images: {}, preserved: false, retrying: false }); }
export function reduceSaveStatus(state: SaveSnapshot, event: SaveEvent): SaveSnapshot {
  if (event.scope !== state.scope || ['dispatched', 'local-complete', 'exported'].includes(event.type)) return state;
  let next = { ...state, documents: { ...state.documents }, images: { ...state.images } };
  let time: number | undefined;
  if (event.type === 'title') {
    if (event.outcome !== 'pending' && state.title?.id !== event.id) return state;
    next.title = { id: event.id, acknowledged: event.outcome === 'acknowledged', failed: event.outcome === 'failed', message: event.message };
    if (event.outcome === 'pending') next.preserved = false;
    time = event.at;
  } else if (event.type === 'coverage') {
    if (Object.entries(event.documents).some(([id, row]) => row.revision < (state.documents[id]?.revision ?? 0))) return state;
    const changed = Object.entries(event.documents).some(([id, row]) => row.revision !== state.documents[id]?.revision);
    for (const [id, row] of Object.entries(event.documents)) next.documents[id] = { ...row, ...(row.acknowledged ? {} : { failure: state.documents[id]?.failure }) };
    const required = new Set(event.images.map(image => image.id));
    for (const [id, row] of Object.entries(next.images)) next.images[id] = { ...row, required: required.has(id) };
    for (const image of event.images) next.images[image.id] = { state: 'waiting', ...next.images[image.id], ...image, required: true, wasRequired: true };
    if (changed) next.preserved = false;
    time = event.at;
  } else if (event.type === 'image') {
    const previous = next.images[event.id];
    if (event.outcome !== 'sending' && previous?.attempt && previous.attempt !== event.attempt) return state;
    // An immutable image key already acknowledged by the server stays covered on redundant sends.
    const outcome = event.outcome === 'sending' && previous?.state === 'saved' ? 'saved' : event.outcome === 'sending' && previous?.state === 'failed' ? 'failed' : event.outcome === 'sending' ? 'uploading' : event.outcome === 'acknowledged' ? 'saved' : 'failed';
    next.images[event.id] = { ...previous, id: event.id, label: event.label ?? previous?.label ?? 'Image', required: previous?.required ?? false, state: outcome, attempt: event.attempt };
    time = event.at;
  } else if (event.type === 'document-failure') {
    const doc = next.documents[event.docId];
    next.documents[event.docId] = { revision: 0, acknowledged: false, ...doc, failure: 'Board changes have not reached the server.' };
  } else if (event.type === 'recovery') {
    if ((event.state === 'pending' || event.stalled) && next.title && !next.title.acknowledged) next.title = { ...next.title, failed: true };
    if (event.state === 'saved') time = event.at;
    next.recovery = event.state; next.retrying = event.state === 'retrying' || event.state === 'recovering';
    if (event.stalled) for (const [id, row] of Object.entries(next.documents)) if (!row.acknowledged) next.documents[id] = { ...row, failure: 'Saving is taking longer than expected.' };
  } else if (event.type === 'preserved') next.preserved = true;
  else if (event.type === 'retry') next.retrying = true;
  const documents = Object.values(next.documents);
  const covered = documents.length >= 2 && documents.every(row => row.acknowledged);
  // Removing a reference locally does not erase its failure until the removal itself is acknowledged.
  if (covered && event.type === 'coverage') for (const [id, row] of Object.entries(next.images)) if (!row.required && row.wasRequired) delete next.images[id];
  const images = Object.values(next.images); const failed = images.filter(row => row.state === 'failed' && (row.required || row.wasRequired));
  const contentFailed = documents.some(row => row.failure && !row.acknowledged) || !!next.title?.failed;
  const unsafe = ['expired', 'denied', 'storage-paused', 'corrupt', 'epoch-mismatch', 'disposed'].includes(next.recovery ?? '');
  const allSaved = covered && (!next.title || next.title.acknowledged) && images.filter(row => row.required).every(row => row.state === 'saved') && !failed.length;
  if (unsafe) {
    next.state = 'failed'; next.label = next.recovery === 'expired' ? 'Sign in to continue' : next.recovery === 'denied' ? 'Access changed' : next.recovery === 'storage-paused' ? 'Editing paused' : 'Recovery needs attention';
    next.message = 'Keep this tab open. Your pending work needs attention.';
  } else if (failed.length || contentFailed) {
    next.state = 'failed'; next.label = covered && failed.length ? 'Image not saved' : 'Save failed';
    next.message = failed.length ? `${covered ? 'Board changes are saved, but' : 'Board changes and'} ${failed.length === 1 ? failed[0]!.label : `${failed.length} images`} ${covered && failed.length === 1 ? 'has' : 'have'} not reached the server. Retry now or download a recovery copy.` : 'Board changes have not reached the server. Retry now or download a recovery copy.';
  } else if (next.retrying || ['checking-access', 'pending'].includes(next.recovery ?? '')) { next.state = 'saving'; next.label = 'Recovering changes…'; next.message = 'Retrying your pending changes and images.'; }
  else if (!allSaved) { next.state = 'saving'; next.label = next.preserved ? 'Changes pending' : 'Saving…'; next.message = next.preserved ? 'Changes are preserved in this browser and waiting to reach the server.' : 'Sending your latest changes and images to the server.'; }
  else {
    next.state = 'saved'; next.label = 'Saved'; next.message = 'All changes and images are saved to the server.'; next.retrying = false;
    const coverage = JSON.stringify([Object.entries(next.documents).map(([id, row]) => [id, row.revision]), images.filter(row => row.required).map(row => row.id).sort(), next.title?.id]);
    if (time !== undefined && coverage !== next.lastCoverage) { next.savedAt = time; next.lastCoverage = coverage; }
  }
  if (next.title?.failed && !unsafe && !failed.length) next.message = next.title.message ?? 'The board name has not reached the server. Your pending name is preserved; retry saving or download a recovery copy.';
  return freeze(next);
}

let accountSnapshot: SaveSnapshot | undefined;
export const getAccountSaveSnapshot = () => accountSnapshot;
export function dispatchSaveEvent(event: SaveEvent) {
  if (!accountSnapshot) return;
  if (event.scope === accountSnapshot.scope && event.type === 'recovery' && ['expired', 'denied', 'disposed'].includes(event.state)) resetRecoveryDownloadState();
  const next = reduceSaveStatus(accountSnapshot, event); if (next === accountSnapshot) return;
  accountSnapshot = next; snapshot = next; listeners.forEach(listener => listener());
}
export const reportSaveCoverage = (event: Extract<SaveEvent, { type: 'coverage' }>) => dispatchSaveEvent(event);
export const reportImageOutcome = (event: Extract<SaveEvent, { type: 'image' }>) => dispatchSaveEvent(event);

export type LocalSaveState = 'saving' | 'saved' | 'failed';

export type LocalSaveStatus = {
  state: LocalSaveState;
  label: string;
  message?: string;
  savedAt?: number;
};

let docSaving = true;
let docFailure: string | null = null;
let pendingBlobWrites = 0;
let blobFailure: string | null = null;
let snapshot: LocalSaveStatus = { state: 'saving', label: 'Saving…' };
const listeners = new Set<() => void>();

function failureMessage(error: unknown): string {
  const name = error instanceof DOMException || error instanceof Error ? error.name : '';
  if (name === 'QuotaExceededError') {
    return 'This browser’s local storage is full. Download a backup, free some space, then retry.';
  }
  if (name === 'SecurityError' || name === 'NotAllowedError') {
    return 'The browser blocked local storage. Allow storage for this site, then retry.';
  }
  return 'The latest changes could not be saved to this browser. Download a backup, then retry.';
}

function publish(): void {
  if (accountSnapshot) return;
  const failure = blobFailure ?? docFailure;
  const next: LocalSaveStatus = failure
    ? { state: 'failed', label: 'Save failed', message: failure }
    : docSaving || pendingBlobWrites > 0
      ? { state: 'saving', label: 'Saving…' }
      : { state: 'saved', label: 'Saved locally', savedAt: snapshot.state === 'saved' ? snapshot.savedAt : Date.now() };
  if (
    next.state === snapshot.state &&
    next.label === snapshot.label &&
    next.message === snapshot.message
  ) {
    return;
  }
  snapshot = next;
  listeners.forEach((listener) => listener());
}

export function resetSaveStatus(scope?: string): void {
  resetRecoveryDownloadState();
  accountSnapshot = scope ? createSaveSnapshot(scope) : undefined;
  if (accountSnapshot) { snapshot = accountSnapshot; listeners.forEach(listener => listener()); return; }
  docSaving = true;
  docFailure = null;
  pendingBlobWrites = 0;
  blobFailure = null;
  publish();
}

export function reportDocEngineStatus(status: DocEngineStatus): void {
  docSaving = status.step !== 2;
  if (status.retrying) {
    docFailure ??= failureMessage(null);
  } else if (status.step === 2) {
    docFailure = null;
  }
  publish();
}

export function reportDocWriteFailure(error: unknown): void {
  docFailure = failureMessage(error);
  publish();
}

export function beginBlobWrite(): void {
  pendingBlobWrites += 1;
  publish();
}

export function finishBlobWrite(error?: unknown): void {
  pendingBlobWrites = Math.max(0, pendingBlobWrites - 1);
  blobFailure = error === undefined ? null : failureMessage(error);
  publish();
}

export function getSaveStatus(): LocalSaveStatus {
  return snapshot;
}

export function subscribeSaveStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
