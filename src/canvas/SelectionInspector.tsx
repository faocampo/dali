import { Fragment, useEffect, useRef, useState } from 'react';
import type { ImageBlockModel } from '@blocksuite/affine/model';
import type { EditorHost } from '@blocksuite/affine/std';
import { GfxControllerIdentifier, type GfxModel } from '@blocksuite/affine/std/gfx';
import { Bound } from '@blocksuite/global/gfx';
import {
  alignCanvasSelection, canvasSelectionEditable, duplicateCanvasSelection,
  groupCanvasSelection, ungroupCanvasSelection, selectedLayerCanGroup,
  selectedLayerCanUngroup, reorderCanvasLayer, setCanvasLayerLocked,
  type AlignmentAction,
} from './arrangement';
import {
  summarizeCanvasSelection,
  type CanvasSelectionSummary,
} from './selection-summary';
import {
  applyImageVisualEdit,
  getImageVisualEdit,
  imageVisualSettings,
  replaceImageSource,
  resetImageVisualEdit,
  updateImageGeometry,
} from './image-visual-edits';

/** Contextual arrangement and image controls alongside native style controls. */
export function SelectionInspector({ host }: { host: EditorHost }) {
  const [selection, setSelection] = useState<CanvasSelectionSummary | null>(null);
  const [closedForSelection, setClosedForSelection] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [imageRevision, setImageRevision] = useState(0);
  const [editingImage, setEditingImage] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [lockRatio, setLockRatio] = useState(true);
  const [geometry, setGeometry] = useState({ x: '0', y: '0', width: '0', height: '0' });
  const [ratio, setRatio] = useState(1);
  const [visualDraft, setVisualDraft] = useState({
    brightness: 0,
    contrast: 0,
    cropLeft: 0,
    cropTop: 0,
    cropRight: 0,
    cropBottom: 0,
  });
  const [quickPosition, setQuickPosition] = useState<{ left: number; top: number } | null>(null);
  const replaceRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const gfx = host.std.get(GfxControllerIdentifier);
    const sync = () => {
      const next = summarizeCanvasSelection(gfx.selection.selectedElements);
      setSelection(next);
      // Deselecting resets a manual dismissal. Selecting the object again is a
      // fresh interaction and should open its inspector again.
      if (!next) setClosedForSelection(null);
    };

    sync();
    const subscription = gfx.selection.slots.updated.subscribe(sync);
    return () => subscription.unsubscribe();
  }, [host]);

  useEffect(() => {
    const subscription = host.std.store.history.onUpdated.subscribe(() => {
      setImageRevision(value => value + 1);
    });
    return () => subscription.unsubscribe();
  }, [host]);

  useEffect(() => {
    setActionError(null);
    setCropOpen(false);
  }, [selection?.key]);

  useEffect(() => {
    if (selection?.kind !== 'image') return;
    const model = host.std.store.getBlock(selection.key)?.model;
    if (!model || model.flavour !== 'affine:image') return;
    const bound = Bound.deserialize((model as ImageBlockModel).xywh);
    setGeometry({
      x: String(bound.x),
      y: String(bound.y),
      width: String(bound.w),
      height: String(bound.h),
    });
    setRatio(bound.h > 0 ? bound.w / bound.h : 1);
    setVisualDraft(imageVisualSettings(host.std.store, selection.key));
  }, [host, selection?.key, selection?.kind, imageRevision]);

  useEffect(() => {
    if (selection?.kind !== 'image') {
      setQuickPosition(null);
      return;
    }
    const gfx = host.std.get(GfxControllerIdentifier);
    const sync = () => {
      const model = gfx.selection.selectedElements.find(element => element.id === selection.key);
      if (!model) return setQuickPosition(null);
      const [x, y, width, height] = gfx.viewport.toViewBound(model.elementBound).toXYWH();
      setQuickPosition({
        left: Math.max(8, Math.min(x + width / 2 - 60, gfx.viewport.width - 210)),
        top: Math.max(8, Math.min(y + height + 10, gfx.viewport.height - 52)),
      });
    };
    sync();
    const viewportSubscription = gfx.viewport.viewportUpdated.subscribe(sync);
    const selectionSubscription = gfx.selection.slots.updated.subscribe(sync);
    return () => {
      viewportSubscription.unsubscribe();
      selectionSubscription.unsubscribe();
    };
  }, [host, selection?.key, selection?.kind]);

  const visualState =
    selection?.kind === 'image'
      ? getImageVisualEdit(host.std.store, selection.key)
      : null;
  const replaceImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !selection || selection.kind !== 'image') return;
    setEditingImage(true);
    setActionError(null);
    try {
      await replaceImageSource(host.std.store, selection.key, file);
      setImageRevision(value => value + 1);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setEditingImage(false);
    }
  };

  const applyVisual = async () => {
    if (!selection || selection.kind !== 'image' || editingImage) return;
    setEditingImage(true);
    setActionError(null);
    try {
      await applyImageVisualEdit(host.std.store, selection.key, visualDraft);
      setImageRevision(value => value + 1);
      setCropOpen(false);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setEditingImage(false);
    }
  };

  const resetVisual = () => {
    if (!selection || selection.kind !== 'image' || editingImage) return;
    resetImageVisualEdit(host.std.store, selection.key);
    setImageRevision(value => value + 1);
    setActionError(null);
    setCropOpen(false);
  };

  const changeGeometry = (field: keyof typeof geometry, value: string) => {
    setGeometry(current => {
      const next = { ...current, [field]: value };
      if (lockRatio && ratio > 0) {
        const numeric = Number(value);
        if (Number.isFinite(numeric) && numeric > 0) {
          if (field === 'width') next.height = String(Math.round(numeric / ratio));
          if (field === 'height') next.width = String(Math.round(numeric * ratio));
        }
      }
      return next;
    });
  };

  const applyGeometry = () => {
    if (!selection || selection.kind !== 'image') return;
    try {
      updateImageGeometry(host.std.store, selection.key, {
        x: Number(geometry.x),
        y: Number(geometry.y),
        width: Number(geometry.width),
        height: Number(geometry.height),
      });
      setRatio(Number(geometry.width) / Number(geometry.height));
      setImageRevision(value => value + 1);
      setActionError(null);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const open = !!selection && closedForSelection !== selection.key;

  useEffect(() => {
    if (!open) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // While the inspector is open, Escape belongs to the inspector. Capture
      // it before the editor so closing this panel does not also clear the
      // selection or change the active tool underneath it.
      event.preventDefault();
      event.stopPropagation();
      setClosedForSelection(selection?.key ?? null);
    };

    document.addEventListener('keydown', closeOnEscape, true);
    return () => document.removeEventListener('keydown', closeOnEscape, true);
  }, [open, selection?.key]);

  if (!selection) return null;

  const imageActions = selection.kind === 'image' && quickPosition && (
    <div
      className="image-quick-actions"
      data-testid="image-quick-actions"
      style={quickPosition}
      onPointerDown={event => event.stopPropagation()}
    >
      <button type="button" onClick={() => setCropOpen(value => !value)} disabled={editingImage}>
        Crop
      </button>
      <button type="button" onClick={() => replaceRef.current?.click()} disabled={editingImage}>
        Replace
      </button>
    </div>
  );

  if (!open) {
    return (
      <Fragment>
        {imageActions}
        {selection.kind === 'image' && (
          <input
            ref={replaceRef}
            type="file"
            accept="image/*"
            onChange={event => void replaceImage(event)}
            hidden
            style={{ display: 'none' }}
          />
        )}
        <button
          type="button"
          className="selection-inspector-tab"
          aria-label="Open properties"
          title="Open properties"
          onClick={() => setClosedForSelection(null)}
        >
          <span aria-hidden="true">‹</span>
          <span>Properties</span>
        </button>
      </Fragment>
    );
  }

  return (
    <Fragment>
      {imageActions}
      <aside
        className="selection-inspector"
        data-testid="selection-inspector"
        data-image-revision={imageRevision}
        aria-label={`${selection.title} properties`}
        onPointerDown={(event) => event.stopPropagation()}
      >
      <input
        ref={replaceRef}
        type="file"
        accept="image/*"
        onChange={event => void replaceImage(event)}
        hidden
        style={{ display: 'none' }}
      />
      <header className="selection-inspector__head">
        <div>
          <span className="selection-inspector__eyebrow">Properties</span>
          <h2>{selection.title}</h2>
        </div>
        <button
          type="button"
          className="selection-inspector__close"
          aria-label="Close properties"
          title="Close properties"
          onClick={() => setClosedForSelection(selection.key)}
        >
          ×
        </button>
      </header>

        <div className="selection-inspector__body">
        <section>
          <h3>Selection</h3>
          <p>
            {selection.count === 1
              ? `${selection.title} selected`
              : `${selection.count} objects selected`}
          </p>
        </section>
          {selection.kind === 'image' ? (
            <Fragment>
            <section className="image-edit-actions">
              <h3>Image</h3>
              <div className="selection-inspector__button-row">
                <button type="button" className="djai-ghost" disabled={editingImage} onClick={() => setCropOpen(value => !value)}>
                  Crop
                </button>
                <button type="button" className="djai-ghost" disabled={editingImage} onClick={() => replaceRef.current?.click()}>
                  Replace
                </button>
              </div>
              {cropOpen && (
                <div className="image-crop-grid" data-testid="image-crop-controls">
                  {(['cropLeft', 'cropTop', 'cropRight', 'cropBottom'] as const).map(field => (
                    <label key={field}>
                      <span>{field.replace('crop', '')}</span>
                      <input
                        type="number"
                        min="0"
                        max="45"
                        value={visualDraft[field]}
                        onChange={event => setVisualDraft(current => ({
                          ...current,
                          [field]: Number(event.target.value),
                        }))}
                      />
                      <span>%</span>
                    </label>
                  ))}
                  <button type="button" className="djai-primary" onClick={() => void applyVisual()} disabled={editingImage}>
                    {editingImage ? 'Applying…' : 'Apply crop'}
                  </button>
                </div>
              )}
            </section>

            <section className="image-transform-control">
              <h3>Position &amp; size</h3>
              <div className="image-geometry-grid">
                {(['x', 'y', 'width', 'height'] as const).map(field => (
                  <label key={field}>
                    <span>{field === 'width' ? 'W' : field === 'height' ? 'H' : field.toUpperCase()}</span>
                    <input
                      type="number"
                      value={geometry[field]}
                      onChange={event => changeGeometry(field, event.target.value)}
                    />
                  </label>
                ))}
              </div>
              <label className="image-lock-ratio">
                <input type="checkbox" checked={lockRatio} onChange={event => setLockRatio(event.target.checked)} />
                Lock aspect ratio
              </label>
                <button type="button" className="djai-ghost" disabled={editingImage} onClick={applyGeometry}>Apply position &amp; size</button>
            </section>

            <section className="image-adjustment-control">
              <h3>Adjust</h3>
              {(['brightness', 'contrast'] as const).map(field => (
                <label className="image-slider" key={field}>
                  <span>{field[0]!.toUpperCase() + field.slice(1)}</span>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    value={visualDraft[field]}
                    onChange={event => setVisualDraft(current => ({
                      ...current,
                      [field]: Number(event.target.value),
                    }))}
                  />
                  <output>{visualDraft[field]}</output>
                </label>
              ))}
              <div className="selection-inspector__button-row">
                <button type="button" className="djai-primary" onClick={() => void applyVisual()} disabled={editingImage}>
                  {editingImage ? 'Applying…' : 'Apply adjustments'}
                </button>
                {visualState && (
                  <button type="button" className="djai-ghost" disabled={editingImage} onClick={resetVisual}>Reset edits</button>
                )}
              </div>
            </section>

            {actionError && <p className="djai-error" role="alert">{actionError}</p>}
            </Fragment>
          ) : null}
          <section>
            <h3>Arrange</h3>
            <div className="layers-action-grid">
              <button disabled={!canvasSelectionEditable(host)} title="Duplicate (⌘/Ctrl+D)"
                onClick={() => void duplicateCanvasSelection(host).catch(cause => setActionError(String(cause)))}>Duplicate</button>
              <button disabled={!selectedLayerCanGroup(host)} title="Group (⌘/Ctrl+G)"
                onClick={() => groupCanvasSelection(host)}>Group</button>
              <button disabled={!selectedLayerCanUngroup(host)} title="Ungroup (⌘/Ctrl+Shift+G)"
                onClick={() => ungroupCanvasSelection(host)}>Ungroup</button>
              {(['left', 'center-x', 'right', 'top', 'center-y', 'bottom', 'distribute-x', 'distribute-y'] as AlignmentAction[]).map(action =>
                <button key={action} disabled={!canvasSelectionEditable(host) || selection.count < (action.startsWith('distribute') ? 3 : 2)}
                  onClick={() => alignCanvasSelection(host, action)}>{`Align ${action}`}</button>)}
              {(['front', 'back'] as const).map(direction => <button key={direction}
                disabled={selection.count !== 1 || !canvasSelectionEditable(host)}
                onClick={() => reorderCanvasLayer(host, selection.key, direction)}>{`To ${direction}`}</button>)}
              {selection.count === 1 && <button onClick={() => {
                const model = host.std.get(GfxControllerIdentifier).getElementById<GfxModel>(selection.key);
                if (model) setCanvasLayerLocked(host, model.id, !model.isLockedBySelf());
                setImageRevision(value => value + 1);
              }}>{host.std.get(GfxControllerIdentifier).getElementById<GfxModel>(selection.key)?.isLockedBySelf() ? 'Unlock object' : 'Lock object'}</button>}
            </div>
          </section>
        </div>
      </aside>
    </Fragment>
  );
}
