/**
 * Exporting the board to a file.
 *
 * Pulled out of the toolbar so the header's Export dialog and the rail's
 * export button run exactly the same code path rather than two copies.
 */
import { ZipTransformer } from '@blocksuite/affine/widgets/linked-doc';
import { getCanvasRuntime } from './runtime';
import { boardCatalogEntry } from '../boards/catalog';
import { updateWorkspaceDocMeta } from './workspace';
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

function safeFilename(value: string): string {
  return (value.trim() || 'Untitled board')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 120);
}

function downloadBlob(blob: Blob, filename: string): void {
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
  const { workspace, store } = await getCanvasRuntime();
  const catalog = boardCatalogEntry(store.id, workspace.meta.docMetas);
  if (catalog) updateWorkspaceDocMeta(workspace, store.id, { title: catalog.title });
  if (format === 'board') {
    await ZipTransformer.exportDocs(workspace, store.schema, [store]);
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
      downloadBlob(await canvasBlob(render.canvas), `${title}.png`);
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
