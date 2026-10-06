import type * as Y from 'yjs';

/** Native history remains tab-scoped; explicit editing sessions replace timeout grouping. */
export function installHistorySessions(manager: Y.UndoManager) {
  const stop = manager.stopCapturing; const timeout = manager.captureTimeout;
  let active = false;
  manager.stopCapturing = () => { if (!active) stop.call(manager); };
  return {
    begin() { if (active) return; stop.call(manager); active = true; manager.captureTimeout = Number.POSITIVE_INFINITY; },
    end() { if (!active) return; active = false; manager.captureTimeout = timeout; stop.call(manager); },
    dispose() { active = false; manager.captureTimeout = timeout; manager.stopCapturing = stop; stop.call(manager); },
  };
}
