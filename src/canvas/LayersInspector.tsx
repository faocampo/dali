import { useCallback, useEffect, useState } from 'react';
import type { EditorHost } from '@blocksuite/affine/std';
import { GfxControllerIdentifier } from '@blocksuite/affine/std/gfx';
import {
  alignCanvasSelection,
  canvasLayerEntries,
  groupCanvasSelection,
  reorderCanvasLayer,
  selectCanvasLayer,
  selectedLayerCanGroup,
  selectedLayerCanUngroup,
  selectedLayerIds,
  setCanvasLayerLocked,
  ungroupCanvasSelection,
  type AlignmentAction,
  type LayerEntry,
} from './arrangement';

export function LayersInspector({ host, onClose }: { host: EditorHost; onClose: () => void }) {
  const [entries, setEntries] = useState<LayerEntry[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const sync = useCallback(() => {
    setEntries(canvasLayerEntries(host));
    setSelected(selectedLayerIds(host));
  }, [host]);

  useEffect(() => {
    const gfx = host.std.get(GfxControllerIdentifier);
    sync();
    const layerSub = gfx.layer.slots.layerUpdated.subscribe(sync);
    const selectionSub = gfx.selection.slots.updated.subscribe(sync);
    const historySub = host.std.store.history.onUpdated.subscribe(sync);
    return () => {
      layerSub.unsubscribe();
      selectionSub.unsubscribe();
      historySub.unsubscribe();
    };
  }, [host, sync]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    document.addEventListener('keydown', closeOnEscape, true);
    return () => document.removeEventListener('keydown', closeOnEscape, true);
  }, [onClose]);

  const run = (operation: () => void) => {
    try {
      operation();
      setError(null);
      setRevision(value => value + 1);
      queueMicrotask(sync);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const selectedId = selected.length === 1 ? selected[0] : null;
  const selectedEntry = selectedId ? entries.find(entry => entry.id === selectedId) : null;
  const canAlign = selected.length >= 2;
  const canDistribute = selected.length >= 3;

  const align = (action: AlignmentAction) => run(() => alignCanvasSelection(host, action));

  return (
    <aside
      className="selection-inspector layers-inspector"
      data-testid="layers-inspector"
      data-revision={revision}
      aria-label="Layers"
      onPointerDown={event => event.stopPropagation()}
    >
      <header className="selection-inspector__head">
        <div>
          <span className="selection-inspector__eyebrow">Board</span>
          <h2>Layers</h2>
        </div>
        <button
          type="button"
          className="selection-inspector__close"
          aria-label="Close layers"
          title="Close layers"
          onClick={onClose}
        >
          ×
        </button>
      </header>

      <div className="selection-inspector__body">
        <section className="layers-actions">
          <h3>Order</h3>
          <div className="layers-action-grid">
            <button disabled={!selectedId} onClick={() => selectedId && run(() => reorderCanvasLayer(host, selectedId, 'front'))}>To front</button>
            <button disabled={!selectedId} onClick={() => selectedId && run(() => reorderCanvasLayer(host, selectedId, 'forward'))}>Forward</button>
            <button disabled={!selectedId} onClick={() => selectedId && run(() => reorderCanvasLayer(host, selectedId, 'backward'))}>Backward</button>
            <button disabled={!selectedId} onClick={() => selectedId && run(() => reorderCanvasLayer(host, selectedId, 'back'))}>To back</button>
          </div>
        </section>

        <section className="layers-actions">
          <h3>Structure</h3>
          <div className="selection-inspector__button-row">
            <button className="djai-ghost" disabled={!selectedLayerCanGroup(host)} onClick={() => run(() => groupCanvasSelection(host))}>Group</button>
            <button className="djai-ghost" disabled={!selectedLayerCanUngroup(host)} onClick={() => run(() => ungroupCanvasSelection(host))}>Ungroup</button>
            {selectedEntry && (
              <button
                className="djai-ghost"
                onClick={() => run(() => setCanvasLayerLocked(host, selectedEntry.id, !selectedEntry.lockedBySelf))}
              >
                {selectedEntry.lockedBySelf ? 'Unlock' : 'Lock'}
              </button>
            )}
          </div>
        </section>

        <section className="layers-actions">
          <h3>Align</h3>
          <div className="layers-action-grid layers-action-grid--align">
            <button disabled={!canAlign} onClick={() => align('left')}>Left</button>
            <button disabled={!canAlign} onClick={() => align('center-x')}>Center H</button>
            <button disabled={!canAlign} onClick={() => align('right')}>Right</button>
            <button disabled={!canAlign} onClick={() => align('top')}>Top</button>
            <button disabled={!canAlign} onClick={() => align('center-y')}>Center V</button>
            <button disabled={!canAlign} onClick={() => align('bottom')}>Bottom</button>
            <button disabled={!canDistribute} onClick={() => align('distribute-x')}>Space H</button>
            <button disabled={!canDistribute} onClick={() => align('distribute-y')}>Space V</button>
          </div>
        </section>

        {error && <p className="djai-error" role="alert">{error}</p>}

        <section className="layers-list-section">
          <div className="layers-list-heading">
            <h3>Objects</h3>
            <span>{entries.length}</span>
          </div>
          {entries.length === 0 ? (
            <p className="selection-inspector__note">Add something to the canvas to see it here.</p>
          ) : (
            <ol className="layers-list" aria-label="Canvas layers">
              {entries.map(entry => (
                <li
                  key={entry.id}
                  data-layer-id={entry.id}
                  style={{ '--layer-depth': entry.depth } as React.CSSProperties}
                >
                  <button
                    type="button"
                    className="layers-list__select"
                    aria-current={selected.includes(entry.id) ? 'true' : undefined}
                    onClick={() => run(() => selectCanvasLayer(host, entry.id))}
                  >
                    <span className="layers-list__kind" aria-hidden="true">{entry.isGroup ? '▣' : '◇'}</span>
                    <span>{entry.label}</span>
                  </button>
                  <button
                    type="button"
                    className="layers-list__lock"
                    aria-label={`${entry.lockedBySelf ? 'Unlock' : 'Lock'} ${entry.label}`}
                    title={entry.locked ? 'Unlock layer' : 'Lock layer'}
                    onClick={() => run(() => setCanvasLayerLocked(host, entry.id, !entry.lockedBySelf))}
                  >
                    {entry.locked ? '🔒' : '○'}
                  </button>
                </li>
              ))}
            </ol>
          )}
          <p className="selection-inspector__note">
            Alignment guides remain active while dragging. They suggest positions without preventing free placement.
          </p>
        </section>
      </div>
    </aside>
  );
}
