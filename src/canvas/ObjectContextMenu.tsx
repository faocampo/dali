import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { EditorHost } from '@blocksuite/affine/std';
import { GfxControllerIdentifier, type GfxModel } from '@blocksuite/affine/std/gfx';
import type { CanvasSelectionSummary } from './selection-summary';
import {
  alignCanvasSelection, canvasSelectionEditable, duplicateCanvasSelection,
  groupCanvasSelection, ungroupCanvasSelection, selectedLayerCanGroup,
  selectedLayerCanUngroup, reorderCanvasLayer, setCanvasLayerLocked,
  type AlignmentAction,
} from './arrangement';

export function ObjectContextMenu({host,selection,placement}: {host:EditorHost;selection:CanvasSelectionSummary;placement?:'top'}) {
  const [point,setPoint]=useState<{left:number;top:number}|null>(null);
  const [actionError,setActionError]=useState<string|null>(null);
  const [,setImageRevision]=useState(0);
  const ref=useRef<HTMLDivElement>(null);
  const trigger=useRef<HTMLButtonElement>(null);
  const openAt=(x:number,y:number)=>setPoint({left:Math.max(8,Math.min(x,window.innerWidth-240)),top:Math.max(8,Math.min(y,window.innerHeight-560))});
  useEffect(()=>{
    const open=(e:MouseEvent)=>{
      if(e.target instanceof Element && e.target.closest('input,textarea,[contenteditable="true"]')) return;
      const gfx=host.std.get(GfxControllerIdentifier);
      const point=gfx.viewport.toModelCoord(...gfx.viewport.toViewCoordFromClientCoord([e.clientX,e.clientY]));
      const target=gfx.getElementByPoint(...point);
      if(!target)return;
      e.preventDefault();e.stopImmediatePropagation();
      if(!gfx.selection.selectedElements.some(m=>m.id===target.id))gfx.selection.set({elements:[target.id],editing:false});
      openAt(e.clientX,e.clientY);
    };
    const keyboard=(e:KeyboardEvent)=>{if(e.key==='F10'&&e.shiftKey){e.preventDefault();const r=host.getBoundingClientRect();openAt(r.left+80,r.top+80);}};
    host.addEventListener('contextmenu',open,true);host.addEventListener('keydown',keyboard,true);
    return()=>{host.removeEventListener('contextmenu',open,true);host.removeEventListener('keydown',keyboard,true);};
  },[host,selection.key]);

  useEffect(()=>{
    if(!point)return;
    ref.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    const outside=(e:PointerEvent)=>{if(!ref.current?.contains(e.target as Node)&&!trigger.current?.contains(e.target as Node))setPoint(null);};
    document.addEventListener('pointerdown',outside,true);
    return()=>document.removeEventListener('pointerdown',outside,true);
  },[point]);
  return <>
    <button ref={trigger} className="object-actions-trigger djai-ghost" data-placement={placement} aria-haspopup="menu" aria-expanded={!!point}
      onPointerDown={e=>e.stopPropagation()} onClick={e=>{const r=e.currentTarget.getBoundingClientRect();if(point)setPoint(null);else openAt(r.left,r.bottom+8);}}>Object actions</button>
    {point&&createPortal(<div ref={ref} className="object-context-menu" data-testid="object-context-menu" role="menu" aria-label="Object actions" style={point}
      onPointerDown={e=>e.stopPropagation()} onKeyDown={e=>{
        e.stopPropagation();
        if(e.key==='Escape'){setPoint(null);trigger.current?.focus();}
        if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){
          e.preventDefault();const buttons=[...e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
          const i=buttons.indexOf(document.activeElement as HTMLButtonElement);
          buttons[e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowDown'?1:buttons.length-1))%buttons.length]?.focus();
        }
      }}>
          <section>
            
            <div className="layers-action-grid">
              <button role="menuitem" disabled={!canvasSelectionEditable(host)} title="Duplicate (⌘/Ctrl+D)"
                onClick={() => void duplicateCanvasSelection(host).catch(cause => setActionError(String(cause)))}>Duplicate</button>
              <button role="menuitem" disabled={!selectedLayerCanGroup(host)} title="Group (⌘/Ctrl+G)"
                onClick={() => groupCanvasSelection(host)}>Group</button>
              <button role="menuitem" disabled={!selectedLayerCanUngroup(host)} title="Ungroup (⌘/Ctrl+Shift+G)"
                onClick={() => ungroupCanvasSelection(host)}>Ungroup</button>
              {(['left', 'center-x', 'right', 'top', 'center-y', 'bottom', 'distribute-x', 'distribute-y'] as AlignmentAction[]).map(action =>
                <button role="menuitem" key={action} disabled={!canvasSelectionEditable(host) || selection.count < (action.startsWith('distribute') ? 3 : 2)}
                  onClick={() => alignCanvasSelection(host, action)}>{`Align ${action}`}</button>)}
              {(['front', 'back'] as const).map(direction => <button role="menuitem" key={direction}
                disabled={selection.count !== 1 || !canvasSelectionEditable(host)}
                onClick={() => reorderCanvasLayer(host, selection.key, direction)}>{`To ${direction}`}</button>)}
              {selection.count === 1 && <button role="menuitem" onClick={() => {
                const model = host.std.get(GfxControllerIdentifier).getElementById<GfxModel>(selection.key);
                if (model) setCanvasLayerLocked(host, model.id, !model.isLockedBySelf());
                setImageRevision(value => value + 1);
              }}>{host.std.get(GfxControllerIdentifier).getElementById<GfxModel>(selection.key)?.isLockedBySelf() ? 'Unlock object' : 'Lock object'}</button>}
            </div>
          </section>
      {actionError&&<p role="alert">{actionError}</p>}
    </div>,document.body)}
  </>;
}
