import { useEffect, useRef, useState } from 'react';
import { APP_URL } from './links';
import { newBoardUrl } from '../boards/preferences';

type Category = 'File' | 'View' | 'Edit' | 'Settings' | 'Help';
export function DaliMenu({ onOpenBoards, onExport }: { onOpenBoards?: () => void; onExport: () => void }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category | null>(null);
  const [history, setHistory] = useState({ undo: false, redo: false });
  useEffect(() => {
    const update = (event: Event) => setHistory((event as CustomEvent<{ undo: boolean; redo: boolean }>).detail);
    window.addEventListener('dali:history-state', update);
    if (open) window.dispatchEvent(new CustomEvent('dali:board-command', { detail: 'history-state' }));
    return () => window.removeEventListener('dali:history-state', update);
  }, [open]);
  const [showControls, setShowControls] = useState(() => {
    try { return localStorage.getItem('dali:viewport-controls') !== 'hidden'; } catch { return true; }
  });
  useEffect(() => {
    document.documentElement.dataset.viewportControls = showControls ? 'visible' : 'hidden';
    try { localStorage.setItem('dali:viewport-controls', showControls ? 'visible' : 'hidden'); } catch { /* Session preference still works when storage is unavailable. */ }
  }, [showControls]);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => { setOpen(false); setCategory(null); trigger.current?.focus(); };
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) { setOpen(false); setCategory(null); } };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  useEffect(() => {
    if (open) root.current?.querySelector<HTMLElement>(category ? '.dali-submenu [role="menuitem"]:not(:disabled)' : '.dali-menu-categories [role="menuitem"]')?.focus();
  }, [open, category]);
  const run = (action: () => void) => { close(); action(); };
  const command = (action: string) => run(() => window.dispatchEvent(new CustomEvent('dali:board-command', { detail: action })));
  return <div className="dali-menu" ref={root} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) { setOpen(false); setCategory(null); }
  }} onKeyDown={event => {
    event.stopPropagation();
    if (event.key === 'Escape' || event.key === 'ArrowLeft') {
      event.preventDefault();
      if (category) { const previous = category; setCategory(null); requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>(`[data-category="${previous}"]`)?.focus()); }
      else close();
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      if (!open) { setOpen(true); return; }
      const menu = (event.target as HTMLElement).closest('[role="menu"]');
      const items = Array.from(menu?.querySelectorAll<HTMLElement>(':scope > [role="menuitem"]:not(:disabled)') ?? []);
      const index = items.indexOf(document.activeElement as HTMLElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    }
  }}>
    <button ref={trigger} type="button" className="djai-ghost dali-menu-trigger" aria-haspopup="menu" aria-expanded={open} onClick={() => { setOpen(!open); setCategory(null); }}>
      Dalí <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12"><path d="m3 4 3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
    </button>
    {open && <div className="dali-menu-popup">
      <div role="menu" aria-label="Dalí" className="dali-menu-categories">
        {(['File', 'View', 'Edit', 'Settings', 'Help'] as const).map(item => <button key={item} type="button" role="menuitem" tabIndex={-1} data-category={item} aria-haspopup="menu" aria-expanded={category === item}
          onClick={() => setCategory(item)} onKeyDown={event => { if (event.key === 'ArrowRight') { event.preventDefault(); setCategory(item); } }}>
          <MenuIcon name={item} /><span className="dali-menu-label">{item}</span><svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12"><path d="m4 3 3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
        </button>)}
      </div>
      {category && <div role="menu" aria-label={category} className="dali-submenu">
        {category === 'File' && <>
          <a role="menuitem" tabIndex={-1} href={newBoardUrl()} target="_blank" rel="noopener noreferrer" onClick={close}><MenuIcon name="new" /><span className="dali-menu-label">New</span></a>
          <button role="menuitem" tabIndex={-1} disabled={!onOpenBoards} onClick={() => run(() => onOpenBoards?.())}><MenuIcon name="boards" /><span className="dali-menu-label">All boards</span></button>
          <button role="menuitem" tabIndex={-1} onClick={() => command('import')}><MenuIcon name="import" /><span className="dali-menu-label">Import board</span></button>
          <button role="menuitem" tabIndex={-1} onClick={() => run(onExport)}><MenuIcon name="export" /><span className="dali-menu-label">Export board</span></button>
        </>}
        {category === 'View' && <>
          <button role="menuitem" tabIndex={-1} onClick={() => command('fit')}><MenuIcon name="fit" /><span className="dali-menu-label">Fit to screen</span></button>
          <button role="menuitem" tabIndex={-1} onClick={() => command('reset-zoom')}><MenuIcon name="zoom" /><span className="dali-menu-label">Reset zoom to 100%</span></button>
          <button role="menuitem" tabIndex={-1} onClick={() => command('layers')}><MenuIcon name="layers" /><span className="dali-menu-label">Layers</span></button>
        </>}
        {category === 'Edit' && <>
          <button role="menuitem" tabIndex={-1} disabled={!history.undo} onClick={() => command('undo')}><MenuIcon name="undo" /><span className="dali-menu-label">Undo</span></button>
          <button role="menuitem" tabIndex={-1} disabled={!history.redo} onClick={() => command('redo')}><MenuIcon name="redo" /><span className="dali-menu-label">Redo</span></button>
        </>}
        {category === 'Settings' && <button role="menuitem" tabIndex={-1} onClick={() => { setShowControls(!showControls); close(); }}><MenuIcon name="controls" /><span className="dali-menu-label">{showControls ? 'Hide' : 'Show'} viewport controls</span></button>}
        {category === 'Help' && <>
          <a role="menuitem" tabIndex={-1} href={APP_URL} target="_blank" rel="noopener noreferrer" onClick={close}><MenuIcon name="source" /><span className="dali-menu-label">Upstream source</span></a>
          <div className="dali-shortcuts">
            <h2>Canvas shortcuts</h2>
            <p>Select V · Frame F · Shape S · Connector C · Freehand P</p>
            <p>Hold Space to pan, or use Hand.</p>
            <h3>Mind maps</h3>
            <p>Tab adds a child. Enter adds a sibling (a child for the root). Double-click edits text. Escape finishes editing.</p>
            <p>Open Properties from the object's More menu for formatting.</p>
          </div>
        </>}
      </div>}
    </div>}
  </div>;
}


