import { preserveCanvasRuntime, suspendAccessScope } from '../canvas/runtime';
export type SessionDescriptor = { accountId: string; displayName: string; email: string; expiresAt: number };
export type SessionPhase = 'loading' | 'authenticated' | 'preserving' | 'auth-paused' | 'preservation-failed' | 'recovering' | 'access-denied' | 'identity-changed' | 'signed-out' | 'error';
export type SessionState = { phase: SessionPhase; member: SessionDescriptor | null; intent: 'expiry' | 'logout'; revision: number };
let state: SessionState = { phase: 'loading', member: null, intent: 'expiry', revision: 0 };
const listeners = new Set<() => void>();
let preservation: Promise<void> | undefined;
export const getSessionState = () => state;
export const subscribeSession = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
function set(value: Partial<SessionState>) { state = { ...state, ...value }; listeners.forEach(listener => listener()); }
export function acceptSession(member: SessionDescriptor) { set({ member, phase: 'authenticated', revision: state.revision + 1 }); }
export function setSessionPhase(phase: SessionPhase) { set({ phase }); }
export async function interruptSession(intent: 'expiry' | 'logout' = 'expiry') {
  if (intent === 'logout') set({ intent });
  if (preservation) return preservation;
  suspendAccessScope(intent);
  set({ phase: 'preserving', intent: state.intent === 'logout' ? 'logout' : intent });
  preservation = (async () => {
    try {
      await preserveCanvasRuntime();
      if (state.member) sessionStorage.setItem('dali-recovery-account', state.member.accountId);
      if (state.intent === 'logout') {
        const response = await fetch('/api/logout', { method: 'POST', credentials: 'same-origin', headers: { 'X-Dali-Account': state.member?.accountId ?? '', 'X-Dali-Request': '1', 'Content-Type': 'application/json' }, body: '{}' });
        if (!response.ok && response.status !== 401) throw new Error('Sign-out unavailable');
        window.history.replaceState(null, '', '/?signedOut=1'); set({ member: null, phase: 'signed-out' });
      } else set({ phase: 'auth-paused' });
    } catch { set({ phase: 'preservation-failed' }); }
    finally { preservation = undefined; }
  })();
  return preservation;
}
export function startSignIn() {
  if (['preserving', 'preservation-failed'].includes(state.phase)) return;
  window.location.assign(`/auth/start?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`);
}
