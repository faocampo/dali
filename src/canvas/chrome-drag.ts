/**
 * Dragging the floating chrome around.
 *
 * BlockSuite's bottom object toolbar can be repositioned by its grab handle.
 * Position is a UI preference, not board content, so it is kept in localStorage
 * rather than in the document.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type Point = { x: number; y: number };

/** Keep a point inside the window, allowing for the thing being positioned. */
function clamp(point: Point, size: { width: number; height: number }): Point {
  const margin = 8;
  const maxX = Math.max(margin, window.innerWidth - size.width - margin);
  const maxY = Math.max(margin, window.innerHeight - size.height - margin);
  return {
    x: Math.min(Math.max(point.x, margin), maxX),
    y: Math.min(Math.max(point.y, margin), maxY),
  };
}

function read(key: string): Point | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Point>;
    if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number') return null;
    return { x: parsed.x, y: parsed.y };
  } catch {
    // Corrupt or unavailable storage just means "no saved position".
    return null;
  }
}

function write(key: string, point: Point): void {
  try {
    localStorage.setItem(key, JSON.stringify(point));
  } catch {
    // Private-browsing quota. The toolbar still moves; it just will not persist.
  }
}

/**
 * Drag state for one piece of chrome.
 *
 * `position` is null until the element has been measured, which is what lets
 * the caller fall back to its CSS default instead of guessing coordinates
 * before layout.
 */
export function useDragPosition(storageKey: string, ref: { current: HTMLElement | null }) {
  const [position, setPosition] = useState<Point | null>(() => read(storageKey));
  const dragging = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);

  const sizeOf = useCallback((): { width: number; height: number } => {
    const rect = ref.current?.getBoundingClientRect();
    return { width: rect?.width ?? 0, height: rect?.height ?? 0 };
  }, [ref]);

  const onHandlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const el = ref.current;
      if (!el) return;
      // Left button / primary touch only, and never let the canvas below start
      // a selection rectangle from the same gesture.
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();

      const rect = el.getBoundingClientRect();
      dragging.current = {
        pointerId: event.pointerId,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [ref]
  );

  const onHandlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const drag = dragging.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      event.preventDefault();
      setPosition(
        clamp({ x: event.clientX - drag.offsetX, y: event.clientY - drag.offsetY }, sizeOf())
      );
    },
    [sizeOf]
  );

  const onHandlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const drag = dragging.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      dragging.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      setPosition((current) => {
        if (current) write(storageKey, current);
        return current;
      });
    },
    [storageKey]
  );

  // A saved position can fall outside a smaller window. Pull it back in rather
  // than leaving the toolbar stranded off-screen with no way to grab it.
  useEffect(() => {
    const onResize = () => {
      setPosition((current) => (current ? clamp(current, sizeOf()) : current));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [sizeOf]);

  const handleProps = {
    onPointerDown: onHandlePointerDown,
    onPointerMove: onHandlePointerMove,
    onPointerUp: onHandlePointerUp,
    onPointerCancel: onHandlePointerUp,
  };

  return { position, handleProps };
}

/**
 * Drag state expressed as an OFFSET from wherever CSS already put something.
 *
 * BlockSuite's toolbar host is a full-width strip across the bottom of the
 * window, not the visible bar, so its bounding rect is useless for positioning
 * by top-left corner. Nudging it from its own default is both simpler and
 * leaves BlockSuite's layout rules in charge of everything else.
 */
export function useDragOffset(storageKey: string) {
  const [offset, setOffset] = useState<Point>(() => read(storageKey) ?? { x: 0, y: 0 });
  const dragging = useRef<{ pointerId: number; startX: number; startY: number; from: Point } | null>(
    null
  );

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      dragging.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        from: offset,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [offset]
  );

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const drag = dragging.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    // Bounded to roughly a window's worth of travel in each direction, so the
    // bar cannot be flung somewhere it can never be grabbed back from.
    const limitX = window.innerWidth;
    const limitY = window.innerHeight;
    setOffset({
      x: Math.min(Math.max(drag.from.x + (event.clientX - drag.startX), -limitX), limitX),
      y: Math.min(Math.max(drag.from.y + (event.clientY - drag.startY), -limitY), limitY),
    });
  }, []);

  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const drag = dragging.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      dragging.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      setOffset((current) => {
        write(storageKey, current);
        return current;
      });
    },
    [storageKey]
  );

  return {
    offset,
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
  };
}
