import { useCallback, useEffect, useRef, useState } from 'react';
import { GfxControllerIdentifier } from '@blocksuite/affine/std/gfx';
import { importLocalImages, installImageInputs, type ImageImportRequest } from './image-input';
import { ZipTransformer } from '@blocksuite/affine/widgets/linked-doc';
import type { EditorHost } from '@blocksuite/affine/std';
import type { Store } from '@blocksuite/affine/store';
import { mountEdgelessEditor, type EdgelessEditorHandle } from './blocksuite-editor';
import { getCanvasRuntime } from './runtime';
import { insertSticky } from './sticky';
import { insertText } from './text';
import { widenResizeHandles } from './resize-affordance';
import { EdgelessToolbarDragHandle } from './EdgelessToolbarDragHandle';
import { SelectionInspector } from './SelectionInspector';
import { LayersInspector } from './LayersInspector';
import { deferBoardRemoval, requestBoardOpen, setActiveBoardId } from '../boards/preferences';
import { FrameBorderOverlay } from './FrameBorderOverlay';
import { installArrangementShortcuts } from './arrangement';

export default function BlockSuiteCanvas() {
  const ref = useRef<HTMLDivElement>(null);
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
    const el = ref.current;
    if (!el) return;

    let handle: EdgelessEditorHandle | null = null;
    let cancelled = false;

    mountEdgelessEditor(el)
      .then((h) => {
        // StrictMode double-invokes effects. The workspace and document are
        // created once in the shared runtime, so a cancelled mount only has a
        // view to throw away -- it can never leave a duplicate board behind.
        if (cancelled) {
          h.destroy();
          return;
        }
        handle = h;
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
      handle?.destroy();
      // The host is about to be torn down; leaving it in state would let the
      // picker act on a detached editor.
      setHost(null);
    };
  }, [attempt]);

  if (error) return <StartupFailure error={error} onRetry={retry} />;

  return (
    <div ref={ref} style={{ position: 'absolute', inset: 0 }}>
      {host && <BoardControls host={host} onOpenLayers={() => setLayersOpen(true)} />}
      {host && <FrameBorderOverlay host={host} />}
      {host && (layersOpen
        ? <LayersInspector host={host} onClose={() => setLayersOpen(false)} />
        : <SelectionInspector host={host} />)}
    </div>
  );
}

