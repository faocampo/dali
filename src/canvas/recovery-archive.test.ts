import { beforeEach, afterEach, expect, test, vi } from 'vitest';
import type { DocSnapshot } from '@blocksuite/store';
import type { AccessScope } from './runtime';
const fixture = vi.hoisted(() => ({ blob: new Blob(['corrupt'], { type: 'image/png' }), handed: vi.fn(),
  scope: { accountId: 'member', boardId: 'board', generation: 1, role: 'owner', phase: 'active', canWrite: true } as AccessScope,
  expiresAt: Date.now() + 60000, accountId: 'member', references: [] as string[], snapshot: {} as DocSnapshot, readAsset: vi.fn(), written: '' }));
vi.mock('@blocksuite/affine/widgets/linked-doc', () => ({ createAssetsArchive: async () => ({ file: async (_path: string, data: string) => { fixture.written = data; }, generate: async () => new Blob(['zip']) }) }));
vi.mock('./runtime', () => {
  const runtime = () => ({ scope: { ...fixture.scope }, descriptor: { summary: { title: 'Synthetic' } }, store: {
    getBlocksByFlavour: () => fixture.references.map(id => ({ model: { props: { sourceId: id, caption: 'Synthetic image' } } })),
    getTransformer: () => ({ docToSnapshot: () => fixture.snapshot,
      assetsManager: { getPathBlobIdMap: () => new Map(fixture.references.map(id => [id, id])), readFromBlob: async () => undefined },
      assets: new Map(fixture.references.map(id => [id, fixture.blob])), [Symbol.dispose]: () => undefined }) } });
  return { getCanvasRuntime: async () => runtime(), getRecoveryRuntime: () => ({ runtime: runtime(), readLocalAsset: fixture.readAsset }), suspendAccessScope: () => { fixture.scope = { ...fixture.scope, phase: 'paused' }; } };
});
vi.mock('./account/mutation-guard', () => ({ accessScopeCurrent: () => true, canExportRecoveryScope: (scope: AccessScope) => fixture.scope.phase === 'active' && fixture.scope.role !== 'viewer' && fixture.scope.generation === scope.generation }));
vi.mock('../auth/session', () => ({ getSessionState: () => ({ phase: 'authenticated', member: { accountId: fixture.accountId, expiresAt: fixture.expiresAt } }) }));
vi.mock('../boards/BoardLibrary', () => ({ validDescriptor: (value: unknown) => !!value }));
vi.mock('./mindmap-compatibility', () => ({ validateMindmapDocument: () => undefined }));
vi.mock('./presentation-export', () => ({}));
import { exportBoardFile, buildSnapshotArchive } from './export-board';
import { downloadRecoveryCopy, captureRecoverySnapshot } from './recovery-archive';

beforeEach(() => {
  fixture.scope = { accountId: 'member', boardId: 'board', generation: 1, role: 'owner', phase: 'active', canWrite: true };
  fixture.expiresAt = Date.now() + 60000; fixture.accountId = 'member'; fixture.references = [];
  fixture.snapshot = { type: 'page', meta: { id: 'board', title: 'Synthetic', createDate: 1, tags: [] }, blocks: { type: 'block', id: 'page', flavour: 'affine:page', props: {}, children: [] } };
  fixture.handed.mockClear(); fixture.readAsset.mockReset(); fixture.written = '';
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ descriptor: { summary: { id: 'board', accountId: 'member', title: 'Synthetic', role: 'owner' }, capabilities: ['write'] } }))));
  vi.stubGlobal('document', { createElement: () => ({ style: {}, click: fixture.handed, remove: () => undefined }), body: { append: () => undefined } });
});
afterEach(() => vi.unstubAllGlobals());

test('corrupt required image bytes prevent editable archive handoff', async () => {
  fixture.references = ['A'.repeat(43) + '='];
  await expect(exportBoardFile()).rejects.toThrow(/image/i);
  expect(fixture.handed).not.toHaveBeenCalled();
});

test('zero-image paused snapshot downloads with unexpired local authority during outage', async () => {
  fixture.scope = { ...fixture.scope, canWrite: false, recoveryState: 'storage-paused' };
  vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
  await downloadRecoveryCopy(); expect(fixture.handed).toHaveBeenCalledOnce(); expect(JSON.parse(fixture.written)).toEqual(fixture.snapshot);
});
test.each(['expired', 'account', 'viewer', 'disposed'] as const)('%s scope prevents any recovery handoff', async reason => {
  if (reason === 'expired') fixture.expiresAt = 0;
  if (reason === 'account') fixture.accountId = 'other';
  if (reason === 'viewer') fixture.scope = { ...fixture.scope, role: 'viewer' };
  if (reason === 'disposed') fixture.scope = { ...fixture.scope, phase: 'disposed' };
  await expect(downloadRecoveryCopy()).rejects.toThrow(/access/); expect(fixture.handed).not.toHaveBeenCalled();
});
test('capture ignores subsequent native edits', () => {
  const { captured } = captureRecoverySnapshot(); fixture.snapshot.blocks.props.text = 'Later edit';
  expect(captured.snapshot.blocks.props.text).toBeUndefined();
});
test('missing required bytes fail with the human image label and zero handoff', async () => {
  fixture.references = ['A'.repeat(43) + '=']; fixture.readAsset.mockResolvedValue(null);
  vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
  await expect(downloadRecoveryCopy()).rejects.toThrow('Synthetic image'); expect(fixture.handed).not.toHaveBeenCalled();
});
test('account change during a delayed asset read prevents handoff', async () => {
  fixture.references = ['A'.repeat(43) + '=']; fixture.readAsset.mockImplementation(async () => { fixture.accountId = 'other'; return fixture.blob; });
  await expect(downloadRecoveryCopy()).rejects.toThrow(/access/); expect(fixture.handed).not.toHaveBeenCalled();
});
test('explicit permission denial invalidates local recovery authority', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 403 })));
  await expect(downloadRecoveryCopy()).rejects.toThrow(/access changed/); expect(fixture.handed).not.toHaveBeenCalled(); expect(fixture.scope.phase).toBe('paused');
});
test('builder rejects an image omitted from the captured asset manifest', async () => {
  fixture.snapshot.blocks.children.push({ type: 'block', id: 'image', flavour: 'affine:image', props: { sourceId: 'A'.repeat(43) + '=' }, children: [] });
  await expect(buildSnapshotArchive(fixture.snapshot, new Map(), [])).rejects.toThrow(/image/);
});
test('verified image and its original adjustment pixels are complete native archive inputs', async () => {
  const blob = new Blob(['synthetic image bytes'], { type: 'image/png' });
  const id = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())))).replace(/\+/g, '-').replace(/\//g, '_');
  fixture.snapshot.blocks.children.push(...['affine:image', 'djai:image-visual-edit'].map((flavour, i) => ({ type: 'block' as const, id: `image-${i}`, flavour, props: { sourceId: id }, children: [] })));
  const result = await buildSnapshotArchive(fixture.snapshot, new Map([[id, blob]]), [{ id, label: 'Image 1' }]);
  expect(result.size).toBeGreaterThan(0); expect(JSON.parse(fixture.written)).toEqual(fixture.snapshot);
});
