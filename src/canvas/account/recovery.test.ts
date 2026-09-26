import { expect, it, vi } from 'vitest';
import { RecoveryCoordinator, type RecoveryAuthority } from './recovery';
const authority = { accountId: 'synthetic-member', expiresAt: 100000, descriptor: { summary: { id: 'synthetic-board', accountId: 'synthetic-member', role: 'editor' }, recoveryEpoch: '11111111-1111-4111-8111-111111111111', capabilities: ['write'] } } as RecoveryAuthority;
it('@04-04-01 authorizes before local inspection and confirms saved only after drain', async () => {
  const events: string[] = [];
  const coordinator = new RecoveryCoordinator({ authorize: async () => { events.push('authorize'); return authority; }, inspect: async () => { events.push('inspect'); return true; }, drain: async () => { events.push('drain'); }, preserve: async () => {}, current: () => true, changed: state => events.push(state), now: () => 1000 });
  await expect(coordinator.open()).resolves.toEqual(authority);
  expect(events).toEqual(['checking-access', 'authorize', 'inspect', 'recovering', 'drain', 'saved']);
  expect(vi.isMockFunction(coordinator.open)).toBe(false);
});
