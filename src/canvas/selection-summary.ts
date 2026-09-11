import { isPrimitiveModel, type GfxModel } from '@blocksuite/affine/std/gfx';

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
