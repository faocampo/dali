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
    let preparedInput = false;
    let restoreInput = () => {};
    editor.addController({
      hostUpdated() {
        if (!editor.richText || !editor.element) return;
        editor.richText.style.fontFamily = `${TextUtils.wrapFontFamily(editor.element.fontFamily)}, sans-serif`;
        editor.richText.style.fontStyle = editor.element.fontStyle;
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
