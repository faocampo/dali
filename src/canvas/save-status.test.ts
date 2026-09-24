import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  beginBlobWrite,
  finishBlobWrite,
  getSaveStatus,
  reportDocEngineStatus,
  reportDocWriteFailure,
  resetSaveStatus,
} from './save-status';

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
