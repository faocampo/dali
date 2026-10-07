import { useEffect, useState } from 'react';
import type { EditorHost } from '@blocksuite/affine/std';
import { GfxControllerIdentifier, InteractivityIdentifier, isGfxGroupCompatibleModel, isPrimitiveModel } from '@blocksuite/affine/std/gfx';
import { canvasModelVisible } from './selection-summary';
import { gridMetrics, intersects, measurementLabel, nearbyDistances, selectionBounds, type DistanceGuide, type Rect } from './measurement-geometry';
import { useViewPreferences } from './view-preferences';

const GRID_CSS = `.edgeless-background {
  background-image: var(--dali-grid-image) !important;
  background-size: var(--dali-grid-size) !important;
  background-position: var(--dali-grid-position) !important;
}`;
type OverlayState = { bounds: Rect | null; world: Rect | null; guides: DistanceGuide[]; width: number; height: number };
const EMPTY: OverlayState = { bounds: null, world: null, guides: [], width: 0, height: 0 };

/** Local view chrome: never written to the document or included in canvas exports. */
export function CanvasMeasurements({ host }: { host: EditorHost }) {
  const prefs = useViewPreferences();
  const gfx = host.std.get(GfxControllerIdentifier);
  const [state, setState] = useState<OverlayState>(EMPTY);
  useEffect(() => {
    const root = host.querySelector<HTMLElement>('affine-edgeless-root');
    if (!root) return;
    const style = document.createElement('style');
    style.dataset.daliViewGrid = '';
    style.textContent = GRID_CSS;
    (root.shadowRoot ?? root).append(style);
    const interaction = host.std.get(InteractivityIdentifier);
    let keyboardMoving = false;
    let frame = 0;
    const sync = () => {
      frame = 0;
      const viewport = gfx.viewport;
      const grid = gridMetrics(prefs.spacing, viewport.zoom, viewport.toViewCoord(0, 0));
      root.style.setProperty('--dali-grid-image', prefs.grid === 'off' ? 'none' : prefs.grid === 'dots'
        ? 'radial-gradient(circle at 1px 1px, var(--affine-edgeless-grid-color) 1px, transparent 1px)'
        : 'linear-gradient(to right, var(--affine-edgeless-grid-color) 1px, transparent 1px), linear-gradient(to bottom, var(--affine-edgeless-grid-color) 1px, transparent 1px)');
      root.style.setProperty('--dali-grid-size', `${grid.step}px ${grid.step}px`);
      root.style.setProperty('--dali-grid-position', `${grid.x}px ${grid.y}px`);
      root.dataset.gridStyle = prefs.grid;
      const gesture = interaction.activeInteraction$.peek()?.type;
      if ((!keyboardMoving && gesture !== 'move' && gesture !== 'resize') || (!prefs.dimensions && !prefs.distances) || gfx.selection.editing) { setState(EMPTY); return; }
      const selected = gfx.selection.selectedElements.filter(canvasModelVisible);
      // Group bounds can retain collapsed descendants; measure the visible leaves.
      const measured = selected.flatMap(model => isPrimitiveModel(model) && ['group', 'mindmap'].includes(model.type) && isGfxGroupCompatibleModel(model)
        ? model.descendantElements.filter(child => canvasModelVisible(child) && !(isPrimitiveModel(child) && ['group', 'mindmap'].includes(child.type))) : [model]);
      const world = selectionBounds(measured.map(model => model.elementBound));
      if (!world) { setState(EMPTY); return; }
      const [x, y] = viewport.toViewCoord(world.x, world.y);
      const bounds = { x, y, w: world.w * viewport.zoom, h: world.h * viewport.zoom };
      const visible = { x: 0, y: 0, w: viewport.width, h: viewport.height };
      if (!intersects(bounds, visible)) { setState(EMPTY); return; }
      const excluded = new Set(selected.flatMap(model => [model.id, ...model.groups.map(group => group.id)]));
      const selectedIds = new Set(selected.map(model => model.id));
      const neighbors = prefs.distances ? gfx.gfxElements.filter(model => {
        if (excluded.has(model.id) || model.groups.some(group => selectedIds.has(group.id))) return false;
        if (isPrimitiveModel(model) && ['connector', 'brush', 'group', 'mindmap'].includes(model.type)) return false;
        return canvasModelVisible(model) && intersects(viewport.toViewBound(model.elementBound), visible);
      }).map(model => ({ id: model.id, x: model.elementBound.x, y: model.elementBound.y, w: model.elementBound.w, h: model.elementBound.h })) : [];
      const guides = nearbyDistances(world, neighbors, viewport.zoom).map(guide => {
        const [x1, y1] = viewport.toViewCoord(guide.x1, guide.y1);
        const [x2, y2] = viewport.toViewCoord(guide.x2, guide.y2);
        return { ...guide, x1, y1, x2, y2 };
      });
      setState({ bounds, world, guides, width: viewport.width, height: viewport.height });
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(sync); };
    const stopKeyboard = () => { keyboardMoving = false; schedule(); };
    const keyDown = (event: KeyboardEvent) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) || event.metaKey || event.ctrlKey || event.altKey || host.store.readonly) return;
      if (event.composedPath().some(node => node instanceof Element && node.matches('input,select,textarea,[contenteditable="true"],editor-toolbar,editor-menu-content'))) return;
      if (!gfx.selection.editing && gfx.selection.selectedElements.some(model => !model.isLocked())) { keyboardMoving = true; schedule(); }
    };
    const stopInteraction = interaction.activeInteraction$.subscribe(schedule);
    sync();
    const subscriptions = [
      gfx.viewport.viewportUpdated.subscribe(schedule),
      gfx.selection.slots.updated.subscribe(schedule),
      host.store.slots.blockUpdated.subscribe(schedule),
      gfx.surface?.elementUpdated.subscribe(schedule),
      gfx.surface?.elementAdded.subscribe(schedule),
      gfx.surface?.elementRemoved.subscribe(schedule),
    ];
    host.addEventListener('keydown', keyDown, true);
    window.addEventListener('keyup', stopKeyboard);
    window.addEventListener('blur', stopKeyboard);
    return () => {
      cancelAnimationFrame(frame);
      subscriptions.forEach(subscription => subscription?.unsubscribe());
      stopInteraction();
      host.removeEventListener('keydown', keyDown, true);
      window.removeEventListener('keyup', stopKeyboard);
      window.removeEventListener('blur', stopKeyboard);
      style.remove();
      delete root.dataset.gridStyle;
      ['--dali-grid-image', '--dali-grid-size', '--dali-grid-position'].forEach(key => root.style.removeProperty(key));
    };
  }, [gfx, host, prefs]);

  const { bounds, world } = state;
  if (!bounds || !world) return null;
  return <svg className="canvas-measurements" width="100%" height="100%" aria-label="Canvas measurements" role="img">
    <title>Selected bounds and nearby gaps in canvas pixels</title>
    {prefs.distances && state.guides.map(guide => <g key={guide.direction} className="canvas-distance" data-direction={guide.direction} data-distance={guide.distance} data-neighbor={guide.neighbor}>
      <title>{guide.direction}: {measurementLabel(guide.distance)}</title>
      <line x1={guide.x1} y1={guide.y1} x2={guide.x2} y2={guide.y2} />
      {[[guide.x1, guide.y1], [guide.x2, guide.y2]].map(([x, y], i) => <line key={i} x1={x! - (guide.x1 === guide.x2 ? 4 : 0)} x2={x! + (guide.x1 === guide.x2 ? 4 : 0)} y1={y! - (guide.y1 === guide.y2 ? 4 : 0)} y2={y! + (guide.y1 === guide.y2 ? 4 : 0)} />)}
      <Badge text={measurementLabel(guide.distance)} x={(guide.x1 + guide.x2) / 2} y={(guide.y1 + guide.y2) / 2 - 14} width={state.width} height={state.height} />
    </g>)}
    {prefs.dimensions && <g className="canvas-dimensions" data-width={world.w} data-height={world.h}>
      <title>Selection: {measurementLabel(world.w)} wide, {measurementLabel(world.h)} high</title>
      <Badge text={`${Math.round(world.w * 10) / 10} × ${measurementLabel(world.h)}`} x={bounds.x + bounds.w / 2} y={bounds.y + bounds.h + 22} width={state.width} height={state.height} />
    </g>}
  </svg>;
}
function Badge({ text, x, y, width, height }: { text: string; x: number; y: number; width: number; height: number }) {
  const w = text.length * 7 + 16;
  return <g transform={`translate(${Math.max(w / 2 + 4, Math.min(width - w / 2 - 4, x))},${Math.max(14, Math.min(height - 14, y))})`}>
    <rect x={-w / 2} y={-11} width={w} height={22} rx={5} />
    <text textAnchor="middle" dominantBaseline="central">{text}</text>
  </g>;
}
