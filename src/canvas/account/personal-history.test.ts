import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { installHistorySessions } from './personal-history';

describe('personal history sessions', () => {
  it('@05-04-01 groups an entire text session despite pauses and native capture requests', () => {
    const doc = new Y.Doc(); const text = doc.getText('text');
    const manager = new Y.UndoManager(text, { trackedOrigins: new Set([doc.clientID]), captureTimeout: 1 });
    const session = installHistorySessions(manager);
    session.begin();
    doc.transact(() => text.insert(0, 'first'), doc.clientID);
    manager.lastChange = 1; manager.stopCapturing();
    doc.transact(() => text.insert(text.length, ' second'), doc.clientID);
    session.end();
    expect(manager.undoStack).toHaveLength(1);
    manager.undo(); expect(text.toString()).toBe('');
    manager.redo(); expect(text.toString()).toBe('first second');
    session.dispose(); manager.destroy(); doc.destroy();
  });
  it('@05-04-01 preserves remote text and separates completed local sessions', () => {
    const doc = new Y.Doc(); const text = doc.getText('text');
    const manager = new Y.UndoManager(text, { trackedOrigins: new Set([doc.clientID]) });
    const session = installHistorySessions(manager);
    session.begin(); doc.transact(() => text.insert(0, 'A'), doc.clientID); session.end();
    doc.transact(() => text.insert(text.length, 'R'), 'remote');
    session.begin(); doc.transact(() => text.insert(text.length, 'B'), doc.clientID); session.end();
    expect(manager.undoStack).toHaveLength(2);
    manager.undo(); expect(text.toString()).toBe('AR'); manager.undo(); expect(text.toString()).toBe('R');
    session.dispose(); manager.destroy(); doc.destroy();
  });
});
