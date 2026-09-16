import { getActiveAccessScope, getRecoveryBoard, preserveCanvasRuntime, suspendAccessScope } from '../canvas/runtime';
export type SessionDescriptor = { accountId: string; displayName: string; email: string; expiresAt: number };
export type SessionPhase = 'loading' | 'authenticated' | 'preserving' | 'auth-paused' | 'preservation-failed' | 'recovering' | 'access-denied' | 'identity-changed' | 'signed-out' | 'error';
export type SessionState = { phase: SessionPhase; member: SessionDescriptor | null; intent: 'expiry' | 'logout'; revision: number };
let state: SessionState = { phase: 'loading', member: null, intent: 'expiry', revision: 0 };
const listeners = new Set<() => void>();
let preservation: Promise<void> | undefined;
let transition = 0;
export const getSessionState = () => state;
export const subscribeSession = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
function set(value: Partial<SessionState>) { state = { ...state, ...value }; listeners.forEach(listener => listener()); }
export function acceptSession(member: SessionDescriptor, broadcast = false) {
  const previous = sessionStorage.getItem('dali-recovery-account');
  set({ member, intent: 'expiry', phase: previous && previous !== member.accountId ? 'identity-changed' : 'authenticated', revision: state.revision + 1 });
  if (broadcast) {
    try {
      const last = localStorage.getItem('dali-last-account'); localStorage.setItem('dali-last-account', member.accountId);
      if (last && last !== member.accountId) signalTabs('changed');
    } catch { signalTabs('changed'); }
  }
}
export function recoveryBoard(accountId: string): { boardId: string; title: string } | null {
  try { const value = JSON.parse(sessionStorage.getItem('dali-recovery-board') ?? 'null'); return value?.accountId === accountId && typeof value.boardId === 'string' && typeof value.title === 'string' ? value : null; } catch { return null; }
}
function rememberRecovery() {
  if (state.member) sessionStorage.setItem('dali-recovery-account', state.member.accountId);
  const board = getRecoveryBoard(); if (board) sessionStorage.setItem('dali-recovery-board', JSON.stringify(board));
}
export function openCurrentBoards() {
  sessionStorage.removeItem('dali-recovery-account'); sessionStorage.removeItem('dali-recovery-board');
  window.location.assign('/');
}
export function setSessionPhase(phase: SessionPhase) { set({ phase }); }
export async function interruptSession(intent: 'expiry' | 'logout' = 'expiry') {
  if (intent === 'logout') { transition++; set({ intent }); }
  if (preservation) return preservation;
  transition++;
  suspendAccessScope(intent);
  set({ phase: 'preserving', intent: state.intent === 'logout' ? 'logout' : intent });
  preservation = (async () => {
    try {
      rememberRecovery();
      await preserveCanvasRuntime();
      if (state.intent === 'logout') {
        const response = await fetch('/api/logout', { method: 'POST', credentials: 'same-origin', headers: { 'X-Dali-Account': state.member?.accountId ?? '', 'X-Dali-Request': '1', 'Content-Type': 'application/json' }, body: '{}' });
        if (!response.ok && response.status !== 401) throw new Error('Sign-out unavailable');
        window.history.replaceState(null, '', '/?signedOut=1'); set({ member: null, phase: 'signed-out' });
        signalTabs('signed-out');
      } else set({ phase: 'auth-paused' });
    } catch { set({ phase: 'preservation-failed' }); }
    finally { preservation = undefined; }
  })();
  return preservation;
}
let revalidating: Promise<void> | undefined;
export async function revalidateSession() {
  if (revalidating || state.intent === 'logout' || state.phase === 'signed-out') return revalidating;
  const expectedTransition = ++transition;
  suspendAccessScope('revalidate'); set({ phase: 'preserving' });
  revalidating = (async () => {
    try {
      rememberRecovery();
      await preserveCanvasRuntime(); set({ phase: 'recovering' });
      const expected = state.member?.accountId;
      let response = await fetch('/api/session', { cache: 'no-store', headers: expected ? { 'X-Dali-Account': expected } : {} });
      if (response.status === 409) response = await fetch('/api/session', { cache: 'no-store' });
      if (expectedTransition !== transition || state.intent === 'logout' || state.phase === 'signed-out') return;
      if (response.status === 401) { set({ phase: 'auth-paused' }); return; }
      if (!response.ok) throw new Error('Session unavailable');
      const member: SessionDescriptor = await response.json();
      if (expectedTransition !== transition) return;
      if (!member.accountId || !member.email || !member.displayName || !Number.isSafeInteger(member.expiresAt) || member.expiresAt <= Date.now()) throw new Error('Session unavailable');
      acceptSession(member);
    } catch { if (expectedTransition === transition) set({ phase: 'preservation-failed' }); }
    finally { revalidating = undefined; }
  })(); return revalidating;
}
const signalKey = 'dali-session-signal';
let channel: BroadcastChannel | undefined;
function signalTabs(kind: 'changed' | 'signed-out') {
  const signal = { kind, id: crypto.randomUUID() };
  channel?.postMessage(signal);
  try { localStorage.setItem(signalKey, JSON.stringify(signal)); } catch { /* BroadcastChannel remains available when storage is disabled. */ }
}
export function watchSession() {
  const seen = new Set<string>();
  const receive = (value: unknown) => {
    if (!value || typeof value !== 'object' || !('id' in value) || typeof value.id !== 'string' || !('kind' in value) || !['changed', 'signed-out'].includes(String(value.kind)) || seen.has(value.id)) return;
    seen.add(value.id); if (seen.size > 100) seen.delete(seen.values().next().value!);
    if (value.kind === 'signed-out') {
      transition++;
      suspendAccessScope('other-tab-logout'); set({ phase: 'preserving', intent: 'logout' });
      void Promise.resolve().then(() => { rememberRecovery(); return preserveCanvasRuntime(); }).then(() => { window.history.replaceState(null, '', '/?signedOut=1'); set({ member: null, phase: 'signed-out' }); }, () => set({ phase: 'preservation-failed' }));
    } else void revalidateSession();
  };
  try { channel = new BroadcastChannel(signalKey); channel.onmessage = event => receive(event.data); } catch { channel = undefined; }
  const storage = (event: StorageEvent) => { if (event.key === signalKey && event.newValue) { try { receive(JSON.parse(event.newValue)); } catch { /* Ignore malformed untrusted state signals. */ } } };
  const pageshow = (event: PageTransitionEvent) => { if (event.persisted) void revalidateSession(); };
  const originalFetch = window.fetch;
  const guardedFetch: typeof fetch = async (input, init) => {
    const response = await originalFetch(input, init);
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
    if (url.origin === location.origin && url.pathname.startsWith('/api/') && !['/api/session', '/api/logout'].includes(url.pathname) && state.phase === 'authenticated') {
      if (response.status === 401) void interruptSession();
      else if (response.status === 409 && response.headers.get('Content-Type')?.includes('json')) {
        const body = await response.clone().json().catch(() => null); if (body?.code === 'IDENTITY_CHANGED') void revalidateSession();
      }
    }
    return response;
  };
  window.fetch = guardedFetch;
  const navigate = (event: MouseEvent) => {
    const link = event.composedPath().find(node => node instanceof HTMLAnchorElement) as HTMLAnchorElement | undefined;
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || link.target === '_blank' || link.hasAttribute('download') || getActiveAccessScope()?.phase !== 'active' || new URL(link.href).origin !== location.origin) return;
    event.preventDefault(); void preserveBeforeNavigation().then(ok => { if (ok) window.location.assign(link.href); });
  };
  window.addEventListener('storage', storage); window.addEventListener('pageshow', pageshow); document.addEventListener('click', navigate);
  return () => { channel?.close(); channel = undefined; window.removeEventListener('storage', storage); window.removeEventListener('pageshow', pageshow); document.removeEventListener('click', navigate); if (window.fetch === guardedFetch) window.fetch = originalFetch; };
}
export async function preserveBeforeNavigation() {
  suspendAccessScope('navigation');
  try { await preserveCanvasRuntime(); return true; } catch { await interruptSession(); return false; }
}
export function startSignIn() {
  if (['preserving', 'preservation-failed'].includes(state.phase)) return;
  window.location.assign(`/auth/start?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`);
}
