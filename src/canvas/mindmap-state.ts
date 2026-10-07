/** Read-only projection of native child details and shape bounds; never persisted. */
export interface MindmapTopicSnapshot {
  id: string;
  parent?: string;
  index: string;
  collapsed?: boolean;
  bounds: readonly number[];
}

export function validateMindmapState(input: readonly MindmapTopicSnapshot[]) {
  const invalid = () => new Error('The mind map contains invalid hierarchy or geometry.');
  if (!input.length) throw invalid();
  const byId = new Map<string, MindmapTopicSnapshot>();
  const children = new Map<string, string[]>();
  let root = '';
  let work = 0;
  const budget = input.length * 3;
  for (const node of input) {
    if (++work > budget || !node || typeof node.id !== 'string' || !node.id || byId.has(node.id) ||
        typeof node.index !== 'string' || !node.index || !Array.isArray(node.bounds) || node.bounds.length !== 4 ||
        !node.bounds.every(Number.isFinite) || node.bounds[2]! < 0 || node.bounds[3]! < 0 ||
        (node.collapsed !== undefined && typeof node.collapsed !== 'boolean')) throw invalid();
    byId.set(node.id, node); children.set(node.id, []);
    if (node.parent === undefined) { if (root) throw invalid(); root = node.id; }
  }
  if (!root) throw invalid();
  const orders = new Map<string, Set<string>>();
  for (const node of input) {
    if (++work > budget) throw invalid();
    if (node.parent !== undefined) {
      if (!byId.has(node.parent)) throw invalid();
      const keys = orders.get(node.parent) ?? new Set<string>();
      if (keys.has(node.index)) throw invalid();
      keys.add(node.index); orders.set(node.parent, keys);
      children.get(node.parent)!.push(node.id);
    }
  }
  const visible = new Set<string>();
  const hiddenAncestor = new Map<string, string>();
  const depth = new Map<string, number>();
  const queue = [root]; depth.set(root, 0);
  const visited = new Set<string>();
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const id = queue[cursor]!;
    if (++work > budget || visited.has(id)) throw invalid();
    visited.add(id);
    const node = byId.get(id)!;
    const ancestor = hiddenAncestor.get(id);
    if (!ancestor) visible.add(id);
    for (const child of children.get(id)!) {
      depth.set(child, depth.get(id)! + 1);
      if (ancestor || node.collapsed) hiddenAncestor.set(child, ancestor ?? id);
      queue.push(child);
    }
  }
  if (visited.size !== input.length) throw invalid();
  for (const list of children.values()) list.sort((a, b) => byId.get(a)!.index < byId.get(b)!.index ? -1 : 1);
  return { root, byId, children, visible, hiddenAncestor, depth, work };
}
