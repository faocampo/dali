import { describe, expect, it } from 'vitest';
import { gridMetrics, nearbyDistances, selectionBounds } from './measurement-geometry';
import { DEFAULT_VIEW_PREFERENCES, parseViewPreferences } from './view-preferences';

const selected = { x: 100, y: 100, w: 120, h: 80 };
describe('canvas measurement geometry', () => {
  it('measures the nearest four edge gaps with perpendicular overlap', () => {
    const guides = nearbyDistances(selected, [
      { id: 'left', x: 10, y: 110, w: 40, h: 20 },
      { id: 'right-far', x: 300, y: 110, w: 40, h: 20 },
      { id: 'right', x: 250, y: 110, w: 40, h: 20 },
      { id: 'top', x: 120, y: 20, w: 40, h: 50 },
      { id: 'bottom', x: 130, y: 200, w: 40, h: 40 },
    ], 1);
    expect(Object.fromEntries(guides.map(g => [g.direction, g.distance]))).toEqual({ left: 50, right: 30, top: 30, bottom: 20 });
    expect(guides.find(g => g.direction === 'right')).toMatchObject({ x1: 220, x2: 250, y1: 120, y2: 120, neighbor: 'right' });
  });
  it('ignores overlapping containers, diagonals, invalid bounds and distant objects', () => {
    expect(nearbyDistances(selected, [
      { id: 'overlap', x: 150, y: 150, w: 20, h: 20 },
      { id: 'container', x: 0, y: 0, w: 1000, h: 1000 },
      { id: 'diagonal', x: 250, y: 200, w: 20, h: 20 },
      { id: 'invalid', x: NaN, y: 110, w: 20, h: 20 },
      { id: 'distant', x: 400, y: 110, w: 20, h: 20 },
    ], 1)).toEqual([]);
  });
  it('uses screen proximity while keeping distance units unchanged under zoom', () => {
    const neighbors = [{ id: 'right', x: 340, y: 110, w: 40, h: 20 }];
    expect(nearbyDistances(selected, neighbors, 1)[0]?.distance).toBe(120);
    expect(nearbyDistances(selected, neighbors, 0.5)[0]?.distance).toBe(120);
    expect(nearbyDistances(selected, neighbors, 2)).toEqual([]);
    expect(nearbyDistances(selected, neighbors, 0)).toEqual([]);
  });
  it('combines multi-selection bounds without changing the objects', () => {
    const rects = [selected, { x: -20, y: 80, w: 60, h: 50 }];
    expect(selectionBounds(rects)).toEqual({ x: -20, y: 80, w: 240, h: 100 });
    expect(rects[0]).toEqual(selected);
    expect(selectionBounds([{ x: NaN, y: 1, w: 1, h: 1 }])).toBeNull();
  });
  it('anchors a legible grid to positive and negative world coordinates', () => {
    expect(gridMetrics(20, 1, [-25, 13])).toEqual({ step: 20, x: 15, y: 13 });
    expect(gridMetrics(20, 0.1, [0, 0])).toEqual({ step: 16, x: 0, y: 0 });
    expect(gridMetrics(40, 2, [100, -5])).toEqual({ step: 80, x: 20, y: 75 });
  });
});
describe('view preference recovery', () => {
  it.each([null, '', '{broken', 'null', 'false', '42'])('recovers defaults from %s', raw => {
    expect(parseViewPreferences(raw)).toEqual(DEFAULT_VIEW_PREFERENCES);
  });
  it('accepts only known styles, spacing and explicit booleans', () => {
    expect(parseViewPreferences('{"grid":"lines","spacing":40,"dimensions":true,"distances":true}')).toEqual({ grid: 'lines', spacing: 40, dimensions: true, distances: true });
    expect(parseViewPreferences('{"grid":"url(secret)","spacing":-1,"dimensions":"true","distances":1}')).toEqual(DEFAULT_VIEW_PREFERENCES);
  });
});
