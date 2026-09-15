/**
 * The app header: local board access, save state, attribution, and export.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { BoardTitleMenu } from './BoardTitleMenu';
import logo from '../assets/djai-design-logo.png';
import { exportBoardFile } from '../canvas/export-board';
import { getCanvasRuntime } from '../canvas/runtime';
import { getSaveStatus, subscribeSaveStatus } from '../canvas/save-status';
import { retryWorkspacePersistence } from '../canvas/workspace';
import { ExportDialog } from './ExportDialog';
import { CANVAS_HOME_URL } from './links';

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
  const exportButtonRef = useRef<HTMLButtonElement>(null);

  const closeExport = useCallback(() => {
    setExportOpen(false);
    requestAnimationFrame(() => exportButtonRef.current?.focus());
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
        aria-label="DJAI Design"
        onClick={(event) => {
          if (!onOpenBoards) return;
          event.preventDefault();
          onOpenBoards();
        }}
      >
        <img src={logo} alt="DJAI Design" height={34} />
      </a>

      {onOpenBoards && onRenameBoard && <BoardTitleMenu title={boardTitle} onOpenBoards={onOpenBoards} onRename={onRenameBoard} />}

      <nav className="djai-header-actions">
        <a
          className="djai-community-link"
          href={CANVAS_HOME_URL}
          target="_blank"
          rel="noreferrer noopener"
        >
          Full DJAI Canvas
        </a>
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
            {saveStatus.label}
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
                      .then(({ workspace }) => retryWorkspacePersistence(workspace))
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
        <button
          ref={exportButtonRef}
          type="button"
          className="djai-primary"
          onClick={() => setExportOpen(true)}
        >
          Export
        </button>
      </nav>

      {exportOpen && <ExportDialog onClose={closeExport} />}
    </header>
  );
}
