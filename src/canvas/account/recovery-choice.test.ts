import { afterEach, expect, it, vi } from 'vitest';
import { RecoveryCoordinator, type RecoveryAuthority } from './recovery';
const authority = { accountId: 'synthetic-member', expiresAt: 100000, descriptor: { summary: { id: 'synthetic-board', accountId: 'synthetic-member', role: 'editor' }, recoveryEpoch: '11111111-1111-4111-8111-111111111111', capabilities: ['write'], liveEnabled: true } } as RecoveryAuthority;
afterEach(() => vi.useRealTimers());
it('@05-05-01 preserves and checks the version before any title replay, inspection or document drain', async () => {
  const events: string[] = [];
  const dependencies = {
    authorize: async () => { events.push('authorize'); return authority; },
    preserve: async () => { events.push('preserve'); },
    beforeReplay: async () => { events.push('baseline'); throw Object.assign(new Error('Choose a version'), { code: 'RECOVERY_CHOICE' }); },
    title: async () => { events.push('title'); }, inspect: async () => { events.push('inspect'); return true; },
    drain: async () => { events.push('drain'); }, verify: async () => { events.push('verify'); },
    current: () => true, changed: (state: string) => events.push(state), now: () => 1000,
  };
  const coordinator = new RecoveryCoordinator(dependencies);
  try { await coordinator.open(); expect(events).toEqual(['checking-access', 'authorize', 'preserve', 'baseline', 'choice']); }
  finally { coordinator.dispose(); }
});
it('@05-05-01 a retained version choice never schedules automatic recovery or interprets activity as consent', async () => {
  vi.useFakeTimers();
  const beforeReplay = vi.fn(async () => { throw Object.assign(new Error('Choose a version'), { code: 'RECOVERY_CHOICE' }); });
  const drain = vi.fn(async () => {}); const changed = vi.fn();
  const dependencies = { authorize: async () => authority, preserve: async () => {}, beforeReplay,
    inspect: async () => true, drain, current: () => true, changed, now: () => 1000 };
  const coordinator = new RecoveryCoordinator(dependencies);
  try {
    await coordinator.open(); await vi.advanceTimersByTimeAsync(60000); coordinator.retryIfIdle(); await Promise.resolve();
    expect(beforeReplay).toHaveBeenCalledTimes(1); expect(drain).not.toHaveBeenCalled();
    expect(changed.mock.calls.at(-1)?.[0]).toBe('choice');
    await coordinator.retryRecovery(); expect(beforeReplay).toHaveBeenCalledTimes(2); expect(drain).not.toHaveBeenCalled();
  } finally { coordinator.dispose(); }
});
it('@05-05-01 denied or expired authority cannot inspect the retained local version', async () => {
  const beforeReplay = vi.fn(async () => {}); const inspect = vi.fn(async () => true);
  for (const allowed of [false, true]) {
    const dependencies = { authorize: async () => allowed ? { ...authority, expiresAt: 500 } : { ...authority, descriptor: { ...authority.descriptor, summary: { ...authority.descriptor.summary, role: 'viewer' as const } } },
      preserve: async () => {}, beforeReplay, inspect, drain: async () => {}, current: () => true, changed: () => {}, now: () => 1000 };
    const coordinator = new RecoveryCoordinator(dependencies); await coordinator.open(); coordinator.dispose();
  }
  expect(beforeReplay).not.toHaveBeenCalled(); expect(inspect).not.toHaveBeenCalled();
});
it('@05-05-02 a generation change during the baseline request prevents every replay side effect', async () => {
  let current = true; let finish!: () => void;
  const started = vi.fn(); const title = vi.fn(async () => {}); const drain = vi.fn(async () => {}); const changed = vi.fn();
  const dependencies = { authorize: async () => authority, preserve: async () => {},
    beforeReplay: async () => { started(); await new Promise<void>(resolve => { finish = resolve; }); },
    title, inspect: async () => true, drain, current: () => current, changed, now: () => 1000 };
  const coordinator = new RecoveryCoordinator(dependencies);
  try {
    const opening = coordinator.open(); await vi.waitFor(() => expect(started).toHaveBeenCalledOnce());
    current = false; finish(); await opening;
    expect(title).not.toHaveBeenCalled(); expect(drain).not.toHaveBeenCalled();
    expect(changed.mock.calls.some(([state]) => state === 'saved')).toBe(false);
  } finally { coordinator.dispose(); }
});
