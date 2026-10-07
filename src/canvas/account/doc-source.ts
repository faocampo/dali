import type { BoardLiveSource } from './live-source';
import { validDocumentRevisionReceipt, type DocumentRevisionReceipt } from './title-intent';
import type { DocSource } from '@blocksuite/affine/sync';
import { recoveryDigest, type RecoveryAttempt, type SharedRecoveryBaseline } from './recovery-baseline';

export type SourceOptions = {
  boardId: string; rootDocId: string; contentDocId: string; accountId: string; generation: number;
  live?: BoardLiveSource;
  liveTabId?: string;
  signal?: AbortSignal; readonly?: boolean; isCurrent?: (generation: number) => boolean; fetch?: typeof fetch;
  /** Only retires the original connection; independent from canceled runtime requests. */
  disconnectFetch?: typeof fetch;
  onAuthorizationLost?: (error: SourceAccessError) => void;
  onPendingDocument?: (docId: string, data: Uint8Array, attempt?: RecoveryAttempt, actionId?: string) => unknown | Promise<unknown>;
  onDocumentCommit?: (receipt: DocumentRevisionReceipt, document?: { docId: string; data: Uint8Array }) => Promise<void>;
  onLiveSnapshot?: (snapshot: SharedRecoveryBaseline) => void;
  onLiveMetadata?: (metadata: { title: string; revision: number }) => void;
  canReconnectLive?: (snapshot?: { root: Uint8Array; content: Uint8Array }) => Promise<boolean>;
  /** An already-open authenticated board may retain new local actions during an outage. */
  canEditDisconnected?: () => boolean;
  preserveLocal?: () => Promise<void>;
  onLiveReconnected?: () => void;
  onAcknowledged?: (token: unknown) => void | Promise<void>;
  durableLocalBlobs?: boolean;
  beforeDocumentWrite?: (docId: string, data: Uint8Array, live?: boolean) => Promise<'acknowledged' | void>;
  getRecoveryEpoch?: () => string;
  onDocumentOutcome?: (docId: string, data: Uint8Array, outcome: 'loaded' | 'sending' | 'acknowledged' | 'failed', attempt: string) => void;
  onImageOutcome?: (key: string, outcome: 'loaded' | 'sending' | 'acknowledged' | 'failed', attempt: string) => void;
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
class DocumentTransportError extends Error {}
/** One board/account/generation; callers explicitly pull on each reopen. */
export class BoardDocSource implements DocSource {
  readonly name = 'account-board-documents';
  constructor(private options: SourceOptions) {}
  private assertCurrent(docId: string, write = false) {
    if (this.options.signal?.aborted || this.options.isCurrent?.(this.options.generation) === false) throw new Error('Account source is stale');
    if (![this.options.rootDocId, this.options.contentDocId].includes(docId)) throw new Error('Document unavailable');
    if (write && this.options.readonly) throw new Error('Board is read-only');
  }
  private async request(docId: string, action: 'pull' | 'push', data: Uint8Array, epoch?: string, headers: Record<string, string> = {}) {
    this.assertCurrent(docId, action === 'push');
    const response = await (this.options.fetch ?? fetch)(`/api/boards/${encodeURIComponent(this.options.boardId)}/docs/${encodeURIComponent(docId)}/${action}`, {
      method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: this.options.signal,
      headers: { 'X-Dali-Account': this.options.accountId, 'X-Dali-Request': '1', 'Content-Type': 'application/octet-stream', ...(epoch ? { 'X-Dali-Recovery-Epoch': epoch } : {}), ...headers }, body: new Uint8Array(data),
    }).catch((error: unknown) => { this.assertCurrent(docId, action === 'push'); throw new DocumentTransportError(error instanceof Error ? error.message : 'Document transport interrupted'); });
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
    const data = new Uint8Array(await response.arrayBuffer()); this.assertCurrent(docId);
    this.options.onDocumentOutcome?.(docId, data, 'loaded', crypto.randomUUID()); return { data };
  }
  async push(docId: string, data: Uint8Array) {
    this.assertCurrent(docId, true);
    const attempt = crypto.randomUUID();
    const copy = new Uint8Array(data);
    this.options.onDocumentOutcome?.(docId, copy, 'sending', attempt);
    try {
      const epoch = sourceRecoveryEpoch(this.options);
      const metadata = this.options.live ? { tabId: this.options.live.transportTabId, operationId: attempt, digest: await recoveryDigest(copy) } : undefined;
      const token = await this.options.onPendingDocument?.(docId, copy, metadata, this.options.live?.actionId);
      let replayOutcome: 'acknowledged' | void;
      try { replayOutcome = await this.options.beforeDocumentWrite?.(docId, copy, !!this.options.live); }
      catch (error) { if (error instanceof SourceAccessError) this.options.onAuthorizationLost?.(error); throw error; }
      confirmRecoveryEpoch(this.options, epoch);
      this.assertCurrent(docId, true);
      // Recovery may already have committed this exact update while preparing
      // the write. Its explicit acknowledgment avoids a second transport.
      if (replayOutcome !== 'acknowledged') {
        const headers = this.options.live?.writeHeaders(attempt);
        let response: Response;
        try { response = await this.request(docId, 'push', copy, epoch, headers); }
        catch (error) {
          // A missing response may follow a successful commit. Retry this exact
          // operation once; its durable receipt makes that retry idempotent.
          if (!(error instanceof DocumentTransportError) || !this.options.live?.connected) throw error;
          this.assertCurrent(docId, true); confirmRecoveryEpoch(this.options, epoch);
          response = await this.request(docId, 'push', copy, epoch, headers);
        }
        const result: unknown = await response.json(); this.assertCurrent(docId, true);
        if (!result || typeof result !== 'object' || !('acknowledged' in result) || result.acknowledged !== true) throw new Error('Document commit unconfirmed');
        confirmRecoveryEpoch(this.options, epoch, response);
        if (validDocumentRevisionReceipt(result)) await this.options.onDocumentCommit?.(result, { docId, data: copy });
        this.assertCurrent(docId, true);
      }
      await this.options.onAcknowledged?.(token);
      this.assertCurrent(docId, true); this.options.onDocumentOutcome?.(docId, copy, 'acknowledged', attempt);
    } catch (error) { this.options.onDocumentOutcome?.(docId, copy, 'failed', attempt); throw error; }
  }
  subscribe(_callback: (docId: string, data: Uint8Array) => void, disconnect: (reason: string) => void) {
    const abort = () => disconnect('account-source-disposed');
    this.options.signal?.addEventListener('abort', abort, { once: true });
    return () => this.options.signal?.removeEventListener('abort', abort);
  }
}
