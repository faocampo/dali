import { createIdentifier } from '@blocksuite/global/di';
import { ConnectorElementModel } from '@blocksuite/affine/model';
import { connector as nativeConnector, ConnectorElementRendererExtension } from '@blocksuite/affine/gfx/connector';
import type { ElementRenderer, DomRenderer } from '@blocksuite/affine/blocks/surface';
import { ViewExtensionProvider, type ViewExtensionContext } from '@blocksuite/affine/ext-loader';
import { BlockFlavourIdentifier } from '@blocksuite/affine/std';
import { ToolbarModuleExtension as mergeToolbarModule } from '@blocksuite/affine/shared/services';
import { Bound, type IVec } from '@blocksuite/global/gfx';
import { html } from 'lit';
import { withCanvasReservation } from './account/reservations';

type DomConnector = (model: ConnectorElementModel, element: HTMLElement, renderer: DomRenderer) => void;
const connectorDomIdentifier = createIdentifier<DomConnector>('affine.surface.dom-element-renderer.connector');

type OrientedStyle = ConnectorElementModel['labelStyle'] & { orientation?: 'line' | 'screen' };
export function connectorTextOrientation(model: ConnectorElementModel) {
  return (model.labelStyle as OrientedStyle).orientation === 'line' ? 'line' : 'screen';
}
export function connectorTextAngle(model: ConnectorElementModel) {
  if (connectorTextOrientation(model) !== 'line' || model.absolutePath.length < 2) return 0;
  const offset = Math.max(0, Math.min(1, model.labelOffset.distance));
  const a = model.getPointByOffsetDistance(Math.max(0, offset - .001));
  const b = model.getPointByOffsetDistance(Math.min(1, offset + .001));
  let angle = Math.atan2(b[1]! - a[1]!, b[0]! - a[0]!) * 180 / Math.PI;
  if (!Number.isFinite(angle)) return 0;
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;
  return angle;
}
function rotatePoint(x: number, y: number, cx: number, cy: number, angle: number): IVec {
  const radians = angle * Math.PI / 180, c = Math.cos(radians), s = Math.sin(radians);
  return [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c];
}
function labelCorners(model: ConnectorElementModel, padding = 0) {
  const [x, y, w, h] = model.labelXYWH!;
  return [[x - padding, y - padding], [x + w + padding, y - padding], [x + w + padding, y + h + padding], [x - padding, y + h + padding]]
    .map(([px, py]) => rotatePoint(px!, py!, x + w / 2, y + h / 2, connectorTextAngle(model)));
}

/** Pinned native renderer adapter: retain native text shaping, line routing and
 * endpoints, rotating only the label and its line cutout. Applies to exports too. */
