import { useEffect, useRef, useState } from 'react';
import type { EditorHost } from '@blocksuite/affine/std';
import { GfxControllerIdentifier, ZOOM_MIN, ZOOM_MAX, ZOOM_STEP } from '@blocksuite/affine/std/gfx';
import { getCommonBound } from '@blocksuite/global/gfx';
import { canvasModelVisible } from './selection-summary';

/** Native viewport operations with explicit names and a stable history group. */
export function ViewportControls({ host }: { host: EditorHost }) {
  const [zoomOpen, setZoomOpen] = useState(false);
  const zoomRoot = useRef<HTMLDivElement>(null);
  const zoomTrigger = useRef<HTMLButtonElement>(null);
  const closeZoom = () => { setZoomOpen(false); zoomTrigger.current?.focus(); };
  useEffect(() => {
    if (!zoomOpen) return;
    (zoomRoot.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]') ?? zoomRoot.current?.querySelector<HTMLButtonElement>('[role="menuitemradio"]'))?.focus();
    const outside = (event: PointerEvent) => { if (!zoomRoot.current?.contains(event.target as Node)) setZoomOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [zoomOpen]);
  const gfx = host.std.get(GfxControllerIdentifier);
  const store = host.std.store;
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (!host.isConnected || gfx.viewport.locked || !(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || !['0', '1'].includes(event.key)) return;
      if (event.composedPath().some(node => node instanceof Element && node.matches('input,textarea,select,[contenteditable="true"],[role="dialog"],dialog'))) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.key === '0') gfx.viewport.smoothZoom(1);
      else {
        const selected = gfx.selection.selectedElements.filter(canvasModelVisible);
        if (selected.length) {
          const bound = getCommonBound(selected.map(model => model.elementBound));
          const fit = gfx.viewport.getFitToScreenData(bound, [80, 40, 80, 100], ZOOM_MAX);
          gfx.viewport.setViewport(fit.zoom, [fit.centerX, fit.centerY], true);
        }
      }
    };
    document.addEventListener('keydown', key, true);
    return () => document.removeEventListener('keydown', key, true);
  }, [host, gfx]);
  const [state, setState] = useState(() => ({ zoom: gfx.viewport.zoom, locked: gfx.viewport.locked, undo: store.history.canUndo, redo: store.history.canRedo }));
  useEffect(() => {
    const sync = () => setState({ zoom: gfx.viewport.zoom, locked: gfx.viewport.locked, undo: store.history.canUndo, redo: store.history.canRedo });
    sync();
    const viewport = gfx.viewport.viewportUpdated.subscribe(sync);
    const history = store.history.onUpdated.subscribe(sync);
    return () => { viewport.unsubscribe(); history.unsubscribe(); };
  }, [gfx, store]);
  const zoom = (step: number) => gfx.viewport.smoothZoom(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, gfx.viewport.zoom + step)));
  return <div className="canvas-viewport-controls" role="toolbar" aria-label="Viewport and history">
    <button type="button" aria-label="Undo" title={navigator.platform.includes('Mac') ? 'Undo (⌘Z)' : 'Undo (Ctrl+Z)'} disabled={!state.undo || store.readonly} onClick={() => store.undo()}><Icon path="m9 5-5 5 5 5M4 10h10a5 5 0 0 1 0 10" /></button>
    <button type="button" aria-label="Redo" title={navigator.platform.includes('Mac') ? 'Redo (⇧⌘Z)' : 'Redo (Ctrl+Shift+Z)'} disabled={!state.redo || store.readonly} onClick={() => store.redo()}><Icon path="m15 5 5 5-5 5M20 10H10a5 5 0 0 0 0 10" /></button>
    <span className="viewport-divider" aria-hidden="true" />
    <button type="button" aria-label="Fit to screen" title="Fit to screen" disabled={state.locked} onClick={() => gfx.fitToScreen()}><Icon path="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" /></button>
    <button type="button" aria-label="Zoom out" title="Zoom out" disabled={state.locked || state.zoom <= ZOOM_MIN} onClick={() => zoom(-ZOOM_STEP)}><Icon path="M5 12h14" /></button>
    <div ref={zoomRoot} className="zoom-presets" onKeyDown={event => {
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); closeZoom(); }
      if (event.key === 'Tab') closeZoom();
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        if (!zoomOpen) { setZoomOpen(true); return; }
        const options = Array.from(zoomRoot.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? []);
        const index = options.indexOf(document.activeElement as HTMLButtonElement);
        options[event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length]?.focus();
      }
    }}>
      <button ref={zoomTrigger} type="button" aria-label={`Zoom, current ${Math.round(state.zoom * 100)}%`} title="Zoom presets" aria-haspopup="menu" aria-expanded={zoomOpen} disabled={state.locked} onClick={() => setZoomOpen(value => !value)}>{Math.round(state.zoom * 100)}%</button>
      {zoomOpen && <div role="menu" aria-label="Zoom presets" className="zoom-presets-menu">
        {[25, 50, 100, 200, 300].map(percent => <button key={percent} type="button" role="menuitemradio" tabIndex={-1} aria-checked={Math.round(state.zoom * 100) === percent} onClick={() => { gfx.viewport.smoothZoom(percent / 100); closeZoom(); }}><Icon path="M16 10a6 6 0 1 1-12 0 6 6 0 1 1 12 0m-1 5 6 6" /><span>{percent}%</span><span aria-hidden="true">{Math.round(state.zoom * 100) === percent ? '✓' : ''}</span></button>)}
      </div>}
    </div>
    <button type="button" aria-label="Zoom in" title="Zoom in" disabled={state.locked || state.zoom >= ZOOM_MAX} onClick={() => zoom(ZOOM_STEP)}><Icon path="M5 12h14M12 5v14" /></button>
  </div>;
}

function Icon({ path }: { path: string }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={path} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
