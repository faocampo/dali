import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export function LeaveRecoveryDialog({ preserved, busy, onStay, onLeave }: { preserved: boolean; busy: boolean; onStay: () => void; onLeave: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null); const stay = useRef<HTMLButtonElement>(null);
  useEffect(() => { dialog.current?.showModal(); stay.current?.focus(); }, []);
  return createPortal(<dialog ref={dialog} className="leave-recovery-dialog" aria-labelledby="leave-recovery-heading" aria-describedby="leave-recovery-description" aria-busy={busy}
    onCancel={event => { event.preventDefault(); if (!busy) onStay(); }}
    onKeyDown={event => {
      event.stopPropagation();
      if (event.key !== 'Tab') return;
      const controls = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
      if (!controls.length) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); }
    }}>
    <h2 id="leave-recovery-heading">Leave with changes waiting to save?</h2>
    <p id="leave-recovery-description">Some changes have not reached the server. Stay to retry or download a recovery copy before leaving.</p>
    {!preserved && <p role="alert">This browser could not preserve all pending changes. Leaving may lose them.</p>}
    {busy && <p role="status">Leaving board…</p>}
    <div className="leave-recovery-actions"><button ref={stay} className="djai-primary" disabled={busy} onClick={onStay}>Stay on board</button><button className="leave-recovery-confirm" disabled={busy} onClick={onLeave}>Leave board</button></div>
  </dialog>, document.body);
}
