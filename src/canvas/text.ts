/**
 * Adding canvas text that can be sized.
 *
 * BlockSuite has TWO kinds of canvas text, and only one of them can be given a
 * font size:
 *
 *   - `affine:edgeless-text` BLOCK -- rich text. Per-character bold, italic,
 *     underline, strikethrough, colour and links, but NO font-size control:
 *     BlockSuite gates that `when: type !== 'edgeless-text'` and expects you to
 *     change size by block type (H1-H6) instead. Double-clicking empty canvas
 *     creates one of these.
 *   - surface `text` ELEMENT -- one uniform style for the whole element, with
 *     font family, WEIGHT, colour, alignment and a real font size (a preset
 *     list plus a numeric input). This module creates one of these.
 *
 * Which one the built-in text tool produces is decided by the global
 * `enable_edgeless_text` feature flag, so it cannot offer both. Creating the
 * element directly sidesteps the flag entirely: double-click keeps making rich
 * text, and this button makes sizable text.
 */
import { EdgelessCRUDIdentifier } from '@blocksuite/affine/blocks/surface';
import { Text } from '@blocksuite/affine/store';
import type { BlockStdScope } from '@blocksuite/affine/std';
import { GfxControllerIdentifier } from '@blocksuite/affine/std/gfx';

/**
 * Canvas text is read at a distance and often while zoomed out, so it starts
 * well above BlockSuite's 24px document default.
 */
const DEFAULT_FONT_SIZE = 36;

/**
 * Seeded content, NOT an empty box.
 *
 * An empty text element deletes itself the moment it loses focus -- see
 * `edgeless-text-editor`: `if (element.text.length === 0) crud.deleteElements(...)`.
 * That is what made a freshly added text box vanish on the next click anywhere.
 * Starting with a word also gives it a real frame to grab and drag.
 */
const PLACEHOLDER = 'Text';

export function insertText(std: BlockStdScope): string | null {
  const gfx = std.get(GfxControllerIdentifier);
  const crud = std.get(EdgelessCRUDIdentifier);
  const { x, y } = gfx.viewport.center;

  // Roughly the ink of PLACEHOLDER at DEFAULT_FONT_SIZE. It only has to be
  // close: the element re-measures itself the first time it is edited.
  const width = PLACEHOLDER.length * DEFAULT_FONT_SIZE * 0.6;
  const height = DEFAULT_FONT_SIZE * 1.5;

  const id = crud.addElement('text', {
    xywh: `[${x - width / 2},${y - height / 2},${width},${height}]`,
    // The element stores a raw Y.Text; `Text` is BlockSuite's wrapper around
    // one, so this hands over the underlying shared type without taking a
    // direct dependency on yjs.
    text: new Text(PLACEHOLDER).yText,
    fontSize: DEFAULT_FONT_SIZE,
  });
  if (!id) return null;

  std.store.captureSync();

  // Selected as an OBJECT, not dropped into editing. That is what gives it a
  // frame with resize handles to drag straight away, and brings up the element
  // toolbar -- font, size, colour -- immediately. Double-click to edit the
  // words, exactly like every other object on the board.
  gfx.selection.set({ elements: [id], editing: false });
  return id;
}
