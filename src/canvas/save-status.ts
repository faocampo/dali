import type { DocEngineStatus } from '@blocksuite/affine/sync';

export type SaveSnapshot = { scope: string; state: 'saving' | 'saved' | 'failed'; label: string; savedAt?: number };
export type SaveEvent = { type: 'coverage'; scope: string; documents: Record<string, { revision: number; acknowledged: boolean }>; images: { id: string; label: string }[]; at: number };
export function createSaveSnapshot(scope: string): SaveSnapshot { return { scope, state: 'saving', label: 'Saving…' }; }
export function reduceSaveStatus(state: SaveSnapshot, _event: SaveEvent): SaveSnapshot { return state; }

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

export function resetSaveStatus(): void {
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
