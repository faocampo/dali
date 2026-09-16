import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { BoardSummary, BoardDescriptor } from './BoardLibrary';
import { AccountBoardAction, BoardActionError, validateBoardTitle } from './operations';

export function BoardActionDialog({ board, kind, onClose, onComplete }: {
  board: BoardSummary; kind: 'rename' | 'duplicate' | 'delete'; onClose: () => void;
  onComplete: (result: BoardDescriptor & { deleted?: boolean; boardId?: string }) => void;
}) {
  const panel = useRef<HTMLDialogElement>(null); const initial = useRef<HTMLButtonElement>(null);
  const action = useRef<AccountBoardAction>(); const submitting = useRef(false);
  const [draft, setDraft] = useState(kind === 'duplicate' ? board.title + ' (copy)' : board.title);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [uncertain, setUncertain] = useState(false);
  useEffect(() => { const dialog = panel.current!; const previous = document.activeElement; dialog.showModal(); if (kind === 'delete') initial.current?.focus();
    return () => { dialog.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); }; }, [kind]);
  const submit = async () => {
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setError('');
    try {
      if (!action.current) { if (kind !== 'delete') validateBoardTitle(draft, board.title); action.current = new AccountBoardAction(board.accountId, board.id, kind); }
      if (uncertain) {
        const known = await action.current.check();
        if (known.status === 'completed') { onComplete(known.result!); return; }
        setUncertain(false); setError('No completed change was found. You can retry this request.'); return;
      }
      onComplete(await action.current.run(draft));
    } catch (cause) {
      const unknown = cause instanceof BoardActionError && cause.uncertain; setUncertain(unknown);
      if (!unknown) action.current = undefined;
      setError(cause instanceof Error ? cause.message : 'This change could not be saved. Try again.');
    } finally { submitting.current = false; setBusy(false); }
  };
  const heading = kind === 'delete' ? 'Delete board' : kind === 'rename' ? 'Rename board' : 'Duplicate board';
  return createPortal(<dialog ref={panel} className="board-action-dialog" aria-labelledby="board-action-heading" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <form onSubmit={event => { event.preventDefault(); void submit(); }}>
      <h2 id="board-action-heading">{heading}</h2><p>{board.title}</p>
      {kind === 'delete' ? <p>Delete this board and its documents, images and sharing access?</p> : <label>Board name<input aria-label="Board name" value={draft} disabled={busy || uncertain} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.nativeEvent.isComposing && event.key === 'Enter') event.preventDefault(); }} /></label>}
      {busy && <p role="status">{kind === 'rename' ? 'Saving name…' : kind === 'delete' ? 'Deleting board…' : 'Copying board…'}</p>}
      {error && <p role="alert">{error}</p>}
      <div className="board-action-dialog__actions"><button ref={initial} type="button" disabled={busy} onClick={onClose}>{kind === 'rename' ? 'Keep name' : 'Keep board'}</button>
        <button type="submit" disabled={busy}>{uncertain ? 'Check again' : kind === 'rename' ? 'Save name' : heading}</button></div>
    </form>
  </dialog>, document.body);
}
