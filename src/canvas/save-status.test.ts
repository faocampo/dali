import { beforeEach, describe, expect, it } from 'vitest';
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
    expect(getSaveStatus()).toEqual({ state: 'saved', label: 'Saved locally' });
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
