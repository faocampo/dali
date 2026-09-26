import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { EditorHost } from '@blocksuite/affine/std';
import { GfxControllerIdentifier, type GfxModel } from '@blocksuite/affine/std/gfx';
import { getActiveAccessScope, getRecoveryRuntime, retryRecovery, type AccessScope } from '../canvas/runtime';
import { downloadRecoveryCopy } from '../canvas/recovery-archive';
import type { ImageSaveRow, LocalSaveStatus, RecoveryDownloadState, SaveSnapshot } from '../canvas/save-status';
import './save-details.css';

const currentScope = (expected: AccessScope) => { const now = getActiveAccessScope(); return now?.phase === 'active' && now.accountId === expected.accountId && now.boardId === expected.boardId && now.generation === expected.generation; };
function imageObject(id: string, scope: AccessScope) {
  if (!currentScope(scope)) return;
  const host = document.querySelector<EditorHost>('editor-host');
  const model = host?.store.getBlocksByFlavour('affine:image').find(({ model }) => (model.props as { sourceId?: string }).sourceId === id)?.model;
  return host && model ? { host, model } : undefined;
}
/** Selection is a presentation action and never updates the document. */
export function selectRecoveryImage(id: string, scope: AccessScope) {
  const found = imageObject(id, scope); if (!found) return false;
  const gfx = found.host.std.get(GfxControllerIdentifier);
  const model = gfx.getElementById<GfxModel>(found.model.id); if (!model) return false;
  gfx.selection.set({ elements: [model.id], editing: false });
  gfx.viewport.setCenter(model.x + model.w / 2, model.y + model.h / 2);
  found.host.tabIndex = -1; found.host.focus({ preventScroll: true }); return true;
}

function ImageRow({ row, scope, onSelect }: { row: ImageSaveRow; scope: AccessScope; onSelect: () => void }) {
  const [preview, setPreview] = useState<string>();
  const found = imageObject(row.id, scope);
  useEffect(() => {
    let disposed = false; let url: string | undefined;
    if (scope.role === 'viewer' || !currentScope(scope)) return;
    try {
      void getRecoveryRuntime().readLocalAsset(row.id).then(blob => {
        if (disposed || !currentScope(scope) || !blob || !/^image\/(png|jpeg|webp|gif|avif)$/.test(blob.type)) return;
        url = URL.createObjectURL(blob); setPreview(url);
      }).catch(() => undefined);
    } catch { /* A preview is optional; the stable name and status remain. */ }
    return () => { disposed = true; if (url) URL.revokeObjectURL(url); };
  }, [row.id, scope.accountId, scope.boardId, scope.generation, scope.role]);
  return <li className="save-details-image">
    {preview ? <img src={preview} alt="" onError={() => setPreview(undefined)} /> : <span className="save-details-preview" aria-hidden="true">▧</span>}
    <div className="save-details-image-copy"><strong>{row.label}</strong><span>{({ waiting: 'Waiting to upload', uploading: 'Uploading…', failed: 'Image not saved', saved: 'Saved' })[row.state]}</span>
      {found ? <button type="button" aria-label={`Select image: ${row.label}`} onClick={() => { if (selectRecoveryImage(row.id, scope)) onSelect(); }}>Select image</button> : <span>Image is no longer on this board.</span>}
    </div>
  </li>;
}

export function saveDetailsCopy(status: LocalSaveStatus, snapshot?: SaveSnapshot, scope?: AccessScope | null) {
  if (scope?.role === 'viewer' && scope.phase === 'active') return { label: 'Read only', message: 'You can view this board. Editing requires access from the board owner.' };
  const recovery = scope?.recoveryState;
  if (recovery === 'storage-paused') return { label: 'Editing paused', message: "This browser cannot preserve more changes. Keep this tab open. Download a recovery copy, allow storage for this site, then retry saving." };
  if (recovery === 'epoch-mismatch') return { label: 'Recovery needs attention', message: 'The server copy changed after a restore. Pending changes have been kept separately. Download a recovery copy before continuing with the restored board.' };
  if (recovery === 'corrupt') return { label: 'Recovery needs attention', message: "These pending changes could not be opened safely. Keep this browser's data and contact your operator for recovery help." };
  if (status.state === 'saved') return { label: 'Saved', message: 'All changes and images are saved to the server.' };
  if (status.state === 'failed') return { label: status.label, message: status.label === 'Save failed' && !Object.values(snapshot?.images ?? {}).some(row => row.state === 'failed') ? "Some changes have not reached the server. We'll retry automatically. You can retry now or download a recovery copy." : status.message };
  if (snapshot?.recovery === 'checking-access') return { label: 'Checking access…', message: 'Checking your access before recovering changes.' };
  if (snapshot?.retrying) return { label: 'Recovering changes…', message: 'Restoring changes kept in this browser and checking their save status.' };
  if (snapshot?.preserved || snapshot?.recovery === 'pending') return { label: 'Changes waiting to save', message: snapshot.preserved ? "Changes are kept in this browser. We'll retry automatically when the service is available." : 'Some changes have not reached the server. Keep this tab open while we check local recovery.' };
  return { label: status.label, message: 'Sending your latest changes and images to the server.' };
}

