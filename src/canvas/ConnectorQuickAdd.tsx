import { useEffect, useState } from 'react';
import type { EditorHost } from '@blocksuite/affine/std';
import { GfxControllerIdentifier } from '@blocksuite/affine/std/gfx';
import { ConnectorElementModel, ShapeType } from '@blocksuite/affine/model';
import { EdgelessCRUDIdentifier } from '@blocksuite/affine/blocks/surface';

/** Complete either end of a free connector with an editable shape. */
export function ConnectorQuickAdd({ host }: { host: EditorHost }) {
  const gfx = host.std.get(GfxControllerIdentifier);
  const [selection, setSelection] = useState<{ model: ConnectorElementModel; source: [number, number]; target: [number, number] } | null>(null);
  useEffect(() => {
    const sync = () => {
      const models = gfx.selection.selectedElements;
      const model = models[0];
      if (models.length !== 1 || !(model instanceof ConnectorElementModel) || model.isLocked() || host.store.readonly || gfx.selection.editing) return setSelection(null);
      const endpoint = (end: 'source' | 'target'): [number, number] => {
        const [x, y] = model[end].position ?? [model.x, model.y];
        const [vx, vy] = gfx.viewport.toViewCoord(x!, y!);
        return [vx!, vy!];
      };
      setSelection({ model, source: endpoint('source'), target: endpoint('target') });
    };
    sync();
    const subscriptions = [gfx.selection.slots.updated.subscribe(sync), gfx.viewport.viewportUpdated.subscribe(sync), gfx.surface!.elementUpdated.subscribe(sync)];
    return () => subscriptions.forEach(subscription => subscription.unsubscribe());
  }, [gfx, host]);
  if (!selection) return null;
  const add = (end: 'source' | 'target') => {
    const model = selection.model;
    if (model.isLocked() || host.store.readonly || model[end].id) return;
    const [px, py] = model[end].position ?? [model.x, model.y];
    const x = px! + (end === 'source' ? -180 : 20);
    host.store.captureSync();
    host.store.transact(() => {
      const id = host.std.get(EdgelessCRUDIdentifier).addElement('shape', { shapeType: ShapeType.Rect, xywh: `[${x},${py! - 40},160,80]`, text: 'New shape' });
      if (!id) return;
      model[end] = { id, position: end === 'source' ? [1, 0.5] : [0, 0.5] };
      gfx.selection.set({ elements: [id], editing: false });
    });
    host.store.captureSync();
  };
  return <>{(['source', 'target'] as const).filter(end => !selection.model[end].id).map(end => <button key={end} className="connector-quick-add" type="button" title={`Add shape at ${end === 'source' ? 'start' : 'end'}`} aria-label={`Add shape at connector ${end === 'source' ? 'start' : 'end'}`} style={{ left: selection[end][0] + (end === 'source' ? -40 : 12), top: selection[end][1] - 14 }} onPointerDown={event => event.stopPropagation()} onClick={() => add(end)}><svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16"><path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.5" /></svg></button>)}</>;
}
