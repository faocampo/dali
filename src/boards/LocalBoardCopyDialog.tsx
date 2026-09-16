import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { SessionDescriptor } from '../auth/session';
import type { BoardDescriptor } from './BoardLibrary';
import { listLocalBoards, LocalBoardCopy, type LocalBoard } from './import-local';

type Row = LocalBoard & { selected: boolean; state: 'Waiting' | 'Copying' | 'Copied' | 'Failed'; result?: BoardDescriptor; error?: string };
export function LocalBoardCopyDialog({ member, onClose }: { member: SessionDescriptor; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [inventoryError, setInventoryError] = useState('');
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(false);
  const operations = useRef(new Map<string, LocalBoardCopy>());
  const alive = useRef(true);
  const load = async () => {
    setLoading(true); setInventoryError('');
    try { const inventory = await listLocalBoards(); if (alive.current) setRows(inventory.map(row => ({ ...row, selected: false, state: 'Waiting' }))); }
    catch { if (alive.current) setInventoryError("We couldn't read local boards. Try again."); }
    finally { if (alive.current) setLoading(false); }
  };
  useEffect(() => {
    alive.current = true; const panel = dialog.current!; const previous = document.activeElement;
    panel.showModal(); void load();
    return () => { alive.current = false; panel.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, []);
  const copy = async () => {
    if (busy) return; setBusy(true); setStarted(true);
    const pending = rows.filter(row => row.selected && row.state !== 'Copied');
    for (const row of pending) {
      if (!alive.current) break;
      let operation = operations.current.get(row.id);
      if (!operation) { operation = new LocalBoardCopy(member.accountId, row); operations.current.set(row.id, operation); }
      setRows(current => current.map(item => item.id === row.id ? { ...item, state: 'Copying', error: undefined } : item));
      try {
        const result = await operation.run();
        if (alive.current) setRows(current => current.map(item => item.id === row.id ? { ...item, state: 'Copied', result } : item));
      } catch (error) {
        if (alive.current) setRows(current => current.map(item => item.id === row.id ? { ...item, state: 'Failed', error: error instanceof Error ? error.message : 'This board could not be copied. Its original is unchanged.' } : item));
      }
    }
    if (alive.current) setBusy(false);
  };
  const selected = rows.filter(row => row.selected); const completed = selected.filter(row => row.state === 'Copied').length;
  const failed = selected.filter(row => row.state === 'Failed').length;
  return createPortal(<dialog ref={dialog} aria-labelledby="local-copy-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <header><h2 id="local-copy-title" tabIndex={-1}>Copy local boards</h2><p>Copy to: {member.email}</p></header>
    <div>
      <p>Select the local boards to copy into this account as private boards. Their titles, content and images will be copied. Originals stay in this browser.</p>
      {loading ? <p role="status">Reading local boards…</p> : inventoryError ? <><p role="alert">{inventoryError}</p><button onClick={() => void load()}>Try again</button></> : rows.length === 0 ? <p>No local boards are available in this browser.</p> : rows.map(row => <section key={row.id} data-local-board={row.id}>
        <label><input type="checkbox" aria-label={row.title} checked={row.selected} disabled={busy || started} onChange={event => setRows(current => current.map(item => item.id === row.id ? { ...item, selected: event.target.checked } : item))} />{row.title}</label>
        <small>Edited {new Date(row.updatedAt).toLocaleString()}</small>
        {row.selected && <p>{row.state}</p>}{row.error && <p role="alert">{row.error}</p>}
        {row.result && <a href={'/?board=' + encodeURIComponent(row.result.summary.id)}>Open {row.result.summary.title}</a>}
      </section>)}
    </div>
    <footer>
      <p role="status">{busy ? `Copying ${completed} of ${selected.length} ${selected.length === 1 ? 'board' : 'boards'}…` : failed ? `${completed} copied; ${failed} could not be copied. Retry the failed boards. Originals remain in this browser.` : started && completed ? `${completed} ${completed === 1 ? 'board' : 'boards'} copied. Originals remain in this browser.` : `${selected.length} ${selected.length === 1 ? 'board' : 'boards'} selected.`}</p>
      <button disabled={!selected.length || busy || completed === selected.length || !!inventoryError} onClick={() => void copy()}>{failed ? 'Retry failed boards' : 'Copy selected boards'}</button>
      <button disabled={busy} onClick={onClose}>Close local copies</button>
    </footer>
  </dialog>, document.body);
}
