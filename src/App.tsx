import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AuthBoundary, type SessionDescriptor } from './auth/AuthBoundary';
import { BoardLibrary, validDescriptor, type BoardDescriptor } from './boards/BoardLibrary';
import BlockSuiteCanvas from './canvas/BlockSuiteCanvas';
import { Header } from './header/Header';
import { disposeCanvasRuntime, getCanvasRuntime, nextAccessGeneration, suspendAccessScope, type CanvasRuntime } from './canvas/runtime';
import { accountBoardUrl, accountIntent } from './boards/preferences';
import { createAccountBoard, AccountBoardAction, BoardActionError } from './boards/operations';
import { discardRecords } from './canvas/account/outbox';
import { getSessionState, interruptSession, preserveBeforeNavigation, recoveryBoard, subscribeSession } from './auth/session';

function RecoveryDenied({ accountId, boardId }: { accountId: string; boardId: string }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [accountId, boardId]);
  const dialog = useRef<HTMLDialogElement>(null); const safe = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState(false); const [discarded, setDiscarded] = useState(false);
  const title = recoveryBoard(accountId)?.title ?? 'this board';
  return <section className="session-recovery"><h1 ref={heading} tabIndex={-1}>Your access has changed</h1><p role="alert">Your access has changed. Pending changes have not been applied. Return to your boards or contact the board owner.</p>
    <a href="/">Back to your boards</a>
    {discarded ? <p role="status">Pending changes discarded.</p> : <button onClick={() => { dialog.current?.showModal(); safe.current?.focus(); }}>Discard pending changes</button>}
    <dialog ref={dialog} className="session-recovery" aria-labelledby="discard-heading"><h2 id="discard-heading">Discard pending changes for “{title}”?</h2><p>This removes this account's recovery copy. Browser-local originals stay unchanged.</p>
      {error && <p role="alert">Pending changes could not be discarded. Try again.</p>}
      <button ref={safe} onClick={() => dialog.current?.close()}>Keep pending changes</button>
      <button onClick={() => { void discardRecords(accountId, boardId).then(() => { setDiscarded(true); dialog.current?.close(); }, () => setError(true)); }}>Discard pending changes</button>
    </dialog>
  </section>;
}

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

function BoardTarget({ member, target, onOpenBoards, signOut }: { member: SessionDescriptor; target: string; onOpenBoards: () => void; signOut: () => Promise<void> }) {
  const [state, setState] = useState<'loading' | 'denied' | 'expired' | 'error' | 'ready'>('loading');
  const [board, setBoard] = useState<BoardDescriptor>();
  const [runtime, setRuntime] = useState<CanvasRuntime>();
  const [retry, setRetry] = useState(0);
  const hasRecovery = recoveryBoard(member.accountId)?.boardId === target;
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (['expired', 'denied', 'error'].includes(state)) heading.current?.focus(); }, [state, target]);
  const rename = useRef<AccountBoardAction>();
  const renameBoard = async (title: string) => {
    if (rename.current) {
      const known = await rename.current.check();
      if (known.status === 'completed') { setBoard(known.result!); rename.current = undefined; return; }
      rename.current = undefined; throw new BoardActionError('No completed change was found. You can retry the name.');
    }
    rename.current = new AccountBoardAction(member.accountId, target, 'rename');
    try { setBoard(await rename.current.run(title)); rename.current = undefined; }
    catch (cause) { if (!(cause instanceof BoardActionError && cause.uncertain)) rename.current = undefined; throw cause; }
  };
  useEffect(() => {
    const controller = new AbortController(); const generation = nextAccessGeneration();
    setState('loading'); setBoard(undefined); setRuntime(undefined);
    if (!target) { setState('denied'); return () => controller.abort(); }
    void fetch(`/api/boards/${encodeURIComponent(target)}`, { headers: { 'X-Dali-Account': member.accountId }, cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (controller.signal.aborted) return;
        if (response.status === 401) { void interruptSession(); return; }
        if (response.status === 404) { setState('denied'); return; }
        if (!response.ok) throw new Error('Board unavailable');
        const descriptor = await response.json() as BoardDescriptor;
        if (!validDescriptor(descriptor, member.accountId) || descriptor.summary.id !== target) throw new Error('Invalid descriptor');
        if (!controller.signal.aborted) {
          const loaded = await getCanvasRuntime({ descriptor, accountId: member.accountId, generation, signal: controller.signal,
            onAuthorizationLost: error => { if (!controller.signal.aborted) { setRuntime(undefined); setBoard(undefined); setState(error.status === 401 ? 'expired' : 'denied'); } } });
          if (!controller.signal.aborted) { setRuntime(loaded); setBoard(loaded.descriptor); setState('ready'); }
        }
      }).catch((cause: unknown) => { if (!controller.signal.aborted) setState(cause instanceof Error && 'status' in cause ? (cause.status === 401 ? 'expired' : 'denied') : 'error'); });
    return () => { suspendAccessScope('navigation'); queueMicrotask(() => { controller.abort(); disposeCanvasRuntime(generation); }); };
  }, [member.accountId, target, retry]);
  if (state === 'loading') return <p role="status">Opening board…</p>;
  if (state === 'expired') return <section><h1 ref={heading} tabIndex={-1}>Session expired — sign in to continue.</h1><a href={'/auth/start?returnTo=' + encodeURIComponent(window.location.pathname + window.location.search)}>Sign in to continue</a></section>;
  if (state === 'denied' && hasRecovery) return <RecoveryDenied accountId={member.accountId} boardId={target} />;
  if (state === 'denied') return <section className="session-recovery"><h1 ref={heading} tabIndex={-1}>You don't have access to this board</h1><p>Ask the board owner to grant access to your internal account.</p><a href="/">Back to your boards</a></section>;
  if (state === 'error') return <section className="session-recovery"><h1 ref={heading} tabIndex={-1}>We couldn't open this board.</h1><p role="alert">We couldn't open this board. Try again.</p><button onClick={() => setRetry(value => value + 1)}>Try again</button><a href="/">Back to your boards</a></section>;
  return <div className="djai-app" data-board-id={board!.summary.id}>
    <Header boardTitle={board!.summary.title} board={board!} member={member} signOut={signOut} onBoardChanged={setBoard} onOpenBoards={onOpenBoards} onRenameBoard={board!.summary.role === 'viewer' ? undefined : renameBoard} />
    <main className="djai-canvas-area"><BlockSuiteCanvas runtime={runtime!} /></main>
  </div>;
}
export default function App() {
  const session = useSyncExternalStore(subscribeSession, getSessionState);
  const [intent, setIntent] = useState(() => accountIntent());
  useEffect(() => { const changed = () => { void preserveBeforeNavigation().then(ok => { if (ok) setIntent(accountIntent()); }); }; window.addEventListener('popstate', changed); return () => window.removeEventListener('popstate', changed); }, []);
  const openBoards = () => { void preserveBeforeNavigation().then(ok => { if (ok) { window.history.pushState(null, '', '/'); setIntent({ kind: 'home' }); } }); };
  return <AuthBoundary>{(member, signOut) => intent.kind === 'new' ? <NewBoardTarget key={member.accountId + session.revision} member={member} operationId={intent.operationId} /> : intent.kind === 'board' || intent.kind === 'invalid' ? <BoardTarget key={member.accountId + session.revision} member={member} target={intent.kind === 'board' ? intent.boardId : ''} onOpenBoards={openBoards} signOut={signOut} /> : <BoardLibrary key={member.accountId + session.revision} member={member} signOut={signOut} />}</AuthBoundary>;
}
