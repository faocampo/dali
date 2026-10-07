import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createPrivateRecoveryCopy } from '../boards/operations';
import { MenuIcon } from '../header/MenuIcon';
import { getRecoveryDecision, restorePendingRecovery } from './runtime';
import { downloadChosenRecoveryCopy } from './recovery-archive';
import './recovery-version.css';

type Action = 'copy' | 'restore' | 'download' | 'latest' | 'access';
/** Dismissal preserves the candidate. Only an acknowledged operation resolves it. */
export function RecoveryVersionDialog({ reason, onRestored, onCopied, onLatest, onBackToVersions }: {
  reason?: 'divergent' | 'unknown' | 'unchanged' | 'restored'; onRestored?: () => void; onCopied?: (boardId: string) => void;
  onLatest?: () => Promise<void>; onBackToVersions?: () => void;
}) {
  const [open, setOpen] = useState(true); const [offer, setOffer] = useState(false); const [downloaded, setDownloaded] = useState(false);
  const [busy, setBusy] = useState<Action>(); const busyRef = useRef(false);
  const [error, setError] = useState(''); const [failed, setFailed] = useState<Action>(); const [unverified, setUnverified] = useState(!navigator.onLine);
  const dialog = useRef<HTMLDialogElement>(null); const heading = useRef<HTMLHeadingElement>(null); const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (open) { dialog.current?.showModal(); heading.current?.focus({ preventScroll: true }); } }, [open, offer]);
  useEffect(() => { const offline = () => setUnverified(true); window.addEventListener('offline', offline); return () => window.removeEventListener('offline', offline); }, []);
  const close = () => { if (busyRef.current) return; setOpen(false); requestAnimationFrame(() => trigger.current?.focus()); };
  const versionTitle = reason === 'divergent' ? 'This board changed while you were away' : reason === 'restored' ? 'Editing access restored' : reason === 'unchanged' ? 'Review your pending changes' : 'Choose a version to recover';
  const back = () => { setOffer(false); setError(''); setFailed(undefined); onBackToVersions?.(); };
  const run = async (action: Action) => {
    if (busyRef.current) return; busyRef.current = true; setBusy(action); setError(''); setFailed(undefined);
    try {
      if (action === 'copy') { const copied = await createPrivateRecoveryCopy(); onCopied?.(copied.summary.id); }
      else if (action === 'restore') { if (await restorePendingRecovery()) onRestored?.(); }
      else if (action === 'download') { await downloadChosenRecoveryCopy(); setDownloaded(true); }
      else if (action === 'latest') { await onLatest?.(); }
      else { const decision = await getRecoveryDecision(); await decision.authorize(); setUnverified(false); }
    } catch (cause) {
      setFailed(action);
      setError(action === 'copy' ? 'Your private copy could not be created. Your local work is still here.' : action === 'download' ? 'The local copy could not be prepared. Your work is still here.' : action === 'latest' ? 'The latest board could not be loaded. Your local work is still here.' : action === 'access' ? 'Access could not be checked. Try again when your connection is available.' : 'Your changes could not be recovered. Your local version is still here.');
      if (!navigator.onLine || action === 'access' || cause instanceof Error && 'code' in cause && cause.code === 'RECOVERY_ACCESS_UNVERIFIED') setUnverified(true);
    } finally { busyRef.current = false; setBusy(undefined); }
  };
  return <>
    <section className="board-recovery board-recovery--compact" aria-label="Pending local version">
      <button ref={trigger} className="djai-ghost" aria-haspopup="dialog" onClick={() => setOpen(true)}>Review pending changes</button>
    </section>
    {open && createPortal(<dialog ref={dialog} className="session-recovery recovery-version-dialog" aria-labelledby="recovery-version-heading" aria-describedby="recovery-version-description" aria-busy={!!busy}
      onCancel={event => { event.preventDefault(); close(); }} onKeyDown={event => {
        event.stopPropagation();
        if (event.key !== 'Tab') return;
        const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
        const first = buttons[0]; const last = buttons.at(-1);
        if (!first) { event.preventDefault(); heading.current?.focus(); }
        else if (event.shiftKey && (document.activeElement === first || document.activeElement === heading.current)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}>
      <h2 ref={heading} id="recovery-version-heading" tabIndex={-1}>{offer ? 'Download your local version?' : versionTitle}</h2>
      <p id="recovery-version-description">{offer ? 'Keep a recovery copy before loading the latest shared board. Loading without downloading discards this local version after the latest board opens successfully.' : reason === 'restored' ? 'This browser has pending edits. Restore them or load the latest shared board.' : 'Load the latest shared board, or create a private copy with your local changes.'}</p>
      {!offer && <p>Your local version is kept in this browser. Shared changes are paused until you decide.</p>}
      {busy && <p role="status">{busy === 'copy' ? 'Creating private copy…' : busy === 'download' ? 'Preparing local copy…' : busy === 'latest' ? 'Loading latest changes…' : 'Checking access before recovering your changes.'}</p>}
      {busy && ['copy', 'download', 'latest'].includes(busy) && <progress aria-label={busy === 'copy' ? 'Creating private copy' : busy === 'download' ? 'Preparing local copy' : 'Loading latest changes'} />}
      {error && <p role="alert">{error}</p>}
      {offer && downloaded && !busy && <p role="status">Download started. You can now load the latest board.</p>}
      {unverified && <p>Check access when your connection is available. Your local version is kept here.</p>}
      <div className="board-recovery__actions">
        {unverified && <button className="djai-primary" disabled={!!busy} onClick={() => { void run('access'); }}>{failed === 'access' ? 'Try checking again' : 'Check access'}</button>}
        {offer ? <>
          {!downloaded && failed !== 'latest' && <button className="djai-primary" disabled={!!busy || unverified} onClick={() => { void run('download'); }}> {failed === 'download' ? 'Retry download' : 'Download local copy'}</button>}
          <button className={downloaded || failed === 'latest' ? 'djai-primary' : undefined} disabled={!!busy || unverified} onClick={() => { void run('latest'); }}><MenuIcon name="refresh" />{failed === 'latest' ? 'Retry loading' : downloaded ? 'Load latest changes' : 'Load latest without download'}</button>
          <button className="djai-ghost" disabled={!!busy} onClick={back}>Back to versions</button>
        </> : <>
          {reason === 'restored' ? <button className="djai-primary" disabled={!!busy || unverified} onClick={() => { void run('restore'); }}>Restore pending edits</button> :
            <button className="djai-primary" disabled={!!busy || unverified} onClick={() => { void run('copy'); }}><MenuIcon name="duplicate" />{failed === 'copy' ? 'Retry copy' : 'Create private copy'}</button>}
          <button disabled={!!busy || unverified} onClick={() => { setOffer(true); setError(''); setFailed(undefined); }}><MenuIcon name="refresh" />Load latest changes</button>
          <button className="djai-ghost" disabled={!!busy} onClick={close}>Decide later</button>
        </>}
      </div>
    </dialog>, document.body)}
  </>;
}