/** Accessible left rail backed by native drawing tools and board actions. */
function BoardControls({ host, onOpenLayers }: { host: EditorHost; onOpenLayers: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const store = host.std.store;
  const [history, setHistory] = useState({ canUndo: false, canRedo: false });
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
  useEffect(() => installArrangementShortcuts(host, cause => {
    setActionError(cause instanceof Error ? cause.message : 'The canvas action failed.');
  }), [host]);

  useEffect(() => {
    const sync = () =>
      setHistory({ canUndo: store.history.canUndo, canRedo: store.history.canRedo });
    // Seed from the current state as well as subscribing: the first stack item
    // may already exist by the time this mounts.
    sync();
    const sub = store.history.onUpdated.subscribe(sync);
    return () => sub.unsubscribe();
  }, [store]);

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

  const onExport = useCallback(async () => {
    window.dispatchEvent(new Event('djai:open-export'));
  }, []);

  const onImportFile = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;

      // Import REPLACES the board. There is one board in this app, and the
      // alternative -- keeping both -- would leave the imported one invisible,
      // since the runtime opens the first doc it finds. Replacing is not
      // undoable, so anything but an untouched board gets asked first.
      if (!boardIsEmpty(store)) {
        const proceed = window.confirm(
          'Importing replaces the board you have open. This cannot be undone. Continue?'
        );
        if (!proceed) return;
      }

      const { workspace } = await getCanvasRuntime();
      const imported = await ZipTransformer.importDocs(workspace, store.schema, file);
      const restored = imported.find((doc) => !!doc);
      if (!restored) throw new Error('That file did not contain a board.');

      // The imported doc arrives with a fresh id (replaceIdMiddleware). Flush
      // it before reloading: reload tears down the current sync engines, and an
      // unflushed import would come back as an empty board.
      const replacedId = store.id;
      await workspace.waitForSynced();

      // In a multi-board workspace, "first doc" is no longer the active-board
      // rule. Point the next runtime at the imported replacement explicitly.
      setActiveBoardId(restored.id);
      // Removing the currently mounted store makes BlockSuite's live view read
      // a page root that no longer exists. Defer cleanup to startup, before the
      // replacement editor is mounted.
      deferBoardRemoval(replacedId);
      requestBoardOpen();

      // Reload rather than re-mounting onto the new store: the runtime memoises
      // one workspace and one document per page load, and a reload is the
      // honest way to land on the imported board with all of that rebuilt.
      window.location.reload();
    },
    [store]
  );

  return (
    <div
      data-testid="board-action-menu"
      role="toolbar"
      aria-label="Drawing and board tools"
      className="board-action-panel"
      style={{
        position: 'absolute',
        left: '1rem',
        top: '24px',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        padding: '8px',
        maxHeight: 'calc(100% - 80px)',
        overflowY: 'auto',
        borderRadius: 'var(--board-radius)',
        border: '1px solid var(--board-line)',
        background: 'var(--board-surface)',
        boxShadow: 'var(--board-shadow)',
      }}
    >
      <EdgelessToolbarDragHandle host={host} />
      {actionError && <p role="alert">{actionError}</p>}
      {imageError && <div role="alert" data-testid="image-import-error" style={{width:240,maxWidth:'calc(100vw - 64px)',whiteSpace:'normal'}}>
        <p>{imageError}</p><button type="button" onClick={()=>inputRef.current?.click()}>Choose another image</button>
      </div>}
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
        onClick={() => {
          insertText(host.std);
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

      <ControlButton label="Layers" onClick={onOpenLayers}>
        <path d="m12 4 8 4-8 4-8-4 8-4Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="m4 12 8 4 8-4M4 16l8 4 8-4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </ControlButton>

      <span
        aria-hidden="true"
        style={{ height: '1px', alignSelf: 'stretch', background: 'var(--board-line)', margin: '0.15rem 0.3rem' }}
      />

      <ControlButton label="Undo" disabled={!history.canUndo} onClick={() => store.undo()}>
        <path
          d="M9 7 4.5 11.5 9 16"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M4.5 11.5H14a5.5 5.5 0 0 1 0 11h-3"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </ControlButton>

      <ControlButton label="Redo" disabled={!history.canRedo} onClick={() => store.redo()}>
        <path
          d="M15 7l4.5 4.5L15 16"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M19.5 11.5H10a5.5 5.5 0 0 0 0 11h3"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </ControlButton>

      <span
        aria-hidden="true"
        style={{ height: '1px', alignSelf: 'stretch', background: 'var(--board-line)', margin: '0.15rem 0.3rem' }}
      />

      <ControlButton label="Export board" onClick={() => void onExport()}>
        <path
          d="M12 3.5v11m0 0 4-4m-4 4-4-4"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M4.5 16.5v2a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </ControlButton>

      <ControlButton label="Import board" onClick={() => importRef.current?.click()}>
        <path
          d="M12 14.5v-11m0 0 4 4m-4-4-4 4"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M4.5 16.5v2a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </ControlButton>

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
    </div>
  );
}

/**
 * True when the board holds nothing the user would mind losing.
 *
 * `affine:page` and `affine:surface` are structural -- every board has them
 * even when blank -- so they do not count as content.
 */
function boardIsEmpty(store: Store): boolean {
  const surface = store.getBlocksByFlavour('affine:surface')[0];
  const elements =
    (surface?.model as { elementModels?: unknown[] } | undefined)?.elementModels?.length ?? 0;
  if (elements > 0) return false;
  return store
    .getAllModels()
    .every((model) => model.flavour === 'affine:page' || model.flavour === 'affine:surface');
}

function ControlButton({
  label,
  onClick,
  disabled = false,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="board-control"
      style={{
        display: 'grid',
        placeContent: 'center',
        width: '2rem',
        height: '2rem',
        borderRadius: '8px',
        border: 'none',
        background: 'transparent',
        color: disabled ? 'var(--board-ink-disabled)' : 'var(--board-ink)',
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
