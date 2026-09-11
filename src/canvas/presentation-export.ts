import { CanvasRenderer, ExportManager, RoughCanvas } from '@blocksuite/affine/blocks/surface';
import type { EditorHost } from '@blocksuite/affine/std';
import {
  GfxControllerIdentifier,
  isGfxGroupCompatibleModel,
  isPrimitiveModel,
  type GfxBlockElementModel,
  type GfxModel,
  type GfxPrimitiveElementModel,
} from '@blocksuite/affine/std/gfx';
import { Bound } from '@blocksuite/global/gfx';

import { computeExportPlan, DEFAULT_EXPORT_OPTIONS, selectionIds, type ExportOptions, type ExportPlan, type PresentationScope } from "./export-plan";
export type { PresentationScope } from "./export-plan";
export type PresentationRenderOptions = { scope: PresentationScope; transparent?: boolean; scale?: 1 | 2 | 4; plan?: ExportPlan };

export type PresentationRender = {
  canvas: HTMLCanvasElement;
  contentBound: Bound;
  objectCount: number;
  durationMs: number;
  estimatedBytes: number;
};

export type PresentationScopeAvailability = Record<PresentationScope, boolean>;


function editorHost(): EditorHost {
  const host = document.querySelector('editor-host') as EditorHost | null;
  if (!host) throw new Error('The canvas is not ready to export.');
  return host;
}

export function presentationScopeAvailability(): PresentationScopeAvailability {
  const host = editorHost();
  const selected = host.std.get(GfxControllerIdentifier).selection.selectedElements;
  const candidate = selected[0];
  return {
    board: true,
    visible: true,
    selection: selected.length > 0,
    frame:
      selected.length === 1 &&
      !!candidate &&
      !isPrimitiveModel(candidate) &&
      candidate.flavour === 'affine:frame',
  };
}

function unitedBound(models: readonly GfxModel[]): Bound {
  if (!models.length) throw new Error('There is nothing in this export scope.');
  return models.slice(1).reduce(
    (bound, model) => bound.unite(model.elementBound),
    models[0]!.elementBound.clone()
  );
}

function withDescendants(models: readonly GfxModel[]): GfxModel[] {
  const result = new Map<string, GfxModel>();
  const add = (model: GfxModel) => {
    if (result.has(model.id)) return;
    result.set(model.id, model);
    if (isGfxGroupCompatibleModel(model)) model.descendantElements.forEach(add);
  };
  models.forEach(add);
  return [...result.values()];
}

function resolveScope(host: EditorHost, scope: PresentationScope) {
  const gfx = host.std.get(GfxControllerIdentifier);
  if (scope === 'board') {
    const models = withDescendants(gfx.gfxElements);
    return { models, bound: unitedBound(models) };
  }
  if (scope === 'visible') {
    const bound = gfx.viewport.viewportBounds;
    return { models: withDescendants(gfx.getElementsByBound(bound, { type: 'all' })), bound };
  }
  if (scope === 'selection') {
    const selected = gfx.selection.selectedElements;
    if (!selected.length) throw new Error('Select one or more objects before exporting the selection.');
    const layers = gfx.layer.layers.flatMap<GfxModel>(layer => layer.elements);
    const ordered = [...new Map([...layers, ...withDescendants(layers)].map(model => [model.id, model])).values()];
    const ids = new Set(selectionIds(ordered.map(model => ({id: model.id, children: isGfxGroupCompatibleModel(model) ? model.descendantElements.map(child => child.id) : []})), selected.map(model => model.id)));
    const models = ordered.filter(model => ids.has(model.id));
    return { models, bound: unitedBound(models) };
  }

  const selected = gfx.selection.selectedElements;
  const candidate = selected[0];
  const frame =
    selected.length === 1 && candidate && !isPrimitiveModel(candidate) && candidate.flavour === 'affine:frame'
      ? candidate
      : null;
  if (!frame) throw new Error('Select one frame before exporting a frame.');
  const bound = frame.elementBound.clone();
  // A frame defines the crop; its editor-only border/title are not presentation
  // content. Nested objects remain ordinary layers and retain their z-order.
  const models = gfx.getElementsByBound(bound, { type: 'all' }).filter(model => model.id !== frame.id);
  return { models: withDescendants(models), bound };
}

