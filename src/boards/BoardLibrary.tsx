import { useEffect, useRef, useState } from 'react';
import type { SessionDescriptor } from '../auth/AuthBoundary';

export type BoardSummary = { id: string; title: string; updatedAt: number; role: 'owner' | 'editor' | 'viewer'; access: 'private' | 'shared'; pendingCount: number; accountId: string; thumbnailUrl?: string };
export type BoardDescriptor = { summary: BoardSummary; rootDocId: string; contentDocId: string; capabilities: string[]; revision: number };
export function validSummary(value: BoardSummary, accountId: string) {
  return value && value.accountId === accountId && typeof value.id === 'string' && value.id.length > 0 && typeof value.title === 'string'
    && ['owner', 'editor', 'viewer'].includes(value.role) && ['private', 'shared'].includes(value.access)
    && Number.isSafeInteger(value.updatedAt) && Number.isSafeInteger(value.pendingCount) && value.pendingCount >= 0;
}
export function BoardLibrary({ member }: { member: SessionDescriptor }) {
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState('');
  const operation = useRef<{ id: string; title: string } | null>(null);
  const lifetime = useRef<AbortController>();
  useEffect(() => {
    const controller = new AbortController(); lifetime.current = controller;
    return () => controller.abort();
  }, [member.accountId]);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(false); setBoards([]);
    void fetch('/api/boards', { headers: { 'X-Dali-Account': member.accountId }, cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Library unavailable');
        const rows: BoardSummary[] = await response.json();
        if (!Array.isArray(rows) || rows.some(row => !validSummary(row, member.accountId))) throw new Error('Invalid library');
        if (!controller.signal.aborted) setBoards(rows);
      }).catch(() => { if (!controller.signal.aborted) { setBoards([]); setError(true); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [member.accountId, refresh]);
  const create = async () => {
    if (busy) return;
    const controller = lifetime.current!; setBusy(true); setCreateError('');
    const headers = { 'X-Dali-Account': member.accountId, 'X-Dali-Request': '1', 'Content-Type': 'application/json' };
    const reconcile = async (): Promise<BoardDescriptor | undefined> => {
      const response = await fetch('/api/operations/' + operation.current!.id, { headers, cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error('Reconciliation unavailable');
      const known = await response.json() as { status: string; result?: BoardDescriptor };
      if (known.status === 'completed' && known.result) return known.result;
      if (known.status !== 'unknown') throw new Error('Operation pending');
    };
    try {
      let result: BoardDescriptor | undefined;
      if (operation.current) result = await reconcile();
      else operation.current = { id: crypto.randomUUID(), title };
      if (!result) {
        const timeout = new AbortController();
        const abort = () => timeout.abort(); controller.signal.addEventListener('abort', abort, { once: true });
        const timer = window.setTimeout(abort, 10000);
        try {
          const response = await fetch('/api/boards', { method: 'POST', headers, signal: timeout.signal,
            body: JSON.stringify({ title: operation.current!.title, operationId: operation.current!.id }) });
          if (!response.ok) {
            if (response.status === 400) { operation.current = null; throw new Error('Use a board name of 200 characters or fewer.'); }
            throw new Error('Create unavailable');
          }
          result = await response.json() as BoardDescriptor;
        } catch (cause) {
          if (controller.signal.aborted || !operation.current) throw cause;
          result = await reconcile(); if (!result) throw cause;
        } finally { clearTimeout(timer); controller.signal.removeEventListener('abort', abort); }
      }
      if (!result || !validSummary(result.summary, member.accountId)) throw new Error('Invalid result');
      if (!controller.signal.aborted) {
        const created = result.summary;
        setBoards(current => [created, ...current.filter(board => board.id !== created.id)]);
        setTitle(''); operation.current = null;
      }
    } catch (cause) {
      if (!controller.signal.aborted) setCreateError(cause instanceof Error && cause.message.startsWith('Use a board') ? cause.message : "We couldn't create this board. Try again.");
    } finally { if (!controller.signal.aborted) setBusy(false); }
  };
  return <>
    <div className="board-library__title-row"><div><h1>Your boards</h1><p>Boards you can access with this account.</p></div></div>
    <form onSubmit={event => { event.preventDefault(); void create(); }} style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
      <label>Board name <input aria-label="Board name" value={title} onChange={event => setTitle(event.target.value)} disabled={busy || !!operation.current} /></label>
      <button className="djai-primary" disabled={busy} type="submit">{busy ? 'Creating board…' : 'New board'}</button>
    </form>
    {createError && <p role="alert">{createError}</p>}
    <button onClick={() => setRefresh(value => value + 1)}>Refresh boards</button>
    {loading ? <p role="status">Loading your boards…</p> : error ? <section><p role="alert">We couldn't load your boards. Try again.</p><button onClick={() => setRefresh(value => value + 1)}>Try again</button></section> : boards.length === 0 ? <section><h2>Create your first board</h2><p>Start a private board. You can share it with internal members afterward.</p></section> : <div className="board-grid">
      {boards.map(board => <article className="board-card" key={board.id} data-board-id={board.id}>
        <a className="board-card__open" href={'/?board=' + encodeURIComponent(board.id)} aria-label={'Open ' + board.title}>
          <span className="board-card__preview">Preview unavailable</span><strong>{board.title}</strong>
          <small>Edited {new Date(board.updatedAt).toLocaleString()}</small>
        </a><p>{board.access === 'private' ? 'Private' : 'Shared'} · {board.role[0]!.toUpperCase() + board.role.slice(1)}</p>
      </article>)}
    </div>}
  </>;
}
