import type { BoardDescriptor } from '../../boards/BoardLibrary';
export type RecoveryOutcome = 'checking-access' | 'recovering' | 'pending' | 'retrying' | 'saved' | 'expired' | 'denied' | 'storage-paused' | 'corrupt' | 'epoch-mismatch';
export type RecoveryStorageFailure = 'quota' | 'unavailable';
/** Preserve typed storage failures through coordinator wrappers; never infer from copy. */
export function recoveryStorageFailure(error: unknown): RecoveryStorageFailure {
  const seen = new Set<object>();
  while (error && typeof error === 'object' && !seen.has(error)) {
    seen.add(error);
    if ('name' in error && error.name === 'QuotaExceededError') return 'quota';
    error = 'cause' in error ? error.cause : undefined;
  }
  return 'unavailable';
}
export function recoveryStorageMessage(failure?: RecoveryStorageFailure) {
  return failure === 'quota'
    ? "This browser's recovery storage is full. Keep this tab open. Download a recovery copy, free space for this site, then retry saving."
    : 'This browser cannot preserve more changes. Keep this tab open. Download a recovery copy, allow storage for this site, then retry saving.';
}
export type RecoveryAuthority = { accountId: string; expiresAt: number; descriptor: BoardDescriptor };
export type RecoveryDependencies = { authorize: (signal: AbortSignal) => Promise<RecoveryAuthority>; title?: (authority: RecoveryAuthority, signal: AbortSignal) => Promise<void>; inspect: (authority: RecoveryAuthority) => Promise<boolean>; drain: (authority: RecoveryAuthority, signal: AbortSignal) => Promise<void>; verify?: (authority: RecoveryAuthority, signal: AbortSignal) => Promise<void>; preserve: () => Promise<void>; current: () => boolean; changed: (state: RecoveryOutcome, stalled: boolean, error?: unknown) => void; now?: () => number; random?: () => number };
export class RecoveryCoordinator {
  private flight?: Promise<RecoveryAuthority | undefined>;
  private controller?: AbortController;
  private timer?: ReturnType<typeof setTimeout>;
  private attempt = 0;
  private disposed = false;
  private authority?: RecoveryAuthority;
  constructor(private dependencies: RecoveryDependencies) {}
  private emit(state: RecoveryOutcome, stalled = false, error?: unknown) { if (!this.disposed && this.dependencies.current()) this.dependencies.changed(state, stalled, error); }
  private assertCurrent(signal: AbortSignal) { if (this.disposed || signal.aborted || !this.dependencies.current()) throw new Error('Recovery interrupted'); }
  open() { return this.run(false); }
  retryRecovery() { return this.run(true); }
  retryIfIdle() { if (!this.flight && !this.timer && !this.disposed) void this.run(true); }
  dispose() { this.disposed = true; clearTimeout(this.timer); this.controller?.abort(); }
  private run(retry: boolean): Promise<RecoveryAuthority | undefined> {
    if (this.disposed || !this.dependencies.current()) return Promise.resolve(undefined);
    if (this.flight) return this.flight;
    clearTimeout(this.timer); this.timer = undefined;
    const controller = this.controller = new AbortController();
    this.flight = this.execute(controller, retry).finally(() => { this.flight = undefined; });
    return this.flight;
  }
  private async execute(controller: AbortController, retry: boolean) {
    const d = this.dependencies; const signal = controller.signal;
    this.emit(retry ? 'retrying' : 'checking-access');
    const stalled = setTimeout(() => this.emit(retry ? 'retrying' : 'recovering', true), 15000);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        (async () => {
          const authority = await d.authorize(signal); this.assertCurrent(signal);
          if (authority.expiresAt <= (d.now?.() ?? Date.now())) throw Object.assign(new Error('Session expired'), { status: 401 });
          if (this.authority && (authority.accountId !== this.authority.accountId || authority.descriptor.summary.id !== this.authority.descriptor.summary.id)) throw Object.assign(new Error('Identity changed'), { status: 409 });
          if (this.authority && authority.descriptor.recoveryEpoch !== this.authority.descriptor.recoveryEpoch) throw Object.assign(new Error('Restored board'), { code: 'RECOVERY_EPOCH_MISMATCH' });
          this.authority = authority;
          if (authority.descriptor.summary.role === 'viewer' || !authority.descriptor.capabilities.includes('write')) { this.emit('denied'); return authority; }
          try { await d.preserve(); } catch (error) { throw Object.assign(new Error('Local preservation failed'), { code: 'STORAGE_PAUSED', cause: error }); }
          this.assertCurrent(signal);
          await d.title?.(authority, signal); this.assertCurrent(signal);
          const pending = await d.inspect(authority); this.assertCurrent(signal);
          if (pending) {
            this.emit('recovering');
            await d.drain(authority, signal); this.assertCurrent(signal);
          }
          await d.verify?.(authority, signal); this.assertCurrent(signal);
          this.attempt = 0; this.emit('saved'); return authority;
        })(),
        new Promise<never>((_, reject) => { timeout = setTimeout(() => { controller.abort(); reject(new Error('Recovery timed out')); }, 30000); }),
      ]);
      return result;
    } catch (error) {
      if (this.disposed || !d.current()) return;
      const { status, code } = error as { status?: number; code?: string };
      if (status === 401) this.emit('expired');
      else if ([403, 404, 409].includes(status ?? 0)) this.emit('denied');
      else if (code === 'RECOVERY_EPOCH_MISMATCH' || code === 'RECOVERY_EPOCH_REQUIRED') this.emit('epoch-mismatch');
      else if (code === 'CORRUPT' || code === 'LEGACY') this.emit('corrupt');
      else if (code === 'STORAGE_PAUSED' || code === 'FAILED' || code === 'BLOCKED') this.emit('storage-paused', false, error);
      else {
        this.emit('pending');
        const delay = Math.min(30000, 1000 * 2 ** Math.min(this.attempt++, 5));
        this.timer = setTimeout(() => { this.timer = undefined; void this.retryRecovery(); }, Math.min(30000, delay * (0.8 + (d.random?.() ?? Math.random()) * 0.4)));
      }
      return this.authority;
    } finally { clearTimeout(stalled); clearTimeout(timeout); }
  }
}
