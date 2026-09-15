import { useEffect, useRef, useState } from 'react';
import { APP_URL } from './links';

type Category = 'File' | 'View' | 'Help';
export function DaliMenu({ onOpenBoards, onExport }: { onOpenBoards?: () => void; onExport: () => void }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category | null>(null);
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
    if (open) root.current?.querySelector<HTMLElement>(category ? '.dali-submenu [role="menuitem"]' : '.dali-menu-categories [role="menuitem"]')?.focus();
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
        {(['File', 'View', 'Help'] as const).map(item => <button key={item} type="button" role="menuitem" tabIndex={-1} data-category={item} aria-haspopup="menu" aria-expanded={category === item}
          onClick={() => setCategory(item)} onKeyDown={event => { if (event.key === 'ArrowRight') { event.preventDefault(); setCategory(item); } }}>
          {item}<svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12"><path d="m4 3 3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
        </button>)}
      </div>
      {category && <div role="menu" aria-label={category} className="dali-submenu">
        {category === 'File' && <>
          <button role="menuitem" tabIndex={-1} disabled={!onOpenBoards} onClick={() => run(() => onOpenBoards?.())}>All boards</button>
          <button role="menuitem" tabIndex={-1} onClick={() => command('import')}>Import board</button>
          <button role="menuitem" tabIndex={-1} onClick={() => run(onExport)}>Export board</button>
        </>}
        {category === 'View' && <>
          <button role="menuitem" tabIndex={-1} onClick={() => command('fit')}>Fit to screen</button>
          <button role="menuitem" tabIndex={-1} onClick={() => command('reset-zoom')}>Reset zoom to 100%</button>
          <button role="menuitem" tabIndex={-1} onClick={() => command('layers')}>Layers</button>
        </>}
        {category === 'Help' && <>
          <a role="menuitem" tabIndex={-1} href={APP_URL} target="_blank" rel="noopener noreferrer" onClick={close}>Upstream source</a>
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
