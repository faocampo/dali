import { MenuIcon } from '../header/MenuIcon';
import { useEffect, useRef, useState } from 'react';
import type { SessionDescriptor } from '../auth/AuthBoundary';
import { ShareBoardDialog } from './ShareBoardDialog';
import { BoardActionDialog } from './BoardActionDialog';
import { BoardImportDialog } from './BoardImportDialog';
import { AccountMenu } from '../header/AccountMenu';
import { Dropdown } from '../header/Dropdown';
import logo from '../../imgs/svg/dali-logo-light.svg';
import { authenticatedRecoveryEpoch, validRecoveryEpoch } from '../canvas/account/doc-source';
import { inspectAuthorizedPendingBoards, subscribePendingBoardInvalidation, type PendingBoardStatus } from './pending-recovery';
import './pending-recovery.css';

export type BoardSummary = { id: string; title: string; updatedAt: number; role: 'owner' | 'editor' | 'viewer'; access: 'private' | 'shared'; pendingCount: number; accountId: string; thumbnailUrl?: string };
export type BoardDescriptor = { liveSupported?: boolean; liveEnabled?: boolean; summary: BoardSummary; rootDocId: string; contentDocId: string; capabilities: string[]; revision: number; recoveryEpoch: string };
export function validDescriptor(value: BoardDescriptor, accountId: string) {
  return value && validSummary(value.summary, accountId) && typeof value.rootDocId === 'string' && !!value.rootDocId &&
    typeof value.contentDocId === 'string' && !!value.contentDocId && value.rootDocId !== value.contentDocId &&
    Array.isArray(value.capabilities) && value.capabilities.every(capability => typeof capability === 'string') &&
    Number.isSafeInteger(value.revision) && value.revision > 0 && validRecoveryEpoch(value.recoveryEpoch);
}
export function validSummary(value: BoardSummary, accountId: string) {
  return value && value.accountId === accountId && typeof value.id === 'string' && value.id.length > 0 && typeof value.title === 'string'
    && ['owner', 'editor', 'viewer'].includes(value.role) && ['private', 'shared'].includes(value.access)
    && Number.isSafeInteger(value.updatedAt) && Number.isSafeInteger(value.pendingCount) && value.pendingCount >= 0;
}
function ProtectedPreview({ board }: { board: BoardSummary }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const controller = new AbortController(); let objectUrl: string | undefined;
    setUrl(undefined);
    if (board.thumbnailUrl) {
      const expectedPath = '/api/boards/' + encodeURIComponent(board.id) + '/thumbnail';
      // Only this board's same-origin endpoint may receive the expected-account header.
      if (board.thumbnailUrl !== expectedPath) return () => controller.abort();
      void fetch(expectedPath, { headers: { 'X-Dali-Account': board.accountId }, cache: 'no-store', signal: controller.signal })
        .then(async response => {
          if (!response.ok || response.headers.get('X-Dali-Account') !== board.accountId || response.headers.get('Content-Type')?.split(';')[0] !== 'image/png') return;
          const blob = await response.blob();
          if (controller.signal.aborted || blob.size > 512 * 1024) return;
          objectUrl = URL.createObjectURL(blob); setUrl(objectUrl);
        }).catch(() => { /* An unavailable preview leaves the authorized board usable. */ });
    }
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [board.id, board.accountId, board.role, board.thumbnailUrl]);
  return <span className="board-card__preview">{url ? <img src={url} alt="" onError={() => setUrl(undefined)} /> : 'Preview unavailable'}</span>;
}
export function BoardLibrary({ member, signOut }: { member: SessionDescriptor; signOut: () => Promise<void> }) {
  return <AccountBoardLibrary key={member.accountId} member={member} signOut={signOut} />;
}
function AccountBoardLibrary({ member, signOut }: { member: SessionDescriptor; signOut: () => Promise<void> }) {
  const [importOpen, setImportOpen] = useState(false);
  const [action, setAction] = useState<{ board: BoardSummary; kind: 'rename' | 'duplicate' | 'delete' }>();
  const [notice, setNotice] = useState('');
  const [sharing, setSharing] = useState<BoardSummary>();
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [recovery, setRecovery] = useState<{ boards: BoardSummary[]; status: 'checking' | 'ready' | 'error'; pending: Map<string, PendingBoardStatus> }>();
  const [filter, setFilter] = useState<'all' | 'mine' | 'shared'>('all');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState('');
  const operation = useRef<{ id: string; title: string; epoch: string } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (!new URLSearchParams(window.location.search).has('focusBoard')) heading.current?.focus(); }, [member.accountId]);
  const actionFocus = useRef<{ id?: string }>();
  useEffect(() => {
    if (loading || error || !actionFocus.current) return;
    const id = actionFocus.current.id; actionFocus.current = undefined;
    const target = id ? document.querySelector<HTMLAnchorElement>('[data-board-id="' + CSS.escape(id) + '"] .board-card__open') : null;
    (target ?? document.querySelector<HTMLButtonElement>('.board-library__create button'))?.focus();
  }, [boards, loading, error]);
  useEffect(() => {
    const url = new URL(window.location.href); const id = url.searchParams.get('focusBoard');
    if (!id || !boards.some(board => board.id === id)) return;
    document.querySelector<HTMLAnchorElement>('[data-board-id="' + CSS.escape(id) + '"] .board-card__open')?.focus();
    url.searchParams.delete('focusBoard'); window.history.replaceState(null, '', url);
  }, [boards]);
  const lifetime = useRef<AbortController>();
  useEffect(() => {
    const controller = new AbortController(); lifetime.current = controller;
    return () => controller.abort();
  }, [member.accountId]);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(false); setBoards([]);
    void fetch('/api/boards?filter=' + filter, { headers: { 'X-Dali-Account': member.accountId }, cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Library unavailable');
        const rows: BoardSummary[] = await response.json();
        if (!Array.isArray(rows) || rows.some(row => !validSummary(row, member.accountId))) throw new Error('Invalid library');
        if (!controller.signal.aborted) setBoards(rows);
      }).catch(() => { if (!controller.signal.aborted) { setBoards([]); setError(true); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [member.accountId, refresh, filter]);
  useEffect(() => subscribePendingBoardInvalidation(() => setRefresh(value => value + 1)), []);
  useEffect(() => {
    if (loading || error) return;
    const controller = new AbortController();
    setRecovery({ boards, status: 'checking', pending: new Map() });
    void inspectAuthorizedPendingBoards(member.accountId, boards, controller.signal).then(pending => {
      if (!controller.signal.aborted) setRecovery({ boards, status: 'ready', pending });
    }).catch(() => {
      if (!controller.signal.aborted) setRecovery({ boards, status: 'error', pending: new Map() });
    });
    return () => controller.abort();
  }, [member.accountId, boards, loading, error]);
  const currentRecovery = recovery?.boards === boards ? recovery : undefined;
  const hasPending = (id: string) => currentRecovery?.pending.get(id)?.hasPendingChanges === true;
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
      else operation.current = { id: crypto.randomUUID(), title, epoch: await authenticatedRecoveryEpoch(member.accountId, controller.signal) };
      if (!result) {
        const timeout = new AbortController();
        const abort = () => timeout.abort(); controller.signal.addEventListener('abort', abort, { once: true });
        const timer = window.setTimeout(abort, 10000);
        try {
          const response = await fetch('/api/boards', { method: 'POST', headers: { ...headers, 'X-Dali-Recovery-Epoch': operation.current!.epoch }, signal: timeout.signal,
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
      if (!validDescriptor(result!, member.accountId)) throw new Error('Invalid result');
      if (!controller.signal.aborted) {
        operation.current = null;
        window.location.assign('/?board=' + encodeURIComponent(result.summary.id));
      }
    } catch (cause) {
      if (!controller.signal.aborted) setCreateError(operation.current ? "We couldn't confirm this change. Check again before retrying." : cause instanceof Error && cause.message.startsWith('Use a board') ? cause.message : "We couldn't create this board. Try again.");
    } finally { if (!controller.signal.aborted) setBusy(false); }
  };
  return <div className="board-library">
    <header className="board-library__header">
      <a className="djai-brand" href="/" aria-label="Dalí"><img src={logo} alt="" height={34} /></a>
      <nav className="board-library__header-actions" aria-label="Library controls">
        {member.systemRole !== 'viewer' && <button type="button" className="board-library__import" onClick={event => { event.currentTarget.focus(); setImportOpen(true); }}><MenuIcon name="import" />Import</button>}
        <AccountMenu member={member} signOut={signOut} />
      </nav>
    </header>
    <main className="board-library__main">
    <div className="board-library__title-row"><div><h1 ref={heading} tabIndex={-1}>Your boards</h1><p>Boards you can access with this account.</p></div>
    {member.systemRole !== 'viewer' && <form className="board-library__create" onSubmit={event => { event.preventDefault(); void create(); }}>
      <label htmlFor="new-board-title">Board name <input id="new-board-title" aria-describedby={createError ? 'board-create-error' : undefined} value={title} onChange={event => setTitle(event.target.value)} disabled={busy || !!operation.current} /></label>
      <button className="djai-primary" aria-describedby={createError ? 'board-create-error' : undefined} disabled={busy || loading} type="submit"><MenuIcon name="new" />{busy ? 'Creating board…' : operation.current ? 'Check again' : 'New board'}</button>
    </form>}</div>
    {createError && <p id="board-create-error" role="alert">{createError}</p>}
    {notice && <p role="status">{notice}</p>}
    <div className="board-library__filters" role="group" aria-label="Filter boards">
      {(['all', 'mine', 'shared'] as const).map(value => <button key={value} aria-pressed={filter === value} onClick={event => { event.currentTarget.focus(); setFilter(value); }}>{value === 'all' ? 'All' : value === 'mine' ? 'Mine' : 'Shared with me'}</button>)}
      <button aria-label="Refresh boards" title="Refresh boards" onClick={event => { event.currentTarget.focus(); setRefresh(value => value + 1); }}><MenuIcon name="refresh" /><span>Refresh boards</span></button>
    </div>
    {!loading && !error && <p className="board-library__recovery-status" role="status">{!currentRecovery || currentRecovery.status === 'checking' ? 'Checking recovery status…' : currentRecovery.status === 'error' ? 'Recovery status unavailable. Refresh boards to try again.' : ''}</p>}
    {loading ? <><p role="status">Loading your boards…</p><div className="board-grid" aria-hidden="true">{[0, 1, 2].map(key => <div className="board-card board-card--skeleton" key={key} />)}</div></> : error ? <section><p role="alert">We couldn't load your boards. Try again.</p><button onClick={() => setRefresh(value => value + 1)}>Try again</button></section> : boards.length === 0 ? <section className="board-library__empty"><h2>{member.systemRole === 'viewer' || filter === 'shared' ? 'No shared boards yet' : 'Create your first board'}</h2><p>{member.systemRole === 'viewer' || filter === 'shared' ? 'Boards shared with you will appear here. Choose All to see your boards.' : 'Start a private board. You can share it with internal members afterward.'}</p>{filter === 'shared' && <button onClick={() => setFilter('all')}>View all boards</button>}</section> : <div className="board-grid">
      {boards.map(board => <article className="board-card" key={board.id} data-board-id={board.id}>
        <a className="board-card__open" href={'/?board=' + encodeURIComponent(board.id)} aria-label={'Open ' + board.title} aria-describedby={hasPending(board.id) ? 'pending-' + board.id : undefined}>
          <ProtectedPreview board={board} /><strong className="board-card__title" title={board.title}>{board.title}</strong>
          <small>Edited {new Date(board.updatedAt).toLocaleString()}</small>
        </a><div className="board-card__footer"><div className="board-card__metadata"><span>{board.access === 'private' ? 'Private' : 'Shared'}</span><span>{board.role[0]!.toUpperCase() + board.role.slice(1)}</span>{board.pendingCount > 0 && <span>Pending member sign-in</span>}</div>
          {board.role !== 'viewer' && <Dropdown className="board-card__actions" label={'Actions for ' + board.title} summary={<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.75" /><circle cx="12" cy="12" r="1.75" /><circle cx="19" cy="12" r="1.75" /></svg>}>
            {close => <>
              <button onClick={() => { close(); setAction({ board, kind: 'rename' }); }}><MenuIcon name="rename" />Rename board</button>
              <button onClick={() => { close(); setAction({ board, kind: 'duplicate' }); }}><MenuIcon name="duplicate" />Duplicate board</button>
              {board.role === 'owner' && <>
                <button onClick={() => { close(); setSharing(board); }}><MenuIcon name="share" />Share board</button>
                <button className="access-destructive" onClick={() => { close(); setAction({ board, kind: 'delete' }); }}><MenuIcon name="delete" />Delete board</button>
              </>}
            </>}
          </Dropdown>}
        </div>
        {hasPending(board.id) && <div className="board-card__pending" id={'pending-' + board.id}><span aria-hidden="true">◷</span><div><span>Changes waiting to save</span><p>Open this board in this browser to recover changes that have not reached the server.</p></div></div>}
      </article>)}
    </div>}
    {importOpen && <BoardImportDialog key={member.accountId} member={member} onClose={() => setImportOpen(false)} onImported={() => { setFilter('all'); setRefresh(value => value + 1); }} />}
    {action && <BoardActionDialog board={action.board} kind={action.kind} onClose={() => setAction(undefined)} onComplete={result => {
      const remaining = boards.filter(row => row.id !== action.board.id);
      const next = result.deleted ? remaining[0]?.id : action.kind === 'duplicate' && filter === 'shared' ? action.board.id : result.summary.id;
      actionFocus.current = { id: next };
      setRefresh(value => value + 1);
      setNotice(result.deleted ? 'Board deleted.' : action.kind === 'duplicate' ? 'Private copy created.' : 'Board name saved.'); setAction(undefined);
    }} />}
    {sharing && <ShareBoardDialog key={sharing.id + member.accountId} board={sharing} onClose={() => setSharing(undefined)} onChanged={state => {
      if (!state) { setRefresh(value => value + 1); return; }
      setBoards(current => current.map(row => row.id === sharing.id ? { ...row, access: state.grants.length ? 'shared' : 'private', pendingCount: state.grants.filter(grant => grant.status === 'pending').length } : row));
    }} />}
    </main>
  </div>;
}
