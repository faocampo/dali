import { useCallback, useEffect, useRef, useState } from 'react';
import logo from '../assets/djai-design-logo.png';
import {
  createLocalBoard,
  deleteLocalBoard,
  duplicateLocalBoard,
  listLocalBoards,
  openLocalBoard,
  renameLocalBoard,
  type LocalBoardSummary,
} from './operations';
import {
  BOARD_TEMPLATES,
  boardTemplate,
  type BoardTemplate,
  type TemplateId,
  type TemplatePrimitive,
} from './templates';

function previewStyle(primitive: TemplatePrimitive): React.CSSProperties {
  const [x, y, width, height] = primitive.xywh;
  return {
    left: `${(x / 960) * 100}%`,
    top: `${(y / 620) * 100}%`,
    width: `${(width / 960) * 100}%`,
    height: `${(height / 620) * 100}%`,
  };
}

function TemplateCanvasPreview({ template }: { template: BoardTemplate }) {
  return (
    <div className="template-canvas-preview" aria-hidden="true">
      {template.primitives.length === 0 && (
        <span className="template-canvas-preview__empty">Your ideas start here</span>
      )}
      {template.primitives.map((primitive, index) => (
        <span
          className={`template-preview-object template-preview-object--${primitive.kind}`}
          data-colour={'colour' in primitive ? primitive.colour : 'fill' in primitive ? primitive.fill : undefined}
          style={previewStyle(primitive)}
          key={`${primitive.kind}-${index}`}
        >
          {primitive.text}
        </span>
      ))}
    </div>
  );
}

export function BoardLibrary() {
  const [boards, setBoards] = useState<LocalBoardSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [previewId, setPreviewId] = useState<TemplateId | null>(null);
  const previewDialogRef = useRef<HTMLElement | null>(null);
  const previewTriggerRef = useRef<HTMLButtonElement | null>(null);

  const closePreview = useCallback(() => {
    setPreviewId(null);
    requestAnimationFrame(() => previewTriggerRef.current?.focus());
  }, []);

  const refresh = useCallback(async () => {
    const next = await listLocalBoards();
    setBoards(next);
    return next;
  }, []);

  useEffect(() => {
    void refresh().catch((cause: unknown) =>
      setError(cause instanceof Error ? cause.message : String(cause))
    );
  }, [refresh]);

  const run = useCallback(async (operation: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await operation();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }, []);

  const create = (templateId: TemplateId = 'blank') =>
    void run(async () => {
      const id = await createLocalBoard(templateId);
      openLocalBoard(id);
    });

  useEffect(() => {
    if (!previewId) return;
    previewDialogRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closePreview();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [closePreview, previewId]);

  const rename = (board: LocalBoardSummary) => {
    const title = window.prompt('Board name', board.title);
    if (title === null || title.trim() === '') return;
    void run(async () => {
      await renameLocalBoard(board.id, title);
      const next = await refresh();
      if (next.find((item) => item.id === board.id)?.title !== title.trim()) {
        throw new Error('The board library did not refresh the new name.');
      }
    });
  };

  const duplicate = (board: LocalBoardSummary) =>
    void run(async () => {
      await duplicateLocalBoard(board.id);
      await refresh();
    });

  const remove = (board: LocalBoardSummary) => {
    if (!window.confirm(`Delete “${board.title}” from this browser? This cannot be undone.`)) {
      return;
    }
    void run(async () => {
      await deleteLocalBoard(board.id);
      window.location.reload();
    });
  };

  return (
    <div className="board-library">
      <header className="board-library__header">
        <a className="djai-brand" href="/" aria-label="DJAI Design">
          <img src={logo} alt="DJAI Design" height={34} />
        </a>
        <div className="board-library__header-copy">
          <strong>Your boards</strong>
          <span>Stored on this device</span>
        </div>
        <button type="button" className="djai-primary" onClick={() => create()} disabled={busy}>
          + New board
        </button>
      </header>

      <main className="board-library__main">
        <div className="board-library__title-row">
          <div>
            <h1>Your boards</h1>
            <p>Each board stays in this browser unless you export a board file.</p>
          </div>
        </div>

        <section className="board-library__templates" aria-labelledby="templates-heading">
          <div className="board-library__templates-heading">
            <h2 id="templates-heading">Templates</h2>
            <p>Preview a starter, then make every object your own.</p>
          </div>
          <div className="template-grid">
            {BOARD_TEMPLATES.map(template => (
              <article className="template-card" key={template.id}>
                <button
                  type="button"
                  className="template-card__preview"
                  onClick={event => {
                    previewTriggerRef.current = event.currentTarget;
                    setPreviewId(template.id);
                  }}
                  aria-label={`Preview ${template.name}`}
                  disabled={busy}
                >
                  <TemplateCanvasPreview template={template} />
                  <strong>{template.name}</strong>
                  <small>{template.description}</small>
                </button>
              </article>
            ))}
          </div>
        </section>

        {error && <p className="djai-error" role="alert">{error}</p>}

        <div className="board-grid" aria-busy={busy}>
          {boards.map((board) => (
            <article className="board-card" key={board.id} data-board-id={board.id}>
              <button
                type="button"
                className="board-card__open"
                onClick={() => openLocalBoard(board.id)}
                aria-label={`Open ${board.title}`}
              >
                <span className="board-card__preview" aria-hidden="true">
                  {board.preview.length === 0 && <i className="board-preview board-preview--empty" />}
                  {board.preview.map((kind, index) => (
                    <i
                      className={`board-preview board-preview--${kind}`}
                      style={{ '--preview-index': index } as React.CSSProperties}
                      key={`${kind}-${index}`}
                    />
                  ))}
                </span>
                <strong>{board.title}</strong>
                <small>Edited {new Date(board.updatedAt).toLocaleString()}</small>
              </button>
              <div className="board-card__actions">
                <button type="button" onClick={() => rename(board)} disabled={busy}>Rename</button>
                <button type="button" onClick={() => duplicate(board)} disabled={busy}>Duplicate</button>
                <button type="button" onClick={() => remove(board)} disabled={busy}>Delete</button>
              </div>
            </article>
          ))}
          <button type="button" className="board-card board-card--new" onClick={() => create()} disabled={busy}>
            <span aria-hidden="true">+</span>
            <strong>Create blank board</strong>
          </button>
        </div>
      </main>

      {previewId && (() => {
        const template = boardTemplate(previewId);
        return (
          <div
            className="template-dialog-backdrop"
            onMouseDown={event => {
              if (event.target === event.currentTarget) closePreview();
            }}
          >
            <section
              ref={previewDialogRef}
              className="template-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="template-dialog-title"
              tabIndex={-1}
            >
              <header>
                <div>
                  <span>Template preview</span>
                  <h2 id="template-dialog-title">{template.name}</h2>
                  <p>{template.description}</p>
                </div>
                <button type="button" onClick={closePreview} aria-label="Close template preview">
                  ×
                </button>
              </header>
              <TemplateCanvasPreview template={template} />
              <footer>
                <p>Creates ordinary editable objects. No locked workflow.</p>
                <div>
                  <button type="button" onClick={closePreview} disabled={busy}>Cancel</button>
                  <button
                    type="button"
                    className="djai-primary"
                    onClick={() => create(template.id)}
                    disabled={busy}
                  >
                    Use this template
                  </button>
                </div>
              </footer>
            </section>
          </div>
        );
      })()}
    </div>
  );
}
