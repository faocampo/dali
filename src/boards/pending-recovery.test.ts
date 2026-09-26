import { afterEach, expect, it, vi } from 'vitest';
import { pendingRecords, pendingTitleIntents, subscribeJournalInvalidation, type JournalRecord } from '../canvas/account/outbox';
import { inspectAuthorizedPendingBoards, subscribePendingBoardInvalidation } from './pending-recovery';
vi.mock('../canvas/account/outbox', () => ({ pendingRecords: vi.fn(), pendingTitleIntents: vi.fn(async () => []), subscribeJournalInvalidation: vi.fn() }));
afterEach(() => { vi.resetAllMocks(); vi.mocked(pendingTitleIntents).mockResolvedValue([]); });
const card = (id: string, accountId = 'member') => ({ id, accountId });
const record = (id: string, boardId: string, accountId = 'member') => ({ id, boardId, accountId, epoch: 'old-epoch' } as JournalRecord);
it('reads only unique currently authorized account and board indexes', async () => {
  vi.mocked(pendingRecords).mockResolvedValue([record('pending', 'one')]);
  const result = await inspectAuthorizedPendingBoards('member', [card('one'), card('one')], new AbortController().signal);
  expect(pendingRecords).toHaveBeenCalledExactlyOnceWith('member', 'one');
  expect(result).toEqual(new Map([['one', { hasPendingChanges: true }]]));
  expect(JSON.stringify([...result])).not.toContain('old-epoch');
});
it('zero authorized cards never inspects private journal records', async () => {
  expect(await inspectAuthorizedPendingBoards('member', [], new AbortController().signal)).toEqual(new Map());
  expect(pendingRecords).not.toHaveBeenCalled();
});
it('rejects an identity-mixed list before any storage read', async () => {
  await expect(inspectAuthorizedPendingBoards('member', [card('one'), card('secret', 'other')], new AbortController().signal)).rejects.toThrow();
  expect(pendingRecords).not.toHaveBeenCalled();
});
it('inspection failure stays distinct from an empty journal', async () => {
  vi.mocked(pendingRecords).mockRejectedValue(new Error('Storage unavailable'));
  await expect(inspectAuthorizedPendingBoards('member', [card('one')], new AbortController().signal)).rejects.toThrow('Storage unavailable');
});
it('suppresses completion after identity or list invalidation', async () => {
  let release!: (value: JournalRecord[]) => void;
  vi.mocked(pendingRecords).mockReturnValue(new Promise(resolve => { release = resolve; }));
  const controller = new AbortController();
  const result = inspectAuthorizedPendingBoards('member', [card('one')], controller.signal);
  controller.abort(); release([record('pending', 'one')]);
  await expect(result).rejects.toThrow();
});
it('retains old epochs and clears only the resolved board after a fresh inspection', async () => {
  const rows = new Map([['one', [record('a', 'one'), record('b', 'one')]], ['two', [record('c', 'two')]]]);
  vi.mocked(pendingRecords).mockImplementation(async (_account, board) => rows.get(board)!);
  const inspect = () => inspectAuthorizedPendingBoards('member', [card('one'), card('two')], new AbortController().signal);
  expect((await inspect()).get('one')?.hasPendingChanges).toBe(true);
  rows.get('one')!.pop(); expect((await inspect()).get('one')?.hasPendingChanges).toBe(true);
  rows.set('one', []); expect([...(await inspect()).values()]).toEqual([{ hasPendingChanges: false }, { hasPendingChanges: true }]);
});
it('rejects a storage result outside its authorized scope', async () => {
  vi.mocked(pendingRecords).mockResolvedValue([record('secret', 'one', 'other')]);
  await expect(inspectAuthorizedPendingBoards('member', [card('one')], new AbortController().signal)).rejects.toThrow();
});
it('delegates metadata-free invalidation and cleanup', () => {
  const listener = vi.fn(); const close = vi.fn(); vi.mocked(subscribeJournalInvalidation).mockReturnValue(close);
  expect(subscribePendingBoardInvalidation(listener)).toBe(close);
  expect(subscribeJournalInvalidation).toHaveBeenCalledExactlyOnceWith(listener);
});
