/**
 * The Export dialog, and the follow-us prompt that comes after a download.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { EXPORT_FORMATS, exportBoardFile, type ExportFormat } from '../canvas/export-board';
import {
  presentationScopeAvailability,
  type PresentationScope,
} from '../canvas/presentation-export';
import { APP_URL, FOLLOW_LINKS, SHARE_TARGETS } from './links';

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const [format, setFormat] = useState<ExportFormat>('board');
  const [scope, setScope] = useState<PresentationScope>('visible');
  const [transparent, setTransparent] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [availability] = useState(() => presentationScopeAvailability());
  const downloadButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (error && !exporting) downloadButtonRef.current?.focus();
  }, [error, exporting]);

  const performDownload = useCallback(async () => {
    setError(null);
    setExporting(true);
    try {
      await exportBoardFile(format, { scope, transparent });
      // The follow prompt replaces this panel only once a download has really
      // happened, so a failed export cannot look like a success.
      setDownloaded(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setExporting(false);
    }
  }, [format, scope, transparent]);

  const download = useCallback(() => void performDownload(), [performDownload]);

  const share = useCallback((target: (typeof SHARE_TARGETS)[number]) => {
    window.open(target.href(), '_blank', 'noopener,noreferrer');
  }, []);

  const shareToDevice = useCallback(async () => {
    if (!navigator.share) {
      setError('System sharing is not available in this browser. Use Share link instead.');
      return;
    }
    try {
      await navigator.share({ title: 'DJAI Canvas', text: 'I made this with DJAI Canvas', url: APP_URL });
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      setError('The system share menu could not be opened.');
    }
  }, []);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(APP_URL);
      setCopied(true);
    } catch {
      setError('Could not copy the link. Your browser blocked clipboard access.');
    }
  }, []);

  if (downloaded) return <FollowPrompt onClose={onClose} />;

  return (
    <Panel title="Export board" onClose={onClose}>
      <Section label="Format">
        {EXPORT_FORMATS.map((f) => (
          <label key={f.id} className="djai-radio">
            <input
              type="radio"
              name="export-format"
              value={f.id}
              checked={format === f.id}
              onChange={() => setFormat(f.id)}
            />
            <span>
              <strong>{f.label}</strong>
              <em>{f.hint}</em>
            </span>
          </label>
        ))}
      </Section>

      {format !== 'board' && (
        <Section label="Area">
          {([
            ['visible', 'Visible area', 'What is currently inside the canvas viewport.'],
            ['board', 'Board content', 'Every object, cropped to the content bounds.'],
            ['selection', 'Selection', 'Only the objects selected before opening Export.'],
            ['frame', 'Selected frame', 'The selected frame and the content inside it.'],
          ] as const).map(([id, label, hint]) => (
            <label key={id} className={`djai-radio${availability[id] ? '' : ' is-disabled'}`}>
              <input
                type="radio"
                name="export-scope"
                value={id}
                checked={scope === id}
                disabled={!availability[id]}
                onChange={() => setScope(id)}
              />
              <span>
                <strong>{label}</strong>
                <em>{availability[id] ? hint : `${hint} Not available now.`}</em>
              </span>
            </label>
          ))}
          {format === 'png' && (
            <label className="djai-check">
              <input
                type="checkbox"
                checked={transparent}
                onChange={event => setTransparent(event.target.checked)}
              />
              <span>
                <strong>Transparent background</strong>
                <em>Keeps transparent pixels in the exported PNG.</em>
              </span>
            </label>
          )}
          {format === 'pdf' && (
            <p className="djai-note">
              Large areas continue across A4 landscape pages at the same scale; content is never
              silently shrunk or clipped.
            </p>
          )}
        </Section>
      )}

      <button
        ref={downloadButtonRef}
        type="button"
        className="djai-primary"
        onClick={download}
        disabled={exporting}
      >
        {exporting ? 'Preparing…' : 'Download'}
      </button>

      <Section label="Share">
        <div className="djai-row">
          {SHARE_TARGETS.map((t) => (
            <button
              type="button"
              key={t.id}
              className="djai-chip"
              onClick={() => share(t)}
            >
              {t.label}
            </button>
          ))}
          <button type="button" className="djai-chip" onClick={() => void shareToDevice()}>
            Device
          </button>
          <button type="button" className="djai-chip" onClick={() => void copyLink()}>
            {copied ? 'Link copied' : 'Share link'}
          </button>
        </div>
        <p className="djai-note">
          Sharing links to the hosted DJAI Canvas. Boards remain local, so links do not publish
          private board content.
        </p>
      </Section>

      {error && (
        <p role="alert" className="djai-error">
          {error}
        </p>
      )}
    </Panel>
  );
}

function FollowPrompt({ onClose }: { onClose: () => void }) {
  return (
    <Panel title="Downloaded" onClose={onClose}>
      <p className="djai-note">Your board is saved. Come find us:</p>
      <div className="djai-row">
        {FOLLOW_LINKS.map((l) => (
          <a
            key={l.label}
            className="djai-chip"
            href={l.href}
            target="_blank"
            rel="noreferrer noopener"
          >
            {l.label}
          </a>
        ))}
      </div>
      <a className="djai-primary djai-link" href={APP_URL} target="_blank" rel="noreferrer noopener">
        Open the full DJAI Canvas
      </a>
    </Panel>
  );
}

function Panel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panelRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    document.addEventListener('keydown', closeOnEscape, true);
    return () => document.removeEventListener('keydown', closeOnEscape, true);
  }, [onClose]);

  return (
    <div
      className="djai-backdrop"
      // Click-outside to dismiss, but only on the backdrop itself -- a click
      // that started inside the panel must not close it.
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="djai-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <header className="djai-panel-head">
          <h2>{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="djai-close">
            ×
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="djai-section">
      <h3>{label}</h3>
      {children}
    </section>
  );
}
