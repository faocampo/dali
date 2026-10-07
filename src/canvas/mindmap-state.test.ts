import { describe, expect, it } from 'vitest';
import { validateMindmapState, type MindmapTopicSnapshot } from './mindmap-state';

const node = (id: string, parent?: string, collapsed = false): MindmapTopicSnapshot => ({
  id, parent, index: id, collapsed, bounds: [0, 0, 100, 30],
});

describe('bounded native hierarchy preflight', () => {
  it('derives visibility through collapsed ancestors without changing nested flags', () => {
    const input = [node('root'), node('a', 'root', true), node('b', 'root'), node('c', 'a', true), node('d', 'c')];
    const before = structuredClone(input);
    const state = validateMindmapState(input);
    expect([...state.visible]).toEqual(['root', 'a', 'b']);
    expect(state.children.get('root')).toEqual(['a', 'b']);
    expect(state.hiddenAncestor.get('d')).toBe('a');
    expect(input).toEqual(before);
    input[1]!.collapsed = false;
    expect([...validateMindmapState(input).visible]).toEqual(['root', 'a', 'b', 'c']);
  });
  it('keeps a collapsed root visible and accepts leaves', () => {
    expect([...validateMindmapState([node('root', undefined, true), node('a', 'root')]).visible]).toEqual(['root']);
    expect(validateMindmapState([node('root')]).children.get('root')).toEqual([]);
  });
  it.each([
    ['empty', []], ['duplicate IDs', [node('r'), node('r')]],
    ['unknown parent', [node('r'), node('a', 'missing')]],
    ['multiple roots', [node('r'), node('s')]],
    ['cycle', [node('r'), node('a', 'b'), node('b', 'a')]],
    ['self cycle', [node('r'), node('a', 'a')]],
    ['nonfinite geometry', [{ ...node('r'), bounds: [0, 0, Infinity, 2] }]],
    ['negative geometry', [{ ...node('r'), bounds: [0, 0, -1, 2] }]],
    ['empty order', [{ ...node('r'), index: '' }]],
    ['duplicate sibling order', [node('r'), { ...node('a', 'r'), index: 'x' }, { ...node('b', 'r'), index: 'x' }]],
  ])('rejects %s without writes', (_name, input) => {
    const before = structuredClone(input);
    expect(() => validateMindmapState(input as MindmapTopicSnapshot[])).toThrow();
    expect(input).toEqual(before);
  });
  it('terminates iteratively for a 12000-deep chain', () => {
    const input = Array.from({ length: 12000 }, (_, i) => node(String(i), i ? String(i - 1) : undefined, i === 2));
    const state = validateMindmapState(input);
    expect(state.visible.size).toBe(3);
    expect(state.depth.get('11999')).toBe(11999);
    expect(state.work).toBeLessThanOrEqual(input.length * 3);
  });
});
