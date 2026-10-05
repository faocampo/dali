import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { EditorHost } from '@blocksuite/affine/std';
import { GfxControllerIdentifier } from '@blocksuite/affine/std/gfx';
import { BrushTool, EraserTool } from '@blocksuite/affine/gfx/brush';
import { ShapeTool } from '@blocksuite/affine/gfx/shape';
import { ConnectorTool } from '@blocksuite/affine/gfx/connector';
import { ConnectorMode, PointStyle, ShapeType, type ShapeName } from '@blocksuite/affine/model';
import { classicalShapes, shapeIconPath } from './classical-shape-geometry';
import { ClassicalShapeTool } from './classical-shapes';
import { EditPropsStore } from '@blocksuite/affine-shared/services';

const shapes: { name: string; shape: ShapeName | string; path: string }[] = [
  { name: 'Square / rectangle', shape: ShapeType.Rect, path: 'M4 4H20V20H4Z' },
  { name: 'Rounded rectangle', shape: 'roundedRect', path: 'M7 4H17Q20 4 20 7V17Q20 20 17 20H7Q4 20 4 17V7Q4 4 7 4Z' },
  { name: 'Circle / ellipse', shape: ShapeType.Ellipse, path: 'M20 12A8 8 0 1 1 4 12A8 8 0 1 1 20 12Z' },
  { name: 'Triangle', shape: ShapeType.Triangle, path: 'M12 3L22 21H2Z' },
  { name: 'Diamond', shape: ShapeType.Diamond, path: 'M12 2L22 12L12 22L2 12Z' },
  ...classicalShapes.map(shape => ({ name: shape.name, shape: shape.id, path: shapeIconPath(shape.id) })),
];
const modes = [
  { name: 'Straight', mode: ConnectorMode.Straight, path: 'M3 20L21 4' },
  { name: 'Curved', mode: ConnectorMode.Curve, path: 'M3 20C20 20 4 4 21 4' },
  { name: 'Angled', mode: ConnectorMode.Orthogonal, path: 'M3 20H12V4H21' },
];
export function DrawingPalette({ host, kind, active, icon }: { host: EditorHost; kind: 'Shapes' | 'Lines' | 'Freehand'; active: boolean; icon: ReactNode }) {
  const gfx = host.std.get(GfxControllerIdentifier);
  const editProps = host.std.get(EditPropsStore);
  const [penWidth, setPenWidth] = useState(() => editProps.lastProps$.peek().brush.lineWidth);
  const changePenWidth = (width: number) => {
    setPenWidth(width);
    editProps.recordLastProps('brush', { lineWidth: width });
  };
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const close = (focus = true) => { setPosition(null); if (focus) trigger.current?.focus(); };
  useEffect(() => {
    if (!position) return;
    popup.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const outside = (event: PointerEvent) => {
      if (!popup.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) close(false);
    };
    const resize = () => close(false);
    document.addEventListener('pointerdown', outside);
    window.addEventListener('resize', resize);
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', resize); };
  }, [position]);
  const pick = (action: () => void) => { close(); action(); };
  return <>
    <button ref={trigger} type="button" className="canvas-tool-button" aria-label={kind} title={`${kind} (${kind === 'Shapes' ? 'S' : kind === 'Lines' ? 'C' : 'P'})`} aria-pressed={active} aria-haspopup="dialog" aria-expanded={!!position} onClick={() => {
      const bounds = trigger.current!.getBoundingClientRect();
      if (position) close();
      else {
        setPenWidth(editProps.lastProps$.peek().brush.lineWidth);
        setPosition({ left: Math.min(bounds.right + 12, window.innerWidth - 284), top: Math.max(64, Math.min(bounds.top, window.innerHeight - 430)) });
      }
    }}><span aria-hidden="true">{icon}</span></button>
    {position && createPortal(<div ref={popup} role="dialog" aria-label={`${kind} palette`} className="drawing-palette" style={{ ...position, maxHeight: `calc(100dvh - ${position.top + 12}px)` }} onBlur={event => {
      if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) close(false);
    }} onKeyDown={event => {
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if (event.target instanceof HTMLInputElement) return;
      if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const buttons = Array.from(popup.current?.querySelectorAll<HTMLButtonElement>('button') ?? []);
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const columns = kind === 'Shapes' ? 4 : 2;
        const offset = event.key === 'ArrowDown' ? columns : event.key === 'ArrowUp' ? -columns : event.key === 'ArrowLeft' ? -1 : 1;
        buttons[event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + offset + buttons.length) % buttons.length]?.focus();
      }
    }}>
      <h2>{kind}</h2>
      <div className={`drawing-palette-options${kind === 'Shapes' ? ' drawing-palette-options--shapes' : ''}`}>
        {kind === 'Freehand' ? <>
          <button onClick={() => pick(() => gfx.tool.setTool(BrushTool))}><Glyph path="M3 17c4-15 6 7 10-3s6-3 8-6" /><span>Pen</span></button>
          <button onClick={() => pick(() => gfx.tool.setTool(EraserTool))}><Glyph path="m4 15 10-11 7 7-9 10H9Zm4-4 7 7M12 21h9" /><span>Eraser</span></button>
        </> : kind === 'Shapes' ? shapes.map(item => <button key={item.name} aria-label={item.name} title={item.name} onClick={() => pick(() => item.shape.startsWith('dali:') ? gfx.tool.setTool(ClassicalShapeTool, { shapeName: ShapeType.Rect, geometry: item.shape }) : gfx.tool.setTool(ShapeTool, { shapeName: item.shape as ShapeName }))}><Glyph path={item.path} /></button>) : modes.flatMap(item => [false, true].map(arrow => <button key={`${item.name}-${arrow}`} onClick={() => pick(() => {
          host.std.get(EditPropsStore).recordLastProps('connector', { frontEndpointStyle: PointStyle.None, rearEndpointStyle: arrow ? PointStyle.Arrow : PointStyle.None });
          gfx.tool.setTool(ConnectorTool, { mode: item.mode });
        })}><Glyph path={item.path + (arrow ? 'M15 4H21V10' : '')} /><span>{item.name} {arrow ? 'arrow' : 'line'}</span></button>))}
      </div>
      {kind === 'Freehand' && <div className="freehand-width">
        <label htmlFor="freehand-pen-width">Pen width <output>{penWidth} px</output></label>
        <svg className="freehand-width-preview" aria-hidden="true" viewBox="0 0 232 32"><path d="M16 16H216" fill="none" stroke="currentColor" strokeWidth={penWidth} strokeLinecap="round" /></svg>
        <input id="freehand-pen-width" type="range" min="2" max="12" step="2" value={penWidth} aria-valuetext={`${penWidth} pixels`} onChange={event => changePenWidth(Number(event.target.value))} />
        <div className="freehand-width-presets" role="group" aria-label="Pen width presets">
          {[2, 4, 6, 8, 10, 12].map(width => <button key={width} type="button" aria-label={`${width} pixel pen`} aria-pressed={penWidth === width} onClick={() => changePenWidth(width)}>
            <svg aria-hidden="true" width="36" height="20" viewBox="0 0 36 20"><path d="M8 10H28" stroke="currentColor" strokeWidth={width} strokeLinecap="round" /></svg>
            <span>{width} px</span>
          </button>)}
        </div>
        <p>Choose a width, then select Pen to draw. Eraser removes whole objects.</p>
      </div>}
      {kind !== 'Freehand' && <p>{kind === 'Shapes' ? 'Choose a shape, then click or drag on the canvas. Hold Shift while dragging for equal sides.' : 'Choose a line, then drag between points or objects. Endpoints attach when drawn onto objects.'}</p>}
    </div>, document.body)}
  </>;
}
function Glyph({ path }: { path: string }) {
  return <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none"><path d={path} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" /></svg>;
}
