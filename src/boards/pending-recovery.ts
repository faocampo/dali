import { pendingRecords, pendingTitleIntents, subscribeJournalInvalidation } from '../canvas/account/outbox';

export type PendingBoardStatus = { hasPendingChanges: boolean };
/** The caller supplies a fresh authorized list; returned values contain no journal metadata. */
export async function inspectAuthorizedPendingBoards(accountId: string, boards: readonly { id: string; accountId: string }[], signal: AbortSignal): Promise<Map<string, PendingBoardStatus>> {
  signal.throwIfAborted();
  if (!accountId || boards.some(board => board.accountId !== accountId || !board.id)) throw new Error('Recovery authority changed');
  const results = await Promise.all([...new Set(boards.map(board => board.id))].map(async boardId => {
    signal.throwIfAborted();
    const records = await pendingRecords(accountId, boardId);
    const titles = await pendingTitleIntents(accountId, boardId);
    signal.throwIfAborted();
    if (records.some(record => record.accountId !== accountId || record.boardId !== boardId)) throw new Error('Recovery scope mismatch');
    // Old-epoch, legacy and quarantined records remain unresolved work.
    return [boardId, { hasPendingChanges: records.length > 0 || titles.length > 0 }] as const;
  }));
  signal.throwIfAborted(); return new Map(results);
}
export function subscribePendingBoardInvalidation(listener: () => void) {
  return subscribeJournalInvalidation(listener);
}
