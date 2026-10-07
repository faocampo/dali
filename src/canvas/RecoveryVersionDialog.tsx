import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createPrivateRecoveryCopy } from '../boards/operations';
import { MenuIcon } from '../header/MenuIcon';
import { restorePendingRecovery } from './runtime';
import './recovery-version.css';

/** Dismissal preserves the candidate. Only an acknowledged operation resolves it. */
export function RecoveryVersionDialog({ reason, onRestored, onCopied }: {
  reason?: 'divergent' | 'unknown' | 'unchanged' | 'restored'; onRestored?: () => void; onCopied?: (boardId: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState<'copy' | 'restore'>(); const busyRef = useRef(false);
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null); const heading = useRef<HTMLHeadingElement>(null); const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (open) { dialog.current?.showModal(); heading.current?.focus({ preventScroll: true }); } }, [open]);
  const close = () => { if (busyRef.current) return; setOpen(false); requestAnimationFrame(() => trigger.current?.focus()); };
  const title = reason === 'divergent' ? 'This board changed while you were away' : reason === 'restored' ? 'Editing access restored' : reason === 'unchanged' ? 'Review your pending changes' : 'Choose a version to recover';
  const run = async (action: 'copy' | 'restore') => {
    if (busyRef.current) return; busyRef.current = true; setBusy(action); setError('');
    try {
      if (action === 'copy') { const copied = await createPrivateRecoveryCopy(); onCopied?.(copied.summary.id); }
      else if (await restorePendingRecovery()) onRestored?.();
    } catch { setError(action === 'copy' ? 'Your private copy could not be created. Your local work is still here.' : 'Your changes could not be recovered. Your local version is still here.'); }
    finally { busyRef.current = false; setBusy(undefined); }
  };
  return <>
    <section className="board-recovery board-recovery--compact" aria-label="Pending local version">
      <button ref={trigger} className="djai-ghost" aria-haspopup="dialog" onClick={() => setOpen(true)}>Review pending changes</button>
    </section>
    {open && createPortal(<dialog ref={dialog} className="session-recovery recovery-version-dialog" aria-labelledby="recovery-version-heading" aria-describedby="recovery-version-description" aria-busy={!!busy}
      onCancel={event => { event.preventDefault(); close(); }} onKeyDown={event => event.stopPropagation()}>
      <h2 ref={heading} id="recovery-version-heading" tabIndex={-1}>{title}</h2>
      <p id="recovery-version-description">{reason === 'restored' ? 'This browser has pending edits. Restore them or load the latest shared board.' : 'Load the latest shared board, or create a private copy with your local changes.'}</p>
      <p>Your local version is kept in this browser. Shared changes are paused until you decide.</p>
      {busy && <p role="status">{busy === 'copy' ? 'Creating private copy…' : 'Checking access before recovering your changes.'}</p>}
      {busy === 'copy' && <progress aria-label="Creating private copy" />}
      {error && <p role="alert">{error}</p>}
      <div className="board-recovery__actions">
        {reason === 'restored' ? <button className="djai-primary" disabled={!!busy} onClick={() => { void run('restore'); }}>Restore pending edits</button> :
          <button className="djai-primary" disabled={!!busy} onClick={() => { void run('copy'); }}><MenuIcon name="duplicate" />{error ? 'Retry copy' : 'Create private copy'}</button>}
        <button disabled><MenuIcon name="refresh" />Load latest changes</button>
        <button disabled={!!busy} onClick={close}>Decide later</button>
      </div>
    </dialog>, document.body)}
  </>;
}
