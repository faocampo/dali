import { expect, it, vi } from 'vitest';
import { captureTitleIntent, replayTitleIntent, type TitleIntent, type TitleStore } from './title-intent';
import type { BoardDescriptor } from '../../boards/BoardLibrary';

const descriptor: BoardDescriptor = { summary: { id: 'board', accountId: 'member', title: 'Original', updatedAt: 1, pendingCount: 0, role: 'owner', access: 'private' }, rootDocId: 'root', contentDocId: 'content', revision: 1, recoveryEpoch: '11111111-1111-4111-8111-111111111111', capabilities: ['write'] };
function fixture() {
  let row: TitleIntent | undefined;
  const store: TitleStore = { read: async () => row, write: async value => { row = value; }, acknowledge: async id => { if (row?.operationId === id) row = undefined; } };
  return { store, read: () => row };
}
it('retains the latest intent and stable operation across retries and cold reopen', async () => {
  const { store, read } = fixture();
  const first = await captureTitleIntent(store, descriptor, 'New title', true);
  expect(read()?.title).toBe('New title');
  expect((await captureTitleIntent(store, descriptor, 'New title', true)).operationId).toBe(first.operationId);
  const request = vi.fn(async (path: string) => path.includes('/operations/') ? { status: 'completed', result: { ...descriptor, revision: 2, summary: { ...descriptor.summary, title: 'New title' } } } : descriptor);
  await replayTitleIntent(store, { accountId: 'member', descriptor, expiresAt: Date.now() + 10000 }, request);
  expect(read()).toBeUndefined(); expect(request).toHaveBeenCalledTimes(1);
});
it('old acknowledgment never removes a newer captured title', async () => {
  const { store, read } = fixture();
  const old = await captureTitleIntent(store, descriptor, 'First', true);
  const newer = await captureTitleIntent(store, descriptor, 'Second', true);
  await store.acknowledge(old.operationId);
  expect(read()?.operationId).toBe(newer.operationId);
});
it('storage pause rejects mutation and preserves current text', async () => {
  const { store, read } = fixture();
  await captureTitleIntent(store, descriptor, 'Retained', true);
  await expect(captureTitleIntent(store, descriptor, 'Rejected', false)).rejects.toThrow();
  expect(read()?.title).toBe('Retained');
});
it.each(['epoch', 'account', 'viewer', 'expired', 'revision'])('fences %s and retains intent', async kind => {
  const { store, read } = fixture();
  await captureTitleIntent(store, descriptor, 'Retained', true);
  const fresh = structuredClone(descriptor);
  if (kind === 'epoch') fresh.recoveryEpoch = '22222222-2222-4222-8222-222222222222';
  if (kind === 'viewer') fresh.summary.role = 'viewer';
  if (kind === 'revision') fresh.revision++;
  const request = vi.fn(async () => ({ status: 'unknown' }));
  await expect(replayTitleIntent(store, { accountId: kind === 'account' ? 'other' : 'member', descriptor: fresh, expiresAt: kind === 'expired' ? 0 : Date.now() + 10000 }, request)).rejects.toThrow();
  expect(read()?.title).toBe('Retained');
  expect(request.mock.calls.length).toBeLessThanOrEqual(1);
});
it('rejects a receipt for a different board or title without acknowledging intent', async () => {
  const { store, read } = fixture();
  await captureTitleIntent(store, descriptor, 'Retained', true);
  await expect(replayTitleIntent(store, { accountId: 'member', descriptor, expiresAt: Date.now() + 10000 }, async () => ({ status: 'completed', result: descriptor }))).rejects.toThrow();
  expect(read()?.title).toBe('Retained');
});
