/** BlockSuite 0.22.4 integration: native shape records with extra polygon types.
 * Keep geometry registration and renderer overrides together on engine upgrades. */
import { ShapeTool, shape as renderNativeShape, ShapeElementRendererExtension } from '@blocksuite/affine/gfx/shape';
import { ToolOverlay, type SurfaceBlockComponent, type ElementRenderer, type DomRenderer } from '@blocksuite/affine/blocks/surface';
import { MindmapElementModel, ShapeElementModel, ShapeType, StrokeStyle, ShapeStyle, DefaultTheme, shapeMethods } from '@blocksuite/affine/model';
import { ViewExtensionProvider, type ViewExtensionContext } from '@blocksuite/affine/ext-loader';
import type { PointerEventState } from '@blocksuite/affine/std';
import type { PointTestOptions } from '@blocksuite/affine/std/gfx';
import { ThemeProvider, EditPropsStore } from '@blocksuite/affine/shared/services';
import { Bound, PointLocation, getPointsFromBoundWithRotation, linePolygonIntersects, pointInPolygon, pointOnPolygonStoke, polygonNearestPoint, polygonGetPointTangent, type IBound, type IVec } from '@blocksuite/global/gfx';
import { createIdentifier } from '@blocksuite/global/di';
import { classicalShape, classicalShapes, polygonPoints } from './classical-shape-geometry';

type DomElementRenderer<T = ShapeElementModel> = (model: T, element: HTMLElement, renderer: DomRenderer) => void;
const shapeDomIdentifier = createIdentifier<DomElementRenderer>('affine.surface.dom-element-renderer.shape');

// Native model serialization already stores shapeType; no parallel document
// records or conversion to image/group objects are necessary.
for (const definition of classicalShapes) {
  const points = (bound: IBound) => polygonPoints(definition.id, bound.x, bound.y, bound.w, bound.h);
  const modelBound = (model: ShapeElementModel) => {
    const bound = Bound.deserialize(model.xywh);
    return { x: bound.x, y: bound.y, w: bound.w, h: bound.h, rotate: model.rotate };
  };
  const rotated = (model: ShapeElementModel) => getPointsFromBoundWithRotation(modelBound(model), points);
  Object.assign(shapeMethods, { [definition.id]: {
    points,
    draw(ctx: CanvasRenderingContext2D, bound: IBound) {
      trace(ctx, getPointsFromBoundWithRotation(bound, points));
    },
    includesPoint(this: ShapeElementModel, x: number, y: number, options: PointTestOptions) {
      const polygon = rotated(this);
      const point: IVec = [x, y];
      return pointOnPolygonStoke(point, polygon, (options.hitThreshold ?? 1) / (options.zoom ?? 1)) || pointInPolygon(point, polygon);
    },
    containsBound: (bound: Bound, model: ShapeElementModel) => rotated(model).some(point => bound.containsPoint(point)),
    getNearestPoint: (point: IVec, model: ShapeElementModel) => polygonNearestPoint(rotated(model), point),
    getLineIntersections: (start: IVec, end: IVec, model: ShapeElementModel) => linePolygonIntersects(start, end, rotated(model)),
    getRelativePointLocation(position: IVec, model: ShapeElementModel) {
      const polygon = rotated(model);
      const [point] = getPointsFromBoundWithRotation(modelBound(model), bound => [Bound.from(bound).getRelativePoint(position)]);
      const edge = polygonNearestPoint(polygon, point!);
      return new PointLocation(edge, polygonGetPointTangent(polygon, edge));
    },
  } });
}

function trace(ctx: CanvasRenderingContext2D, points: IVec[]) {
  ctx.beginPath();
  points.forEach(([x, y], index) => index ? ctx.lineTo(x!, y!) : ctx.moveTo(x!, y!));
  ctx.closePath();
}

