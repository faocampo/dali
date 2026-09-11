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

export function getActiveBoardId(): string | null {
  return readStorage(localStorage, ACTIVE_BOARD_KEY);
}

export function setActiveBoardId(id: string): void {
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
