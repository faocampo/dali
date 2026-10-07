import { expect, it } from 'vitest';
import * as Y from 'yjs';
import { historyActionId, historyReservationTargets, trackHistoryFootprints } from './history-footprint';

function fixture() {
  const doc = new Y.Doc(); const elements = new Y.Map<Y.Map<unknown>>();
  const surface = new Y.Map<unknown>([['sys:flavour', 'affine:surface'], ['prop:elements', new Y.Map<unknown>([['type', '$blocksuite:internal:native$'], ['value', elements]])]]);
  doc.getMap('blocks').set('surface', surface);
  for (const id of ['a', 'b']) elements.set(id, new Y.Map<unknown>([['type', 'shape'], ['xywh', '[0,0,100,100]']]));
  const manager = new Y.UndoManager(doc.getMap('blocks'), { trackedOrigins: new Set([doc.clientID]) });
  const dispose = trackHistoryFootprints(doc, manager);
  return { doc, elements, manager, close() { dispose(); manager.destroy(); doc.destroy(); } };
}
it('derives a history entry from all its actual edits, independently of selection', () => {
  const f = fixture();
  f.doc.transact(() => f.elements.get('a')!.set('xywh', '[20,0,100,100]'), f.doc.clientID);
  f.doc.transact(() => f.elements.get('b')!.set('xywh', '[40,0,100,100]'), f.doc.clientID);
  expect(historyReservationTargets(f.doc, f.manager.undoStack.at(-1))).toEqual({ ids: ['a', 'b'], create: false });
  f.manager.stopCapturing();
  f.doc.transact(() => f.elements.get('a')!.set('xywh', '[60,0,100,100]'), 'remote');
  expect(f.manager.undoStack).toHaveLength(1);
  f.doc.transact(() => f.elements.get('b')!.set('xywh', '[80,0,100,100]'), f.doc.clientID);
  expect(historyReservationTargets(f.doc, f.manager.undoStack.at(-1))).toEqual({ ids: ['b'], create: false });
  f.manager.undo();
  expect(historyReservationTargets(f.doc, f.manager.redoStack.at(-1))).toEqual({ ids: ['b'], create: false });
  f.close();
});
it('reserving an undo that restores a removed object requires creation admission', () => {
  const f = fixture();
  f.doc.transact(() => f.elements.delete('a'), f.doc.clientID);
  expect(historyReservationTargets(f.doc, f.manager.undoStack.at(-1))).toEqual({ ids: [], create: true });
  f.manager.undo();
  expect(historyReservationTargets(f.doc, f.manager.redoStack.at(-1))).toEqual({ ids: ['a'], create: false });
  f.close();
});

it('binds one native capture to its fresh action and fails closed if distinct leases merge', () => {
  const f = fixture(); let action = 'first';
  const dispose = trackHistoryFootprints(f.doc, f.manager, () => action);
  f.doc.transact(() => f.elements.get('a')!.set('xywh', '[20,0,100,100]'), f.doc.clientID);
  expect(historyActionId(f.manager.undoStack.at(-1))).toBe('first');
  action = 'second'; f.doc.transact(() => f.elements.get('a')!.set('xywh', '[40,0,100,100]'), f.doc.clientID);
  expect(historyActionId(f.manager.undoStack.at(-1))).toBeUndefined();
  f.manager.stopCapturing(); f.doc.transact(() => f.elements.get('b')!.set('xywh', '[60,0,100,100]'), f.doc.clientID);
  expect(historyActionId(f.manager.undoStack.at(-1))).toBe('second');
  dispose(); f.close();
});