function revision(host: EditorHost): string {
  return JSON.stringify([host.store.id, host.store.spaceDoc.toJSON(), host.std.get(GfxControllerIdentifier).selection.selectedElements.map(m => m.id)]);
}

export function boardExportPlan(options: ExportOptions): ExportPlan {
  const host = editorHost();
  try {
    const { models, bound } = resolveScope(host, options.scope);
    // Native elementBound already includes rotated corners and connector labels.
    // Include stroke caps/arrowheads in addition to those native geometry bounds.
    const visual = models.map(model => {
      const b = model.elementBound.clone();
      const stroke = 'strokeWidth' in model && typeof model.strokeWidth === 'number' ? model.strokeWidth : 0;
      const margin = 'type' in model && model.type === 'connector' ? Math.max(12, stroke * 4) : stroke / 2;
      return new Bound(b.x - margin, b.y - margin, b.w + margin * 2, b.h + margin * 2);
    });
    const world = options.scope === 'board' || options.scope === 'selection'
      ? visual.slice(1).reduce((a, b) => a.unite(b), visual[0]!) : bound;
    return computeExportPlan(models.map(m => m.id), world, options, revision(host));
  } catch (cause) {
    const plan = computeExportPlan([], { x: 0, y: 0, w: 0, h: 0 }, options, revision(host));
    return Object.freeze({ ...plan, error: cause instanceof Error ? cause.message : 'Refresh the export area and retry.' });
  }
}

