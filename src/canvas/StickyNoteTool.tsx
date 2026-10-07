import { withCanvasReservation } from './account/reservations';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ColorScheme, DefaultTheme, resolveColor } from '@blocksuite/affine/model';
import type { EditorHost } from '@blocksuite/affine/std';
import { insertSticky } from './sticky';
import './sticky-note-tool.css';

const colors = ['Yellow', 'Orange', 'Red', 'Magenta', 'Purple', 'Blue', 'Green', 'White'] as const;
type NoteColor = typeof colors[number];

/** Choose paper before creating a note. The portal escapes the scrolling rail. */
export function StickyNoteTool({ host }: { host: EditorHost }) {
  const trigger = useRef<HTMLButtonElement>(null);
  const palette = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number }>();
  const [inserting, setInserting] = useState(false);
  const [lastColor, setLastColor] = useState<NoteColor>('Yellow');
  const close = (focus = false) => { setPosition(undefined); if (focus) trigger.current?.focus(); };
  useEffect(() => {
    if (!position) return;
    palette.current?.querySelector<HTMLButtonElement>(`[data-color="${lastColor}"]`)?.focus();
    const outside = (event: PointerEvent) => {
      if (!palette.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) close();
    };
    const reposition = () => close();
    document.addEventListener('pointerdown', outside);
    window.addEventListener('resize', reposition);
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', reposition); };
  }, [position, lastColor]);
  const open = () => {
    if (position) { close(); return; }
    const rect = trigger.current!.getBoundingClientRect();
    setPosition({ left: Math.max(8, Math.min(rect.right + 12, window.innerWidth - 248)), top: Math.max(8, Math.min(rect.top, window.innerHeight - 250)) });
  };
  return <>
    <button ref={trigger} type="button" className="board-control sticky-note-tool" aria-label="Add sticky note" title="Add sticky note — choose a color" aria-haspopup="dialog" aria-expanded={!!position} disabled={host.store.readonly || inserting} onClick={open}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4.5 4.5h15v9.5l-5.5 5.5H4.5zM19.5 14H14v5.5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
    </button>
    {position && createPortal(<div ref={palette} className="sticky-note-palette" role="dialog" aria-label="Note colors" style={position} onKeyDown={event => {
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); close(true); }
      if (event.key === 'Tab') close(true);
      if (['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const buttons = [...palette.current!.querySelectorAll<HTMLButtonElement>('button')];
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const step = event.key === 'ArrowDown' ? 4 : event.key === 'ArrowUp' ? -4 : event.key === 'ArrowLeft' ? -1 : 1;
        buttons[event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + step + buttons.length) % buttons.length]?.focus();
      }
    }}>
      <strong>Note color</strong><p role="status">{inserting ? 'Adding note…' : 'Choose a color to add a note.'}</p>
      <div className="sticky-note-palette__colors">{colors.map(color => <button key={color} type="button" data-color={color} disabled={inserting} aria-label={`${color} note`} onClick={() => {
        if (host.store.readonly || !host.isConnected) { close(); return; }
        if (inserting) return;
        setInserting(true);
        void withCanvasReservation(host, [], true, () => insertSticky(host.std, DefaultTheme.NoteBackgroundColorMap[color]!)).then(() => { setLastColor(color); close(); }).catch(() => { /* The scoped action presents its failure beside the canvas. */ }).finally(() => setInserting(false));
      }}><span aria-hidden="true" style={{ background: resolveColor(DefaultTheme.NoteBackgroundColorMap[color]!, ColorScheme.Light) }} /><span>{color}</span></button>)}</div>
    </div>, document.body)}
  </>;
}
