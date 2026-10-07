import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { changedNativeObjects, nativeReservationTargets } from './change-footprint.js';
import { CollaborationBroker } from './reservations.js';

function nativeDocument() {
  const doc = new Y.Doc(); const surface = new Y.Map<unknown>(); const box = new Y.Map<unknown>(); const elements = new Y.Map<unknown>();
  surface.set('sys:flavour', 'affine:surface'); box.set('type', '$blocksuite:internal:native$'); box.set('value', elements); surface.set('prop:elements', box);
  doc.getMap('blocks').set('surface', surface);
  for (const id of ['a', 'b']) { const shape = new Y.Map<unknown>(); shape.set('type', 'shape'); shape.set('xywh', '[0,0,100,100]'); shape.set('text', new Y.Text('Example')); elements.set(id, shape); }
  const before = new Y.Doc(); Y.applyUpdate(before, Y.encodeStateAsUpdate(doc));
  return { doc, before, elements, close() { doc.destroy(); before.destroy(); } };
}
describe('whole-object reservations', () => {
  it('@05-02-02 image adjustments share the image reservation and include old and new owners', () => {
    const f = nativeDocument(); const blocks = f.doc.getMap('blocks');
    for (const id of ['image1', 'image2']) blocks.set(id, new Y.Map<unknown>([['sys:flavour', 'affine:image'], ['prop:xywh', '[0,0,200,100]']]));
    const edit = new Y.Map<unknown>([['sys:flavour', 'djai:image-visual-edit'], ['prop:imageId', 'image1'], ['prop:brightness', 0]]);
    blocks.set('adjustment', edit); Y.applyUpdate(f.before, Y.encodeStateAsUpdate(f.doc));
    expect(nativeReservationTargets(f.doc, ['image1'])).toEqual(['adjustment', 'image1']);
    edit.set('prop:brightness', 20);
    expect(changedNativeObjects(f.before, f.doc)).toEqual(['adjustment', 'image1']);
    edit.set('prop:imageId', 'image2');
    expect(changedNativeObjects(f.before, f.doc)).toEqual(['adjustment', 'image1', 'image2']);
    f.close();
  });

  it('@05-02-02 frame membership reserves descendants while separate members stay independent', () => {
    const f = nativeDocument();
    const frame = new Y.Map<unknown>([['sys:flavour', 'affine:frame'], ['prop:xywh', '[0,0,500,500]'], ['prop:childElementIds', { a: true, b: true }]]);
    f.doc.getMap('blocks').set('frame', frame); Y.applyUpdate(f.before, Y.encodeStateAsUpdate(f.doc));
    expect(nativeReservationTargets(f.doc, ['frame'])).toEqual(['a', 'b', 'frame']);
    expect(nativeReservationTargets(f.doc, ['a'])).toEqual(['a']);
    (f.elements.get('a') as Y.Map<unknown>).set('xywh', '[20,0,100,100]');
    expect(changedNativeObjects(f.before, f.doc)).toEqual(['a']);
    Y.applyUpdate(f.before, Y.encodeStateAsUpdate(f.doc));
    frame.set('prop:childElementIds', { a: true });
    expect(changedNativeObjects(f.before, f.doc)).toEqual(['a', 'b', 'frame']);
    f.close();
  });
  it('@05-02-01 native nested text and geometry effects require the same object lease', () => {
    const fixture = nativeDocument(); const broker = new CollaborationBroker(() => 0);
    const first = broker.connect('board', 'first', 'one'); const other = broker.connect('board', 'other', 'two');
    const token = broker.acquire(first, ['a'])!;
    (fixture.elements.get('a') as Y.Map<unknown>).get('text');
    ((fixture.elements.get('a') as Y.Map<unknown>).get('text') as Y.Text).insert(7, ' text');
    expect(changedNativeObjects(fixture.before, fixture.doc)).toEqual(['a']);
    expect(broker.owns(first, token, ['a'])).toBe(true); expect(broker.acquire(other, ['a'])).toBeNull();
    expect(broker.acquire(other, ['b'])).toBeTruthy(); fixture.close();
  });
  it('@05-02-01 nested property deletion cannot hide an effect on another object', () => {
    const fixture = nativeDocument();
    (fixture.elements.get('b') as Y.Map<unknown>).delete('text');
    expect(changedNativeObjects(fixture.before, fixture.doc)).toEqual(['b']); fixture.close();
  });  it('@05-02-02 rich-text formatting attributes remain part of the affected object', () => {
    const fixture = nativeDocument();
    ((fixture.elements.get('a') as Y.Map<unknown>).get('text') as Y.Text).format(0, 7, { bold: true });
    expect(changedNativeObjects(fixture.before, fixture.doc)).toEqual(['a']); fixture.close();
  });
  it('@05-02-02 classifies object creation and deletion explicitly', () => {
    const fixture = nativeDocument(); const added = new Y.Map<unknown>();
    added.set('type', 'shape'); added.set('xywh', '[0,0,100,100]'); fixture.elements.set('c', added); fixture.elements.delete('a');
    expect(changedNativeObjects(fixture.before, fixture.doc)).toEqual(['a', 'c']); fixture.close();
  });
  it('@05-02-02 removing a group includes all its descendants', () => {
    const fixture = nativeDocument(); const group = new Y.Map<unknown>(); group.set('type', 'group'); group.set('children', new Y.Map([['a', true], ['b', true]]));
    fixture.elements.set('g', group); Y.applyUpdate(fixture.before, Y.encodeStateAsUpdate(fixture.doc));
    fixture.elements.delete('g');
    expect(changedNativeObjects(fixture.before, fixture.doc)).toEqual(['a', 'b', 'g']); fixture.close();
  });
  it('@05-02-02 connector relationship changes reserve both old and new endpoints', () => {
    const fixture = nativeDocument(); const connector = new Y.Map<unknown>(); connector.set('type', 'connector'); connector.set('source', { id: 'a' }); connector.set('target', { id: 'b' });
    fixture.elements.set('line', connector); Y.applyUpdate(fixture.before, Y.encodeStateAsUpdate(fixture.doc));
    connector.set('target', { position: [10, 20] });
    expect(changedNativeObjects(fixture.before, fixture.doc)).toEqual(['a', 'b', 'line']); fixture.close();
  });
  it('@05-02-02 isolates board metadata from independent objects', () => {
    const fixture = nativeDocument(); fixture.doc.getMap('meta').set('title', 'Renamed');
    expect(changedNativeObjects(fixture.before, fixture.doc)).toEqual(['$dali:metadata']); fixture.close();
  });

  it.each(['cycle', 'dangling', 'duplicate-id'])('@05-02-02 rejects %s native structure even when another object changes', fault => {
    const fixture = nativeDocument();
    const group = new Y.Map<unknown>(); group.set('type', 'group');
    group.set('children', new Y.Map([[fault === 'cycle' ? 'g' : fault === 'dangling' ? 'missing' : 'a', true]]));
    fixture.elements.set('g', group);
    if (fault === 'duplicate-id') {
      const block = new Y.Map<unknown>(); block.set('sys:flavour', 'affine:note');
      fixture.doc.getMap('blocks').set('a', block);
    }
    Y.applyUpdate(fixture.before, Y.encodeStateAsUpdate(fixture.doc));
    (fixture.elements.get('b') as Y.Map<unknown>).set('xywh', '[20,0,100,100]');
    expect(changedNativeObjects(fixture.before, fixture.doc)).toBeNull(); fixture.close();
  });

  it('@05-02-02 surface child insertion reserves the new image rather than rejecting its parent', () => {
    const fixture = nativeDocument();
    const surface = fixture.doc.getMap<Y.Map<unknown>>('blocks').get('surface')!;
    surface.set('sys:children', new Y.Array<string>());
    Y.applyUpdate(fixture.before, Y.encodeStateAsUpdate(fixture.doc));
    const image = new Y.Map<unknown>(); image.set('sys:flavour', 'affine:image'); image.set('prop:xywh', '[0,0,100,100]');
    fixture.doc.getMap('blocks').set('image', image);
    (surface.get('sys:children') as Y.Array<string>).push(['image']);
    expect(changedNativeObjects(fixture.before, fixture.doc)).toEqual(['image']); fixture.close();
  });

  it('@05-02-02 adopts newly committed objects into a creation lease atomically', () => {
    const broker = new CollaborationBroker(() => 0);
    const creator = broker.connect('board', 'first', 'one'); const other = broker.connect('board', 'other', 'two');
    const token = broker.acquire(creator, ['$dali:create:' + creator.id])!;
    broker.acquire(other, ['occupied']);
    expect(broker.extend(creator, token, ['fresh', 'occupied'])).toBe(false);
    expect(broker.owns(creator, token, ['fresh'])).toBe(false);
    expect(broker.extend(creator, token, ['fresh'])).toBe(true);
    expect(broker.owns(creator, token, ['fresh'])).toBe(true);
    expect(broker.acquire(other, ['fresh'])).toBeNull();
    broker.releaseObjects(creator, token, ['fresh']);
    expect(broker.owns(creator, token, ['$dali:create:' + creator.id])).toBe(true);
    expect(broker.acquire(other, ['fresh'])).toBeTruthy();
    broker.release(creator, token);
    expect(broker.extend(creator, token, ['later'])).toBe(false);
  });

  it('@05-02-02 connected idle ownership survives heartbeat and disconnect releases it immediately', () => {
    let now = 0; const broker = new CollaborationBroker(() => now);
    const first = broker.connect('board', 'first', 'one'); const other = broker.connect('board', 'other', 'two');
    const token = broker.acquire(first, ['a', 'b'])!;
    for (let beat = 0; beat < 6; beat++) {
      now += 15000; broker.touch(first); broker.touch(other);
      expect(broker.acquire(other, ['a'])).toBeNull();
      expect(broker.owns(first, token, ['a', 'b'])).toBe(true);
    }
    broker.disconnect(first);
    expect(broker.owns(first, token, ['a'])).toBe(false);
    expect(broker.acquire(other, ['a', 'b'])).toBeTruthy();
  });

});
