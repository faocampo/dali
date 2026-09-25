import { CanvasMeasurements } from './CanvasMeasurements';
import { ConnectorQuickAdd } from './ConnectorQuickAdd';
import { Tooltips } from './Tooltips';
import { installCanvasAffordances } from './canvas-affordances';
import { ViewportControls } from './ViewportControls';
import { ObjectContextMenu } from './ObjectContextMenu';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { GfxControllerIdentifier } from '@blocksuite/affine/std/gfx';
import { importLocalImages, installImageInputs, type ImageImportRequest } from './image-input';
import type { EditorHost } from '@blocksuite/affine/std';
import { mountEdgelessEditor, type EdgelessEditorHandle } from './blocksuite-editor';
import { getActiveAccessScope, subscribeAccessScope, type CanvasRuntime } from './runtime';
import { captureArchive, LocalBoardCopy, LocalCopyOutcomeUnknown } from '../boards/import-local';
import { accessScopeCurrent } from './account/mutation-guard';
import { insertSticky } from './sticky';
import { TextBoxTool } from './text';
import { insertMindmap } from './mindmap';
import { installMindmapCompatibility } from './mindmap-compatibility';
import { installMindmapShortcuts } from './mindmap-keyboard';
import { MindMapInspector } from './MindMapInspector';
import { widenResizeHandles } from './resize-affordance';
import { EdgelessToolbarDragHandle } from './EdgelessToolbarDragHandle';
import { SelectionInspector } from './SelectionInspector';
import { LayersInspector } from './LayersInspector';
import { FrameBorderOverlay } from './FrameBorderOverlay';
import { installArrangementShortcuts } from './arrangement';
import type { ResourceController } from '@blocksuite/affine/components/resource';
import { renderBoardPresentation } from './presentation-export';

export default function BlockSuiteCanvas({ runtime }: { runtime: CanvasRuntime }) {
  const ref = useRef<HTMLDivElement>(null);
  const scope = useSyncExternalStore(subscribeAccessScope, getActiveAccessScope);
  const writable = scope?.canWrite && scope.phase === 'active';
  const [error, setError] = useState<Error | null>(null);
  // The mounted host is what the image picker needs; it only exists after a
  // successful mount, so the control is rendered from it rather than always.
  const [host, setHost] = useState<EditorHost | null>(null);
  const [layersOpen, setLayersOpen] = useState(false);
  // Bumping this re-runs the effect, which asks for a fresh runtime. The failed
  // runtime promise is not cached, so a retry genuinely re-attempts startup.
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  // Wider grab zones on the resize handles, for as long as the canvas is up.
  useEffect(() => widenResizeHandles(), []);
  useEffect(() => {
    if (!host) return;
    const command = (event: Event) => {
      if (!accessScopeCurrent(runtime.scope)) return;
      const gfx = host.std.get(GfxControllerIdentifier); if (gfx.viewport.locked) return;
      const action = (event as CustomEvent<string>).detail;
      if (action === 'fit') gfx.fitToScreen();
      if (action === 'reset-zoom') gfx.viewport.smoothZoom(1);
    };
    window.addEventListener('dali:board-command', command);
    return () => window.removeEventListener('dali:board-command', command);
  }, [host, runtime]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let handle: EdgelessEditorHandle | null = null;
    let disposeMindmaps: (() => void) | undefined;
    let cancelled = false;
    const controller = new AbortController();

    mountEdgelessEditor(el, runtime, controller.signal)
      .then((h) => {
        // StrictMode double-invokes effects. The workspace and document are
        // created once in the shared runtime, so a cancelled mount only has a
        // view to throw away -- it can never leave a duplicate board behind.
        if (cancelled) {
          h.destroy();
          return;
        }
        handle = h;
        disposeMindmaps = installMindmapCompatibility(h.host);
        setHost(h.host);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        // Without this the failure is an unhandled rejection and the user gets
        // a blank screen with no explanation.
        setError(cause instanceof Error ? cause : new Error(String(cause)));
      });

    return () => {
      cancelled = true;
      controller.abort();
      disposeMindmaps?.();
      handle?.destroy();
      // The host is about to be torn down; leaving it in state would let the
      // picker act on a detached editor.
      setHost(null);
    };
  }, [attempt, runtime]);

  if (error) return <StartupFailure error={error} onRetry={retry} />;

  return (
    <div ref={ref} style={{ position: 'absolute', inset: 0 }}>
      {!host && <p role="status" className="mindmap-opening">Opening board…</p>}
      {host && (writable ? <BoardControls host={host} onOpenLayers={() => setLayersOpen(true)} /> : <ViewportControls host={host} />)}
      {host && <AccountImagesAndPreview host={host} runtime={runtime} />}
      {host && <Tooltips />}
      {host && writable && <ConnectorQuickAdd host={host} />}
      {host && <FrameBorderOverlay host={host} />}
      {host && <CanvasMeasurements host={host} />}
      {host && writable && <MindMapInspector host={host} />}
      {host && writable && <ObjectContextMenu host={host} />}
      {host && writable && (layersOpen
        ? <LayersInspector host={host} onClose={() => setLayersOpen(false)} />
        : <SelectionInspector host={host} />)}
    </div>
  );
}

