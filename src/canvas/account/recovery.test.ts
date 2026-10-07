import { afterEach, expect, it, vi } from 'vitest';
import { RecoveryCoordinator, recoveryStorageFailure, type RecoveryAuthority } from './recovery';
const authority = { accountId: 'synthetic-member', expiresAt: 100000, descriptor: { summary: { id: 'synthetic-board', accountId: 'synthetic-member', role: 'editor' }, recoveryEpoch: '11111111-1111-4111-8111-111111111111', capabilities: ['write'] } } as RecoveryAuthority;
it('@04-04-01 authorizes before local inspection and confirms saved only after drain', async () => {
  const events: string[] = [];
  const coordinator = new RecoveryCoordinator({ authorize: async () => { events.push('authorize'); return authority; }, inspect: async () => { events.push('inspect'); return true; }, drain: async () => { events.push('drain'); }, preserve: async () => {}, current: () => true, changed: state => events.push(state), now: () => 1000 });
  await expect(coordinator.open()).resolves.toEqual(authority);
  expect(events).toEqual(['checking-access', 'authorize', 'inspect', 'recovering', 'drain', 'saved']);
  expect(vi.isMockFunction(coordinator.open)).toBe(false);
});
afterEach(() => vi.useRealTimers());
function fixture() {
  const events: string[] = []; const dependencies = { authorize: vi.fn(async () => authority), inspect: vi.fn(async () => true), drain: vi.fn(async () => {}), preserve: vi.fn(async () => {}), current: vi.fn(() => true), changed: (state: string, stalled: boolean) => events.push(state + (stalled ? ':stalled' : '')), now: () => 1000, random: () => 0.5 };
  return { events, dependencies, coordinator: new RecoveryCoordinator(dependencies) };
}
it('@04-04-01 explicit expiry and denied authority never inspect local data', async () => {
  for (const status of [401, 403, 404, 409]) {
    const f = fixture(); f.dependencies.authorize.mockRejectedValue(Object.assign(new Error('Access'), { status }));
    await f.coordinator.open(); expect(f.dependencies.inspect).not.toHaveBeenCalled(); expect(f.dependencies.drain).not.toHaveBeenCalled(); expect(f.events.at(-1)).toBe(status === 401 ? 'expired' : 'denied'); f.coordinator.dispose();
  }
  const f = fixture(); f.dependencies.authorize.mockResolvedValue({ ...authority, expiresAt: 500 }); await f.coordinator.open(); expect(f.events.at(-1)).toBe('expired'); expect(f.dependencies.inspect).not.toHaveBeenCalled();
});
it('@04-04-01 Viewer isolates pending data while allowing authorized server hydration', async () => {
  const f = fixture(); const viewer = { ...authority, descriptor: { ...authority.descriptor, summary: { ...authority.descriptor.summary, role: 'viewer' as const }, capabilities: [] } };
  f.dependencies.authorize.mockResolvedValue(viewer); expect(await f.coordinator.open()).toEqual(viewer); expect(f.dependencies.inspect).not.toHaveBeenCalled(); expect(f.events.at(-1)).toBe('denied');
});
it('@04-04-01 outage keeps authority and retries at capped backoff with one flight', async () => {
  vi.useFakeTimers(); const f = fixture(); f.dependencies.drain.mockRejectedValue(new Error('503'));
  await f.coordinator.open(); expect(f.events.at(-1)).toBe('pending'); expect(f.dependencies.drain).toHaveBeenCalledTimes(1);
  for (const delay of [1000, 2000, 4000, 8000, 16000, 30000, 30000]) { const before = f.dependencies.drain.mock.calls.length; await vi.advanceTimersByTimeAsync(delay - 1); expect(f.dependencies.drain).toHaveBeenCalledTimes(before); await vi.advanceTimersByTimeAsync(1); expect(f.dependencies.drain).toHaveBeenCalledTimes(before + 1); }
  f.dependencies.drain.mockResolvedValue(); const a = f.coordinator.retryRecovery(); const b = f.coordinator.retryRecovery(); expect(a).toBe(b); await a; expect(f.events.at(-1)).toBe('saved'); f.coordinator.dispose();
});
it('@04-04-01 stalled and aborted drains cannot publish late success', async () => {
  vi.useFakeTimers(); const f = fixture(); let finish!: () => void; f.dependencies.drain.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const run = f.coordinator.open(); await vi.advanceTimersByTimeAsync(15000); expect(f.events.at(-1)).toBe('recovering:stalled'); await vi.advanceTimersByTimeAsync(15000); await run; expect(f.events.at(-1)).toBe('pending'); finish(); await Promise.resolve(); expect(f.events.at(-1)).toBe('pending'); f.coordinator.dispose();
});
it('@04-04-01 disposal and generation changes reject late inspection', async () => {
  const f = fixture(); let finish!: (value: RecoveryAuthority) => void; f.dependencies.authorize.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const run = f.coordinator.open(); f.dependencies.current.mockReturnValue(false); finish(authority); await run; expect(f.dependencies.inspect).not.toHaveBeenCalled(); expect(f.events).toEqual(['checking-access']); f.coordinator.dispose();
});
it('@04-04-01 preservation failure and corrupt or restored journals stay isolated', async () => {
  for (const [code, outcome] of [['CORRUPT', 'corrupt'], ['RECOVERY_EPOCH_MISMATCH', 'epoch-mismatch'], ['BLOCKED', 'storage-paused']]) {
    const f = fixture(); f.dependencies.inspect.mockRejectedValue(Object.assign(new Error('Retained'), { code })); await f.coordinator.open(); expect(f.events.at(-1)).toBe(outcome); expect(f.dependencies.drain).not.toHaveBeenCalled(); f.coordinator.dispose();
  }
  const f = fixture(); f.dependencies.preserve.mockRejectedValue(new Error('Quota')); await f.coordinator.open(); expect(f.events.at(-1)).toBe('storage-paused'); expect(f.dependencies.drain).not.toHaveBeenCalled();
});

