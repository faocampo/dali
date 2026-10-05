import { nativeReservationTargets } from '../../../server/boards/change-footprint';
import { ClipboardEventState, UIEventStateContext, type EditorHost } from '@blocksuite/affine/std';
import { EdgelessClipboardController } from '@blocksuite/affine/blocks/root';
import { GfxControllerIdentifier } from '@blocksuite/affine/std/gfx';
import type { CanvasRuntime } from '../runtime';
import { historyReservationTargets, trackHistoryFootprints } from './history-footprint';
import { installDeferredCreation } from './deferred-creation';

type ReservationAction = <T>(ids: string[], create: boolean, operation: () => T | Promise<T>) => Promise<T>;
const actions = new WeakMap<EditorHost, ReservationAction>();
export async function withCanvasReservation<T>(host: EditorHost, ids: string[], create: boolean, operation: () => T | Promise<T>): Promise<T> {
  const action = actions.get(host);
  return action ? action(ids, create, operation) : operation();
}

/** Acquire before replaying native input; a denial never queues a later action. */
export function installLiveShapeGesture(host: EditorHost, runtime: CanvasRuntime) {
  const live = runtime.workspace.live;
  if (!live || host.store.readonly) return () => {};
  const gfx = host.std.get(GfxControllerIdentifier);
  const history = host.store.history.undoManager;
  const disposeHistoryFootprints = trackHistoryFootprints(host.store.spaceDoc, history);
  let token: string | undefined;
  let replay = false; let disposed = false; let finishing = false; let textSession = false;
  let pointerId: number | undefined;
  let pending: PointerEvent[] | undefined;
  let pendingAction = false;
  let releaseWork: Promise<void> | undefined;
  let queuedAction = false;
  const pointerTargets = new WeakMap<PointerEvent, EventTarget>();
  const status = document.createElement('div'); status.setAttribute('role', 'status');
  status.style.cssText = 'position:absolute;bottom:16px;right:16px;z-index:10;background:var(--color-surface,#fff);color:var(--color-text,#211830);padding:8px 12px;border-radius:8px;max-width:min(320px,calc(100% - 32px));overflow-wrap:anywhere;';
  status.hidden = true; host.parentElement?.append(status);
  const message = (text: string, ids?: string[]) => {
    status.textContent = text; status.hidden = !text;
    Object.assign(status.style, { top: '', left: '', bottom: '16px', right: '16px' });
    const model = ids?.length ? gfx.getElementById(ids[0]!) : undefined;
    if (model && 'elementBound' in model && status.parentElement) {
      const bound = model.elementBound;
      const [x, y] = gfx.viewport.toViewCoord(bound.x, bound.y + bound.h);
      const parent = status.parentElement.getBoundingClientRect(); const canvas = host.getBoundingClientRect();
      Object.assign(status.style, { bottom: 'auto', right: 'auto',
        left: `${Math.max(8, Math.min(x + canvas.left - parent.left, parent.width - status.offsetWidth - 8))}px`,
        top: `${Math.max(8, Math.min(y + canvas.top - parent.top + 12, parent.height - status.offsetHeight - 8))}px` });
    }
  };
  const stop = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); };
  const send = (event: PointerEvent) => {
    replay = true;
    try {
      const original = pointerTargets.get(event);
      const target = original instanceof Element && original.isConnected ? original : host;
      target.dispatchEvent(new PointerEvent(event.type, { bubbles: true, composed: true, cancelable: true,
        pointerId: event.pointerId, pointerType: event.pointerType, isPrimary: event.isPrimary, button: event.button, buttons: event.buttons,
        clientX: event.clientX, clientY: event.clientY, detail: event.detail, shiftKey: event.shiftKey, altKey: event.altKey, ctrlKey: event.ctrlKey, metaKey: event.metaKey }));
    } finally { replay = false; }
  };
  const release = () => {
    if (!token || finishing) return;
    finishing = true; textSession = false; const held = token;
    releaseWork = runtime.workspace.waitForSynced().then(() => live.release(held)).then(() => { if (token === held) token = undefined; }).catch(() => {
      if (!disposed) message('Changes are waiting to save. Keep this board open.');
    }).finally(() => { finishing = false; releaseWork = undefined; });
  };
  const finished = () => {
    pointerId = undefined;
    if (gfx.selection.editing) { textSession = true; return; }
    release();
  };
  const buffer = (event: PointerEvent) => {
    if (!pending) return;
    const target = event.composedPath()[0];
    if (target) pointerTargets.set(event, target);
    stop(event);
    if (event.type === 'pointermove' && pending.at(-1)?.type === 'pointermove') pending[pending.length - 1] = event;
    else if (pending.length < 64) pending.push(event);
    else { pending = undefined; pointerId = undefined; message('Please try the action again.'); }
  };
  const start = (event: PointerEvent) => {
    if (replay || event.button !== 0 || host.store.readonly) return;
    const tool = gfx.tool.currentToolName$.peek();
    const creating = ['shape', 'dali-shape', 'text', 'brush', 'frame'].includes(tool);
    if (tool !== 'default' && !creating) return;
    if (pending) { buffer(event); return; }
    if (textSession && token) return;
    if (event.composedPath().some(node => node instanceof Element && node.matches('editor-toolbar,editor-menu-content,input,textarea,button'))) return;
    if (finishing || pendingAction) { stop(event); return; }
    const point = gfx.viewport.toModelCoordFromClientCoord([event.clientX, event.clientY]);
    const hit = gfx.getElementByPoint(...point);
    const selected = gfx.selection.selectedElements;
    const handle = event.composedPath().some(node => node instanceof Element && node.matches('.handle .resize, .handle .rotate'));
    if (!hit && !creating && !(handle && selected.length)) return;
    const models = creating ? [] : handle || selected.some(model => model.id === hit?.id) ? selected : [hit!];
    const targets = nativeReservationTargets(host.store.spaceDoc, models.map(model => model.id));
    if (!targets) return;
    if (creating) targets.push(live.creationScope);
    const target = event.composedPath()[0];
    if (target) pointerTargets.set(event, target);
    stop(event); pointerId = event.pointerId; const events = [event]; pending = events;
    message('Waiting for editing access');
    void live.acquire(targets).then(async acquired => {
      if (disposed || pending !== events) { await live.release(acquired); return; }
      pending = undefined; token = acquired; message('');
      for (const input of events) send(input);
      if (events.at(-1)?.type === 'pointerup' || events.at(-1)?.type === 'pointercancel') finished();
    }).catch((error: unknown) => {
      if (disposed || pending !== events) return;
      pending = undefined; pointerId = undefined;
      gfx.selection.set({ elements: models.map(model => model.id), editing: false });
      if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'OBJECT_RESERVED') { message('Editing access could not be checked. Try again.'); return; }
      const name = error && typeof error === 'object' && 'editor' in error && typeof error.editor === 'string' ? error.editor : 'Another participant';
      message(`${name} is editing this object. You can edit it when they finish.`, models.map(model => model.id));
    });
  };
  const cancelPendingGesture = () => {
    if (!pending) return;
    pending = undefined; pointerId = undefined; message('');
    // The acquire callback still owns its response and releases a late token.
  };
  const cancelKey = (event: KeyboardEvent) => { if (event.key === 'Escape') cancelPendingGesture(); };
  const move = (event: PointerEvent) => { if (!replay && pending) buffer(event); };
  const captureEnd = (event: PointerEvent) => { if (!replay && pending && event.pointerId === pointerId) { if (event.type === 'pointercancel') { stop(event); cancelPendingGesture(); } else buffer(event); } };
  const end = (event: PointerEvent) => { if (!replay && token && event.pointerId === pointerId) finished(); };
  const selection = gfx.selection.slots.updated.subscribe(() => { if (textSession && !gfx.selection.editing) release(); });
  const blur = () => {
    if (!textSession) return;
    // Focus events cross nested shadow roots with a retargeted relatedTarget.
    // Inspect the settled focused editor before ending its text reservation.
    queueMicrotask(() => {
      let target = document.activeElement;
      while (target?.shadowRoot?.activeElement) target = target.shadowRoot.activeElement;
      if (target instanceof HTMLElement && target.isContentEditable) {
        let node: Node | null = target;
        while (node) {
          if (node === host) return;
          node = node.parentNode ?? (node instanceof ShadowRoot ? node.host : null);
        }
      }
      release();
    });
  };
  const copyEvent = (event: Event): Event => {
    const common = { bubbles: true, composed: true, cancelable: true };
    return event instanceof KeyboardEvent ? new KeyboardEvent(event.type, { ...common, key: event.key, code: event.code, ctrlKey: event.ctrlKey, metaKey: event.metaKey, shiftKey: event.shiftKey, altKey: event.altKey })
      : event instanceof CustomEvent ? new CustomEvent(event.type, { ...common, detail: event.detail })
      : event instanceof MouseEvent ? new MouseEvent(event.type, { ...common, clientX: event.clientX, clientY: event.clientY, button: event.button, buttons: event.buttons }) : new Event(event.type, common);
  };
  const action = (event: Event) => {
    if (replay || host.store.readonly) return;
    const path = event.composedPath();
    const nativeButton = path.find(node => node instanceof HTMLElement && node.matches('editor-menu-action[data-testid],editor-icon-button[data-testid]')) as HTMLElement | undefined;
    const nativeAction = nativeButton?.dataset.testid;
    if (event.type === 'click' && nativeAction === 'copy') return;
    if (event.type === 'click' && nativeAction === 'duplicate') {
      stop(event);
      void import('../arrangement').then(actions => actions.duplicateCanvasSelection(host)).catch(error => {
        if (!disposed) message(error instanceof Error ? error.message : 'The copy could not be created. Try again.');
      });
      return;
    }
    const createsContainer = ['create-frame', 'add-frame', 'create-group', 'add-group'].includes(nativeAction ?? '') ||
      (nativeAction === 'lock' && gfx.selection.selectedElements.length > 1);
    if (event.type === 'click' && nativeButton && createsContainer) {
      stop(event);
      const ids = gfx.selection.selectedElements.map(model => model.id).sort();
      void withCanvasReservation(host, ids, true, () => {
        if (!nativeButton.isConnected || JSON.stringify(gfx.selection.selectedElements.map(model => model.id).sort()) !== JSON.stringify(ids)) throw new Error('Selection changed. Try the action again.');
        replay = true;
        try { nativeButton.dispatchEvent(copyEvent(event)); }
        finally { replay = false; }
      }).catch(() => {});
      return;
    }
    const field = path[0] instanceof HTMLInputElement || path[0] instanceof HTMLSelectElement ? path[0] : undefined;
    // Opening/focusing a field is navigation. Dali typography commits on
    // change; taking a lease on its preceding input would drop that commit.
    if (event.type === 'click' && field) return;
    if (event.type === 'input' && field && (field instanceof HTMLSelectElement || field.matches('.dali-font-size'))) return;
    const fieldValue = field && ['input', 'change'].includes(event.type) ? field.value : undefined;
    const redispatch = (target: Element) => {
      if (field && fieldValue !== undefined) field.value = fieldValue;
      target.dispatchEvent(copyEvent(event));
    };
    const keyboard = event instanceof KeyboardEvent;
    if (keyboard) {
      const target = path[0];
      if (target instanceof HTMLElement && (target.isContentEditable || target.matches('input,textarea,select'))) return;
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && ['z', 'y'].includes(event.key.toLowerCase())) return; // Native history dispatch derives its own targets below.
      if (!['Backspace', 'Delete', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) && !(modifier && ['b', 'i', 'u', 'z', 'y'].includes(event.key.toLowerCase()))) return;
    } else if (!path.some(node => node instanceof Element && node.matches('editor-toolbar,editor-menu-content'))) return;
    // Menu disclosure is navigation. Acquire for the selected action instead;
    // replaying disclosure after its native pointer handler can close the menu.
    if (event.type === 'click' && path.some(node => node instanceof Element && node.matches('editor-menu-button')) &&
        !path.some(node => node instanceof Element && node.matches('editor-menu-content'))) return;
    const models = gfx.selection.selectedElements;
    if (!models.length) return;
    const ids = nativeReservationTargets(host.store.spaceDoc, models.map(model => model.id), (keyboard && ['Backspace', 'Delete'].includes(event.key)) || nativeAction === 'release-from-group');
    if (!ids) { stop(event); message('This action is not yet available during live editing.'); return; }
    if (finishing && releaseWork) {
      stop(event);
      if (queuedAction) return;
      const target = path[0]; queuedAction = true;
      void releaseWork.then(() => {
        if (!disposed && !token && target instanceof Element && target.isConnected) redispatch(target);
      }).finally(() => { queuedAction = false; });
      return;
    }
    if (pending || pendingAction) { stop(event); message('Waiting for editing access'); return; }
    if (token && ids.every(id => live.allowsObject(id))) return;
    stop(event); pendingAction = true; message('Waiting for editing access');
    const target = path[0];
    void live.acquire(ids).then(async acquired => {
      if (disposed || !(target instanceof Element) || !target.isConnected) { await live.release(acquired); return; }
      token = acquired; message(''); replay = true;
      try {
        redispatch(target);
      } finally { replay = false; }
      // Native command chains may finish in promise microtasks after dispatch.
      // Release from the next task, then wait for the resulting document write.
      if (gfx.selection.editing) textSession = true; else setTimeout(() => { if (!disposed) release(); }, 0);
    }).catch((error: unknown) => {
      const editor = error && typeof error === 'object' && 'editor' in error ? error.editor : undefined;
      message(typeof editor === 'string' ? `${editor} is editing this object. You can edit it when they finish.` : 'Editing access could not be checked. Try again.', ids);
    }).finally(() => { pendingAction = false; });
  };
  actions.set(host, async (ids, create, operation) => {
    if (releaseWork) await releaseWork;
    if (disposed || host.store.readonly || !live.connected) throw new Error('Editing access is unavailable.');
    if (pending || pendingAction || finishing || token) throw new Error('Finish the current editing action and try again.');
    const required = nativeReservationTargets(host.store.spaceDoc, ids.filter(id => id !== '$dali:metadata'), true);
    if (!required) throw new Error('This action is not yet available during live editing.');
    if (ids.includes('$dali:metadata')) required.push('$dali:metadata');
    if (create) required.push(live.creationScope);
    pendingAction = true; message('Waiting for editing access');
    let acquired: string | undefined;
    try {
      acquired = await live.acquire(required);
      if (disposed || host.store.readonly || !live.connected) throw new Error('Editing access changed.');
      token = acquired; message('');
      const result = await operation();
      await runtime.workspace.waitForSynced();
      return result;
    } catch (error) {
      const editor = error && typeof error === 'object' && 'editor' in error ? error.editor : undefined;
      const explanation = typeof editor === 'string' ? `${editor} is editing this object. You can edit it when they finish.`
        : error instanceof Error ? error.message : 'The action could not be completed. Try again.';
      if (!disposed) message(explanation, ids);
      throw new Error(explanation, { cause: error });
    } finally {
      try { if (acquired) await live.release(acquired); }
      finally {
        if (token === acquired) token = undefined;
        pendingAction = false;
      }
    }
  });
  const nativeUndo = host.store.undo; const nativeRedo = host.store.redo;
  let historyPending = false;
  let queuedHistory: 'undo' | 'redo' | undefined;
  const runHistory = async (direction: 'undo' | 'redo') => {
    if (host.store.readonly || disposed) return;
    // Keep one explicit next history action while the prior acknowledged
    // mutation releases its lease. Never replay the denied action itself.
    if (historyPending) { queuedHistory ??= direction; return; }
    historyPending = true;
    try {
      if (textSession) release();
      if (releaseWork) await releaseWork;
      const stack = direction === 'undo' ? history.undoStack : history.redoStack;
      const item = stack.at(-1);
      if (!item) return;
      const targets = historyReservationTargets(host.store.spaceDoc, item);
      if (!targets) { message('This history action is unavailable. Your current canvas is unchanged.'); return; }
      await withCanvasReservation(host, targets.ids, targets.create, () => {
        if (stack.at(-1) !== item) throw new Error('History changed. Try the action again.');
        (direction === 'undo' ? nativeUndo : nativeRedo).call(host.store);
      });
    } catch { /* The reservation helper presents the failed action. */ }
    finally {
      historyPending = false;
      const next = queuedHistory; queuedHistory = undefined;
      if (next && !disposed) void runHistory(next);
    }
  };
  host.store.undo = () => { void runHistory('undo'); };
  host.store.redo = () => { void runHistory('redo'); };
  // Pinned native clipboard handlers are asynchronous. Keep the lease through
  // their returned promise rather than releasing after DOM event dispatch.
  const clipboard = host.std.getOptional(EdgelessClipboardController) as unknown as {
    _onPaste: (context: UIEventStateContext) => Promise<void>;
    _onCut: (context: UIEventStateContext) => Promise<void>;
  } | undefined;
  const nativePaste = clipboard?._onPaste;
  if (clipboard && typeof nativePaste === 'function') clipboard._onPaste = async context => {
    if (gfx.selection.editing || document.activeElement?.matches('input,textarea')) return nativePaste(context);
    const raw = context.get('clipboardState').raw;
    raw.preventDefault();
    const data = new DataTransfer();
    for (const type of raw.clipboardData?.types ?? []) {
      if (type !== 'Files') data.setData(type, raw.clipboardData!.getData(type));
    }
    for (const file of raw.clipboardData?.files ?? []) data.items.add(file);
    const copied = UIEventStateContext.from(new ClipboardEventState({ event: new ClipboardEvent('paste', { clipboardData: data }) }));
    try { await withCanvasReservation(host, [], true, () => nativePaste(copied)); }
    catch { /* Reservation helper presents the failure without losing clipboard data. */ }
  };
  const nativeCut = clipboard?._onCut;
  if (clipboard && typeof nativeCut === 'function') clipboard._onCut = async context => {
    if (gfx.selection.editing || document.activeElement?.matches('input,textarea')) return nativeCut(context);
    context.get('clipboardState').raw.preventDefault();
    const ids = [...gfx.selection.selectedElements].map(model => model.id).sort();
    if (!ids.length) return;
    try {
      await withCanvasReservation(host, ids, false, async () => {
        if (JSON.stringify(gfx.selection.selectedElements.map(model => model.id).sort()) !== JSON.stringify(ids)) throw new Error('Selection changed. Try cutting again.');
        await nativeCut(context);
      });
    } catch { /* The reservation helper presents the failure; selection remains intact. */ }
  };
  const actionEvents = ['click', 'input', 'change', 'select', 'pickFillColor', 'pickStrokeColor'] as const;
  const disposeDeferred = installDeferredCreation(host, {
    replaying: () => replay,
    busy: () => !!(pending || pendingAction || finishing || token),
    message,
    run: (ids, create, operation) => withCanvasReservation(host, ids, create, operation),
    replay: events => { for (const { event, target } of events) { if (target) pointerTargets.set(event, target); send(event); } },
  });
  actionEvents.forEach(name => host.addEventListener(name, action, true));
  document.addEventListener('keydown', action, true);
  document.addEventListener('keydown', cancelKey, true);
  host.addEventListener('pointerdown', start, true); host.addEventListener('pointermove', move, true);
  window.addEventListener('pointerup', captureEnd, true); window.addEventListener('pointercancel', captureEnd, true);
  window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end); host.addEventListener('focusout', blur);
  return () => {
    disposed = true; pending = undefined; status.remove(); selection.unsubscribe(); actions.delete(host);
    disposeHistoryFootprints(); host.store.undo = nativeUndo; host.store.redo = nativeRedo;
    disposeDeferred();
    if (clipboard && nativePaste) clipboard._onPaste = nativePaste;
    if (clipboard && nativeCut) clipboard._onCut = nativeCut;
    actionEvents.forEach(name => host.removeEventListener(name, action, true)); document.removeEventListener('keydown', action, true);
    document.removeEventListener('keydown', cancelKey, true);
    host.removeEventListener('pointerdown', start, true); host.removeEventListener('pointermove', move, true);
    window.removeEventListener('pointerup', captureEnd, true); window.removeEventListener('pointercancel', captureEnd, true);
    window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); host.removeEventListener('focusout', blur);
    if (token) void live.release(token).catch(() => {});
  };
}
