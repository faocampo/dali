import { EdgelessCRUDIdentifier, updateXYWH } from '@blocksuite/affine-block-surface';
import { createGroupFromSelectedCommand, ungroupCommand } from '@blocksuite/affine-gfx-group';
import { GroupElementModel, LayoutType } from '@blocksuite/affine/model';
import type { EditorHost } from '@blocksuite/affine/std';
import { duplicate } from '@blocksuite/affine/blocks/root';
import {
  GfxControllerIdentifier,
  isGfxGroupCompatibleModel,
  type GfxModel,
  type ReorderingDirection,
} from '@blocksuite/affine/std/gfx';
import { Bound } from '@blocksuite/global/gfx';
import { canvasModelKind, canvasModelVisible, mindmapArrangementReason, mindmapOwner, nativeMindmapState, type CanvasItemKind } from './selection-summary';
import { reconcileImageVisualEdits } from './image-visual-edits';
import { nativeCopySourcesValid, withNativeCopySources } from './mindmap-compatibility';
import { withCanvasReservation } from './account/reservations';

export type LayerEntry = {
  id: string;
  depth: number;
  kind: CanvasItemKind;
  label: string;
  locked: boolean;
  lockedBySelf: boolean;
  isGroup: boolean;
};

function protectedModel(model: GfxModel): boolean {
  const map = mindmapOwner(model);
  if (map) {
    try {
      const state = nativeMindmapState(map);
      if ([...state.depth.values()].some(depth => depth > 128)) return true;
      if (map.isLocked() || [...state.byId.keys()].some(id => map.surface.getElementById(id)!.isLocked())) return true;
    } catch { return true; }
  }
  return model.isLocked() || (isGfxGroupCompatibleModel(model) && model.childElements.some(protectedModel));
}

export function canvasSelectionEditable(host: EditorHost): boolean {
  const gfx = host.std.get(GfxControllerIdentifier);
  return host.isConnected && !host.std.store.readonly && !gfx.selection.editing &&
    gfx.selection.selectedElements.length > 0 && !gfx.selection.selectedElements.some(model => protectedModel(model) || !canvasModelVisible(model)) &&
    !(gfx.selection.selectedElements.length > 1 && mindmapArrangementReason(gfx.selection.selectedElements));
}

const duplicates = new WeakMap<EditorHost, Promise<void>>();
export function duplicateCanvasSelection(host: EditorHost): Promise<void> {
  if (!canvasSelectionEditable(host)) return Promise.resolve();
  const source = [...host.std.get(GfxControllerIdentifier).selection.selectedElements];
  const store = host.store;
  const operation = (duplicates.get(host) ?? Promise.resolve()).then(async () => {
    if (!nativeCopySourcesValid(host, source, store)) return;
    const root = host.std.view.getBlock(host.std.store.root!.id);
    if (!root) return;
    await withCanvasReservation(host, source.map(model => model.id), true, async () => {
      if (!nativeCopySourcesValid(host, source, store)) return;
      host.std.store.captureSync();
      await withNativeCopySources(host, source, () => duplicate(root, source));
      reconcileImageVisualEdits(host.std.store);
      host.std.store.captureSync();
    });
  });
  duplicates.set(host, operation.catch(() => undefined));
  return operation;
}

