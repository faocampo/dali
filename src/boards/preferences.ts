const ACTIVE_BOARD_KEY = 'djai-design.active-board';
const OPEN_BOARD_ONCE_KEY = 'djai-design.open-board-once';
const PENDING_BOARD_REMOVAL_KEY = 'djai-design.pending-board-removal';

function readStorage(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(storage: Storage, key: string, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    // The canvas already reports unavailable persistent storage. A blocked
    // preference store should not make a board itself impossible to open.
  }
}

/** Each open tab owns its board; local storage supplies the last-opened default. */
export function getActiveBoardId(): string | null {
  return new URL(window.location.href).searchParams.get('localBoard') || readStorage(localStorage, ACTIVE_BOARD_KEY);
}

export function setActiveBoardId(id: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set('localBoard', id);
  url.searchParams.delete('board');
  url.searchParams.delete('new');
  window.history.replaceState(window.history.state, '', url);
  writeStorage(localStorage, ACTIVE_BOARD_KEY, id);
}

/** Make the next reload land in the chosen editor instead of the library. */
export function requestBoardOpen(): void {
  writeStorage(sessionStorage, OPEN_BOARD_ONCE_KEY, '1');
}

/** One-shot flag consumed by App during startup. */
export function consumeBoardOpenRequest(): boolean {
  try {
    const requested = sessionStorage.getItem(OPEN_BOARD_ONCE_KEY) === '1';
    sessionStorage.removeItem(OPEN_BOARD_ONCE_KEY);
    return requested;
  } catch {
    return false;
  }
}

/**
 * Defer replacing an open board until the next runtime starts. Removing a
 * BlockSuite document while its editor is still mounted can leave the view
 * observing a model whose root has disappeared.
 */
export function deferBoardRemoval(id: string): void {
  writeStorage(sessionStorage, PENDING_BOARD_REMOVAL_KEY, id);
}

/** One-shot cleanup request consumed before the next editor can mount. */
export function consumeDeferredBoardRemoval(): string | null {
  try {
    const id = sessionStorage.getItem(PENDING_BOARD_REMOVAL_KEY);
    sessionStorage.removeItem(PENDING_BOARD_REMOVAL_KEY);
    return id;
  } catch {
    return null;
  }
}

/** A native link opens the tab synchronously; the destination creates its board. */
export function newBoardUrl(): string {
  const url = new URL('/', window.location.origin);
  url.searchParams.set('new', '1');
  url.searchParams.set('operationId', crypto.randomUUID());
  return url.href;
}

export type AccountIntent = { kind: 'home' } | { kind: 'invalid' } | { kind: 'board'; boardId: string } | { kind: 'new'; operationId?: string };
const validId = (id: string) => /^[A-Za-z0-9_-]{1,128}$/.test(id);
export function accountIntent(search = window.location.search): AccountIntent {
  const params = new URLSearchParams(search);
  if (params.has('board')) return validId(params.get('board')!) ? { kind: 'board', boardId: params.get('board')! } : { kind: 'invalid' };
  if (params.has('new')) {
    if (params.get('new') !== '1' || (params.has('operationId') && !validId(params.get('operationId')!))) return { kind: 'invalid' };
    return { kind: 'new', ...(params.has('operationId') ? { operationId: params.get('operationId')! } : {}) };
  }
  return { kind: 'home' };
}
export function accountBoardUrl(boardId: string): string {
  if (!validId(boardId)) throw new Error('Invalid board location');
  return '/?board=' + encodeURIComponent(boardId);
}

export function isNewBoardRequested(): boolean {
  return new URL(window.location.href).searchParams.get('new') === '1';
}
