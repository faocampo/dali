/** Test-only native conformance. Imported by the dev browser suite, never the app. */
import { createAccountWorkspace, createStagingWorkspace, type BoardWorkspace } from '../src/canvas/account/board-workspace';
import type { BoardDescriptor } from '../src/boards/BoardLibrary';
import { Text } from '@blocksuite/affine/store';
import type { Store } from '@blocksuite/affine/store';
import { BlockStdScope } from '@blocksuite/affine/std';
import { GfxControllerIdentifier } from '@blocksuite/affine/std/gfx';
import { ViewExtensionManager } from '@blocksuite/affine/ext-loader';
import { DocModeExtension } from '@blocksuite/affine/shared/services';
import { Subscription } from 'rxjs';
import { viewExtensions } from '../src/canvas/extensions';
import { FontWeight, MindmapElementModel, ShapeElementModel } from '@blocksuite/affine/model';
import { installMindmapCompatibility, validateMindmapDocument } from '../src/canvas/mindmap-compatibility';
import { renderBoardPresentation } from '../src/canvas/presentation-export';
import * as Y from 'yjs';

const bytes = (doc: Y.Doc) => Array.from(Y.encodeStateAsUpdate(doc));
const hash = async (blob: Blob) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))).join(',');
const snapshot = (store: Store) => {
  const transformer = store.getTransformer();
  try { return transformer.docToSnapshot(store); } finally { transformer[Symbol.dispose](); }
};

async function populate(workspace: BoardWorkspace, view: Awaited<ReturnType<typeof mount>>) {
  const { store } = view.host;
  const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 24;
  const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#d12c47'; ctx.fillRect(0, 0, 32, 24);
  const image = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!), 'image/png'));
  const key = await workspace.blobSync.set(image);
  const surface = view.gfx.surface!;
  store.addBlock('affine:image', { sourceId: key, xywh: '[20,300,128,96]', width: 32, height: 24 }, surface.id);
  const mapId = surface.addElement({ type: 'mindmap', layoutType: 0, style: 1 });
  const map = surface.getElementById(mapId) as MindmapElementModel;
  const root = map.addNode(null, undefined, 'after', { text: 'Account map root', xywh: '[300,100,160,60]' });
  const child = map.addNode(root, undefined, 'after', { text: 'Formatted branch', xywh: '[520,100,160,60]' });
  map.addNode(child, undefined, 'after', { text: 'Hidden descendant', xywh: '[740,100,180,60]' });
  map.addNode(root, undefined, 'after', { text: 'Ordered sibling', xywh: '[520,220,160,60]' });
  const shape = surface.getElementById(child) as ShapeElementModel;
  shape.fontSize = 28; shape.fontWeight = FontWeight.Bold; shape.color = '#2468ab';
  map.toggleCollapse(map.getNode(child)!, { layout: true });
  store.captureSync(); validateMindmapDocument(store);
  await workspace.waitForSynced();
  return { key, imageHash: await hash(image), mapId };
}

function mapState(view: Awaited<ReturnType<typeof mount>>) {
  const map = view.gfx.surface!.elementModels.find(model => model instanceof MindmapElementModel) as MindmapElementModel;
  return [...map.children].map(([id, detail]) => {
    const shape = map.surface.getElementById(id) as ShapeElementModel;
    return { id, ...detail, text: shape.text?.toString(), fontSize: shape.fontSize, fontWeight: shape.fontWeight, color: shape.color };
  });
}

