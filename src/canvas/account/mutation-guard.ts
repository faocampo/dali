import * as Y from 'yjs';
import type { Store } from '@blocksuite/affine/store';
import { getActiveAccessScope, subscribeAccessScope, type AccessScope } from '../runtime';
const guards = new WeakMap<Store, { references: number; release: () => void }>();

/** Captured authority never follows a new account, board, or runtime. */
export function accessScopeCurrent(expected: AccessScope, write = false): boolean {
  const current = getActiveAccessScope();
  return current?.phase === 'active' && current.accountId === expected.accountId &&
    current.boardId === expected.boardId && current.generation === expected.generation &&
    (!write || (current.canWrite && current.role !== 'viewer'));
}

/**
 * Pinned native model setters write directly to nested Y types. Guard the local
 * mutation methods on this document's instances, including types added later.
 * Applying authorized remote Yjs updates uses integration internals, so hydration
 * remains possible. No rollback transaction or global prototype changes occur.
 */
export function installMutationGuard(store: Store, scope: AccessScope): () => void {
  const existing = guards.get(store);
  if (existing) { existing.references++; return existing.release; }
  let active = true;
  const writable = () => active && !store.readonly && accessScopeCurrent(scope, true);
  const restores: (() => void)[] = [];
  const visited = new WeakSet<object>();
  const wrap = (target: object, name: string, denied: () => unknown = () => undefined) => {
    const object = target as Record<string, unknown>;
    const original = object[name];
    if (typeof original !== 'function') return;
    const own = Object.getOwnPropertyDescriptor(target, name);
    const guarded = function(this: unknown, ...args: unknown[]) {
      if (!writable()) return denied();
      const result: unknown = Reflect.apply(original, this, args);
      scan();
      return result;
    };
    Object.defineProperty(target, name, { value: guarded, configurable: true, writable: true });
    restores.push(() => { if (object[name] !== guarded) return; if (own) Object.defineProperty(target, name, own); else delete object[name]; });
  };
  const visit = (value: unknown): void => {
    if (!(value instanceof Y.AbstractType)) return;
    if (!visited.has(value)) {
      visited.add(value);
      for (const name of ['set', 'delete', 'clear', 'insert', 'insertEmbed', 'format', 'applyDelta', 'push', 'unshift', 'setAttribute', 'removeAttribute'])
        wrap(value, name, () => name === 'set' ? value : name === 'delete' ? false : undefined);
    }
    if (value instanceof Y.Map) for (const child of value.values()) visit(child);
    else if (value instanceof Y.Array || value instanceof Y.XmlFragment) for (const child of value.toArray()) visit(child);
    else if (value instanceof Y.Text) for (const delta of value.toDelta()) if (typeof delta.insert !== 'string') visit(delta.insert);
  };
  const scan = () => { for (const type of store.spaceDoc.share.values()) visit(type); };
  scan();
  for (const name of ['transact', 'addBlock', 'updateBlock', 'deleteBlock', 'moveBlocks', 'undo', 'redo', 'captureSync']) wrap(store, name);
  wrap(store.history.undoManager, 'undo'); wrap(store.history.undoManager, 'redo');
  const update = () => scan();
  store.spaceDoc.on('afterTransaction', update);
  const unsubscribe = subscribeAccessScope(() => { if (!accessScopeCurrent(scope, true)) store.readonly = true; });
  const entry = { references: 1, release: () => {
    if (--entry.references > 0) return;
    active = false; unsubscribe(); store.spaceDoc.off('afterTransaction', update);
    restores.reverse().forEach(restore => restore()); guards.delete(store);
  } };
  guards.set(store, entry);
  return entry.release;
}

/** Read-only navigation keeps pointer, wheel, select-all and copy dispatch. */
export function installReadOnlyInputs(host: HTMLElement, store: Store, scope: AccessScope): () => void {
  const stop = (event: Event) => {
    if (!store.readonly && accessScopeCurrent(scope, true)) return;
    const target = event.composedPath()[0];
    if (!event.composedPath().includes(host) && target instanceof Element && target.closest('input, textarea, button, select, [role=dialog]')) return;
    if (event instanceof KeyboardEvent) {
      const modifier = event.ctrlKey || event.metaKey;
      if (['Escape', 'Tab', ' ', 'Shift', 'Control', 'Meta', 'Alt'].includes(event.key) ||
          (modifier && ['a', 'c', '+', '-', '0', '1', '='].includes(event.key.toLowerCase())) || event.key.startsWith('Arrow') || (event.key === 'Tab' && event.shiftKey)) return;
      if (!event.composedPath().includes(host) && target !== document.body) return;
    }
    event.preventDefault(); event.stopImmediatePropagation();
  };
  const names = ['keydown', 'beforeinput', 'paste', 'cut', 'drop', 'compositionstart'] as const;
  names.forEach(name => document.addEventListener(name, stop, true));
  return () => names.forEach(name => document.removeEventListener(name, stop, true));
}
