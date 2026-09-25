/**
 * Mounts the infinite canvas view onto the shared runtime.
 *
 * BlockSuite 0.22 ships no editor-preset package, so the editor is assembled by
 * hand. The workspace and document live in ./runtime (exactly one per page);
 * this module owns only the view half -- the extension scope, the <editor-host>
 * and the viewport wrapper -- so mounting twice is wasteful but never creates
 * persistent content.
 */
import { ensureCanvasFonts } from './canvas-fonts';
import { installLineWidthControl } from './line-width-control';
import { installFormattingTheme } from './formatting-theme';
import { installCanvasColorPicker } from './color-picker';
import { installEditingInteractions } from './editing-interactions';
import { installTextBoxEditing, installTextFormattingMemory } from './text';
import { Subscription } from 'rxjs';
import {
  DocModeExtension,
  EditorSettingExtension,
} from '@blocksuite/affine/shared/services';
import { ViewExtensionManager } from '@blocksuite/affine/ext-loader';
import { BlockStdScope } from '@blocksuite/affine/std';
import type { EditorHost } from '@blocksuite/affine/std';
import { GfxControllerIdentifier } from '@blocksuite/affine/std/gfx';
import { signal } from '@preact/signals-core';
import { viewExtensions } from './extensions';
import { getCanvasRuntime } from './runtime';
import { installShapeTextTypography } from './shape-text-editor';
import { installMutationGuard, installReadOnlyInputs } from './account/mutation-guard';

export type EdgelessEditorHandle = {
  host: EditorHost;
  destroy: () => void;
};

export async function mountEdgelessEditor(
  container: HTMLElement
): Promise<EdgelessEditorHandle> {
  await ensureCanvasFonts();
  installShapeTextTypography();
  installTextBoxEditing();
  installLineWidthControl();
  installFormattingTheme();
  installCanvasColorPicker();
  const { store, scope } = await getCanvasRuntime();
  const disposeGuard = installMutationGuard(store, scope);

  const viewManager = new ViewExtensionManager(viewExtensions);
  // 'edgeless' scope is what swaps affine-page-root for affine-edgeless-root
  // and pulls in the edgeless toolbar / zoom toolbar / selected-rect widgets.
  const std = new BlockStdScope({
    store,
    extensions: [
      ...viewManager.get('edgeless'),
      // TELL BLOCKSUITE WE ARE IN EDGELESS MODE.
      //
      // The default DocModeService.getEditorMode() returns `null`, so
      // `isEdgelessMode` is false, so the toolbar context's `activated` getter
      // -- which falls through to exactly that -- is false forever. The visible
      // consequence is that selecting ANY canvas object shows no element
      // toolbar: no fill, stroke, font, size or colour for shapes, text,
      // connectors or images. Nothing throws, so it fails silently.
      //
      // Choosing the extension scope 'edgeless' picks which extensions load; it
      // does not answer "what mode is this editor in", which is what this
      // service is asked at runtime. AFFiNE overrides it the same way.
      DocModeExtension({
        getEditorMode: () => 'edgeless',
        getPrimaryMode: () => 'edgeless',
        setEditorMode: () => {},
        setPrimaryMode: () => {},
        togglePrimaryMode: () => 'edgeless',
        // The mode never changes here, so nothing will ever fire; an empty
        // Subscription is the honest answer rather than a fake object.
        onPrimaryModeChange: () => new Subscription(),
      }),
      // Desktop canvas convention for this product: an ordinary mouse wheel
      // zooms around the pointer. Middle-drag and Space-drag remain panning
      // gestures. BlockSuite defaults the wheel to pan unless this provider is
      // present, which made zoom appear broken after the hand-tool cleanup.
      EditorSettingExtension({
        setting$: signal({ edgelessScrollZoom: true }),
      }),
    ],
  });

  const host = std.render();
  const disposeInputs = installReadOnlyInputs(host, store, scope);

  // ViewportElementExtension('.affine-edgeless-viewport') (affine-block-root's
  // edgeless view scope) resolves the viewport via `std.host.closest(selector)`,
  // i.e. it walks UP from <editor-host>. So the host must be nested inside an
  // ancestor carrying that class or every viewport read throws
  // "ViewportElementProvider: viewport element is not found".
  // data-theme mirrors how AFFiNE itself renders this wrapper.
  const viewport = document.createElement('div');
  viewport.className = 'affine-edgeless-viewport';
  viewport.dataset.theme = 'light';
  viewport.style.cssText = 'position:relative;width:100%;height:100%;overflow:hidden;';
  viewport.append(host);
  container.append(viewport);

  // Keep the browser's native middle-click auto-scroll UI out of the canvas.
  // BlockSuite still receives the event and uses it for its own temporary pan
  // tool; preventDefault only suppresses the browser action.
  const preventMiddleMouseDefault = (event: MouseEvent) => {
    if (event.button === 1) event.preventDefault();
  };
  viewport.addEventListener('mousedown', preventMiddleMouseDefault, true);
  viewport.addEventListener('auxclick', preventMiddleMouseDefault, true);

  // BlockSuite deliberately initializes the standard Select tool. Keep that
  // default: Space-drag and middle-drag temporarily pan, while ordinary clicks,
  // drags and double-clicks continue to select, move and edit objects.
  await host.updateComplete;
  const disposeEditing = installEditingInteractions(host);
  const disposeTextFormatting = installTextFormattingMemory(host);

  // Pinned BlockSuite 0.22.4 caches the host rectangle on a one-second poll.
  // Header/font/layout changes can move the host between polls, displacing
  // drawing and hit testing. Refresh before its bubbling pointer controllers.
  const pointer = (std.event as unknown as { _pointerControl?: { _updateRect?: () => void } })._pointerControl;
  if (typeof pointer?._updateRect !== 'function') {
    viewport.remove();
    throw new Error('This editor version cannot synchronize canvas pointer coordinates.');
  }
  const gfxViewport = std.get(GfxControllerIdentifier).viewport;
  const refreshPointerRect = () => {
    pointer._updateRect!();
    // Selection/resize paths convert client coordinates through the separate
    // viewport origin. ResizeObserver does not observe position-only changes.
    const rect = viewport.getBoundingClientRect();
    if (gfxViewport.left !== rect.left || gfxViewport.top !== rect.top)
      gfxViewport.setRect(rect.left, rect.top, rect.width, rect.height);
  };
  const pointerEvents = ['pointerdown','pointermove','pointerup','wheel'] as const;
  pointerEvents.forEach(name => host.addEventListener(name, refreshPointerRect, true));

  let destroyed = false;
  return {
    host,
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      disposeEditing();
      disposeTextFormatting();
      pointerEvents.forEach(name => host.removeEventListener(name, refreshPointerRect, true));
      viewport.removeEventListener('mousedown', preventMiddleMouseDefault, true);
      viewport.removeEventListener('auxclick', preventMiddleMouseDefault, true);
      // Removing the viewport disconnects <editor-host>, and
      // EditorHost.disconnectedCallback() already calls std.unmount(). Calling
      // it here as well would run every lifecycle watcher's unmounted() hook
      // twice.
      viewport.remove();
      disposeInputs();
      disposeGuard();
    },
  };
}
