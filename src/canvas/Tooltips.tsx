import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export function Tooltips() {
  const [tip, setTip] = useState<{ label: string; x: number; y: number } | null>(null);
  useEffect(() => {
    let current: HTMLElement | null = null;
    let title = '';
    const hide = () => { if (current && title) current.title = title; current = null; title = ''; setTip(null); };
    const show = (event: Event) => {
      const button = (event.target as HTMLElement)?.closest<HTMLElement>('.canvas-tool-button,.board-control');
      if (button === current) return;
      hide();
      if (!button) return;
      current = button; title = button.title;
      const bounds = button.getBoundingClientRect();
      setTip({ label: title || button.getAttribute('aria-label') || '', x: bounds.right + 10, y: bounds.top + bounds.height / 2 });
      button.removeAttribute('title');
    };
    const leave = (event: Event) => { if (current && !current.contains((event as MouseEvent).relatedTarget as Node)) hide(); };
    document.addEventListener('pointerover', show);
    document.addEventListener('focusin', show);
    document.addEventListener('pointerout', leave);
    document.addEventListener('focusout', hide);
    document.addEventListener('pointerdown', hide);
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') hide(); };
    document.addEventListener('keydown', key);
    return () => { hide(); document.removeEventListener('pointerover', show); document.removeEventListener('focusin', show); document.removeEventListener('pointerout', leave); document.removeEventListener('focusout', hide); document.removeEventListener('pointerdown', hide); document.removeEventListener('keydown', key); };
  }, []);
  return tip && createPortal(<div role="tooltip" className="canvas-tooltip" style={{ left: tip.x, top: tip.y }}>{tip.label}</div>, document.body);
}
