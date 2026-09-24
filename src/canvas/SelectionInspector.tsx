import { Fragment, useEffect, useRef, useState } from 'react';
import type { ImageBlockModel } from '@blocksuite/affine/model';
import type { EditorHost } from '@blocksuite/affine/std';
import { GfxControllerIdentifier } from '@blocksuite/affine/std/gfx';
import { Bound } from '@blocksuite/global/gfx';
import { ImageCropOverlay } from './ImageCropOverlay';
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
  const visualGeneration = useRef(0);
  const visualPending = useRef(false);
  const visualTimer = useRef<ReturnType<typeof setTimeout>>();
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
    setEditingImage(false);
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
    if (!visualPending.current) setVisualDraft(imageVisualSettings(host.std.store, selection.key));
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
      await replaceImageSource(host, selection.key, file);
      setImageRevision(value => value + 1);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setEditingImage(false);
    }
  };

  useEffect(() => () => {
    visualGeneration.current++;
    visualPending.current = false;
    clearTimeout(visualTimer.current);
  }, [host, selection?.key]);

  const applyVisual = async (next = visualDraft, generation = ++visualGeneration.current) => {
    if (!selection || selection.kind !== 'image') return;
    const current = () => generation === visualGeneration.current && host.isConnected;
    visualPending.current = true;
    setEditingImage(true);
    setActionError(null);
    try {
      await applyImageVisualEdit(host.std.store, selection.key, next, current);
      if (current()) setCropOpen(false);
    } catch (cause) {
      if (current()) setActionError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (current()) {
        visualPending.current = false;
        setEditingImage(false);
        setImageRevision(value => value + 1);
      }
    }
  };

  const adjustLive = (field: 'brightness' | 'contrast', value: number) => {
    const next = {...visualDraft, [field]: value};
    setVisualDraft(next);
    visualPending.current = true;
    const generation = ++visualGeneration.current;
    clearTimeout(visualTimer.current);
    visualTimer.current = setTimeout(() => void applyVisual(next, generation), 60);
  };

  const resetVisual = () => {
    if (!selection || selection.kind !== 'image') return;
    visualGeneration.current++; visualPending.current = false; clearTimeout(visualTimer.current); setEditingImage(false);
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

  const restoreOriginalSize = () => {
    if (selection?.kind !== 'image' || editingImage) return;
    try {
      const block = host.view.getBlock(selection.key);
      const image = block?.querySelector<HTMLImageElement>('img.drag-target');
      if (!image?.naturalWidth || !image.naturalHeight) {
        throw new Error('Wait for the image to load, then try again.');
      }
      const model = host.std.store.getBlock(selection.key)?.model as ImageBlockModel | undefined;
      if (!model) return;
      const bound = Bound.deserialize(model.xywh);
      updateImageGeometry(host.std.store, selection.key, {
        x: bound.x + (bound.w - image.naturalWidth) / 2,
        y: bound.y + (bound.h - image.naturalHeight) / 2,
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
      setImageRevision(value => value + 1);
      setActionError(null);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const open = selection?.kind === 'image' && closedForSelection !== selection.key;

  useEffect(() => {
    if (!open) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (event.target instanceof Element && event.target.closest('.object-context-menu, .dali-menu')) return;
      if (cropOpen) { event.preventDefault(); event.stopPropagation(); visualGeneration.current++; visualPending.current=false; setEditingImage(false); setCropOpen(false); return; }
      // While the inspector is open, Escape belongs to the inspector. Capture
      // it before the editor so closing this panel does not also clear the
      // selection or change the active tool underneath it.
      event.preventDefault();
      event.stopPropagation();
      setClosedForSelection(selection?.key ?? null);
    };

    document.addEventListener('keydown', closeOnEscape, true);
    return () => document.removeEventListener('keydown', closeOnEscape, true);
  }, [open, selection?.key, cropOpen]);

  if (!selection || selection.kind !== 'image') return null;

  const imageActions = !cropOpen && selection.kind === 'image' && quickPosition && (
    <div
      className="image-quick-actions"
      data-testid="image-quick-actions"
      style={quickPosition}
      onPointerDown={event => event.stopPropagation()}
    >
      <button type="button" onClick={() => { setClosedForSelection(null); setCropOpen(true); }} disabled={editingImage}>
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
      {cropOpen && selection.kind === 'image' && <ImageCropOverlay key={selection.key} host={host} imageId={selection.key} busy={editingImage}
        onApply={next=>void applyVisual(next)} onCancel={()=>{visualGeneration.current++;visualPending.current=false;setEditingImage(false);setCropOpen(false);}} />}
      {imageActions}
        {selection.kind === 'image' && (
          <input
            ref={replaceRef}
            type="file"
            accept="image/png,image/jpeg"
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
      {cropOpen && selection.kind === 'image' && <ImageCropOverlay key={selection.key} host={host} imageId={selection.key} busy={editingImage}
        onApply={next=>void applyVisual(next)} onCancel={()=>{visualGeneration.current++;visualPending.current=false;setEditingImage(false);setCropOpen(false);}} />}
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
        accept="image/png,image/jpeg"
        onChange={event => void replaceImage(event)}
        hidden
        style={{ display: 'none' }}
      />
      <header className="selection-inspector__head">
        <div>
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
                <button type="button" className="djai-ghost" disabled={editingImage} onClick={() => { setClosedForSelection(null); setCropOpen(true); }}>
                  Crop
                </button>
                <button type="button" className="djai-ghost" disabled={editingImage} onClick={() => replaceRef.current?.click()}>
                  Replace
                </button>
              </div>
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
              <button type="button" className="djai-ghost" disabled={editingImage}
                onClick={restoreOriginalSize}>Restore original size</button>
              <p className="djai-muted">Use original pixel dimensions at 100% canvas zoom.</p>
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
                    disabled={cropOpen}
                    onChange={event => adjustLive(field, Number(event.target.value))}
                  />
                  <output>{visualDraft[field]}</output>
                </label>
              ))}
              <div className="selection-inspector__button-row">
                <button type="button" className="djai-ghost" disabled={!visualState && !visualPending.current} onClick={resetVisual}>Reset edits</button>
                {editingImage && <span role="status">Saving changes…</span>}
              </div>
            </section>

            {actionError && <p className="djai-error" role="alert">{actionError}</p>}
            </Fragment>
          ) : null}

        </div>
      </aside>
    </Fragment>
  );
}
