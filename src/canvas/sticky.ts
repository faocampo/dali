import { canvasInsertionRect, serializeInsertionRect } from './insertion-placement';
/**
 * Adding a sticky note to the board.
 *
 * BlockSuite's bottom toolbar already offers stickies through its note-senior
 * button, which drops you into a template picker. This is the plain version:
 * one native square in available viewport space using the chosen paper color.
 */
import { DefaultTheme, type Color } from '@blocksuite/affine/model';
import type { BlockStdScope } from '@blocksuite/affine/std';
import { GfxControllerIdentifier } from '@blocksuite/affine/std/gfx';

/**
 * Square-ish and hand-sized. BlockSuite's own default note is 498x92, which is
 * a document paragraph strip rather than something that reads as a sticky.
 */
const STICKY_SIZE = 260;

export function insertSticky(std: BlockStdScope, background: Color = DefaultTheme.NoteBackgroundColorMap.Yellow!): string {
  const store = std.store;
  if (store.readonly) throw new Error('This board is read-only.');
  const rootId = store.root?.id;
  if (!rootId) throw new Error('The board has no page block to add a sticky to.');

  const gfx = std.get(GfxControllerIdentifier);
  const xywh = serializeInsertionRect(canvasInsertionRect(std, STICKY_SIZE, STICKY_SIZE));
  store.captureSync();

  const noteId = store.addBlock(
    'affine:note',
    {
      xywh,
      index: gfx.layer.generateIndex(),
      // edgeless-only: a canvas object, not part of any page flow.
      displayMode: 'edgeless',
      background,
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

  std.host.focus();
  store.captureSync();
  return noteId;
}
