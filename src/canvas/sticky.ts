/**
 * Adding a sticky note to the board.
 *
 * BlockSuite's bottom toolbar already offers stickies through its note-senior
 * button, which drops you into a template picker. This is the plain version:
 * one click, one yellow square at the viewport centre, ready to type into.
 */
import { DefaultTheme } from '@blocksuite/affine/model';
import type { BlockStdScope } from '@blocksuite/affine/std';
import { GfxControllerIdentifier } from '@blocksuite/affine/std/gfx';

/**
 * Square-ish and hand-sized. BlockSuite's own default note is 498x92, which is
 * a document paragraph strip rather than something that reads as a sticky.
 */
const STICKY_SIZE = 260;

export function insertSticky(std: BlockStdScope): string {
  const store = std.store;
  const rootId = store.root?.id;
  if (!rootId) throw new Error('The board has no page block to add a sticky to.');

  const gfx = std.get(GfxControllerIdentifier);
  const { x: cx, y: cy } = gfx.viewport.center;
  const xywh = `[${cx - STICKY_SIZE / 2},${cy - STICKY_SIZE / 2},${STICKY_SIZE},${STICKY_SIZE}]`;

  const noteId = store.addBlock(
    'affine:note',
    {
      xywh,
      // edgeless-only: a canvas object, not part of any page flow.
      displayMode: 'edgeless',
      background: DefaultTheme.NoteBackgroundColorMap.Yellow,
      edgeless: {
        // Without collapse the note auto-sizes to its content, so the height in
        // `xywh` is ignored and a "sticky" opens as a wide 92px strip. Pinning
        // it is what makes the square hold until the user resizes it.
        collapse: true,
        collapsedHeight: STICKY_SIZE,
        style: {
          borderRadius: 8,
          borderSize: 4,
          borderStyle: 'none',
          // Reads as paper on the board rather than a document panel.
          shadowType: '--affine-note-shadow-sticker',
        },
      },
    },
    rootId
  );

  // Without a paragraph there is nothing to put a caret in, and the sticky
  // cannot be typed into until the user finds the right double-click.
  store.addBlock('affine:paragraph', {}, noteId);

  return noteId;
}
