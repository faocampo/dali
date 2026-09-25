import type { BlobSource } from '@blocksuite/affine/sync';
import { SourceAccessError, RecoveryEpochError, sourceRecoveryEpoch, confirmRecoveryEpoch, type SourceOptions } from './doc-source';
import { beginBlobWrite, finishBlobWrite } from '../save-status';

export type BlobSourceOptions = Omit<SourceOptions, 'onPendingDocument'> & {
  onPendingBlob?: (key: string, value: Blob) => unknown | Promise<unknown>;
};
/** Pending durable images belong to this source's account/board/generation lifetime. */
export class BoardBlobSource implements BlobSource {
  readonly name = 'account-board-images';
  readonly readonly: boolean;
  private disposed = false;
  private urls = new Set<string>();
  private pending = new Map<string, Blob>();
  constructor(private options: BlobSourceOptions) {
    this.readonly = options.readonly ?? false;
    options.signal?.addEventListener('abort', this.dispose, { once: true });
  }
  private assertCurrent(write = false) {
    if (this.disposed || this.options.signal?.aborted || this.options.isCurrent?.(this.options.generation) === false) { this.revokeURLs(); throw new Error('Account source is stale'); }
    if (write && this.readonly) throw new Error('Board is read-only');
  }
  private async request(method: 'GET' | 'PUT' | 'DELETE', key?: string, value?: Blob, epoch?: string) {
    this.assertCurrent(method !== 'GET');
    if (key !== undefined && !/^[A-Za-z0-9_-]{43}=?$/.test(key)) throw new Error('Image key unavailable');
    const response = await (this.options.fetch ?? fetch)(`/api/boards/${encodeURIComponent(this.options.boardId)}/blobs${key === undefined ? '' : '/' + encodeURIComponent(key)}`, {
      method, credentials: 'same-origin', cache: 'no-store', signal: this.options.signal,
      headers: { 'X-Dali-Account': this.options.accountId, ...(method !== 'GET' ? { 'X-Dali-Request': '1', 'Content-Type': value?.type ?? 'application/json', 'X-Dali-Recovery-Epoch': epoch! } : {}) },
      ...(value ? { body: value } : method === 'DELETE' ? { body: '{}' } : {}),
    });
    this.assertCurrent(method !== 'GET');
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null); this.assertCurrent();
      const code = body && typeof body === 'object' && 'code' in body ? body.code : undefined;
      if (code === 'RECOVERY_EPOCH_REQUIRED' || code === 'RECOVERY_EPOCH_MISMATCH') throw new RecoveryEpochError(code);
      if (method === 'GET' && key !== undefined && response.status === 404 && code === 'IMAGE_UNAVAILABLE') return null;
      if ([401, 403, 404].includes(response.status) || (response.status === 409 && code === 'IDENTITY_CHANGED')) {
        const error = new SourceAccessError(response.status); this.revokeURLs(); this.options.onAuthorizationLost?.(error); throw error;
      }
      throw new Error(code === 'IMAGE_REFERENCED' ? 'Image is still referenced' : 'Board image request failed');
    }
    return response;
  }
  async get(key: string): Promise<Blob | null> {
    this.assertCurrent();
    if (this.pending.has(key)) return this.pending.get(key)!;
    const response = await this.request('GET', key); if (!response) return null;
    if (!['image/png', 'image/jpeg'].includes(response.headers.get('content-type')?.split(';')[0] ?? '')) throw new Error('Invalid image response');
    const blob = await response.blob(); this.assertCurrent(); return blob;
  }
  async set(key: string, value: Blob): Promise<string> {
    this.assertCurrent(true);
    if (!['image/png', 'image/jpeg'].includes(value.type) || value.size > 16 * 1024 * 1024 || !value.size) throw new Error('Invalid image');
    const epoch = sourceRecoveryEpoch(this.options);
    const token = await this.options.onPendingBlob?.(key, value);
    const upload = async () => {
      confirmRecoveryEpoch(this.options, epoch);
      const response = await this.request('PUT', key, value, epoch); const result: unknown = await response!.json(); this.assertCurrent(true);
      if (!result || typeof result !== 'object' || !('acknowledged' in result) || result.acknowledged !== true || !('key' in result) || result.key !== key) throw new Error('Image commit unconfirmed');
      confirmRecoveryEpoch(this.options, epoch, response!);
      await this.options.onAcknowledged?.(token); this.pending.delete(key);
    };
    if (this.options.durableLocalBlobs && token) {
      this.assertCurrent(true); this.pending.set(key, value); beginBlobWrite();
      void upload().then(() => finishBlobWrite(), error => finishBlobWrite(error));
    } else await upload();
    return key;
  }
  async delete(key: string) {
    this.assertCurrent(true); const epoch = sourceRecoveryEpoch(this.options);
    const response = await this.request('DELETE', key, undefined, epoch); this.assertCurrent(true);
    confirmRecoveryEpoch(this.options, epoch, response!); this.revokeURLs();
  }
  async list(): Promise<string[]> {
    const response = await this.request('GET'); const result: unknown = await response!.json(); this.assertCurrent();
    if (!Array.isArray(result) || !result.every(key => typeof key === 'string' && /^[A-Za-z0-9_-]{43}=?$/.test(key))) throw new Error('Invalid image list');
    return result;
  }
  async objectURL(key: string): Promise<string | null> {
    const blob = await this.get(key); this.assertCurrent(); if (!blob) return null;
    const url = URL.createObjectURL(blob); this.urls.add(url); return url;
  }
  revokeURL(url: string) { if (this.urls.delete(url)) URL.revokeObjectURL(url); }
  private revokeURLs() { for (const url of this.urls) URL.revokeObjectURL(url); this.urls.clear(); }
  dispose = () => { this.disposed = true; this.revokeURLs(); this.pending.clear(); this.options.signal?.removeEventListener('abort', this.dispose); };
}
