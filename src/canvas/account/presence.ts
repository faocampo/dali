import type { EditorHost } from '@blocksuite/affine/std';
import { GfxControllerIdentifier } from '@blocksuite/affine/std/gfx';
import type { PresenceParticipant } from '../../../server/boards/presence';
import type { CanvasRuntime } from '../runtime';
export type PresenceView = { boardId: string; accountId: string; state: 'loading' | 'ready' | 'error'; participants: PresenceParticipant[]; retry: () => void };
let current: PresenceView | null = null;
let owner: symbol | undefined;
const listeners = new Set<() => void>();
export const getPresence = () => current;
export const subscribePresence = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const participantColor = (id: string) => ['#6840e8', '#34704c', '#865900', '#b12d52'][Array.from(id).reduce((sum, char) => sum + char.charCodeAt(0), 0) % 4]!;
const publish = (value: PresenceView | null) => { current = value; listeners.forEach(listener => listener()); };

export function installPresence(host: EditorHost, runtime: CanvasRuntime) {
  const live = runtime.workspace.live; if (!live) return () => {};
  const key = Symbol('presence'); owner = key;
  const gfx = host.std.get(GfxControllerIdentifier);
  const overlay = document.createElement('div'); overlay.className = 'participant-overlays'; overlay.setAttribute('aria-hidden', 'true');
  host.parentElement?.append(overlay);
  let cursor: { x: number; y: number } | null = null;
  let mouse = { x: -1000, y: -1000 }; let sending = false; let queued = false; let stopped = false;
  const seen = new Map<string, { sequence: number; at: number }>();
  const send = async () => {
    queued = true; if (sending || stopped) return;
    sending = true; queued = false;
    try { await live.updatePresence({ cursor, selection: gfx.selection.selectedElements.map(model => model.id).slice(0, 128) }); }
    finally { sending = false; }
  };
  const render = () => {
    if (stopped) return;
    const rect = host.getBoundingClientRect(); const parent = overlay.getBoundingClientRect();
    const nodes: HTMLElement[] = [];
    for (const person of live.presenceState.participants) {
      if (person.accountId === runtime.scope.accountId || person.role === 'viewer') continue;
      const color = participantColor(person.accountId);
      for (const id of person.selection) {
        const model = gfx.getElementById(id); if (!model || !('elementBound' in model)) continue;
        const bound = model.elementBound; const [x, y] = gfx.viewport.toViewCoord(bound.x, bound.y);
        const selection = document.createElement('div'); selection.className = 'participant-selection';
        Object.assign(selection.style, { left: `${x + rect.left - parent.left}px`, top: `${y + rect.top - parent.top}px`, width: `${bound.w * gfx.viewport.zoom}px`, height: `${bound.h * gfx.viewport.zoom}px`, borderColor: color, opacity: person.idle ? '.5' : '1' });
        nodes.push(selection);
      }
      if (!person.cursor) continue;
      const [x, y] = gfx.viewport.toViewCoord(person.cursor.x, person.cursor.y);
      const previous = seen.get(person.accountId);
      if (!previous || previous.sequence !== person.activity) seen.set(person.accountId, { sequence: person.activity, at: Date.now() });
      const item = document.createElement('div'); item.className = 'participant-cursor';
      Object.assign(item.style, { left: `${x + rect.left - parent.left}px`, top: `${y + rect.top - parent.top}px`, color });
      const marker = document.createElement('span'); marker.className = 'participant-cursor__marker'; marker.textContent = '➤'; marker.style.opacity = person.idle ? '.5' : '1';
      const name = document.createElement('span'); name.className = 'participant-cursor__name'; name.textContent = person.name; name.style.borderColor = color;
      name.style.opacity = Date.now() - seen.get(person.accountId)!.at < 3000 || Math.hypot(mouse.x - x - rect.left, mouse.y - y - rect.top) < 28 ? '1' : '0';
      name.style.maxWidth = `${Math.max(80, Math.min(220, rect.width - 24))}px`;
      name.style.transform = `translate(${Math.max(-x, Math.min(12, rect.width - x - 232))}px,${y > rect.height - 48 ? -32 : 12}px)`;
      item.append(marker, name); nodes.push(item);
    }
    overlay.replaceChildren(...nodes);
  };
  const refresh = () => {
    if (owner !== key || stopped) return;
    publish({ boardId: runtime.scope.boardId, accountId: runtime.scope.accountId, ...live.presenceState, retry: () => { void send(); } }); render();
  };
  const pointer = (event: PointerEvent) => {
    mouse = { x: event.clientX, y: event.clientY };
    const [x, y] = gfx.viewport.toModelCoordFromClientCoord([event.clientX, event.clientY]); cursor = { x, y }; queued = true; render();
  };
  const leave = () => { cursor = null; queued = true; };
  const activity = () => { queued = true; };
  host.addEventListener('pointermove', pointer, true); host.addEventListener('pointerleave', leave); host.addEventListener('keydown', activity, true);
  const selection = gfx.selection.slots.updated.subscribe(activity);
  const viewport = gfx.viewport.viewportUpdated.subscribe(render);
  const unsubscribe = live.subscribePresence(refresh);
  const timer = setInterval(() => { if (queued) void send(); render(); }, 100);
  refresh();
  return () => {
    stopped = true; clearInterval(timer); unsubscribe(); selection.unsubscribe(); viewport.unsubscribe(); overlay.remove();
    host.removeEventListener('pointermove', pointer, true); host.removeEventListener('pointerleave', leave); host.removeEventListener('keydown', activity, true);
    if (owner === key) { owner = undefined; publish(null); }
  };
}
