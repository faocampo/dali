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
} from './save-status';

it('@04-05-01 current document coverage establishes server saved time and retains it while newer work waits', () => {
  const fresh = createSaveSnapshot('synthetic-board-generation-1');
  const saved = reduceSaveStatus(fresh, { type: 'coverage', scope: fresh.scope, documents: { root: { revision: 0, acknowledged: true }, content: { revision: 0, acknowledged: true } }, images: [], at: 1000 });
  expect(saved).toMatchObject({ state: 'saved', label: 'Saved', savedAt: 1000 });
  const newer = reduceSaveStatus(saved, { type: 'coverage', scope: fresh.scope, documents: { root: { revision: 0, acknowledged: true }, content: { revision: 1, acknowledged: false } }, images: [], at: 2000 });
  expect(newer).toMatchObject({ state: 'saving', savedAt: 1000 });
  expect(reduceSaveStatus(newer, { type: 'coverage', scope: fresh.scope, documents: { root: { revision: 0, acknowledged: true }, content: { revision: 0, acknowledged: true } }, images: [], at: 3000 })).toBe(newer);
});

const engineStatus = (step: number, retrying = false) =>
  ({ step, retrying, main: null, shadows: [] }) as Parameters<
    typeof reportDocEngineStatus
  >[0];

describe('local save status', () => {
  beforeEach(resetSaveStatus);

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
