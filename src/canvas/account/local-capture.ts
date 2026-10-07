import * as Y from 'yjs';
import type { AccountJournal, RecoveryCheckpoint } from './outbox';

export const RECOVERY_HYDRATION_ORIGIN = 'dali-recovery-hydration';
export const RECOVERY_REPLAY_ORIGIN = 'dali-recovery-replay';
/** This observer remains attached when the native sync peer disconnects. */
export function attachLocalCapture(options: { journal: AccountJournal; root: Y.Doc; content: Y.Doc; title: string; isCurrent?: () => boolean; actionId?: () => string | undefined; persistedCheckpoint?: RecoveryCheckpoint }) {
  const { journal, root, content } = options;
  let disposed = false;
  const capture = (data: Uint8Array, origin: unknown, doc: Y.Doc, transaction: Y.Transaction) => {
    if (disposed || options.isCurrent?.() === false || !transaction.local || origin === 'load' || origin === RECOVERY_HYDRATION_ORIGIN || origin === RECOVERY_REPLAY_ORIGIN) return;
    // captureUpdate copies immediately, before this synchronous event returns.
    void journal.captureUpdate(doc.guid, data, options.actionId?.()).catch(() => undefined);
  };
  root.on('update', capture); content.on('update', capture);
  const assets: Record<string, {}> = {};
  content.getMap<Y.Map<unknown>>('blocks').forEach(block => {
    if (block.get('sys:flavour') === 'affine:image') { const key = block.get('prop:sourceId'); if (typeof key === 'string') assets[key] = {}; }
  });
  if (options.persistedCheckpoint) journal.adoptCheckpoint(options.persistedCheckpoint);
  const ready = options.persistedCheckpoint ? Promise.resolve() : journal.checkpoint({ root: { docId: root.guid, data: Y.encodeStateAsUpdate(root) }, content: { docId: content.guid, data: Y.encodeStateAsUpdate(content) }, title: options.title, assets });
  return { ready, dispose() { disposed = true; root.off('update', capture); content.off('update', capture); }, preserve: () => journal.preserve() };
}
