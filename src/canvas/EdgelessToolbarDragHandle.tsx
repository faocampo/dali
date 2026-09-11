import { useEffect, useState } from 'react';
import type { EditorHost } from '@blocksuite/affine/std';
import { GfxControllerIdentifier } from '@blocksuite/affine/std/gfx';
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
    { name: 'Select', key: 'V', type: 'default', icon: '↖', run: () => gfx.tool.setTool(DefaultTool) },
    { name: 'Frame', key: 'F', type: 'frame', icon: '▣', run: () => gfx.tool.setTool(FrameTool) },
    { name: 'Shape', key: 'S', type: 'shape', icon: '□', run: () => gfx.tool.setTool(ShapeTool, { shapeName: ShapeType.Rect }) },
    { name: 'Arrow / connector', key: 'C', type: 'connector', icon: '↗', run: () => gfx.tool.setTool(ConnectorTool, { mode: ConnectorMode.Straight }) },
    { name: 'Freehand', key: 'P', type: 'brush', icon: '〰', run: () => gfx.tool.setTool(BrushTool) },
  ];
  return tools.map(tool => <button key={tool.type} type="button" className="canvas-tool-button"
    aria-label={tool.name} aria-pressed={active === tool.type} title={`${tool.name} (${tool.key})`}
    onClick={tool.run}><span aria-hidden="true">{tool.icon}</span></button>);
}
