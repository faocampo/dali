import { MindmapElementModel, ShapeElementModel, type NodeDetail } from '@blocksuite/affine/model';
import type { EditorHost } from '@blocksuite/affine/std';
import { GfxControllerIdentifier, generateKeyBetweenV2, type GfxPrimitiveElementModel } from '@blocksuite/affine/std/gfx';
import { nativeMindmapState } from './selection-summary';

type Raw = Record<string, unknown> & { id: string; type: string };
type Branch = Raw & { children: Record<string, NodeDetail>; daliMindmapBranch: 1 };
type Created = { canvasElements: GfxPrimitiveElementModel[]; blockModels: never[] };
type Validate = (values: readonly unknown[]) => void;

function topic(host: EditorHost, id?: string) {
  const gfx = host.std.get(GfxControllerIdentifier);
  const model = id ? gfx.surface?.getElementById(id) : gfx.selection.selectedElements.length === 1 ? gfx.selection.selectedElements[0] : null;
  return model instanceof ShapeElementModel && model.group instanceof MindmapElementModel ? model : null;
}

function mutable(host: EditorHost, map: MindmapElementModel) {
  if (!host.isConnected || host.store.readonly || map.surface.store !== host.store || map.surface.getElementById(map.id) !== map || map.isLocked()) throw new Error('The mind-map copy destination is unavailable.');
  const state = nativeMindmapState(map);
  if ([...state.byId.keys()].some(id => map.surface.getElementById(id)!.isLocked()) || [...state.depth.values()].some(depth => depth > 128)) throw new Error('The mind map cannot be copied in its current state.');
  return state;
}

/** A portable native map snapshot; the marker exists only in clipboard data. */
function snapshot(host: EditorHost, shape: ShapeElementModel): Raw[] {
  const map = shape.group as MindmapElementModel;
  const state = mutable(host, map);
  if (!state.visible.has(shape.id)) throw new Error('Select a visible topic to copy.');
  const ids = [shape.id];
  for (let cursor = 0; cursor < ids.length; cursor++) ids.push(...state.children.get(ids[cursor]!)!);
  const data = structuredClone(map.serialize()) as unknown as Branch;
  data.children = Object.fromEntries(ids.map(id => [id, { ...map.children.get(id)! }]));
  delete data.children[shape.id]!.parent;
  data.daliMindmapBranch = 1;
  return [...ids.map(id => structuredClone(map.surface.getElementById(id)!.serialize()) as Raw), data];
}

export function installMindmapBranchClipboard(host: EditorHost, validate: Validate) {
  const clipboard = host.std.clipboard;
  const nativeWrite = clipboard.writeToClipboard;
  const store = host.store;
  clipboard.writeToClipboard = update => {
    const source = !host.std.get(GfxControllerIdentifier).selection.editing ? topic(host) : null;
    const branch = source ? snapshot(host, source) : null;
    return nativeWrite.call(clipboard, async items => {
      const result = await update(items);
      // Text editing and unrelated clipboard writes retain their native payload.
      if (branch && typeof result['blocksuite/surface'] === 'string') {
        const original = JSON.parse(result['blocksuite/surface'] as string) as { snapshot?: Raw[] };
        if (original.snapshot?.length === 1 && original.snapshot[0]?.id === source!.id) {
          if (host.store !== store || !source || source.surface.getElementById(source.id) !== source) throw new Error('The copied topic is no longer available.');
          mutable(host, source.group as MindmapElementModel); validate(branch);
          return { ...result, 'blocksuite/surface': JSON.stringify({ snapshot: branch, blobs: {} }) };
        }
      }
      return result;
    });
  };
  return () => { clipboard.writeToClipboard = nativeWrite; };
}

