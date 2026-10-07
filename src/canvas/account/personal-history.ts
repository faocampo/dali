import type * as Y from 'yjs';

type HistoryStep = Y.UndoManager['undoStack'][number];
type HistoryDirection = 'undo' | 'redo';

/** Isolate one authorized item so native no-effect skipping cannot reach an
 * older entry that has not obtained its own reservation and version check.
 * Native clear handles retention/GC for discarded entries; native undo/redo
 * still owns inverse generation and the opposite stack.
 */
function isolatedStep(manager: Y.UndoManager, direction: HistoryDirection, item: HistoryStep | undefined, operation: () => void): boolean {
  const key = direction === 'undo' ? 'undoStack' : 'redoStack';
  const stack = manager[key];
  if (!item || stack.at(-1) !== item) return false;
  const earlier = stack.slice(0, -1);
  manager[key] = [item];
  try { operation(); }
  finally {
    manager[key] = [...earlier, ...manager[key]];
    // Publish the restored native stack availability to Store's existing
    // history observer. No fabricated transaction or shared undo is created.
    manager.emit('stack-cleared', [{ undoStackCleared: false, redoStackCleared: false }]);
  }
  return true;
}
export function discardPersonalHistoryStep(manager: Y.UndoManager, direction: HistoryDirection, item: HistoryStep | undefined): boolean {
  return isolatedStep(manager, direction, item, () => manager.clear(direction === 'undo', direction === 'redo'));
}
export function runPersonalHistoryStep(manager: Y.UndoManager, direction: HistoryDirection, item: HistoryStep | undefined, operation: () => void): boolean {
  return isolatedStep(manager, direction, item, operation);
}

/** Native history capture follows completed actions, not pauses in input. */
export function capturePersonalHistorySessions(manager: Y.UndoManager) {
  const timeout = manager.captureTimeout;
  const nativeStop = manager.stopCapturing;
  const ownStop = Object.getOwnPropertyDescriptor(manager, 'stopCapturing');
  let editing = false; let operations = 0; let active = false; let disposed = false;
  const update = () => {
    const next = editing || operations > 0;
    if (disposed || next === active) return;
    nativeStop.call(manager);
    active = next;
    manager.captureTimeout = active ? Infinity : timeout;
  };
  const stop = () => {
    // Preserve UndoManager's own undo/redo lifecycle even while a reserved
    // command owns a capture scope. Native text widgets' intermediate stops
    // cannot split the user's still-open editing session.
    if (!active || manager.undoing || manager.redoing) nativeStop.call(manager);
  };
  manager.stopCapturing = stop;
  return {
    setTextEditing(value: boolean) { editing = value; update(); },
    beginOperation() {
      if (disposed) return () => {};
      operations++; update();
      let ended = false;
      return () => { if (ended || disposed) return; ended = true; operations--; update(); };
    },
    dispose() {
      if (disposed) return;
      disposed = true; nativeStop.call(manager); manager.captureTimeout = timeout;
      if (manager.stopCapturing === stop) {
        if (ownStop) Object.defineProperty(manager, 'stopCapturing', ownStop);
        else delete (manager as Partial<Y.UndoManager>).stopCapturing;
      }
    },
  };
}
