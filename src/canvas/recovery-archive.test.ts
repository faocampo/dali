import { expect, test, vi } from 'vitest';

const fixture = vi.hoisted(() => ({ blob: new Blob(['corrupt'], { type: 'image/png' }), handed: vi.fn() }));
vi.mock('@blocksuite/affine/widgets/linked-doc', () => ({ createAssetsArchive: async () => ({ file: async () => undefined, generate: async () => new Blob(['zip']) }) }));
vi.mock('./runtime', () => ({ getCanvasRuntime: async () => ({ scope: { accountId: 'member', boardId: 'board' }, store: { getTransformer: () => ({
  docToSnapshot: () => ({ meta: { title: 'Synthetic', id: 'board' } }),
  assetsManager: { getPathBlobIdMap: () => new Map([['image', 'A'.repeat(43) + '=']]), readFromBlob: async () => undefined },
  assets: new Map([['A'.repeat(43) + '=', fixture.blob]]), [Symbol.dispose]: () => undefined,
}) } }) }));
vi.mock('./account/mutation-guard', () => ({ accessScopeCurrent: () => true, canExportRecoveryScope: () => true }));
vi.mock('./presentation-export', () => ({}));
import { exportBoardFile } from './export-board';

test('corrupt required image bytes prevent editable archive handoff', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ descriptor: { summary: { id: 'board', accountId: 'member', title: 'Synthetic' } } }))));
  vi.stubGlobal('document', { createElement: () => ({ style: {}, click: fixture.handed, remove: () => undefined }), body: { append: () => undefined } });
  await expect(exportBoardFile()).rejects.toThrow(/image/i);
  expect(fixture.handed).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});