export function installArrangementShortcuts(host: EditorHost, onError: (error: unknown) => void): () => void {
  const onKey = (event: KeyboardEvent) => {
    if (event.defaultPrevented || !host.isConnected || event.isComposing) return;
    const editing = event.composedPath().some(target => target instanceof HTMLElement &&
      (target.isContentEditable || target.matches('input, textarea, select, [role="textbox"]')));
    if (editing) return;
    const gfx = host.std.get(GfxControllerIdentifier);
    if (gfx.selection.editing) return;
    // WebKit still maps Backspace to history navigation; native canvas deletion
    // handles the key but does not cancel that browser default.
    if (event.key === 'Backspace' && gfx.selection.selectedElements.length) event.preventDefault();
    const topic = gfx.selection.selectedElements.length === 1 ? gfx.selection.selectedElements[0] : undefined;
    const map = topic && mindmapOwner(topic);
    if (topic && map && topic.id !== map.id && map.children.get(topic.id)?.collapsed) {
      const direction = map.getLayoutDir(topic.id);
      if ((event.key === 'ArrowLeft' && direction === LayoutType.LEFT) ||
          (event.key === 'ArrowRight' && direction !== LayoutType.LEFT)) {
        event.preventDefault(); event.stopImmediatePropagation(); return;
      }
    }
    const modifier = /Mac|iPhone|iPad/.test(navigator.platform) ? event.metaKey : event.ctrlKey;
    if ((['Delete', 'Backspace'].includes(event.key) || (modifier && event.key.toLowerCase() === 'g')) &&
      gfx.selection.selectedElements.some(protectedModel)) {
      // Block native ancestor operations when a descendant is protected.
      event.stopImmediatePropagation();
      return;
    }
    if (!modifier || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key !== 'd' && key !== 'g') return;
    if (key === 'g' && mindmapArrangementReason(gfx.selection.selectedElements)) {
      event.preventDefault(); event.stopImmediatePropagation(); return;
    }
    if (!canvasSelectionEditable(host)) return;
    if (key === 'g' && !(event.shiftKey ? selectedLayerCanUngroup(host) : selectedLayerCanGroup(host))) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    try {
      if (key === 'd') void duplicateCanvasSelection(host).catch(onError);
      else if (event.shiftKey) void ungroupCanvasSelection(host).catch(onError);
      else void groupCanvasSelection(host).catch(onError);
    } catch (error) { onError(error); }
  };
  document.addEventListener('keydown', onKey, true);
  return () => document.removeEventListener('keydown', onKey, true);
}

function modelKind(model: GfxModel): CanvasItemKind {
  return canvasModelKind(model);
}

function kindLabel(kind: CanvasItemKind): string {
  return {
    image: 'Image',
    text: 'Text',
    sticky: 'Sticky note',
    shape: 'Shape',
    frame: 'Frame',
    connector: 'Connector',
    drawing: 'Drawing',
    'linked-doc': 'Linked doc',
    group: 'Group',
    multiple: 'Objects',
    object: 'Object',
  }[kind];
}

export function canvasLayerEntries(host: EditorHost): LayerEntry[] {
  const gfx = host.std.get(GfxControllerIdentifier);
  const roots = gfx.gfxElements
    .filter(model => model.group === null)
    .sort((a, b) => gfx.layer.compare(b, a));
  const counts = new Map<CanvasItemKind, number>();
  const result: LayerEntry[] = [];

  const visit = (model: GfxModel, depth: number) => {
    if (!canvasModelVisible(model)) return;
    const kind = modelKind(model);
    const count = (counts.get(kind) ?? 0) + 1;
    counts.set(kind, count);
    const groupTitle = model instanceof GroupElementModel ? model.title.toString().trim() : '';
    result.push({
      id: model.id,
      depth,
      kind,
      label: groupTitle || `${kindLabel(kind)} ${count}`,
      locked: model.isLocked(),
      lockedBySelf: model.isLockedBySelf(),
      isGroup: model instanceof GroupElementModel,
    });
    if (isGfxGroupCompatibleModel(model)) {
      [...model.childElements]
        .sort((a, b) => gfx.layer.compare(b, a))
        .forEach(child => visit(child, depth + 1));
    }
  };
  roots.forEach(root => visit(root, 0));
  return result;
}

function modelById(host: EditorHost, id: string): GfxModel {
  const gfx = host.std.get(GfxControllerIdentifier);
  const model = gfx.getElementById<GfxModel>(id);
  if (!model) throw new Error('That layer is no longer available.');
  return model;
}

