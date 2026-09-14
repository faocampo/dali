import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { EditorHost } from '@blocksuite/affine/std';
import { GfxControllerIdentifier } from '@blocksuite/affine/std/gfx';
import { addMindmapChild, addMindmapSibling, arrangeMindmap, formatMindmapTopic, readMindmapState, setMindmapStyle, setMindmapLayout, installMindmapHierarchy, MINDMAP_EDIT_ERROR, MINDMAP_LAYOUT_ERROR, selectedMindmapTopic, toggleMindmapBranch } from './mindmap';

export function MindMapInspector({ host }: { host: EditorHost }) {
  const [, update] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => installMindmapHierarchy(host, () => setError(MINDMAP_EDIT_ERROR), message => {
    setAnnouncement(message); update(value => value + 1);
  }), [host]);
  useEffect(() => {
    const sync = () => update(value => value + 1);
    const gfx = host.std.get(GfxControllerIdentifier);
    setOpen(false);
    const show = () => { if (host.isConnected && selectedMindmapTopic(host) && !gfx.selection.editing) setOpen(true); };
    host.addEventListener('dali:mindmap-properties', show);
    const selection = gfx.selection.slots.updated.subscribe(() => {
      if (!selectedMindmapTopic(host) || gfx.selection.editing) setOpen(false);
      sync();
    });
    const history = host.store.history.onUpdated.subscribe(sync);
    const readonlyChanged = host.store.readonly$.subscribe(sync);
    const changed = gfx.surface?.elementUpdated.subscribe(sync);
    const added = gfx.surface?.elementAdded.subscribe(sync);
    const removed = gfx.surface?.elementRemoved.subscribe(sync);
    return () => { host.removeEventListener('dali:mindmap-properties', show); selection.unsubscribe(); history.unsubscribe(); readonlyChanged(); changed?.unsubscribe(); added?.unsubscribe(); removed?.unsubscribe(); };
  }, [host]);
  const topic = selectedMindmapTopic(host);
  const editing = topic?.gfx.selection.editing ?? false;
  useLayoutEffect(() => {
    if (!topic || !panel.current) return;
    const bound = topic.gfx.viewport.toViewBound(topic.shape.elementBound);
    const hostRect = host.getBoundingClientRect();
    const controls = panel.current.getBoundingClientRect();
    // Keep the selected topic clear of the explicitly opened right sidebar.
    const left = bound.x + hostRect.left;
    const top = bound.y + hostRect.top;
    let nextLeft = Math.min(Math.max(left, hostRect.left + 8), Math.max(hostRect.left + 8, hostRect.right - bound.w - 8));
    let nextTop = Math.min(Math.max(top, hostRect.top + 8), Math.max(hostRect.top + 8, hostRect.bottom - bound.h - 8));
    if (nextLeft + bound.w > controls.left - 8 && nextLeft < controls.right + 8 &&
        nextTop + bound.h > controls.top - 8 && nextTop < controls.bottom + 8) {
      if (bound.w + 24 <= controls.left - hostRect.left) {
        nextLeft = controls.left - bound.w - 16;
      } else {
        nextTop = Math.min(controls.bottom + 16, hostRect.bottom - bound.h - 8);
      }
    }
    if (nextLeft !== left || nextTop !== top) topic.gfx.viewport.setCenter(
      topic.gfx.viewport.center.x + (left - nextLeft) / topic.gfx.viewport.zoom,
      topic.gfx.viewport.center.y + (top - nextTop) / topic.gfx.viewport.zoom);
  }, [open, editing, topic?.shape.id, topic?.shape.xywh]);
  useEffect(() => { if (open) panel.current?.querySelector<HTMLButtonElement>('.selection-inspector__close')?.focus(); }, [open]);
  const empty = host.std.get(GfxControllerIdentifier).surface?.elementModels.length === 0;
  if (!topic && empty) return <aside className="mindmap-empty" aria-label="Mind-map guidance">
    <h2>Start a mind map</h2>
    <p>Add a mind map, then name the central topic. Select a topic and press Tab to add a child or Enter to add a sibling.</p>
  </aside>;
  const feedback = <div className="mindmap-feedback">
    {error && <p role="alert">{error}</p>}
    <p className="sr-only" aria-live="polite">{announcement}</p>
    {!open && topic && <p className="sr-only" role="status">Topic: {topic.shape.text?.toString() || 'Empty topic'}</p>}
  </div>;
  if (!topic || topic.shape.hidden || editing || !open) return feedback;
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
  return <><section ref={panel} className="selection-inspector mindmap-panel" data-editing={editing} aria-label="Mind-map topic" onPointerDown={event => event.stopPropagation()}
    onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape') { event.preventDefault(); setOpen(false); host.tabIndex = -1; host.focus({ preventScroll: true }); } }}>
    <header className="selection-inspector__head"><div><span className="selection-inspector__eyebrow">Properties</span><h2>Mind map</h2></div><button className="selection-inspector__close" aria-label="Close mind-map controls" onClick={() => {
      setOpen(false); host.tabIndex = -1; host.focus({ preventScroll: true });
    }}>×</button></header>
    <div className="selection-inspector__body">
    <div>Topic: {topic.shape.text?.toString() || 'Empty topic'}</div>
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
    </div>
  </section>{feedback}</>;
}
