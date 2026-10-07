import { describe, it, expect } from 'vitest';
import { mindmapExportSnapshot } from './mindmap-export';

const topics = [
  { id: 'root', index: 'a0', bounds: [0,0,100,40] },
  { id: 'branch', parent: 'root', index: 'a0', collapsed: true, bounds: [200,0,100,40] },
  { id: 'hidden', parent: 'branch', index: 'a0', bounds: [20000,20000,100,40] },
  { id: 'sibling', parent: 'root', index: 'a1', bounds: [200,100,100,40] },
];
describe('immutable visible export authorization', () => {
  it('omits collapsed descendants and their edges before allocation', () => {
    const before = JSON.stringify(topics);
    const result = mindmapExportSnapshot('map', topics);
    expect(result.topicIds).toEqual(['root','branch','sibling']);
    expect(result.edges).toEqual([{source:'root',target:'branch'},{source:'root',target:'sibling'}]);
    expect(result.collapsed).toBe(true);
    expect(Object.isFrozen(result.edges[0])).toBe(true);
    expect(JSON.stringify(topics)).toBe(before);
  });
  it('rejects malformed topology before creating an export snapshot', () => {
    expect(() => mindmapExportSnapshot('map', [...topics,{...topics[1]!,id:'orphan',parent:'missing'}])).toThrow('invalid');
    expect(() => mindmapExportSnapshot('map', [{...topics[0]!,bounds:[NaN,0,1,1]}])).toThrow('invalid');
  });
  it('authorizes only selected visible endpoints with no implicit descendants', () => {
    const one=mindmapExportSnapshot('map',topics,new Set(['branch','hidden']));
    expect(one.topicIds).toEqual(['branch']);expect(one.edges).toEqual([]);
    const pair=mindmapExportSnapshot('map',topics,new Set(['root','branch']));
    expect(pair.topicIds).toEqual(['root','branch']);expect(pair.edges).toEqual([{source:'root',target:'branch'}]);
    expect(mindmapExportSnapshot('map',topics,new Set(['sibling'])).collapsed).toBe(false);
  });
});
