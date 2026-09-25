import { afterEach, expect, it, vi } from 'vitest';
import { AccountJournal, readCheckpoint, replayJournal, type JournalRecord } from './outbox';
import { attachLocalCapture, RECOVERY_REPLAY_ORIGIN } from './local-capture';
import * as Y from 'yjs';
import type { BoardDescriptor } from '../../boards/BoardLibrary';

// Browser regressions cover native storage. This strict transaction double
// exercises failure retention and migration from already persisted Blob rows.
function storage(initial: JournalRecord[] = []) {
  const rows = new Map(initial.map(row => [row.id, row]));
  const stores = new Map<string, Map<string, unknown>>([['journal', rows], ['sequences', new Map()], ['checkpoints', new Map()]]);
  let fail = false;
  const db = {
    close() {},
    transaction(_names: string[], _mode: string, options: { durability: string }) {
      expect(options.durability).toBe('strict');
      const draft = new Map([...stores].map(([name, values]) => [name, new Map(values)]));
      let pending = 0; let aborted = false;
      const tx = { oncomplete: null as null | (() => void), onabort: null as null | (() => void), onerror: null as null | (() => void), error: null as Error | null,
        abort() { aborted = true; queueMicrotask(() => tx.onabort?.()); },
        objectStore(name: string) { const values = draft.get(name)!; return {
          put(row: { id: string; data?: unknown }) {
            if (fail || row.data instanceof Blob) { tx.error = new DOMException('Storage unavailable', 'UnknownError'); throw tx.error; }
            values.set(row.id, structuredClone(row)); return request(row.id);
          },
          get(id: string) { return request(values.get(id)); },
          getAll() { return request([...values.values()]); },
          delete(id: string) { values.delete(id); return request(undefined); },
          index(index: string) { return { getAll(query: string | string[]) {
            return request([...values.values()].filter(value => { const row = value as JournalRecord; const key = index === 'account' ? row.accountId : index === 'board' ? [row.accountId, row.boardId] : [row.accountId, row.boardId, row.epoch]; return JSON.stringify(key) === JSON.stringify(query); }));
          } }; },
        }; },
      };
      function request<T>(result: T) {
        pending++; const req = { result, onsuccess: null as null | (() => void) };
        queueMicrotask(() => { if (aborted) return; pending--; req.onsuccess?.(); queueMicrotask(() => {
          if (!aborted && !pending) { for (const [name, values] of draft) { const target = stores.get(name)!; target.clear(); for (const [id, value] of values) target.set(id, value); } tx.oncomplete?.(); }
        }); }); return req;
      }
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
const imageKey = 'A'.repeat(43) + '=';
const scope = { accountId: 'member', boardId: 'board', generation: 1, recoveryEpoch: '11111111-1111-4111-8111-111111111111' };
const descriptor = { summary: { id: 'board', accountId: 'member', role: 'owner' }, rootDocId: 'root', contentDocId: 'content', capabilities: ['write'], recoveryEpoch: scope.recoveryEpoch } as BoardDescriptor;

it('@04-03-01 captures immutable versioned epoch and tab identity', async () => {
  const db = storage(); const journal = new AccountJournal(scope, vi.fn());
  const data = new Uint8Array([0, 0]); const first = journal.capture('document', 'content', data); data[0] = 255;
  await first; await journal.capture('document', 'content', new Uint8Array([0, 0]));
  const records = [...db.rows.values()];
  expect(records[0]).toMatchObject({ schemaVersion: 2, epoch: scope.recoveryEpoch, data: new Uint8Array([0, 0]) });
  expect(records[0]).toHaveProperty('tabId'); expect(records[1]!.sequence).toBeGreaterThan(records[0]!.sequence);
});

it('@04-03-01 captures local updates independently and skips hydration and replay origins', async () => {
  const db = storage(); const journal = new AccountJournal(scope, vi.fn());
  const root = new Y.Doc({ guid: 'root' }); const content = new Y.Doc({ guid: 'content' });
  const capture = attachLocalCapture({ journal, root, content, title: 'Synthetic baseline' }); await capture.ready;
  content.getText('canary').insert(0, 'local');
  root.transact(() => root.getMap('meta').set('remote', true), RECOVERY_REPLAY_ORIGIN);
  const remote = new Y.Doc(); remote.getText('remote').insert(0, 'hydrated'); Y.applyUpdate(content, Y.encodeStateAsUpdate(remote), 'load');
  await capture.preserve(); expect(db.rows.size).toBe(1);
  const checkpoint = await readCheckpoint(scope, journal.tabId); expect(checkpoint?.title).toBe('Synthetic baseline');
  const rebuilt = new Y.Doc(); Y.applyUpdate(rebuilt, checkpoint!.content.data);
  for (const record of db.rows.values()) Y.applyUpdate(rebuilt, record.data as Uint8Array);
  expect(rebuilt.getText('canary').toString()).toBe('local'); expect(rebuilt.getText('remote').toString()).toBe('');
  capture.dispose(); content.getText('canary').insert(0, 'after dispose'); await capture.preserve(); expect(db.rows.size).toBe(1);
  [root, content, remote, rebuilt].forEach(doc => doc.destroy());
});

it('persists file bytes and MIME before reporting success and retries the same record after storage failure', async () => {
  const db = storage(); const failure = vi.fn(); const journal = new AccountJournal(scope, failure);
  const bytes = new Uint8Array([0, 128, 255]); const blob = new Blob([bytes], { type: 'image/png' });
  db.fail(true); await expect(journal.capture('blob', imageKey, blob)).rejects.toThrow('Storage unavailable');
  expect(failure).toHaveBeenCalledOnce(); expect(db.rows.size).toBe(0);
  db.fail(false); await journal.preserve();
  expect(db.rows.size).toBe(1); const record = [...db.rows.values()][0]!;
  expect(record).toMatchObject({ ...scope, kind: 'blob', resource: imageKey, mime: 'image/png', data: bytes });
  await journal.preserve(); expect([...db.rows.values()]).toEqual([record]);
});

for (const legacy of [false, true]) it(`replays ${legacy ? 'legacy Blob' : 'byte'} records with exact MIME and only removes acknowledged rows`, async () => {
  const bytes = new Uint8Array([1, 2, 255]);
  const record: JournalRecord = { ...scope, schemaVersion: 2, epoch: scope.recoveryEpoch, tabId: 'synthetic-tab', coveredIds: [], id: 'pending', sequence: 1, kind: 'blob', resource: imageKey,
    data: legacy ? new Blob([bytes], { type: 'image/png' }) : bytes, ...(legacy ? {} : { mime: 'image/png' }) };
  const db = storage([record]); let acknowledge = false;
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
    expect(new Headers(init.headers).get('Content-Type')).toBe('image/png');
    expect(new Uint8Array(await new Response(init.body).arrayBuffer())).toEqual(bytes);
    return Response.json({ acknowledged: acknowledge, key: imageKey }, { headers: { 'X-Dali-Recovery-Epoch': scope.recoveryEpoch } });
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
