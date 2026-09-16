/** Test-only native conformance. Imported by the dev browser suite, never the app. */
import { createAccountWorkspace } from '../src/canvas/account/board-workspace';
import type { BoardDescriptor } from '../src/boards/BoardLibrary';
import { Text } from '@blocksuite/affine/store';
import type { Store } from '@blocksuite/affine/store';
import { BlockStdScope } from '@blocksuite/affine/std';
import { GfxControllerIdentifier } from '@blocksuite/affine/std/gfx';
import { ViewExtensionManager } from '@blocksuite/affine/ext-loader';
import { DocModeExtension } from '@blocksuite/affine/shared/services';
import { Subscription } from 'rxjs';
import { viewExtensions } from '../src/canvas/extensions';

export async function mount(store: Store) {
  const std = new BlockStdScope({ store, extensions: [
    ...new ViewExtensionManager(viewExtensions).get('edgeless'),
    DocModeExtension({ getEditorMode: () => 'edgeless', getPrimaryMode: () => 'edgeless',
      setEditorMode: () => {}, setPrimaryMode: () => {}, togglePrimaryMode: () => 'edgeless',
      onPrimaryModeChange: () => new Subscription() }),
  ] });
  const viewport = document.createElement('div');
  viewport.className = 'affine-edgeless-viewport'; viewport.dataset.theme = 'light';
  viewport.style.cssText = 'position:fixed;inset:0;width:1280px;height:800px;background:white;z-index:100';
  const host = std.render(); viewport.append(host); document.body.append(viewport);
  await host.updateComplete;
  return { host, gfx: std.get(GfxControllerIdentifier), dispose: () => viewport.remove() };
}

export async function roundTrip(descriptor: BoardDescriptor, accountId: string) {
  let acknowledged = 0;
  const workspace = await createAccountWorkspace({ descriptor, accountId, generation: 1, onAcknowledged: () => { acknowledged++; } });
  const store = workspace.getDoc(descriptor.contentDocId)!.getStore();
  const view = await mount(store);
  const surface = view.gfx.surface!;
  const shapeId = surface.addElement({ type: 'shape', shapeType: 'rect', xywh: '[20,20,100,80]' });
  const textId = surface.addElement({ type: 'text', text: new Text('Account text canary').yText, xywh: '[150,20,300,60]' });
  store.captureSync();
  await workspace.waitForSynced();
  const metadataCount = workspace.meta.docMetas.length;
  let foreignRejected = false;
  try { workspace.getDoc('foreign-content-canary'); } catch { foreignRejected = true; }
  view.dispose(); workspace.dispose(); workspace.dispose();
  const reopened = await createAccountWorkspace({ descriptor, accountId, generation: 2 });
  try {
    const nextStore = reopened.getDoc(descriptor.contentDocId)!.getStore();
    const next = await mount(nextStore);
    try {
      const shape = next.gfx.surface!.getElementById(shapeId)!;
      const text = next.gfx.surface!.getElementById(textId)!;
      return { text: String((text as unknown as { text: Text }).text), shape: (shape as unknown as { shapeType: string }).shapeType,
        metadataCount, foreignRejected, acknowledged, rootCount: nextStore.getBlocksByFlavour('affine:page').length,
        surfaceCount: nextStore.getBlocksByFlavour('affine:surface').length };
    } finally { next.dispose(); }
  } finally { reopened.dispose(); }
}
