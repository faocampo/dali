import * as Y from 'yjs';
import { describe, expect, it, vi } from 'vitest';
import { BoardLiveSource } from './live-source';
const update = btoa(String.fromCharCode(...Y.encodeStateAsUpdate(new Y.Doc())));
const epoch = '00000000-0000-0000-0000-000000000001';
const scope = { accountId: 'account', boardId: 'board', rootDocId: 'root', contentDocId: 'content', generation: 1, getRecoveryEpoch: () => epoch };
function pending(signal?: AbortSignal | null) {
  return new Promise<Response>((_resolve, reject) => signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
}
describe('generation-scoped live snapshots', () => {
  it('explicitly disconnects the original connection on disposal without reusing its aborted signal', async () => {
    const request = vi.fn<typeof fetch>().mockImplementation(async (url, init) => {
      if (String(url).endsWith('/connect')) return Response.json({ connectionId: 'original-connection', revision: 3, epoch, root: update, content: update });
      if (String(url).endsWith('/disconnect')) return Response.json({ acknowledged: true });
      return pending(init?.signal);
    });
    const live = new BoardLiveSource({ ...scope, fetch: request });
    await live.start(() => {}, () => {});
    live.dispose(); live.dispose();
    const cleanup = request.mock.calls.filter(([url]) => String(url).endsWith('/disconnect'));
    expect(cleanup).toHaveLength(1);
    expect(cleanup[0]![0]).toBe(`/api/boards/${scope.boardId}/live/disconnect`);
    expect(cleanup[0]![1]).toMatchObject({ method: 'POST', keepalive: true, credentials: 'same-origin', headers: { 'X-Dali-Account': scope.accountId, 'X-Dali-Recovery-Epoch': epoch } });
    expect(cleanup[0]![1]!.signal).toBeUndefined();
    expect(JSON.parse(cleanup[0]![1]!.body as string)).toEqual({ connectionId: 'original-connection' });
    expect(live.connected).toBe(false);
  });
  it('retains a failed presence publication across successful polls until publication recovers', async () => {
    let resolvePoll!: (response: Response) => void;
    let polls = 0; let failPresence = true;
    const live = new BoardLiveSource({ ...scope, fetch: vi.fn<typeof fetch>().mockImplementation(async (url, init) => {
      if (String(url).endsWith('/connect')) return Response.json({ connectionId: 'connection', revision: 3, epoch, root: update, content: update });
      if (String(url).endsWith('/presence')) return failPresence ? new Response('{') : Response.json({ acknowledged: true });
      if (++polls === 1) return new Promise<Response>(resolve => { resolvePoll = resolve; });
      return pending(init?.signal);
    }) });
    try {
      await live.start(() => {}, () => {});
      await live.updatePresence({ cursor: { x: 1, y: 2 }, selection: [] });
      expect(live.presenceState.state).toBe('error');
      resolvePoll(Response.json({ revision: 3, epoch, presence: [], presenceVersion: 'roster-1' }));
      await vi.waitFor(() => expect(polls).toBe(2));
      expect(live.presenceState.state).toBe('error');
      failPresence = false;
      await live.updatePresence({ cursor: { x: 1, y: 2 }, selection: [] });
      expect(live.presenceState).toEqual({ state: 'ready', participants: [] });
    } finally { live.dispose(); }
  });
  it('delivers server titles in revision order and ignores duplicate metadata', async () => {
    const metadata = vi.fn(); let calls = 0;
    const live = new BoardLiveSource({ ...scope, onLiveMetadata: metadata, fetch: vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      calls++;
      if (calls <= 3) return Response.json({ connectionId: 'connection', revision: calls === 1 ? 3 : 4, title: calls === 1 ? 'Original' : calls === 2 ? 'Renamed' : 'Stale duplicate', epoch, root: update, content: update });
      return pending(init?.signal);
    }) });
    await live.start(() => {}, () => {});
    await vi.waitFor(() => expect(calls).toBe(4));
    expect(metadata.mock.calls).toEqual([[{ title: 'Original', revision: 3 }], [{ title: 'Renamed', revision: 4 }]]);
    live.dispose();
  });
  it('delivers one complete pair and aborts the held poll on disposal', async () => {
    let pollSignal: AbortSignal | null | undefined;
    const receive = vi.fn(); const disconnect = vi.fn();
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url, init) => {
      if (String(url).endsWith('/connect')) return Response.json({ connectionId: 'connection', revision: 3, epoch, root: update, content: update });
      if (String(url).endsWith('/disconnect')) return Response.json({ acknowledged: true });
      pollSignal = init?.signal; return pending(pollSignal);
    });
    const live = new BoardLiveSource({ ...scope, fetch: fetcher });
    await live.start(receive, disconnect);
    expect(receive.mock.calls.map(([id]) => id)).toEqual(['root', 'content']);
    expect(live.connected).toBe(true);
    live.dispose(); expect(pollSignal?.aborted).toBe(true);
    await Promise.resolve(); expect(disconnect).not.toHaveBeenCalled();
  });
  it('quarantines writes after a network interruption and does not automatically reopen', async () => {
    const disconnected = vi.fn();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ connectionId: 'connection', revision: 3, epoch, root: update, content: update })).mockRejectedValue(new Error('offline'));
    const live = new BoardLiveSource({ ...scope, fetch: fetcher });
    await live.start(() => {}, disconnected);
    await vi.waitFor(() => expect(disconnected).toHaveBeenCalledOnce());
    expect(() => live.writeHeaders('operation')).toThrow();
    await expect(live.start(() => {}, disconnected)).rejects.toThrow('already started');
    expect(fetcher).toHaveBeenCalledTimes(2); live.dispose();
  });
  it('rejects a snapshot from another epoch before delivering either document', async () => {
    const receive = vi.fn();
    const live = new BoardLiveSource({ ...scope, fetch: vi.fn<typeof fetch>().mockResolvedValue(Response.json({ connectionId: 'connection', revision: 3, epoch: 'other', root: update, content: update })) });
    await expect(live.start(receive, () => {})).rejects.toThrow(); expect(receive).not.toHaveBeenCalled(); live.dispose();
  });
  it('discards an in-flight snapshot after the runtime generation changes', async () => {
    let current = true; const receive = vi.fn();
    const live = new BoardLiveSource({ ...scope, isCurrent: () => current, fetch: vi.fn<typeof fetch>().mockImplementation(async () => { current = false; return Response.json({ connectionId: 'connection', revision: 3, epoch, root: update, content: update }); }) });
    await expect(live.start(receive, () => {})).rejects.toThrow(); expect(receive).not.toHaveBeenCalled(); live.dispose();
  });
  it('discards older and duplicate snapshots without applying their content', async () => {
    const receive = vi.fn(); let calls = 0;
    const live = new BoardLiveSource({ ...scope, fetch: vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      calls++;
      if (calls <= 3) return Response.json({ connectionId: 'connection', revision: calls === 2 ? 2 : 3, epoch, root: update, content: update });
      return pending(init?.signal);
    }) });
    await live.start(receive, () => {});
    await vi.waitFor(() => expect(calls).toBe(4));
    expect(receive).toHaveBeenCalledTimes(2); live.dispose();
  });
  it('validates both native updates before applying either member of the pair', async () => {
    const receive = vi.fn();
    const live = new BoardLiveSource({ ...scope, fetch: vi.fn<typeof fetch>().mockResolvedValue(Response.json({ connectionId: 'connection', revision: 3, epoch, root: update, content: btoa('broken') })) });
    await expect(live.start(receive, () => {})).rejects.toThrow();
    expect(receive).not.toHaveBeenCalled(); live.dispose();
  });

});
