import type { EditorHost } from '@blocksuite/affine/std';
import { GfxControllerIdentifier } from '@blocksuite/affine/std/gfx';
import { OverlayIdentifier } from '@blocksuite/affine/blocks/surface';
import type { ConnectionOverlay } from '@blocksuite/affine/gfx/connector';
import { EditPropsStore } from '@blocksuite/affine/shared/services';
import type { PickColorEvent } from '@blocksuite/affine/components/color-picker';
import { focusTextModel } from '@blocksuite/affine-rich-text';
import type { EdgelessNoteBlockComponent } from '@blocksuite/affine/blocks/note';

export function installEditingInteractions(host: EditorHost) {
  const gfx = host.std.get(GfxControllerIdentifier);
  const overlay = host.std.get(OverlayIdentifier('connection')) as ConnectionOverlay;
  let hovering = false;
  const clear = () => { if (hovering) { overlay.clear(); hovering = false; } };
  const hover = (event: PointerEvent) => {
    if (host.store.readonly || gfx.tool.currentToolName$.peek() !== 'connector' || event.buttons || gfx.tool.dragging$.peek()) return;
    if (event.composedPath().some(node => node instanceof Element && node.matches('editor-toolbar,editor-menu-content'))) { clear(); return; }
    overlay.renderConnector(gfx.viewport.toModelCoord(...gfx.viewport.toViewCoordFromClientCoord([event.clientX, event.clientY])));
    hovering = true;
  };
  const down = () => { hovering = false; };
  const stopTool = gfx.tool.currentToolName$.subscribe(clear);
  const rememberFill = (event: Event) => {
    const change = (event as CustomEvent<PickColorEvent>).detail;
    if (host.store.readonly || change?.type !== 'pick') return;
    const props = host.std.get(EditPropsStore);
    for (const key of Object.keys(props.lastProps$.peek()) as (keyof ReturnType<typeof props.lastProps$['peek']>)[]) {
      if (key.startsWith('shape:')) props.recordLastProps(key, { fillColor: change.detail.value });
    }
  };
  const editNote = (event: MouseEvent) => {
    if (host.store.readonly || gfx.tool.currentToolName$.peek() !== 'default') return;
    const path = event.composedPath();
    if (path.some(node => node instanceof HTMLElement && (node.isContentEditable || node.matches('button,input,textarea')))) return;
    const note = path.find(node => node instanceof Element && node.matches('affine-edgeless-note')) as EdgelessNoteBlockComponent | undefined;
    if (!note || note.model.isLocked()) return;
    const text = note.model.children.find(model => model.text);
    if (!text) return;
    event.preventDefault(); event.stopImmediatePropagation();
    gfx.selection.set({ elements: [note.model.id], editing: true });
    void note.updateComplete.then(() => {
      if (note.isConnected && !host.store.readonly && gfx.selection.editing && gfx.selection.selectedElements.some(model => model.id === note.model.id)) {
        focusTextModel(host.std, text.id, text.text?.length ?? 0);
      }
    });
  };
  host.addEventListener('pointermove', hover);
  host.addEventListener('pointerleave', clear);
  host.addEventListener('pointerdown', down, true);
  host.addEventListener('pickFillColor', rememberFill, true);
  host.addEventListener('dblclick', editNote, true);
  return () => {
    clear(); stopTool();
    host.removeEventListener('pointermove', hover);
    host.removeEventListener('pointerleave', clear);
    host.removeEventListener('pointerdown', down, true);
    host.removeEventListener('pickFillColor', rememberFill, true);
    host.removeEventListener('dblclick', editNote, true);
  };
}
