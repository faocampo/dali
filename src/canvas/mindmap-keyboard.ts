import type { EditorHost } from '@blocksuite/affine/std';
import { addMindmapChild, addMindmapSibling, selectedMindmapTopic } from './mindmap';

const installations = new WeakMap<EditorHost, () => void>();

/** Own only mind-map creation/edit exits, before the native bubbling keymap. */
export function installMindmapShortcuts(host: EditorHost, onError: (error: unknown) => void): () => void {
  installations.get(host)?.();
  const doc = host.ownerDocument;
  const store = host.store;
  const held = new Set<string>();
  let composing = false;
  let endingComposition = false;
  const stop = (event: KeyboardEvent, prevent = true) => {
    event.stopImmediatePropagation();
    if (prevent) event.preventDefault();
  };
  const start = () => { composing = true; endingComposition = false; };
  const end = () => { composing = false; endingComposition = true; };
  const up = (event: KeyboardEvent) => { held.delete(event.key); if (event.key === 'Enter') endingComposition = false; };
  const reset = () => { held.clear(); composing = false; endingComposition = false; };
  const key = (event: KeyboardEvent) => {
    if (!host.isConnected || host.store !== store || !['Tab', 'Enter', 'Escape'].includes(event.key)) return;
    const selected = selectedMindmapTopic(host);
    if (!selected) return;
    const path = event.composedPath();
    const editor = path.find(target => target instanceof HTMLElement && target.matches('edgeless-shape-text-editor')) as HTMLElement | undefined;
    const external = path.some(target => target instanceof HTMLElement && !editor &&
      (target.isContentEditable || target.matches('input,textarea,select,button,[role="dialog"],[role="menu"],[role="textbox"]')));
    if (external) { event.stopPropagation(); return; }
    const inCanvas = path.includes(host) || event.target === doc.body;
    if (!inCanvas) return;
    if (composing || event.isComposing || (endingComposition && event.key === 'Enter')) { stop(event, false); return; }
    if (event.key !== 'Enter') endingComposition = false;
    if (event.shiftKey && event.key === 'Tab') { stop(event, false); return; }
    if (event.altKey || event.ctrlKey || event.metaKey || (event.shiftKey && !editor)) return;
    if (event.repeat || held.has(event.key)) { stop(event); return; }
    if (editor) {
      if (event.shiftKey && event.key === 'Enter') return;
      held.add(event.key); stop(event);
      // Native rich text already writes through. Removing its mounted view avoids
      // native Escape's stale next-frame selection and preserves exact text.
      selected.shape.textDisplay = true;
      editor.addEventListener('blur', blur => blur.stopImmediatePropagation(), { capture: true, once: true });
      editor.remove();
      selected.gfx.selection.set({ elements: [selected.shape.id], editing: false });
      (doc.activeElement as HTMLElement | null)?.blur();
      return;
    }
    if (selected.gfx.selection.editing) return;
    held.add(event.key); stop(event);
    if (event.key === 'Escape') {
      selected.gfx.selection.set({ elements: [], editing: false });
      return;
    }
    try {
      if (event.key === 'Tab' || !selected.map.children.get(selected.shape.id)?.parent) addMindmapChild(host);
      else addMindmapSibling(host);
    } catch (cause) { onError(cause); }
  };
  doc.addEventListener('keydown', key, true);
  doc.addEventListener('keyup', up, true);
  doc.addEventListener('compositionstart', start, true);
  doc.addEventListener('compositionend', end, true);
  doc.defaultView?.addEventListener('blur', reset);
  const dispose = () => {
    doc.removeEventListener('keydown', key, true); doc.removeEventListener('keyup', up, true);
    doc.removeEventListener('compositionstart', start, true); doc.removeEventListener('compositionend', end, true);
    doc.defaultView?.removeEventListener('blur', reset); reset();
    if (installations.get(host) === dispose) installations.delete(host);
  };
  installations.set(host, dispose);
  return dispose;
}
