import { useEffect, useRef, useState } from 'react';

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
  useEffect(() => setDraft(title), [title]);
  const save = () => {
    if (cancelled.current) { cancelled.current = false; return; }
    const clean = draft.trim();
    if (!clean || clean === title) { setDraft(title); return; }
    if (saving.current) return;
    saving.current = true; setBusy(true); setError(null);
    void onRename(clean).then(() => setDraft(clean))
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not save the board name.'))
      .finally(() => { saving.current = false; setBusy(false); });
  };
  return <div className="board-title-control board-title-inline">
    <input aria-label="Board name" title="Edit board name" value={draft} disabled={busy}
      style={{ width: `${Math.max(12, Math.min(28, draft.length + 2))}ch` }}
      onFocus={() => { cancelled.current = false; }}
      onChange={event => setDraft(event.target.value)} onBlur={save}
      onKeyDown={event => {
        event.stopPropagation();
        if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.blur(); }
        if (event.key === 'Escape') { event.preventDefault(); cancelled.current = true; setDraft(title); setError(null); event.currentTarget.blur(); }
      }} />
    {error && <p role="alert" className="board-title-error">{error}</p>}
  </div>;
}
