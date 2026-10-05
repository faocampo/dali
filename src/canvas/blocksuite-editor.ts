import { installLiveShapeGesture } from './account/reservations';
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
import type { CanvasRuntime } from './runtime';
import { installShapeTextTypography } from './shape-text-editor';
import { accessScopeCurrent, installMutationGuard, installReadOnlyInputs } from './account/mutation-guard';

export type EdgelessEditorHandle = {
  host: EditorHost;
  destroy: () => void;
};

export async function mountEdgelessEditor(
  container: HTMLElement,
  runtime: CanvasRuntime,
  mountSignal: AbortSignal,
): Promise<EdgelessEditorHandle> {
  await ensureCanvasFonts();
  // StrictMode and navigation can cancel setup while fonts are loading. A
  // cancelled mount must never attach a view or acquire a different board.
  mountSignal.throwIfAborted();
  if (!accessScopeCurrent(runtime.scope)) throw new Error('Board access changed');
  installShapeTextTypography();
  installTextBoxEditing();
  installLineWidthControl();
  installFormattingTheme();
  installCanvasColorPicker();
  const { store, scope } = runtime;
  const disposeGuard = installMutationGuard(store, scope, runtime.workspace.live);

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

  // Keep the browser's native middle-click auto-scroll UI out of the canvas.
  // BlockSuite still receives the event and uses it for its own temporary pan
  // tool; preventDefault only suppresses the browser action.
  const preventMiddleMouseDefault = (event: MouseEvent) => {
    if (event.button === 1) event.preventDefault();
  };
  viewport.addEventListener('mousedown', preventMiddleMouseDefault, true);
  viewport.addEventListener('auxclick', preventMiddleMouseDefault, true);

  let destroyed = false;
  let disposeEditing = () => {};
  let disposeTextFormatting = () => {};
  let disposePointer = () => {};
  let disposeLiveGesture = () => {};
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    mountSignal.removeEventListener('abort', destroy);
    disposeEditing();
    disposeTextFormatting();
    disposePointer();
    disposeLiveGesture();
    viewport.removeEventListener('mousedown', preventMiddleMouseDefault, true);
    viewport.removeEventListener('auxclick', preventMiddleMouseDefault, true);
    // Removing the viewport disconnects the host and unmounts its scope once.
    viewport.remove();
    disposeInputs();
    disposeGuard();
  };
  mountSignal.addEventListener('abort', destroy, { once: true });
  container.append(viewport);

  try {
    // Keep native Select: Space/middle-drag pan, ordinary gestures edit.
    await host.updateComplete;
    mountSignal.throwIfAborted();
    if (!accessScopeCurrent(scope)) throw new Error('Board access changed');
    disposeEditing = installEditingInteractions(host);
    disposeTextFormatting = installTextFormattingMemory(host);

    // Pinned BlockSuite caches the host rectangle on a one-second poll.
    // Refresh before pointer controllers so layout changes cannot shift hits.
    const pointer = (std.event as unknown as { _pointerControl?: { _updateRect?: () => void } })._pointerControl;
    if (typeof pointer?._updateRect !== 'function') {
      throw new Error('This editor version cannot synchronize canvas pointer coordinates.');
    }
    const gfxViewport = std.get(GfxControllerIdentifier).viewport;
    const selection = std.get(GfxControllerIdentifier).selection;
    const setCursor = selection.setCursor;
    selection.setCursor = cursor => {
      // Cursor awareness is a selection update, but must not take keyboard
      // ownership from an outside control. Keep pointer dispatch and presence
      // updates intact; suppress native range focus only during this update.
      const active = host.ownerDocument.activeElement;
      const outside = active && active !== host.ownerDocument.body &&
        active !== host.ownerDocument.documentElement && !host.contains(active);
      const wasActive = std.event.active;
      if (outside) std.event.active = false;
      try { setCursor.call(selection, cursor); }
      finally { if (outside) std.event.active = wasActive; }
    };
    const refreshPointerRect = () => {
      pointer._updateRect!();
      const rect = viewport.getBoundingClientRect();
      if (gfxViewport.left !== rect.left || gfxViewport.top !== rect.top)
        gfxViewport.setRect(rect.left, rect.top, rect.width, rect.height);
    };
    refreshPointerRect();
    disposeLiveGesture = installLiveShapeGesture(host, runtime);
    const pointerEvents = ['pointerdown','pointermove','pointerup','wheel'] as const;
    pointerEvents.forEach(name => host.addEventListener(name, refreshPointerRect, true));
    disposePointer = () => {
      pointerEvents.forEach(name => host.removeEventListener(name, refreshPointerRect, true));
      selection.setCursor = setCursor;
    };
    return { host, destroy };
  } catch (cause) {
    destroy();
    throw cause;
  }
}
