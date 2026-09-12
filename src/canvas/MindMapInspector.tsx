import { useEffect, useState } from 'react';
import type { EditorHost } from '@blocksuite/affine/std';
import { GfxControllerIdentifier } from '@blocksuite/affine/std/gfx';
import { addMindmapChild, addMindmapSibling, arrangeMindmap, setMindmapLayout, installMindmapHierarchy, MINDMAP_EDIT_ERROR, MINDMAP_LAYOUT_ERROR, selectedMindmapTopic, toggleMindmapBranch } from './mindmap';

export function MindMapInspector({ host }: { host: EditorHost }) {
  const [, update] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  useEffect(() => installMindmapHierarchy(host, () => setError(MINDMAP_EDIT_ERROR), message => {
    setAnnouncement(message); update(value => value + 1);
  }), [host]);
  useEffect(() => {
    const sync = () => update(value => value + 1);
    const selection = host.std.get(GfxControllerIdentifier).selection.slots.updated.subscribe(sync);
    const history = host.store.history.onUpdated.subscribe(sync);
    return () => { selection.unsubscribe(); history.unsubscribe(); };
  }, [host]);
  const topic = selectedMindmapTopic(host);
  if (!topic || topic.shape.hidden) return null;
  const parent = topic.map.children.get(topic.shape.id)?.parent;
  const count = [...topic.map.children.values()].filter(detail => detail.parent === topic.shape.id).length;
  const collapsed = topic.map.children.get(topic.shape.id)?.collapsed ?? false;
  const disabled = host.store.readonly || topic.map.isLocked() || topic.shape.isLocked() || topic.gfx.selection.editing;
  const run = (action: (host: EditorHost) => unknown, message = MINDMAP_EDIT_ERROR) => {
    try { action(host); setError(null); update(value => value + 1); } catch { setError(message); }
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
      {count > 0 && <button style={{ minHeight: 44 }} disabled={disabled} aria-expanded={!collapsed} aria-pressed={collapsed}
        aria-label={collapsed ? `Expand branch: ${count} direct ${count === 1 ? 'branch' : 'branches'} hidden` : 'Collapse branch'}
        onClick={() => run(toggleMindmapBranch)}>{collapsed ? `Expand branch (${count})` : 'Collapse branch'}</button>}
    </div>
    <div role="group" aria-label="Mind-map layout">
      {(['Right', 'Left', 'Balanced'] as const).map((label, value) => <button key={label}
        disabled={disabled} aria-pressed={topic.map.layoutType === value}
        onClick={() => run(host => setMindmapLayout(host, value), MINDMAP_LAYOUT_ERROR)}>{label}</button>)}
      <button disabled={disabled} onClick={() => run(arrangeMindmap, MINDMAP_LAYOUT_ERROR)}>Arrange mind map</button>
    </div>
    {!parent && <p id="mindmap-root-hint">The central topic has no sibling. Enter adds a child.</p>}
    <p>Enter finishes editing. Shift+Enter adds a line. Esc returns to topic selection.</p>
    {error && <p role="alert">{error}</p>}
    <p aria-live="polite">{announcement}</p>
  </section>;
}
