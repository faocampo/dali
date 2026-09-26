import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  beginBlobWrite,
  finishBlobWrite,
  getSaveStatus,
  reportDocEngineStatus,
  reportDocWriteFailure,
  resetSaveStatus,
  createSaveSnapshot,
  reduceSaveStatus,
  dispatchSaveEvent,
  type SaveSnapshot,
} from './save-status';

it('@04-05-01 current document coverage establishes server saved time and retains it while newer work waits', () => {
  const fresh = createSaveSnapshot('synthetic-board-generation-1');
  const saved = reduceSaveStatus(fresh, { type: 'coverage', scope: fresh.scope, documents: { root: { revision: 0, acknowledged: true }, content: { revision: 0, acknowledged: true } }, images: [], at: 1000 });
  expect(saved).toMatchObject({ state: 'saved', label: 'Saved', savedAt: 1000 });
  const newer = reduceSaveStatus(saved, { type: 'coverage', scope: fresh.scope, documents: { root: { revision: 0, acknowledged: true }, content: { revision: 1, acknowledged: false } }, images: [], at: 2000 });
  expect(newer).toMatchObject({ state: 'saving', savedAt: 1000 });
  expect(reduceSaveStatus(newer, { type: 'coverage', scope: fresh.scope, documents: { root: { revision: 0, acknowledged: true }, content: { revision: 0, acknowledged: true } }, images: [], at: 3000 })).toBe(newer);
});

describe('@04-05-01 immutable current-scope coverage', () => {
  const scope = 'synthetic-scope';
  const coverage = (state: SaveSnapshot, acknowledged: boolean, revision = 0, ids = ['a', 'b'], at = 1000) => reduceSaveStatus(state, { type: 'coverage', scope, documents: { root: { revision: 0, acknowledged: true }, content: { revision, acknowledged } }, images: ids.map((id, i) => ({ id, label: `Image ${i + 1}` })), at });
  const image = (state: SaveSnapshot, id: string, outcome: 'sending' | 'acknowledged' | 'failed', attempt = id, at = 1000) => reduceSaveStatus(state, { type: 'image', scope, id, outcome, attempt, at });
  it('keeps unrelated image success separate from a required failure and distinguishes combined failure', () => {
    let state = coverage(createSaveSnapshot(scope), true);
    state = image(state, 'a', 'failed'); state = image(state, 'b', 'acknowledged');
    expect(state).toMatchObject({ state: 'failed', label: 'Image not saved' }); expect(state.images.a!.state).toBe('failed');
    state = coverage(state, false, 1); expect(state).toMatchObject({ state: 'failed', label: 'Save failed' });
    expect(state.message).toContain('Board changes and Image 1');
    state = image(state, 'a', 'acknowledged', 'a', 2000); expect(state.state).toBe('saving');
    state = coverage(state, true, 1, ['a', 'b'], 3000); expect(state).toMatchObject({ state: 'saved', savedAt: 3000 });
  });
  it('retains a failed obsolete image until the current removal is acknowledged', () => {
    let state = image(coverage(createSaveSnapshot(scope), true), 'a', 'failed'); state = image(state, 'b', 'acknowledged');
    state = coverage(state, false, 1, ['b']); expect(state.images.a!.state).toBe('failed'); expect(state.label).toBe('Save failed');
    state = coverage(state, true, 1, ['b'], 2000); expect(state.images.a).toBeUndefined(); expect(state).toMatchObject({ state: 'saved', savedAt: 2000 });
  });
  it('preserves failure through manual, automatic and image retry attempts', () => {
    let state = image(coverage(createSaveSnapshot(scope), true), 'a', 'failed');
    state = reduceSaveStatus(state, { type: 'retry', scope }); expect(state.label).toBe('Image not saved');
    state = reduceSaveStatus(state, { type: 'recovery', scope, state: 'retrying' }); expect(state.label).toBe('Image not saved');
    state = image(state, 'a', 'sending', 'new-attempt'); expect(state.images.a!.state).toBe('failed');
    expect(image(state, 'a', 'acknowledged', 'old-attempt')).toBe(state);
    state = image(state, 'a', 'acknowledged', 'new-attempt'); expect(state.images.a!.state).toBe('saved'); expect(state.state).toBe('saving');
  });
  it.each(['dispatched', 'local-complete', 'exported'] as const)('%s cannot establish Saved', type => {
    const state = createSaveSnapshot(scope); expect(reduceSaveStatus(state, { type, scope })).toBe(state); expect(state.savedAt).toBeUndefined();
  });
  it('requires acknowledged root and content even when no image work remains', () => {
    let state = coverage(createSaveSnapshot(scope), false, 0, []); expect(state.state).toBe('saving');
    state = reduceSaveStatus(state, { type: 'preserved', scope }); expect(state.label).toBe('Changes pending'); expect(state.savedAt).toBeUndefined();
    state = coverage(state, true, 0, [], 9000); expect(state).toMatchObject({ state: 'saved', savedAt: 9000 });
  });
  it('ignores another scope and preserves immutable previous snapshots', () => {
    const old = coverage(createSaveSnapshot(scope), false);
    const updated = image(old, 'a', 'failed'); expect(old.images.a!.state).toBe('waiting'); expect(updated.images.a!.state).toBe('failed');
    expect(Object.isFrozen(updated)).toBe(true); expect(Object.isFrozen(updated.images.a)).toBe(true);
    expect(reduceSaveStatus(updated, { type: 'image', scope: 'another-account', id: 'a', outcome: 'acknowledged', attempt: 'a', at: 10000 })).toBe(updated);
  });
  it('keeps stalled documents failed until exact current acknowledgment and retains prior age', () => {
    let state = coverage(createSaveSnapshot(scope), true, 0, []);
    state = coverage(state, false, 1, []); state = reduceSaveStatus(state, { type: 'recovery', scope, state: 'retrying', stalled: true });
    expect(state).toMatchObject({ label: 'Save failed', savedAt: 1000 });
    state = reduceSaveStatus(state, { type: 'recovery', scope, state: 'retrying' }); expect(state.label).toBe('Save failed');
    state = coverage(state, true, 1, [], 2000); expect(state).toMatchObject({ label: 'Saved', savedAt: 2000 });
  });
  it.each(['storage-paused', 'expired', 'denied', 'epoch-mismatch', 'corrupt'])('%s takes precedence over otherwise saved coverage', recovery => {
    let state = coverage(createSaveSnapshot(scope), true, 0, []); state = reduceSaveStatus(state, { type: 'recovery', scope, state: recovery });
    expect(state.state).toBe('failed'); expect(state.savedAt).toBe(1000);
  });
  it('legacy engine and global blob signals cannot mark an account board saved or erase a keyed failure', () => {
    resetSaveStatus(scope); reportDocEngineStatus(engineStatus(2)); beginBlobWrite(); finishBlobWrite(); expect(getSaveStatus().state).toBe('saving');
    dispatchSaveEvent({ type: 'coverage', scope, documents: { root: { revision: 0, acknowledged: true }, content: { revision: 0, acknowledged: true } }, images: [{ id: 'a', label: 'Image 1' }], at: 1 });
    dispatchSaveEvent({ type: 'image', scope, id: 'a', outcome: 'failed', attempt: 'a', at: 2 });
    reportDocEngineStatus(engineStatus(2)); finishBlobWrite(); expect(getSaveStatus().label).toBe('Image not saved');
  });
});

