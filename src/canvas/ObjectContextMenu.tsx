import { MenuIcon } from '../header/MenuIcon';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { EditorHost } from '@blocksuite/affine/std';
import { GfxControllerIdentifier, type GfxModel } from '@blocksuite/affine/std/gfx';
import { summarizeCanvasSelection, canvasModelVisible, mindmapOwner } from './selection-summary';
import {
  alignCanvasSelection, canvasSelectionEditable, duplicateCanvasSelection,
  groupCanvasSelection, ungroupCanvasSelection, selectedLayerCanGroup, canvasLayerLockTarget,
  selectedLayerCanUngroup, reorderCanvasLayer, setCanvasLayerLocked,
  type AlignmentAction,
} from './arrangement';

export function ObjectContextMenu({host}: {host:EditorHost}) {
  const gfx = host.std.get(GfxControllerIdentifier);
  const [,updateSelection] = useState(0);
  const selection = summarizeCanvasSelection(gfx.selection.selectedElements);
  const selected = gfx.selection.selectedElements;
  const owner = selected.length === 1 ? mindmapOwner(selected[0]!) : null;
  const onProperties = owner && owner.id !== selected[0]!.id
    ? () => host.dispatchEvent(new Event('dali:mindmap-properties')) : undefined;
  const [point,setPoint]=useState<{left:number;top:number}|null>(null);
  const [actionError,setActionError]=useState<string|null>(null);
  const [,setImageRevision]=useState(0);
  const ref=useRef<HTMLDivElement>(null);
  const trigger=useRef<HTMLElement|null>(null);
  const openedSelection=useRef('');
  const currentSelection=()=>host.std.get(GfxControllerIdentifier).selection.selectedElements.map(model=>model.id).sort().join('|');
  const openAt=(x:number,y:number)=>{openedSelection.current=currentSelection();setPoint({left:Math.max(8,Math.min(x,window.innerWidth-240)),top:Math.max(8,Math.min(y,window.innerHeight-560))});};
  useLayoutEffect(()=>{
    if(!point||!ref.current)return;
    const menu=ref.current.getBoundingClientRect();
    let left=point.left,top=point.top;
    left=Math.max(8,Math.min(left,window.innerWidth-menu.width-8));
    top=Math.max(8,Math.min(top,window.innerHeight-menu.height-8));
    if(left!==point.left||top!==point.top)setPoint({left,top});
  },[point]);
  useEffect(()=>{
    const gfx=host.std.get(GfxControllerIdentifier);
    const selected=gfx.selection.slots.updated.subscribe(()=>{if(currentSelection()!==openedSelection.current)setPoint(null);updateSelection(value=>value+1);});
    const removed=gfx.surface?.elementRemoved.subscribe(()=>setPoint(null));
    return()=>{selected.unsubscribe();removed?.unsubscribe();};
  },[host]);
  useEffect(()=>{
    const open=(e:MouseEvent)=>{
      if(e.target instanceof Element && e.target.closest('input,textarea,[contenteditable="true"]')) return;
      const gfx=host.std.get(GfxControllerIdentifier);
      const point=gfx.viewport.toModelCoord(...gfx.viewport.toViewCoordFromClientCoord([e.clientX,e.clientY]));
      const target=gfx.getElementByPoint(...point);
      if(!target || !canvasModelVisible(target))return;
      trigger.current=host;
      e.preventDefault();e.stopImmediatePropagation();
      if(!gfx.selection.selectedElements.some(m=>m.id===target.id))gfx.selection.set({elements:[target.id],editing:false});
      openAt(e.clientX,e.clientY);
    };
    const keyboard=(e:KeyboardEvent)=>{if(e.key==='F10'&&e.shiftKey){e.preventDefault();trigger.current=host;const r=host.getBoundingClientRect();openAt(r.left+80,r.top+80);}};
    host.addEventListener('contextmenu',open,true);host.addEventListener('keydown',keyboard,true);
    return()=>{host.removeEventListener('contextmenu',open,true);host.removeEventListener('keydown',keyboard,true);};
  },[host]);

  useLayoutEffect(()=>{
    if(!point)return;
    trigger.current?.setAttribute('aria-expanded','true');
    ref.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    const outside=(e:PointerEvent)=>{if(!ref.current?.contains(e.target as Node)&&!trigger.current?.contains(e.target as Node))setPoint(null);};
    document.addEventListener('pointerdown',outside,true);
    return()=>{document.removeEventListener('pointerdown',outside,true);trigger.current?.setAttribute('aria-expanded','false');};
  },[!!point]);
  if (!selection) return null;
  return <>
    {point&&createPortal(<div ref={ref} className="object-context-menu" data-testid="object-context-menu" role="menu" aria-label="Object actions" style={point}
      onClick={e=>e.stopPropagation()}
      onPointerDown={e=>e.stopPropagation()} onKeyDown={e=>{
        e.stopPropagation();
        if(e.key==='Escape'||e.key==='ArrowLeft'){e.preventDefault();setPoint(null);trigger.current?.focus();}
        if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){
          e.preventDefault();const buttons=[...e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
          const i=buttons.indexOf(document.activeElement as HTMLButtonElement);
          buttons[e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowDown'?1:buttons.length-1))%buttons.length]?.focus();
        }
      }}>
          <section>
            
            <div className="layers-action-grid">
              {onProperties&&<button role="menuitem" onClick={()=>{
                if(host.isConnected&&currentSelection()===openedSelection.current)onProperties();
                setPoint(null);
              }}><MenuIcon name="Settings" />Properties</button>}
              <button role="menuitem" disabled={!canvasSelectionEditable(host)} title="Duplicate (⌘/Ctrl+D)"
                onClick={() => void duplicateCanvasSelection(host).catch(cause => setActionError(String(cause)))}><MenuIcon name="duplicate" />Duplicate</button>
              <button role="menuitem" disabled={!selectedLayerCanGroup(host)} title="Group (⌘/Ctrl+G)"
                onClick={() => groupCanvasSelection(host)}><MenuIcon name="group" />Group</button>
              <button role="menuitem" disabled={!selectedLayerCanUngroup(host)} title="Ungroup (⌘/Ctrl+Shift+G)"
                onClick={() => ungroupCanvasSelection(host)}><MenuIcon name="ungroup" />Ungroup</button>
              {selection.count>1&&(['left', 'center-x', 'right', 'top', 'center-y', 'bottom', 'distribute-x', 'distribute-y'] as AlignmentAction[]).map(action =>
                <button role="menuitem" key={action} disabled={!canvasSelectionEditable(host) || selection.count < (action.startsWith('distribute') ? 3 : 2)}
                  onClick={() => alignCanvasSelection(host, action)}><MenuIcon name={action} />{`Align ${action}`}</button>)}
              {(['front', 'back'] as const).map(direction => <button role="menuitem" key={direction}
                disabled={selection.count !== 1 || !canvasSelectionEditable(host)}
                onClick={() => reorderCanvasLayer(host, selection.key, direction)}><MenuIcon name={direction} />{`To ${direction}`}</button>)}
              {selection.count === 1 && <button role="menuitem" disabled={host.store.readonly} onClick={() => {
                if (!host.isConnected || currentSelection() !== openedSelection.current) return;
                const model = host.std.get(GfxControllerIdentifier).getElementById<GfxModel>(selection.key);
                if (model && canvasModelVisible(model)) { const target = canvasLayerLockTarget(host, model.id); setCanvasLayerLocked(host, target.id, !target.isLockedBySelf()); }
                setImageRevision(value => value + 1);
              }}><MenuIcon name="lock" />{host.std.get(GfxControllerIdentifier).getElementById<GfxModel>(selection.key)?.isLocked() ? 'Unlock object' : 'Lock object'}</button>}
            </div>
          </section>
      {actionError&&<p role="alert">{actionError}</p>}
    </div>,document.body)}
  </>;
}
