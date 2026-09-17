import { getActiveAccessScope, getRecoveryBoard, preserveCanvasRuntime, suspendAccessScope } from '../canvas/runtime';
import type { BlockComponent, EditorHost } from '@blocksuite/affine/std';
import type { GfxController } from '@blocksuite/affine/std/gfx';
import type { ShapeElementModel } from '@blocksuite/affine/model';
import type { EdgelessShapeTextEditor } from '@blocksuite/affine/gfx/shape';
export type SessionDescriptor = { accountId: string; displayName: string; email: string; expiresAt: number };
export type SessionPhase = 'loading' | 'authenticated' | 'preserving' | 'auth-paused' | 'preservation-failed' | 'recovering' | 'access-denied' | 'identity-changed' | 'signed-out' | 'error';
export type SessionState = { phase: SessionPhase; member: SessionDescriptor | null; intent: 'expiry' | 'logout'; revision: number; notice: string };
let state: SessionState = { phase: 'loading', member: null, intent: 'expiry', revision: 0, notice: '' };
const listeners = new Set<() => void>();
let preservation: Promise<void> | undefined;
let transition = 0;
type FocusToken = { accountId: string; boardId: string; label?: string; tag?: string; elements: string[]; editing: boolean; range?: { index: number; length: number } };
let focusToken: FocusToken | undefined;
function captureFocus() {
  const scope = getActiveAccessScope(); if (scope?.phase !== 'active') return;
  let active = document.activeElement; while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  const root = document.querySelector('affine-edgeless-root') as (HTMLElement & { gfx: GfxController }) | null;
  const editor = document.querySelector<EdgelessShapeTextEditor>('edgeless-shape-text-editor');
  const native = editor?.inlineEditor?.getNativeRange();
  const range = native ? editor?.inlineEditor?.toInlineRange(native) : null;
  focusToken = { accountId: scope.accountId, boardId: scope.boardId, elements: root?.gfx.selection.selectedElements.map(element => element.id) ?? [],
    editing: !!editor, ...(range ? { range: { index: range.index, length: range.length } } : {}), label: active?.getAttribute('aria-label') ?? undefined, tag: active?.tagName.toLowerCase() };
}
export function restoreRecoveryFocus() {
  let token: FocusToken | null;
  try { token = JSON.parse(sessionStorage.getItem('dali-recovery-focus') ?? 'null'); } catch { return () => {}; }
  if (!token || token.accountId !== state.member?.accountId) return () => {};
  const captured = token; let stopped = false; let frame = 0; let restoring = false;
  const attempt = async () => {
    const scope = getActiveAccessScope();
    if (stopped || restoring || scope?.phase !== 'active' || !scope.canWrite || scope.accountId !== captured.accountId || scope.boardId !== captured.boardId) return;
    const host = document.querySelector<EditorHost>('editor-host');
    const root = host?.querySelector<BlockComponent & { gfx: GfxController }>('affine-edgeless-root');
    const mountPoint = root?.querySelector('.edgeless-mount-point');
    if (!host || !root || !mountPoint || host.store.readonly) return;
    restoring = true;
    try {
      const current = () => !stopped && getActiveAccessScope() === scope && host.isConnected && !host.store.readonly;
      if (captured.editing && captured.elements.length) {
        const { mountShapeTextEditor, EdgelessShapeTextEditor } = await import('@blocksuite/affine/gfx/shape');
        const shape = root.gfx.surface?.getElementById(captured.elements[0]!);
        if (!current()) return;
        if (shape?.type === 'shape') {
          root.gfx.viewport.setCenter(shape.x + shape.w / 2, shape.y + shape.h / 2);
          mountShapeTextEditor(shape as ShapeElementModel, root);
          // Native mounting appends synchronously; keep that instance through readiness.
          const editor = mountPoint.lastElementChild;
          if (editor instanceof EdgelessShapeTextEditor && editor.element.id === shape.id) {
            await editor.updateComplete;
            await editor.richText.updateComplete;
            await editor.inlineEditor?.waitForUpdate();
            if (!current() || !editor.isConnected) return;
            const range = captured.range;
            const inline = editor.inlineEditor;
            if (inline && range && Number.isSafeInteger(range.index) && Number.isSafeInteger(range.length) && range.index >= 0 && range.length >= 0 && range.index + range.length <= inline.yTextLength) {
              inline.setInlineRange(range);
              inline.syncInlineRange(range);
            }
          }
        }
      } else {
        const target = captured.label && captured.tag && /^[a-z-]+$/.test(captured.tag) ? document.querySelector<HTMLElement>(`${captured.tag}[aria-label="${CSS.escape(captured.label)}"]`) : null;
        if (!current()) return;
        if (target) target.focus();
        else { root.gfx.selection.set({ elements: captured.elements.filter(id => !!root.gfx.surface?.getElementById(id)), editing: false }); host.tabIndex = -1; host.focus(); }
      }
      if (!current()) return;
      // Rendering can queue another observer frame while this attempt awaits readiness.
      // Success is terminal, including callbacks already queued before disconnect.
      stopped = true; observer.disconnect(); cancelAnimationFrame(frame);
      sessionStorage.removeItem('dali-recovery-focus'); sessionStorage.removeItem('dali-recovery-account');
      set({ notice: 'Editing resumed.' });
    } finally { restoring = false; }
  };
  const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => { void attempt(); }); };
  const observer = new MutationObserver(schedule); observer.observe(document.documentElement, { childList: true, subtree: true }); schedule();
  return () => { stopped = true; observer.disconnect(); cancelAnimationFrame(frame); };
}
export const getSessionState = () => state;
export const subscribeSession = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
function set(value: Partial<SessionState>) { state = { ...state, ...value }; listeners.forEach(listener => listener()); }
export function acceptSession(member: SessionDescriptor, broadcast = false) {
  const previous = sessionStorage.getItem('dali-recovery-account');
  set({ member, intent: 'expiry', phase: previous && previous !== member.accountId ? 'identity-changed' : 'authenticated', revision: state.revision + 1, notice: '' });
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
  if (focusToken) sessionStorage.setItem('dali-recovery-focus', JSON.stringify(focusToken));
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
  captureFocus();
  suspendAccessScope(intent);
  set({ phase: 'preserving', notice: '', intent: state.intent === 'logout' ? 'logout' : intent });
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
  captureFocus();
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
