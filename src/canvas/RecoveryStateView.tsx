import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { RecoveryOutcome } from './account/recovery';
import type { RecoveryDownloadState } from './save-status';
import { restorePendingRecovery } from './runtime';

/** Pending versions stay immutable when this dialog is dismissed or reopened. */
export function RecoveryVersionChoice({ reason, onRestored }: { reason?: 'divergent' | 'unknown' | 'unchanged' | 'restored'; onRestored?: () => void }) {
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null); const heading = useRef<HTMLHeadingElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) { dialog.current?.showModal(); heading.current?.focus({ preventScroll: true }); }
  }, [open]);
  const close = () => { if (busy) return; setOpen(false); requestAnimationFrame(() => trigger.current?.focus()); };
  const title = reason === 'divergent' ? 'This board changed while you were away' : reason === 'restored' ? 'Editing access restored' : reason === 'unchanged' ? 'Review your pending changes' : 'Choose a version to recover';
  const restore = async () => {
    if (busy) return; setBusy(true); setError('');
    try { if (await restorePendingRecovery()) onRestored?.(); }
    catch { setError('Your changes could not be recovered. Your local version is still here.'); }
    finally { setBusy(false); }
  };
  return <>
    <section className="board-recovery board-recovery--compact" aria-label="Pending local version">
      <button ref={trigger} className="djai-ghost" aria-haspopup="dialog" onClick={() => setOpen(true)}>Review pending changes</button>
    </section>
    {open && createPortal(<dialog ref={dialog} className="session-recovery recovery-version-dialog" aria-labelledby="recovery-version-heading" aria-describedby="recovery-version-description" aria-busy={busy}
      onCancel={event => { event.preventDefault(); close(); }} onKeyDown={event => event.stopPropagation()}>
      <h2 ref={heading} id="recovery-version-heading" tabIndex={-1}>{title}</h2>
      <p id="recovery-version-description">{reason === 'restored' ? 'This browser has pending edits. Restore them or load the latest shared board.' : 'Load the latest shared board, or create a private copy with your local changes.'}</p>
      <p>Your local version is kept in this browser. Shared changes are paused until you decide.</p>
      {busy && <p role="status">Checking access before recovering your changes.</p>}
      {error && <p role="alert">{error}</p>}
      <div className="board-recovery__actions">
        {reason === 'restored' ? <button className="djai-primary" disabled={busy} onClick={() => { void restore(); }}>Restore pending edits</button> : <button className="djai-primary" disabled>Create private copy</button>}
        <button disabled>Load latest changes</button>
        <button disabled={busy} onClick={close}>Decide later</button>
      </div>
    </dialog>, document.body)}
  </>;
}

export function RecoveryStateView({ state, retry, openRestored, download, downloadStatus, compact = false }: {
  state: RecoveryOutcome; retry?: () => void | Promise<unknown>; openRestored?: () => void; download?: () => Promise<unknown>; compact?: boolean;
  downloadStatus?: RecoveryDownloadState;
}) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [expanded, setExpanded] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  if (state === 'saved') return null;
  const title = state === 'storage-paused' ? 'Editing paused' : ['corrupt', 'epoch-mismatch'].includes(state) ? 'Recovery needs attention' : state === 'denied' ? 'Your access has changed' : state === 'pending' ? 'Changes waiting to save' : 'Recovering changes…';
  const message = state === 'storage-paused' ? 'This browser cannot preserve more changes. Keep this tab open. Download a recovery copy, allow storage for this site, then retry saving.' : state === 'epoch-mismatch' ? 'The server copy changed after a restore. Pending changes have been kept separately. Download a recovery copy before continuing with the restored board.' : state === 'corrupt' ? "These pending changes could not be opened safely. Keep this browser's data and contact your operator for recovery help." : state === 'denied' ? 'Your access has changed. Pending changes have not been applied. Contact the board owner to restore editing access.' : 'Changes are being kept for this account while saving is retried.';
  const run = async (action: () => void | Promise<unknown>) => { if (busy) return; setBusy(true); setError(''); try { await action(); } catch { setError('Changes still cannot be preserved or saved. Keep this tab open and download a recovery copy.'); } finally { setBusy(false); } };
  return <section className={compact ? 'board-recovery board-recovery--compact' : 'board-recovery'} aria-label="Board recovery" onKeyDown={event => {
    if (event.key === 'Escape' && compact && expanded) { event.preventDefault(); event.stopPropagation(); setExpanded(false); trigger.current?.focus(); }
  }}>
    {compact ? <button ref={trigger} className="djai-ghost" aria-expanded={expanded} aria-controls="board-recovery-details" onClick={() => setExpanded(value => !value)}>{title}</button> : <h1>{title}</h1>}
    <div id="board-recovery-details" hidden={compact && !expanded}>
      <p role="status">{message}</p>{error && <p role="alert">{error}</p>}
      {downloadStatus && <p role={downloadStatus.phase === 'error' ? 'alert' : 'status'} style={{ overflowWrap: 'anywhere' }}>{downloadStatus.label}{downloadStatus.message && ` ${downloadStatus.message}`}</p>}
      <div className="board-recovery__actions">
        {retry && !['corrupt', 'epoch-mismatch', 'denied'].includes(state) && <button disabled={busy} onClick={() => { void run(retry); }}>{state === 'storage-paused' ? 'Retry saving' : 'Retry now'}</button>}
        {download && <button disabled={downloadStatus?.phase === 'preparing'} onClick={() => { void download().catch(() => undefined); }}>Download recovery copy</button>}
        {state === 'epoch-mismatch' && openRestored && <button disabled={busy} onClick={openRestored}>Open restored board</button>}
        {!compact && <a href="/">Back to your boards</a>}
      </div>
    </div>
  </section>;
}
