import { isPrimitiveModel, type GfxModel } from '@blocksuite/affine/std/gfx';
import type { MindmapElementModel } from '@blocksuite/affine/model';
import { validateMindmapState } from './mindmap-state';

export function mindmapOwner(model: GfxModel): MindmapElementModel | null {
  const candidate = isPrimitiveModel(model) && model.type === 'mindmap' ? model : model.group;
  return candidate && isPrimitiveModel(candidate) && candidate.type === 'mindmap' ? candidate as MindmapElementModel : null;
}

export function nativeMindmapState(map: MindmapElementModel) {
  return validateMindmapState([...map.children].map(([id, detail]) => {
    const model = map.surface.getElementById(id);
    if (!model) throw new Error('The mind map has invalid topic membership.');
    return { id, ...detail, bounds: model.elementBound.toXYWH() };
  }));
}

export function canvasModelVisible(model: GfxModel): boolean {
  if (isPrimitiveModel(model) && model.hidden) return false;
  const map = mindmapOwner(model);
  // Native local collapse badges are not document topics.
  if (!map || map.id === model.id || !map.children.has(model.id)) return true;
  try { return nativeMindmapState(map).visible.has(model.id); } catch { return false; }
}

export function mindmapArrangementReason(elements: readonly GfxModel[]): string | null {
  return elements.some(model => {
    const map = mindmapOwner(model);
    return map && map.id !== model.id;
  }) ? 'Select the whole mind map to group or align it.' : null;
}

export type CanvasSelectionSummary = {
  key: string;
  count: number;
  kind: CanvasItemKind;
  title: string;
};

export type CanvasItemKind =
  | 'image'
  | 'text'
  | 'sticky'
  | 'shape'
  | 'frame'
  | 'connector'
  | 'drawing'
  | 'linked-doc'
  | 'group'
  | 'multiple'
  | 'object';

const ITEM_LABELS: Record<CanvasItemKind, string> = {
  image: 'Image',
  text: 'Text',
  sticky: 'Sticky note',
  shape: 'Shape',
  frame: 'Frame',
  connector: 'Connector',
  drawing: 'Drawing',
  'linked-doc': 'Linked doc',
  group: 'Group',
  multiple: 'Multiple objects',
  object: 'Object',
};

/**
 * Turn BlockSuite's model identifiers into the product language used by the
 * inspector. Kept separate from React so the mapping can be pinned by a small
 * unit test without constructing an editor runtime.
 */
export function canvasItemKind(identifier: string): CanvasItemKind {
  switch (identifier) {
    case 'affine:image':
      return 'image';
    case 'affine:edgeless-text':
    case 'affine:paragraph':
    case 'text':
      return 'text';
    case 'affine:note':
      return 'sticky';
    case 'affine:frame':
      return 'frame';
    case 'affine:embed-linked-doc':
    case 'affine:embed-synced-doc':
      return 'linked-doc';
    case 'shape':
      return 'shape';
    case 'connector':
      return 'connector';
    case 'brush':
      return 'drawing';
    case 'group':
      return 'group';
    default:
      return 'object';
  }
}

export function canvasModelKind(element: GfxModel): CanvasItemKind {
  const identifier = isPrimitiveModel(element) ? element.type : element.flavour;
  return canvasItemKind(identifier);
}

export function summarizeCanvasSelection(
  elements: readonly GfxModel[]
): CanvasSelectionSummary | null {
  elements = elements.filter(canvasModelVisible);
  if (elements.length === 0) return null;

  const ids = elements.map((element) => element.id).sort();
  if (elements.length > 1) {
    return {
      key: ids.join('|'),
      count: elements.length,
      kind: 'multiple',
      title: ITEM_LABELS.multiple,
    };
  }

  const element = elements[0]!;
  const kind = canvasModelKind(element);
  return { key: ids[0]!, count: 1, kind, title: ITEM_LABELS[kind] };
}
