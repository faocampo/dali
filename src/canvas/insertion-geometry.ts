import { intersects, validRect, type Rect } from './measurement-geometry';

/** Find the nearest free rectangle using obstacle edges and vertical free intervals.
 * Coordinates are model pixels; the caller supplies viewport chrome insets.
 * If the viewport is full (or the object is larger), keep its center visible.
 */
export function findInsertionRect(view: Rect, size: { w: number; h: number }, occupied: Rect[], gap: number, preferred = { x: view.x + view.w / 2, y: view.y + view.h / 2 }): Rect {
  const { w, h } = size;
  const center = { x: preferred.x - w / 2, y: preferred.y - h / 2, w, h };
  if (w > view.w || h > view.h) return center;
  center.x = Math.max(view.x, Math.min(view.x + view.w - w, center.x));
  center.y = Math.max(view.y, Math.min(view.y + view.h - h, center.y));
  const obstacles = occupied.filter(rect => validRect(rect) && intersects(rect, view)).map(rect => ({
    x: rect.x - gap, y: rect.y - gap, w: rect.w + gap * 2, h: rect.h + gap * 2,
  }));
  const right = view.x + view.w - w;
  const bottom = view.y + view.h;
  const xs = new Set([center.x, view.x, right, ...obstacles.flatMap(rect => [rect.x - w, rect.x + rect.w])]);
  let best: Rect | undefined;
  let distance = Infinity;
  for (const x of xs) {
    if (x < view.x || x > right) continue;
    const intervals = obstacles.filter(rect => x < rect.x + rect.w && x + w > rect.x).sort((a, b) => a.y - b.y);
    let top = view.y;
    const consider = (end: number) => {
      if (end - top < h) return;
      const y = Math.max(top, Math.min(end - h, center.y));
      const nextDistance = (x - center.x) ** 2 + (y - center.y) ** 2;
      if (nextDistance < distance) { best = { x, y, w, h }; distance = nextDistance; }
    };
    for (const rect of intervals) {
      consider(Math.min(bottom, rect.y));
      top = Math.max(top, rect.y + rect.h);
      if (top >= bottom) break;
    }
    consider(bottom);
  }
  return best ?? center;
}
