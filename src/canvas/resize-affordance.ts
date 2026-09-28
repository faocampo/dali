/**
 * Making all eight resize handles visible and easy to hit.
 *
 * BlockSuite's edge handles are `width: 6px; left: -3.5px` -- a six-pixel band
 * straddling the element's border. That is a hard target with a mouse: aiming
 * for "the edge" of a canvas object misses more often than it hits, which
 * reads as "this element cannot be resized". The corner handles are 18px and
 * were never the problem.
 *
 * The rules live inside `edgeless-selected-rect`'s SHADOW ROOT, so no
 * stylesheet in the document can reach them -- shadow DOM is exactly the thing
 * that blocks that. Adopting an extra sheet into that shadow root is the
 * narrowest way in: it adds one override and leaves every other rule, and the
 * widget's own behaviour, untouched.
 */

const HANDLE_HIT = 14;
const OFFSET = HANDLE_HIT / 2;

const CSS = `
  /* A separate outer grip keeps the corner circle available for resizing. */
  .affine-edgeless-selected-rect .handle[aria-label='bottom-right'] .rotate {
    width: 26px;
    height: 26px;
    left: 20px;
    top: 20px;
    border: 1px solid var(--affine-blue);
    border-radius: 50%;
    background: var(--affine-background-primary-color, white);
    color: var(--affine-blue);
    box-shadow: 0 2px 6px rgb(0 0 0 / 12%);
  }
  .affine-edgeless-selected-rect .handle[aria-label='bottom-right'] .rotate::after {
    content: '↻';
    display: grid;
    place-items: center;
    height: 100%;
    font: 22px/1 sans-serif;
    pointer-events: none;
  }
  .affine-edgeless-selected-rect .handle[aria-label='bottom-right'] .rotate:hover {
    background: var(--affine-hover-color);
  }
  .affine-edgeless-selected-rect .handle[aria-label='left'],
  .affine-edgeless-selected-rect .handle[aria-label='right'] {
    width: ${HANDLE_HIT}px;
  }
  .affine-edgeless-selected-rect .handle[aria-label='left'] { left: -${OFFSET}px; }
  .affine-edgeless-selected-rect .handle[aria-label='right'] { right: -${OFFSET}px; }

  .affine-edgeless-selected-rect .handle[aria-label='top'],
  .affine-edgeless-selected-rect .handle[aria-label='bottom'] {
    height: ${HANDLE_HIT}px;
  }
  .affine-edgeless-selected-rect .handle[aria-label='top'] { top: -${OFFSET}px; }
  .affine-edgeless-selected-rect .handle[aria-label='bottom'] { bottom: -${OFFSET}px; }

  .affine-edgeless-selected-rect .handle[aria-label='left'] .resize:after,
  .affine-edgeless-selected-rect .handle[aria-label='right'] .resize:after,
  .affine-edgeless-selected-rect .handle[aria-label='top'] .resize:after,
  .affine-edgeless-selected-rect .handle[aria-label='bottom'] .resize:after {
    width: 12px;
    height: 12px;
    border: 2px solid var(--affine-blue);
    border-radius: 50%;
    background: white;
    box-sizing: border-box;
    opacity: 1;
  }
  .affine-edgeless-selected-rect .handle[aria-label='left'] .resize.transparent-handle:after,
  .affine-edgeless-selected-rect .handle[aria-label='right'] .resize.transparent-handle:after,
  .affine-edgeless-selected-rect .handle[aria-label='top'] .resize.transparent-handle:after,
  .affine-edgeless-selected-rect .handle[aria-label='bottom'] .resize.transparent-handle:after {
    opacity: 1;
  }
  .affine-edgeless-selected-rect .handle[aria-label='left'] .resize:after,
  .affine-edgeless-selected-rect .handle[aria-label='right'] .resize:after {
    top: calc(50% - 6px);
    right: auto;
    left: calc(50% - 6px);
  }
  .affine-edgeless-selected-rect .handle[aria-label='top'] .resize:after,
  .affine-edgeless-selected-rect .handle[aria-label='bottom'] .resize:after {
    top: calc(50% - 6px);
    bottom: auto;
    left: calc(50% - 6px);
  }
`;

/** Marks a shadow root we have already patched, so it is done once each. */
const PATCHED = new WeakSet<ShadowRoot>();
const PATCHED_FRAMES = new WeakSet<Element>();
const FRAME_BORDER_PROPERTY = '--affine-v2-edgeless-frame-border-default';

function findSelectedRect(root: ParentNode): Element | null {
  for (const el of root.querySelectorAll('*')) {
    if (el.tagName.toLowerCase() === 'edgeless-selected-rect') return el;
    if (el.shadowRoot) {
      const found = findSelectedRect(el.shadowRoot);
      if (found) return found;
    }
  }
  return null;
}

function strengthenFrameOutlines(root: ParentNode): void {
  for (const el of root.querySelectorAll('*')) {
    if (el.tagName.toLowerCase() === 'affine-frame' && !PATCHED_FRAMES.has(el)) {
      (el as HTMLElement).style.setProperty(FRAME_BORDER_PROPERTY, 'rgb(91 87 80 / 0.52)');
      PATCHED_FRAMES.add(el);
    }
    if (el.shadowRoot) strengthenFrameOutlines(el.shadowRoot);
  }
}

/**
 * Keeps the override applied. Returns a cleanup function.
 *
 * Polls rather than observing: the selected-rect is created and thrown away as
 * selections come and go, so there is no single node to watch, and re-checking
 * a WeakSet is cheap.
 */
export function widenResizeHandles(): () => void {
  let sheet: CSSStyleSheet | null = null;
  let frame = 0;
  const outlineTimer = window.setInterval(() => strengthenFrameOutlines(document), 500);
  strengthenFrameOutlines(document);

  const tick = () => {
    const rect = findSelectedRect(document);
    const shadow = rect?.shadowRoot;
    const rotation = shadow?.querySelector<HTMLElement>(".handle[aria-label='bottom-right'] .rotate");
    if (rotation && !rotation.title) {
      rotation.title = 'Drag to rotate';
      rotation.setAttribute('aria-label', 'Drag to rotate');
    }
    if (shadow && !PATCHED.has(shadow)) {
      try {
        sheet ??= new CSSStyleSheet();
        if (sheet.cssRules.length === 0) sheet.replaceSync(CSS);
        shadow.adoptedStyleSheets = [...shadow.adoptedStyleSheets, sheet];
        PATCHED.add(shadow);
      } catch {
        // Constructable stylesheets unavailable: handles stay at 6px, which is
        // BlockSuite's own default rather than a broken state.
      }
    }
    frame = requestAnimationFrame(tick);
  };

  frame = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(frame);
    window.clearInterval(outlineTimer);
  };
}
