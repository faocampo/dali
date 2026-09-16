import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { BoardSummary } from './BoardLibrary';

type Recipient = { memberId?: string; email: string; displayName: string };
type Grant = Recipient & { id: string; role: 'editor' | 'viewer'; status: 'active' | 'pending'; revision: number };
type Access = { revision: number; owner: Recipient; grants: Grant[] };
type Operation = { id: string; method: string; path: string; body: object };
export function ShareBoardDialog({ board, onClose, onChanged }: { board: BoardSummary; onClose: () => void; onChanged: (state?: Access) => void }) {
  const dialog = useRef<HTMLDialogElement>(null); const input = useRef<HTMLInputElement>(null);
  const lifetime = useRef(new AbortController()); const sequence = useRef(0); const loadSequence = useRef(0);
  const operations = useRef(new Map<string, Operation>());
  const [access, setAccess] = useState<Access>(); const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState(''); const [results, setResults] = useState<Recipient[]>([]);
  const [selected, setSelected] = useState<Recipient>(); const [role, setRole] = useState<'viewer' | 'editor'>('viewer');
  const [expanded, setExpanded] = useState(false); const [highlight, setHighlight] = useState(0);
  const [searching, setSearching] = useState(false); const [searchError, setSearchError] = useState(false);
  const [searchVersion, setSearchVersion] = useState(0);
  const [busy, setBusy] = useState<Record<string, boolean>>({}); const [errors, setErrors] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, 'viewer' | 'editor'>>({});
  const [confirm, setConfirm] = useState<Grant>(); const keep = useRef<HTMLButtonElement>(null);
  const [linkFallback, setLinkFallback] = useState(false); const [notice, setNotice] = useState('');
  const headers = { 'X-Dali-Account': board.accountId, 'X-Dali-Request': '1', 'Content-Type': 'application/json' };
  const path = '/api/boards/' + encodeURIComponent(board.id) + '/grants';
  const load = async () => {
    const current = ++loadSequence.current;
    try {
      const response = await fetch(path, { headers, signal: lifetime.current.signal, cache: 'no-store' });
      if ([401, 403, 404, 409].includes(response.status)) { onChanged(); onClose(); return; }
      if (!response.ok) throw new Error();
      const state = await response.json() as Access;
      if (!lifetime.current.signal.aborted && current === loadSequence.current) { setAccess(state); setLoadError(''); onChanged(state); }
    } catch { if (!lifetime.current.signal.aborted) setLoadError("We couldn't load access. Try again."); }
  };
  useEffect(() => {
    lifetime.current = new AbortController(); const previous = document.activeElement; const panel = dialog.current!;
    panel.showModal(); input.current?.focus(); void load();
    return () => { lifetime.current.abort(); panel.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
    // This dialog is keyed by board and account by its caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (confirm) keep.current?.focus(); }, [confirm]);
  useEffect(() => {
    const current = ++sequence.current; const controller = new AbortController();
    setResults([]); setSearchError(false); setSearching(!!query.trim() && !selected);
    if (!query.trim() || selected) return () => controller.abort();
    const timer = window.setTimeout(() => {
      void fetch('/api/members?boardId=' + encodeURIComponent(board.id) + '&q=' + encodeURIComponent(query), { headers, signal: controller.signal, cache: 'no-store' })
        .then(async response => {
          if (!response.ok) throw new Error();
          const data = await response.json() as { members: Recipient[]; pendingEmail: string | null };
          if (controller.signal.aborted || current !== sequence.current) return;
          const choices = [...data.members];
          if (data.pendingEmail && !choices.some(row => row.email === data.pendingEmail)) choices.push({ email: data.pendingEmail, displayName: data.pendingEmail });
          setResults(choices); setHighlight(0); setExpanded(true);
        }).catch(() => { if (!controller.signal.aborted && current === sequence.current) setSearchError(true); })
        .finally(() => { if (!controller.signal.aborted && current === sequence.current) setSearching(false); });
    }, 180);
    return () => { clearTimeout(timer); controller.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, selected, searchVersion]);
  const choose = (recipient: Recipient) => {
    setSelected(recipient); setRole('viewer'); setExpanded(false); setQuery(recipient.email);
    const existing = access?.grants.find(row => recipient.memberId ? row.memberId === recipient.memberId : row.email === recipient.email);
    if (existing) { setNotice('This recipient already has access. Use their access row.'); dialog.current?.querySelector<HTMLElement>('[data-grant-id="' + existing.id + '"] button')?.focus(); }
  };
  const mutate = async (key: string, method: string, target: string, body: object) => {
    if (busy[key]) return;
    setBusy(value => ({ ...value, [key]: true })); setErrors(value => ({ ...value, [key]: '' }));
    const controller = lifetime.current;
    const reconcile = async (operation: Operation) => {
      const response = await fetch('/api/operations/' + operation.id, { headers, cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error('Unable to check access. Try again.');
      const result = await response.json() as { status: string };
      if (!['completed', 'unknown'].includes(result.status)) throw new Error('Access is still being checked. Try again.');
      return result.status === 'completed';
    };
    try {
      let operation = operations.current.get(key); let completed = false;
      if (operation) completed = await reconcile(operation);
      else { operation = { id: crypto.randomUUID(), method, path: target, body }; operations.current.set(key, operation); }
      if (!completed) {
        const timeout = new AbortController(); const abort = () => timeout.abort();
        const timer = window.setTimeout(abort, 10000); controller.signal.addEventListener('abort', abort, { once: true });
        try {
          const response = await fetch(operation.path, { method: operation.method, headers, signal: timeout.signal, body: JSON.stringify({ ...operation.body, operationId: operation.id }) });
          if ([401, 403, 404].includes(response.status)) { operations.current.delete(key); onChanged(); onClose(); return; }
          if (response.status === 409 || response.status === 400) {
            operations.current.delete(key); await load(); throw new Error(response.status === 409 ? 'Access changed. Review current access and try again.' : 'Choose an eligible internal recipient and try again.');
          }
          if (!response.ok) throw new Error("We couldn't update access. Try again.");
          completed = true;
        } catch (cause) {
          if (controller.signal.aborted) return;
          if (operations.current.has(key)) completed = await reconcile(operation);
          if (!completed) throw cause;
        } finally { clearTimeout(timer); controller.signal.removeEventListener('abort', abort); }
      }
      if (controller.signal.aborted) return;
      operations.current.delete(key); await load();
      setNotice('Access updated.'); setDrafts(value => { const next = { ...value }; delete next[key]; return next; });
      if (key === 'new') { setSelected(undefined); setQuery(''); setRole('viewer'); }
      if (operation.method === 'DELETE') { setConfirm(undefined); input.current?.focus(); }
    } catch (cause) { if (!controller.signal.aborted) setErrors(value => ({ ...value, [key]: cause instanceof Error ? cause.message : "We couldn't update access. Try again." })); }
    finally { if (!controller.signal.aborted) setBusy(value => ({ ...value, [key]: false })); }
  };
  const link = window.location.origin + '/?board=' + encodeURIComponent(board.id);
  const duplicate = selected && (selected.memberId === access?.owner.memberId || access?.grants.some(row => selected.memberId ? row.memberId === selected.memberId : row.email === selected.email));
  return createPortal(<dialog ref={dialog} className="djai-panel share-dialog" aria-label="Share board" onCancel={event => { event.preventDefault(); if (expanded) setExpanded(false); else if (confirm) setConfirm(undefined); else onClose(); }} onKeyDown={event => {
    event.stopPropagation();
    if (event.key === 'Tab') {
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button,input,select,[tabindex]')).filter(node => node.tabIndex >= 0 && !node.matches(':disabled') && node.getClientRects().length);
      if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); }
    }
  }}>
    <header className="djai-panel-head"><h2>Share board</h2><button className="djai-close" aria-label="Close" onClick={onClose}>×</button></header>
    <div className="share-dialog__body">
      <h3>{board.title}</h3><p>Current account: {access?.owner.email ?? 'Loading account…'}</p>
      {loadError && <div role="alert">{loadError}<button onClick={() => void load()}>Try again</button></div>}
      {!access && !loadError && <p role="status">Loading access…</p>}
      <label htmlFor="share-member">Internal member or email</label>
      <input ref={input} id="share-member" disabled={operations.current.has('new')} role="combobox" aria-autocomplete="list" aria-expanded={expanded && results.length > 0} aria-controls="share-results" aria-activedescendant={expanded && results[highlight] ? 'share-result-' + highlight : undefined} aria-describedby="share-reason" value={query} maxLength={254} onChange={event => { setQuery(event.target.value); setSelected(undefined); setExpanded(false); }} onKeyDown={event => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === 'Escape' && expanded) { event.preventDefault(); event.stopPropagation(); setExpanded(false); }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setExpanded(true); setHighlight(value => Math.max(0, Math.min(results.length - 1, value + (event.key === 'ArrowDown' ? 1 : -1)))); }
        if (event.key === 'Enter') { event.preventDefault(); if (expanded && results[highlight]) choose(results[highlight]!); }
      }} />
      {searching && <p role="status">Searching members…</p>}
      {searchError && <p role="alert">We couldn't search members. <button onClick={() => setSearchVersion(value => value + 1)}>Try search again</button></p>}
      {expanded && <ul id="share-results" role="listbox" aria-label="Internal members">{results.map((recipient, index) => <li id={'share-result-' + index} key={recipient.memberId ?? recipient.email} role="option" aria-selected={highlight === index} onMouseDown={event => event.preventDefault()} onClick={() => choose(recipient)}>{recipient.displayName} — {recipient.email} {recipient.memberId ? '' : '— Pending member sign-in'}</li>)}</ul>}
      <p id="share-reason">{duplicate ? 'This recipient already has access. Use their access row.' : selected ? (selected.memberId ? 'Established internal member' : 'Pending member sign-in') : !query ? 'Search for a member or enter an internal email.' : searching ? 'Checking recipient…' : !results.length ? 'No matching members. Enter an eligible internal email.' : 'Select a recipient to grant access.'}</p>
      <label>New recipient role<select disabled={operations.current.has('new')} value={role} onChange={event => setRole(event.target.value as 'viewer' | 'editor')}><option value="viewer">Viewer</option><option value="editor">Editor</option></select></label>
      <button className="djai-primary" disabled={!access || !selected || !!duplicate || busy.new} onClick={() => void mutate('new', 'POST', path, { revision: access!.revision, ...(selected!.memberId ? { memberId: selected!.memberId } : { email: selected!.email }), role })}>{busy.new ? 'Granting access…' : 'Grant access'}</button>
      {errors.new && <p role="alert">{errors.new}</p>}
      {access && <><div className="share-owner"><strong>{access.owner.displayName}</strong><span>{access.owner.email}</span><span>Owner</span></div>
        {access.grants.length === 0 && <p>Only you have access</p>}
        {access.grants.map(row => <div className="share-row" data-grant-id={row.id} key={row.id} aria-busy={busy[row.id] || false}>
          <strong>{row.displayName}</strong><span>{row.email}</span><span>{row.role === 'editor' ? 'Editor' : 'Viewer'}</span><span>{row.status === 'pending' ? 'Pending member sign-in' : 'Active'}</span>
          <label>Access role<select aria-label="Access role" value={drafts[row.id] ?? row.role} disabled={busy[row.id] || operations.current.has(row.id)} onChange={event => setDrafts(value => ({ ...value, [row.id]: event.target.value as 'viewer' | 'editor' }))}><option value="viewer">Viewer</option><option value="editor">Editor</option></select></label>
          <button disabled={busy[row.id] || operations.current.has(row.id)} onClick={() => void mutate(row.id, 'PATCH', path + '/' + row.id, { revision: row.revision, role: drafts[row.id] ?? row.role })}>{busy[row.id] ? 'Saving access…' : 'Save access'}</button>
          <button disabled={busy[row.id] || operations.current.has(row.id)} onClick={() => setConfirm(row)}>Revoke access</button>
          {errors[row.id] && operations.current.has(row.id) && <button disabled={busy[row.id]} onClick={() => { const operation = operations.current.get(row.id)!; void mutate(row.id, operation.method, operation.path, operation.body); }}>Check access</button>}
          {errors[row.id] && <p role="alert">{errors[row.id]}</p>}
        </div>)}
      </>}
      {confirm && <section className="share-confirm" role="alertdialog" aria-label="Revoke access" aria-describedby="revoke-description"><p id="revoke-description">Revoke access for {confirm.email}? {confirm.status === 'pending' ? 'They will no longer gain access when they sign in.' : 'They will lose access to this board.'}</p><button ref={keep} onClick={() => { setConfirm(undefined); input.current?.focus(); }}>Keep access</button><button disabled={busy[confirm.id]} onClick={() => void mutate(confirm.id, 'DELETE', path + '/' + confirm.id, { revision: confirm.revision })}>Confirm revoke</button></section>}
    </div>
    <footer className="export-footer"><div role="status">{notice}</div><button onClick={() => { void navigator.clipboard.writeText(link).then(() => setNotice('Board link copied. Access is unchanged.')).catch(() => setLinkFallback(true)); }}>Copy board link</button>{linkFallback && <label>Board link<input readOnly value={link} onFocus={event => event.target.select()} /></label>}</footer>
  </dialog>, document.body);
}
