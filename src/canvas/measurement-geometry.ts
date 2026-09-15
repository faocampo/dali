export type Rect = { x: number; y: number; w: number; h: number };
export type Measurable = Rect & { id: string };
export type DistanceGuide = {
  direction: 'left' | 'right' | 'top' | 'bottom';
  neighbor: string;
  x1: number; y1: number; x2: number; y2: number;
  distance: number;
};
export const NEARBY_DISTANCE_PX = 160;
export const validRect = (r: Rect) => [r.x, r.y, r.w, r.h].every(Number.isFinite) && r.w >= 0 && r.h >= 0;
export const intersects = (a: Rect, b: Rect) => a.x + a.w >= b.x && b.x + b.w >= a.x && a.y + a.h >= b.y && b.y + b.h >= a.y;

export function selectionBounds(rects: Rect[]): Rect | null {
  let x = Infinity, y = Infinity, right = -Infinity, bottom = -Infinity;
  for (const rect of rects) {
    if (!validRect(rect)) continue;
    x = Math.min(x, rect.x); y = Math.min(y, rect.y);
    right = Math.max(right, rect.x + rect.w); bottom = Math.max(bottom, rect.y + rect.h);
  }
  return Number.isFinite(x) ? { x, y, w: right - x, h: bottom - y } : null;
}

/** Nearest visible edge in each direction, where the perpendicular spans overlap. */
export function nearbyDistances(selected: Rect, neighbors: Measurable[], zoom: number): DistanceGuide[] {
  if (!validRect(selected) || !Number.isFinite(zoom) || zoom <= 0) return [];
  const nearest = new Map<DistanceGuide['direction'], DistanceGuide>();
  const add = (guide: DistanceGuide) => {
    if (guide.distance < 0 || guide.distance * zoom > NEARBY_DISTANCE_PX) return;
    const current = nearest.get(guide.direction);
    if (!current || guide.distance < current.distance || (guide.distance === current.distance && guide.neighbor < current.neighbor)) nearest.set(guide.direction, guide);
  };
  for (const other of neighbors) {
    if (!validRect(other)) continue;
    const left = Math.max(selected.x, other.x), right = Math.min(selected.x + selected.w, other.x + other.w);
    const top = Math.max(selected.y, other.y), bottom = Math.min(selected.y + selected.h, other.y + other.h);
    if (bottom > top) {
      const y = (top + bottom) / 2;
      if (other.x >= selected.x + selected.w) add({ direction: 'right', neighbor: other.id, x1: selected.x + selected.w, x2: other.x, y1: y, y2: y, distance: other.x - selected.x - selected.w });
      if (other.x + other.w <= selected.x) add({ direction: 'left', neighbor: other.id, x1: other.x + other.w, x2: selected.x, y1: y, y2: y, distance: selected.x - other.x - other.w });
    }
    if (right > left) {
      const x = (left + right) / 2;
      if (other.y >= selected.y + selected.h) add({ direction: 'bottom', neighbor: other.id, x1: x, x2: x, y1: selected.y + selected.h, y2: other.y, distance: other.y - selected.y - selected.h });
      if (other.y + other.h <= selected.y) add({ direction: 'top', neighbor: other.id, x1: x, x2: x, y1: other.y + other.h, y2: selected.y, distance: selected.y - other.y - other.h });
    }
  }
  return [...nearest.values()];
}

/** Keep the grid legible at low zoom; every shown line still falls on a base-grid multiple. */
export function gridMetrics(spacing: number, zoom: number, origin: [number, number]) {
  const base = spacing * zoom;
  const step = base > 0 && Number.isFinite(base) ? base * 2 ** Math.max(0, Math.ceil(Math.log2(12 / base))) : 20;
  const modulo = (value: number) => ((value % step) + step) % step;
  return { step, x: modulo(origin[0]), y: modulo(origin[1]) };
}
export function measurementLabel(value: number): string {
  return `${Math.round(value * 10) / 10} px`;
}
