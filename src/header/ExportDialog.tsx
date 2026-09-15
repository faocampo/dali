/**
 * Accessible export settings and artifact download status.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EXPORT_FORMATS, exportBoardFile, type ExportFormat } from '../canvas/export-board';
import {
  presentationScopeAvailability,
  boardExportPlan,
  exportHasCollapsedTopics,
  type PresentationScope,
} from '../canvas/presentation-export';
import { createPortal } from 'react-dom';
import { DEFAULT_EXPORT_OPTIONS, type ExportScale } from '../canvas/export-plan';

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const [format, setFormat] = useState<ExportFormat>('board');
  const [scope, setScope] = useState<PresentationScope>('board');
  const [scale, setScale] = useState<ExportScale>(1);
  const [padding, setPadding] = useState('0');
  const [transparent, setTransparent] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [availability] = useState(() => presentationScopeAvailability());
  const [previewVersion, refreshPreview] = useState(0);
  const plan = useMemo(() => boardExportPlan({ ...DEFAULT_EXPORT_OPTIONS, scope, scale, padding: scope === 'selection' ? (padding.trim() ? Number(padding) : NaN) : 0, background: transparent ? 'transparent' : 'white' }), [scope, scale, padding, transparent, previewVersion]);
  const downloadButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (error && !exporting) downloadButtonRef.current?.focus();
  }, [error, exporting]);

  const performDownload = useCallback(async () => {
    setError(null);
    setExporting(true);
    try {
      await exportBoardFile(format, { scope, transparent, scale, plan: format === 'png' ? plan : undefined });
      // Show success only after the export has actually started.
      setDownloaded(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      refreshPreview(value => value + 1);
    } finally {
      setExporting(false);
    }
  }, [format, scope, transparent, scale, plan]);

  const download = useCallback(() => void performDownload(), [performDownload]);

  return (
    <Panel title={downloaded ? 'Download started' : 'Export board'} onClose={onClose}>
      {downloaded ? <>
        <div className="export-settings" role="status">
          <p className="export-artifact">{EXPORT_FORMATS.find(item => item.id === format)?.label}</p>
          <p className="djai-note">Your browser is downloading the file. Find it in your browser’s downloads.</p>
        </div>
        <footer className="export-footer">
          <button type="button" className="djai-chip" onClick={() => setDownloaded(false)}>Export again</button>
          <button type="button" className="djai-primary" autoFocus onClick={onClose}>Done</button>
        </footer>
      </> : <>
      <div className="export-settings">
      <Section label="Format">
        {EXPORT_FORMATS.map((f) => (
          <label key={f.id} className="djai-radio">
            <input
              type="radio"
              name="export-format"
              value={f.id}
              checked={format === f.id}
              disabled={exporting}
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
                disabled={exporting || !availability[id]}
                onChange={() => setScope(id)}
              />
              <span>
                <strong>{label}</strong>
                <em>{availability[id] ? hint : id === 'selection' ? 'Select one or more objects before opening Export.' : 'Select exactly one frame before opening Export.'}</em>
              </span>
            </label>
          ))}
          {format === 'png' && (
            <label className="djai-check">
              <input
                type="checkbox"
                checked={transparent}
                disabled={exporting}
                onChange={event => setTransparent(event.target.checked)}
              />
              <span>
                <strong>Transparent background</strong>
                <em>Use alpha outside objects. Turn off for a white background.</em>
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

      {format === 'png' && <Section label="Resolution">
        {scope === 'selection' && <label className="export-padding">
          Selection padding
          <input aria-label="Selection padding" type="number" min="0" max="256" step="1" value={padding} disabled={exporting} onChange={event => setPadding(event.target.value)} />
          <span>World units on each side (0–256).</span>
        </label>}
        <div className="djai-row">
          {([1, 2, 4] as const).map(value => <label className="djai-radio" key={value}>
            <input type="radio" name="export-scale" checked={scale === value} disabled={exporting} onChange={() => setScale(value)} />
            <span>{value}×</span>
          </label>)}
        </div>
        {exportHasCollapsedTopics(plan) && <p className="djai-note">Only visible topics are exported. Expand branches to include their hidden topics.</p>}
        {plan.error && <p role="alert">{plan.error}</p>}
        {plan.lowerScale && <button type="button" onClick={() => setScale(plan.lowerScale!)}>Use {plan.lowerScale}×</button>}
      </Section>}

      </div>
      <footer className="export-footer">
        <div className="export-summary" aria-live="polite">
        {format === 'png' && <p data-testid="export-dimensions" data-export-ids={JSON.stringify(plan.includedIds)}>{Number.isFinite(plan.pixelWidth) && Number.isFinite(plan.pixelHeight) ? `${plan.pixelWidth} × ${plan.pixelHeight} pixels` : 'Dimensions unavailable'}</p>}
          {format !== 'png' && <p>{format === 'board' ? 'Editable board file' : 'A4 landscape pages'}</p>}
          {error && <p role="alert" className="djai-error">{error}</p>}
        </div>
      <button
        ref={downloadButtonRef}
        type="button"
        className="djai-primary"
        onClick={download}
        disabled={exporting || (format === 'png' && !plan.valid)}
      >
        {exporting ? 'Preparing…' : 'Download'}
      </button>

      </footer>
      </>}
    </Panel>
  );
}

function Panel({ title, onClose, children }: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = panelRef.current!;
    const previousFocus = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    // Move focus to the primary action when the download status replaces settings.
    const selector = title === 'Download started' ? '.djai-primary' : '.djai-close';
    panelRef.current?.querySelector<HTMLButtonElement>(selector)?.focus();
  }, [title]);

  return createPortal(
    <dialog
      ref={panelRef}
      className="djai-panel export-dialog"
      aria-label={title}
      onKeyDown={event => {
        event.stopPropagation();
        if (event.key !== 'Tab') return;
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
          'button, input, select, textarea, a[href], [tabindex]',
        )).filter(control => control.tabIndex >= 0 && !control.matches(':disabled') && control.getClientRects().length > 0 && (
          !(control instanceof HTMLInputElement) || control.type !== 'radio' || control.checked
        ));
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={event => { event.preventDefault(); onClose(); }}
      onPointerDown={event => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
      }}
    >
      <header className="djai-panel-head">
        <h2>{title}</h2>
        <button type="button" aria-label="Close" onClick={onClose} className="djai-close">×</button>
      </header>
      {children}
    </dialog>,
    document.body,
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