export const orientedConnector: typeof nativeConnector = (model, ctx, matrix, renderer, rc, viewport) => {
  if (!(model instanceof ConnectorElementModel) || !model.hasLabel() || !connectorTextAngle(model)) return nativeConnector(model, ctx, matrix, renderer, rc, viewport);
  const angle = connectorTextAngle(model) * Math.PI / 180;
  const [, , w, h] = model.labelXYWH!;
  const rotateLabel = (operation: () => void) => {
    ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(angle); ctx.translate(-w / 2, -h / 2);
    try { operation(); } finally { ctx.restore(); }
  };
  const adapted = new Proxy(ctx, {
    get(target, key) {
      if (key === 'clip') return () => {
        const path = new Path2D(); path.rect(-1e7, -1e7, 2e7, 2e7);
        labelCorners(model, 3.5).forEach(([x, y], index) => index ? path.lineTo(x! - model.x, y! - model.y) : path.moveTo(x! - model.x, y! - model.y));
        path.closePath(); target.clip(path, 'evenodd');
      };
      if (key === 'fillText') return (...args: Parameters<CanvasRenderingContext2D['fillText']>) => rotateLabel(() => target.fillText(...args));
      if (key === 'fillRect' && renderer.usePlaceholder) return (...args: Parameters<CanvasRenderingContext2D['fillRect']>) => rotateLabel(() => target.fillRect(...args));
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
    set(target, key, value) { return Reflect.set(target, key, value, target); },
  });
  nativeConnector(model, adapted, matrix, renderer, rc, viewport);
};

let installed = false;
function installLabelGeometry() {
  if (installed) return; installed = true;
  const prototype = ConnectorElementModel.prototype;
  const bound = Object.getOwnPropertyDescriptor(prototype, 'elementBound')!.get!;
  const includes = prototype.labelIncludesPoint;
  const contains = prototype.containsBound;
  prototype.containsBound = function(bounds: Bound) {
    if (!this.hasLabel() || !connectorTextAngle(this)) return contains.call(this, bounds);
    return this.absolutePath.some(point => bounds.containsPoint(point)) || labelCorners(this).some(point => bounds.containsPoint(point));
  };
  Object.defineProperty(prototype, 'elementBound', { configurable: true, get(this: ConnectorElementModel) {
    const native = bound.call(this) as Bound;
    if (!this.hasLabel() || !connectorTextAngle(this)) return native;
    const corners = labelCorners(this); const xs = corners.map(p => p[0]!), ys = corners.map(p => p[1]!);
    return native.unite(new Bound(Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)));
  } });
  prototype.labelIncludesPoint = function(point: IVec) {
    if (!this.hasLabel() || !connectorTextAngle(this)) return includes.call(this, point);
    const [x, y, w, h] = this.labelXYWH!;
    return includes.call(this, rotatePoint(point[0]!, point[1]!, x + w / 2, y + h / 2, -connectorTextAngle(this)));
  };
}
const stop = (event: Event) => event.stopPropagation();
export class ConnectorTextOrientationExtension extends ViewExtensionProvider {
  override name = 'dali-connector-text-orientation';
  override setup(context: ViewExtensionContext) {
    super.setup(context); if (!this.isEdgeless(context.scope)) return;
    installLabelGeometry();
    context.register({ setup(di) {
      di.override(ConnectorElementRendererExtension.identifier, () => orientedConnector as ElementRenderer);
      const native = di.provider().get(connectorDomIdentifier) as (model: ConnectorElementModel, element: HTMLElement, renderer: DomRenderer) => void;
      di.override(connectorDomIdentifier, () => (model: ConnectorElementModel, element: HTMLElement, renderer: DomRenderer) => {
        native(model, element, renderer);
        const label = element.lastElementChild;
        if (label instanceof HTMLDivElement) { label.style.transformOrigin = 'center'; label.style.transform = `rotate(${connectorTextAngle(model)}deg)`; }
      });
    } });
    context.register(mergeToolbarModule({ id: BlockFlavourIdentifier('custom:affine:surface:connector'), config: { actions: [{
      id: 'g.text-orientation',
      when: ctx => ctx.getSurfaceModelsByType(ConnectorElementModel).some(model => !!model.text?.length),
      content: ctx => {
        const models = ctx.getSurfaceModelsByType(ConnectorElementModel);
        const value = connectorTextOrientation(models[0]!);
        const mixed = models.some(model => connectorTextOrientation(model) !== value);
        return html`<select aria-label="Text orientation" title="Text orientation" style="height:32px;max-width:160px;border:0;background:transparent;color:var(--affine-text-primary-color);font:inherit;padding:0 8px;" @pointerdown=${stop} @mousedown=${stop} @click=${stop} @input=${stop} @keydown=${stop} @change=${(event: Event) => {
          const orientation = (event.target as HTMLSelectElement).value;
          if (ctx.store.readonly || !['line', 'screen'].includes(orientation)) return;
          const ids = models.map(model => model.id).sort();
          void withCanvasReservation(ctx.std.host, ids, false, () => {
            if (JSON.stringify(ctx.getSurfaceModelsByType(ConnectorElementModel).map(model => model.id).sort()) !== JSON.stringify(ids)) throw new Error('Selection changed. Choose the orientation again.');
            ctx.store.captureSync();
            ctx.store.transact(() => models.filter(model => !model.isLocked()).forEach(model => { model.labelStyle = { ...model.labelStyle, orientation } as OrientedStyle; }));
            ctx.store.captureSync();
          }).catch(() => {});
        }}>${mixed ? html`<option value="mixed" selected disabled>Mixed orientations</option>` : ''}<option value="screen" ?selected=${!mixed && value === 'screen'}>Stay horizontal</option><option value="line" ?selected=${!mixed && value === 'line'}>Follow line</option></select>`;
      },
    }] } }));
  }
}
