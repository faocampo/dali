import { describe, expect, it, vi } from 'vitest';
import { BoardBlobSource } from './blob-source';

const key = 'a'.repeat(43) + '=';
const options = () => ({ boardId: 'board', rootDocId: 'root', contentDocId: 'content', accountId: 'member', generation: 1, isCurrent: () => true });
const image = () => new Blob(['synthetic-raster'], { type: 'image/png' });
describe('BoardBlobSource', () => {
  it('persists pending bytes before PUT and acknowledges only the server-confirmed key', async () => {
    const events: string[] = []; const fetcher = vi.fn<typeof fetch>(async () => { events.push('request'); return Response.json({ acknowledged: true, key }); });
    const source = new BoardBlobSource({ ...options(), fetch: fetcher, onPendingBlob: async (pendingKey, blob) => { expect(pendingKey).toBe(key); expect(await blob.text()).toBe('synthetic-raster'); events.push('pending'); return 4; }, onAcknowledged: token => { expect(token).toBe(4); events.push('ack'); } });
    expect(await source.set(key, image())).toBe(key); expect(events).toEqual(['pending', 'request', 'ack']);
    expect(fetcher.mock.calls[0]![0]).toBe('/api/boards/board/blobs/' + encodeURIComponent(key));
    expect(fetcher.mock.calls[0]![1]).toMatchObject({ method: 'PUT', credentials: 'same-origin', cache: 'no-store', headers: { 'X-Dali-Account': 'member', 'X-Dali-Request': '1', 'Content-Type': 'image/png' } });
  });
  it('reader hydration GET/list makes no writes and blocks all mutations', async () => {
    const fetcher = vi.fn<typeof fetch>(async url => String(url).endsWith('/blobs') ? Response.json([key]) : new Response(image()));
    const source = new BoardBlobSource({ ...options(), readonly: true, fetch: fetcher });
    expect(await (await source.get(key))!.text()).toBe('synthetic-raster'); expect(await source.list()).toEqual([key]);
    await expect(source.set(key, image())).rejects.toThrow('read-only'); await expect(source.delete(key)).rejects.toThrow('read-only');
    expect(fetcher.mock.calls.every(call => call[1]!.method === 'GET')).toBe(true);
  });
  it.each([401, 403, 404, 409])('denied %s cannot return prior bytes or fake acknowledgment', async status => {
    const lost = vi.fn(); const ack = vi.fn(); const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(image())).mockImplementation(async () => Response.json({ code: status === 409 ? 'IDENTITY_CHANGED' : 'BOARD_UNAVAILABLE' }, { status }));
    const source = new BoardBlobSource({ ...options(), fetch: fetcher, onAuthorizationLost: lost, onAcknowledged: ack });
    expect(await source.get(key)).toBeInstanceOf(Blob); await expect(source.get(key)).rejects.toThrow('access'); await expect(source.set(key, image())).rejects.toThrow('access');
    expect(lost).toHaveBeenCalledTimes(2); expect(ack).not.toHaveBeenCalled();
  });
  it('distinguishes a missing authorized image from access loss and referenced conflict', async () => {
    const lost = vi.fn(); const source = new BoardBlobSource({ ...options(), onAuthorizationLost: lost, fetch: vi.fn<typeof fetch>(async (_url, init) => Response.json({ code: init?.method === 'DELETE' ? 'IMAGE_REFERENCED' : 'IMAGE_UNAVAILABLE' }, { status: init?.method === 'DELETE' ? 409 : 404 })) });
    expect(await source.get(key)).toBeNull(); await expect(source.delete(key)).rejects.toThrow('referenced'); expect(lost).not.toHaveBeenCalled();
  });
  it('stale generation responses and pending quota failure have no acknowledgment', async () => {
    let current = true; const ack = vi.fn(); const fetcher = vi.fn<typeof fetch>(async () => { current = false; return Response.json({ acknowledged: true, key }); });
    const source = new BoardBlobSource({ ...options(), isCurrent: () => current, fetch: fetcher, onAcknowledged: ack });
    await expect(source.set(key, image())).rejects.toThrow('stale'); expect(ack).not.toHaveBeenCalled();
    const failure = new BoardBlobSource({ ...options(), fetch: fetcher, onPendingBlob: () => { throw new Error('quota'); } });
    await expect(failure.set(key, image())).rejects.toThrow('quota'); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('tears down object URLs on authorization loss and abort without backend writes', async () => {
    const controller = new AbortController(); const revoked = vi.spyOn(URL, 'revokeObjectURL');
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(image())).mockResolvedValueOnce(Response.json({ code: 'BOARD_UNAVAILABLE' }, { status: 404 }));
    const source = new BoardBlobSource({ ...options(), signal: controller.signal, fetch: fetcher });
    const url = await source.objectURL(key); expect(url).toMatch(/^blob:/); await expect(source.get(key)).rejects.toThrow(); expect(revoked).toHaveBeenCalledWith(url);
    controller.abort(); await expect(source.get(key)).rejects.toThrow('stale'); expect(fetcher).toHaveBeenCalledTimes(2); revoked.mockRestore();
  });
});
