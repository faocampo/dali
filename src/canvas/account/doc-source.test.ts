import { describe, expect, it, vi } from 'vitest';
import { BoardDocSource, RecoveryEpochError, type SourceOptions } from './doc-source';

const epoch = '11111111-1111-4111-8111-111111111111';
const options = (): SourceOptions => ({ boardId: 'board', rootDocId: 'root', contentDocId: 'content', accountId: 'member', generation: 1, isCurrent: () => true, getRecoveryEpoch: () => epoch });
describe('BoardDocSource', () => {
  it.each(['missing-header', 'wrong-header', 'late-epoch', 'recovery-conflict', 'other-conflict'])('@04-02-02 %s cannot acknowledge or impersonate access loss', async fault => {
    let currentEpoch = epoch; const ack = vi.fn(); const lost = vi.fn();
    const fetcher = vi.fn<typeof fetch>(async (_input, init) => {
      expect(new Headers(init?.headers).get('X-Dali-Recovery-Epoch')).toBe(epoch);
      if (fault === 'late-epoch') currentEpoch = '22222222-2222-4222-8222-222222222222';
      if (fault.endsWith('conflict')) return Response.json({ code: fault === 'recovery-conflict' ? 'RECOVERY_EPOCH_MISMATCH' : 'BOARD_CHANGED' }, { status: 409 });
      return Response.json({ acknowledged: true }, { headers: fault === 'missing-header' ? {} : { 'X-Dali-Recovery-Epoch': fault === 'wrong-header' ? 'other' : epoch } });
    });
    const source = new BoardDocSource({ ...options(), getRecoveryEpoch: () => currentEpoch, fetch: fetcher, onAcknowledged: ack, onAuthorizationLost: lost });
    await expect(source.push('content', new Uint8Array([0]))).rejects.toThrow(); expect(ack).not.toHaveBeenCalled(); expect(lost).not.toHaveBeenCalled();
  });
  it('@04-02-02 pending storage wait never adopts a rotated epoch', async () => {
    let currentEpoch = epoch; const fetcher = vi.fn();
    const source = new BoardDocSource({ ...options(), getRecoveryEpoch: () => currentEpoch, fetch: fetcher, onPendingDocument: () => { currentEpoch = '22222222-2222-4222-8222-222222222222'; } });
    await expect(source.push('content', new Uint8Array([0]))).rejects.toBeInstanceOf(RecoveryEpochError); expect(fetcher).not.toHaveBeenCalled();
  });
  it('sends exact identity, binary and mutation headers and acknowledges only after commit', async () => {
    const events: string[] = []; const fetcher = vi.fn<typeof fetch>(async () => { events.push('network'); return Response.json({ acknowledged: true }, { headers: { 'X-Dali-Recovery-Epoch': epoch } }); });
    const source = new BoardDocSource({ ...options(), fetch: fetcher, onPendingDocument: async (_id, bytes) => { expect(bytes).toEqual(new Uint8Array([1, 2])); events.push('pending'); return 7; }, onAcknowledged: token => { expect(token).toBe(7); events.push('ack'); } });
    await source.push('content', new Uint8Array([1, 2])); expect(events).toEqual(['pending', 'network', 'ack']);
    expect(fetcher.mock.calls[0]![0]).toBe('/api/boards/board/docs/content/push');
    expect(fetcher.mock.calls[0]![1]).toMatchObject({ credentials: 'same-origin', cache: 'no-store', headers: { 'X-Dali-Account': 'member', 'X-Dali-Request': '1', 'Content-Type': 'application/octet-stream' } });
  });
  it.each([401, 403, 404, 409])('reports %s through authorization callback and never acknowledges', async status => {
    const lost = vi.fn(); const ack = vi.fn(); const source = new BoardDocSource({ ...options(), fetch: vi.fn(async () => Response.json({ code: status === 409 ? 'IDENTITY_CHANGED' : 'BOARD_UNAVAILABLE' }, { status })), onAuthorizationLost: lost, onAcknowledged: ack });
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
  it('uses an exact replay acknowledgment without sending a duplicate update', async () => {
    const fetcher = vi.fn(); const ack = vi.fn(); const outcome = vi.fn();
    const source = new BoardDocSource({ ...options(), fetch: fetcher, onPendingDocument: () => 7,
      beforeDocumentWrite: async (id, data) => { expect(id).toBe('content'); expect(data).toEqual(new Uint8Array([1, 2])); return 'acknowledged'; },
      onAcknowledged: ack, onDocumentOutcome: outcome });
    await source.push('content', new Uint8Array([1, 2]));
    expect(fetcher).not.toHaveBeenCalled(); expect(ack).toHaveBeenCalledExactlyOnceWith(7);
    expect(outcome.mock.calls.map(call => call[2])).toEqual(['sending', 'acknowledged']);
  });
  it('sends normally when recovery does not confirm the submitted update', async () => {
    const fetcher = vi.fn(async () => Response.json({ acknowledged: true }, { headers: { 'X-Dali-Recovery-Epoch': epoch } }));
    const source = new BoardDocSource({ ...options(), fetch: fetcher, beforeDocumentWrite: async () => {} });
    await source.push('content', new Uint8Array([1, 2])); expect(fetcher).toHaveBeenCalledOnce();
  });
  it.each(['epoch', 'scope', 'abort'] as const)('rejects replay acknowledgment after %s changes', async fault => {
    let currentEpoch = epoch; let current = true; const controller = new AbortController();
    const fetcher = vi.fn(); const ack = vi.fn();
    const source = new BoardDocSource({ ...options(), fetch: fetcher, signal: controller.signal,
      isCurrent: () => current, getRecoveryEpoch: () => currentEpoch, onAcknowledged: ack,
      beforeDocumentWrite: async () => {
        if (fault === 'epoch') currentEpoch = '22222222-2222-4222-8222-222222222222';
        if (fault === 'scope') current = false;
        if (fault === 'abort') controller.abort();
        return 'acknowledged';
      } });
    await expect(source.push('content', new Uint8Array([1, 2]))).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled(); expect(ack).not.toHaveBeenCalled();
  });

});