export function selectCanvasLayer(host: EditorHost, id: string): void {
  if (!host.isConnected || !canvasModelVisible(modelById(host, id))) return;
  host.std.get(GfxControllerIdentifier).selection.set({ elements: [id], editing: false });
}

export async function reorderCanvasLayer(
  host: EditorHost,
  id: string,
  direction: ReorderingDirection
): Promise<void> {
  const gfx = host.std.get(GfxControllerIdentifier);
  const model = modelById(host, id);
  if (!host.isConnected || host.std.store.readonly || protectedModel(model)) return;
  await withCanvasReservation(host, [id], false, () => {
    if (!host.isConnected || host.std.store.readonly || protectedModel(model) || gfx.getElementById(id) !== model) return;
    const index = gfx.layer.getReorderedIndex(model, direction);
    if (index === model.index) return;
    host.std.store.captureSync();
    host.std.store.transact(() => { model.index = index; });
    host.std.store.captureSync();
  });
}

/** Resolve the actual lock owner, including a containing mind map. */
export function canvasLayerLockTarget(host: EditorHost, id: string): GfxModel {
  let model = modelById(host, id);
  while (!model.isLockedBySelf() && model.group && model.isLockedByAncestor()) model = model.group;
  return model;
}

export async function setCanvasLayerLocked(host: EditorHost, id: string, locked: boolean): Promise<void> {
  if (!host.isConnected || host.std.store.readonly) return;
  const model = modelById(host, id);
  await withCanvasReservation(host, [id], false, () => {
    if (!host.isConnected || host.std.store.readonly || host.std.get(GfxControllerIdentifier).getElementById(id) !== model) return;
    host.std.store.captureSync();
    if (locked) model.lock();
    else model.unlock();
    host.std.store.captureSync();
  });
}

export async function groupCanvasSelection(host: EditorHost): Promise<void> {
  if (!selectedLayerCanGroup(host)) return;
  const ids = selectedLayerIds(host);
  await withCanvasReservation(host, ids, true, () => {
    if (!selectedLayerCanGroup(host) || ids.join('\0') !== selectedLayerIds(host).join('\0')) throw new Error('The selection changed. Select the objects and try again.');
    host.std.store.captureSync();
    const [, result] = host.std.command.exec(createGroupFromSelectedCommand);
    host.std.store.captureSync();
    if (!result.groupId) throw new Error('These objects cannot be grouped together.');
  });
}

export async function ungroupCanvasSelection(host: EditorHost): Promise<void> {
  const selected = host.std.get(GfxControllerIdentifier).selection.selectedElements;
  if (!selectedLayerCanUngroup(host) || !(selected[0] instanceof GroupElementModel)) return;
  const group = selected[0];
  await withCanvasReservation(host, [group.id], false, () => {
    if (!selectedLayerCanUngroup(host) || selectedLayerIds(host)[0] !== group.id) throw new Error('The selection changed. Select the group and try again.');
    host.std.store.captureSync();
    host.std.command.exec(ungroupCommand, { group });
    host.std.store.captureSync();
  });
}

export type AlignmentAction =
  | 'left'
  | 'center-x'
  | 'right'
  | 'top'
  | 'center-y'
  | 'bottom'
  | 'distribute-x'
  | 'distribute-y';

function writeBound(host: EditorHost, model: GfxModel, bound: Bound): void {
  const crud = host.std.get(EdgelessCRUDIdentifier);
  updateXYWH(model, bound, crud.updateElement, host.std.store.updateBlock);
}

export async function alignCanvasSelection(host: EditorHost, action: AlignmentAction): Promise<void> {
  if (!canvasSelectionEditable(host)) return;
  const ids = selectedLayerIds(host);
  await withCanvasReservation(host, ids, false, () => {
    if (ids.join('\0') !== selectedLayerIds(host).join('\0')) throw new Error('The selection changed. Select the objects and try again.');
    applyAlignment(host, action);
  });
}