/** Native image state remains scoped to this mounted, authorized editor. */
function AccountImagesAndPreview({ host, runtime }: { host: EditorHost; runtime: CanvasRuntime }) {
  const [images, setImages] = useState<{ loading: number; missing: ResourceController[] }>({ loading: 0, missing: [] });
  const active = () => host.isConnected && getActiveAccessScope()?.generation === runtime.scope.generation && getActiveAccessScope()?.phase === 'active';
  useEffect(() => {
    const scan = () => {
      if (!active()) return;
      const controllers = runtime.store.getBlocksByFlavour('affine:image').flatMap(({ model }) => {
        const block = host.std.view.getBlock(model.id) as unknown as { resourceController?: ResourceController } | null;
        return block?.resourceController ? [block.resourceController] : [];
      });
      const missing = controllers.filter(controller => controller.resolvedState$.value.error);
      const loading = controllers.filter(controller => {
        const state = controller.resolvedState$.value;
        return state.loading || (!state.url && !state.error);
      }).length;
      setImages(previous => previous.loading === loading && previous.missing.length === missing.length && previous.missing.every((value, index) => value === missing[index]) ? previous : { loading, missing });
    };
    const timer = window.setInterval(scan, 150); scan();
    return () => clearInterval(timer);
  }, [host, runtime]);
  useEffect(() => {
    if (!runtime.scope.canWrite) return;
    const controller = new AbortController(); let timer = 0; let revision = 0;
    const publish = async (version: number) => {
      try {
        await runtime.workspace.waitForSynced();
        if (!active() || controller.signal.aborted || version !== revision || !getActiveAccessScope()?.canWrite) return;
        const { canvas } = await renderBoardPresentation({ scope: 'board', scale: 1 });
        const preview = document.createElement('canvas');
        const scale = Math.min(1, 480 / canvas.width, 320 / canvas.height);
        preview.width = Math.max(1, Math.round(canvas.width * scale)); preview.height = Math.max(1, Math.round(canvas.height * scale));
        preview.getContext('2d')!.drawImage(canvas, 0, 0, preview.width, preview.height);
        const blob = await new Promise<Blob | null>(resolve => preview.toBlob(resolve, 'image/png'));
        if (!blob || blob.size > 512 * 1024 || !active() || controller.signal.aborted || version !== revision || !getActiveAccessScope()?.canWrite) return;
        await fetch(`/api/boards/${encodeURIComponent(runtime.scope.boardId)}/thumbnail`, { method: 'PUT', cache: 'no-store', signal: controller.signal,
          headers: { 'X-Dali-Account': runtime.scope.accountId, 'X-Dali-Request': '1', 'X-Dali-Recovery-Epoch': runtime.descriptor.recoveryEpoch, 'Content-Type': 'image/png' }, body: blob });
      } catch { /* Preview failure does not alter document acknowledgement. */ }
    };
    const changed = () => { const version = ++revision; clearTimeout(timer); timer = window.setTimeout(() => { void publish(version); }, 800); };
    runtime.store.spaceDoc.on('update', changed);
    return () => { clearTimeout(timer); controller.abort(); runtime.store.spaceDoc.off('update', changed); };
  }, [host, runtime]);
  return <div style={{ position: 'absolute', top: 16, left: 88, zIndex: 10, background: 'var(--board-surface)' }}>
    {images.loading > 0 && <p role="status">Loading images…</p>}
    {images.missing.length > 0 && <div role="alert"><p>{images.missing.length} image(s) unavailable.</p><button onClick={() => {
      if (active()) images.missing.forEach(controller => { if (active()) void controller.refreshUrlWith(); });
    }}>Retry images</button></div>}
  </div>;
}

