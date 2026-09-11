export type PresentationScope = 'board' | 'visible' | 'selection' | 'frame';
export type ExportScale = 1 | 2 | 4;
export type ExportOptions = Readonly<{
  format: 'png'; scope: PresentationScope; scale: ExportScale;
  background: 'white' | 'transparent'; padding: number;
}>;
export type ExportBounds = Readonly<{ x: number; y: number; w: number; h: number }>;
export type ExportPlan = Readonly<{
  options: ExportOptions; includedIds: readonly string[]; worldBounds: ExportBounds;
  clipBounds: ExportBounds; scale: ExportScale; pixelWidth: number; pixelHeight: number;
  valid: boolean; error: string | null; lowerScale: ExportScale | null; revision: string;
}>;

// Conservative working allocation budget: output plus one active layer, released serially.
export const EXPORT_LIMITS = Object.freeze({ maxSide: 8192, maxPixels: 16_777_216 });
export const DEFAULT_EXPORT_OPTIONS: ExportOptions = Object.freeze({
  format: 'png', scope: 'board', scale: 1, background: 'white', padding: 0,
});

/** Expand identity membership, then preserve renderer order independently of selection order. */
export function selectionIds(ordered: readonly {id: string; children: readonly string[]}[], selected: readonly string[]): string[] {
  const nodes = new Map(ordered.map(node => [node.id, node]));
  const included = new Set<string>();
  const add = (id: string) => {
    if (included.has(id) || !nodes.has(id)) return;
    included.add(id);
    nodes.get(id)!.children.forEach(add);
  };
  selected.forEach(add);
  return ordered.filter(node => included.has(node.id)).map(node => node.id);
}

export function computeExportPlan(
  includedIds: readonly string[], worldBounds: ExportBounds, options: ExportOptions,
  revision = '',
): ExportPlan {
  const { x, y, w, h } = worldBounds;
  let error: string | null = null;
  if (!includedIds.length) error = 'Add an object to this area before exporting.';
  else if (![x, y, w, h, options.padding, x + w, y + h].every(value => Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER) || w <= 0 || h <= 0)
    error = 'The export area has invalid dimensions. Adjust the objects and retry.';
  else if (!Number.isInteger(options.padding) || options.padding < 0 || options.padding > 256)
    error = 'Choose a whole-number padding from 0 to 256.';
  else if (![1, 2, 4].includes(options.scale) || options.format !== 'png' || !['board','visible','selection','frame'].includes(options.scope) || !['white', 'transparent'].includes(options.background))
    error = 'Choose a supported export option.';
  const clipBounds = Object.freeze({ x: x - options.padding, y: y - options.padding, w: w + options.padding * 2, h: h + options.padding * 2 });
  const dimensions = (scale: number) => [Math.ceil(clipBounds.w * scale), Math.ceil(clipBounds.h * scale)];
  const fits = (scale: number) => {
    const [width, height] = dimensions(scale);
    return Number.isSafeInteger(width) && Number.isSafeInteger(height) && width! > 0 && height! > 0 && width! <= EXPORT_LIMITS.maxSide && height! <= EXPORT_LIMITS.maxSide && width! * height! <= EXPORT_LIMITS.maxPixels;
  };
  const [pixelWidth, pixelHeight] = dimensions(options.scale);
  let lowerScale: ExportScale | null = null;
  if (!error && !fits(options.scale)) {
    lowerScale = ([4, 2, 1] as const).find(scale => scale < options.scale && fits(scale)) ?? null;
    error = lowerScale ? 'This resolution exceeds the supported export size. Choose a lower scale.' : 'This area exceeds the supported export size at every scale. Choose a smaller area.';
  }
  return Object.freeze({ options: Object.freeze({ ...options }), includedIds: Object.freeze([...includedIds]), worldBounds: Object.freeze({ ...worldBounds }), clipBounds, scale: options.scale, pixelWidth: pixelWidth!, pixelHeight: pixelHeight!, valid: !error, error, lowerScale, revision });
}