function applyAlignment(host: EditorHost, action: AlignmentAction): void {
  if (!canvasSelectionEditable(host)) return;
  const gfx = host.std.get(GfxControllerIdentifier);
  if (mindmapArrangementReason(gfx.selection.selectedElements)) return;
  // Native document order resolves equal coordinates, regardless of selection order.
  const models = gfx.gfxElements.filter(model => gfx.selection.selectedElements.includes(model));
  const minimum = action.startsWith('distribute') ? 3 : 2;
  if (models.length < minimum) {
    return;
  }
  if (models.some(model => model.isLocked())) throw new Error('Unlock selected objects first.');
  const bounds = models.map(model => model.elementBound);
  if (bounds.some(bound => !bound.toXYWH().every(Number.isFinite))) return;
  const left = Math.min(...bounds.map(bound => bound.minX));
  const right = Math.max(...bounds.map(bound => bound.maxX));
  const top = Math.min(...bounds.map(bound => bound.minY));
  const bottom = Math.max(...bounds.map(bound => bound.maxY));

  host.std.store.captureSync();
  host.std.store.transact(() => {
    if (action === 'distribute-x') {
      const ordered = [...models].sort((a, b) => a.elementBound.minX - b.elementBound.minX);
      const totalWidth = ordered.reduce((sum, model) => sum + model.elementBound.w, 0);
      const gap = (right - left - totalWidth) / (ordered.length - 1);
      let cursor = ordered[0]!.elementBound.maxX + gap;
      for (let index = 1; index < ordered.length - 1; index++) {
        const model = ordered[index]!;
        const visible = model.elementBound;
        const bound = Bound.deserialize(model.xywh);
        bound.x = cursor + visible.w / 2 - bound.w / 2;
        cursor += visible.w + gap;
        writeBound(host, model, bound);
      }
      return;
    }
    if (action === 'distribute-y') {
      const ordered = [...models].sort((a, b) => a.elementBound.minY - b.elementBound.minY);
      const totalHeight = ordered.reduce((sum, model) => sum + model.elementBound.h, 0);
      const gap = (bottom - top - totalHeight) / (ordered.length - 1);
      let cursor = ordered[0]!.elementBound.maxY + gap;
      for (let index = 1; index < ordered.length - 1; index++) {
        const model = ordered[index]!;
        const visible = model.elementBound;
        const bound = Bound.deserialize(model.xywh);
        bound.y = cursor + visible.h / 2 - bound.h / 2;
        cursor += visible.h + gap;
        writeBound(host, model, bound);
      }
      return;
    }

    models.forEach((model, index) => {
      const visible = bounds[index]!;
      const bound = Bound.deserialize(model.xywh);
      if (action === 'left') bound.x = left + (bound.minX - visible.minX);
      if (action === 'center-x') bound.x = (left + right) / 2 - bound.w / 2;
      if (action === 'right') bound.x = right - bound.w + (bound.maxX - visible.maxX);
      if (action === 'top') bound.y = top + (bound.minY - visible.minY);
      if (action === 'center-y') bound.y = (top + bottom) / 2 - bound.h / 2;
      if (action === 'bottom') bound.y = bottom - bound.h + (bound.maxY - visible.maxY);
      writeBound(host, model, bound);
    });
  });
  host.std.store.captureSync();
}

export function selectedLayerIds(host: EditorHost): string[] {
  return host.std.get(GfxControllerIdentifier).selection.selectedElements.map(model => model.id);
}

export function selectedLayerCanGroup(host: EditorHost): boolean {
  const selected = host.std.get(GfxControllerIdentifier).selection.selectedElements;
  return canvasSelectionEditable(host) && !mindmapArrangementReason(selected) && selected.length >= 2 && selected.every(model => model.group === selected[0]!.group);
}

export function selectedLayerCanUngroup(host: EditorHost): boolean {
  const selected = host.std.get(GfxControllerIdentifier).selection.selectedElements;
  return canvasSelectionEditable(host) && selected.length === 1 && selected[0] instanceof GroupElementModel;
}
