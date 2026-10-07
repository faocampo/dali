import { validateMindmapState, type MindmapTopicSnapshot } from './mindmap-state';

export type MindmapExportSnapshot = Readonly<{
  mapId: string;
  topicIds: readonly string[];
  edges: readonly Readonly<{ source: string; target: string }>[];
  collapsed: boolean;
}>;

/** Immutable authorization derived from native hierarchy; no document writes. */
export function mindmapExportSnapshot(mapId: string, topics: readonly MindmapTopicSnapshot[], included?: ReadonlySet<string>): MindmapExportSnapshot {
  const state = validateMindmapState(topics);
  if ([...state.depth.values()].some(depth => depth > 128)) throw new Error('The mind map is too deeply nested to export.');
  const topicIds = topics.filter(node => state.visible.has(node.id) && (!included || included.has(node.id))).map(node => node.id);
  const ids = new Set(topicIds);
  return Object.freeze({ mapId, topicIds: Object.freeze(topicIds),
    edges: Object.freeze(topics.filter(node => ids.has(node.id) && node.parent && ids.has(node.parent))
      .map(node => Object.freeze({ source: node.parent!, target: node.id }))),
    collapsed: topics.some(node => ids.has(node.id) && node.collapsed && state.children.get(node.id)!.length > 0),
  });
}
