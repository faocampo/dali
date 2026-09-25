import type { DocSource } from '@blocksuite/affine/sync';

export type SourceOptions = {
  boardId: string; rootDocId: string; contentDocId: string; accountId: string; generation: number;
  signal?: AbortSignal; readonly?: boolean; isCurrent?: (generation: number) => boolean; fetch?: typeof fetch;
  onAuthorizationLost?: (error: SourceAccessError) => void;
  onPendingDocument?: (docId: string, data: Uint8Array) => unknown | Promise<unknown>;
  onAcknowledged?: (token: unknown) => void | Promise<void>;
  durableLocalBlobs?: boolean;
  beforeDocumentWrite?: () => Promise<void>;
  getRecoveryEpoch?: () => string;
};
export class RecoveryEpochError extends Error {
  constructor(readonly code: 'RECOVERY_EPOCH_REQUIRED' | 'RECOVERY_EPOCH_MISMATCH') { super('Server recovery state changed'); this.name = 'RecoveryEpochError'; }
}
export function validRecoveryEpoch(value: unknown): value is string { return typeof value === 'string' && /^[0-9a-f-]{36}$/.test(value); }
export async function authenticatedRecoveryEpoch(accountId: string, signal?: AbortSignal): Promise<string> {
  const response = await fetch('/api/recovery-state', { headers: { 'X-Dali-Account': accountId }, credentials: 'same-origin', cache: 'no-store', signal });
  if (!response.ok) throw new Error('Recovery state unavailable');
  const state = await response.json() as { epoch?: unknown };
  if (!validRecoveryEpoch(state.epoch) || signal?.aborted) throw new Error('Recovery state unavailable');
  return state.epoch;
}
export function sourceRecoveryEpoch(options: SourceOptions) {
  const epoch = options.getRecoveryEpoch?.();
  if (!validRecoveryEpoch(epoch)) throw new RecoveryEpochError('RECOVERY_EPOCH_REQUIRED');
  return epoch;
}
export function confirmRecoveryEpoch(options: SourceOptions, epoch: string, response?: Response) {
  if (sourceRecoveryEpoch(options) !== epoch || (response && response.headers.get('X-Dali-Recovery-Epoch') !== epoch)) throw new RecoveryEpochError('RECOVERY_EPOCH_MISMATCH');
}
export class SourceAccessError extends Error {
  constructor(readonly status: number) { super('Board access changed'); this.name = 'SourceAccessError'; }
}
/** One board/account/generation; callers explicitly pull on each reopen. */
export class BoardDocSource implements DocSource {
  readonly name = 'account-board-documents';
  constructor(private options: SourceOptions) {}
  private assertCurrent(docId: string, write = false) {
    if (this.options.signal?.aborted || this.options.isCurrent?.(this.options.generation) === false) throw new Error('Account source is stale');
    if (![this.options.rootDocId, this.options.contentDocId].includes(docId)) throw new Error('Document unavailable');
    if (write && this.options.readonly) throw new Error('Board is read-only');
  }
  private async request(docId: string, action: 'pull' | 'push', data: Uint8Array, epoch?: string) {
    this.assertCurrent(docId, action === 'push');
    const response = await (this.options.fetch ?? fetch)(`/api/boards/${encodeURIComponent(this.options.boardId)}/docs/${encodeURIComponent(docId)}/${action}`, {
      method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: this.options.signal,
      headers: { 'X-Dali-Account': this.options.accountId, 'X-Dali-Request': '1', 'Content-Type': 'application/octet-stream', ...(epoch ? { 'X-Dali-Recovery-Epoch': epoch } : {}) }, body: new Uint8Array(data),
    });
    this.assertCurrent(docId, action === 'push');
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { code?: string };
      if (body.code === 'RECOVERY_EPOCH_REQUIRED' || body.code === 'RECOVERY_EPOCH_MISMATCH') throw new RecoveryEpochError(body.code);
      if ([401, 403, 404].includes(response.status) || (response.status === 409 && body.code === 'IDENTITY_CHANGED')) { const error = new SourceAccessError(response.status); this.options.onAuthorizationLost?.(error); throw error; }
      throw new Error('Board document request failed');
    }
    return response;
  }
  async pull(docId: string, state: Uint8Array) {
    const response = await this.request(docId, 'pull', state);
    const data = new Uint8Array(await response.arrayBuffer()); this.assertCurrent(docId); return { data };
  }
  async push(docId: string, data: Uint8Array) {
    this.assertCurrent(docId, true);
    const epoch = sourceRecoveryEpoch(this.options);
    const copy = new Uint8Array(data); const token = await this.options.onPendingDocument?.(docId, copy);
    try { await this.options.beforeDocumentWrite?.(); }
    catch (error) { if (error instanceof SourceAccessError) this.options.onAuthorizationLost?.(error); throw error; }
    confirmRecoveryEpoch(this.options, epoch);
    const response = await this.request(docId, 'push', copy, epoch);
    const result: unknown = await response.json(); this.assertCurrent(docId, true);
    if (!result || typeof result !== 'object' || !('acknowledged' in result) || result.acknowledged !== true) throw new Error('Document commit unconfirmed');
    confirmRecoveryEpoch(this.options, epoch, response);
    await this.options.onAcknowledged?.(token);
  }
  subscribe(_callback: (docId: string, data: Uint8Array) => void, disconnect: (reason: string) => void) {
    const abort = () => disconnect('account-source-disposed');
    this.options.signal?.addEventListener('abort', abort, { once: true });
    return () => this.options.signal?.removeEventListener('abort', abort);
  }
}
