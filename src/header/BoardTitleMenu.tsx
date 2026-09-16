import { useEffect, useRef, useState } from 'react';
import { BoardActionError, validateBoardTitle } from '../boards/operations';

/** The title edits in place; library navigation has a separate control. */
export function BoardTitleMenu({ title, onRename }: {
  title: string;
  onRename: (title: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);
  const cancelled = useRef(false);
  const composing = useRef(false);
  const [uncertain, setUncertain] = useState(false);
  useEffect(() => setDraft(title), [title]);
  const save = () => {
    if (composing.current) return;
    if (cancelled.current) { cancelled.current = false; return; }
    let clean: string;
    try { clean = validateBoardTitle(draft, title); } catch (cause) { setError((cause as Error).message); return; }
    if (!clean || clean === title) { setDraft(title); return; }
    if (saving.current) return;
    saving.current = true; setBusy(true); setError(null);
    void onRename(clean).then(() => { setDraft(clean); setUncertain(false); })
      .catch((cause: unknown) => { setUncertain(cause instanceof BoardActionError && cause.uncertain); setError(cause instanceof Error ? cause.message : 'Could not save the board name.'); })
      .finally(() => { saving.current = false; setBusy(false); });
  };
  return <div className="board-title-control board-title-inline">
    <input aria-label="Board name" title={title} value={draft} disabled={busy || uncertain}
      style={{ width: `${Math.max(12, Math.min(28, draft.length + 2))}ch` }}
      onFocus={() => { cancelled.current = false; }}
      onChange={event => setDraft(event.target.value)} onBlur={save}
      onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }}
      onKeyDown={event => {
        event.stopPropagation();
        if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.blur(); }
        if (event.key === 'Escape') { event.preventDefault(); cancelled.current = true; setDraft(title); setError(null); event.currentTarget.blur(); }
      }} />
    {error && <p role="alert" className="board-title-error">{error}</p>}
    {busy && <span role="status">Saving name…</span>}
    {uncertain && <button onClick={save} disabled={busy}>Check again</button>}
  </div>;
}
