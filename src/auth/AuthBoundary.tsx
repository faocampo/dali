import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { acceptSession, getSessionState, interruptSession, openCurrentBoards, recoveryBoard, restoreRecoveryFocus, setSessionPhase, startSignIn, subscribeSession, watchSession, type SessionDescriptor } from './session';
export type { SessionDescriptor } from './session';
export function AuthBoundary({ children }: { children: (session: SessionDescriptor, signOut: () => Promise<void>) => ReactNode }) {
  const state = useSyncExternalStore(subscribeSession, getSessionState);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(watchSession, []);
  useEffect(() => state.phase === 'authenticated' ? restoreRecoveryFocus() : undefined, [state.phase, state.member, state.revision]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('signedOut')) { setSessionPhase('signed-out'); return; }
    if (params.has('authError')) { setSessionPhase('error'); return; }
    const controller = new AbortController();
    void fetch('/api/session', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal }).then(async response => {
      if (controller.signal.aborted) return;
      if (response.status === 401) { startSignIn(); return; }
      if (!response.ok) throw new Error('Sign-in unavailable');
      const member = await response.json() as SessionDescriptor;
      if (!member.accountId || !member.email || !member.displayName || !Number.isSafeInteger(member.expiresAt)) throw new Error('Invalid session');
      if (!controller.signal.aborted && getSessionState().phase === 'loading') acceptSession(member, true);
    }).catch(() => { if (!controller.signal.aborted) setSessionPhase('error'); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (state.phase !== 'authenticated' || !state.member) return;
    let timer: number;
    const check = () => {
      const remaining = state.member!.expiresAt - Date.now();
      if (remaining <= 0) void interruptSession();
      else timer = window.setTimeout(check, Math.min(remaining, 2147483647));
    };
    check(); return () => window.clearTimeout(timer);
  }, [state.phase, state.member]);
  const interrupted = ['preserving', 'auth-paused', 'preservation-failed'].includes(state.phase);
  useEffect(() => {
    if (interrupted && dialog.current) {
      if (!dialog.current.open) dialog.current.showModal();
      (dialog.current.querySelector('button:not(:disabled)') as HTMLButtonElement | null)?.focus();
    }
  }, [interrupted, state.phase]);
  const signOut = () => interruptSession('logout');
  const content = <>
    <h1 id="session-heading">{state.phase === 'signed-out' ? "You're signed out of Dalí" : interrupted ? 'Session expired — sign in to continue.' : "We couldn't sign you in."}</h1>
    {interrupted && state.member && recoveryBoard(state.member.accountId) && <p className="session-recovery__account">{state.member.email}</p>}
    {state.phase === 'preserving' ? <p role="status">Securing pending changes…</p> : state.phase === 'preservation-failed' ? <p role="alert">Pending changes could not be secured for sign-in. Keep this tab open and retry preservation.</p> : <p role={state.phase === 'error' ? 'alert' : undefined}>{state.phase === 'signed-out' ? 'Your Dalí session has ended.' : interrupted ? 'Editing is paused. Pending changes are kept for this account while you sign in.' : 'Try signing in again.'}</p>}
    {state.phase === 'preservation-failed' ? <button className="djai-primary" onClick={() => { void interruptSession(state.intent); }}>Retry preservation</button> : <button className="djai-primary" disabled={state.phase === 'preserving'} onClick={startSignIn}>{interrupted ? 'Sign in to continue' : 'Sign in again'}</button>}
  </>;
  return <>
    {state.member && ['authenticated', 'preserving', 'preservation-failed'].includes(state.phase) && <div hidden={interrupted} style={interrupted ? { display: 'none' } : { display: 'contents' }}>{children(state.member, signOut)}</div>}
    {state.phase === 'authenticated' && state.notice && <p className="session-recovery__notice" role="status">{state.notice}</p>}
    {interrupted ? <dialog ref={dialog} className="session-recovery" aria-labelledby="session-heading" onCancel={event => event.preventDefault()} onKeyDown={event => {
      if (event.key !== 'Tab' || event.nativeEvent.isComposing) return;
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]')];
      const first = controls[0]; const last = controls.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}>{content}</dialog> : state.phase !== 'authenticated' && <main className="session-recovery">{['loading', 'recovering'].includes(state.phase) ? <p role="status">{state.phase === 'loading' ? 'Signing you in…' : 'Checking your account and board access…'}</p> : state.phase === 'identity-changed' ? <><p role="alert">You're signed in with a different account. Return to your boards or sign in with the previous account to recover its pending changes.</p><button onClick={openCurrentBoards}>Back to your boards</button><button onClick={() => { void signOut(); }}>Sign out of Dalí</button></> : content}</main>}
  </>;
}
