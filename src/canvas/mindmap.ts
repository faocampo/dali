import { EdgelessCRUDIdentifier } from '@blocksuite/affine/blocks/surface';
import { fitContent, mountShapeTextEditor } from '@blocksuite/affine/gfx/shape';
import { LayoutType, MindmapStyle, MindmapElementModel, ShapeElementModel } from '@blocksuite/affine/model';
import type { BlockComponent, EditorHost } from '@blocksuite/affine/std';
import { GfxControllerIdentifier } from '@blocksuite/affine/std/gfx';
import { validateMindmapDocument } from './mindmap-compatibility';

export const MINDMAP_CREATION_ERROR = 'The mind map could not be added. Try Add mind map again.';
export const MINDMAP_EDIT_ERROR = 'This change could not be applied. Your previous topic is still available. Try again.';

export function selectedMindmapTopic(host: EditorHost) {
  const gfx = host.std.get(GfxControllerIdentifier);
  const selected = gfx.selection.selectedElements;
  const shape = selected.length === 1 ? selected[0] : undefined;
  if (!(shape instanceof ShapeElementModel) || !(shape.group instanceof MindmapElementModel)) return null;
  return { gfx, shape, map: shape.group };
}

function addTopic(host: EditorHost, sibling: boolean): string {
  const selected = selectedMindmapTopic(host);
  const store = host.store;
  const root = host.querySelector<BlockComponent>('affine-edgeless-root');
  if (!selected || !host.isConnected || store.readonly || !root || selected.gfx.selection.editing) throw new Error(MINDMAP_EDIT_ERROR);
  const { gfx, shape, map } = selected;
  validateMindmapDocument(store);
  if (shape.hidden || map.isLocked() || [...map.children.keys()].some(id => map.surface.getElementById(id)?.isLocked()) ||
      map.surface.getElementById(map.id) !== map) throw new Error(MINDMAP_EDIT_ERROR);
  const parentId = sibling ? map.children.get(shape.id)?.parent : shape.id;
  if (!parentId || !map.children.has(parentId)) throw new Error(MINDMAP_EDIT_ERROR);
  const details = [...map.children].map(([id, detail]) => [id, { ...detail }] as const);
  const fields = details.map(([id]) => {
    const node = map.surface.getElementById(id) as ShapeElementModel;
    return { node, xywh: node.xywh, hidden: node.hidden, fontSize: node.fontSize, fontWeight: node.fontWeight, color: node.color };
  });
  const existing = new Set(map.surface.elementModels.map(node => node.id));
  let created = '';
  let failed = false;
  store.captureSync();
  store.transact(() => {
    try {
      if (host.store !== store || !host.isConnected || store.readonly) throw new Error(MINDMAP_EDIT_ERROR);
      const parent = map.getNode(parentId)!;
      if (parent.detail.collapsed) {
        map.children.set(parentId, { ...parent.detail, collapsed: false });
        map.buildTree();
      }
      created = map.addNode(parentId, sibling ? shape.id : undefined, 'after', { text: 'New topic' });
      map.layout();
    } catch {
      failed = true;
      for (const node of [...map.surface.elementModels]) if (!existing.has(node.id)) map.surface.deleteElement(node.id);
      for (const id of [...map.children.keys()]) if (!details.some(([original]) => original === id)) map.children.delete(id);
      for (const [id, detail] of details) map.children.set(id, detail);
      for (const { node, ...props } of fields) Object.assign(node, props);
      map.buildTree();
    }
  });
  store.captureSync();
  if (failed) throw new Error(MINDMAP_EDIT_ERROR);
  const target = map.surface.getElementById(created) as ShapeElementModel;
  mountShapeTextEditor(target, root);
  // Translate only the excess beyond the safe viewport; preserve current zoom.
  const bound = gfx.viewport.toViewBound(target.elementBound);
  const dx = bound.x < 80 ? bound.x - 80 : Math.max(0, bound.maxX - gfx.viewport.width + 24);
  const dy = bound.y < 80 ? bound.y - 80 : Math.max(0, bound.maxY - gfx.viewport.height + 120);
  if (dx || dy) gfx.viewport.setCenter(gfx.viewport.center.x + dx / gfx.viewport.zoom, gfx.viewport.center.y + dy / gfx.viewport.zoom);
  return created;
}

export const addMindmapChild = (host: EditorHost) => addTopic(host, false);
export const addMindmapSibling = (host: EditorHost) => addTopic(host, true);

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
    fitContent(node);
    node.xywh = `[${x - node.w / 2},${y - node.h / 2},${node.w},${node.h}]`;
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
