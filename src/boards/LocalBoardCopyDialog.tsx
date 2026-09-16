import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getSessionState, subscribeSession, type SessionDescriptor } from '../auth/session';
import type { BoardDescriptor } from './BoardLibrary';
import { listLocalBoards, LocalBoardCopy, LocalCopyOutcomeUnknown, type LocalBoard } from './import-local';

type Row = LocalBoard & { selected: boolean; state: 'Waiting' | 'Copying' | 'Copied' | 'Failed'; operationId?: string; result?: BoardDescriptor; error?: string; uncertain?: boolean };
export function LocalBoardCopyDialog({ member, onClose }: { member: SessionDescriptor; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [inventoryError, setInventoryError] = useState('');
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [closing, setClosing] = useState(false);
  const [batchError, setBatchError] = useState('');
  const stop = useRef(false);
  const closeRequested = useRef(false);
  const alive = useRef(true);
  const key = 'dali-local-copy-intents:' + member.accountId;
  const authorized = () => { const state = getSessionState(); return state.phase === 'authenticated' && state.member?.accountId === member.accountId && state.member.expiresAt > Date.now(); };
  const publish = (next: Row[]) => { if (alive.current) setRows(next); };
  const preserve = (next: Row[]) => { sessionStorage.setItem(key, JSON.stringify(next.filter(row => row.selected))); };
  const load = async () => {
    setLoading(true); setInventoryError('');
    try {
      const inventory = await listLocalBoards();
      const saved: unknown = JSON.parse(sessionStorage.getItem(key) ?? '[]');
      if (!Array.isArray(saved) || saved.some(row => !row || typeof row.id !== 'string' || typeof row.title !== 'string' || !['Waiting', 'Copying', 'Copied', 'Failed'].includes(row.state) || typeof row.operationId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(row.operationId))) throw new Error('Copy recovery is unavailable.');
      const pending = saved as Row[];
      if (alive.current && authorized()) {
        publish(inventory.map(row => {
          const previous = pending.find(item => item.id === row.id);
          return previous ? { ...previous, state: previous.state === 'Copying' ? 'Failed' : previous.state, selected: true } : { ...row, selected: false, state: 'Waiting' };
        }));
        setResuming(pending.length > 0); setStarted(pending.length > 0);
      }
    }
    catch { if (alive.current) setInventoryError("We couldn't read local boards. Try again."); }
    finally { if (alive.current) setLoading(false); }
  };
  useEffect(() => {
    alive.current = true; const panel = dialog.current!; const previous = document.activeElement;
    panel.showModal(); panel.querySelector<HTMLElement>('h2')?.focus(); void load();
    const unsubscribe = subscribeSession(() => { if (!authorized()) { stop.current = true; panel.close(); } });
    return () => { alive.current = false; stop.current = true; unsubscribe(); panel.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, []);
  const copy = async () => {
    if (busy || !authorized()) return; setBusy(true); setStarted(true); setBatchError(''); setResuming(false);
    stop.current = false;
    let batch = rows.map(row => row.selected ? { ...row, operationId: row.operationId ?? crypto.randomUUID() } : row);
    try {
      preserve(batch); publish(batch);
      for (const row of batch.filter(row => row.selected && row.state !== 'Copied')) {
        if (!alive.current || stop.current || !authorized()) break;
        const update = (change: Partial<Row>) => { batch = batch.map(item => item.id === row.id ? { ...item, ...change } : item); preserve(batch); publish(batch); };
        update({ state: 'Copying', error: undefined });
        try { const result = await new LocalBoardCopy(member.accountId, row, row.operationId!).run(); update({ state: 'Copied', result, uncertain: false }); }
        catch (error) { update({ state: 'Failed', uncertain: error instanceof LocalCopyOutcomeUnknown || row.uncertain, error: error instanceof Error ? error.message : 'This board could not be copied. Its original is unchanged.' }); }
      }
      if (batch.filter(row => row.selected).every(row => row.state === 'Copied')) sessionStorage.removeItem(key);
    } catch { if (alive.current) setBatchError('Copy progress could not be secured. Keep this tab open and retry. Originals remain in this browser.'); }
    finally {
      if (alive.current) {
        setBusy(false);
        if (closeRequested.current && authorized() && !batch.some(row => row.uncertain)) onClose();
        else { setClosing(false); closeRequested.current = false; }
      }
    }
  };
  const requestClose = () => { if (busy) { closeRequested.current = true; stop.current = true; setClosing(true); } else if (!rows.some(row => row.uncertain)) onClose(); };
  const selected = rows.filter(row => row.selected); const completed = selected.filter(row => row.state === 'Copied').length;
  const failed = selected.filter(row => row.state === 'Failed').length;
  return createPortal(<dialog ref={dialog} className="local-copy-dialog" aria-labelledby="local-copy-title" onCancel={event => { event.preventDefault(); requestClose(); }} onKeyDown={event => {
    if (event.key !== 'Tab' || event.nativeEvent.isComposing) return;
    const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href]')];
    const first = controls[0]; const last = controls.at(-1);
    if (event.shiftKey && (document.activeElement === first || document.activeElement?.tagName === 'H2')) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }}>
    <header><h2 id="local-copy-title" tabIndex={-1}>Copy local boards</h2><p>Copy to: {member.email}</p></header>
    <div className="local-copy-dialog__body">
      <p>Select the local boards to copy into this account as private boards. Their titles, content and images will be copied. Originals stay in this browser.</p>
      {loading ? <p role="status">Reading local boards…</p> : inventoryError ? <><p role="alert">{inventoryError}</p><button onClick={() => void load()}>Try again</button></> : rows.length === 0 ? <p>No local boards are available in this browser.</p> : rows.map(row => <section key={row.id} data-local-board={row.id}>
        <label><input type="checkbox" aria-label={row.title} checked={row.selected} disabled={busy || started} onChange={event => publish(rows.map(item => item.id === row.id ? { ...item, selected: event.target.checked } : item))} /><span>{row.title}</span></label>
        <small>Edited {new Date(row.updatedAt).toLocaleString()}</small>
        {row.selected && <p>{row.state}</p>}{row.error && <p role="alert">{row.error}</p>}
        {row.result && <a href={'/?board=' + encodeURIComponent(row.result.summary.id)}>Open {row.result.summary.title}</a>}
      </section>)}
    </div>
    <footer>
      {batchError && <p role="alert">{batchError}</p>}
      <p role="status">{closing ? 'Finishing the current copy before closing…' : busy ? `Copying ${completed} of ${selected.length} ${selected.length === 1 ? 'board' : 'boards'}…` : failed ? `${completed} copied; ${failed} could not be copied. Retry the failed boards. Originals remain in this browser.` : started && completed ? `${completed} ${completed === 1 ? 'board' : 'boards'} copied. Originals remain in this browser.` : `${selected.length} ${selected.length === 1 ? 'board' : 'boards'} selected.`}</p>
      <div><button className="djai-primary" disabled={!selected.length || busy || completed === selected.length || !!inventoryError} onClick={() => void copy()}>{resuming ? 'Resume copies' : failed ? 'Retry failed boards' : 'Copy selected boards'}</button>
      <button disabled={closing || (!busy && rows.some(row => row.uncertain))} onClick={requestClose}>Close local copies</button></div>
    </footer>
  </dialog>, document.body);
}
