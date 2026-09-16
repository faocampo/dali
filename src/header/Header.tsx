/**
 * The app header: local board access, save state, and shared export dialog.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { DaliMenu } from './DaliMenu';
import { BoardTitleMenu } from './BoardTitleMenu';
import logo from '../../imgs/svg/dali-symbol-color.svg';
import { exportBoardFile } from '../canvas/export-board';
import { getActiveAccessScope, getCanvasRuntime } from '../canvas/runtime';
import { createAccountBoard } from '../boards/operations';
import { accountBoardUrl } from '../boards/preferences';
import { getSaveStatus, subscribeSaveStatus } from '../canvas/save-status';
import { ExportDialog } from './ExportDialog';

export function Header({
  boardTitle = 'Untitled board',
  onOpenBoards,
  onRenameBoard,
}: {
  boardTitle?: string;
  onOpenBoards?: () => void;
  onRenameBoard?: (title: string) => Promise<void>;
}) {
  const [exportOpen, setExportOpen] = useState(false);
  const [saveHelpOpen, setSaveHelpOpen] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const saveStatus = useSyncExternalStore(subscribeSaveStatus, getSaveStatus);
  type Creation = { id: string; accountId: string; generation: number; tab: Window | null; state: 'pending' | 'error' | 'ready'; href?: string };
  const [creations, setCreations] = useState<Creation[]>([]);
  const lifetime = useRef(new AbortController());
  useEffect(() => { lifetime.current = new AbortController(); return () => lifetime.current.abort(); }, []);
  const completeCreation = async (creation: Creation) => {
    const signal = lifetime.current.signal;
    setCreations(values => values.map(value => value.id === creation.id ? { ...value, state: 'pending' } : value));
    try {
      const result = await createAccountBoard(creation.accountId, creation.id, signal);
      const scope = getActiveAccessScope();
      if (signal.aborted || scope?.phase !== 'active' || scope.accountId !== creation.accountId || scope.generation !== creation.generation) return;
      const href = accountBoardUrl(result.summary.id);
      if (creation.tab && !creation.tab.closed) { creation.tab.location.replace(href); setCreations(values => values.filter(value => value.id !== creation.id)); }
      else setCreations(values => values.map(value => value.id === creation.id ? { ...value, href, state: 'ready' } : value));
    } catch {
      if (!signal.aborted) setCreations(values => values.map(value => value.id === creation.id ? { ...value, state: 'error' } : value));
    }
  };
  const newBoard = () => {
    const scope = getActiveAccessScope(); if (scope?.phase !== 'active') return;
    // Reserve synchronously in the gesture; network completion only navigates it.
    const tab = window.open('about:blank', '_blank'); if (tab) tab.opener = null;
    const creation: Creation = { id: crypto.randomUUID(), accountId: scope.accountId, generation: scope.generation, tab, state: 'pending' };
    setCreations(values => [...values, creation]); void completeCreation(creation);
  };

  const closeExport = useCallback(() => {
    setExportOpen(false);
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('.dali-menu-trigger')?.focus());
  }, []);

  useEffect(() => {
    const open = () => setExportOpen(true);
    window.addEventListener('djai:open-export', open);
    return () => window.removeEventListener('djai:open-export', open);
  }, []);

  return (
    <header className="djai-header">
      <a
        className="djai-brand"
        href="/"
        aria-label="Dalí"
        onClick={(event) => {
          if (!onOpenBoards) return;
          event.preventDefault();
          onOpenBoards();
        }}
      >
        <img src={logo} alt="Dalí" height={34} />
      </a>

      <DaliMenu onOpenBoards={onOpenBoards} onExport={() => setExportOpen(true)} onNewBoard={newBoard} />
      {!onRenameBoard && <h1 style={{ fontSize: 15 }}>{boardTitle}</h1>}
      {onOpenBoards && onRenameBoard && <BoardTitleMenu title={boardTitle} onRename={onRenameBoard} />}

      <nav className="djai-header-actions">
        <div className="djai-save">
          <button
            type="button"
            className={`djai-save__status djai-save__status--${saveStatus.state}`}
            aria-haspopup={saveStatus.state === 'failed' ? 'dialog' : undefined}
            aria-expanded={saveStatus.state === 'failed' ? saveHelpOpen : undefined}
            aria-live="polite"
            onClick={() => {
              if (saveStatus.state === 'failed') setSaveHelpOpen((open) => !open);
            }}
          >
            <span aria-hidden="true" />
            {saveStatus.state === 'saved' ? 'Saved' : saveStatus.label}
          </button>
          {saveStatus.state === 'failed' && saveHelpOpen && (
            <div className="djai-save__recovery" role="dialog" aria-label="Local save recovery">
              <strong>Your board is still open</strong>
              <p>{retryError ?? saveStatus.message}</p>
              <div>
                <button
                  type="button"
                  className="djai-ghost"
                  onClick={() => {
                    setRetryError(null);
                    void getCanvasRuntime()
                      .then(({ workspace }) => { workspace.docSync.forceStop(); workspace.docSync.start(); })
                      .then(() => setSaveHelpOpen(false))
                      .catch((cause: unknown) =>
                        setRetryError(cause instanceof Error ? cause.message : String(cause))
                      );
                  }}
                >
                  Retry saving
                </button>
                <button
                  type="button"
                  className="djai-primary"
                  onClick={() => void exportBoardFile()}
                >
                  Download backup
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {exportOpen && <ExportDialog onClose={closeExport} />}
      {creations.map(creation => <div key={creation.id} role={creation.state === 'error' ? 'alert' : 'status'}>
        {creation.state === 'pending' ? 'Creating board…' : creation.state === 'error' ? <><span>We couldn't open the new board. Your current board is unchanged.</span><button onClick={() => { void completeCreation(creation); }}>Retry new board</button></>
          : <><span>Your new board is ready.</span><a href={creation.href} target="_blank" rel="noopener noreferrer">Open new board</a></>}
      </div>)}
    </header>
  );
}
