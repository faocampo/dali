import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { applyNativeUpdate } from './change-footprint.js';

function fixture() {
  const source = new Y.Doc(); const blocks = source.getMap('blocks');
  const elements = new Y.Map<unknown>();
  blocks.set('surface', new Y.Map<unknown>([['sys:flavour', 'affine:surface'], ['sys:children', new Y.Array<string>()],
    ['prop:elements', new Y.Map<unknown>([['type', '$blocksuite:internal:native$'], ['value', elements]])]]));
  for (const id of ['a', 'b']) elements.set(id, new Y.Map<unknown>([['type', 'shape'], ['xywh', '[0,0,100,100]'], ['fillColor', 'red'], ['text', new Y.Text('Example')]]));
  const before = new Y.Doc(); const after = new Y.Doc(); const bytes = Y.encodeStateAsUpdate(source);
  Y.applyUpdate(before, bytes); Y.applyUpdate(after, bytes);
  const vector = Y.encodeStateVector(source);
  return { source, before, after, elements, shape: elements.get('a') as Y.Map<unknown>,
    apply: () => applyNativeUpdate(before, after, Y.encodeStateAsUpdate(source, vector)),
    close() { source.destroy(); before.destroy(); after.destroy(); } };
}

describe('server-derived native property provenance', () => {
  it('@05-04-01 isolates movement from independent formatting on the same object', () => {
    const f = fixture(); f.shape.set('xywh', '[20,0,100,100]');
    expect(f.apply()).toEqual({ objectIds: ['a'], properties: [{ objectId: 'a', property: 'xywh' }] }); f.close();
  });
  it('@05-04-02 records coalesced scalar ABA even when the final value is unchanged', () => {
    const f = fixture(); f.shape.set('fillColor', 'blue'); f.shape.set('fillColor', 'red');
    expect(f.apply()).toEqual({ objectIds: ['a'], properties: [{ objectId: 'a', property: 'fillColor' }] }); f.close();
  });
  it.each(['replace', 'format'])('@05-04-02 records rich-text %s without reducing provenance to final text', kind => {
    const f = fixture(); const text = f.shape.get('text') as Y.Text;
    if (kind === 'replace') { text.delete(0, text.length); text.insert(0, 'Example'); }
    else text.format(0, 7, { bold: true });
    expect(f.apply()).toEqual({ objectIds: ['a'], properties: [{ objectId: 'a', property: 'text' }] }); f.close();
  });
  it('@05-04-02 scopes root child membership to its image, preserving independent objects', () => {
    const f = fixture(); const image = new Y.Map<unknown>([['sys:flavour', 'affine:image'], ['prop:xywh', '[0,0,200,100]']]);
    f.source.getMap('blocks').set('image', image);
    ((f.source.getMap('blocks').get('surface') as Y.Map<unknown>).get('sys:children') as Y.Array<string>).push(['image']);
    expect(f.apply()).toEqual({ objectIds: ['image'], properties: [{ objectId: 'image', property: '*' }] }); f.close();
  });
  it.each(['create', 'delete', 'replace'])('@05-04-02 treats object %s as an atomic whole-object effect', kind => {
    const f = fixture(); const id = kind === 'create' ? 'c' : 'a';
    if (kind !== 'create') f.elements.delete(id);
    if (kind !== 'delete') f.elements.set(id, new Y.Map<unknown>([['type', 'shape'], ['xywh', '[0,0,100,100]'], ['fillColor', 'red'], ['text', new Y.Text('Example')]]));
    expect(f.apply()).toEqual({ objectIds: [id], properties: [{ objectId: id, property: '*' }] }); f.close();
  });
  it('@05-04-02 protects all dependent objects when a group relationship changes', () => {
    const f = fixture(); f.elements.set('group', new Y.Map<unknown>([['type', 'group'], ['children', new Y.Map([['a', true], ['b', true]])]]));
    expect(f.apply()).toEqual({ objectIds: ['a', 'b', 'group'], properties: ['a', 'b', 'group'].map(objectId => ({ objectId, property: '*' })) }); f.close();
  });
  it('@05-04-02 idempotent reapplication has no fresh effects', () => {
    const f = fixture(); f.shape.set('fillColor', 'blue'); f.apply();
    Y.applyUpdate(f.before, Y.encodeStateAsUpdate(f.after));
    expect(f.apply()).toEqual({ objectIds: [], properties: [] }); f.close();
  });
  it.each(['root-wrapper', 'reserved-property'])('@05-04-02 rejects unsupported %s before admitting an inverse', kind => {
    const f = fixture();
    if (kind === 'reserved-property') f.shape.set('*', 'forged');
    else ((f.source.getMap('blocks').get('surface') as Y.Map<unknown>).get('prop:elements') as Y.Map<unknown>).set('type', 'foreign');
    expect(f.apply()).toBeNull(); f.close();
  });
});
