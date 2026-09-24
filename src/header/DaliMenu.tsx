import { MenuIcon } from './MenuIcon';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ViewMenu } from './ViewMenu';
import { APP_URL } from './links';
import { newBoardUrl } from '../boards/preferences';

type Category = 'File' | 'View' | 'Edit' | 'Settings' | 'Help';
export function DaliMenu({ onOpenBoards, onExport, onNewBoard, role, onBoardAction, canCreate = true }: { onOpenBoards?: () => void; onExport: () => void; onNewBoard?: () => void; role?: 'owner' | 'editor' | 'viewer'; canCreate?: boolean; onBoardAction?: (kind: 'rename' | 'duplicate' | 'delete') => void }) {
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
  const returnCategory = useRef<Category | null>(null);
  const close = () => { setOpen(false); setCategory(null); trigger.current?.focus(); };
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) { setOpen(false); setCategory(null); } };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  useLayoutEffect(() => {
    if (open) root.current?.querySelector<HTMLElement>(category ? '.dali-submenu [role="menuitem"]:not(:disabled)' : `[data-category="${returnCategory.current ?? 'File'}"]`)?.focus();
    returnCategory.current = null;
  }, [open, category]);
  const run = (action: () => void) => { close(); action(); };
  const command = (action: string) => run(() => window.dispatchEvent(new CustomEvent('dali:board-command', { detail: action })));
  return <div className="dali-menu" ref={root} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) { setOpen(false); setCategory(null); }
  }} onKeyDown={event => {
    event.stopPropagation();
    if (event.key === 'Escape' || event.key === 'ArrowLeft') {
      event.preventDefault();
      if (category) { returnCategory.current = category; setCategory(null); }
      else close();
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      if (!open) { setOpen(true); return; }
      const menu = (event.target as HTMLElement).closest('[role="menu"]');
      const items = Array.from(menu?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not(:disabled)') ?? []).filter(item => item.closest('[role="menu"]') === menu);
      const index = items.indexOf(document.activeElement as HTMLElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    }
  }}>
    <button ref={trigger} type="button" className="djai-ghost dali-menu-trigger" aria-haspopup="menu" aria-expanded={open} onClick={() => { setOpen(!open); setCategory(null); }}>
      Main Menu <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12"><path d="m3 4 3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
    </button>
    {open && <div className="dali-menu-popup">
      <div role="menu" aria-label="Main Menu" className="dali-menu-categories">
        {(['File', 'View', 'Edit', 'Settings', 'Help'] as const).map(item => <button key={item} type="button" role="menuitem" tabIndex={-1} data-category={item} aria-haspopup="menu" aria-expanded={category === item}
          onClick={() => setCategory(item)} onKeyDown={event => { if (event.key === 'ArrowRight') { event.preventDefault(); setCategory(item); } }}>
          <MenuIcon name={item} /><span className="dali-menu-label">{item}</span><svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12"><path d="m4 3 3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
        </button>)}
      </div>
      {category && <div role="menu" aria-label={category} className="dali-submenu">
        {category === 'File' && <>
          {canCreate && <a role="menuitem" tabIndex={-1} href={newBoardUrl()} target="_blank" rel="noopener noreferrer" onClick={event => { if (onNewBoard) { event.preventDefault(); onNewBoard(); } close(); }}><MenuIcon name="new" /><span className="dali-menu-label">New</span></a>}
          <button role="menuitem" tabIndex={-1} disabled={!onOpenBoards} onClick={() => run(() => onOpenBoards?.())}><MenuIcon name="boards" /><span className="dali-menu-label">All boards</span></button>

          {onBoardAction && role !== 'viewer' && <><button role="menuitem" tabIndex={-1} onClick={() => run(() => onBoardAction('rename'))}><MenuIcon name="rename" /><span className="dali-menu-label">Rename board</span></button><button role="menuitem" tabIndex={-1} onClick={() => run(() => onBoardAction('duplicate'))}><MenuIcon name="duplicate" /><span className="dali-menu-label">Duplicate board</span></button></>}
          {onBoardAction && role === 'owner' && <button role="menuitem" tabIndex={-1} onClick={() => run(() => onBoardAction('delete'))}><MenuIcon name="delete" /><span className="dali-menu-label">Delete board</span></button>}
          <div role="separator" className="dali-menu-separator" />
          <button role="menuitem" tabIndex={-1} disabled={role === 'viewer'} aria-describedby={role === 'viewer' ? 'viewer-import-reason' : undefined} onClick={() => command('import')}><MenuIcon name="import" /><span className="dali-menu-label">Import board</span></button>
          {role === 'viewer' && <p id="viewer-import-reason" hidden>Board import requires Owner or Editor access.</p>}
          <button role="menuitem" tabIndex={-1} onClick={() => run(onExport)}><MenuIcon name="export" /><span className="dali-menu-label">Export board</span></button>
        </>}
        {category === 'View' && <ViewMenu>
          <button role="menuitem" tabIndex={-1} onClick={() => command('fit')}><MenuIcon name="fit" /><span className="dali-menu-label">Fit to screen</span></button>
          <button role="menuitem" tabIndex={-1} onClick={() => command('reset-zoom')}><MenuIcon name="zoom" /><span className="dali-menu-label">Reset zoom to 100%</span></button>
          <button role="menuitem" tabIndex={-1} disabled={role === 'viewer'} aria-describedby={role === 'viewer' ? 'viewer-layers-reason' : undefined} onClick={() => command('layers')}><MenuIcon name="layers" /><span className="dali-menu-label">Layers</span></button>
          {role === 'viewer' && <p id="viewer-layers-reason" hidden>Layer editing requires Owner or Editor access.</p>}
        </ViewMenu>}
        {category === 'Edit' && <>
          <button role="menuitem" tabIndex={-1} disabled={!history.undo} onClick={() => command('undo')}><MenuIcon name="undo" /><span className="dali-menu-label">Undo</span><kbd aria-hidden="true">{navigator.platform.includes('Mac') ? '⌘Z' : 'Ctrl+Z'}</kbd></button>
          <button role="menuitem" tabIndex={-1} disabled={!history.redo} onClick={() => command('redo')}><MenuIcon name="redo" /><span className="dali-menu-label">Redo</span><kbd aria-hidden="true">{navigator.platform.includes('Mac') ? '⇧⌘Z' : 'Ctrl+Shift+Z'}</kbd></button>
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
