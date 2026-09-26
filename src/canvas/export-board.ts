/**
 * Exporting the board to a file.
 *
 * Pulled out of the toolbar so the header's Export dialog and the rail's
 * export button run exactly the same code path rather than two copies.
 */
import { createAssetsArchive } from '@blocksuite/affine/widgets/linked-doc';
import type { DocSnapshot, BlockSnapshot } from '@blocksuite/store';
import { getCanvasRuntime } from './runtime';
import { accessScopeCurrent, canExportRecoveryScope } from './account/mutation-guard';
import type { ExportPlan, ExportScale } from './export-plan';
import {
  renderBoardPresentation,
  type PresentationScope,
} from './presentation-export';

/**
 * The formats we can genuinely produce.
 *
 * Only one for now, and deliberately so. BlockSuite 0.22 ships no image
 * exporter, and the surface `<canvas>` holds ONLY shapes, strokes and
 * connectors. Notes, images, and text are DOM rendered on top of it. A
 * PNG of "the board" therefore means compositing canvas and DOM, which is a
 * real piece of work rather than another entry in this list. Listing a format
 * we cannot honour would just produce broken downloads.
 */
export const EXPORT_FORMATS = [
  {
    id: 'board' as const,
    label: 'Editable board file (.bs.zip)',
    hint: 'Everything on the board, re-importable here. Includes original images.',
  },
  {
    id: 'png' as const,
    label: 'PNG image',
    hint: 'A presentation image at the board’s native scale.',
  },
  {
    id: 'pdf' as const,
    label: 'PDF document',
    hint: 'A4 landscape pages at a consistent readable scale.',
  },
];

export type ExportFormat = (typeof EXPORT_FORMATS)[number]['id'];

export type PresentationExportOptions = {
  scope: PresentationScope;
  transparent?: boolean;
  scale?: ExportScale;
  plan?: ExportPlan;
};

export type PresentationExportResult = {
  format: 'png' | 'pdf';
  width: number;
  height: number;
  pages: number;
  durationMs: number;
  estimatedBytes: number;
};

export function safeFilename(value: string): string {
  return (value.trim() || 'Untitled board')
    .replace(/[\u0000-\u001f\u007f\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 120);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Native editable format, with completeness checked before ZIP creation. */
export async function buildSnapshotArchive(snapshot: DocSnapshot, assets: ReadonlyMap<string, Blob>, references: readonly { id: string; label: string }[]): Promise<Blob> {
  let total = 0;
  const verified = new Map<string, Blob>();
  for (const { id, label } of references) {
    if (verified.has(id)) continue;
    const blob = assets.get(id);
    if (!blob || !['image/png', 'image/jpeg'].includes(blob.type) || !blob.size || blob.size > 16 * 1024 * 1024) throw new Error(`${label}: image bytes are missing or invalid. Restore the image and retry.`);
    const bytes = await blob.arrayBuffer();
    const hash = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))).replace(/\+/g, '-').replace(/\//g, '_');
    if (hash !== id || (total += bytes.byteLength) > 256 * 1024 * 1024) throw new Error(`${label}: image bytes could not be verified. Restore the image and retry.`);
    // Native naming uses the content key for Blobs; normalize Files to prevent filename/path ambiguity.
    verified.set(id, new Blob([bytes], { type: blob.type }));
  }
  if (!snapshot || snapshot.type !== 'page' || !snapshot.meta?.id || typeof snapshot.meta.title !== 'string' || !snapshot.blocks || references.length > 10000) throw new Error('The board snapshot is invalid. Keep this tab open and retry.');
  const referenced = new Set<string>();
  const inspect = (block: BlockSnapshot, depth = 0) => {
    if (depth > 128 || block.type !== 'block' || typeof block.id !== 'string' || typeof block.flavour !== 'string' || !block.props || !Array.isArray(block.children)) throw new Error('The board snapshot schema is invalid.');
    if (['affine:image', 'djai:image-visual-edit'].includes(block.flavour)) {
      const id = block.props.sourceId;
      if (typeof id !== 'string' || !verified.has(id)) throw new Error('A required image is missing from the recovery snapshot.');
      referenced.add(id);
    }
    block.children.forEach(child => inspect(child, depth + 1));
  };
  inspect(snapshot.blocks);
  if (references.some(reference => !referenced.has(reference.id))) throw new Error('The recovery image references do not match the captured board.');
  const json = JSON.stringify(snapshot);
  if (json.length > 8 * 1024 * 1024) throw new Error('The board exceeds the archive size limit.');
  const zip = await createAssetsArchive(verified, [...verified.keys()]);
  await zip.file(`${safeFilename(snapshot.meta.title)}-${safeFilename(snapshot.meta.id)}.snapshot.json`, json);
  const blob = await zip.generate();
  if (blob.size > 32 * 1024 * 1024) throw new Error('The recovery copy exceeds the 32 MB Import limit.');
  return blob;
}

async function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('PNG encoding took too long. Choose a lower scale and retry.')), 10_000);
    try { canvas.toBlob(blob => { clearTimeout(timer); resolve(blob); }, 'image/png'); }
    catch { clearTimeout(timer); reject(new Error('The browser could not encode these pixels. Check the images and retry.')); }
  });
  if (!blob) throw new Error('The browser could not encode this canvas as PNG.');
  return blob;
}

const A4_LANDSCAPE: [number, number] = [841.89, 595.28];
const PDF_MARGIN = 24;
const PDF_POINTS_PER_CSS_PIXEL = 72 / 96;