/** Accessible left rail backed by native drawing tools and board actions. */
function BoardControls({ host, onOpenLayers }: { host: EditorHost; onOpenLayers: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const archiveDialog = useRef<HTMLDialogElement>(null);
  const [archive, setArchive] = useState<File>();
  const [importBusy, setImportBusy] = useState(false);
  const [importUnknown, setImportUnknown] = useState(false);
  const [importedId, setImportedId] = useState<string>();
  const archiveCopy = useRef<LocalBoardCopy>();
  useEffect(() => { if (archive) archiveDialog.current?.showModal(); }, [archive]);
  const store = host.std.store;
  const gfx = host.std.get(GfxControllerIdentifier);
  const [activeTool, setActiveTool] = useState(gfx.tool.currentToolName$.peek());
  useEffect(() => gfx.tool.currentToolName$.subscribe(setActiveTool), [gfx]);
  useEffect(() => {
    const command = (event: Event) => {
      const action = (event as CustomEvent<string>).detail;
      if (action === 'history-state') window.dispatchEvent(new CustomEvent('dali:history-state', { detail: { undo: store.history.canUndo && !store.readonly, redo: store.history.canRedo && !store.readonly } }));
      if (action === 'import') importRef.current?.click();
      if (action === 'undo' && !store.readonly) store.undo();
      if (action === 'redo' && !store.readonly) store.redo();
      if (action === 'layers') onOpenLayers();
    };
    window.addEventListener('dali:board-command', command);
    return () => window.removeEventListener('dali:board-command', command);
  }, [host, onOpenLayers]);


  const [actionError, setActionError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const alive = useRef(true);
  const imageQueue = useRef(Promise.resolve());
  const imageAbort = useRef(new AbortController());
  useEffect(() => {
    alive.current=true; imageAbort.current=new AbortController();
    return () => { alive.current=false; imageAbort.current.abort(); };
  }, [host]);
  const importImages=useCallback((files:File[],source:ImageImportRequest['source'],target:[number,number])=>{
    const boardId=host.std.store.id;
    const signal=imageAbort.current.signal;
    imageQueue.current=imageQueue.current.then(async()=>{
      const result=await importLocalImages(host,{files,source,boardId,target,signal,isCurrent:()=>alive.current && !signal.aborted});
      if(alive.current) setImageError(result.errors.length ? result.errors.map(error=>error.message).join(' ') : null);
    }).catch(()=>{ if(alive.current) setImageError('The image could not be imported. Choose a PNG or JPEG and try again.'); });
  },[host]);
  useEffect(()=>installImageInputs(host,importImages),[host,importImages]);
  useEffect(() => installCanvasAffordances(host), [host]);
  useEffect(() => installArrangementShortcuts(host, cause => {
    setActionError(cause instanceof Error ? cause.message : 'The canvas action failed.');
  }), [host]);
  useEffect(() => installMindmapShortcuts(host, () => {
    setActionError('This change could not be applied. Your previous topic is still available. Try again.');
  }), [host]);

  const onFiles = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = [...(event.target.files ?? [])];
      // Clear first: picking the SAME file twice fires no change event
      // otherwise, so the second insert would silently do nothing.
      event.target.value = '';
      if (files.length === 0) return;
      const {x,y}=host.std.get(GfxControllerIdentifier).viewport.center;
      importImages(files,'picker',[x,y]);
    },
    [host,importImages]
  );


  const onImportFile = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      const scope = getActiveAccessScope(); if (!scope || !accessScopeCurrent(scope, true)) return;
      setActionError(null); setImportedId(undefined); setImportUnknown(false); setArchive(file);
      archiveCopy.current = new LocalBoardCopy(scope.accountId, { id: crypto.randomUUID(), title: file.name.replace(/(?:\.bs)?\.zip$/i, '') || 'Imported board', updatedAt: Date.now() }, crypto.randomUUID(),
        () => captureArchive(file, store.schema), () => { if (!accessScopeCurrent(scope, true)) throw new Error('Board access changed. Reopen the board before importing.'); }, async () => {
          const response = await fetch('/api/boards/' + encodeURIComponent(scope.boardId), { cache: 'no-store', signal: AbortSignal.timeout(10000), headers: { 'X-Dali-Account': scope.accountId } });
          if (!response.ok) throw new Error('Board access changed. Reopen the board before importing.');
          const descriptor = await response.json();
          if (descriptor.summary?.accountId !== scope.accountId || descriptor.summary?.id !== scope.boardId || !['owner', 'editor'].includes(descriptor.summary?.role)) throw new Error('Board access changed. Reopen the board before importing.');
        });
    },
    [store]
  );

  const closeImport = () => {
    if (importBusy || importUnknown) return;
    archiveDialog.current?.close();
    setArchive(undefined); setActionError(null);
    document.querySelector<HTMLButtonElement>('.dali-menu-trigger')?.focus();
  };

  return (
    <>
    {archive && <dialog ref={archiveDialog} className="board-action-dialog" aria-label="Import board" onCancel={event => { event.preventDefault(); closeImport(); }}>
      <h2>Import board</h2><p>{archive.name}</p><p>Create a private copy in your account. Your open board stays available.</p>
      {actionError && <p role="alert">{actionError}</p>}
      {importBusy && <p role="status">Importing board…</p>}
      {importedId ? <a href={'/?board=' + encodeURIComponent(importedId)}>Open imported board</a> : <button disabled={importBusy} onClick={async () => {
        setImportBusy(true); setActionError(null);
        try { const result = await archiveCopy.current!.run(); if (alive.current) { setImportedId(result.summary.id); setImportUnknown(false); } }
        catch (cause) { if (alive.current) { setImportUnknown(cause instanceof LocalCopyOutcomeUnknown); setActionError(cause instanceof Error ? cause.message : 'The archive could not be imported. Try again.'); } }
        finally { if (alive.current) setImportBusy(false); }
      }}>{importUnknown ? 'Check import again' : 'Import private copy'}</button>}
      <button disabled={importBusy || importUnknown} onClick={closeImport}>Close import</button>
    </dialog>}
    {(imageError || actionError) && <div className="canvas-feedback" role="alert" data-testid={imageError ? 'image-import-error' : undefined}>
      <p>{imageError || actionError}</p>
      <div>{imageError && <button type="button" onClick={() => inputRef.current?.click()}>Choose another image</button>}
      <button type="button" aria-label="Dismiss error" onClick={() => { setImageError(null); setActionError(null); }}>Dismiss</button></div>
    </div>}
    <div
      data-testid="board-action-menu"
      role="toolbar"
      aria-label="Drawing and board tools"
      className="board-action-panel"
      style={{
        position: 'absolute',
        left: '1rem',
        top: '16px',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
        padding: '8px',
        maxHeight: 'calc(100% - 88px)',
        boxSizing: 'border-box',
        overflowY: 'auto',
        borderRadius: 'var(--board-radius)',
        border: '0',
        background: 'var(--board-surface)',
        boxShadow: 'var(--board-shadow)',
      }}
    >
      <EdgelessToolbarDragHandle host={host} />
      <ControlButton label="Insert image" onClick={() => inputRef.current?.click()}>
        <rect x="3" y="4" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="8.75" cy="9.5" r="1.6" fill="currentColor" />
        <path
          d="M4 17.5 9.5 12l4 4 3-2.5 3.5 4"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </ControlButton>

      <ControlButton label="Add sticky note" onClick={() => {
        insertSticky(host.std);
      }}>
        <path
          d="M4.5 4.5h15v9.5l-5.5 5.5H4.5z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path d="M19.5 14H14v5.5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </ControlButton>

      <ControlButton
        label="Add text"
        title="Text (T) — drag to draw a text box"
        pressed={activeTool === 'text'}
        onClick={() => {
          if (!store.readonly) gfx.tool.setTool(TextBoxTool);
        }}
      >
        <path
          d="M5 7V5.5h14V7M12 5.5v13M9 18.5h6"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </ControlButton>

      <ControlButton label="Add mind map" disabled={store.readonly || !host.isConnected} onClick={() => {
        try { insertMindmap(host); setActionError(null); }
        catch (cause) { setActionError((cause as Error).message); }
      }}>
        <path d="M3 9h6v6H3zM16 3h5v5h-5zM16 16h5v5h-5zM9 12h4V5.5h3M13 12v6.5h3" stroke="currentColor" strokeWidth="1.6" />
      </ControlButton>

      <ControlButton label="Layers" onClick={onOpenLayers}>
        <path d="m12 4 8 4-8 4-8-4 8-4Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="m4 12 8 4 8-4M4 16l8 4 8-4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </ControlButton>

    </div>
    <ViewportControls host={host} />
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={onFiles}
        style={{ display: 'none' }}
      />
      <input
        ref={importRef}
        type="file"
        accept=".zip,application/zip"
        onChange={onImportFile}
        style={{ display: 'none' }}
      />
    </>
  );
}

