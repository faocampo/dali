import { expect, it } from 'vitest';
import { createRecoveryDataset } from '../testing/recovery-dataset.js';

it('@04-15-01 seeded recovery envelope contains fifty boards and at least 128 MiB of real images', () => {
  const manifest = createRecoveryDataset(415);
  expect(manifest.boards).toBe(50);
  expect(manifest.images).toBeGreaterThanOrEqual(50);
  expect(manifest.imageBytes).toBeGreaterThanOrEqual(128 * 1024 * 1024);
});
