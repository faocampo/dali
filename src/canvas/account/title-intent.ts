import type { BoardDescriptor } from '../../boards/BoardLibrary';
import type { RecoveryAuthority } from './recovery';
export type TitleIntent = { schemaVersion: 1; accountId: string; boardId: string; epoch: string; operationId: string; baseRevision: number; title: string; tabId?: string };
export type TitleStore = { tabId?: string; read(): Promise<TitleIntent | undefined>; write(value: TitleIntent): Promise<void>; acknowledge(id: string): Promise<void>; advance?(id: string, previousRevision: number, revision: number): Promise<TitleIntent | undefined> };
export function validTitleIntent(value: TitleIntent): boolean {
  return value?.schemaVersion === 1 && (value.tabId === undefined || typeof value.tabId === 'string' && value.tabId.length > 0 && value.tabId.length <= 256) && [value.accountId, value.boardId, value.epoch, value.operationId].every(part => typeof part === 'string' && part.length > 0 && part.length <= 256) && Number.isSafeInteger(value.baseRevision) && value.baseRevision > 0 && typeof value.title === 'string' && !!value.title.trim() && [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(value.title)].length <= 200;
}
export async function captureTitleIntent(store: TitleStore, descriptor: BoardDescriptor, title: string, canWrite: boolean): Promise<TitleIntent> {
  if (!canWrite) throw new Error('Editing is paused. Retry saving before renaming.');
  const previous = await store.read();
  if (previous?.title === title) return previous;
  const value: TitleIntent = { schemaVersion: 1, accountId: descriptor.summary.accountId, boardId: descriptor.summary.id, epoch: descriptor.recoveryEpoch, operationId: crypto.randomUUID(), baseRevision: descriptor.revision, title, ...(store.tabId ? { tabId: store.tabId } : {}) };
  if (!validTitleIntent(value)) throw new Error('Use a board name of 200 characters or fewer.');
  await store.write(value); return value;
}
export async function replayTitleIntent(store: TitleStore, authority: RecoveryAuthority, request: (path: string, init?: RequestInit) => Promise<unknown>, confirm?: (intent: TitleIntent, result: BoardDescriptor) => Promise<void>): Promise<BoardDescriptor | undefined> {
  const intent = await store.read(); if (!intent) return;
  const fresh = authority.descriptor;
  if (!validTitleIntent(intent)) throw Object.assign(new Error('Invalid title recovery'), { code: 'CORRUPT' });
  if (intent.epoch !== fresh.recoveryEpoch) throw Object.assign(new Error('Restored board'), { code: 'RECOVERY_EPOCH_MISMATCH' });
  if (authority.accountId !== intent.accountId || fresh.summary.accountId !== intent.accountId || fresh.summary.id !== intent.boardId || fresh.summary.role === 'viewer' || !fresh.capabilities.includes('write') || authority.expiresAt <= Date.now()) throw new Error('Fresh board write access is required.');
  const receipt = await request('/api/operations/' + encodeURIComponent(intent.operationId)) as { status: string; result?: BoardDescriptor };
  let result: BoardDescriptor;
  if (receipt.status === 'completed') result = receipt.result!;
  else {
    if (receipt.status !== 'unknown' || fresh.revision !== intent.baseRevision) throw new Error('The board changed. Your pending name is preserved; review the current board before retrying.');
    result = await request('/api/boards/' + encodeURIComponent(intent.boardId), { method: 'PATCH', body: JSON.stringify({ operationId: intent.operationId, revision: intent.baseRevision, title: intent.title }) }) as BoardDescriptor;
  }
  if (!result || result.summary?.id !== intent.boardId || result.summary.accountId !== intent.accountId || result.summary.title !== intent.title || result.recoveryEpoch !== intent.epoch || !Number.isSafeInteger(result.revision) || result.revision <= intent.baseRevision) throw new Error('The saved name could not be confirmed.');
  await confirm?.(intent, result);
  await store.acknowledge(intent.operationId);
  return result;
}

/** A receipt proves only this request's contiguous server revision transition. */
export type DocumentRevisionReceipt = { previousRevision: number; revision: number };
export function validDocumentRevisionReceipt(value: unknown): value is DocumentRevisionReceipt {
  if (!value || typeof value !== 'object') return false;
  const row = value as DocumentRevisionReceipt;
  return Number.isSafeInteger(row.previousRevision) && row.previousRevision > 0 &&
    Number.isSafeInteger(row.revision) && (row.revision === row.previousRevision || row.revision === row.previousRevision + 1);
}
export async function advanceLiveTitleIntent(store: TitleStore, operationIds: ReadonlySet<string>, receipt: DocumentRevisionReceipt) {
  if (!validDocumentRevisionReceipt(receipt) || receipt.revision === receipt.previousRevision) return;
  const intent = await store.read();
  if (!intent || !operationIds.has(intent.operationId) || intent.baseRevision !== receipt.previousRevision) return;
  return store.advance?.(intent.operationId, receipt.previousRevision, receipt.revision);
}

/** Serialize local title persistence independently of network recovery. */
export function bufferedTitleStore(durable: TitleStore, onFailure: (error: unknown) => void, onWrite: (value: TitleIntent) => void = () => {}) {
  let retained: TitleIntent | undefined;
  const proofs: Array<DocumentRevisionReceipt & { id: string }> = [];
  let queue = Promise.resolve();
  function serial<T>(work: () => Promise<T>): Promise<T> {
    const result = queue.then(work);
    queue = result.then(() => {}, () => {});
    return result;
  }
  async function persist(value: TitleIntent) {
    try {
      await durable.write(value);
      if (retained === value) retained = undefined;
    } catch (error) { onFailure(error); throw error; }
  }
  async function flushProofs() {
    // Preserve an explicit local rename first; revision-only updates always use
    // the durable transaction's CAS so another tab's newer intent wins.
    if (retained) await persist(retained);
    let advanced: TitleIntent | undefined;
    while (proofs.length) {
      const proof = proofs[0]!;
      try { advanced = await durable.advance?.(proof.id, proof.previousRevision, proof.revision); }
      catch (error) { onFailure(error); throw error; }
      proofs.shift();
    }
    return advanced;
  }
  const store: TitleStore & { preserve(): Promise<void> } = {
    ...(durable.tabId ? { tabId: durable.tabId } : {}),
    read: async () => retained ?? durable.read(),
    write: value => {
      onWrite(value);
      retained = value;
      return serial(() => persist(value));
    },
    preserve: () => serial(async () => { await flushProofs(); }),
    acknowledge: id => serial(async () => {
      await durable.acknowledge(id);
      if (retained?.operationId === id) retained = undefined;
    }),
    advance: (id, previousRevision, revision) => serial(async () => {
      if (!validDocumentRevisionReceipt({ previousRevision, revision })) return;
      proofs.push({ id, previousRevision, revision });
      return flushProofs();
    }),
  };
  return store;
}
