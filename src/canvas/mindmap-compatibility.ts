import { fitContent } from '@blocksuite/affine/gfx/shape';
import { createElementsFromClipboardDataCommand } from '@blocksuite/affine/blocks/root';
import { EdgelessCRUDIdentifier } from '@blocksuite/affine/blocks/surface';
import { MindmapElementModel, ShapeElementModel } from '@blocksuite/affine/model';
import type { EditorHost } from '@blocksuite/affine/std';
import { GfxControllerIdentifier, isGfxGroupCompatibleModel, type GfxModel } from '@blocksuite/affine/std/gfx';
import type { Store } from '@blocksuite/affine/store';

const MAX_COPY_ELEMENTS = 10_000;
const copySources = new WeakMap<EditorHost, () => boolean>();

/** Validate the existing serialized native representation before native conversion writes. */
export function validateMindmapCopyData(values: readonly unknown[]): void {
  const records = values as Record<string, unknown>[];
  if (!records.some(value => value?.type === 'mindmap')) return;
  if (records.length > MAX_COPY_ELEMENTS) throw new Error('The copied mind map is too large.');
  const byId = new Map<string, Record<string, unknown>>();
  for (const value of records) {
    if (!value || typeof value !== 'object' || typeof value.id !== 'string' || byId.has(value.id)) throw new Error('The copied mind map has invalid identities.');
    byId.set(value.id, value);
    if (typeof value.type === 'string') {
      const bound: unknown = typeof value.xywh === 'string' ? JSON.parse(value.xywh) : null;
      if (!Array.isArray(bound) || bound.length !== 4 || !bound.every(n => typeof n === 'number' && Number.isFinite(n)) || bound[2] < 0 || bound[3] < 0) throw new Error('The copied mind map has invalid geometry.');
    }
  }
  const claimed = new Set<string>();
  for (const record of records.filter(value => value.type === 'mindmap')) {
    if (!record.children || typeof record.children !== 'object' || Array.isArray(record.children)) throw new Error('The copied mind map has invalid hierarchy.');
    const entries = Object.entries(record.children) as [string, { parent?: string; index: string; collapsed?: boolean }][];
    if (!entries.length || entries.length > MAX_COPY_ELEMENTS) throw new Error('The copied mind map has invalid topic count.');
    const details = new Map(entries);
    let roots = 0;
    for (const [id, detail] of entries) {
      if (claimed.has(id) || byId.get(id)?.type !== 'shape' || !detail || typeof detail.index !== 'string' ||
          (detail.collapsed !== undefined && typeof detail.collapsed !== 'boolean') ||
          (detail.parent !== undefined && (typeof detail.parent !== 'string' || !details.has(detail.parent)))) throw new Error('The copied mind map has invalid topic details.');
      claimed.add(id);
      if (detail.parent === undefined) roots++;
    }
    if (roots !== 1) throw new Error('The copied mind map must contain one central topic.');
    const complete = new Set<string>();
    for (const [start] of entries) {
      const path = new Set<string>();
      let id: string | undefined = start;
      while (id !== undefined && !complete.has(id)) {
        if (path.has(id)) throw new Error('The copied mind map contains a cycle.');
        path.add(id); id = details.get(id)!.parent;
      }
      path.forEach(id => complete.add(id));
    }
  }
}

export function validateMindmapDocument(store: Store): void {
  const surface = store.getBlocksByFlavour('affine:surface')[0]?.model as { elementModels?: { serialize(): unknown }[] } | undefined;
  validateMindmapCopyData(surface?.elementModels?.map(model => model.serialize()) ?? []);
}

/** Source identity is captured by the caller, independently of later selection changes. */
export function nativeCopySourcesValid(host: EditorHost, source: readonly GfxModel[], store: Store): boolean {
  if (!host.isConnected || host.store !== store || store.readonly || !source.length) return false;
  const gfx = host.std.get(GfxControllerIdentifier);
  const visited = new Set<string>();
  const pending = [...source];
  while (pending.length) {
    const model = pending.pop()!;
    if (visited.has(model.id)) continue;
    if (visited.size >= MAX_COPY_ELEMENTS || model.isLocked() || (gfx.surface?.getElementById(model.id) ?? store.getModelById(model.id)) !== model) return false;
    visited.add(model.id);
    if (isGfxGroupCompatibleModel(model)) pending.push(...model.childElements);
  }
  return true;
}

export async function withNativeCopySources(host: EditorHost, source: readonly GfxModel[], action: () => Promise<void>): Promise<void> {
  const store = host.store;
  const guard = () => nativeCopySourcesValid(host, source, store);
  if (!guard()) return;
  validateMindmapDocument(store);
  copySources.set(host, guard);
  try { await action(); }
  finally { if (copySources.get(host) === guard) copySources.delete(host); }
}

function installCopyBoundary(host: EditorHost): () => void {
  const store = host.store;
  const manager = host.std.command;
  const nativeExec = manager.exec;
  const crud = host.std.get(EdgelessCRUDIdentifier);
  const nativeAdd = crud.addElement;
  let active = true;
  const current = () => active && host.isConnected && host.store === store && !store.readonly && (copySources.get(host)?.() ?? true);
  manager.exec = ((command, input) => {
    if ((command as unknown) === createElementsFromClipboardDataCommand) {
      try {
        if (!current()) return [false, { std: host.std }];
        validateMindmapCopyData((input as { elementsRawData: unknown[] }).elementsRawData);
      } catch { return [false, { std: host.std }]; }
    }
    return nativeExec(command, input);
  }) as typeof manager.exec;
  crud.addElement = ((...args: Parameters<typeof crud.addElement>) => {
    if (!current()) throw new Error('The copy destination is no longer editable.');
    return nativeAdd.apply(crud, args);
  }) as typeof crud.addElement;
  return () => { active = false; manager.exec = nativeExec; crud.addElement = nativeAdd; copySources.delete(host); };
}

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
  const disposeCopyBoundary = installCopyBoundary(host);
  const disposers = new Map<string, () => void>();
  const attach = (id: string) => {
    const model = surface.getElementById(id);
    if (model instanceof MindmapElementModel && !disposers.has(id)) disposers.set(id, installModel(host, model));
  };
  surface.elementModels.forEach(model => attach(model.id));
  const added = surface.elementAdded.subscribe(({ id }) => attach(id));
  const removed = surface.elementRemoved.subscribe(({ id }) => { disposers.get(id)?.(); disposers.delete(id); });
  return () => {
    disposeCopyBoundary();
    added.unsubscribe(); removed.unsubscribe();
    disposers.forEach(dispose => dispose()); disposers.clear();
  };
}
