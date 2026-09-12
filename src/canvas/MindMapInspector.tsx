import { useEffect, useState } from 'react';
import type { EditorHost } from '@blocksuite/affine/std';
import { GfxControllerIdentifier } from '@blocksuite/affine/std/gfx';
import { addMindmapChild, addMindmapSibling, MINDMAP_EDIT_ERROR, selectedMindmapTopic } from './mindmap';

export function MindMapInspector({ host }: { host: EditorHost }) {
  const [, update] = useState(0);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const sync = () => update(value => value + 1);
    const selection = host.std.get(GfxControllerIdentifier).selection.slots.updated.subscribe(sync);
    const history = host.store.history.onUpdated.subscribe(sync);
    return () => { selection.unsubscribe(); history.unsubscribe(); };
  }, [host]);
  const topic = selectedMindmapTopic(host);
  if (!topic || topic.shape.hidden) return null;
  const parent = topic.map.children.get(topic.shape.id)?.parent;
  const disabled = host.store.readonly || topic.map.isLocked() || topic.shape.isLocked() || topic.gfx.selection.editing;
  const run = (action: (host: EditorHost) => unknown) => {
    try { action(host); setError(null); } catch { setError(MINDMAP_EDIT_ERROR); }
  };
  return <section aria-label="Mind-map topic" onPointerDown={event => event.stopPropagation()}
    style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 12,
      maxWidth: 'calc(100vw - 96px)', maxHeight: '40vh', overflow: 'auto', padding: 8, borderRadius: 8,
      background: 'var(--board-surface)', color: 'var(--board-ink)', boxShadow: 'var(--board-shadow)', fontSize: 12 }}>
    <div role="status">Topic: {topic.shape.text?.toString() || 'Empty topic'}</div>
    <div style={{ display: 'flex', gap: 8 }}>
      <button style={{ minHeight: 44 }} disabled={disabled} onClick={() => run(addMindmapChild)}>Add child</button>
      <button style={{ minHeight: 44 }} disabled={disabled || !parent} aria-describedby={!parent ? 'mindmap-root-hint' : undefined}
        onClick={() => run(addMindmapSibling)}>Add sibling</button>
    </div>
    {!parent && <p id="mindmap-root-hint">The central topic has no sibling. Enter adds a child.</p>}
    <p>Enter finishes editing. Shift+Enter adds a line. Esc returns to topic selection.</p>
    {error && <p role="alert">{error}</p>}
  </section>;
}
