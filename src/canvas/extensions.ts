/**
 * The canvas primitive set, composed explicitly.
 *
 * BlockSuite's `getInternalStoreExtensions()` / `getInternalViewExtensions()`
 * are convenience presets that bundle EVERY block AFFiNE ships -- code blocks
 * (which drag in Shiki's per-language grammars), databases, bookmarks, embeds,
 * LaTeX, tables, mindmaps. Each extension is separately importable through a
 * public `@blocksuite/affine/...` subpath, so we list the ones we want instead.
 *
 * Two things fall out of that:
 *   1. no reliance on the `getInternal*` API surface, and
 *   2. the bundle only carries primitives the canvas actually offers.
 *
 * To add a primitive, add its store extension AND its view extension here.
 */
import { FoundationStoreExtension } from '@blocksuite/affine/foundation/store';
import { FoundationViewExtension } from '@blocksuite/affine/foundation/view';

import { RootStoreExtension } from '@blocksuite/affine/blocks/root/store';
import { RootViewExtension } from '@blocksuite/affine/blocks/root/view';
import { SurfaceStoreExtension } from '@blocksuite/affine/blocks/surface/store';
import { SurfaceViewExtension } from '@blocksuite/affine/blocks/surface/view';
import { NoteStoreExtension } from '@blocksuite/affine/blocks/note/store';
import { NoteViewExtension } from '@blocksuite/affine/blocks/note/view';
import { ParagraphStoreExtension } from '@blocksuite/affine/blocks/paragraph/store';
import { ParagraphViewExtension } from '@blocksuite/affine/blocks/paragraph/view';
import { ListStoreExtension } from '@blocksuite/affine/blocks/list/store';
import { ListViewExtension } from '@blocksuite/affine/blocks/list/view';
import { ImageStoreExtension } from '@blocksuite/affine/blocks/image/store';
import { ImageViewExtension } from '@blocksuite/affine/blocks/image/view';
import { FrameStoreExtension } from '@blocksuite/affine/blocks/frame/store';
import { FrameViewExtension } from '@blocksuite/affine/blocks/frame/view';
import { EdgelessTextStoreExtension } from '@blocksuite/affine/blocks/edgeless-text/store';
import { EdgelessTextViewExtension } from '@blocksuite/affine/blocks/edgeless-text/view';
import { EmbedDocStoreExtension } from '@blocksuite/affine/blocks/embed-doc/store';
import { EmbedDocViewExtension } from '@blocksuite/affine/blocks/embed-doc/view';

import { ShapeStoreExtension } from '@blocksuite/affine/gfx/shape/store';
import { ShapeViewExtension } from '@blocksuite/affine/gfx/shape/view';
import { BrushStoreExtension } from '@blocksuite/affine/gfx/brush/store';
import { BrushViewExtension } from '@blocksuite/affine/gfx/brush/view';
import { ConnectorStoreExtension } from '@blocksuite/affine/gfx/connector/store';
import { ConnectorViewExtension } from '@blocksuite/affine/gfx/connector/view';
import { GroupStoreExtension } from '@blocksuite/affine/gfx/group/store';
import { GroupViewExtension } from '@blocksuite/affine/gfx/group/view';
import { MindmapStoreExtension } from '@blocksuite/affine/gfx/mindmap/store';
import { MindmapViewExtension } from '@blocksuite/affine/gfx/mindmap/view';
import { TextStoreExtension } from '@blocksuite/affine/gfx/text/store';
import { TextViewExtension } from '@blocksuite/affine/gfx/text/view';
import { NoteViewExtension as GfxNoteViewExtension } from '@blocksuite/affine/gfx/note/view';

