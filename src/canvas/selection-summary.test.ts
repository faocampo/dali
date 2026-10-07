import { describe, expect, it } from 'vitest';
import { canvasItemKind } from './selection-summary';

describe('canvasItemKind', () => {
  it.each([
    ['affine:image', 'image'],
    ['affine:edgeless-text', 'text'],
    ['affine:note', 'sticky'],
    ['affine:frame', 'frame'],
    ['affine:embed-linked-doc', 'linked-doc'],
    ['affine:embed-synced-doc', 'linked-doc'],
    ['shape', 'shape'],
    ['connector', 'connector'],
    ['brush', 'drawing'],
    ['group', 'group'],
    ['unknown-future-model', 'object'],
  ] as const)('maps %s to %s', (identifier, expected) => {
    expect(canvasItemKind(identifier)).toBe(expected);
  });
});
