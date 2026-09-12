import { fitContent } from '@blocksuite/affine/gfx/shape';
import { MindmapElementModel, ShapeElementModel } from '@blocksuite/affine/model';
import type { EditorHost } from '@blocksuite/affine/std';
import { GfxControllerIdentifier } from '@blocksuite/affine/std/gfx';

/** Validate native membership before any adapter writes; no secondary tree schema. */
function shapes(map: MindmapElementModel): ShapeElementModel[] {
  const result: ShapeElementModel[] = [];
  let roots = 0;
  for (const [id, detail] of map.children) {
    const shape = map.surface.getElementById(id);
    if (!(shape instanceof ShapeElementModel) || ![shape.x, shape.y, shape.w, shape.h].every(Number.isFinite)) {
      throw new Error('The mind map contains invalid topic geometry.');
    }
    if (!detail.parent) roots++;
    const visited = new Set([id]);
    let parent = detail.parent;
    while (parent) {
      if (visited.has(parent) || !map.children.has(parent)) throw new Error('The mind map contains invalid topic parents.');
      visited.add(parent);
      parent = map.children.get(parent)!.parent;
    }
    result.push(shape);
  }
  if (result.length && roots !== 1) throw new Error('The mind map must contain one central topic.');
  return result;
}

function installModel(host: EditorHost, map: MindmapElementModel) {
  let active = true;
  let arranging = false;
  let style = map.style;
  const original = { layout: map.layout, setLayoutMethod: map.setLayoutMethod,
    requestLayout: map.requestLayout, toggleCollapse: map.toggleCollapse };
  const nativeLayout = map.layout.bind(map);
  const nativeSetLayout = map.setLayoutMethod.bind(map);
  const nativeCollapse = map.toggleCollapse.bind(map);
  const writable = () => active && host.isConnected && !host.store.readonly &&
    map.surface.getElementById(map.id) === map && !map.isLocked();

  map.layout = (tree = map.tree, options = {}) => {
    if (!writable() || arranging || !tree?.element) return;
    const nodes = shapes(map);
    if (nodes.some(node => node.isLocked())) return;
    const typography = nodes.map(node => ({ node, fontSize: node.fontSize, fontWeight: node.fontWeight, color: node.color }));
    arranging = true;
    try {
      // A preset can change native shapes/branches. Existing text fields stay authoritative.
      if (style !== map.style) {
        nativeLayout(tree, { ...options, applyStyle: true, stashed: false });
        style = map.style;
      }
      for (const { node, ...text } of typography) {
        Object.assign(node, text);
        fitContent(node);
      }
      nativeLayout(tree, { ...options, applyStyle: false, stashed: false });
    } finally { arranging = false; }
  };
  // The native view supplies this delegate on creation and on subsequent remounts.
  map.setLayoutMethod = method => { if (active) nativeSetLayout(method); };
  // Every model request is drained synchronously; an old captured callback still checks lifecycle.
  map.requestLayout = () => { if (writable()) map.layout(); };
  map.toggleCollapse = (node, _options = {}) => {
    if (!writable() || !map.children.has(node.id)) return;
    const nodes = shapes(map);
    if (nodes.some(shape => shape.isLocked())) return;
    const details = [...map.children].map(([id, detail]) => [id, { ...detail }] as const);
    const fields = nodes.map(shape => ({ shape, xywh: shape.xywh, hidden: shape.hidden,
      fontSize: shape.fontSize, fontWeight: shape.fontWeight, color: shape.color }));
    let failure: unknown;
    host.store.captureSync();
    host.store.transact(() => {
      try {
        nativeCollapse(node, { layout: false });
        map.buildTree();
        map.layout();
        shapes(map);
      } catch (cause) {
        failure = cause;
        for (const [id, detail] of details) map.children.set(id, detail);
        for (const { shape, ...props } of fields) Object.assign(shape, props);
        map.buildTree();
      }
    });
    host.store.captureSync();
    if (failure) throw failure;
  };
  return () => {
    active = false;
    Object.assign(map, original);
  };
}

/** Scope all adapters to the mounted document; disposal invalidates retained callbacks. */
export function installMindmapCompatibility(host: EditorHost): () => void {
  const surface = host.std.get(GfxControllerIdentifier).surface;
  if (!surface) return () => {};
  const disposers = new Map<string, () => void>();
  const attach = (id: string) => {
    const model = surface.getElementById(id);
    if (model instanceof MindmapElementModel && !disposers.has(id)) disposers.set(id, installModel(host, model));
  };
  surface.elementModels.forEach(model => attach(model.id));
  const added = surface.elementAdded.subscribe(({ id }) => attach(id));
  const removed = surface.elementRemoved.subscribe(({ id }) => { disposers.get(id)?.(); disposers.delete(id); });
  return () => {
    added.unsubscribe(); removed.unsubscribe();
    disposers.forEach(dispose => dispose()); disposers.clear();
  };
}