export async function stagingConformance(descriptor: BoardDescriptor, destination: BoardDescriptor, accountId: string) {
  const source = await createAccountWorkspace({ descriptor, accountId, generation: 1 });
  const store = source.getDoc(descriptor.contentDocId)!.getStore(); const view = await mount(store);
  const fixture = await populate(source, view); const before = snapshot(store); const docsBefore = [...source.docs.keys()];
  const sourceBytes = JSON.stringify([bytes(source.doc), bytes(store.spaceDoc)]); let stagingRequests = 0;
  const staged = createStagingWorkspace({ descriptor: destination, accountId, generation: 2,
    fetch: async () => { stagingRequests++; throw new Error('Staging attempted network access'); },
    onPendingBlob: () => { stagingRequests++; }, onPendingDocument: () => { stagingRequests++; } });
  const emptyBefore = staged.docs.size === 0;
  const transformer = staged.createImportTransformer(store.schema);
  try {
    await staged.blobSync.set(fixture.key, (await source.blobSync.get(fixture.key))!);
    const copied = await transformer.snapshotToDoc(structuredClone(before!));
    if (!copied) throw new Error('Native snapshot copy failed');
    copied.resetHistory(); validateMindmapDocument(copied);
    const destinationId = copied.id; const destinationCount = staged.docs.size;
    const copiedSnapshot = snapshot(copied)!;
    const copiedText = JSON.stringify(copiedSnapshot);
    const copiedHash = await hash((await staged.blobSync.get(fixture.key))!);
    transformer[Symbol.dispose](); staged.dispose(); staged.dispose();
    return { sourceUnchanged: JSON.stringify(snapshot(store)) === JSON.stringify(before) && JSON.stringify([...source.docs.keys()]) === JSON.stringify(docsBefore) && JSON.stringify([bytes(source.doc), bytes(store.spaceDoc)]) === sourceBytes,
      imageUnchanged: copiedHash === fixture.imageHash && await hash((await source.blobSync.get(fixture.key))!) === fixture.imageHash,
      destinationId, destinationCount, isolated: stagingRequests === 0 && emptyBefore && !copiedText.includes(descriptor.contentDocId) && copiedText.includes('Hidden descendant') };
  } finally { transformer[Symbol.dispose](); staged.dispose(); view.dispose(); source.dispose(); }
}

export async function nativeFeatures(descriptor: BoardDescriptor, accountId: string) {
  let workspace = await createAccountWorkspace({ descriptor, accountId, generation: 10 });
  let store = workspace.getDoc(descriptor.contentDocId)!.getStore(); let view = await mount(store);
  const fixture = await populate(workspace, view);
  const before = snapshot(store); const mapBefore = mapState(view);
  const shape = view.gfx.surface!.getElementById(mapBefore[0]!.id) as ShapeElementModel;
  const original = shape.fontSize; store.captureSync(); shape.fontSize = original + 4; store.captureSync();
  const canUndo = store.canUndo; store.undo(); const undo = shape.fontSize === original; store.redo(); const redo = shape.fontSize === original + 4;
  store.undo(); store.captureSync(); await workspace.waitForSynced();
  view.dispose(); workspace.dispose();
  workspace = await createAccountWorkspace({ descriptor, accountId, generation: 11 });
  store = workspace.getDoc(descriptor.contentDocId)!.getStore(); view = await mount(store);
  try {
    validateMindmapDocument(store);
    const render = await renderBoardPresentation({ scope: 'board', scale: 1 });
    const pixels = render.canvas.getContext('2d')!.getImageData(0, 0, render.canvas.width, render.canvas.height).data;
    let ink = 0; let imageInk = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3]! && Math.min(pixels[i]!, pixels[i + 1]!, pixels[i + 2]!) < 180) ink++;
      if (pixels[i]! === 209 && pixels[i + 1]! === 44 && pixels[i + 2]! === 71 && pixels[i + 3]! === 255) imageInk++;
    }
    const exported = { width: render.canvas.width, height: render.canvas.height, ink, imageInk, png: render.canvas.toDataURL().startsWith('data:image/png;base64,') }; render.canvas.width = 0;
    return { snapshotEqual: JSON.stringify(snapshot(store)) === JSON.stringify(before), mapEqual: JSON.stringify(mapState(view)) === JSON.stringify(mapBefore),
      imageEqual: await hash((await workspace.blobSync.get(fixture.key))!) === fixture.imageHash, canUndo, undo, redo, exported, map: mapState(view), key: fixture.key };
  } finally { view.dispose(); workspace.dispose(); }
}