function ControlButton({
  label,
  title = label,
  pressed,
  onClick,
  disabled = false,
  children,
}: {
  label: string;
  title?: string;
  pressed?: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className="board-control"
      style={{
        display: 'grid',
        placeContent: 'center',
        width: '40px',
        height: '40px',
        flexShrink: 0,
        borderRadius: '8px',
        border: 'none',
        background: pressed ? 'var(--dali-accent-soft)' : 'transparent',
        color: disabled ? 'var(--board-ink-disabled)' : pressed ? 'var(--dali-accent)' : 'var(--board-ink)',
        cursor: disabled ? 'default' : 'pointer',
        transition: 'background 120ms ease',
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        {children}
      </svg>
    </button>
  );
}

function StartupFailure({ error, onRetry }: { error: Error; onRetry: () => void }) {
  // Deliberately does NOT touch `indexedDB` to decide this. In a locked-down
  // context merely reading that global throws, which would crash the very
  // component whose job is to explain that failure -- leaving a blank page.
  const storageUnavailable = /indexeddb|storage|quota|database|disabled/i.test(error.message);

  return (
    <div
      role="alert"
      style={{
        position: 'absolute',
        inset: 0,
        display: 'grid',
        placeContent: 'center',
        justifyItems: 'center',
        gap: '0.75rem',
        padding: '2rem',
        textAlign: 'center',
        font: 'var(--affine-font-base)/var(--affine-line-height) var(--affine-font-family)',
        color: 'var(--affine-text-primary-color)',
        background: 'var(--affine-background-primary-color)',
      }}
    >
      <h1 style={{ fontSize: '1.15rem', margin: 0 }}>The canvas could not start</h1>
      <p style={{ margin: 0, maxWidth: '38ch', color: 'var(--affine-text-secondary-color)' }}>
        {storageUnavailable
          ? 'This app stores your boards in your browser. Local storage is unavailable — private browsing or blocked site data will do that.'
          : 'Your saved board could not be opened. It has not been deleted.'}
      </p>
      <pre
        style={{
          margin: 0,
          maxWidth: '48ch',
          overflowX: 'auto',
          font: '12px/1.5 ui-monospace, monospace',
          color: 'var(--affine-text-secondary-color)',
          whiteSpace: 'pre-wrap',
        }}
      >
        {error.message}
      </pre>
      <button
        type="button"
        onClick={onRetry}
        style={{
          font: 'inherit',
          padding: '0.45rem 1.1rem',
          borderRadius: '8px',
          border: '1px solid var(--board-line)',
          background: 'var(--board-surface)',
          cursor: 'pointer',
        }}
      >
        Try again
      </button>
    </div>
  );
}
