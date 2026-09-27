import * as Y from 'yjs';

/** Only integrated, server-confirmed operations and deletes can cover a submission. */
export function acknowledgedUpdateCovered(confirmed: Y.Doc | undefined, update: Uint8Array): boolean {
  if (!confirmed || confirmed.store.pendingStructs || confirmed.store.pendingDs) return false;
  try { return Y.snapshotContainsUpdate(Y.snapshot(confirmed), update); }
  catch { return false; }
}