const menuIconPaths = {
  File: 'M6 3h8l4 4v14H6Z M14 3v5h4',
  View: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z M15 12a3 3 0 1 1-6 0 3 3 0 1 1 6 0',
  Edit: 'm4 16 12-12 4 4L8 20H4Z M13 7l4 4',
  Settings: 'M4 7h16M4 17h16M8 4v6M16 14v6',
  Help: 'M21 12a9 9 0 1 1-18 0 9 9 0 1 1 18 0 M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4 M12 16v.1',
  new: 'M6 3h8l4 4v14H6Z M14 3v5h4 M9 14h6 M12 11v6',
  boards: 'M3 3h7v7H3Z M14 3h7v7h-7Z M3 14h7v7H3Z M14 14h7v7h-7Z',
  import: 'M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5',
  export: 'M12 15V3m-4 4 4-4 4 4M4 16v5h16v-5',
  fit: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
  zoom: 'M16 10a6 6 0 1 1-12 0 6 6 0 1 1 12 0m-1 5 6 6 M7 10h6',
  layers: 'm3 8 9-5 9 5-9 5Z M3 12l9 5 9-5 M3 16l9 5 9-5',
  undo: 'm9 5-5 5 5 5M4 10h10a5 5 0 0 1 0 10',
  redo: 'm15 5 5 5-5 5M20 10H10a5 5 0 0 0 0 10',
  controls: 'M3 5h18v14H3Z M6 15h3M12 15h6M15 12v6',
  source: 'm8 7-5 5 5 5m8-10 5 5-5 5M14 4l-4 16',
} as const;
function MenuIcon({ name }: { name: keyof typeof menuIconPaths }) {
  return <svg className="dali-menu-icon" aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 24 24" fill="none"><path d={menuIconPaths[name]} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