export function SaveDetails({ status, snapshot, scope, downloadStatus, trigger, onClose, onOpenRestored }: {
  status: LocalSaveStatus; snapshot?: SaveSnapshot; scope: AccessScope | null; downloadStatus?: RecoveryDownloadState;
  trigger: RefObject<HTMLButtonElement>; onClose: (restore?: boolean) => void; onOpenRestored?: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null); const heading = useRef<HTMLHeadingElement>(null);
  const retryButton = useRef<HTMLButtonElement>(null); const busyRef = useRef(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [retryFocused, setRetryFocused] = useState(false);
  const imageLabels = useRef(new Map<string, string>());
  const copy = saveDetailsCopy(status, snapshot, scope);
  const permitted = !!scope && currentScope(scope) && scope.role !== 'viewer';
  const images = permitted ? Object.values(snapshot?.images ?? {}).filter(row => row.required || row.wasRequired).map(row => {
    const props = imageObject(row.id, scope!)?.model.props as { caption?: unknown } | undefined;
    const caption = typeof props?.caption === 'string' ? props.caption.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 240) : '';
    if (!imageLabels.current.has(row.id)) imageLabels.current.set(row.id, caption || row.label);
    return { ...row, label: imageLabels.current.get(row.id)! };
  }) : [];
  const retryable = permitted && status.state !== 'saved' && !['corrupt', 'epoch-mismatch', 'denied', 'expired'].includes(scope.recoveryState ?? '');
  useLayoutEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);
  useLayoutEffect(() => {
    if (!retryable && retryFocused) { heading.current?.focus({ preventScroll: true }); setRetryFocused(false); }
  }, [retryable, retryFocused]);
  useEffect(() => {
    const outside = (event: Event) => { if (event.target instanceof Node && !panel.current?.contains(event.target) && !trigger.current?.contains(event.target)) onClose(false); };
    document.addEventListener('pointerdown', outside); document.addEventListener('focusin', outside);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('focusin', outside); };
  }, [onClose, trigger]);
  const retry = async () => {
    if (busyRef.current || !scope || !currentScope(scope)) return;
    busyRef.current = true; setBusy(true); setError('');
    try { await retryRecovery(); } catch { if (currentScope(scope)) setError('Changes still cannot be preserved or saved. Keep this tab open and download a recovery copy.'); }
    finally { busyRef.current = false; if (currentScope(scope)) setBusy(false); }
  };
  return <div ref={panel} className="save-details" id="save-details" role="dialog" aria-labelledby="save-details-heading" onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape') { event.preventDefault(); onClose(true); } }}>
    <div className="save-details-heading"><h2 ref={heading} id="save-details-heading" tabIndex={-1}>Save details</h2><button type="button" aria-label="Close save details" onClick={() => onClose(true)}>×</button></div>
    <p>{copy.message}</p>
    {scope?.role !== 'viewer' && <p className="save-details-time">{status.savedAt ? `Last saved to the server: ${new Date(status.savedAt).toLocaleString()}` : 'No server save confirmed yet.'}</p>}
    {!!images.length && <section aria-label="Image save status"><h3>{images.length === 1 ? '1 image' : `${images.length} images`}</h3><ul>{images.map(row => <ImageRow key={row.id} row={row} scope={scope!} onSelect={() => onClose(false)} />)}</ul></section>}
    {(busy || snapshot?.retrying) && <p>Retrying…</p>}
    {error && <p role="alert">{error}</p>}
    {permitted && downloadStatus && downloadStatus.phase !== 'idle' && <p className="save-details-download" role={downloadStatus.phase === 'error' ? 'alert' : undefined}>{downloadStatus.label}{downloadStatus.message && ` ${downloadStatus.message}`}</p>}
    <div className="save-details-actions">
      {(retryable || retryFocused) && <button ref={retryButton} type="button" aria-disabled={busy || !retryable} onFocus={() => setRetryFocused(true)} onBlur={() => setRetryFocused(false)} onClick={() => { if (retryable) void retry(); }}>{scope?.recoveryState === 'storage-paused' ? 'Retry saving' : 'Retry now'}</button>}
      {permitted && <button type="button" className={status.state === 'failed' ? 'save-details-primary' : undefined} disabled={downloadStatus?.phase === 'preparing'} onClick={() => void downloadRecoveryCopy().catch(() => undefined)}>Download recovery copy</button>}
      {permitted && scope?.recoveryState === 'epoch-mismatch' && onOpenRestored && <button type="button" onClick={onOpenRestored}>Open restored board</button>}
    </div>
  </div>;
}
