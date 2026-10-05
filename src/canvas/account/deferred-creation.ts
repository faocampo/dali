import type { EditorHost } from '@blocksuite/affine/std';
import { GfxControllerIdentifier } from '@blocksuite/affine/std/gfx';
import { Bound, linePolygonIntersects } from '@blocksuite/global/gfx';
import { isTopLevelBlock } from '@blocksuite/affine/shared/utils';
import { EdgelessCRUDIdentifier, OverlayIdentifier } from '@blocksuite/affine/blocks/surface';
import { ConnectorElementModel } from '@blocksuite/affine/model';
import type { ConnectionOverlay } from '@blocksuite/affine/gfx/connector';

type Input = { event: PointerEvent; target: EventTarget | undefined };
type Retarget = { model: ConnectorElementModel; end: 'source' | 'target'; snapshot: string; anchor: { clientX: number; clientY: number } };
type Hooks = {
  replaying: () => boolean;
  busy: () => boolean;
  message: (text: string) => void;
  run: (ids: string[], create: boolean, operation: () => void) => Promise<void>;
  replay: (events: Input[]) => void;
};

/** Preview dependent gestures privately until their complete affected set is known. */
export function installDeferredCreation(host: EditorHost, hooks: Hooks) {
  const gfx = host.std.get(GfxControllerIdentifier);
  let active: { tool: string; start: Input; move?: Input; points: Input[]; connector?: Retarget } | undefined;
  let preview: SVGSVGElement | undefined;
  let generation = 0;
  const stop = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); };
  const input = (event: PointerEvent): Input => ({ event, target: event.composedPath()[0] });
  const clear = () => { active = undefined; preview?.remove(); preview = undefined; };
  const render = (end: PointerEvent) => {
    if (!active) return;
    if (!preview) {
      preview = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      preview.setAttribute('aria-hidden', 'true'); preview.classList.add('live-creation-preview');
      preview.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9;';
      document.body.append(preview);
    }
    const start = active.connector?.anchor ?? active.start.event;
    const shape = document.createElementNS('http://www.w3.org/2000/svg', active.tool === 'frame' ? 'rect' : active.tool === 'eraser' ? 'polyline' : 'line');
    const values = active.tool === 'frame'
      ? { x: Math.min(start.clientX, end.clientX), y: Math.min(start.clientY, end.clientY), width: Math.abs(end.clientX - start.clientX), height: Math.abs(end.clientY - start.clientY) }
      : { x1: start.clientX, y1: start.clientY, x2: end.clientX, y2: end.clientY };
    for (const [name, value] of Object.entries(values)) shape.setAttribute(name, String(value));
    if (active.tool === 'eraser') shape.setAttribute('points', active.points.map(({ event }) => `${event.clientX},${event.clientY}`).join(' '));
    shape.setAttribute('fill', 'none'); shape.setAttribute('stroke', 'var(--affine-primary-color,#643df2)');
    shape.setAttribute('stroke-width', active.tool === 'eraser' ? '16' : '2');
    if (active.tool === 'eraser') { shape.setAttribute('opacity', '.35'); shape.setAttribute('stroke-linecap', 'round'); }
    else shape.setAttribute('stroke-dasharray', '5 4');
    preview.replaceChildren(shape);
  };
  const targets = (tool: string, start: PointerEvent, end: PointerEvent, inputs: Input[] = [], connector?: Retarget) => {
    const from = gfx.viewport.toModelCoordFromClientCoord([start.clientX, start.clientY]);
    const to = gfx.viewport.toModelCoordFromClientCoord([end.clientX, end.clientY]);
    if (connector) {
      const overlay = host.std.get(OverlayIdentifier('connection')) as ConnectionOverlay;
      const model = connector.model; const other = model[connector.end === 'source' ? 'target' : 'source'].id;
      const destination = overlay.renderConnector(to, other ? [other] : []);
      return [...new Set([model.id, model.source.id, model.target.id, destination.id].filter((id): id is string => typeof id === 'string'))].sort();
    }
    if (tool === 'eraser') {
      const points = inputs.map(({ event }) => gfx.viewport.toModelCoordFromClientCoord([event.clientX, event.clientY]));
      return [...gfx.layer.canvasElements, ...gfx.layer.blocks].filter(model => !model.isLocked() && points.some((point, index) => {
        if (!index) return false;
        const previous = points[index - 1]!;
        return isTopLevelBlock(model) ? linePolygonIntersects(previous, point, Bound.deserialize(model.xywh).points) : !!model.getLineIntersections(previous, point);
      })).map(model => model.id).sort();
    }
    if (tool === 'connector') {
      const overlay = host.std.get(OverlayIdentifier('connection')) as ConnectionOverlay;
      const source = overlay.renderConnector(from);
      const target = overlay.renderConnector(to, source.id ? [source.id] : []);
      return [...new Set([source.id, target.id].filter((id): id is string => typeof id === 'string'))].sort();
    }
    const left = Math.min(from[0], to[0]); const top = Math.min(from[1], to[1]);
    const right = Math.max(from[0], to[0]); const bottom = Math.max(from[1], to[1]);
    return gfx.gfxElements.filter(model => {
      const bound = model.elementBound;
      return bound.minX >= left && bound.minY >= top && bound.maxX <= right && bound.maxY <= bottom;
    }).map(model => model.id).sort();
  };
  const down = (event: PointerEvent) => {
    if (hooks.replaying() || host.store.readonly || event.button !== 0) return;
    const tool = gfx.tool.currentToolName$.peek();
    const path = event.composedPath();
    const handle = path.find(node => node instanceof HTMLElement && node.matches('edgeless-connector-handle')) as (HTMLElement & { connector: ConnectorElementModel }) | undefined;
    const endpoint = path.find(node => node instanceof Element && node.matches('.line-start,.line-end')) as Element | undefined;
    let connector: Retarget | undefined;
    if (tool === 'default' && handle?.connector instanceof ConnectorElementModel && endpoint) {
      const end = endpoint.matches('.line-start') ? 'source' : 'target';
      const opposite = handle.shadowRoot?.querySelector(end === 'source' ? '.line-end' : '.line-start')?.getBoundingClientRect();
      if (opposite && !handle.connector.isLocked()) connector = { model: handle.connector, end, snapshot: JSON.stringify([handle.connector.source, handle.connector.target]), anchor: { clientX: opposite.x + opposite.width / 2, clientY: opposite.y + opposite.height / 2 } };
    }
    if (!connector && !['frame', 'connector', 'eraser'].includes(tool)) return;
    if (event.composedPath().some(node => node instanceof Element && node.matches('editor-toolbar,editor-menu-content,input,textarea,button'))) return;
    stop(event);
    if (hooks.busy()) { hooks.message('Finish the current action, then draw again.'); return; }
    host.focus();
    generation++; active = { tool, start: input(event), points: [input(event)], connector }; render(event);
  };
  const move = (event: PointerEvent) => {
    if (hooks.replaying() || !active || event.pointerId !== active.start.event.pointerId) return;
    stop(event);
    if (active.points.length >= 512) { generation++; clear(); hooks.message('The gesture is too long. Try a shorter stroke.'); return; }
    active.move = input(event); active.points.push(active.move); render(event);
  };
  const end = (event: PointerEvent) => {
    if (hooks.replaying() || !active || event.pointerId !== active.start.event.pointerId) return;
    stop(event); const gesture = active; const version = generation; const last = input(event); clear();
    if (event.type === 'pointercancel' || !gesture.move) return;
    const points = [...gesture.points, last];
    const ids = targets(gesture.tool, gesture.start.event, event, points, gesture.connector);
    if (gesture.tool === 'eraser' && !ids.length) return;
    void hooks.run(ids, gesture.tool !== 'eraser' && !gesture.connector, () => {
      if (generation !== version || gfx.tool.currentToolName$.peek() !== gesture.tool) throw new Error('Drawing cancelled.');
      if (ids.join('\0') !== targets(gesture.tool, gesture.start.event, event, points, gesture.connector).join('\0')) throw new Error('Objects changed while waiting. Draw again.');
      if (gesture.connector) {
        const { model, end, snapshot } = gesture.connector;
        if (gfx.getElementById(model.id) !== model || JSON.stringify([model.source, model.target]) !== snapshot || model.isLocked()) throw new Error('The line changed while waiting. Connect it again.');
        const point = gfx.viewport.toModelCoordFromClientCoord([event.clientX, event.clientY]);
        const other = model[end === 'source' ? 'target' : 'source'].id;
        const destination = (host.std.get(OverlayIdentifier('connection')) as ConnectionOverlay).renderConnector(point, other ? [other] : []);
        host.store.captureSync(); host.store.transact(() => { model[end] = destination; }); host.store.captureSync();
      } else if (gesture.tool === 'eraser') {
        const models = gfx.gfxElements.filter(model => ids.includes(model.id));
        host.store.captureSync();
        host.store.transact(() => host.std.get(EdgelessCRUDIdentifier).deleteElements(models));
        host.store.captureSync();
      } else hooks.replay([gesture.start, gesture.move!, last]);
    }).catch(() => {});
  };
  const cancel = (event: KeyboardEvent) => { if (event.key === 'Escape') { generation++; clear(); } };
  host.addEventListener('pointerdown', down, true); host.addEventListener('pointermove', move, true);
  window.addEventListener('pointerup', end, true); window.addEventListener('pointercancel', end, true);
  document.addEventListener('keydown', cancel, true);
  return () => {
    generation++; clear();
    host.removeEventListener('pointerdown', down, true); host.removeEventListener('pointermove', move, true);
    window.removeEventListener('pointerup', end, true); window.removeEventListener('pointercancel', end, true);
    document.removeEventListener('keydown', cancel, true);
  };
}
