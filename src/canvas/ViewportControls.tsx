import { useEffect, useState } from 'react';
import type { EditorHost } from '@blocksuite/affine/std';
import { GfxControllerIdentifier, ZOOM_MIN, ZOOM_MAX, ZOOM_STEP } from '@blocksuite/affine/std/gfx';

/** Native viewport operations with explicit names and a stable history group. */
export function ViewportControls({ host }: { host: EditorHost }) {
  const gfx = host.std.get(GfxControllerIdentifier);
  const store = host.std.store;
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
    <button type="button" aria-label={`Reset zoom to 100%, current ${Math.round(state.zoom * 100)}%`} title="Reset zoom to 100%" disabled={state.locked} onClick={() => gfx.viewport.smoothZoom(1)}>{Math.round(state.zoom * 100)}%</button>
    <button type="button" aria-label="Zoom in" title="Zoom in" disabled={state.locked || state.zoom >= ZOOM_MAX} onClick={() => zoom(ZOOM_STEP)}><Icon path="M5 12h14M12 5v14" /></button>
  </div>;
}

function Icon({ path }: { path: string }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={path} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
