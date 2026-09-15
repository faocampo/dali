import { useEffect, useState } from 'react';
import type { EditorHost } from '@blocksuite/affine/std';
import { GfxControllerIdentifier } from '@blocksuite/affine/std/gfx';
import { PanTool } from '@blocksuite/affine/gfx/pointer';
import { DefaultTool } from '@blocksuite/affine-block-surface';
import { FrameTool } from '@blocksuite/affine/blocks/frame';
import { BrushTool } from '@blocksuite/affine/gfx/brush';
import { DrawingPalette } from './DrawingPalette';

/** Legacy export retained for the native-tool rail adapter. */
export function EdgelessToolbarDragHandle({ host }: { host: EditorHost }) {
  const gfx = host.std.get(GfxControllerIdentifier);
  const [active, setActive] = useState(gfx.tool.currentToolName$.value);
  useEffect(() => gfx.tool.currentToolName$.subscribe(setActive), [gfx]);
  const tools = [
    { name: 'Select', key: 'V', type: 'default', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M5 3 19 13l-7 1-3 7L5 3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>, run: () => gfx.tool.setTool(DefaultTool) },
    { name: 'Hand', key: '', type: 'pan', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M8 12V6a1.5 1.5 0 0 1 3 0v5-7a1.5 1.5 0 0 1 3 0v7-5a1.5 1.5 0 0 1 3 0v6-3a1.5 1.5 0 0 1 3 0v6c0 4-2 7-6 7h-1c-2 0-3-1-4-3l-4-5a1.5 1.5 0 0 1 2-2l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>, run: () => gfx.tool.setTool(PanTool, { panning: false }) },
    { name: 'Frame' , key: 'F', type: 'frame', icon: <svg viewBox="0 0 24 24" fill="none"><path d="M6 3v18M18 3v18M3 6h18M3 18h18" stroke="currentColor" strokeWidth="1.7" /></svg>, run: () => gfx.tool.setTool(FrameTool) },
    { name: 'Shapes', key: 'S', type: 'shape', icon: <svg viewBox="0 0 24 24" fill="none"><rect x="5" y="5" width="14" height="14" rx="1" stroke="currentColor" strokeWidth="1.7" /></svg> },
    { name: 'Lines', key: 'C', type: 'connector', icon: <svg viewBox="0 0 24 24" fill="none"><path d="m5 19 14-14M9 5h10v10" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg> },
    { name: 'Freehand', key: 'P', type: 'brush', icon: <svg viewBox="0 0 24 24" fill="none"><path d="M3 16c4-16 5 9 10-3s5-3 8-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>, run: () => gfx.tool.setTool(BrushTool) },
  ];
  return tools.map(tool => tool.name === 'Shapes' || tool.name === 'Lines' ? <DrawingPalette key={tool.type} host={host} kind={tool.name} active={active === tool.type} icon={tool.icon} /> : <button key={tool.type} type="button" className="canvas-tool-button"
    aria-label={tool.name} aria-pressed={active === tool.type} title={tool.key ? `${tool.name} (${tool.key})` : tool.name}
    onClick={tool.run}><span aria-hidden="true">{tool.icon}</span></button>);
}
