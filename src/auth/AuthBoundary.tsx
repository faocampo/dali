import { useEffect, useState, type ReactNode } from 'react';
export type SessionDescriptor = { accountId: string; displayName: string; email: string; expiresAt: number };
const start = () => window.location.assign(`/auth/start?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`);
export function AuthBoundary({ children }: { children: (session: SessionDescriptor, signOut: () => Promise<void>) => ReactNode }) {
  const [member, setMember] = useState<SessionDescriptor | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'signed-out' | 'error' | 'expired'>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.has('signedOut') ? 'signed-out' : params.has('authError') ? 'error' : 'loading';
  });
  useEffect(() => {
    if (state !== 'loading') return;
    const controller = new AbortController();
    void fetch('/api/session', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal }).then(async response => {
      if (controller.signal.aborted) return;
      if (response.status === 401) { start(); return; }
      if (!response.ok) throw new Error('Sign-in unavailable');
      const data = await response.json() as SessionDescriptor;
      if (!data.accountId || !data.email || !data.displayName || !Number.isSafeInteger(data.expiresAt)) throw new Error('Invalid session');
      if (!controller.signal.aborted) { setMember(data); setState('ready'); }
    }).catch(() => { if (!controller.signal.aborted) setState('error'); });
    return () => controller.abort();
  }, [state]);
  useEffect(() => {
    if (state !== 'ready' || !member) return;
    const timer = window.setTimeout(() => { setMember(null); setState('expired'); }, Math.min(Math.max(member.expiresAt - Date.now(), 0), 2147483647));
    return () => window.clearTimeout(timer);
  }, [state, member]);
  const signOut = async () => {
    if (!member) return;
    const response = await fetch('/auth/logout', { method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-Dali-Request': '1', 'X-Dali-Account': member.accountId }, body: '{}' });
    if (!response.ok) { setMember(null); setState('error'); return; }
    setMember(null); setState('signed-out'); window.history.replaceState(null, '', '/?signedOut=1');
  };
  if (state === 'ready' && member) return children(member, signOut);
  return <main className="djai-loading" style={{ padding: 24, gap: 16, flexDirection: 'column', textAlign: 'center' }}>
    {state === 'loading' ? <p role="status">Signing you in…</p> : <>
      <h1 style={{ fontSize: 20 }}>{state === 'signed-out' ? "You're signed out of Dalí" : state === 'expired' ? 'Session expired — sign in to continue.' : "We couldn't sign you in."}</h1>
      <p role={state === 'error' ? 'alert' : undefined}>{state === 'signed-out' ? 'Your Dalí session has ended.' : state === 'error' ? 'Try signing in again.' : 'Sign in to continue.'}</p>
      <button className="djai-button" style={{ minHeight: 44 }} onClick={start}>{state === 'expired' ? 'Sign in to continue' : 'Sign in again'}</button>
    </>}
  </main>;
}
