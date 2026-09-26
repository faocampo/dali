export type RecoveryDatasetManifest = { schema: 1; seed: number; boards: number; images: number; imageBytes: number };
export function createRecoveryDataset(seed: number): RecoveryDatasetManifest {
  return { schema: 1, seed, boards: 0, images: 0, imageBytes: 0 };
}
