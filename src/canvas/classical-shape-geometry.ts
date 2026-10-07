export type Vertex = [number, number];

function regular(sides: number, innerRadius?: number): Vertex[] {
  const count = innerRadius ? sides * 2 : sides;
  const points: Vertex[] = Array.from({ length: count }, (_, i) => {
    const angle = -Math.PI / 2 + i * Math.PI * 2 / count;
    const radius = innerRadius && i % 2 ? innerRadius : 1;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius];
  });
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const left = Math.min(...xs), top = Math.min(...ys);
  const width = Math.max(...xs) - left, height = Math.max(...ys) - top;
  return points.map(([x, y]) => [(x - left) / width, (y - top) / height]);
}

export const classicalShapes = [
  { id: 'dali:star', name: 'Star', points: regular(5, 0.42) },
  { id: 'dali:pentagon', name: 'Pentagon', points: regular(5) },
  { id: 'dali:hexagon', name: 'Hexagon', points: regular(6) },
  { id: 'dali:octagon', name: 'Octagon', points: regular(8) },
  { id: 'dali:right-arrow', name: 'Right arrow', points: [[0, .3], [.6, .3], [.6, 0], [1, .5], [.6, 1], [.6, .7], [0, .7]] },
  { id: 'dali:left-arrow', name: 'Left arrow', points: [[1, .3], [.4, .3], [.4, 0], [0, .5], [.4, 1], [.4, .7], [1, .7]] },
  { id: 'dali:double-arrow', name: 'Double arrow', points: [[0, .5], [.3, 0], [.3, .3], [.7, .3], [.7, 0], [1, .5], [.7, 1], [.7, .7], [.3, .7], [.3, 1]] },
  { id: 'dali:parallelogram', name: 'Parallelogram', points: [[.25, 0], [1, 0], [.75, 1], [0, 1]] },
  { id: 'dali:trapezoid', name: 'Trapezoid', points: [[.25, 0], [.75, 0], [1, 1], [0, 1]] },
  { id: 'dali:cross', name: 'Cross', points: [[.33, 0], [.67, 0], [.67, .33], [1, .33], [1, .67], [.67, .67], [.67, 1], [.33, 1], [.33, .67], [0, .67], [0, .33], [.33, .33]] },
  { id: 'dali:right-triangle', name: 'Right triangle', points: [[0, 0], [1, 1], [0, 1]] },
] satisfies { id: string; name: string; points: Vertex[] }[];

export function classicalShape(type: string) { return classicalShapes.find(shape => shape.id === type); }
export function polygonPoints(type: string, x: number, y: number, width: number, height: number): Vertex[] {
  return classicalShape(type)!.points.map(([px, py]) => [x + px * width, y + py * height]);
}
export function shapeIconPath(type: string) {
  return polygonPoints(type, 2, 2, 20, 20).map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join('') + 'Z';
}