// The pointer/select tool. Without it the toolbar has no select button and the
// canvas has no default tool to fall back to after another tool finishes.
import { PointerViewExtension } from '@blocksuite/affine/gfx/pointer/view';
// Rich text editing inside notes/stickies. The VIEW half registers
// AffineInlineManager; with only the store half, every text edit throws
// "Service [AffineInlineManager](DefaultInlineManager) not found in container".
import { InlinePresetStoreExtension } from '@blocksuite/affine/inlines/preset/store';
import { InlinePresetViewExtension } from '@blocksuite/affine/inlines/preset/view';
// DefaultInlineManager declares all five inline specs as hard dependencies
// (see affine-inline-preset/src/default-inline-manager.ts), so any text editing
// fails with "Missing dependency [AffineInlineSpec](<name>)" until every one is
// registered. These buy no UI we want -- they are the price of rich text.
// `mention` ships a view extension only.
import { LatexStoreExtension as InlineLatexStoreExtension } from '@blocksuite/affine/inlines/latex/store';
import { LatexViewExtension as InlineLatexViewExtension } from '@blocksuite/affine/inlines/latex/view';
import { ReferenceStoreExtension } from '@blocksuite/affine/inlines/reference/store';
import { ReferenceViewExtension } from '@blocksuite/affine/inlines/reference/view';
import { LinkStoreExtension } from '@blocksuite/affine/inlines/link/store';
import { LinkViewExtension } from '@blocksuite/affine/inlines/link/view';
import { FootnoteStoreExtension } from '@blocksuite/affine/inlines/footnote/store';
import { FootnoteViewExtension } from '@blocksuite/affine/inlines/footnote/view';
import { MentionViewExtension } from '@blocksuite/affine/inlines/mention/view';

import { EdgelessToolbarViewExtension } from '@blocksuite/affine/widgets/edgeless-toolbar/view';
import { EdgelessDraggingAreaViewExtension } from '@blocksuite/affine/widgets/edgeless-dragging-area/view';
// These two are NOT re-exported through the @blocksuite/affine facade, so they
// are imported from their own packages and declared as direct dependencies.
// edgeless-selected-rect is what draws the selection / resize handles, so it is
// required for move-and-resize, not optional chrome.
import { EdgelessSelectedRectViewExtension } from '@blocksuite/affine-widget-edgeless-selected-rect/view';
import { EdgelessZoomToolbarViewExtension } from '@blocksuite/affine-widget-edgeless-zoom-toolbar/view';
import { FrameTitleViewExtension } from '@blocksuite/affine/widgets/frame-title/view';
import { ToolbarViewExtension } from '@blocksuite/affine/widgets/toolbar/view';
import { ObjectActionsToolbarExtension } from './object-actions-toolbar';
import {
  ImageVisualEditStoreExtension,
  ImageVisualEditViewExtension,
} from './image-visual-edits';

/** Block schemas + document behaviour. Undo/redo lives in the foundation. */
export const storeExtensions = [
  FoundationStoreExtension,
  RootStoreExtension,
  SurfaceStoreExtension,
  NoteStoreExtension,
  ParagraphStoreExtension,
  ListStoreExtension,
  ImageStoreExtension,
  FrameStoreExtension,
  EdgelessTextStoreExtension,
  EmbedDocStoreExtension,
  ShapeStoreExtension,
  BrushStoreExtension,
  ConnectorStoreExtension,
  GroupStoreExtension,
  MindmapStoreExtension,
  TextStoreExtension,
  InlinePresetStoreExtension,
  InlineLatexStoreExtension,
  ReferenceStoreExtension,
  LinkStoreExtension,
  FootnoteStoreExtension,
  ImageVisualEditStoreExtension,
];

/** Renderers, tools and the floating chrome. */
export const viewExtensions = [
  FoundationViewExtension,
  RootViewExtension,
  PointerViewExtension,
  SurfaceViewExtension,
  NoteViewExtension,
  ParagraphViewExtension,
  ListViewExtension,
  ImageViewExtension,
  FrameViewExtension,
  EdgelessTextViewExtension,
  EmbedDocViewExtension,
  ShapeViewExtension,
  BrushViewExtension,
  ConnectorViewExtension,
  GroupViewExtension,
  MindmapViewExtension,
  TextViewExtension,
  GfxNoteViewExtension,
  InlinePresetViewExtension,
  InlineLatexViewExtension,
  ReferenceViewExtension,
  LinkViewExtension,
  FootnoteViewExtension,
  MentionViewExtension,
  EdgelessToolbarViewExtension,
  EdgelessZoomToolbarViewExtension,
  EdgelessSelectedRectViewExtension,
  EdgelessDraggingAreaViewExtension,
  FrameTitleViewExtension,
  ToolbarViewExtension,
  ObjectActionsToolbarExtension,
  ImageVisualEditViewExtension,
];