it('late native sync retries cannot authorize a disposed or stale recovery scope', async () => {
  for (const invalidation of ['disposed', 'stale'] as const) {
    const f = fixture();
    await f.coordinator.open();
    f.dependencies.authorize.mockClear();
    f.events.length = 0;
    if (invalidation === 'disposed') f.coordinator.dispose();
    else f.dependencies.current.mockReturnValue(false);
    await expect(f.coordinator.retryRecovery()).resolves.toBeUndefined();
    f.coordinator.retryIfIdle();
    expect(f.dependencies.authorize).not.toHaveBeenCalled();
    expect(f.events).toEqual([]);
    f.coordinator.dispose();
  }
});

it('retains quota identity through preservation wrappers and clears it on a successful retry', async () => {
  const f = fixture(); const changed = vi.fn();
  f.dependencies.preserve.mockRejectedValueOnce(new DOMException('Synthetic quota', 'QuotaExceededError'));
  const coordinator = new RecoveryCoordinator({ ...f.dependencies, changed });
  await coordinator.open();
  const paused = changed.mock.calls.find(([state]) => state === 'storage-paused');
  expect(paused).toBeDefined(); expect(recoveryStorageFailure(paused![2])).toBe('quota');
  await coordinator.retryRecovery(); expect(changed.mock.calls.at(-1)).toEqual(['saved', false, undefined]);
  coordinator.dispose();
});
it('unavailable and cyclic errors remain bounded and do not impersonate quota failures', () => {
  const cyclic: { cause?: unknown } = {}; cyclic.cause = cyclic;
  expect(recoveryStorageFailure(cyclic)).toBe('unavailable');
  expect(recoveryStorageFailure(new Error('QuotaExceededError'))).toBe('unavailable');
});
