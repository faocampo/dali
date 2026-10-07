import { describe, it, expect } from 'vitest';
import { findInsertionRect } from './insertion-geometry';
import type { Rect } from './measurement-geometry';
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

describe('automatic canvas placement', () => {
  const view = { x: -800, y: 300, w: 1000, h: 600 };
  const size = { w: 260, h: 260 };
  it('centers empty boards and avoids visible occupied space with a gap', () => {
    const first = findInsertionRect(view, size, [], 16);
    expect(first).toEqual({ x: -430, y: 470, ...size });
    const second = findInsertionRect(view, size, [first], 16);
    expect(overlaps(first, second)).toBe(false);
    expect(Math.abs(second.x - first.x)).toBe(276);
    expect(second.x).toBeGreaterThanOrEqual(view.x);
    expect(second.x + second.w).toBeLessThanOrEqual(view.x + view.w);
  });
  it('finds narrow gaps bounded by multiple obstacles', () => {
    const bounds = { x: 0, y: 0, w: 500, h: 500 };
    const occupied = [{ x: 0, y: 0, w: 200, h: 500 }, { x: 320, y: 0, w: 180, h: 500 }, { x: 200, y: 0, w: 120, h: 200 }];
    expect(findInsertionRect(bounds, { w: 100, h: 100 }, occupied, 10)).toEqual({ x: 210, y: 210, w: 100, h: 100 });
  });
  it('falls back to a visible center for a full viewport or oversized object', () => {
    expect(findInsertionRect(view, size, [view], 16)).toEqual({ x: -430, y: 470, ...size });
    expect(findInsertionRect(view, { w: 2000, h: 1000 }, [], 16)).toEqual({ x: -1300, y: 100, w: 2000, h: 1000 });
  });
  it('ignores invalid and offscreen bounds', () => {
    expect(findInsertionRect(view, size, [{ x: NaN, y: 0, w: 100, h: 100 }, { x: 10000, y: 10000, w: 100, h: 100 }], 16)).toEqual(findInsertionRect(view, size, [], 16));
  });
});
