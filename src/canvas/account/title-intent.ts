import type { BoardDescriptor } from '../../boards/BoardLibrary';
import type { RecoveryAuthority } from './recovery';
export type TitleIntent = { schemaVersion: 1; accountId: string; boardId: string; epoch: string; operationId: string; baseRevision: number; title: string };
export type TitleStore = { read(): Promise<TitleIntent | undefined>; write(value: TitleIntent): Promise<void>; acknowledge(id: string): Promise<void> };
export function validTitleIntent(value: TitleIntent): boolean {
  return value?.schemaVersion === 1 && [value.accountId, value.boardId, value.epoch, value.operationId].every(part => typeof part === 'string' && part.length > 0 && part.length <= 256) && Number.isSafeInteger(value.baseRevision) && value.baseRevision > 0 && typeof value.title === 'string' && !!value.title.trim() && [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(value.title)].length <= 200;
}
export async function captureTitleIntent(store: TitleStore, descriptor: BoardDescriptor, title: string, canWrite: boolean): Promise<TitleIntent> {
  if (!canWrite) throw new Error('Editing is paused. Retry saving before renaming.');
  const previous = await store.read();
  if (previous?.title === title) return previous;
  const value: TitleIntent = { schemaVersion: 1, accountId: descriptor.summary.accountId, boardId: descriptor.summary.id, epoch: descriptor.recoveryEpoch, operationId: crypto.randomUUID(), baseRevision: descriptor.revision, title };
  if (!validTitleIntent(value)) throw new Error('Use a board name of 200 characters or fewer.');
  await store.write(value); return value;
}
export async function replayTitleIntent(store: TitleStore, authority: RecoveryAuthority, request: (path: string, init?: RequestInit) => Promise<unknown>): Promise<BoardDescriptor | undefined> {
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
  await store.acknowledge(intent.operationId);
  return result;
}