export async function viewerConformance(descriptor: BoardDescriptor, accountId: string) {
  const mutations: string[] = []; let writes = 0;
  const observedFetch: typeof fetch = async (input, init) => {
    if (String(input).endsWith('/push') || ['PUT', 'DELETE'].includes(init?.method ?? '')) writes++;
    return fetch(input, init);
  };
  const workspace = await createAccountWorkspace({ descriptor, accountId, generation: 20, fetch: observedFetch,
    onReadonlyMutation: error => mutations.push(error.message) });
  const store = workspace.getDoc(descriptor.contentDocId)!.getStore();
  const before = bytes(store.spaceDoc); const rootBefore = bytes(workspace.doc);
  const view = await mount(store);
  try {
    view.gfx.viewport.setZoom(0.8); view.gfx.viewport.setCenter(250, 200);
    const render = await renderBoardPresentation({ scope: 'board', scale: 1 });
    const width = render.canvas.width; render.canvas.width = 0;
    const readonly = store.readonly;
    const unchanged = JSON.stringify(bytes(store.spaceDoc)) === JSON.stringify(before) && JSON.stringify(bytes(workspace.doc)) === JSON.stringify(rootBefore);
    view.dispose(); workspace.dispose(); workspace.dispose();
    return { readonly, writes, mutations, unchanged, width, localMutations: workspace.readonlyMutations };
  } finally { view.dispose(); workspace.dispose(); }
}

export async function canary(descriptor: BoardDescriptor, accountId: string, text?: string) {
  const workspace = await createAccountWorkspace({ descriptor, accountId, generation: 30 });
  const store = workspace.getDoc(descriptor.contentDocId)!.getStore(); const view = await mount(store);
  try {
    if (text) { view.gfx.surface!.addElement({ type: 'text', text: new Text(text).yText, xywh: '[0,0,300,60]' }); await workspace.waitForSynced(); }
    const result = JSON.stringify(snapshot(store)); const docIds = [...workspace.docs.keys()];
    view.dispose(); workspace.dispose(); let disposedRejected = false;
    try { workspace.getDoc(descriptor.contentDocId); } catch {
      try { void workspace.meta.docMetas; } catch { disposedRejected = store.readonly; }
    }
    return { snapshot: result, docIds, disposedRejected };
  } finally { view.dispose(); workspace.dispose(); }
}

export async function lifecycleConformance(descriptor: BoardDescriptor, accountId: string) {
  let failed = false;
  try { await createAccountWorkspace({ descriptor, accountId, generation: 40, fetch: async () => { throw new Error('Synthetic transport failure'); } }); } catch { failed = true; }
  const retryWorkspace = await createAccountWorkspace({ descriptor, accountId, generation: 41 });
  const retry = !!retryWorkspace.getDoc(descriptor.contentDocId)!.getStore().root;
  retryWorkspace.dispose();
  const abort = new AbortController(); let release!: () => void; let loaded!: () => void;
  const arrived = new Promise<void>(resolve => { loaded = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  const late = createAccountWorkspace({ descriptor, accountId, generation: 42, signal: abort.signal,
    fetch: async (input, init) => { const result = await fetch(input, init); loaded(); await gate; return result; } }).then(() => false, () => true);
  await arrived; abort.abort(); release(); const lateRejected = await late;
  const rejectsForeign = async (content: boolean) => {
    const workspace = await createAccountWorkspace({ descriptor, accountId, generation: 43 });
    const target = content ? workspace.getDoc(descriptor.contentDocId)!.spaceDoc : workspace.doc;
    target.getMap('spaces').set('foreign-content-canary', new Y.Doc({ guid: 'foreign-content-canary' }));
    let rejected = false; try { workspace.getDoc(descriptor.contentDocId); } catch { rejected = true; }
    workspace.dispose(); return rejected;
  };
  const foreignRootRejected = await rejectsForeign(false); const foreignContentRejected = await rejectsForeign(true);
  let generation = 44; const stale = await createAccountWorkspace({ descriptor, accountId, generation, isCurrent: value => value === generation });
  generation++; let staleRejected = false; try { stale.getDoc(descriptor.contentDocId); } catch { staleRejected = true; } stale.dispose();
  let disposalWrites = 0; let disposing = false;
  const workspace = await createAccountWorkspace({ descriptor, accountId, generation: 45, fetch: async (input, init) => {
    if (disposing && (String(input).endsWith('/push') || ['PUT', 'DELETE'].includes(init?.method ?? ''))) disposalWrites++;
    return fetch(input, init);
  } });
  disposing = true; workspace.dispose(); workspace.dispose(); await new Promise(resolve => setTimeout(resolve, 50));
  return { failed, retry, lateRejected, foreignRootRejected, foreignContentRejected, staleRejected, disposalWrites };
}

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
  const cleanup = installMindmapCompatibility(host); let disposed = false;
  return { host, gfx: std.get(GfxControllerIdentifier), dispose: () => { if (disposed) return; disposed = true; cleanup(); viewport.remove(); } };
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
