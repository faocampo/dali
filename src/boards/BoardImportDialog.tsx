import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { SessionDescriptor } from '../auth/AuthBoundary';
import { getSessionState } from '../auth/session';
import { MenuIcon } from '../header/MenuIcon';
import type { BoardDescriptor } from './BoardLibrary';
import { captureArchive, LocalBoardCopy, LocalCopyOutcomeUnknown } from './import-local';

/** Import one exported board into a new, privately owned account canvas. */
export function BoardImportDialog({ member, onClose, onImported }: {
  member: SessionDescriptor; onClose: () => void; onImported: (board: BoardDescriptor) => void;
}) {
  const panel = useRef<HTMLDialogElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const choose = useRef<HTMLButtonElement>(null);
  const alive = useRef(false);
  const submitting = useRef(false);
  const operation = useRef<LocalBoardCopy>();
  const [file, setFile] = useState<File>();
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<BoardDescriptor>();
  const authorized = () => {
    const session = getSessionState();
    return alive.current && session.phase === 'authenticated' && session.member?.accountId === member.accountId
      && session.member.systemRole !== 'viewer' && session.member.expiresAt > Date.now();
  };
  useEffect(() => {
    alive.current = true; const dialog = panel.current!; const previous = document.activeElement;
    dialog.showModal(); choose.current?.focus();
    return () => { alive.current = false; dialog.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, []);
  const locked = busy || uncertain || !!result;
  const selectFile = (files: File[]) => {
    if (locked || submitting.current || !authorized()) return;
    setError(''); setDragging(false); operation.current = undefined; setFile(undefined);
    if (files.length !== 1) { setError('Choose one board file at a time.'); return; }
    const selected = files[0]!;
    if (!/\.zip$/i.test(selected.name)) { setError('Choose an exported Dalí board (.zip), including its images.'); return; }
    if (!selected.size || selected.size > 32 * 1024 * 1024) { setError('Choose a non-empty board file up to 32 MB.'); return; }
    setFile(selected);
  };
  const submit = async () => {
    if (!file || submitting.current || result || !authorized()) return;
    submitting.current = true; setBusy(true); setError('');
    try {
      if (!operation.current) {
        const title = [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(file.name.replace(/(?:\.bs)?\.zip$/i, '').trim() || 'Imported board')].slice(0, 200).map(part => part.segment).join('');
        operation.current = new LocalBoardCopy(member.accountId, { id: crypto.randomUUID(), title, updatedAt: Date.now() }, crypto.randomUUID(),
          () => captureArchive(file), () => { if (!authorized()) throw new Error('Sign in with the original account to import this board.'); });
      }
      const imported = await operation.current.run();
      if (authorized()) { setResult(imported); setUncertain(false); onImported(imported); }
    } catch (cause) {
      if (authorized()) {
        setUncertain(cause instanceof LocalCopyOutcomeUnknown || uncertain);
        setError(cause instanceof LocalCopyOutcomeUnknown ? 'The import result could not be confirmed. Check again before closing to avoid creating another board.'
          : cause instanceof Error ? cause.message : 'This board could not be imported. Try again.');
      }
    } finally { submitting.current = false; if (alive.current) setBusy(false); }
  };
  const close = () => { if (!submitting.current && !uncertain) onClose(); };
  return createPortal(<dialog ref={panel} className="board-import-dialog" aria-labelledby="board-import-title" onCancel={event => { event.preventDefault(); close(); }} onDragOver={event => event.preventDefault()} onDrop={event => event.preventDefault()}>
    <header><div><h2 id="board-import-title">Import board</h2><p>Create a new canvas from an exported board.</p></div>
      <button type="button" className="board-import-dialog__close" aria-label="Close import" disabled={busy || uncertain} onClick={close}><MenuIcon name="close" /></button></header>
    <div className="board-import-dialog__body">
      {result ? <div className="board-import-success"><MenuIcon name="check" /><h3>{result.summary.title}</h3><p>Your new private board is ready.</p></div> : <>
        <button ref={choose} type="button" className="board-import-dropzone" data-dragging={dragging || undefined} aria-label="Choose board file" aria-describedby="board-import-formats" disabled={locked}
          onClick={() => picker.current?.click()} onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = locked ? 'none' : 'copy'; if (!locked) setDragging(true); }}
          onDragLeave={event => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
          onDrop={event => { event.preventDefault(); setDragging(false); selectFile([...event.dataTransfer.files]); }}>
          <MenuIcon name={file ? 'File' : 'import'} /><strong>{file ? file.name : 'Drop a board file here'}</strong>
          <span>{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB · Choose another file` : 'or choose a file'}</span>
        </button>
        <p id="board-import-formats" className="board-import-hint">Dalí board archive (.zip) · Up to 32 MB</p>
        <input ref={picker} type="file" accept=".zip,application/zip" hidden onChange={event => { const files = [...(event.target.files ?? [])]; event.target.value = ''; if (files.length) selectFile(files); }} />
      </>}
      {error && <p role="alert">{error}</p>}
      <p role="status" aria-live="polite">{busy ? 'Importing your board…' : result ? 'Board imported.' : file ? 'Ready to import.' : ''}</p>
    </div>
    <footer><button type="button" disabled={busy || uncertain} onClick={close}>Close</button>
      {result ? <a className="djai-primary" href={'/?board=' + encodeURIComponent(result.summary.id)}><MenuIcon name="boards" />Open board</a>
        : <button type="button" className="djai-primary" disabled={!file || busy} onClick={() => void submit()}><MenuIcon name={uncertain ? 'refresh' : 'import'} />{busy ? 'Importing…' : uncertain ? 'Check import again' : 'Import board'}</button>}
    </footer>
  </dialog>, document.body);
}
