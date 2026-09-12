import { EdgelessCRUDIdentifier } from '@blocksuite/affine/blocks/surface';
import { mountShapeTextEditor } from '@blocksuite/affine/gfx/shape';
import { LayoutType, MindmapStyle, MindmapElementModel, ShapeElementModel } from '@blocksuite/affine/model';
import type { BlockComponent, EditorHost } from '@blocksuite/affine/std';
import { GfxControllerIdentifier } from '@blocksuite/affine/std/gfx';

export const MINDMAP_CREATION_ERROR = 'The mind map could not be added. Try Add mind map again.';

/** One native root per invocation, in the current document and model coordinates. */
export function insertMindmap(host: EditorHost): string {
  const { std } = host;
  const gfx = std.get(GfxControllerIdentifier);
  const root = host.querySelector<BlockComponent>('affine-edgeless-root');
  const { x, y } = gfx.viewport.center;
  if (!host.isConnected || std.store.readonly || !gfx.surface || !root ||
      !root.querySelector('.edgeless-mount-point') || ![x, y].every(Number.isFinite)) {
    throw new Error(MINDMAP_CREATION_ERROR);
  }
  const crud = std.get(EdgelessCRUDIdentifier);
  const existing = new Set(gfx.surface.elementModels.map(model => model.id));
  std.store.captureSync();
  try {
    const id = crud.addElement('mindmap', { layoutType: LayoutType.RIGHT, style: MindmapStyle.ONE });
    const map = id && gfx.surface.getElementById(id);
    if (!(map instanceof MindmapElementModel)) throw new Error(MINDMAP_CREATION_ERROR);
    const nodeId = map.addNode(null, undefined, 'after', { text: 'Central topic', xywh: `[${x - 80},${y - 25},160,50]` });
    const node = gfx.surface.getElementById(nodeId);
    if (!(node instanceof ShapeElementModel)) throw new Error(MINDMAP_CREATION_ERROR);
    mountShapeTextEditor(node, root);
    std.store.captureSync();
    return map.id;
  } catch {
    // Native transactions batch observations; explicit cleanup restores failure state.
    for (const model of [...gfx.surface.elementModels]) if (!existing.has(model.id)) gfx.surface.deleteElement(model.id);
    std.store.captureSync();
    throw new Error(MINDMAP_CREATION_ERROR);
  }
}