/** Both native Duplicate and clipboard paste reach this native conversion seam. */
export function convertMindmapBranch(
  host: EditorHost,
  input: { elementsRawData: Raw[]; pasteCenter?: number[] },
  convert: (records: Raw[], created: Set<string>) => Promise<Created>,
  validate: Validate,
): Promise<Created> | null {
  const gfx = host.std.get(GfxControllerIdentifier);
  let records = input.elementsRawData;
  // Native Duplicate explicitly supplies its offset center. Clipboard paste does
  // not; matching a pasted shape ID alone must never imply duplication.
  const duplicate = input.pasteCenter && records.length === 1 && records[0]?.type === 'shape' ? topic(host, records[0].id) : null;
  if (duplicate) records = snapshot(host, duplicate);
  const branches = records.filter(record => record.type === 'mindmap' && record.daliMindmapBranch === 1) as Branch[];
  if (!branches.length) return null;
  if (branches.length !== 1) throw new Error('Copy one mind-map branch at a time.');
  validate(records);
  const branch = branches[0]!;
  const roots = Object.keys(branch.children).filter(id => !branch.children[id]!.parent);
  const root = roots[0]!;
  const shapes = records.filter(record => record.type === 'shape');
  if (records.length !== shapes.length + 1 || shapes.length !== Object.keys(branch.children).length) throw new Error('The copied branch has unexpected objects.');
  const selected = topic(host);
  const sourceMap = duplicate?.group as MindmapElementModel | undefined;
  const parent = duplicate ? sourceMap!.children.get(duplicate.id)?.parent : selected?.id;
  const destination = parent ? (duplicate ? sourceMap : selected!.group as MindmapElementModel) : undefined;
  if (gfx.selection.editing) throw new Error('Finish editing before pasting a branch.');
  const store = host.store;
  let index = 'a0';
  if (destination) {
    const state = mutable(host, destination);
    const children = state.children.get(parent!);
    if (!children) throw new Error('The paste parent is no longer available.');
    const branchDepth = Math.max(...nativeBranchDepth(branch));
    if (state.depth.get(parent!)! + 1 + branchDepth > 128) throw new Error('The pasted branch would be too deeply nested.');
    const position = duplicate ? children.indexOf(duplicate.id) : children.length - 1;
    index = generateKeyBetweenV2(children[position] ? destination.children.get(children[position]!)!.index : null,
      duplicate && children[position + 1] ? destination.children.get(children[position + 1]!)!.index : null);
  }
  const createdIds = new Set<string>();
  const revision = (map: MindmapElementModel) => JSON.stringify([map.serialize(), ...[...map.children.keys()].map(id => map.surface.getElementById(id)?.serialize())]);
  const destinationRevision = destination ? revision(destination) : null;
  const sourceRevision = sourceMap ? revision(sourceMap) : null;
  let attached = false;
  const fields = destination ? [...destination.children.keys()].map(id => {
    const node = destination.surface.getElementById(id)!;
    return { node, values: new Map(node.yMap.entries()) };
  }) : [];
  const details = destination ? [...destination.children].map(([id, value]) => [id, { ...value }] as const) : [];
  const mapFields = destination ? new Map(destination.yMap.entries()) : null;
  const clean = records.map(record => { const value = { ...record }; delete value.daliMindmapBranch; return value; });
  store.captureSync();
  return (async () => {
    try {
      const created = await convert(destination ? clean.filter(record => record.type === 'shape') : clean, createdIds);
      if (!host.isConnected || host.store !== store || store.readonly) throw new Error('The paste destination changed.');
      if (duplicate && (duplicate.surface.getElementById(duplicate.id) !== duplicate || duplicate.group !== sourceMap || revision(sourceMap!) !== sourceRevision)) throw new Error('The copied source changed.');
      if (destination) {
        if (revision(destination) !== destinationRevision) throw new Error('The paste destination changed.');
        mutable(host, destination);
        if (!destination.children.has(parent!)) throw new Error('The paste parent was removed.');
        if (created.canvasElements.length !== shapes.length) throw new Error('The branch could not be copied completely.');
        const ids = new Map(shapes.map((shape, i) => [shape.id, created.canvasElements[i]!.id]));
        store.transact(() => {
          attached = true;
          for (const [id, detail] of Object.entries(branch.children)) destination.children.set(ids.get(id)!, {
            ...detail, parent: id === root ? parent : ids.get(detail.parent!), index: id === root ? index : detail.index,
          });
          const detail = destination.children.get(parent!)!;
          if (detail.collapsed) destination.children.set(parent!, { ...detail, collapsed: false });
          destination.buildTree();
          const visible = nativeMindmapState(destination).visible;
          for (const id of destination.children.keys()) destination.surface.getElementById(id)!.hidden = !visible.has(id);
          destination.layout();
        });
        // Native callers select returned models. Select the copied branch root,
        // keeping its hidden descendants out of the visible selection.
        return { canvasElements: [destination.surface.getElementById(ids.get(root)!)!], blockModels: [] };
      }
      const map = created.canvasElements.find(model => model instanceof MindmapElementModel) as MindmapElementModel | undefined;
      if (!map) throw new Error('The independent mind map could not be created.');
      const visible = nativeMindmapState(map).visible;
      store.transact(() => { for (const id of map.children.keys()) map.surface.getElementById(id)!.hidden = !visible.has(id); map.layout(); });
      return { canvasElements: [map], blockModels: [] };
    } catch {
      // Remove only this operation's synchronous native creations. Existing
      // hierarchy, geometry and presentation are restored on failure.
      if (attached && destination && destination.surface.getElementById(destination.id) === destination) store.transact(() => {
        for (const id of [...destination.children.keys()]) if (!details.some(([old]) => old === id)) destination.children.delete(id);
        for (const [id, detail] of details) destination.children.set(id, detail);
        for (const [key, value] of mapFields!) if (key !== 'children' && destination.yMap.get(key) !== value) destination.yMap.set(key, value);
        for (const { node, values } of fields) {
          for (const key of [...node.yMap.keys()]) if (!values.has(key)) node.yMap.delete(key);
          for (const [key, value] of values) if (node.yMap.get(key) !== value) node.yMap.set(key, value);
        }
        destination.buildTree();
      });
      for (const id of createdIds) if (gfx.surface!.getElementById(id)) gfx.surface!.deleteElement(id);
      return { canvasElements: [], blockModels: [] };
    } finally { store.captureSync(); }
  })();
}

function nativeBranchDepth(branch: Branch) {
  return Object.keys(branch.children).map(id => {
    let depth = 0; let parent = branch.children[id]!.parent;
    while (parent) { depth++; parent = branch.children[parent]!.parent; }
    return depth;
  });
}
