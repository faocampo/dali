import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BoardActionError, validateBoardTitle } from '../boards/operations';

/** A compact title activates its acknowledged inline rename workflow. */
export function BoardTitleMenu({ title, onRename, paused = false }: {
  title: string;
  paused?: boolean;
  onRename: (title: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);
  const closing = useRef(false);
  const cancelled = useRef(false);
  const composing = useRef(false);
  const [uncertain, setUncertain] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const close = () => { closing.current = true; setEditing(false); };
  useEffect(() => { if (!editing) setDraft(title); }, [title, editing]);
  useLayoutEffect(() => {
    if (editing) { input.current?.focus(); input.current?.select(); }
    else if (restoreFocus.current) { restoreFocus.current = false; trigger.current?.focus(); }
  }, [editing]);
  const save = () => {
    if (paused || composing.current || cancelled.current || saving.current || closing.current) return;
    let clean: string;
    try { clean = validateBoardTitle(draft, title); } catch (cause) { setError((cause as Error).message); return; }
    if (!uncertain && (!clean || clean === title)) { setDraft(title); setError(null); close(); return; }
    saving.current = true; setBusy(true); setError(null);
    void onRename(clean).then(() => { setDraft(clean); setUncertain(false); close(); })
      .catch((cause: unknown) => { setUncertain(cause instanceof BoardActionError && cause.uncertain); setError(cause instanceof Error ? cause.message : 'Could not save the board name.'); })
      .finally(() => { saving.current = false; setBusy(false); });
  };
  return <div className="board-title-control board-title-inline">
    {editing ? <input ref={input} aria-label="Board name" aria-describedby={error ? 'board-title-error' : undefined} title={title} value={draft} readOnly={paused || busy || uncertain}
      style={{ width: `${Math.max(8, Math.min(28, draft.length + 2))}ch` }}
      onChange={event => setDraft(event.target.value)} onBlur={() => {
        // Firefox can deliver disabled-input blur after save completion, before
        // React replaces the field. Preserve the closing keyboard focus intent.
        if (closing.current) return;
        if (!saving.current) restoreFocus.current = false;
        save();
      }}
      onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }}
      onKeyDown={event => {
        event.stopPropagation();
        if (event.nativeEvent.isComposing || composing.current) return;
        if (event.key === 'Enter') { event.preventDefault(); restoreFocus.current = true; save(); }
        if (event.key === 'Escape') { event.preventDefault(); cancelled.current = true; restoreFocus.current = true; setDraft(title); setError(null); close(); }
      }} /> : <button ref={trigger} type="button" className="board-title-label" disabled={paused} title={title} aria-label={`Rename board: ${title}`}
      onClick={() => { cancelled.current = false; closing.current = false; restoreFocus.current = false; setDraft(title); setEditing(true); }}>{title}</button>}
    {error && <p id="board-title-error" role="alert" className="board-title-error">{error}</p>}
    {busy && <span role="status">Saving name…</span>}
    {uncertain && <button onClick={save} disabled={busy || paused}>Check again</button>}
  </div>;
}
