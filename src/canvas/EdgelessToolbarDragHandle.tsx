/**
 * A grab handle for BlockSuite's bottom toolbar.
 *
 * The toolbar is BlockSuite's widget, not ours, so this does the least invasive
 * thing that works: it READS the visible bar's rectangle to place a handle at
 * its right edge, and WRITES only a transform on the widget host to move it.
 * The host is in the light DOM, so styling it needs no reaching into a shadow
 * root, and BlockSuite keeps ownership of the bar's own layout.
 *
 * The visible bar is `.edgeless-toolbar-toggle-control` inside the widget's
 * shadow root -- NOT the host, whose rect is a full-width strip across the
 * bottom of the window and would put the handle at the edge of the screen.
 */
import { useEffect, useRef, useState } from 'react';
import { useDragOffset } from './chrome-drag';

const HOST = 'edgeless-toolbar-widget';
const VISIBLE_BAR = '.edgeless-toolbar-toggle-control';

type Rect = { right: number; top: number; height: number };

export function EdgelessToolbarDragHandle() {
  const { offset, handleProps } = useDragOffset('board.toolbar.offset');
  const [rect, setRect] = useState<Rect | null>(null);
  const hostRef = useRef<HTMLElement | null>(null);

  // Apply the offset to the widget host. `translateX(-50%)` is BlockSuite's own
  // centring rule; dropping it would snap the bar to the right by half its
  // width the moment this runs.
  useEffect(() => {
    const host = document.querySelector<HTMLElement>(HOST);
    hostRef.current = host;
    if (!host) return;
    host.style.transform = `translateX(calc(-50% + ${offset.x}px)) translateY(${offset.y}px)`;
    return () => {
      host.style.transform = '';
    };
  }, [offset]);

  // Track where the visible bar actually is. It resizes when tools change, and
  // it moves whenever the offset does.
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      const bar = document
        .querySelector<HTMLElement>(HOST)
        ?.shadowRoot?.querySelector<HTMLElement>(VISIBLE_BAR);
      if (!bar) {
        // The widget mounts a moment after the editor; keep looking until it
        // appears rather than rendering a handle in the wrong place.
        frame = requestAnimationFrame(measure);
        return;
      }
      const r = bar.getBoundingClientRect();
      setRect((current) =>
        current && current.right === r.right && current.top === r.top && current.height === r.height
          ? current
          : { right: r.right, top: r.top, height: r.height }
      );
      frame = requestAnimationFrame(measure);
    };
    frame = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(frame);
  }, []);

  if (!rect) return null;

  const size = 22;
  return (
    <div
      role="separator"
      aria-label="Move tool palette"
      title="Drag to move"
      data-testid="toolbar-drag-handle"
      {...handleProps}
      style={{
        position: 'fixed',
        left: `${rect.right + 4}px`,
        top: `${rect.top + rect.height / 2 - size / 2}px`,
        width: `${size}px`,
        height: `${size}px`,
        zIndex: 11,
        display: 'grid',
        placeItems: 'center',
        borderRadius: '7px',
        border: '1px solid var(--board-line)',
        background: 'var(--board-surface)',
        boxShadow: 'var(--board-shadow)',
        cursor: 'grab',
        touchAction: 'none',
      }}
    >
      <span
        style={{
          display: 'block',
          width: '3px',
          height: '11px',
          borderRadius: '2px',
          background: 'var(--board-line)',
        }}
      />
    </div>
  );
}
