import { expect, it, vi } from 'vitest';
import { bufferedTitleStore, captureTitleIntent, replayTitleIntent, advanceLiveTitleIntent, validDocumentRevisionReceipt, type TitleIntent, type TitleStore } from './title-intent';
import type { BoardDescriptor } from '../../boards/BoardLibrary';

const descriptor: BoardDescriptor = { summary: { id: 'board', accountId: 'member', title: 'Original', updatedAt: 1, pendingCount: 0, role: 'owner', access: 'private' }, rootDocId: 'root', contentDocId: 'content', revision: 1, recoveryEpoch: '11111111-1111-4111-8111-111111111111', capabilities: ['write'] };
function fixture() {
  let row: TitleIntent | undefined;
  const store: TitleStore = { read: async () => row, write: async value => { row = value; }, acknowledge: async id => { if (row?.operationId === id) row = undefined; }, advance: async (id, previousRevision, revision) => { if (row?.operationId !== id || row.baseRevision !== previousRevision) return; row = { ...row, baseRevision: revision }; return row; } };
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

it('advances a live title only across contiguous own commit receipts', async () => {
  const { store, read } = fixture();
  const intent = await captureTitleIntent(store, descriptor, 'Retained', true);
  const live = new Set([intent.operationId]);
  await advanceLiveTitleIntent(store, live, { previousRevision: 1, revision: 2 });
  expect(read()).toMatchObject({ operationId: intent.operationId, baseRevision: 2, title: 'Retained' });
  await advanceLiveTitleIntent(store, live, { previousRevision: 2, revision: 2 });
  await advanceLiveTitleIntent(store, live, { previousRevision: 3, revision: 4 });
  expect(read()?.baseRevision).toBe(2);
  await advanceLiveTitleIntent(store, live, { previousRevision: 2, revision: 3 });
  expect(read()?.baseRevision).toBe(3);
});
it('recovered titles and external revision gaps remain conflicts', async () => {
  const { store, read } = fixture();
  const intent = await captureTitleIntent(store, descriptor, 'Retained', true);
  await advanceLiveTitleIntent(store, new Set(), { previousRevision: 1, revision: 2 });
  expect(read()?.baseRevision).toBe(1);
  await advanceLiveTitleIntent(store, new Set([intent.operationId]), { previousRevision: 2, revision: 3 });
  const request = vi.fn(async () => ({ status: 'unknown' }));
  await expect(replayTitleIntent(store, { accountId: 'member', descriptor: { ...descriptor, revision: 3 }, expiresAt: Date.now() + 10000 }, request)).rejects.toThrow('The board changed');
  expect(request).toHaveBeenCalledTimes(1); expect(read()?.baseRevision).toBe(1);
});
it('an old receipt cannot advance a concurrently replaced title', async () => {
  const { store, read } = fixture();
  const first = await captureTitleIntent(store, descriptor, 'First', true);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const delayed: TitleStore = { ...store, advance: async (...args) => { await gate; return store.advance!(...args); } };
  const work = advanceLiveTitleIntent(delayed, new Set([first.operationId]), { previousRevision: 1, revision: 2 });
  await Promise.resolve();
  const newer = await captureTitleIntent(store, descriptor, 'Newer', true);
  release(); await work;
  expect(read()).toEqual(newer);
});
it.each([null, {}, { previousRevision: 0, revision: 1 }, { previousRevision: 2, revision: 1 }, { previousRevision: 1, revision: 3 }, { previousRevision: 1.5, revision: 2.5 }])('rejects malformed document revision proof %j', value => {
  expect(validDocumentRevisionReceipt(value)).toBe(false);
});

function latch() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}
it('advances a pending title after delayed local persistence completes', async () => {
  const { store: durable, read } = fixture();
  const entered = latch(), held = latch();
  const original = durable.write;
  durable.write = vi.fn(async value => { entered.release(); await held.promise; await original(value); });
  const store = bufferedTitleStore(durable, vi.fn());
  const saving = captureTitleIntent(store, descriptor, 'Delayed', true);
  await entered.promise;
  const intent = (await store.read())!;
  const advancing = advanceLiveTitleIntent(store, new Set([intent.operationId]), { previousRevision: 1, revision: 2 });
  held.release(); await saving; await advancing; await store.preserve();
  expect(read()).toMatchObject({ title: 'Delayed', baseRevision: 2 });
});
it('retains revision proof through failed persistence and a later preservation retry', async () => {
  const { store: durable, read } = fixture();
  const original = durable.write;
  durable.write = vi.fn().mockRejectedValueOnce(new Error('quota')).mockRejectedValueOnce(new Error('quota')).mockImplementation(original);
  const failed = vi.fn();
  const store = bufferedTitleStore(durable, failed);
  await expect(captureTitleIntent(store, descriptor, 'Retained', true)).rejects.toThrow('quota');
  const intent = (await store.read())!;
  await expect(advanceLiveTitleIntent(store, new Set([intent.operationId]), { previousRevision: 1, revision: 2 })).rejects.toThrow('quota');
  expect(await store.read()).toMatchObject({ title: 'Retained' });
  await store.preserve();
  expect(read()).toMatchObject({ title: 'Retained', baseRevision: 2 });
  expect(failed).toHaveBeenCalledTimes(2);
});
it('a new title captured during revision persistence survives the older completion', async () => {
  const { store: durable, read } = fixture();
  const store = bufferedTitleStore(durable, vi.fn());
  const old = await captureTitleIntent(store, descriptor, 'Old', true);
  const entered = latch(), held = latch();
  const original = durable.advance!;
  durable.advance = vi.fn(async (id, previousRevision, revision) => { entered.release(); await held.promise; return original(id, previousRevision, revision); });
  const advancing = advanceLiveTitleIntent(store, new Set([old.operationId]), { previousRevision: 1, revision: 2 });
  await entered.promise;
  const saving = captureTitleIntent(store, { ...descriptor, revision: 2 }, 'Newest', true);
  await vi.waitFor(async () => expect((await store.read())?.title).toBe('Newest'));
  held.release(); await advancing; await saving; await store.preserve();
  expect(read()).toMatchObject({ title: 'Newest', baseRevision: 2 });
  expect(read()?.operationId).not.toBe(old.operationId);
});

it('another tab replacing the persisted intent wins over an earlier revision receipt', async () => {
  const { store: durable, read } = fixture();
  const store = bufferedTitleStore(durable, vi.fn());
  const old = await captureTitleIntent(store, descriptor, 'Old', true);
  const entered = latch(), held = latch();
  const original = durable.advance!;
  durable.advance = vi.fn(async (id, previousRevision, revision) => { entered.release(); await held.promise; return original(id, previousRevision, revision); });
  const advancing = advanceLiveTitleIntent(store, new Set([old.operationId]), { previousRevision: 1, revision: 2 });
  await entered.promise;
  const newer = { ...old, operationId: crypto.randomUUID(), title: 'Other tab', baseRevision: 2 };
  await durable.write(newer);
  held.release(); await advancing; await store.preserve();
  expect(read()).toEqual(newer);
});
