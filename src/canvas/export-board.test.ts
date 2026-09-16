import { afterEach, expect, it, vi } from 'vitest';
import type { AccessScope } from './runtime';
const state = vi.hoisted(() => ({
  scope: { accountId: 'synthetic-a', boardId: 'synthetic-b', generation: 1, role: 'viewer', canWrite: false, phase: 'active' } as AccessScope,
  zip: vi.fn(), render: vi.fn(), clicks: vi.fn(),
}));
vi.mock('./runtime', () => ({ getActiveAccessScope: () => state.scope, getCanvasRuntime: async () => ({ scope: state.scope, workspace: {}, store: { schema: {} }, descriptor: { summary: { title: 'Synthetic export' } } }) }));
vi.mock('@blocksuite/affine/widgets/linked-doc', () => ({ ZipTransformer: { exportDocs: state.zip }, createAssetsArchive: vi.fn() }));
vi.mock('./presentation-export', () => ({ renderBoardPresentation: state.render }));
import { exportBoardFile } from './export-board';
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
it('@03-09-02 direct editable service denies Viewer before producing any artifact', async () => {
  state.scope = { ...state.scope, role: 'viewer', canWrite: false, phase: 'active' };
  await expect(exportBoardFile('board')).rejects.toThrow(/editable|permission|access/i);
  expect(state.zip).not.toHaveBeenCalled(); expect(state.render).not.toHaveBeenCalled();
});
it('@03-09-02 rendering completion after identity changes produces no download', async () => {
  state.scope = { ...state.scope, role: 'viewer', canWrite: false, phase: 'active' };
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ summary: { id: state.scope.boardId, accountId: state.scope.accountId, title: 'Synthetic export' } }) })));
  vi.stubGlobal('document', { createElement: () => ({ style: {}, click: state.clicks, remove: vi.fn() }), body: { append: vi.fn() } });
  state.render.mockImplementation(async () => {
    state.scope = { ...state.scope, generation: state.scope.generation + 1 };
    return { canvas: { width: 4, height: 4, toBlob: (fn: (blob: Blob) => void) => fn(new Blob(['pixels'], { type: 'image/png' })) }, durationMs: 1, estimatedBytes: 64 };
  });
  await expect(exportBoardFile('png', { scope: 'board' })).rejects.toThrow(/changed|access|stale/i);
  expect(state.render).toHaveBeenCalledOnce();
  expect(state.clicks).not.toHaveBeenCalled();
});
