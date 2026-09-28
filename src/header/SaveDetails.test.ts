import { describe, expect, it, vi } from 'vitest';
import type { AccessScope } from '../canvas/runtime';
import type { LocalSaveStatus } from '../canvas/save-status';

vi.mock('../canvas/runtime', () => ({ getActiveAccessScope: vi.fn(), getRecoveryRuntime: vi.fn(), retryRecovery: vi.fn() }));
vi.mock('../canvas/recovery-archive', () => ({ downloadRecoveryCopy: vi.fn() }));
vi.mock('@blocksuite/affine/std/gfx', () => ({ GfxControllerIdentifier: Symbol('synthetic-gfx') }));
import { saveDetailsCopy } from './SaveDetails';

const viewer: AccessScope = { accountId: 'synthetic-member', boardId: 'synthetic-board', generation: 1, role: 'viewer', canWrite: false, phase: 'active', recoveryState: 'denied' };
const saved: LocalSaveStatus = { state: 'saved', label: 'Saved' };

describe('authorized Viewer recovery feedback', () => {
  it('shows ordinary read-only feedback when no pending work was found', () => {
    expect(saveDetailsCopy(saved, undefined, { ...viewer, retainedPending: false })).toEqual({ label: 'Read only', message: 'You can view this board. Editing requires access from the board owner.' });
  });
  it('retains the approved access-change warning even when the server copy is saved', () => {
    expect(saveDetailsCopy(saved, undefined, { ...viewer, retainedPending: true })).toEqual({ label: 'Your access has changed', message: 'Your access has changed. Pending changes have not been applied. Contact the board owner to restore editing access.' });
  });
  it('exposes failed inspection without claiming there is no pending work', () => {
    expect(saveDetailsCopy(saved, undefined, { ...viewer, retainedPending: 'unavailable' })).toEqual({ label: 'Recovery status unavailable', message: "You can view this board, but this browser could not check for pending changes. Keep this browser's data and reopen the board to check again." });
  });
  it('does not carry a Viewer warning into an authorized editor scope', () => {
    expect(saveDetailsCopy(saved, undefined, { ...viewer, role: 'editor', canWrite: true, retainedPending: true }).label).toBe('Saved');
  });
});
