import { useLayoutEffect, useRef, useState } from 'react';
import { setViewPreferences, useViewPreferences } from '../canvas/view-preferences';

const paths = {
  grid: 'M4 4h16v16H4ZM4 9h16M4 15h16M9 4v16M15 4v16',
  dimensions: 'M4 8V4h16v4M4 16v4h16v-4M4 12h16m-3-3 3 3-3 3M7 9l-3 3 3 3',
  distances: 'M4 4v16M20 4v16M7 12h10m-3-3 3 3-3 3M10 9l-3 3 3 3',
  back: 'm10 6-6 6 6 6M4 12h16',
};
function Icon({ name }: { name: keyof typeof paths }) {
  return <svg className="dali-menu-icon" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none"><path d={paths[name]} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function ViewMenu({ children }: { children: React.ReactNode }) {
  const prefs = useViewPreferences();
  const [gridOpen, setGridOpen] = useState(false);
  const gridButton = useRef<HTMLButtonElement>(null);
  const gridMenu = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (gridOpen) gridMenu.current?.querySelector<HTMLElement>('[role="menuitemradio"][aria-checked="true"]')?.focus();
    else gridButton.current?.focus();
  }, [gridOpen]);
  const back = () => setGridOpen(false);
  if (gridOpen) return <div ref={gridMenu} role="menu" aria-label="Grid" className="dali-grid-menu" onKeyDown={event => {
    if (event.key === 'Escape' || event.key === 'ArrowLeft') { event.preventDefault(); event.stopPropagation(); back(); }
  }}>
    <button role="menuitem" tabIndex={-1} onClick={back}><Icon name="back" /><span className="dali-menu-label">View</span></button>
    <div role="group" aria-label="Grid style">
    <div className="dali-menu-section-label">Grid style</div>
    {(['off', 'dots', 'lines'] as const).map(style => <button key={style} role="menuitemradio" aria-checked={prefs.grid === style} tabIndex={-1} onClick={() => setViewPreferences({ grid: style })}>
      <span className={`grid-preview grid-preview--${style}`} aria-hidden="true" /><span className="dali-menu-label">{style === 'off' ? 'Off' : style === 'dots' ? 'Dots' : 'Lines'}</span><span aria-hidden="true">{prefs.grid === style ? '✓' : ''}</span>
    </button>)}
    </div>
    <div role="separator" className="dali-menu-separator" />
    <div role="group" aria-label="Grid spacing">
    <div className="dali-menu-section-label">Grid spacing</div>
    {([20, 40, 80] as const).map(spacing => <button key={spacing} role="menuitemradio" aria-checked={prefs.spacing === spacing} tabIndex={-1} onClick={() => setViewPreferences({ spacing })}><span className="dali-menu-label">{spacing} px</span><span aria-hidden="true">{prefs.spacing === spacing ? '✓' : ''}</span></button>)}
    </div>
  </div>;
  return <>
    <button ref={gridButton} role="menuitem" tabIndex={-1} aria-haspopup="menu" aria-expanded={false} onClick={() => setGridOpen(true)} onKeyDown={event => {
      if (event.key === 'ArrowRight') { event.preventDefault(); event.stopPropagation(); setGridOpen(true); }
    }}><Icon name="grid" /><span className="dali-menu-label">Grid</span><span className="dali-menu-value" aria-hidden="true">{prefs.grid === 'off' ? 'Off' : prefs.grid === 'dots' ? 'Dots' : 'Lines'}</span><span aria-hidden="true">›</span></button>
    {(['dimensions', 'distances'] as const).map(key => <button key={key} role="menuitemcheckbox" aria-checked={prefs[key]} tabIndex={-1} onClick={() => setViewPreferences({ [key]: !prefs[key] })}>
      <Icon name={key} /><span className="dali-menu-label">{key === 'dimensions' ? 'Object dimensions' : 'Distances'}</span><span className="dali-menu-switch" aria-hidden="true" />
    </button>)}
    <div role="separator" className="dali-menu-separator" />
    {children}
  </>;
}
