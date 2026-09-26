import type { BoardDescriptor } from '../../boards/BoardLibrary';
export type RecoveryOutcome = 'checking-access' | 'recovering' | 'pending' | 'retrying' | 'saved' | 'expired' | 'denied' | 'storage-paused' | 'corrupt' | 'epoch-mismatch';
export type RecoveryAuthority = { accountId: string; expiresAt: number; descriptor: BoardDescriptor };
export type RecoveryDependencies = { authorize: (signal: AbortSignal) => Promise<RecoveryAuthority>; inspect: (authority: RecoveryAuthority) => Promise<boolean>; drain: (authority: RecoveryAuthority, signal: AbortSignal) => Promise<void>; preserve: () => Promise<void>; current: () => boolean; changed: (state: RecoveryOutcome, stalled: boolean) => void; now?: () => number; random?: () => number };
export class RecoveryCoordinator {
  constructor(private dependencies: RecoveryDependencies) {}
  async open() { this.dependencies.changed('checking-access', false); throw new Error('Recovery coordination unavailable'); }
}
