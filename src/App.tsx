import { useEffect, useState } from 'react';
import { AuthBoundary, type SessionDescriptor } from './auth/AuthBoundary';
import { BoardLibrary, validSummary, type BoardDescriptor } from './boards/BoardLibrary';
import logo from '../imgs/svg/dali-symbol-color.svg';
import BlockSuiteCanvas from './canvas/BlockSuiteCanvas';
import { Header } from './header/Header';
import { disposeCanvasRuntime, getCanvasRuntime, nextAccessGeneration, suspendAccessScope, type CanvasRuntime } from './canvas/runtime';
import { accountBoardUrl, accountIntent } from './boards/preferences';
import { createAccountBoard } from './boards/operations';

function NewBoardTarget({ member, operationId }: { member: SessionDescriptor; operationId?: string }) {
  const [id] = useState(() => operationId ?? crypto.randomUUID());
  const [error, setError] = useState(false); const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setError(false);
    window.history.replaceState(null, '', '/?new=1&operationId=' + encodeURIComponent(id));
    void createAccountBoard(member.accountId, id, controller.signal).then(board => {
      if (!controller.signal.aborted) window.location.replace(accountBoardUrl(board.summary.id));
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [member.accountId, id, retry]);
  return error ? <section><p role="alert">We couldn't create this board. Try again.</p><button onClick={() => setRetry(value => value + 1)}>Try again</button><a href="/">Back to your boards</a></section> : <p role="status">Creating board…</p>;
}

function BoardTarget({ member, target, onOpenBoards }: { member: SessionDescriptor; target: string; onOpenBoards: () => void }) {
  const [state, setState] = useState<'loading' | 'denied' | 'expired' | 'error' | 'ready'>('loading');
  const [board, setBoard] = useState<BoardDescriptor>();
  const [runtime, setRuntime] = useState<CanvasRuntime>();
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); const generation = nextAccessGeneration();
    setState('loading'); setBoard(undefined); setRuntime(undefined);
    if (!target) { setState('denied'); return () => controller.abort(); }
    void fetch(`/api/boards/${encodeURIComponent(target)}`, { headers: { 'X-Dali-Account': member.accountId }, cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (controller.signal.aborted) return;
        if (response.status === 401) { setState('expired'); return; }
        if (response.status === 404) { setState('denied'); return; }
        if (!response.ok) throw new Error('Board unavailable');
        const descriptor = await response.json() as BoardDescriptor;
        if (!validSummary(descriptor.summary, member.accountId) || descriptor.summary.id !== target || !descriptor.rootDocId || !descriptor.contentDocId) throw new Error('Invalid descriptor');
        if (!controller.signal.aborted) {
          const loaded = await getCanvasRuntime({ descriptor, accountId: member.accountId, generation, signal: controller.signal,
            onAuthorizationLost: error => { if (!controller.signal.aborted) { setRuntime(undefined); setBoard(undefined); setState(error.status === 401 ? 'expired' : 'denied'); } } });
          if (!controller.signal.aborted) { setRuntime(loaded); setBoard(descriptor); setState('ready'); }
        }
      }).catch((cause: unknown) => { if (!controller.signal.aborted) setState(cause instanceof Error && 'status' in cause ? (cause.status === 401 ? 'expired' : 'denied') : 'error'); });
    return () => { suspendAccessScope('navigation'); queueMicrotask(() => { controller.abort(); disposeCanvasRuntime(generation); }); };
  }, [member.accountId, target, retry]);
  if (state === 'loading') return <p role="status">Opening board…</p>;
  if (state === 'expired') return <section><h1>Session expired — sign in to continue.</h1><a href={'/auth/start?returnTo=' + encodeURIComponent(window.location.pathname + window.location.search)}>Sign in to continue</a></section>;
  if (state === 'denied') return <section><h1>You don't have access to this board</h1><p>Ask the board owner to grant access to your internal account.</p><a href="/">Back to your boards</a></section>;
  if (state === 'error') return <section><p role="alert">We couldn't open this board. Try again.</p><button onClick={() => setRetry(value => value + 1)}>Try again</button><a href="/">Back to your boards</a></section>;
  return <div className="djai-app" data-board-id={board!.summary.id}>
    <Header boardTitle={board!.summary.title} onOpenBoards={onOpenBoards} />
    <div style={{ padding: '2px 16px', fontSize: 12 }}><span>{board!.summary.role} · {board!.summary.access}</span><a href="/" style={{ marginLeft: 16 }}>Back to your boards</a></div>
    <main className="djai-canvas-area"><BlockSuiteCanvas runtime={runtime!} /></main>
  </div>;
}
export default function App() {
  const [intent, setIntent] = useState(() => accountIntent());
  useEffect(() => { const changed = () => setIntent(accountIntent()); window.addEventListener('popstate', changed); return () => window.removeEventListener('popstate', changed); }, []);
  const openBoards = () => { window.history.pushState(null, '', '/'); setIntent({ kind: 'home' }); };
  return <AuthBoundary>{(member, signOut) => intent.kind === 'new' ? <NewBoardTarget key={member.accountId} member={member} operationId={intent.operationId} /> : intent.kind === 'board' || intent.kind === 'invalid' ? <BoardTarget key={member.accountId} member={member} target={intent.kind === 'board' ? intent.boardId : ''} onOpenBoards={openBoards} /> : <div className="board-library" key={member.accountId}>
    <header className="board-library__header" style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
      <a className="djai-brand" href="/" aria-label="Dalí"><img src={logo} alt="" height={34} /></a>
      <div style={{ flex: 1, overflowWrap: 'anywhere', minWidth: 0, fontSize: 15 }}>
        <p>{member.displayName}</p><p>{member.email}</p>
      </div>
      <button className="djai-ghost" style={{ minHeight: 44, fontSize: 13, fontWeight: 600 }} onClick={() => { void signOut(); }}>Sign out of Dalí</button>
    </header>
    <main className="board-library__main">
      <BoardLibrary member={member} />
    </main>
  </div>}</AuthBoundary>;
}
