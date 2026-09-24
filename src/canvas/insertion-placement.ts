import type { BlockStdScope } from '@blocksuite/affine/std';
import { GfxControllerIdentifier, isPrimitiveModel } from '@blocksuite/affine/std/gfx';
import { canvasModelVisible } from './selection-summary';
import type { Rect } from './measurement-geometry';

import { findInsertionRect } from './insertion-geometry';

/** Automatic toolbar/paste placement; explicit drawing/drop coordinates stay intact. */
export function canvasInsertionRect(std: BlockStdScope, w: number, h: number, exclude: string[] = []): Rect {
  const gfx = std.get(GfxControllerIdentifier);
  const { viewport } = gfx;
  const [x, y] = viewport.toModelCoord(88, 60);
  const view = { x, y, w: Math.max(1, viewport.width - 112) / viewport.zoom, h: Math.max(1, viewport.height - 140) / viewport.zoom };
  const excluded = new Set(exclude);
  const occupied = gfx.gfxElements.filter(model => !excluded.has(model.id) && canvasModelVisible(model)
    && !(isPrimitiveModel(model) && ['group', 'mindmap'].includes(model.type))).map(model => model.elementBound);
  return findInsertionRect(view, { w, h }, occupied, 16 / viewport.zoom, viewport.center);
}
export const serializeInsertionRect = ({ x, y, w, h }: Rect) => `[${x},${y},${w},${h}]` as const;
