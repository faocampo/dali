import { DefaultTool, EdgelessCRUDIdentifier } from '@blocksuite/affine/blocks/surface';
import { EdgelessTextEditor, mountTextElementEditor } from '@blocksuite/affine/gfx/text';
import { TextElementModel } from '@blocksuite/affine/model';
import { EditPropsStore } from '@blocksuite/affine/shared/services';
import { ViewExtensionProvider, type ViewExtensionContext } from '@blocksuite/affine/ext-loader';
import { Text } from '@blocksuite/affine/store';
import type { EditorHost, PointerEventState } from '@blocksuite/affine/std';
import { BaseTool, GfxControllerIdentifier } from '@blocksuite/affine/std/gfx';
import { createIdentifier } from '@blocksuite/global/di';
import { Bound } from '@blocksuite/global/gfx';

let installed = false;
/** Keep the input at the drawn width, including the native empty-input state. */
export function installTextBoxEditing() {
  if (installed) return;
  installed = true;
  EdgelessTextEditor.addInitializer(host => {
    const editor = host as EdgelessTextEditor;
    editor.addController({ hostUpdated() {
      if (!editor.richText || !editor.element) return;
      const style = editor.richText.style;
      style.caretColor = 'currentColor'; style.userSelect = 'text';
      style.setProperty('-webkit-user-select', 'text'); style.cursor = 'text';
      if (editor.element.hasMaxWidth) {
        style.width = `${editor.element.w}px`;
        style.position = 'relative'; style.left = ''; style.top = ''; style.padding = '0';
        const placeholder = editor.querySelector<HTMLElement>('.edgeless-text-editor-placeholder');
        if (placeholder) Object.assign(placeholder.style, { position: 'absolute', top: '6px', left: '10px' });
      }
    } });
  });
}

/** Draw first, then mount the native text editor with its normal caret/IME behavior. */
export class TextBoxTool extends BaseTool {
  static override toolName = 'text';
  private preview: HTMLDivElement | null = null;

  override activate() {
    this.gfx.selection.set({ elements: [], editing: false });
    this.std.host.focus();
    this.std.host.addEventListener('keydown', this.cancel, true);
    this.std.host.addEventListener('pointercancel', this.cancelPointer);
  }

  private cancel = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    event.preventDefault(); event.stopPropagation();
    this.gfx.tool.setTool(DefaultTool);
  };
  private cancelPointer = () => this.gfx.tool.setTool(DefaultTool);

  override deactivate() {
    this.preview?.remove(); this.preview = null;
    this.std.host.removeEventListener('keydown', this.cancel, true);
    this.std.host.removeEventListener('pointercancel', this.cancelPointer);
  }
  override unmounted() { this.deactivate(); }

  override dragStart() {
    if (this.doc.readonly) return;
    this.preview = document.createElement('div');
    this.preview.className = 'text-box-preview';
    this.preview.setAttribute('aria-hidden', 'true');
    this.preview.style.cssText = 'position:absolute;pointer-events:none;z-index:5;box-sizing:border-box;border:1px dashed var(--affine-primary-color);background:var(--dali-accent-soft, #eee8ff);opacity:.65;';
    this.std.view.getBlock(this.doc.root!.id)?.append(this.preview);
    this.dragMove();
  }

  override dragMove() {
    if (!this.preview) return;
    const { x, y, w, h } = this.controller.draggingViewportArea$.peek();
    Object.assign(this.preview.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
  }

  override dragEnd() {
    // A cancelled gesture can still receive the native controller's final dragEnd.
    if (!this.active || !this.preview) return;
    const { x, y, w, h } = this.controller.draggingArea$.peek();
    this.create(new Bound(x, y, Math.max(32, w), Math.max(32, h)));
  }

  override click(event: PointerEventState) {
    if (!this.active) return;
    const [x, y] = this.gfx.viewport.toModelCoord(event.x, event.y);
    this.create(new Bound(x, y, 240, 54));
  }

  private create(bound: Bound) {
    const root = this.doc.root && this.std.view.getBlock(this.doc.root.id);
    if (this.doc.readonly || !root || !this.std.host.isConnected) { this.gfx.tool.setTool(DefaultTool); return; }
    this.doc.captureSync();
    const id = this.std.get(EdgelessCRUDIdentifier).addElement('text', {
      ...this.std.get(EditPropsStore).lastProps$.peek().text,
      xywh: bound.serialize(), hasMaxWidth: true, text: new Text().yText,
    });
    this.doc.captureSync();
    const model = id && this.gfx.getElementById(id);
    if (model instanceof TextElementModel) mountTextElementEditor(model, root);
    else this.gfx.tool.setTool(DefaultTool);
  }
}

/** Keep native T activation and the rail button on the same tool. */
export class TextBoxViewExtension extends ViewExtensionProvider {
  override name = 'dali-text-box';
  override setup(context: ViewExtensionContext) {
    super.setup(context);
    if (!this.isEdgeless(context.scope)) return;
    context.register({ setup(di) {
      // BlockSuite 0.22.4 registers tools by this identifier; it does not export the helper.
      di.override(createIdentifier<BaseTool>('GfxTool')('text'), TextBoxTool, [GfxControllerIdentifier]);
    } });
  }
}

/** Remember local formatting from both native and custom controls, excluding remote edits. */
export function installTextFormattingMemory(host: EditorHost) {
  const gfx = host.std.get(GfxControllerIdentifier);
  const props = host.std.get(EditPropsStore);
  props.recordLastProps('text', { fontSize: 36 });
  const keys = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'color', 'textAlign'] as const;
  const remember = (model: TextElementModel) => {
    const { fontFamily, fontSize, fontWeight, fontStyle, color, textAlign } = model;
    props.recordLastProps('text', { fontFamily, fontSize, fontWeight, fontStyle, color, textAlign });
  };
  const selected = gfx.selection.slots.updated.subscribe(() => {
    if (host.store.readonly) return;
    const models = gfx.selection.selectedElements;
    if (models.length === 1 && models[0] instanceof TextElementModel) remember(models[0]);
  });
  const changed = gfx.surface?.elementUpdated.subscribe(({ id, local, props: changes }) => {
    if (!local || host.store.readonly || !keys.some(key => key in changes)) return;
    const model = gfx.selection.selectedElements.find(model => model.id === id);
    if (model instanceof TextElementModel) remember(model);
  });
  return () => { selected.unsubscribe(); changed?.unsubscribe(); };
}
