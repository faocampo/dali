import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { EditorHost } from '@blocksuite/affine/std';
import { GfxControllerIdentifier } from '@blocksuite/affine/std/gfx';
import { addMindmapChild, addMindmapSibling, arrangeMindmap, formatMindmapTopic, readMindmapState, setMindmapStyle, setMindmapLayout, installMindmapHierarchy, MINDMAP_EDIT_ERROR, MINDMAP_LAYOUT_ERROR, selectedMindmapTopic, toggleMindmapBranch } from './mindmap';

export function MindMapInspector({ host }: { host: EditorHost }) {
  const [, update] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [dismissed, setDismissed] = useState<string | null>(null);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => installMindmapHierarchy(host, () => setError(MINDMAP_EDIT_ERROR), message => {
    setAnnouncement(message); update(value => value + 1);
  }), [host]);
  useEffect(() => {
    const sync = () => update(value => value + 1);
    const gfx = host.std.get(GfxControllerIdentifier);
    const selection = gfx.selection.slots.updated.subscribe(() => { setDismissed(null); sync(); });
    const history = host.store.history.onUpdated.subscribe(sync);
    const readonlyChanged = host.store.readonly$.subscribe(sync);
    const changed = gfx.surface?.elementUpdated.subscribe(sync);
    const added = gfx.surface?.elementAdded.subscribe(sync);
    const removed = gfx.surface?.elementRemoved.subscribe(sync);
    return () => { selection.unsubscribe(); history.unsubscribe(); readonlyChanged(); changed?.unsubscribe(); added?.unsubscribe(); removed?.unsubscribe(); };
  }, [host]);
  const topic = selectedMindmapTopic(host);
  const editing = topic?.gfx.selection.editing ?? false;
  useLayoutEffect(() => {
    if (!topic || !panel.current) return;
    const bound = topic.gfx.viewport.toViewBound(topic.shape.elementBound);
    const hostRect = host.getBoundingClientRect();
    const controls = panel.current.getBoundingClientRect();
    // Keep both editing and committed selection clear when the panel expands.
    // Pan only when the actual topic and panel rectangles intersect.
    const left = bound.x + hostRect.left;
    const top = bound.y + hostRect.top;
    const bottom = bound.maxY + hostRect.top;
    if (bound.maxX + hostRect.left > controls.left - 8 && left < controls.right + 8 &&
        bottom > controls.top - 8 && top < controls.bottom + 8) {
      topic.gfx.viewport.setCenter(topic.gfx.viewport.center.x,
        topic.gfx.viewport.center.y + (bottom - controls.top + 16) / topic.gfx.viewport.zoom);
    }
  }, [editing, topic?.shape.id, topic?.shape.xywh]);
  const empty = host.std.get(GfxControllerIdentifier).surface?.elementModels.length === 0;
  if (!topic && empty) return <aside className="mindmap-empty" aria-label="Mind-map guidance">
    <h2>Start a mind map</h2>
    <p>Add a mind map, then name the central topic. Select a topic and press Tab to add a child or Enter to add a sibling.</p>
  </aside>;
  if (!topic || topic.shape.hidden) return null;
  if (dismissed === topic.shape.id) return null;
  const parent = topic.map.children.get(topic.shape.id)?.parent;
  const count = [...topic.map.children.values()].filter(detail => detail.parent === topic.shape.id).length;
  const collapsed = topic.map.children.get(topic.shape.id)?.collapsed ?? false;
  const disabled = host.store.readonly || topic.map.isLocked() || topic.shape.isLocked() || topic.gfx.selection.editing;
  let level = 0;
  try { level = readMindmapState(topic.map).depth.get(topic.shape.id) ?? 0; } catch { /* Commands expose the actionable malformed-state error. */ }
  const parentText = parent ? topic.map.getNode(parent)?.element : undefined;
  const parentLabel = parentText && 'text' in parentText ? String(parentText.text ?? '') || 'Empty topic' : 'Central topic';
  const run = (action: (host: EditorHost) => unknown, message = MINDMAP_EDIT_ERROR) => {
    try { action(host); setError(null); update(value => value + 1); } catch { setError(message); }
  };
  return <section ref={panel} className="mindmap-panel" data-editing={editing} aria-label="Mind-map topic" onPointerDown={event => event.stopPropagation()}>
    <header><h2>Mind map</h2><button aria-label="Close mind-map controls" onClick={() => {
      setDismissed(topic.shape.id); host.tabIndex = -1; host.focus({ preventScroll: true });
    }}>Close</button></header>
    <div role="status">Topic: {topic.shape.text?.toString() || 'Empty topic'}</div>
    <div role="status" className="mindmap-context">Level {level}. {parent ? `Parent: ${parentLabel}.` : 'Central topic.'}</div>
    <div className="mindmap-actions">
      <button style={{ minHeight: 44 }} disabled={disabled} onClick={() => run(addMindmapChild)}>Add child</button>
      <button style={{ minHeight: 44 }} disabled={disabled || !parent} aria-describedby={!parent ? 'mindmap-root-hint' : undefined}
        onClick={() => run(addMindmapSibling)}>Add sibling</button>
      {count > 0 && <button style={{ minHeight: 44 }} disabled={disabled} aria-expanded={!collapsed} aria-pressed={collapsed}
        aria-label={collapsed ? `Expand branch: ${count} direct ${count === 1 ? 'branch' : 'branches'} hidden` : 'Collapse branch'}
        onClick={() => run(toggleMindmapBranch)}>{collapsed ? `Expand branch (${count})` : 'Collapse branch'}</button>}
    </div>
    <div className="mindmap-actions" role="group" aria-label="Mind-map layout">
      {(['Right', 'Left', 'Balanced'] as const).map((label, value) => <button key={label}
        disabled={disabled} aria-pressed={topic.map.layoutType === value}
        onClick={() => run(host => setMindmapLayout(host, value), MINDMAP_LAYOUT_ERROR)}>{label}</button>)}
      <button disabled={disabled} onClick={() => run(arrangeMindmap, MINDMAP_LAYOUT_ERROR)}>Arrange mind map</button>
    </div>
    <fieldset disabled={disabled}>
      <legend>Topic text</legend>
      <label>Font size <input key={`${topic.shape.id}-${topic.shape.fontSize}`} type="number" min="8" max="96"
        defaultValue={topic.shape.fontSize} onBlur={event => run(host => formatMindmapTopic(host, { fontSize: Number(event.target.value) }))} /></label>
      <label>Font weight <select value={topic.shape.fontWeight}
        onChange={event => run(host => formatMindmapTopic(host, { fontWeight: event.target.value }))}>
        <option value="400">Regular</option><option value="600">Semibold</option><option value="700">Bold</option>
      </select></label>
      <label>Text color <input type="color" value={typeof topic.shape.color === 'string' && /^#[0-9a-f]{6}$/i.test(topic.shape.color) ? topic.shape.color : '#000000'}
        onChange={event => run(host => formatMindmapTopic(host, { color: event.target.value }))} /></label>
    </fieldset>
    <div className="mindmap-actions" role="group" aria-label="Mind-map style">
      {[1, 2, 3, 4].map(style => <button key={style} disabled={disabled} aria-pressed={topic.map.style === style}
        onClick={() => run(host => setMindmapStyle(host, style))}>Style {style}</button>)}
    </div>
    {!parent && <p id="mindmap-root-hint">The central topic has no sibling. Enter adds a child.</p>}
    <p>Enter finishes editing. Shift+Enter adds a line. Esc returns to topic selection.</p>
    {error && <p role="alert">{error}</p>}
    <p aria-live="polite">{announcement}</p>
  </section>;
}
