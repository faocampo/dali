import { useEffect, useRef, useState } from 'react';

export function BoardTitleMenu({ title, onRename, onOpenBoards }: {
  title: string;
  onRename: (title: string) => Promise<void>;
  onOpenBoards: () => void;
}) {
  const [view, setView] = useState<'closed' | 'menu' | 'rename'>('closed');
  const [draft, setDraft] = useState(title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const saving = useRef(false);
  const close = () => { setView('closed'); trigger.current?.focus(); };

  useEffect(() => {
    if (view === 'closed') return;
    if (view === 'rename') { input.current?.focus(); input.current?.select(); }
    else root.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    const outside = (event: PointerEvent) => {
      if (!saving.current && !root.current?.contains(event.target as Node)) setView('closed');
    };
    document.addEventListener('pointerdown', outside, true);
    return () => document.removeEventListener('pointerdown', outside, true);
  }, [view]);

  return <div className="board-title-control" ref={root} onKeyDown={event => {
    // Header editing must never reach canvas shortcuts.
    event.stopPropagation();
    if (event.key === 'Escape' && !saving.current) { event.preventDefault(); close(); }
    if (view === 'menu' && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const items = [...root.current!.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
      const current = items.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (current + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length;
      items[next]?.focus();
    }
  }}>
    <button ref={trigger} type="button" className="djai-board-switcher" aria-haspopup="menu" aria-expanded={view !== 'closed'}
      onClick={() => { if (!saving.current) setView(view === 'closed' ? 'menu' : 'closed'); }}>
      <span>{title}</span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" /></svg>
    </button>
    {view === 'menu' && <div className="board-title-popover" role="menu" aria-label="Board options">
      <button type="button" role="menuitem" onClick={() => { setDraft(title); setError(null); setView('rename'); }}>Rename board</button>
      <button type="button" role="menuitem" onClick={onOpenBoards}>All boards</button>
    </div>}
    {view === 'rename' && <form className="board-title-popover" role="dialog" aria-label="Rename board" aria-busy={busy} onSubmit={event => {
      event.preventDefault();
      const clean = draft.trim();
      if (!clean || saving.current) return;
      saving.current = true; setBusy(true); setError(null);
      void onRename(clean).then(close).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not rename this board.'))
        .finally(() => { saving.current = false; setBusy(false); });
    }}>
      <label htmlFor="board-title-input">Board name</label>
      <input id="board-title-input" ref={input} value={draft} disabled={busy} onChange={event => setDraft(event.target.value)} required />
      {error && <p role="alert">{error}</p>}
      <div className="board-title-actions">
        <button type="button" className="djai-ghost" disabled={busy} onClick={close}>Cancel</button>
        <button type="submit" className="djai-primary" disabled={busy || !draft.trim()}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
    </form>}
  </div>;
}
