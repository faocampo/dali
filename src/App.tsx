import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AuthBoundary, type SessionDescriptor } from './auth/AuthBoundary';
import { BoardLibrary, validDescriptor, type BoardDescriptor } from './boards/BoardLibrary';
import BlockSuiteCanvas from './canvas/BlockSuiteCanvas';
import { Header } from './header/Header';
import { disposeCanvasRuntime, getCanvasRuntime, getActiveAccessScope, subscribeAccessScope, nextAccessGeneration, suspendAccessScope, type CanvasRuntime } from './canvas/runtime';
import { RecoveryStateView, RecoveryVersionChoice } from './canvas/RecoveryStateView';
import { accountBoardUrl, accountIntent } from './boards/preferences';
import { createAccountBoard, renameOpenAccountBoard } from './boards/operations';
import { discardRecords } from './canvas/account/outbox';
import { getSessionState, interruptSession, preserveBeforeNavigation, recoveryBoard, subscribeSession } from './auth/session';

import { getAccountSaveSnapshot, subscribeSaveStatus } from './canvas/save-status';
import { installBoardNavigationGuard, requestBoardNavigation, shouldWarnOnLeave, type NavigationOperation } from './canvas/leave-policy';
import { LeaveRecoveryDialog } from './header/LeaveRecoveryDialog';

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
  const [state, setState] = useState<'loading' | 'denied' | 'expired' | 'error' | 'ready' | 'corrupt' | 'epoch-mismatch'>('loading');
  const activeScope = useSyncExternalStore(subscribeAccessScope, getActiveAccessScope);
  const [restored, setRestored] = useState(false);
  const [board, setBoard] = useState<BoardDescriptor>();
  const [runtime, setRuntime] = useState<CanvasRuntime>();
  const [retry, setRetry] = useState(0);
  const hasRecovery = recoveryBoard(member.accountId)?.boardId === target;
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (['expired', 'denied', 'error'].includes(state)) heading.current?.focus(); }, [state, target]);
  const renameBoard = renameOpenAccountBoard;
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
          const loaded = await getCanvasRuntime({ descriptor, accountId: member.accountId, generation, signal: controller.signal, openRestored: restored,
            onAuthorizationLost: error => { if (!controller.signal.aborted) { setRuntime(undefined); setBoard(undefined); setState(error.status === 401 ? 'expired' : 'denied'); } } });
          if (!controller.signal.aborted) { setRuntime(loaded); setBoard(loaded.descriptor); setState('ready'); }
        }
      }).catch((cause: unknown) => { if (!controller.signal.aborted) setState(cause instanceof Error && 'recoveryState' in cause ? cause.recoveryState as 'corrupt' | 'epoch-mismatch' : cause instanceof Error && 'status' in cause ? (cause.status === 401 ? 'expired' : 'denied') : 'error'); });
    return () => { suspendAccessScope('navigation'); queueMicrotask(() => { controller.abort(); disposeCanvasRuntime(generation); }); };
  }, [member.accountId, target, retry, restored]);
  if (state === 'corrupt' || state === 'epoch-mismatch') return <RecoveryStateView state={state} openRestored={() => setRestored(true)} />;
  if (state === 'ready' && activeScope?.recoveryState === 'denied' && board?.summary.role !== 'viewer') return <RecoveryDenied accountId={member.accountId} boardId={target} />;
  if (state === 'loading') return <p role="status">{activeScope?.recoveryState === 'recovering' ? 'Recovering changes…' : activeScope?.phase === 'active' && activeScope.accountId === member.accountId && activeScope.boardId === target && activeScope.recoveryState === 'saved' ? 'Opening board…' : 'Checking access…'}</p>;
  if (state === 'expired') return <section><h1 ref={heading} tabIndex={-1}>Session expired — sign in to continue.</h1><a href={'/auth/start?returnTo=' + encodeURIComponent(window.location.pathname + window.location.search)}>Sign in to continue</a></section>;
  if (state === 'denied' && hasRecovery) return <RecoveryDenied accountId={member.accountId} boardId={target} />;
  if (state === 'denied') return <section className="session-recovery"><h1 ref={heading} tabIndex={-1}>You don't have access to this board</h1><p>Ask the board owner to grant access to your internal account.</p><a href="/">Back to your boards</a></section>;
  if (state === 'error') return <section className="session-recovery"><h1 ref={heading} tabIndex={-1}>We couldn't open this board.</h1><p role="alert">We couldn't open this board. Try again.</p><button onClick={() => setRetry(value => value + 1)}>Try again</button><a href="/">Back to your boards</a></section>;
  return <div className="djai-app" data-board-id={board!.summary.id}>
    <Header boardTitle={activeScope?.title ?? board!.summary.title} board={board!} member={member} signOut={signOut} onBoardChanged={setBoard} onOpenBoards={onOpenBoards} onRenameBoard={board?.summary.role !== 'viewer' ? renameBoard : undefined} onOpenRestored={() => { setRestored(true); setRetry(value => value + 1); }} />
    <main className="djai-canvas-area"><BlockSuiteCanvas runtime={runtime!} /></main>
    {activeScope?.recoveryChoice && <RecoveryVersionChoice reason={activeScope.recoveryChoice} onRestored={() => setRetry(value => value + 1)} />}
  </div>;
}
export default function App() {
  const session = useSyncExternalStore(subscribeSession, getSessionState);
  const [intent, setIntent] = useState(() => accountIntent());
  const snapshot = useSyncExternalStore(subscribeSaveStatus, getAccountSaveSnapshot);
  const access = useSyncExternalStore(subscribeAccessScope, getActiveAccessScope);
  const [destination, setDestination] = useState<{ run: () => void | Promise<void>; origin: HTMLElement | null; operation: NavigationOperation }>();
  const pendingDestination = useRef(false); const navigating = useRef(false);
  const nativeNavigationApproved = useRef(false);
  const [leaving, setLeaving] = useState(false);
  const currentUrl = useRef(window.location.href);
  useEffect(() => { nativeNavigationApproved.current = false; }, [intent]);
  const finish = async (run: () => void | Promise<void>, confirmed: boolean, operation: NavigationOperation) => {
    if (navigating.current) return;
    navigating.current = true; nativeNavigationApproved.current = true; setLeaving(true);
    try {
      // Sign-out owns preservation and retains its intent if storage needs retry.
      if (operation === 'sign-out' || await preserveBeforeNavigation(confirmed)) {
        await run(); currentUrl.current = window.location.href;
        if (operation === 'sign-out' && getSessionState().phase !== 'signed-out') nativeNavigationApproved.current = false;
      }
      else nativeNavigationApproved.current = false;
    } finally { navigating.current = false; pendingDestination.current = false; setLeaving(false); setDestination(undefined); }
  };
  useEffect(() => installBoardNavigationGuard((run, operation) => {
    if (pendingDestination.current || navigating.current) return;
    const scope = getActiveAccessScope();
    if (scope?.phase === 'active' && scope.role !== 'viewer' && shouldWarnOnLeave(getAccountSaveSnapshot(), scope.stalled)) {
      pendingDestination.current = true; setDestination({ run, operation, origin: document.activeElement instanceof HTMLElement ? document.activeElement : null });
    } else void finish(run, false, operation);
  }), []);
  useEffect(() => {
    if (intent.kind !== 'board' || !access || access.role === 'viewer' || !shouldWarnOnLeave(snapshot, access.stalled)) return;
    const warn = (event: BeforeUnloadEvent) => { if (!nativeNavigationApproved.current) { event.preventDefault(); event.returnValue = true; } };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [snapshot, access, intent.kind]);
  useEffect(() => {
    const go = (href: string, replace = false) => {
      const url = new URL(href);
      if (url.pathname !== '/') { window.location.assign(href); return; }
      if (replace) window.history.replaceState(null, '', href); else window.history.pushState(null, '', href);
      setIntent(accountIntent());
    };
    const changed = () => {
      const href = window.location.href;
      window.history.replaceState(null, '', currentUrl.current);
      requestBoardNavigation(() => go(href, true));
    };
    const clicked = (event: MouseEvent) => {
      const link = event.composedPath().find(node => node instanceof HTMLAnchorElement) as HTMLAnchorElement | undefined;
      if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target === '_blank' || link.hasAttribute('download') || getActiveAccessScope()?.phase !== 'active' || new URL(link.href).origin !== location.origin) return;
      event.preventDefault(); event.stopPropagation(); const href = link.href;
      // Mouse activation does not focus links in every browser. The leave
      // dialog must restore the actual trigger when the member stays.
      link.focus({ preventScroll: true });
      requestBoardNavigation(() => go(href));
    };
    window.addEventListener('popstate', changed); document.addEventListener('click', clicked, true);
    return () => { window.removeEventListener('popstate', changed); document.removeEventListener('click', clicked, true); };
  }, []);
  const openBoards = () => requestBoardNavigation(() => { window.history.pushState(null, '', '/'); setIntent({ kind: 'home' }); });
  return <><AuthBoundary>{(member, signOut) => intent.kind === 'new' ? <NewBoardTarget key={member.accountId + session.revision} member={member} operationId={intent.operationId} /> : intent.kind === 'board' || intent.kind === 'invalid' ? <BoardTarget key={member.accountId + session.revision} member={member} target={intent.kind === 'board' ? intent.boardId : ''} onOpenBoards={openBoards} signOut={async () => { requestBoardNavigation(signOut, 'sign-out'); }} /> : <BoardLibrary key={member.accountId + session.revision} member={member} signOut={signOut} />}</AuthBoundary>
    {destination && <LeaveRecoveryDialog preserved={!!snapshot?.preserved} busy={leaving} onStay={() => { const origin = destination.origin; pendingDestination.current = false; setDestination(undefined); requestAnimationFrame(() => { if (origin?.isConnected) origin.focus(); }); }} onLeave={() => { void finish(destination.run, true, destination.operation); }} />}
  </>;
}