function bounded<T>(promise: Promise<T>, label: string, ms = 10_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} took too long. Retry the export.`)), ms);
    promise.then(value => { clearTimeout(timer); resolve(value); }, cause => { clearTimeout(timer); reject(cause); });
  });
}

// Pinned BlockSuite 0.22.4 internal seams. Public methods hardcode screen DPR.
// Keep the native render functions; fail closed if the installed seam changes.
type NativeRaster = {
  _renderByBound(ctx: CanvasRenderingContext2D, matrix: DOMMatrix, rough: RoughCanvas, bound: Bound, elements: GfxPrimitiveElementModel[]): void;
};
type NativeDomRaster = {
  _html2canvas(element: HTMLElement, options: {
    scale: number; backgroundColor: null; logging: false; width: number; height: number;
    onclone(document: Document, element: HTMLElement): Promise<void>;
  }): Promise<HTMLCanvasElement>;
};

export async function renderBoardPresentation(options: PresentationRenderOptions): Promise<PresentationRender> {
  const startedAt = performance.now();
  const host = editorHost();
  const gfx = host.std.get(GfxControllerIdentifier);
  const plan = options.plan ?? boardExportPlan({ ...DEFAULT_EXPORT_OPTIONS, scope: options.scope, scale: options.scale ?? 1, background: options.transparent ? 'transparent' : 'white' });
  if (!plan.valid) throw new Error(plan.error!);
  const assertCurrent = () => {
    if (!host.isConnected || editorHost() !== host || revision(host) !== plan.revision)
      throw new Error('The board or selection changed. Refresh the preview and retry.');
  };
  assertCurrent();
  await bounded(document.fonts.ready, 'Font loading');
  const renderer = (gfx.surfaceComponent as { renderer?: CanvasRenderer }).renderer;
  const native = renderer as unknown as NativeRaster;
  const dom = host.std.get(ExportManager) as unknown as NativeDomRaster;
  if (!(renderer instanceof CanvasRenderer) || typeof native._renderByBound !== 'function' || typeof dom._html2canvas !== 'function')
    throw new Error('This editor version cannot render at the requested resolution.');
  const { x, y, w, h } = plan.clipBounds;
  const bound = new Bound(x, y, w, h);
  const canvas = document.createElement('canvas');
  canvas.width = plan.pixelWidth;
  canvas.height = plan.pixelHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('The browser could not allocate the export. Choose a lower scale and retry.');
  if (plan.options.background === 'white') {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  const included = new Set(plan.includedIds);
  try {
    for (const layer of gfx.layer.layers) {
      const elements = layer.elements.filter(model => included.has(model.id));
      if (!elements.length) continue;
      if (layer.type === 'canvas') {
        ctx.save();
        const matrix = new DOMMatrix().scaleSelf(plan.scale);
        ctx.setTransform(matrix);
        native._renderByBound(ctx, matrix, new RoughCanvas(canvas), bound, elements as GfxPrimitiveElementModel[]);
        continue;
      }
      for (const model of elements as GfxBlockElementModel[]) {
        const [bx, by, bw, bh] = JSON.parse(model.xywh) as number[];
        let source: CanvasImageSource;
        let release = () => {};
        if (model.flavour === 'affine:image') {
          const sourceId = (model as GfxBlockElementModel & { props: { sourceId: string } }).props.sourceId;
          const blob = sourceId && await bounded(host.store.blobSync.get(sourceId), 'Image loading');
          if (!blob) throw new Error('An image is missing. Restore the image and retry.');
          const url = URL.createObjectURL(blob);
          const image = new Image(); image.src = url;
          try { await bounded(image.decode(), 'Image decoding'); } catch { URL.revokeObjectURL(url); throw new Error('An image could not be decoded. Restore it and retry.'); }
          source = image; release = () => URL.revokeObjectURL(url);
        } else {
          const element = host.view.getBlock(model.id) as HTMLElement | null;
          if (!element) throw new Error('An object is still loading. Retry the export.');
          // html2canvas copies custom-element computed styles before onclone;
          // activate the source while cloning so descendants inherit visibility.
          const previousVisibility = element.style.visibility;
          let cloneFrame: Element | null = null;
          let finished = false;
          element.style.visibility = 'visible';
          try { source = await bounded(dom._html2canvas(element, {
            scale: plan.scale, backgroundColor: null, logging: false, width: bw!, height: bh!,
            onclone: async (_document, clone) => {
              cloneFrame = _document.defaultView?.frameElement ?? null;
              if (finished) { cloneFrame?.remove(); throw new Error('Object rendering expired. Retry the export.'); }
              for (let node: HTMLElement | null = clone; node; node = node.parentElement) {
                node.style.transform = 'none'; node.style.contentVisibility = 'visible';
                // GfxViewportElement keeps offscreen blocks in layout as .block-idle.
                node.classList.remove('block-idle'); node.style.visibility = 'visible';
              }
              clone.style.width = `${bw}px`; clone.style.height = `${bh}px`;
              await bounded(_document.fonts.ready, 'Font loading');
            },
          }), 'Object rendering'); } finally {
            finished = true;
            (cloneFrame as Element | null)?.remove();
            element.style.visibility = previousVisibility;
          }
          const raster = source as HTMLCanvasElement;
          if (raster.width !== Math.floor(bw! * plan.scale) || raster.height !== Math.floor(bh! * plan.scale))
            throw new Error('An object could not be rendered at the requested scale.');
          release = () => { raster.width = 0; raster.height = 0; };
        }
        try {
          ctx.save(); ctx.scale(plan.scale, plan.scale);
          ctx.translate(bx! - x + bw! / 2, by! - y + bh! / 2);
          ctx.rotate((model.rotate || 0) * Math.PI / 180);
          ctx.drawImage(source, -bw! / 2, -bh! / 2, bw!, bh!); ctx.restore();
        } finally { release(); }
      }
      assertCurrent();
    }
    assertCurrent();
    // Verify origin-clean pixels before encoding, so taint remains an actionable error.
    ctx.getImageData(0, 0, 1, 1);
    return { canvas, contentBound: bound, objectCount: included.size, durationMs: performance.now() - startedAt, estimatedBytes: canvas.width * canvas.height * 4 };
  } catch (cause) {
    canvas.width = 0; canvas.height = 0;
    throw cause;
  }
}
