import * as Y from 'yjs';
import { applyNativeUpdate, nativeObjectIds, nativeReservationTargets } from '../../../server/boards/change-footprint';
import { BoardLiveSource } from './live-source';
import { RecoveryEpochError, SourceAccessError, type SourceOptions } from './doc-source';
import { preserveRecoverySubmission, validRecord, type JournalRecord, type JournalScope, type ReplayObserver } from './outbox';
import { canonicalRecoveryUpdate, recoveryDigest, recoveryFingerprint, recoveryVersionsDiffer, type RecoveryTitleReceipt, type SharedRecoveryBaseline } from './recovery-baseline';
import { validDocumentRevisionReceipt, validTitleIntent, type TitleIntent, type DocumentRevisionReceipt } from './title-intent';
import { validDescriptor } from '../../boards/BoardLibrary';

const choice = () => Object.assign(new Error('The shared board changed. Choose a recovery version.'), { code: 'RECOVERY_CHOICE' });
/** Replays one selected tab only, using fresh leases and commit-time canvas CAS. */
export async function replayLiveCandidate(options: SourceOptions & {
  scope: JournalScope; tab: string; baseline: SharedRecoveryBaseline; rows: readonly JournalRecord[];
  title?: { intent: TitleIntent; receipt?: RecoveryTitleReceipt };
  acknowledgeTitle: (receipt: RecoveryTitleReceipt) => Promise<void>;
  acknowledge: (ids: readonly string[], revision?: number) => Promise<void>;
  outcome: ReplayObserver;
  committed: (receipt: DocumentRevisionReceipt, document: { docId: string; data: Uint8Array }) => Promise<void>;
  recoveredAction?: (original: string, committed: string) => void;
}) {
  let expected = structuredClone(options.baseline); let connected: SharedRecoveryBaseline | undefined;
  const current = () => {
    if (options.signal?.aborted || options.isCurrent?.(options.generation) === false) throw new Error('Recovery interrupted');
  };
  const live = new BoardLiveSource({ ...options, onLiveSnapshot: snapshot => { connected ??= snapshot; }, onLiveMetadata: undefined });
  const headers = () => ({ 'X-Dali-Account': options.accountId, 'X-Dali-Request': '1', 'X-Dali-Recovery-Epoch': expected.epoch });
  const preserve = async <T>(work: () => Promise<T>) => {
    try { return await work(); }
    catch (cause) { throw Object.assign(new Error('Local recovery preservation failed'), { code: 'STORAGE_PAUSED', cause }); }
  };
  const request = async (path: string, init: RequestInit) => {
    current(); const response = await (options.fetch ?? fetch)(path, { ...init, credentials: 'same-origin', cache: 'no-store', signal: options.signal }); current();
    if (!response.ok) {
      const result = await response.json().catch(() => ({})) as { code?: string };
      if (result.code === 'RECOVERY_DIVERGED') throw choice();
      if (result.code === 'RECOVERY_EPOCH_MISMATCH' || result.code === 'RECOVERY_EPOCH_REQUIRED') throw new RecoveryEpochError(result.code);
      if ([401, 403, 404].includes(response.status)) throw new SourceAccessError(response.status);
      throw new Error('Recovery could not be saved');
    }
    if (response.headers.get('X-Dali-Recovery-Epoch') !== expected.epoch) throw new RecoveryEpochError('RECOVERY_EPOCH_MISMATCH');
    return response;
  };
  try {
    if (options.rows.some(row => !validRecord(row) || row.accountId !== options.accountId || row.boardId !== options.boardId || row.epoch !== expected.epoch || row.tabId !== options.tab)) throw choice();
    const intent = options.title?.intent;
    if (intent && (!validTitleIntent(intent) || intent.accountId !== options.accountId || intent.boardId !== options.boardId || intent.epoch !== expected.epoch || intent.tabId !== options.tab)) throw choice();
    await live.start(() => {}, () => {}); current();
    if (!connected || recoveryVersionsDiffer(expected, connected)) throw choice();
    const base = `/api/boards/${encodeURIComponent(options.boardId)}`;
    for (const row of options.rows.filter(row => row.kind === 'blob')) {
      current(); const operation = crypto.randomUUID(); await options.outcome(row, 'sending', operation);
      try {
        const result = await request(`${base}/blobs/${encodeURIComponent(row.resource)}`, { method: 'PUT', headers: { ...headers(), 'Content-Type': row.data instanceof Blob ? row.data.type : row.mime!, 'X-Dali-Recovery-Baseline': await recoveryFingerprint(expected) }, body: row.data instanceof Blob ? row.data : new Uint8Array(row.data) });
        const body = await result.json(); if (body.acknowledged !== true) throw new Error('Image commit unconfirmed');
        current(); await preserve(() => options.acknowledge([row.id])); await options.outcome(row, 'acknowledged', operation);
      } catch (error) { await options.outcome(row, 'failed', operation); throw error; }
    }
    const groups = new Map<string, JournalRecord[]>();
    for (const row of options.rows.filter(row => row.kind === 'document')) {
      const key = JSON.stringify([row.resource, row.actionId]); const group = groups.get(key) ?? []; group.push(row); groups.set(key, group);
    }
    for (const rows of groups.values()) {
      current(); const first = rows[0]!; const key = first.resource === expected.root.docId ? 'root' : first.resource === expected.content.docId ? 'content' : undefined;
      if (!key) throw choice();
      const data = Y.mergeUpdates(rows.map(row => row.data as Uint8Array));
      if (data.byteLength > 8 * 1024 * 1024) throw choice();
      const before = new Y.Doc(); const after = new Y.Doc(); let ids: string[] = []; let creating = false;
      try {
        Y.applyUpdate(before, expected[key].data); Y.applyUpdate(after, expected[key].data);
        if (Y.snapshotContainsUpdate(Y.snapshot(before), data)) {
          await preserve(() => options.acknowledge(rows.map(row => row.id), expected.revision));
          for (const row of rows) await options.outcome(row, 'acknowledged', crypto.randomUUID());
          continue;
        }
        if (key === 'root') throw choice(); // New root bindings are not a supported collaborative action.
        const effects = applyNativeUpdate(before, after, data); if (!effects) throw choice();
        const existing = nativeObjectIds(before);
        const affected = effects.objectIds.filter(id => id !== '$dali:metadata' && existing.has(id));
        const required = nativeReservationTargets(before, affected, true); if (!required) throw choice();
        ids = required; if (effects.objectIds.includes('$dali:metadata')) ids.push('$dali:metadata');
        creating = effects.objectIds.some(id => id !== '$dali:metadata' && !existing.has(id));
      } finally { before.destroy(); after.destroy(); }
      if (creating) ids.push(live.creationScope);
      const token = ids.length ? await live.acquire([...new Set(ids)]) : undefined;
      try {
        const operationId = crypto.randomUUID(); const attempt = { tabId: live.transportTabId, operationId, digest: await recoveryDigest(data) };
        const submission = await preserve(() => preserveRecoverySubmission(options.scope, options.tab, rows, data, attempt, token)); current();
        await options.outcome(submission, 'sending', operationId);
        try {
          const result = await request(`${base}/docs/${encodeURIComponent(first.resource)}/push`, { method: 'POST', headers: { ...headers(), ...live.writeHeaders(operationId), 'Content-Type': 'application/octet-stream', 'X-Dali-Recovery-Baseline': await recoveryFingerprint(expected) }, body: new Uint8Array(data) });
          const receipt: unknown = await result.json(); current();
          if (!validDocumentRevisionReceipt(receipt) || !(receipt as { acknowledged?: unknown }).acknowledged) throw new Error('Recovery commit unconfirmed');
          await options.committed(receipt, { docId: first.resource, data }); current();
          await preserve(() => options.acknowledge([submission.id, ...rows.map(row => row.id)], receipt.revision));
          await options.outcome(submission, 'acknowledged', operationId);
          expected = { ...expected, revision: Math.max(expected.revision, receipt.revision), [key]: { docId: first.resource, data: canonicalRecoveryUpdate([expected[key].data, data]) } };
          if (first.actionId && token) options.recoveredAction?.(first.actionId, token);
        } catch (error) { await options.outcome(submission, 'failed', operationId); throw error; }
      } finally { if (token) await live.release(token).catch(() => {}); }
    }
    if (intent) {
      let receipt = options.title?.receipt;
      if (!receipt) {
        const response = await request(base, { method: 'PATCH', headers: { ...headers(), 'Content-Type': 'application/json', 'X-Dali-Recovery-Baseline': await recoveryFingerprint(expected) }, body: JSON.stringify({ operationId: intent.operationId, revision: expected.revision, title: intent.title }) });
        const result = await response.json(); current();
        if (!validDescriptor(result, options.accountId) || result.summary.id !== options.boardId || result.summary.title !== intent.title || result.recoveryEpoch !== expected.epoch || result.revision !== expected.revision + 1) throw new Error('Recovery name commit unconfirmed');
        receipt = { operationId: intent.operationId, title: intent.title, revision: result.revision };
      }
      if (receipt.operationId !== intent.operationId || receipt.title !== intent.title || !Number.isSafeInteger(receipt.revision) || receipt.revision < 1) throw new Error('Invalid recovery name receipt');
      current(); await preserve(() => options.acknowledgeTitle(receipt!)); current();
      if (receipt.revision >= expected.titleRevision) expected = { ...expected, title: receipt.title, titleRevision: receipt.revision, revision: Math.max(expected.revision, receipt.revision) };
    }
    return expected;
  } finally { live.dispose(); }
}
