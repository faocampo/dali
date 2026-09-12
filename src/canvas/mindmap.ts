import { EdgelessCRUDIdentifier } from '@blocksuite/affine/blocks/surface';
import { fitContent, mountShapeTextEditor } from '@blocksuite/affine/gfx/shape';
import { LayoutType, MindmapStyle, MindmapElementModel, ShapeElementModel } from '@blocksuite/affine/model';
import type { BlockComponent, EditorHost } from '@blocksuite/affine/std';
import { GfxControllerIdentifier } from '@blocksuite/affine/std/gfx';
import { validateMindmapDocument } from './mindmap-compatibility';
import { validateMindmapState } from './mindmap-state';

export const MINDMAP_CREATION_ERROR = 'The mind map could not be added. Try Add mind map again.';
export const MINDMAP_EDIT_ERROR = 'This change could not be applied. Your previous topic is still available. Try again.';
export const MINDMAP_LAYOUT_ERROR = 'The mind map could not be arranged. Try Arrange mind map again.';

/** Capture native fields without cloning rich text or introducing an override schema. */
function changeMindmap(host: EditorHost, action: (map: MindmapElementModel, shape: ShapeElementModel) => void) {
  const selected = selectedMindmapTopic(host);
  if (!selected || selected.gfx.selection.editing || selected.shape.hidden) throw new Error(MINDMAP_EDIT_ERROR);
  const { map, shape } = selected;
  assertMutableMap(host, map);
  const details = [...map.children].map(([id, detail]) => [id, { ...detail }] as const);
  const fields = [...map.children.keys()].map(id => {
    const node = map.surface.getElementById(id) as ShapeElementModel;
    return { node, values: new Map(node.yMap.entries()) };
  });
  const layout = map.layoutType;
  const style = map.style;
  host.store.captureSync();
  try {
    let failure: unknown;
    host.store.transact(() => { try { action(map, shape); } catch (cause) { failure = cause; } });
    if (failure) throw failure;
    // Direction's native watcher flushes at transaction completion and rebuilds
    // first-level records. Restore every original detail before geometric layout.
    host.store.transact(() => {
      try {
        for (const [id, detail] of details) map.children.set(id, detail);
        map.buildTree();
        map.layout();
      } catch (cause) { failure = cause; }
    });
    if (failure) throw failure;
  } catch (cause) {
    host.store.transact(() => { map.layoutType = layout; map.style = style; });
    host.store.transact(() => {
      for (const [id, detail] of details) map.children.set(id, detail);
      for (const { node, values } of fields) {
        for (const key of [...node.yMap.keys()]) if (!values.has(key)) node.yMap.delete(key);
        for (const [key, value] of values) if (node.yMap.get(key) !== value) node.yMap.set(key, value);
      }
      map.buildTree();
    });
    throw cause;
  } finally { host.store.captureSync(); }
}

export function arrangeMindmap(host: EditorHost) { changeMindmap(host, () => {}); }
export function setMindmapLayout(host: EditorHost, direction: LayoutType) {
  if (![LayoutType.RIGHT, LayoutType.LEFT, LayoutType.BALANCE].includes(direction)) throw new Error(MINDMAP_LAYOUT_ERROR);
  changeMindmap(host, map => { map.layoutType = direction; });
}

export function setMindmapStyle(host: EditorHost, style: MindmapStyle) {
  if (![MindmapStyle.ONE, MindmapStyle.TWO, MindmapStyle.THREE, MindmapStyle.FOUR].includes(style)) throw new Error(MINDMAP_EDIT_ERROR);
  changeMindmap(host, map => { map.style = style; });
}

