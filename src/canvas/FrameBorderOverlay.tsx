import { useEffect, useMemo, useState } from 'react';
import type { FrameBlockModel } from '@blocksuite/affine/model';
import type { EditorHost } from '@blocksuite/affine/std';
import { GfxControllerIdentifier } from '@blocksuite/affine/std/gfx';
import { Bound } from '@blocksuite/global/gfx';

type FrameView = {
  frame: FrameBlockModel;
  x: number;
  y: number;
  width: number;
  height: number;
};

const HIT_SIZE = 14;
const CORNER_GAP = 24;
const EDGE_HANDLE_GAP = 24;

/**
 * Makes transparent frames easy to pick up without turning their interiors
 * into click targets. Each border is split around the corner and edge resize
 * controls, so moving and resizing remain distinct interactions.
 */
export function FrameBorderOverlay({ host }: { host: EditorHost }) {
  const [revision, setRevision] = useState(0);
  const gfx = host.std.get(GfxControllerIdentifier);

  useEffect(() => {
    const refresh = () => setRevision(value => value + 1);
    const viewport = gfx.viewport.viewportUpdated.subscribe(refresh);
    const blocks = host.std.store.slots.blockUpdated.subscribe(event => {
      if (event.flavour === 'affine:frame') refresh();
    });
    return () => {
      viewport.unsubscribe();
      blocks.unsubscribe();
    };
  }, [gfx, host]);

  const frames = useMemo(() => host.std.store
    .getBlocksByFlavour('affine:frame')
    .map(block => block.model as FrameBlockModel)
    .map(frame => {
      const [x, y, width, height] = gfx.viewport.toViewBound(frame.elementBound).toXYWH();
      return { frame, x, y, width, height };
    }), [gfx, host, revision]);

  return (
    <div className="frame-border-overlay" aria-hidden="true">
      {frames.flatMap(frame => frameBorderSegments(frame).map((segment, index) => (
        <div
          key={`${frame.frame.id}-${index}`}
          className="frame-border-hit-zone"
          style={segment}
          onPointerDown={event => beginFrameMove(host, frame.frame, event)}
        />
      )))}
    </div>
  );
}

function frameBorderSegments(frame: FrameView): React.CSSProperties[] {
  const { x, y, width, height } = frame;
  const halfHit = HIT_SIZE / 2;
  const horizontalLength = Math.max(0, width / 2 - CORNER_GAP - EDGE_HANDLE_GAP);
  const verticalLength = Math.max(0, height / 2 - CORNER_GAP - EDGE_HANDLE_GAP);
  const horizontalStarts = [x + CORNER_GAP, x + width / 2 + EDGE_HANDLE_GAP];
  const verticalStarts = [y + CORNER_GAP, y + height / 2 + EDGE_HANDLE_GAP];
  const segments: React.CSSProperties[] = [];

  if (horizontalLength > 0) {
    for (const left of horizontalStarts) {
      segments.push({ left, top: y - halfHit, width: horizontalLength, height: HIT_SIZE });
      segments.push({ left, top: y + height - halfHit, width: horizontalLength, height: HIT_SIZE });
    }
  }
  if (verticalLength > 0) {
    for (const top of verticalStarts) {
      segments.push({ left: x - halfHit, top, width: HIT_SIZE, height: verticalLength });
      segments.push({ left: x + width - halfHit, top, width: HIT_SIZE, height: verticalLength });
    }
  }
  return segments;
}

function beginFrameMove(
  host: EditorHost,
  frame: FrameBlockModel,
  event: React.PointerEvent<HTMLDivElement>
) {
  if (event.button !== 0 || frame.isLocked()) return;
  event.preventDefault();
  event.stopPropagation();

  const gfx = host.std.get(GfxControllerIdentifier);
  gfx.selection.set({ elements: [frame.id], editing: false });

  const models = [frame, ...frame.descendantElements];
  const elements = models.flatMap(model => {
    const view = gfx.view.get(model);
    return view ? [{ model, view, originalBound: Bound.deserialize(model.xywh) }] : [];
  });
  if (!elements.length) return;

  const target = event.currentTarget;
  const pointerId = event.pointerId;
  const start = gfx.viewport.toModelCoordFromClientCoord([event.clientX, event.clientY]);
  let dx = 0;
  let dy = 0;
  target.setPointerCapture(pointerId);
  host.std.store.captureSync();
  elements.forEach(({ view, originalBound }) => {
    view.onDragStart({ currentBound: originalBound, elements });
  });

  const move = (moveEvent: PointerEvent) => {
    const point = gfx.viewport.toModelCoordFromClientCoord([moveEvent.clientX, moveEvent.clientY]);
    dx = point[0] - start[0];
    dy = point[1] - start[1];
    elements.forEach(({ view, originalBound }) => {
      view.onDragMove({ currentBound: originalBound, dx, dy, elements });
    });
  };
  const finish = () => {
    target.removeEventListener('pointermove', move);
    target.removeEventListener('pointerup', finish);
    target.removeEventListener('pointercancel', finish);
    host.std.store.transact(() => {
      elements.forEach(({ view, originalBound }) => {
        view.onDragEnd({ currentBound: originalBound.moveDelta(dx, dy), dx, dy, elements });
      });
    });
    host.std.store.captureSync();
  };
  target.addEventListener('pointermove', move);
  target.addEventListener('pointerup', finish);
  target.addEventListener('pointercancel', finish);
}
