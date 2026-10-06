import { afterEach, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { capturePersonalHistorySessions } from './personal-history';

afterEach(() => vi.useRealTimers());
function fixture() {
  vi.useFakeTimers(); vi.setSystemTime(1000);
  const doc = new Y.Doc(); const text = doc.getText('text'); const props = doc.getMap('props');
  const manager = new Y.UndoManager([text, props], { trackedOrigins: new Set([doc.clientID]) });
  const originalStop = manager.stopCapturing;
  const capture = capturePersonalHistorySessions(manager);
  const insert = (value: string) => doc.transact(() => text.insert(text.length, value), doc.clientID);
  return { doc, text, props, manager, capture, insert, originalStop, close() { capture.dispose(); manager.destroy(); doc.destroy(); } };
}

it('groups an entire text session across pauses and native intermediate capture stops', () => {
  const f = fixture();
  try {
    f.capture.setTextEditing(true); f.insert('First');
    vi.advanceTimersByTime(5000); f.manager.stopCapturing(); f.insert('Second');
    f.doc.transact(() => f.props.set('remote', 'kept'), 'remote');
    f.capture.setTextEditing(false);
    expect(f.manager.undoStack).toHaveLength(1);
    f.manager.undo(); expect(f.text.toString()).toBe(''); expect(f.props.get('remote')).toBe('kept');
    f.manager.redo(); expect(f.text.toString()).toBe('FirstSecond');
    f.capture.setTextEditing(true); f.insert('Third'); f.capture.setTextEditing(false);
    f.manager.undo(); expect(f.text.toString()).toBe('FirstSecond');
  } finally { f.close(); }
});

it('keeps one completed multi-step operation separate from the next operation', () => {
  const f = fixture();
  try {
    const finish = f.capture.beginOperation(); f.insert('a'); vi.advanceTimersByTime(5000); f.manager.stopCapturing(); f.insert('b'); finish(); finish();
    const next = f.capture.beginOperation(); f.insert('c'); next();
    expect(f.manager.undoStack).toHaveLength(2);
    const inverse = f.capture.beginOperation(); f.manager.undo(); inverse();
    expect(f.text.toString()).toBe('ab'); f.manager.undo(); expect(f.text.toString()).toBe('');
    f.manager.redo(); f.manager.redo(); expect(f.text.toString()).toBe('abc');
  } finally { f.close(); }
});

it('keeps capture open when a reserved pointer operation enters text editing and restores native lifecycle on disposal', () => {
  const f = fixture();
  try {
    const finish = f.capture.beginOperation(); f.insert('setup'); f.capture.setTextEditing(true); finish();
    vi.advanceTimersByTime(5000); f.insert('text'); f.capture.setTextEditing(false);
    expect(f.manager.undoStack).toHaveLength(1);
    expect(f.manager.captureTimeout).toBe(500);
    f.capture.dispose(); expect(f.manager.stopCapturing).toBe(f.originalStop);
    f.insert('separate'); expect(f.manager.undoStack).toHaveLength(2);
  } finally { f.close(); }
});