const engineStatus = (step: number, retrying = false) =>
  ({ step, retrying, main: null, shadows: [] }) as Parameters<
    typeof reportDocEngineStatus
  >[0];

describe('local save status', () => {
  beforeEach(() => resetSaveStatus());

  it('tracks real syncing and synced engine states', () => {
    reportDocEngineStatus(engineStatus(1));
    expect(getSaveStatus().state).toBe('saving');
    reportDocEngineStatus(engineStatus(2));
    expect(getSaveStatus()).toMatchObject({ state: 'saved', label: 'Saved locally', savedAt: expect.any(Number) });
  });

  it('keeps the last acknowledgement time stable until another save completes', () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1000);
    try {
      reportDocEngineStatus(engineStatus(2)); expect(getSaveStatus().savedAt).toBe(1000);
      clock.mockReturnValue(2000); reportDocEngineStatus(engineStatus(2)); expect(getSaveStatus().savedAt).toBe(1000);
      beginBlobWrite(); expect(getSaveStatus().savedAt).toBeUndefined();
      finishBlobWrite(); expect(getSaveStatus().savedAt).toBe(2000);
      resetSaveStatus(); expect(getSaveStatus().savedAt).toBeUndefined();
    } finally { clock.mockRestore(); }
  });

  it('keeps blob persistence in the saving state', () => {
    reportDocEngineStatus(engineStatus(2));
    beginBlobWrite();
    expect(getSaveStatus().state).toBe('saving');
    finishBlobWrite();
    expect(getSaveStatus().state).toBe('saved');
  });

  it('reports quota failures in plain language until a real sync succeeds', () => {
    reportDocWriteFailure(new DOMException('full', 'QuotaExceededError'));
    expect(getSaveStatus()).toMatchObject({ state: 'failed' });
    expect(getSaveStatus().message).toContain('local storage is full');
    reportDocEngineStatus(engineStatus(1));
    expect(getSaveStatus().state).toBe('failed');
    reportDocEngineStatus(engineStatus(2));
    expect(getSaveStatus().state).toBe('saved');
  });
});
