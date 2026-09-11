import { CanvasRenderer, ExportManager } from '@blocksuite/affine/blocks/surface';
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

export type PresentationScope = 'board' | 'visible' | 'selection' | 'frame';

export type PresentationRenderOptions = {
  scope: PresentationScope;
  transparent?: boolean;
};

export type PresentationRender = {
  canvas: HTMLCanvasElement;
  contentBound: Bound;
  objectCount: number;
  durationMs: number;
  estimatedBytes: number;
};

export type PresentationScopeAvailability = Record<PresentationScope, boolean>;

const MAX_OUTPUT_SIDE = 16_384;
const MAX_OUTPUT_PIXELS = 64_000_000;
const EXPORT_PADDING = 50;

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
    const models = withDescendants(selected);
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

function assertSafeCanvas(bound: Bound, dpr: number): void {
  const width = Math.ceil((bound.w + EXPORT_PADDING * 2) * dpr);
  const height = Math.ceil((bound.h + EXPORT_PADDING * 2) * dpr);
  if (width > MAX_OUTPUT_SIDE || height > MAX_OUTPUT_SIDE || width * height > MAX_OUTPUT_PIXELS) {
    throw new Error(
      `This output would be ${width.toLocaleString()} × ${height.toLocaleString()} pixels. ` +
      'Choose Visible area, a smaller selection, or a frame to keep the browser responsive.'
    );
  }
}

function drawPaperGround(
  canvas: HTMLCanvasElement,
  host: EditorHost,
  transparent: boolean,
  dpr: number
): void {
  if (transparent) return;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('The browser could not create the export canvas.');
  const root = host.view.getBlock(host.store.root!.id) as HTMLElement | null;
  const viewport = root?.querySelector('.affine-edgeless-viewport') ?? root;
  const styles = window.getComputedStyle(viewport ?? document.documentElement);
  const background = styles.getPropertyValue('--affine-background-primary-color').trim() || '#fbfaf7';
  const grid = styles.getPropertyValue('--affine-edgeless-grid-color').trim() || '#d6d1c8';
  const gap = 20 * dpr;
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = grid;
  for (let y = gap / 2; y < canvas.height; y += gap) {
    for (let x = gap / 2; x < canvas.width; x += gap) {
      context.beginPath();
      context.arc(x, y, Math.max(0.7, dpr), 0, Math.PI * 2);
      context.fill();
    }
  }
}

/**
 * Render canvas primitives and DOM blocks in the same layer order as the live
 * editor. The returned canvas is detached and has 50 CSS px of safe padding.
 */
export async function renderBoardPresentation(
  options: PresentationRenderOptions
): Promise<PresentationRender> {
  const startedAt = performance.now();
  const host = editorHost();
  const gfx = host.std.get(GfxControllerIdentifier);
  const { models, bound } = resolveScope(host, options.scope);
  const dpr = window.devicePixelRatio || 1;
  assertSafeCanvas(bound, dpr);

  const surface = gfx.surfaceComponent as { renderer?: unknown } | null;
  if (!(surface?.renderer instanceof CanvasRenderer)) {
    throw new Error('The canvas renderer is not ready for presentation export.');
  }
  const manager = host.std.get(ExportManager);
  const width = Math.ceil((bound.w + EXPORT_PADDING * 2) * dpr);
  const height = Math.ceil((bound.h + EXPORT_PADDING * 2) * dpr);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  drawPaperGround(canvas, host, !!options.transparent, dpr);

  const included = new Set(models.map(model => model.id));
  const root = host.view.getBlock(host.store.root!.id) as HTMLElement | null;
  const container = root?.querySelector('.affine-block-children-container') as HTMLElement | null;
  const previousBackground = container?.style.backgroundColor ?? '';
  if (container) container.style.backgroundColor = 'transparent';

  try {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('The browser could not create the export canvas.');
    for (const layer of gfx.layer.layers) {
      const elements = layer.elements.filter(model => included.has(model.id));
      if (!elements.length) continue;
      if (layer.type === 'canvas') {
        const layerCanvas = surface.renderer.getCanvasByBound(
          bound,
          elements as GfxPrimitiveElementModel[]
        );
        context.drawImage(
          layerCanvas,
          EXPORT_PADDING * dpr,
          EXPORT_PADDING * dpr,
          Math.ceil(bound.w * dpr),
          Math.ceil(bound.h * dpr)
        );
        continue;
      }
      const layerCanvas = await manager.edgelessToCanvas(
        surface.renderer,
        bound,
        gfx,
        elements as GfxBlockElementModel[],
        []
      );
      if (!layerCanvas) throw new Error('A canvas layer could not be rendered.');
      context.drawImage(layerCanvas, 0, 0, width, height);
    }
  } finally {
    if (container) container.style.backgroundColor = previousBackground;
  }

  return {
    canvas,
    contentBound: bound,
    objectCount: models.length,
    durationMs: performance.now() - startedAt,
    estimatedBytes: width * height * 4,
  };
}
