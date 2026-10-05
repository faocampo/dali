import * as Y from 'yjs';
function nativeValue(value: unknown): unknown {
  if (value instanceof Y.Text) return value.toDelta().map((part: { insert: unknown; attributes?: Record<string, unknown> }) => ({ ...part, insert: nativeValue(part.insert) }));
  if (value instanceof Y.Map) return Object.fromEntries([...value.entries()].map(([key, child]) => [key, nativeValue(child)]));
  if (value instanceof Y.Array) return value.toArray().map(nativeValue);
  if (value instanceof Y.AbstractType || value instanceof Y.Doc) throw new Error('Unsupported native type');
  if (Array.isArray(value)) return value.map(nativeValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, nativeValue(child)]));
  return value;
}
const stable = (value: unknown): string => JSON.stringify(value, (_key, item: unknown) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
const without = (object: Record<string, unknown>, ...keys: string[]) => Object.fromEntries(Object.entries(object).filter(([name]) => !keys.includes(name)));
type NativeObject = Record<string, unknown>;
type NativeSnapshot = { objects: Map<string, NativeObject>; parents: Map<string, string>; roots: Record<string, unknown>; metadata: unknown; rootChildren: Record<string, string[]> };
const surfaceTypes = new Set(['shape', 'text', 'brush', 'connector', 'group']);
const blockTypes = new Set(['affine:note', 'affine:frame', 'affine:image', 'affine:edgeless-text', 'affine:paragraph', 'affine:list', 'djai:image-visual-edit']);
const canvasContainer = (object?: NativeObject) => object?.type === 'group' || object?.['sys:flavour'] === 'affine:frame';
const children = (object?: NativeObject): string[] => {
  if (!object) return [];
  const values = object.type === 'group' ? Object.keys((object.children ?? {}) as object)
    : object['sys:flavour'] === 'affine:frame' ? Object.keys((object['prop:childElementIds'] ?? {}) as object) : object['sys:children'] ?? [];
  if (!Array.isArray(values) || values.some(value => typeof value !== 'string')) throw new Error('Invalid children');
  return values;
};
function snapshot(doc: Y.Doc): NativeSnapshot {
  const blocks = nativeValue(doc.getMap('blocks')) as Record<string, NativeObject>;
  const result: NativeSnapshot = { objects: new Map(), parents: new Map(), roots: {}, metadata: nativeValue(doc.getMap('meta')), rootChildren: {} };
  const add = (id: string, object: NativeObject) => {
    if (result.objects.has(id) || result.roots[id]) throw new Error('Duplicate native identifier');
    result.objects.set(id, object);
  };
  for (const [id, block] of Object.entries(blocks)) {
    if (result.objects.has(id)) throw new Error('Duplicate native identifier');
    if (block['sys:flavour'] === 'affine:surface') {
      const box = block['prop:elements'] as NativeObject;
      if (!box || !box.value || typeof box.value !== 'object') throw new Error('Invalid native container');
      result.roots[id] = { ...without(block, 'prop:elements', 'sys:children'), container: without(box, 'value') };
      result.rootChildren[id] = children(block);
      for (const [elementId, element] of Object.entries(box.value as Record<string, NativeObject>)) add(elementId, element);
    } else if (block['sys:flavour'] === 'affine:page') {
      result.roots[id] = without(block, 'sys:children'); result.rootChildren[id] = children(block);
    } else add(id, block);
  }
  if (result.objects.size > 10000) throw new Error('Too many native objects');
  for (const [id, object] of result.objects) {
    if (id.startsWith('$dali:')) throw new Error('Reserved object identifier');
    for (const child of children(object)) {
      if (!result.objects.has(child)) throw new Error('Missing native child');
      if (result.parents.has(child)) throw new Error('Ambiguous parent');
      result.parents.set(child, id);
    }
  }
  const checked = new Set<string>();
  for (const id of result.objects.keys()) {
    const path = new Set<string>(); let current: string | undefined = id;
    while (current && !checked.has(current)) {
      if (path.has(current)) throw new Error('Cyclic native group');
      path.add(current); current = result.parents.get(current);
    }
    for (const entry of path) checked.add(entry);
  }
  return result;
}
function descendants(state: NativeSnapshot, id: string, affected: Set<string>, visiting = new Set<string>()) {
  if (visiting.has(id)) throw new Error('Cyclic native group');
  visiting.add(id); affected.add(id);
  for (const child of children(state.objects.get(id))) descendants(state, child, affected, visiting);
  visiting.delete(id);
}
function valid(object: NativeObject | undefined) {
  if (!object) return true;
  if (typeof object.type === 'string' ? !surfaceTypes.has(object.type) : !blockTypes.has(object['sys:flavour'] as string)) return false;
  const encoded = object.xywh ?? object['prop:xywh'];
  if (encoded !== undefined) {
    let bounds: unknown; try { bounds = JSON.parse(encoded as string); } catch { return false; }
    if (!Array.isArray(bounds) || bounds.length !== 4 || !bounds.every(Number.isFinite) || bounds[2] < 0 || bounds[3] < 0) return false;
  }
  return true;
}
/** Isolated native candidate comparison; rich-text attributes remain visible. */
export function changedNativeObjects(before: Y.Doc, after: Y.Doc): string[] | null {
  try {
    const old = snapshot(before); const next = snapshot(after); const affected = new Set<string>();
    if (stable(old.roots) !== stable(next.roots)) return null;
    if (stable(old.metadata) !== stable(next.metadata)) affected.add('$dali:metadata');
    const all = new Set([...old.objects.keys(), ...next.objects.keys()]);
    for (const id of all) {
      const previous = old.objects.get(id); const current = next.objects.get(id);
      if (stable(previous) === stable(current)) continue;
      if (!valid(previous) || !valid(current) || (previous && current && (previous.type !== current.type || previous['sys:flavour'] !== current['sys:flavour']))) return null;
      affected.add(id);
      if (children(previous).length || children(current).length) { descendants(old, id, affected); descendants(next, id, affected); }
      // Text blocks are part of the note/text object rather than independently editable canvas objects.
      for (const state of [old, next]) {
        let parent = state.parents.get(id); const seen = new Set<string>();
        while (parent && !seen.has(parent)) {
          seen.add(parent); const container = state.objects.get(parent);
          if (canvasContainer(container) && old.parents.get(id) === next.parents.get(id)) break;
          affected.add(parent); parent = state.parents.get(parent);
        }
      }
      if (previous?.['sys:flavour'] === 'djai:image-visual-edit' || current?.['sys:flavour'] === 'djai:image-visual-edit') {
        for (const [state, adjustment] of [[old, previous], [next, current]] as const) {
          if (!adjustment) continue;
          const owner = adjustment['prop:imageId'];
          if (typeof owner !== 'string' || state.objects.get(owner)?.['sys:flavour'] !== 'affine:image') return null;
          affected.add(owner);
        }
      }
      if (previous?.type === 'connector' || current?.type === 'connector') {
        if (stable(previous?.source) !== stable(current?.source) || stable(previous?.target) !== stable(current?.target)) {
          for (const object of [previous, current]) for (const end of ['source', 'target']) {
            const endpoint = object?.[end] as { id?: unknown } | undefined;
            if (typeof endpoint?.id === 'string') affected.add(endpoint.id);
          }
        }
      }
    }
    for (const rootId of new Set([...Object.keys(old.rootChildren), ...Object.keys(next.rootChildren)])) {
      const previous = old.rootChildren[rootId] ?? []; const current = next.rootChildren[rootId] ?? [];
      if (stable(previous) === stable(current)) continue;
      const membershipChanged = [...new Set([...previous, ...current])].filter(id => previous.includes(id) !== current.includes(id));
      if (membershipChanged.length) membershipChanged.forEach(id => affected.add(id)); else affected.add('$dali:metadata');
    }
    for (const id of affected) if (id !== '$dali:metadata' && ((!old.objects.has(id) && !next.objects.has(id)) || !valid(old.objects.get(id)) || !valid(next.objects.get(id)))) return null;
    return [...affected].sort();
  } catch { return null; }
}

/** Shared dependency discovery; the server still derives effects independently at commit. */
export function nativeReservationTargets(doc: Y.Doc, ids: string[], structural = false): string[] | null {
  try {
    const state = snapshot(doc); const affected = new Set<string>();
    for (const id of ids) {
      if (!state.objects.has(id) || !valid(state.objects.get(id))) return null;
      descendants(state, id, affected);
      let parent = state.parents.get(id); const visited = new Set<string>();
      while (parent) {
        if (visited.has(parent)) return null; visited.add(parent);
        const object = state.objects.get(parent);
        if (canvasContainer(object) && !structural) break;
        descendants(state, parent, affected); parent = state.parents.get(parent);
      }
    }
    for (const [id, object] of state.objects) if (object.type === 'connector') {
      const endpoints = [object.source, object.target].map(endpoint => (endpoint as { id?: unknown } | undefined)?.id).filter((id): id is string => typeof id === 'string');
      if (affected.has(id)) endpoints.forEach(endpoint => affected.add(endpoint));
      else if (endpoints.some(endpoint => affected.has(endpoint))) affected.add(id);
    }
    for (const [id, object] of state.objects) if (object['sys:flavour'] === 'djai:image-visual-edit') {
      const owner = object['prop:imageId'];
      if (affected.has(id) || (typeof owner === 'string' && affected.has(owner))) {
        if (typeof owner !== 'string' || state.objects.get(owner)?.['sys:flavour'] !== 'affine:image') return null;
        affected.add(id); affected.add(owner);
      }
    }
    if ([...affected].some(id => !valid(state.objects.get(id)))) return null;
    return [...affected].sort();
  } catch { return null; }
}

export function nativeObjectIds(doc: Y.Doc): Set<string> { return new Set(snapshot(doc).objects.keys()); }
