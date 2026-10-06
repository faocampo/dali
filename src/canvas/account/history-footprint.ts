import * as Y from 'yjs';
import { changedNativeObjects, changedNativeProperties, nativeObjectIds, nativeReservationTargets } from '../../../server/boards/change-footprint';

const key = Symbol('dali-history-objects');
const eligibilityKey = Symbol('dali-history-eligibility');
export type HistoryEligibility = { baseline: number; paths: import('../../../server/boards/personal-history').PropertyPath[] };
export const historyEligibility = (item: Item): HistoryEligibility | undefined => item.meta.get(eligibilityKey) as HistoryEligibility | undefined;
type Item = { meta: Map<unknown, unknown> };
/** Record semantic effects alongside native history; remote transactions stay untracked. */
export function trackHistoryFootprints(doc: Y.Doc, manager: Y.UndoManager, revision: () => number = () => 0): () => void {
  const snapshots = new Map<Y.Transaction, Y.Doc>();
  const before = (transaction: Y.Transaction) => {
    if (!manager.trackedOrigins.has(transaction.origin)) return;
    const snapshot = new Y.Doc();
    Y.applyUpdate(snapshot, Y.encodeStateAsUpdate(doc));
    snapshots.set(transaction, snapshot);
  };
  const recorded = (event: { stackItem: Item; changedParentTypes: Map<unknown, Y.YEvent<Y.AbstractType<unknown>>[]> }) => {
    const transaction = [...event.changedParentTypes.values()].flat()[0]?.transaction;
    const snapshot = transaction && snapshots.get(transaction);
    const ids = snapshot ? changedNativeObjects(snapshot, doc) : null;
    const paths = snapshot ? changedNativeProperties(snapshot, doc) : null;
    const prior = event.stackItem.meta.get(eligibilityKey) as HistoryEligibility | undefined;
    if (paths) event.stackItem.meta.set(eligibilityKey, { baseline: prior?.baseline ?? revision(), paths: [...new Map([...(prior?.paths ?? []), ...paths].map(path => [JSON.stringify(path), path])).values()] });
    const previous = event.stackItem.meta.get(key) as string[] | null | undefined;
    event.stackItem.meta.set(key, !ids || previous === null ? null : [...new Set([...(previous ?? []), ...ids])].sort());
  };
  const after = (transaction: Y.Transaction) => { snapshots.get(transaction)?.destroy(); snapshots.delete(transaction); };
  doc.on('beforeTransaction', before); doc.on('afterTransaction', after);
  manager.on('stack-item-added', recorded); manager.on('stack-item-updated', recorded);
  return () => {
    doc.off('beforeTransaction', before); doc.off('afterTransaction', after);
    manager.off('stack-item-added', recorded); manager.off('stack-item-updated', recorded);
    for (const snapshot of snapshots.values()) snapshot.destroy(); snapshots.clear();
  };
}

export function historyReservationTargets(doc: Y.Doc, item: Item | undefined): { ids: string[]; create: boolean } | null {
  const effects = item?.meta.get(key) as string[] | null | undefined;
  if (!effects?.length) return null;
  try {
    const existing = nativeObjectIds(doc);
    const ids = nativeReservationTargets(doc, effects.filter(id => existing.has(id)), true);
    if (!ids) return null;
    if (effects.includes('$dali:metadata')) ids.push('$dali:metadata');
    return { ids: [...new Set(ids)].sort(), create: effects.some(id => id !== '$dali:metadata' && !existing.has(id)) };
  } catch { return null; }
}
