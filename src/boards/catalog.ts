import type { DocMeta } from '@blocksuite/affine/store';

const CATALOG_KEY = 'djai-design.board-catalog.v1';

export type BoardCatalogEntry = {
  title: string;
  createdAt: number;
  updatedAt: number;
  /** Cached lightweight card preview; canvas content remains authoritative. */
  thumbnail?: string;
};

type BoardCatalog = Record<string, BoardCatalogEntry>;

function readCatalog(): BoardCatalog {
  try {
    const raw = localStorage.getItem(CATALOG_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as BoardCatalog) : {};
  } catch {
    return {};
  }
}

function writeCatalog(catalog: BoardCatalog): void {
  try {
    localStorage.setItem(CATALOG_KEY, JSON.stringify(catalog));
  } catch {
    // The document remains the source of board content. Startup already gives
    // the user a designed error if browser storage as a whole is unavailable.
  }
}

function nextUntitled(used: Set<string>): string {
  if (!used.has('Untitled board')) return 'Untitled board';
  let suffix = 2;
  while (used.has(`Untitled board ${suffix}`)) suffix += 1;
  return `Untitled board ${suffix}`;
}

/**
 * Reconcile the small UI catalog against BlockSuite's authoritative document
 * list. This is also the one-time migration for the pre-library single board.
 */
export function reconcileBoardCatalog(metas: readonly DocMeta[]): BoardCatalog {
  const current = readCatalog();
  const next: BoardCatalog = {};
  const liveIds = new Set(metas.map((meta) => meta.id));
  const used = new Set(
    Object.entries(current)
      .filter(([id]) => liveIds.has(id))
      .map(([, entry]) => entry.title?.trim())
      .filter((title): title is string => !!title)
  );

  for (const meta of [...metas].sort((a, b) => a.createDate - b.createDate)) {
    const existing = current[meta.id];
    const metaTitle = meta.title?.trim();
    const title =
      existing?.title || (metaTitle && !used.has(metaTitle) ? metaTitle : null) || nextUntitled(used);
    used.add(title);
    next[meta.id] = {
      title,
      createdAt: existing?.createdAt ?? meta.createDate ?? Date.now(),
      updatedAt: existing?.updatedAt ?? meta.updatedDate ?? meta.createDate ?? Date.now(),
      ...(existing?.thumbnail ? { thumbnail: existing.thumbnail } : {}),
    };
  }

  writeCatalog(next);
  return next;
}

export function setBoardCatalogEntry(id: string, entry: BoardCatalogEntry): void {
  const catalog = readCatalog();
  catalog[id] = entry;
  writeCatalog(catalog);
}

export function updateBoardCatalogEntry(
  id: string,
  props: Partial<BoardCatalogEntry>
): void {
  const catalog = readCatalog();
  const current = catalog[id];
  if (!current) return;
  catalog[id] = { ...current, ...props };
  writeCatalog(catalog);
}

export function removeBoardCatalogEntry(id: string): void {
  const catalog = readCatalog();
  delete catalog[id];
  writeCatalog(catalog);
}

export function boardCatalogEntry(id: string, metas: readonly DocMeta[]): BoardCatalogEntry | null {
  return reconcileBoardCatalog(metas)[id] ?? null;
}
