import type { DocSource } from '@blocksuite/affine/sync';

export type SourceOptions = {
  boardId: string; rootDocId: string; contentDocId: string; accountId: string; generation: number;
  signal?: AbortSignal; readonly?: boolean; isCurrent?: (generation: number) => boolean; fetch?: typeof fetch;
  onAuthorizationLost?: (error: SourceAccessError) => void;
  onPendingDocument?: (docId: string, data: Uint8Array) => unknown | Promise<unknown>;
  onAcknowledged?: (token: unknown) => void | Promise<void>;
  durableLocalBlobs?: boolean;
  beforeDocumentWrite?: () => Promise<void>;
};
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
  private async request(docId: string, action: 'pull' | 'push', data: Uint8Array) {
    this.assertCurrent(docId, action === 'push');
    const response = await (this.options.fetch ?? fetch)(`/api/boards/${encodeURIComponent(this.options.boardId)}/docs/${encodeURIComponent(docId)}/${action}`, {
      method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: this.options.signal,
      headers: { 'X-Dali-Account': this.options.accountId, 'X-Dali-Request': '1', 'Content-Type': 'application/octet-stream' }, body: new Uint8Array(data),
    });
    this.assertCurrent(docId, action === 'push');
    if (!response.ok) {
      if ([401, 403, 404, 409].includes(response.status)) { const error = new SourceAccessError(response.status); this.options.onAuthorizationLost?.(error); throw error; }
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
    const copy = new Uint8Array(data); const token = await this.options.onPendingDocument?.(docId, copy);
    await this.options.beforeDocumentWrite?.();
    const response = await this.request(docId, 'push', copy);
    const result: unknown = await response.json(); this.assertCurrent(docId, true);
    if (!result || typeof result !== 'object' || !('acknowledged' in result) || result.acknowledged !== true) throw new Error('Document commit unconfirmed');
    await this.options.onAcknowledged?.(token);
  }
  subscribe(_callback: (docId: string, data: Uint8Array) => void, disconnect: (reason: string) => void) {
    const abort = () => disconnect('account-source-disposed');
    this.options.signal?.addEventListener('abort', abort, { once: true });
    return () => this.options.signal?.removeEventListener('abort', abort);
  }
}
