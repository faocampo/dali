import { useEffect, useRef, useState } from 'react';
import type { EditorHost } from '@blocksuite/affine/std';
import type { ImageBlockModel } from '@blocksuite/affine/model';
import { GfxControllerIdentifier } from '@blocksuite/affine/std/gfx';
import { Bound } from '@blocksuite/global/gfx';
import { getImageVisualEdit, imageVisualSettings, uncroppedGeometry, type ImageVisualSettings } from './image-visual-edits';

type Edge = 'left' | 'top' | 'right' | 'bottom';
const edges: Edge[] = ['left', 'top', 'right', 'bottom'];
const fields = {left:'cropLeft',top:'cropTop',right:'cropRight',bottom:'cropBottom'} as const;

export function ImageCropOverlay({host, imageId, busy, onApply, onCancel}: {
  host: EditorHost; imageId: string; busy: boolean;
  onApply: (settings: ImageVisualSettings) => void; onCancel: () => void;
}) {
  const [draft, setDraft] = useState(() => imageVisualSettings(host.std.store, imageId));
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [, refresh] = useState(0);
  const applyRef = useRef<HTMLButtonElement>(null);
  const gfx = host.std.get(GfxControllerIdentifier);
  const image = host.std.store.getBlock(imageId)?.model as ImageBlockModel | undefined;
  const edit = getImageVisualEdit(host.std.store, imageId);
  const bounds = image ? Bound.deserialize(image.xywh) : new Bound();
  const base = image && edit ? uncroppedGeometry(image, edit.props) :
    {baseX:bounds.x,baseY:bounds.y,baseWidth:bounds.w,baseHeight:bounds.h};
  const view = gfx.viewport.toViewBound(new Bound(base.baseX,base.baseY,base.baseWidth,base.baseHeight));
  const angle = image?.props.rotate ?? 0;

  useEffect(() => {
    let cancelled = false; let sourceUrl = '';
    const source = edit?.props.sourceId ?? image?.props.sourceId;
    if (source) void host.std.store.blobSync.get(source).then(blob => {
      if (cancelled) return;
      if (!blob) { setError('The original image is unavailable. Cancel and reload the board to retry.'); return; }
      sourceUrl = URL.createObjectURL(blob); setUrl(sourceUrl);
    }).catch(() => { if (!cancelled) setError('The image could not load. Cancel and try again.'); });
    host.classList.add('dali-cropping');
    const sub = gfx.viewport.viewportUpdated.subscribe(() => refresh(v => v + 1));
    applyRef.current?.focus();
    return () => { cancelled = true; URL.revokeObjectURL(sourceUrl); host.classList.remove('dali-cropping'); sub.unsubscribe(); };
  }, [host, imageId]);

  const change = (edge: Edge, value: number) => setDraft(d => {
    const opposite = fields[edges[(edges.indexOf(edge)+2)%4]!];
    return {...d, [fields[edge]]: Math.max(0, Math.min(95-d[opposite], value))};
  });
  const start = (event: React.PointerEvent<HTMLButtonElement>, sides: Edge[]) => {
    event.preventDefault(); event.stopPropagation();
    if (busy) return;
    const startX=event.clientX, startY=event.clientY, initial={...draft};
    const target=event.currentTarget; target.setPointerCapture(event.pointerId);
    const radians=angle*Math.PI/180;
    const move=(e: PointerEvent) => {
      const dx=e.clientX-startX,dy=e.clientY-startY;
      const localX=(dx*Math.cos(radians)+dy*Math.sin(radians))/view.w*100;
      const localY=(-dx*Math.sin(radians)+dy*Math.cos(radians))/view.h*100;
      for (const side of sides) change(side,initial[fields[side]]+
        (side==='left'?localX:side==='right'?-localX:side==='top'?localY:-localY));
    };
    const stop=() => {target.removeEventListener('pointermove',move);target.removeEventListener('pointerup',stop);target.removeEventListener('pointercancel',stop);};
    target.addEventListener('pointermove',move); target.addEventListener('pointerup',stop);target.addEventListener('pointercancel',stop);
  };
  const handles: {name:string;sides:Edge[];x:number;y:number}[] = [
    {name:'left',sides:['left'],x:0,y:50},{name:'right',sides:['right'],x:100,y:50},
    {name:'top',sides:['top'],x:50,y:0},{name:'bottom',sides:['bottom'],x:50,y:100},
    {name:'top left',sides:['top','left'],x:0,y:0},{name:'top right',sides:['top','right'],x:100,y:0},
    {name:'bottom left',sides:['bottom','left'],x:0,y:100},{name:'bottom right',sides:['bottom','right'],x:100,y:100},
  ];
  return <div className="image-crop-overlay" data-testid="image-crop-controls" onPointerDown={e=>e.stopPropagation()}
    onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();onCancel();} if(e.key==='Enter'&&!busy&&url){e.stopPropagation();onApply(draft);}}}>
    <div className="image-crop-source" style={{left:view.x,top:view.y,width:view.w,height:view.h,transform:`rotate(${angle}deg)`}}>
      {url && <img src={url} alt="Crop preview" draggable={false} />}
      <div className="image-crop-window" style={{left:`${draft.cropLeft}%`,top:`${draft.cropTop}%`,right:`${draft.cropRight}%`,bottom:`${draft.cropBottom}%`}}>
        {handles.map(h=><button key={h.name} className="image-crop-handle" aria-label={`Crop ${h.name}`} disabled={busy}
          style={{left:`${h.x}%`,top:`${h.y}%`,cursor:h.sides.length===2?'nwse-resize':h.x===50?'ns-resize':'ew-resize'}}
          onPointerDown={e=>start(e,h.sides)} onKeyDown={e=>{
            if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
            e.preventDefault();e.stopPropagation();
            const side=h.sides.find(s=>e.key==='ArrowLeft'||e.key==='ArrowRight'?s==='left'||s==='right':s==='top'||s==='bottom');
            if(side)change(side,draft[fields[side]]+(e.key==='ArrowLeft'||e.key==='ArrowUp'?-1:1)*(side==='right'||side==='bottom'?-1:1)*(e.shiftKey?10:1));
          }} />)}
      </div>
    </div>
    <div className="image-crop-toolbar" role="toolbar" aria-label="Crop image"
      style={{left:Math.max(12,Math.min(view.x, gfx.viewport.width-300)),top:Math.max(12,Math.min(view.y-48,gfx.viewport.height-55))}}>
      <span>Drag edges to crop</span>
      <button ref={applyRef} className="djai-primary" disabled={busy||!url} onClick={()=>onApply(draft)}>{busy?'Cropping…':'Apply crop'}</button>
      <button className="djai-ghost" onClick={onCancel}>Cancel</button>
      {error&&<span role="alert">{error}</span>}
    </div>
  </div>;
}
