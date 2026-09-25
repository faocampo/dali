import { afterEach, expect, it, vi } from 'vitest';
import { AccountJournal, replayJournal, type JournalRecord } from './outbox';
import type { BoardDescriptor } from '../../boards/BoardLibrary';

// Browser regressions cover native storage. This strict transaction double
// exercises failure retention and migration from already persisted Blob rows.
function storage(initial: JournalRecord[] = []) {
  const rows = new Map(initial.map(row => [row.id, row]));
  let fail = false;
  const db = {
    close() {},
    transaction() {
      const tx = { oncomplete: null as null | (() => void), onabort: null as null | (() => void), onerror: null as null | (() => void), error: null as Error | null,
        abort() { queueMicrotask(() => tx.onabort?.()); },
        objectStore() { return {
          put(row: JournalRecord) {
            if (fail || row.data instanceof Blob) throw new DOMException('Storage unavailable', 'UnknownError');
            rows.set(row.id, structuredClone(row)); return finish(row.id);
          },
          getAll() { return finish([...rows.values()]); },
          delete(id: string) { rows.delete(id); return finish(undefined); },
        }; },
      };
      function finish<T>(result: T) { queueMicrotask(() => tx.oncomplete?.()); return { result }; }
      return tx;
    },
  };
  vi.stubGlobal('indexedDB', {
    databases: async () => [{ name: 'dali-account-recovery-v1' }],
    open() { const request = { result: db, onsuccess: null as null | (() => void) }; queueMicrotask(() => request.onsuccess?.()); return request; },
  });
  return { rows, fail(value: boolean) { fail = value; } };
}
afterEach(() => { vi.unstubAllGlobals(); });
const scope = { accountId: 'member', boardId: 'board', generation: 1, recoveryEpoch: '11111111-1111-4111-8111-111111111111' };
const descriptor = { summary: { id: 'board', accountId: 'member', role: 'owner' }, rootDocId: 'root', contentDocId: 'content', capabilities: ['write'], recoveryEpoch: scope.recoveryEpoch } as BoardDescriptor;

it('persists file bytes and MIME before reporting success and retries the same record after storage failure', async () => {
  const db = storage(); const failure = vi.fn(); const journal = new AccountJournal(scope, failure);
  const bytes = new Uint8Array([0, 128, 255]); const blob = new Blob([bytes], { type: 'image/png' });
  db.fail(true); await expect(journal.capture('blob', 'image', blob)).rejects.toThrow('Storage unavailable');
  expect(failure).toHaveBeenCalledOnce(); expect(db.rows.size).toBe(0);
  db.fail(false); await journal.preserve();
  expect(db.rows.size).toBe(1); const record = [...db.rows.values()][0]!;
  expect(record).toMatchObject({ ...scope, kind: 'blob', resource: 'image', mime: 'image/png', data: bytes });
  await journal.preserve(); expect([...db.rows.values()]).toEqual([record]);
});

for (const legacy of [false, true]) it(`replays ${legacy ? 'legacy Blob' : 'byte'} records with exact MIME and only removes acknowledged rows`, async () => {
  const bytes = new Uint8Array([1, 2, 255]);
  const record: JournalRecord = { ...scope, id: 'pending', sequence: 1, kind: 'blob', resource: 'image',
    data: legacy ? new Blob([bytes], { type: 'image/png' }) : bytes, ...(legacy ? {} : { mime: 'image/png' }) };
  const db = storage([record]); let acknowledge = false;
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
    expect(new Headers(init.headers).get('Content-Type')).toBe('image/png');
    expect(new Uint8Array(await new Response(init.body).arrayBuffer())).toEqual(bytes);
    return Response.json({ acknowledged: acknowledge, key: 'image' }, { headers: { 'X-Dali-Recovery-Epoch': scope.recoveryEpoch } });
  }));
  await expect(replayJournal(descriptor, 'member', new AbortController().signal)).rejects.toThrow('unconfirmed');
  expect(db.rows.get('pending')).toBe(record);
  acknowledge = true; await expect(replayJournal(descriptor, 'member', new AbortController().signal)).resolves.toBe(true);
  expect(db.rows.size).toBe(0);
});

it('@04-02-02 epoch-less and stale journal records remain intact without network replay', async () => {
  for (const recoveryEpoch of [undefined, '22222222-2222-4222-8222-222222222222']) {
    const record: JournalRecord = { ...scope, recoveryEpoch, id: 'retained', sequence: 1, kind: 'document', resource: 'content', data: new Uint8Array([0]) };
    const db = storage([record]); const request = vi.fn(); vi.stubGlobal('fetch', request);
    await expect(replayJournal(descriptor, 'member', new AbortController().signal)).rejects.toThrow('recovery state');
    expect(request).not.toHaveBeenCalled(); expect(db.rows.get(record.id)).toBe(record);
  }
});
