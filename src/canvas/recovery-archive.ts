import type { DocSnapshot } from '@blocksuite/store';
import { getSessionState } from '../auth/session';
import { validDescriptor } from '../boards/BoardLibrary';
import { getRecoveryRuntime, suspendAccessScope, type AccessScope } from './runtime';
import { canExportRecoveryScope } from './account/mutation-guard';
import { buildSnapshotArchive, downloadBlob, safeFilename } from './export-board';
import { validateMindmapDocument } from './mindmap-compatibility';

export type RecoverySnapshot = Readonly<{ scope: AccessScope; capturedAt: number; title: string; snapshot: DocSnapshot; references: readonly Readonly<{ id: string; label: string }>[] }>;
function freezeSnapshot<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freezeSnapshot); Object.freeze(value); }
  return value;
}
function assertAuthority(scope: AccessScope) {
  const session = getSessionState();
  if (!canExportRecoveryScope(scope) || session.phase !== 'authenticated' || session.member?.accountId !== scope.accountId || session.member.expiresAt <= Date.now()) throw new Error('Recovery download requires current Owner or Editor access. Sign in with the original account and reopen the board.');
}

/** Capture completes synchronously. The transformer and live model are never retained. */
export function captureRecoverySnapshot(): { captured: RecoverySnapshot; readAsset: (id: string) => Promise<Blob | null> } {
  const { runtime, readLocalAsset } = getRecoveryRuntime(); const scope = runtime.scope;
  assertAuthority(scope); validateMindmapDocument(runtime.store);
  const transformer = runtime.store.getTransformer();
  try {
    const snapshot = transformer.docToSnapshot(runtime.store);
    if (!snapshot) throw new Error('The board could not be prepared for recovery.');
    const ids = [...new Set(transformer.assetsManager.getPathBlobIdMap().values())];
    const images = runtime.store.getBlocksByFlavour('affine:image');
    const references = ids.map((id, index) => {
      const props = images.find(image => (image.model.props as { sourceId: string }).sourceId === id)?.model.props as { caption?: unknown } | undefined;
      const caption = typeof props?.caption === 'string' ? props.caption.trim() : '';
      return Object.freeze({ id, label: caption || `Image ${index + 1}` });
    });
    if (images.some(image => !ids.includes((image.model.props as { sourceId: string }).sourceId))) throw new Error('An image reference could not be captured. Keep this tab open and retry.');
    snapshot.meta.title = runtime.descriptor.summary.title;
    const captured = Object.freeze({ scope: Object.freeze({ ...scope }), capturedAt: Date.now(), title: snapshot.meta.title, snapshot: freezeSnapshot(structuredClone(snapshot)), references: Object.freeze(references) });
    return { captured, readAsset: async id => { assertAuthority(scope); const value = await readLocalAsset(id); assertAuthority(scope); return value; } };
  } finally { transformer[Symbol.dispose](); }
}

async function confirmAuthority(scope: AccessScope): Promise<boolean> {
  assertAuthority(scope);
  let response: Response;
  try {
    response = await fetch(`/api/boards/${encodeURIComponent(scope.boardId)}/editable-export`, { credentials: 'same-origin', cache: 'no-store', headers: { 'X-Dali-Account': scope.accountId }, signal: AbortSignal.timeout(10000) });
  } catch { assertAuthority(scope); return false; } // Local-only recovery retains unexpired last-confirmed authority during an outage.
  assertAuthority(scope);
  if (response.status >= 500) return false;
  if (!response.ok) { suspendAccessScope('recovery-export'); throw new Error('Recovery download access changed. Reopen the board.'); }
  const body = await response.json(); assertAuthority(scope);
  const descriptor = body?.descriptor;
  if (!validDescriptor(descriptor, scope.accountId) || descriptor.summary.id !== scope.boardId || descriptor.summary.role === 'viewer' || !descriptor.capabilities.includes('write')) {
    suspendAccessScope('recovery-export'); throw new Error('Recovery download access changed. Reopen the board.');
  }
  return true;
}

export async function downloadRecoveryCopy(): Promise<void> {
  const { captured, readAsset } = captureRecoverySnapshot();
  await confirmAuthority(captured.scope);
  const assets = new Map<string, Blob>();
  for (const reference of captured.references) {
    let blob = await readAsset(reference.id).catch(() => null); assertAuthority(captured.scope);
    if (!blob && await confirmAuthority(captured.scope)) {
      const response = await fetch(`/api/boards/${encodeURIComponent(captured.scope.boardId)}/blobs/${encodeURIComponent(reference.id)}`, { credentials: 'same-origin', cache: 'no-store', headers: { 'X-Dali-Account': captured.scope.accountId }, signal: AbortSignal.timeout(10000) }).catch(() => null);
      assertAuthority(captured.scope);
      if (response && [401, 403, 409].includes(response.status)) { suspendAccessScope('recovery-export'); throw new Error('Recovery download access changed. Reopen the board.'); }
      if (response?.ok) blob = await response.blob();
      assertAuthority(captured.scope);
    }
    if (!blob) throw new Error(`${reference.label}: image bytes are missing. Restore the image and retry.`);
    assets.set(reference.id, blob);
  }
  const blob = await buildSnapshotArchive(captured.snapshot, assets, captured.references);
  await confirmAuthority(captured.scope); assertAuthority(captured.scope);
  downloadBlob(blob, `${safeFilename(captured.title)}-recovery-${new Date(captured.capturedAt).toISOString().replace(/:/g, '-')}.bs.zip`);
}
