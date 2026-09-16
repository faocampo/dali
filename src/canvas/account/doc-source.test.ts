import { describe, expect, it, vi } from 'vitest';
import { BoardDocSource, type SourceOptions } from './doc-source';

const options = (): SourceOptions => ({ boardId: 'board', rootDocId: 'root', contentDocId: 'content', accountId: 'member', generation: 1, isCurrent: () => true });
describe('BoardDocSource', () => {
  it('sends exact identity, binary and mutation headers and acknowledges only after commit', async () => {
    const events: string[] = []; const fetcher = vi.fn<typeof fetch>(async () => { events.push('network'); return Response.json({ acknowledged: true }); });
    const source = new BoardDocSource({ ...options(), fetch: fetcher, onPendingDocument: async (_id, bytes) => { expect(bytes).toEqual(new Uint8Array([1, 2])); events.push('pending'); return 7; }, onAcknowledged: token => { expect(token).toBe(7); events.push('ack'); } });
    await source.push('content', new Uint8Array([1, 2])); expect(events).toEqual(['pending', 'network', 'ack']);
    expect(fetcher.mock.calls[0]![0]).toBe('/api/boards/board/docs/content/push');
    expect(fetcher.mock.calls[0]![1]).toMatchObject({ credentials: 'same-origin', cache: 'no-store', headers: { 'X-Dali-Account': 'member', 'X-Dali-Request': '1', 'Content-Type': 'application/octet-stream' } });
  });
  it.each([401, 403, 404, 409])('reports %s through authorization callback and never acknowledges', async status => {
    const lost = vi.fn(); const ack = vi.fn(); const source = new BoardDocSource({ ...options(), fetch: vi.fn(async () => new Response('{}', { status })), onAuthorizationLost: lost, onAcknowledged: ack });
    await expect(source.push('content', new Uint8Array([0, 0]))).rejects.toThrow(); expect(lost).toHaveBeenCalledOnce(); expect(ack).not.toHaveBeenCalled();
    await expect(source.pull('root', new Uint8Array([0]))).rejects.toThrow();
  });
  it('denies foreign ids, reader writes and stale responses without fallback or acknowledgment', async () => {
    let current = true; const ack = vi.fn(); const fetcher = vi.fn(async () => { current = false; return new Response(new Uint8Array([0, 0])); });
    const source = new BoardDocSource({ ...options(), fetch: fetcher, isCurrent: () => current, onAcknowledged: ack });
    await expect(source.pull('foreign', new Uint8Array([0]))).rejects.toThrow(); expect(fetcher).not.toHaveBeenCalled();
    await expect(source.pull('content', new Uint8Array([0]))).rejects.toThrow('stale'); expect(ack).not.toHaveBeenCalled();
    const reader = new BoardDocSource({ ...options(), readonly: true, fetch: fetcher });
    await expect(reader.push('content', new Uint8Array([0, 0]))).rejects.toThrow(); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('aborts and unsubscribes without writes, and persistence failure prevents network submission', async () => {
    const fetcher = vi.fn(); const controller = new AbortController(); const disconnect = vi.fn();
    const source = new BoardDocSource({ ...options(), signal: controller.signal, fetch: fetcher, onPendingDocument: () => { throw new Error('quota'); } });
    const cleanup = source.subscribe(vi.fn(), disconnect); cleanup(); controller.abort(); expect(disconnect).not.toHaveBeenCalled();
    await expect(source.pull('content', new Uint8Array([0]))).rejects.toThrow(); expect(fetcher).not.toHaveBeenCalled();
    const active = new BoardDocSource({ ...options(), fetch: fetcher, onPendingDocument: () => { throw new Error('quota'); } });
    await expect(active.push('content', new Uint8Array([0, 0]))).rejects.toThrow('quota'); expect(fetcher).not.toHaveBeenCalled();
  });
});