const renderClippedText: ElementRenderer<ShapeElementModel> = (model, ctx, matrix, renderer, rc, viewportBound) => {
  if (!model.textDisplay) return;
  const textModel = new Proxy(model, { get(target, key) {
    if (key === 'shapeType') return ShapeType.Rect;
    if (key === 'filled') return false;
    if (key === 'strokeStyle') return StrokeStyle.None;
    if (key === 'shadow') return undefined;
    return Reflect.get(target, key, target);
  } });
  ctx.save();
  ctx.setTransform(DOMMatrix.fromMatrix(matrix).translateSelf(model.w / 2, model.h / 2).rotateSelf(model.rotate).translateSelf(-model.w / 2, -model.h / 2));
  ctx.beginPath(); ctx.rect(0, 0, model.w, model.h); ctx.clip();
  renderNativeShape(textModel, ctx, DOMMatrix.fromMatrix(matrix), renderer, rc, viewportBound);
  ctx.restore();
};

const renderShape: ElementRenderer<ShapeElementModel> = (model, ctx, matrix, renderer, rc, viewportBound) => {
  if (!classicalShape(model.shapeType)) {
    if (model.group instanceof MindmapElementModel) return renderNativeShape(model, ctx, matrix, renderer, rc, viewportBound);
    const silhouette = new Proxy(model, { get(target, key) { return key === 'textDisplay' ? false : Reflect.get(target, key, target); } });
    renderNativeShape(silhouette, ctx, DOMMatrix.fromMatrix(matrix), renderer, rc, viewportBound);
    return renderClippedText(model, ctx, matrix, renderer, rc, viewportBound);
  }
  const inset = Math.max(0, model.strokeWidth) / 2;
  const width = Math.max(0, model.w - inset * 2), height = Math.max(0, model.h - inset * 2);
  const transform = DOMMatrix.fromMatrix(matrix).translateSelf(inset, inset).translateSelf(width / 2, height / 2).rotateSelf(model.rotate).translateSelf(-width / 2, -height / 2);
  ctx.save();
  ctx.setTransform(transform);
  const points = polygonPoints(model.shapeType, 0, 0, width, height);
  const fill = renderer.getColorValue(model.fillColor, DefaultTheme.shapeFillColor, true);
  const stroke = renderer.getColorValue(model.strokeColor, DefaultTheme.shapeStrokeColor, true);
  if (model.shapeStyle === ShapeStyle.Scribbled) {
    rc.polygon(points, { seed: model.seed, roughness: model.roughness, stroke: model.strokeStyle === StrokeStyle.None ? 'none' : stroke, strokeWidth: model.strokeWidth, fill: model.filled ? fill : undefined, strokeLineDash: model.strokeStyle === StrokeStyle.Dash ? [12, 12] : undefined });
  } else {
    trace(ctx, points);
    ctx.lineWidth = model.strokeWidth;
    ctx.lineJoin = 'round';
    if (model.strokeStyle === StrokeStyle.Dash) ctx.setLineDash([12, 12]);
    if (model.filled) { ctx.fillStyle = fill; ctx.fill(); }
    if (model.strokeStyle !== StrokeStyle.None && model.strokeWidth > 0) { ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  ctx.restore();
  renderClippedText(model, ctx, matrix, renderer, rc, viewportBound);
};

function domShape(native: DomElementRenderer<ShapeElementModel>): DomElementRenderer<ShapeElementModel> {
  return (model, element, renderer) => {
    if (!classicalShape(model.shapeType)) return native(model, element, renderer);
    const zoom = renderer.viewport.zoom;
    Object.assign(element.style, { width: `${model.w * zoom}px`, height: `${model.h * zoom}px`, transform: `rotate(${model.rotate}deg)`, transformOrigin: 'center', zIndex: String(renderer.layerManager.getZIndex(model)), border: 'none', background: 'transparent', clipPath: '', borderRadius: '' });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', `0 0 ${model.w} ${model.h}`);
    const polygon = document.createElementNS(svg.namespaceURI, 'polygon');
    const inset = Math.max(0, model.strokeWidth) / 2;
    polygon.setAttribute('points', polygonPoints(model.shapeType, inset, inset, Math.max(0, model.w - inset * 2), Math.max(0, model.h - inset * 2)).map(p => p.join(',')).join(' '));
    polygon.setAttribute('fill', model.filled ? renderer.getColorValue(model.fillColor, DefaultTheme.shapeFillColor, true) : 'none');
    polygon.setAttribute('stroke', model.strokeStyle === StrokeStyle.None ? 'none' : renderer.getColorValue(model.strokeColor, DefaultTheme.shapeStrokeColor, true));
    polygon.setAttribute('stroke-width', String(model.strokeWidth));
    polygon.setAttribute('stroke-linejoin', 'round');
    if (model.strokeStyle === StrokeStyle.Dash) polygon.setAttribute('stroke-dasharray', '12 12');
    svg.append(polygon); element.replaceChildren(svg);
  };
}

class PolygonOverlay extends ToolOverlay {
  geometry = classicalShapes[0]!.id;
  override render(ctx: CanvasRenderingContext2D) {
    const props = this.gfx.std.get(EditPropsStore).lastProps$.value['shape:rect'];
    const theme = this.gfx.std.get(ThemeProvider);
    ctx.save(); ctx.globalAlpha = this.globalAlpha;
    trace(ctx, polygonPoints(this.geometry, this.x, this.y, 100, 100));
    ctx.fillStyle = theme.getColorValue(props.fillColor, DefaultTheme.shapeFillColor, true);
    ctx.strokeStyle = theme.getColorValue(props.strokeColor, DefaultTheme.shapeStrokeColor, true);
    ctx.lineWidth = props.strokeWidth;
    if (props.filled) ctx.fill();
    if (props.strokeStyle !== StrokeStyle.None) ctx.stroke();
    ctx.restore();
  }
}

/** Reuse native click/drag sizing, Shift constraints, stashing and undo. */
export class ClassicalShapeTool extends ShapeTool {
  static override toolName = 'dali-shape';
  declare activatedOption: { shapeName: ShapeType.Rect; geometry: string };
  private polygonOverlay: PolygonOverlay | null = null;
  private get surfaceComponent() { return this.gfx.surfaceComponent as SurfaceBlockComponent | null; }
  override createOverlay() {
    this.clearOverlay();
    this.polygonOverlay = new PolygonOverlay(this.gfx);
    this.polygonOverlay.geometry = this.activatedOption.geometry;
    this.polygonOverlay.globalAlpha = 0;
    this.surfaceComponent?.renderer.addOverlay(this.polygonOverlay);
  }
  override clearOverlay() {
    if (!this.polygonOverlay) return;
    this.surfaceComponent?.renderer.removeOverlay(this.polygonOverlay);
    this.polygonOverlay.dispose(); this.polygonOverlay = null;
    this.surfaceComponent?.refresh();
  }
  private createPolygon(create: () => void) {
    const geometry = this.activatedOption.geometry;
    let created: string | undefined;
    const subscription = this.gfx.surface!.elementAdded.subscribe(event => { created = event.id; });
    try {
      create();
      if (created) this.gfx.surface!.updateElement(created, { shapeType: geometry, radius: 0 });
    } finally { subscription.unsubscribe(); }
  }
  override click(event: PointerEventState) { this.createPolygon(() => super.click(event)); }
  override dragStart(event: PointerEventState) { this.createPolygon(() => super.dragStart(event)); }
  override pointerMove(event: PointerEventState) {
    if (!this.polygonOverlay) return;
    [this.polygonOverlay.x, this.polygonOverlay.y] = this.gfx.viewport.toModelCoord(event.x, event.y);
    this.polygonOverlay.globalAlpha = 1; this.surfaceComponent?.refresh();
  }
  override pointerOut() { if (this.polygonOverlay) this.polygonOverlay.globalAlpha = 0; this.surfaceComponent?.refresh(); }
}

export class ClassicalShapesViewExtension extends ViewExtensionProvider {
  override name = 'dali-classical-shapes';
  override setup(context: ViewExtensionContext) {
    super.setup(context);
    if (!this.isEdgeless(context.scope)) return;
    context.register([ClassicalShapeTool, { setup(di) {
      di.override(ShapeElementRendererExtension.identifier, () => renderShape);
      const identifier = shapeDomIdentifier;
      const native = di.provider().get(identifier) as DomElementRenderer<ShapeElementModel>;
      di.override(identifier, () => domShape(native));
    } }]);
  }
}
