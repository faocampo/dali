import { TextUtils } from '@blocksuite/affine/blocks/surface';
import { EdgelessShapeTextEditor } from '@blocksuite/affine/gfx/shape';

let installed = false;

/** Keep the DOM editor consistent with BlockSuite's canvas text renderer. */
export function installShapeTextTypography(): void {
  if (installed) return;
  installed = true;
  // A Lit controller runs after each native render, before updateComplete and
  // text measurement. It also covers editors mounted by native double-click.
  EdgelessShapeTextEditor.addInitializer(host => {
    const editor = host as EdgelessShapeTextEditor;
    // The native resize observer grows shapes while typing; only mind-map
    // topics retain automatic layout. Ordinary shape geometry belongs to resize.
    const resize = editor as unknown as { _updateElementWH(): void };
    const nativeResize = resize._updateElementWH.bind(editor);
    resize._updateElementWH = () => {
      // Deferred native measurements may settle after recovery pauses editing
      // or removes the editor. Recheck before geometry and selection writes.
      if (!editor.isConnected || !editor.std.host.isConnected || editor.std.store.readonly ||
          !editor.richText?.isConnected || !editor.element ||
          editor.gfx.surface?.getElementById(editor.element.id) !== editor.element) return;
      if (editor.isMindMapNode) nativeResize();
    };
    let preparedInput = false;
    let restoreInput = () => {};
    editor.addController({
      hostUpdated() {
        if (!editor.richText || !editor.element) return;
        editor.richText.style.fontFamily = `${TextUtils.wrapFontFamily(editor.element.fontFamily)}, sans-serif`;
        editor.richText.style.fontStyle = editor.element.fontStyle;
        editor.richText.style.caretColor = 'currentColor';
        editor.richText.style.userSelect = 'text';
        editor.richText.style.setProperty('-webkit-user-select', 'text');
        editor.richText.style.cursor = 'text';
        if (!editor.isMindMapNode) Object.assign(editor.richText.style, {
          width: `${editor.element.w}px`, height: `${editor.element.h}px`,
          minHeight: '0', maxHeight: `${editor.element.h}px`, overflow: 'hidden',
        });
        if (!preparedInput && editor.isMindMapNode) {
          preparedInput = true;
          void editor.richText.updateComplete.then(() => {
            if (!editor.isConnected || !editor.inlineEditor) return;
            const inline = editor.inlineEditor;
            const original = inline.hooks.beforeinput;
            const beforeinput: NonNullable<typeof original> = context => {
              // Firefox can report a collapsed input target range while a
              // topic's placeholder is visibly selected. Ordinary typing
              // replaces the actual selection; IME and replacement input
              // retain their native target-range handling.
              const range = inline.getNativeRange();
              const selection = range && inline.toInlineRange(range);
              if (context.raw.inputType === 'insertText' && !context.raw.isComposing && selection?.length) {
                context.inlineRange = selection;
              }
              original?.(context);
            };
            inline.hooks.beforeinput = beforeinput;
            restoreInput = () => { if (inline.hooks.beforeinput === beforeinput) inline.hooks.beforeinput = original; };
          });
        }
      },
      hostDisconnected() { restoreInput(); },
    });
  });
}
