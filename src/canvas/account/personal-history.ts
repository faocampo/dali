import type * as Y from 'yjs';

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
