import type { BlobSource } from '@blocksuite/affine/sync';
import { SourceAccessError, type SourceOptions } from './doc-source';

export type BlobSourceOptions = Omit<SourceOptions, 'onPendingDocument'> & {
  onPendingBlob?: (key: string, value: Blob) => unknown | Promise<unknown>;
};
/** No caches or shadow fallback: authorization failures throw through BlobEngine. */
export class BoardBlobSource implements BlobSource {
  readonly name = 'account-board-images';
  readonly readonly: boolean;
  private disposed = false;
  private urls = new Set<string>();
  constructor(private options: BlobSourceOptions) {
    this.readonly = options.readonly ?? false;
    options.signal?.addEventListener('abort', this.dispose, { once: true });
  }
  private assertCurrent(write = false) {
    if (this.disposed || this.options.signal?.aborted || this.options.isCurrent?.(this.options.generation) === false) { this.revokeURLs(); throw new Error('Account source is stale'); }
    if (write && this.readonly) throw new Error('Board is read-only');
  }
  private async request(method: 'GET' | 'PUT' | 'DELETE', key?: string, value?: Blob) {
    this.assertCurrent(method !== 'GET');
    if (key !== undefined && !/^[A-Za-z0-9_-]{43}=?$/.test(key)) throw new Error('Image key unavailable');
    const response = await (this.options.fetch ?? fetch)(`/api/boards/${encodeURIComponent(this.options.boardId)}/blobs${key === undefined ? '' : '/' + encodeURIComponent(key)}`, {
      method, credentials: 'same-origin', cache: 'no-store', signal: this.options.signal,
      headers: { 'X-Dali-Account': this.options.accountId, ...(method !== 'GET' ? { 'X-Dali-Request': '1', 'Content-Type': value?.type ?? 'application/json' } : {}) },
      ...(value ? { body: value } : method === 'DELETE' ? { body: '{}' } : {}),
    });
    this.assertCurrent(method !== 'GET');
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null); this.assertCurrent();
      const code = body && typeof body === 'object' && 'code' in body ? body.code : undefined;
      if (method === 'GET' && key !== undefined && response.status === 404 && code === 'IMAGE_UNAVAILABLE') return null;
      if ([401, 403, 404].includes(response.status) || (response.status === 409 && code === 'IDENTITY_CHANGED')) {
        const error = new SourceAccessError(response.status); this.revokeURLs(); this.options.onAuthorizationLost?.(error); throw error;
      }
      throw new Error(code === 'IMAGE_REFERENCED' ? 'Image is still referenced' : 'Board image request failed');
    }
    return response;
  }
  async get(key: string): Promise<Blob | null> {
    const response = await this.request('GET', key); if (!response) return null;
    if (!['image/png', 'image/jpeg'].includes(response.headers.get('content-type')?.split(';')[0] ?? '')) throw new Error('Invalid image response');
    const blob = await response.blob(); this.assertCurrent(); return blob;
  }
  async set(key: string, value: Blob): Promise<string> {
    this.assertCurrent(true);
    if (!['image/png', 'image/jpeg'].includes(value.type) || value.size > 16 * 1024 * 1024 || !value.size) throw new Error('Invalid image');
    const token = await this.options.onPendingBlob?.(key, value);
    const response = await this.request('PUT', key, value); const result: unknown = await response!.json(); this.assertCurrent(true);
    if (!result || typeof result !== 'object' || !('acknowledged' in result) || result.acknowledged !== true || !('key' in result) || result.key !== key) throw new Error('Image commit unconfirmed');
    await this.options.onAcknowledged?.(token); return key;
  }
  async delete(key: string) { await this.request('DELETE', key); this.assertCurrent(true); this.revokeURLs(); }
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
  dispose = () => { this.disposed = true; this.revokeURLs(); this.options.signal?.removeEventListener('abort', this.dispose); };
}
