import * as Y from 'yjs';
import { describe, expect, it, vi } from 'vitest';
import { BoardLiveSource } from './live-source';

const bytes = btoa(String.fromCharCode(...Y.encodeStateAsUpdate(new Y.Doc())));
const epoch = '00000000-0000-0000-0000-000000000001';
const scope = { accountId: 'account', boardId: 'board', rootDocId: 'root', contentDocId: 'content', generation: 1, getRecoveryEpoch: () => epoch };
function fixture() {
  let interrupt!: (error: Error) => void; let connections = 0; let allowed = true; let current = true;
  let afterConnect = () => {};
  let reserve: (() => Promise<Response>) | undefined;
  const request = vi.fn<typeof fetch>().mockImplementation(async (url, init) => {
    if (String(url).endsWith('/connect')) { connections++; if (connections > 1) afterConnect(); return Response.json({ connectionId: `connection-${connections}`, revision: connections + 2, epoch, root: bytes, content: bytes }); }
    if (String(url).endsWith('/reserve')) return reserve ? reserve() : Response.json({ token: `token-${connections}` });
    if (String(url).endsWith('/disconnect')) return Response.json({ acknowledged: true });
    return new Promise<Response>((_resolve, reject) => { interrupt = reject; init?.signal?.addEventListener('abort', () => reject(new Error('disposed')), { once: true }); });
  });
  const receive = vi.fn(); const disconnected = vi.fn();
  const check = vi.fn(async () => allowed);
  const live = new BoardLiveSource({ ...scope, fetch: request, isCurrent: () => current, canReconnectLive: check });
  return { live, request, receive, disconnected, check,
    async start() { await live.start(receive, disconnected); },
    async interrupt() { interrupt(new Error('offline')); await vi.waitFor(() => expect(disconnected).toHaveBeenCalledOnce()); },
    setAllowed(value: boolean) { allowed = value; },
    onConnect(callback: () => void) { afterConnect = callback; }, stale() { current = false; },
    onReserve(callback: () => Promise<Response>) { reserve = callback; },
  };
}

describe('explicit same-tab live reconnection', () => {
  it('never installs a delayed reservation response from the disconnected session', async () => {
    const f = fixture(); let delivered!: (value: Response) => void;
    try {
      await f.start(); f.onReserve(() => new Promise<Response>(resolve => { delivered = resolve; }));
      const response = f.live.acquire(['shape']); const denied = expect(response).rejects.toThrow('stale');
      await f.interrupt(); await f.live.reconnect();
      delivered(Response.json({ token: 'old-fence' })); await denied;
      expect(f.live.actionId).toBeUndefined(); expect(f.live.editing).toBe(false);
      expect(f.live.writeHeaders('fresh')).toEqual({ 'X-Dali-Connection': 'connection-2', 'X-Dali-Operation': 'fresh' });
    } finally { f.live.dispose(); }
  });
  it('retains the tab identity, clears stale reservations, and resumes only after fresh snapshot checks', async () => {
    const f = fixture();
    try {
      await f.start(); await f.live.acquire(['shape']); await f.interrupt();
      expect(() => f.live.writeHeaders('blocked')).toThrow();
      await f.live.reconnect();
      const connections = f.request.mock.calls.filter(([url]) => String(url).endsWith('/connect')).map(([, init]) => JSON.parse(init!.body as string));
      expect(connections).toHaveLength(2); expect(connections[0].tabId).toBe(connections[1].tabId);
      expect(f.check).toHaveBeenCalledTimes(2); expect(f.check.mock.calls[1]).toHaveLength(1);
      expect(f.live.connected).toBe(true); expect(f.live.editing).toBe(false); expect(f.live.actionId).toBeUndefined();
      expect(f.receive).toHaveBeenCalledTimes(4);
      await f.live.acquire(['shape']); expect(f.live.writeHeaders('fresh')).toMatchObject({ 'X-Dali-Connection': 'connection-2', 'X-Dali-Reservation': 'token-2' });
    } finally { f.live.dispose(); }
  });
  it('does not inspect or merge remote documents when the local candidate has pending work', async () => {
    const f = fixture();
    try {
      await f.start(); await f.interrupt(); f.setAllowed(false);
      await expect(f.live.reconnect()).rejects.toThrow('pending');
      expect(f.request.mock.calls.filter(([url]) => String(url).endsWith('/connect'))).toHaveLength(1);
      expect(f.receive).toHaveBeenCalledTimes(2); expect(f.live.connected).toBe(false);
    } finally { f.live.dispose(); }
  });
  it('rechecks after the connect request and retires a rejected fresh connection without applying it', async () => {
    const f = fixture();
    try {
      await f.start(); await f.interrupt(); f.onConnect(() => f.setAllowed(false));
      await expect(f.live.reconnect()).rejects.toThrow('pending');
      expect(f.receive).toHaveBeenCalledTimes(2); expect(f.live.connected).toBe(false);
      const cleanup = f.request.mock.calls.find(([url]) => String(url).endsWith('/disconnect'));
      expect(JSON.parse(cleanup![1]!.body as string)).toEqual({ connectionId: 'connection-2' });
    } finally { f.live.dispose(); }
  });
  it('discards a reconnect response after the runtime generation changes', async () => {
    const f = fixture();
    try {
      await f.start(); await f.interrupt(); f.onConnect(() => f.stale());
      await expect(f.live.reconnect()).rejects.toThrow('stale');
      expect(f.receive).toHaveBeenCalledTimes(2); expect(f.live.connected).toBe(false);
    } finally { f.live.dispose(); }
  });
});
