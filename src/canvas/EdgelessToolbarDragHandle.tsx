import { useEffect, useState } from 'react';
import type { EditorHost } from '@blocksuite/affine/std';
import { GfxControllerIdentifier } from '@blocksuite/affine/std/gfx';
import { PanTool } from '@blocksuite/affine/gfx/pointer';
import { DefaultTool } from '@blocksuite/affine-block-surface';
import { FrameTool } from '@blocksuite/affine/blocks/frame';
import { ShapeTool } from '@blocksuite/affine/gfx/shape';
import { ConnectorTool } from '@blocksuite/affine/gfx/connector';
import { BrushTool } from '@blocksuite/affine/gfx/brush';
import { ConnectorMode, ShapeType } from '@blocksuite/affine/model';

/** Legacy export retained for the native-tool rail adapter. */
export function EdgelessToolbarDragHandle({ host }: { host: EditorHost }) {
  const gfx = host.std.get(GfxControllerIdentifier);
  const [active, setActive] = useState(gfx.tool.currentToolName$.value);
  useEffect(() => gfx.tool.currentToolName$.subscribe(setActive), [gfx]);
  const tools = [
    { name: 'Select', key: 'V', type: 'default', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M5 3 19 13l-7 1-3 7L5 3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>, run: () => gfx.tool.setTool(DefaultTool) },
    { name: 'Hand', key: '', type: 'pan', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M8 12V6a1.5 1.5 0 0 1 3 0v5-7a1.5 1.5 0 0 1 3 0v7-5a1.5 1.5 0 0 1 3 0v6-3a1.5 1.5 0 0 1 3 0v6c0 4-2 7-6 7h-1c-2 0-3-1-4-3l-4-5a1.5 1.5 0 0 1 2-2l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>, run: () => gfx.tool.setTool(PanTool, { panning: false }) },
    { name: 'Frame' , key: 'F', type: 'frame', icon: '▣', run: () => gfx.tool.setTool(FrameTool) },
    { name: 'Shape', key: 'S', type: 'shape', icon: '□', run: () => gfx.tool.setTool(ShapeTool, { shapeName: ShapeType.Rect }) },
    { name: 'Arrow / connector', key: 'C', type: 'connector', icon: '↗', run: () => gfx.tool.setTool(ConnectorTool, { mode: ConnectorMode.Straight }) },
    { name: 'Freehand', key: 'P', type: 'brush', icon: '〰', run: () => gfx.tool.setTool(BrushTool) },
  ];
  return tools.map(tool => <button key={tool.type} type="button" className="canvas-tool-button"
    aria-label={tool.name} aria-pressed={active === tool.type} title={tool.key ? `${tool.name} (${tool.key})` : tool.name}
    onClick={tool.run}><span aria-hidden="true">{tool.icon}</span></button>);
}
