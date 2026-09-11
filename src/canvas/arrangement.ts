import { EdgelessCRUDIdentifier, updateXYWH } from '@blocksuite/affine-block-surface';
import { createGroupFromSelectedCommand, ungroupCommand } from '@blocksuite/affine-gfx-group';
import { GroupElementModel } from '@blocksuite/affine/model';
import type { EditorHost } from '@blocksuite/affine/std';
import {
  GfxControllerIdentifier,
  isGfxGroupCompatibleModel,
  type GfxModel,
  type ReorderingDirection,
} from '@blocksuite/affine/std/gfx';
import { Bound } from '@blocksuite/global/gfx';
import { canvasModelKind, type CanvasItemKind } from './selection-summary';

export type LayerEntry = {
  id: string;
  depth: number;
  kind: CanvasItemKind;
  label: string;
  locked: boolean;
  lockedBySelf: boolean;
  isGroup: boolean;
};

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
  host.std.get(GfxControllerIdentifier).selection.set({ elements: [id], editing: false });
}

export function reorderCanvasLayer(
  host: EditorHost,
  id: string,
  direction: ReorderingDirection
): void {
  const gfx = host.std.get(GfxControllerIdentifier);
  const model = modelById(host, id);
  const index = gfx.layer.getReorderedIndex(model, direction);
  if (index === model.index) return;
  host.std.store.captureSync();
  host.std.store.transact(() => {
    model.index = index;
  });
  host.std.store.captureSync();
}

export function setCanvasLayerLocked(host: EditorHost, id: string, locked: boolean): void {
  const model = modelById(host, id);
  host.std.store.captureSync();
  if (locked) model.lock();
  else model.unlock();
  host.std.store.captureSync();
}

export function groupCanvasSelection(host: EditorHost): void {
  const gfx = host.std.get(GfxControllerIdentifier);
  if (gfx.selection.selectedElements.length < 2) {
    throw new Error('Select at least two objects to group.');
  }
  host.std.store.captureSync();
  const [, result] = host.std.command.exec(createGroupFromSelectedCommand);
  host.std.store.captureSync();
  if (!result.groupId) throw new Error('These objects cannot be grouped together.');
}

export function ungroupCanvasSelection(host: EditorHost): void {
  const selected = host.std.get(GfxControllerIdentifier).selection.selectedElements;
  if (selected.length !== 1 || !(selected[0] instanceof GroupElementModel)) {
    throw new Error('Select one group to ungroup.');
  }
  host.std.store.captureSync();
  host.std.command.exec(ungroupCommand, { group: selected[0] });
  host.std.store.captureSync();
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

export function alignCanvasSelection(host: EditorHost, action: AlignmentAction): void {
  const models = [...host.std.get(GfxControllerIdentifier).selection.selectedElements];
  const minimum = action.startsWith('distribute') ? 3 : 2;
  if (models.length < minimum) {
    throw new Error(`Select at least ${minimum} objects for this arrangement.`);
  }
  if (models.some(model => model.isLocked())) throw new Error('Unlock selected objects first.');
  const bounds = models.map(model => model.elementBound);
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
  return selected.length >= 2 && selected.every(model => model.group === selected[0]!.group);
}

export function selectedLayerCanUngroup(host: EditorHost): boolean {
  const selected = host.std.get(GfxControllerIdentifier).selection.selectedElements;
  return selected.length === 1 && selected[0] instanceof GroupElementModel;
}
