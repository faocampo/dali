import * as Y from 'yjs';

export type RecoveryDocument = { docId: string; data: Uint8Array };
/** Only server-observed or receipt-acknowledged operations belong here. */
export type SharedRecoveryBaseline = { version: 1; epoch: string; root: RecoveryDocument; content: RecoveryDocument;
  title: string; revision: number; titleRevision: number };
export type RecoveryAttempt = { tabId: string; operationId: string; digest: string };
export type RecoveryReceipt = RecoveryAttempt & { docId: string; previousRevision: number; revision: number };
export type AttemptedUpdate = { id: string; resource: string; data: Uint8Array | Blob; coveredIds?: string[]; attempt?: RecoveryAttempt };
const bounded = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 256;
export function validRecoveryAttempt(value: unknown): value is RecoveryAttempt {
  const a = value as RecoveryAttempt | undefined;
  return !!a && bounded(a.tabId) && typeof a.operationId === 'string' && /^[a-zA-Z0-9-]{1,128}$/.test(a.operationId) && typeof a.digest === 'string' && /^[a-f0-9]{64}$/.test(a.digest);
}
export function canonicalRecoveryUpdate(updates: readonly Uint8Array[]) {
  const doc = new Y.Doc();
  try {
    for (const bytes of updates) Y.applyUpdate(doc, bytes);
    if (doc.store.pendingStructs || doc.store.pendingDs) throw new Error('Incomplete recovery baseline');
    return Y.encodeStateAsUpdate(doc);
  } finally { doc.destroy(); }
}
export function validSharedRecoveryBaseline(value: unknown): value is SharedRecoveryBaseline {
  const b = value as SharedRecoveryBaseline | undefined;
  if (!b || b.version !== 1 || typeof b.epoch !== 'string' || !/^[a-f0-9-]{36}$/.test(b.epoch) || !bounded(b.root?.docId) || !bounded(b.content?.docId) || b.root.docId === b.content.docId || typeof b.title !== 'string' || b.title.length > 4000 || !Number.isSafeInteger(b.revision) || b.revision < 0 || !Number.isSafeInteger(b.titleRevision) || b.titleRevision < 0 || b.titleRevision > b.revision) return false;
  try {
    for (const d of [b.root, b.content]) {
      if (!(d.data instanceof Uint8Array) || !d.data.length || d.data.length > 8 * 1024 * 1024) return false;
      canonicalRecoveryUpdate([d.data]);
    }
    return true;
  } catch { return false; }
}
/** An older poll must not replace a newer acknowledged own operation. */
export function advanceSharedBaseline(previous: SharedRecoveryBaseline | undefined, observed: SharedRecoveryBaseline): SharedRecoveryBaseline {
  if (!validSharedRecoveryBaseline(observed) || previous && (!validSharedRecoveryBaseline(previous) || previous.epoch !== observed.epoch || previous.root.docId !== observed.root.docId || previous.content.docId !== observed.content.docId)) throw new Error('Invalid recovery baseline');
  return { ...observed, revision: Math.max(previous?.revision ?? 0, observed.revision),
    ...(previous && previous.titleRevision > observed.titleRevision ? { title: previous.title, titleRevision: previous.titleRevision } : {}),
    root: { docId: observed.root.docId, data: canonicalRecoveryUpdate([...(previous ? [previous.root.data] : []), observed.root.data]) },
    content: { docId: observed.content.docId, data: canonicalRecoveryUpdate([...(previous ? [previous.content.data] : []), observed.content.data]) } };
}
const base64 = (bytes: Uint8Array) => { let value = ''; for (let i = 0; i < bytes.length; i += 8192) value += String.fromCharCode(...bytes.subarray(i, i + 8192)); return btoa(value); };
/** Canvas operations and title only: presence/grant revisions do not diverge. */
export function recoveryFingerprintInput(baseline: SharedRecoveryBaseline) {
  if (!validSharedRecoveryBaseline(baseline)) throw new Error('Invalid recovery baseline');
  return JSON.stringify([baseline.root.docId, base64(canonicalRecoveryUpdate([baseline.root.data])), baseline.content.docId, base64(canonicalRecoveryUpdate([baseline.content.data])), baseline.title]);
}
export async function recoveryDigest(bytes: Uint8Array) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))), n => n.toString(16).padStart(2, '0')).join('');
}
export async function recoveryFingerprint(baseline: SharedRecoveryBaseline) { return recoveryDigest(new TextEncoder().encode(recoveryFingerprintInput(baseline))); }
/** Reconcile exact uncertain submissions in an isolated copy, never the candidate. */
export async function reconcileRecoveryReceipts(baseline: SharedRecoveryBaseline, rows: readonly AttemptedUpdate[], receipts: readonly RecoveryReceipt[]) {
  let next = advanceSharedBaseline(undefined, baseline); const acknowledged = new Set<string>();
  for (const row of rows) {
    if (!validRecoveryAttempt(row.attempt) || !(row.data instanceof Uint8Array)) continue;
    const receipt = receipts.find(r => validRecoveryAttempt(r) && r.tabId === row.attempt!.tabId && r.operationId === row.attempt!.operationId && r.docId === row.resource && r.digest === row.attempt!.digest && Number.isSafeInteger(r.previousRevision) && r.previousRevision >= 0 && Number.isSafeInteger(r.revision) && r.revision >= r.previousRevision);
    if (!receipt || await recoveryDigest(row.data) !== receipt.digest) continue;
    const key = row.resource === next.root.docId ? 'root' : row.resource === next.content.docId ? 'content' : undefined;
    if (!key) continue;
    next = { ...next, revision: Math.max(next.revision, receipt.revision), [key]: { docId: row.resource, data: canonicalRecoveryUpdate([next[key].data, row.data]) } };
    acknowledged.add(row.id); for (const id of row.coveredIds ?? []) acknowledged.add(id);
  }
  return { baseline: next, acknowledgedIds: [...acknowledged] };
}
export function recoveryVersionsDiffer(expected: SharedRecoveryBaseline | undefined, current: SharedRecoveryBaseline) {
  return !expected || expected.epoch !== current.epoch || recoveryFingerprintInput(expected) !== recoveryFingerprintInput(current);
}