export function formatMindmapTopic(host: EditorHost, text: { fontSize?: number; fontWeight?: string; color?: string }) {
  if (Object.keys(text).some(key => !['fontSize', 'fontWeight', 'color'].includes(key)) ||
    (text.fontSize !== undefined && (!Number.isFinite(text.fontSize) || text.fontSize < 8 || text.fontSize > 96)) ||
    (text.fontWeight !== undefined && !['400', '600', '700'].includes(text.fontWeight)) ||
    (text.color !== undefined && !/^#[0-9a-f]{6}$/i.test(text.color))) throw new Error(MINDMAP_EDIT_ERROR);
  changeMindmap(host, (_map, shape) => { Object.assign(shape, text); });
}

export function readMindmapState(map: MindmapElementModel) {
  return validateMindmapState([...map.children].map(([id, detail]) => {
    const shape = map.surface.getElementById(id);
    if (!(shape instanceof ShapeElementModel)) throw new Error(MINDMAP_EDIT_ERROR);
    return { id, ...detail, bounds: [shape.x, shape.y, shape.w, shape.h] };
  }));
}

function assertMutableMap(host: EditorHost, map: MindmapElementModel) {
  const state = readMindmapState(map);
  if (!host.isConnected || host.store.readonly || map.surface.store !== host.store ||
      map.surface.getElementById(map.id) !== map || map.isLocked() ||
      [...state.byId.keys()].some(id => map.surface.getElementById(id)!.isLocked())) throw new Error(MINDMAP_EDIT_ERROR);
  // The native layout below is recursive. Bound its call depth after the iterative
  // preflight, before it can exhaust the browser stack on restored adversarial data.
  if ([...state.depth.values()].some(depth => depth > 128)) throw new Error(MINDMAP_EDIT_ERROR);
  return state;
}

/** Share preflight and selection relocation with the native canvas collapse badge. */
export function installMindmapHierarchy(host: EditorHost, onError: (error: unknown) => void, announce: (message: string) => void) {
  const surface = host.std.get(GfxControllerIdentifier).surface;
  if (!surface) return () => {};
  const store = host.store;
  let active = true;
  const disposers = new Map<string, () => void>();
  const attach = (id: string) => {
    const map = surface.getElementById(id);
    if (!(map instanceof MindmapElementModel) || disposers.has(id)) return;
    const original = map.toggleCollapse;
    const guarded: typeof map.toggleCollapse = (node, options) => {
      let state: ReturnType<typeof readMindmapState>;
      try {
        if (!active || host.store !== store) throw new Error(MINDMAP_EDIT_ERROR);
        state = assertMutableMap(host, map);
        if (!state.byId.has(node.id) || !state.visible.has(node.id)) throw new Error(MINDMAP_EDIT_ERROR);
      } catch (cause) { onError(cause); return; }
      const count = state.children.get(node.id)!.length;
      if (!count) return;
      const gfx = host.std.get(GfxControllerIdentifier);
      const keys = [...state.byId.keys()].map(id => {
        const shape = surface.getElementById(id) as ShapeElementModel;
        return { shape, originalKeys: new Set(shape.yMap.keys()) };
      });
      let failure: unknown;
      store.transact(() => {
        try { original.call(map, map.getNode(node.id)!, options); }
        catch (cause) {
          failure = cause;
          // The native compatibility adapter restores values. Preserve omitted
          // defaults too, so rejection leaves the serialized state identical.
          for (const { shape, originalKeys } of keys) {
            for (const key of [...shape.yMap.keys()]) if (!originalKeys.has(key)) shape.yMap.delete(key);
          }
        }
      });
      if (failure) throw failure;
      const next = readMindmapState(map);
      if (gfx.selection.selectedElements.some(shape => next.hiddenAncestor.get(shape.id) === node.id)) {
        host.querySelectorAll('edgeless-shape-text-editor').forEach(editor => {
          editor.addEventListener('blur', event => event.stopImmediatePropagation(), { capture: true, once: true });
          editor.remove();
        });
        gfx.selection.set({ elements: [node.id], editing: false });
      }
      announce(next.byId.get(node.id)?.collapsed
        ? `Branch collapsed. ${count} direct ${count === 1 ? 'branch' : 'branches'} hidden.` : 'Branch expanded.');
    };
    map.toggleCollapse = guarded;
    disposers.set(id, () => { if (map.toggleCollapse === guarded) map.toggleCollapse = original; });
  };
  surface.elementModels.forEach(model => attach(model.id));
  const added = surface.elementAdded.subscribe(({ id }) => attach(id));
  const removed = surface.elementRemoved.subscribe(({ id }) => { disposers.get(id)?.(); disposers.delete(id); });
  return () => { active = false; added.unsubscribe(); removed.unsubscribe(); disposers.forEach(dispose => dispose()); };
}

export function toggleMindmapBranch(host: EditorHost) {
  const selected = selectedMindmapTopic(host);
  if (!selected || selected.gfx.selection.editing) throw new Error(MINDMAP_EDIT_ERROR);
  assertMutableMap(host, selected.map);
  selected.map.toggleCollapse(selected.map.getNode(selected.shape.id)!, { layout: true });
}

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
  assertMutableMap(host, map);
  validateMindmapDocument(store);
  if (shape.hidden || map.isLocked() || [...map.children.keys()].some(id => map.surface.getElementById(id)?.isLocked()) ||
      map.surface.getElementById(map.id) !== map) throw new Error(MINDMAP_EDIT_ERROR);
  const parentId = sibling ? map.children.get(shape.id)?.parent : shape.id;
  if (!parentId || !map.children.has(parentId)) throw new Error(MINDMAP_EDIT_ERROR);
  const details = [...map.children].map(([id, detail]) => [id, { ...detail }] as const);
  const fields = details.map(([id]) => {
    const node = map.surface.getElementById(id) as ShapeElementModel;
    return { node, originalKeys: new Set(node.yMap.keys()), xywh: node.xywh, hidden: node.hidden, fontSize: node.fontSize, fontWeight: node.fontWeight, color: node.color };
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
        const revealed = readMindmapState(map);
        for (const id of revealed.byId.keys()) {
          const node = map.surface.getElementById(id)!;
          const hidden = !revealed.visible.has(id);
          if (node.hidden !== hidden) node.hidden = hidden;
        }
      }
      created = map.addNode(parentId, sibling ? shape.id : undefined, 'after', { text: 'New topic' });
      map.layout();
    } catch {
      failed = true;
      for (const id of [...map.children.keys()]) if (!details.some(([original]) => original === id)) map.children.delete(id);
      for (const [id, detail] of details) map.children.set(id, detail);
      for (const { node, originalKeys, ...props } of fields) {
        Object.assign(node, props);
        for (const key of [...node.yMap.keys()]) if (!originalKeys.has(key)) node.yMap.delete(key);
      }
      map.buildTree();
    }
  });
  // Native surface caches new models eagerly. Delete only after its add observer
  // has run; add+delete in the same Y transaction leaves a ghost cached model.
  if (failed) {
    for (const node of [...map.surface.elementModels]) if (!existing.has(node.id)) map.surface.deleteElement(node.id);
  }
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