async function canvasPdf(canvas: HTMLCanvasElement): Promise<{ blob: Blob; pages: number }> {
  const { PDFDocument } = await import('pdf-lib');
  const pdfDocument = await PDFDocument.create();
  const dpr = window.devicePixelRatio || 1;
  const contentWidth = A4_LANDSCAPE[0] - PDF_MARGIN * 2;
  const contentHeight = A4_LANDSCAPE[1] - PDF_MARGIN * 2;
  const tileWidth = Math.max(1, Math.floor((contentWidth / PDF_POINTS_PER_CSS_PIXEL) * dpr));
  const tileHeight = Math.max(1, Math.floor((contentHeight / PDF_POINTS_PER_CSS_PIXEL) * dpr));
  const columns = Math.ceil(canvas.width / tileWidth);
  const rows = Math.ceil(canvas.height / tileHeight);

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const sourceX = column * tileWidth;
      const sourceY = row * tileHeight;
      const width = Math.min(tileWidth, canvas.width - sourceX);
      const height = Math.min(tileHeight, canvas.height - sourceY);
      const tile = window.document.createElement('canvas');
      tile.width = width;
      tile.height = height;
      const context = tile.getContext('2d');
      if (!context) throw new Error('The browser could not create a PDF page canvas.');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(canvas, sourceX, sourceY, width, height, 0, 0, width, height);
      const png = new Uint8Array(await (await canvasBlob(tile)).arrayBuffer());
      const embedded = await pdfDocument.embedPng(png);
      const page = pdfDocument.addPage(A4_LANDSCAPE);
      const drawWidth = (width / dpr) * PDF_POINTS_PER_CSS_PIXEL;
      const drawHeight = (height / dpr) * PDF_POINTS_PER_CSS_PIXEL;
      page.drawImage(embedded, {
        x: PDF_MARGIN,
        y: A4_LANDSCAPE[1] - PDF_MARGIN - drawHeight,
        width: drawWidth,
        height: drawHeight,
      });
    }
  }

  const bytes = await pdfDocument.save();
  const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return { blob: new Blob([data], { type: 'application/pdf' }), pages: pdfDocument.getPageCount() };
}

/** Downloads the current board. `exportDocs` triggers the download itself. */
export async function exportBoardFile(
  format: ExportFormat = 'board',
  options: PresentationExportOptions = { scope: 'visible' }
): Promise<PresentationExportResult | void> {
  const { store, scope } = await getCanvasRuntime();
  const assertCurrent = () => {
    if (!(format === 'board' ? canExportRecoveryScope(scope) : accessScopeCurrent(scope))) throw new Error(format === 'board' ? 'Editable download requires current Owner or Editor access.' : 'Board access changed. Reopen the board before exporting.');
  };
  const authorize = async () => {
    assertCurrent();
    const response = await fetch(`/api/boards/${encodeURIComponent(scope.boardId)}${format === 'board' ? '/editable-export' : ''}`, {
      credentials: 'same-origin', cache: 'no-store', headers: { 'X-Dali-Account': scope.accountId },
    });
    assertCurrent();
    if (!response.ok) throw new Error('Export access could not be confirmed. Reopen the board and try again.');
    const body = await response.json(); assertCurrent();
    const summary = (format === 'board' ? body.descriptor : body)?.summary;
    if (summary?.id !== scope.boardId || summary.accountId !== scope.accountId || typeof summary.title !== 'string') throw new Error('Export access changed. Reopen the board and try again.');
    return summary.title as string;
  };
  const catalog = { title: await authorize() };
  const confirm = async () => {
    if (await authorize() !== catalog.title) throw new Error('The board name changed while exporting. Retry the download.');
    assertCurrent();
  };
  if (format === 'board') {
    // The upstream convenience exporter downloads internally and tolerates
    // missing assets. Build its compatible archive here so all assets and the
    // final authorization check finish before the only download dispatch.
    const job = store.getTransformer();
    try {
      const snapshot = job.docToSnapshot(store);
      if (!snapshot) throw new Error('The board could not be prepared for export.');
      snapshot.meta.title = catalog.title;
      const ids = [...job.assetsManager.getPathBlobIdMap().values()];
      for (const id of ids) {
        await job.assetsManager.readFromBlob(id); assertCurrent();
        if (!job.assets.has(id)) throw new Error('An image is missing. Restore the image and retry.');
      }
      const blob = await buildSnapshotArchive(snapshot, job.assets, ids.map((id, index) => ({ id, label: `Image ${index + 1}` })));
      await confirm();
      downloadBlob(blob, `${safeFilename(catalog.title)}.bs.zip`);
    } finally { job[Symbol.dispose](); }
    return;
  }

  const render = await renderBoardPresentation({
    scope: options.scope,
    transparent: format === 'png' && options.transparent,
    scale: options.scale,
    plan: options.plan,
  });
  try {
    const title = safeFilename(catalog?.title ?? 'Untitled board');
    if (format === 'png') {
      assertCurrent();
      const blob = await canvasBlob(render.canvas);
      await confirm();
      downloadBlob(blob, `${title}.png`);
      return {
        format,
        width: render.canvas.width,
        height: render.canvas.height,
        pages: 1,
        durationMs: render.durationMs,
        estimatedBytes: render.estimatedBytes,
      };
    }

    const pdf = await canvasPdf(render.canvas);
    await confirm();
    downloadBlob(pdf.blob, `${title}.pdf`);
    return {
      format,
      width: render.canvas.width,
      height: render.canvas.height,
      pages: pdf.pages,
      durationMs: render.durationMs,
      estimatedBytes: render.estimatedBytes,
    };
  } finally { render.canvas.width = 0; render.canvas.height = 0; }
}
