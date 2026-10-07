import { StoreContainer } from '@blocksuite/affine/store';
import type { AwarenessStore, Doc, GetStoreOptions, RemoveStoreOptions, Store, YBlock } from '@blocksuite/affine/store';
import type * as Y from 'yjs';
import type { BoardWorkspace } from './board-workspace';

/** Public Doc composition; lifecycle follows BlockSuite 0.22.4's StoreContainer
 * contract (BlockSuite, MIT). Disposal releases observers without clearing data. */
export class BoardDoc implements Doc {
  private container = new StoreContainer(this);
  private stores = new Set<Store>();
  private disposed = false;
  private isReady = false;
  readonly yBlocks: Y.Map<YBlock>;
  constructor(readonly workspace: BoardWorkspace, readonly spaceDoc: Y.Doc, readonly awarenessStore: AwarenessStore) {
    this.yBlocks = spaceDoc.getMap<YBlock>('blocks');
  }
  get id() { return this.spaceDoc.guid; }
  get rootDoc() { return this.workspace.doc; }
  get meta() { return this.workspace.meta.getDocMeta(this.id); }
  get ready() { return this.isReady; }
  get loaded() { return !this.disposed; }
  load(init?: () => void) {
    this.workspace.assertCurrent();
    if (this.disposed) throw new Error('Document disposed');
    if (!this.isReady) { this.spaceDoc.load(); init?.(); this.isReady = true; }
  }
  getStore(options: GetStoreOptions = {}) {
    this.workspace.assertCurrent();
    if (this.disposed) throw new Error('Document disposed');
    const store = this.container.getStore({ ...options, id: options.id ?? this.id,
      readonly: this.workspace.readonly || options.readonly,
      extensions: [...this.workspace.storeExtensions, ...(options.extensions ?? [])] });
    this.stores.add(store);
    return store;
  }
  removeStore(options: RemoveStoreOptions) { this.container.removeStore(options); }
  clear() { throw new Error('Board clearing requires an explicit canvas operation'); }
  remove() { throw new Error('Board deletion requires the board service'); }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const store of this.stores) { store.readonly = true; store.dispose(); }
    this.stores.clear(); this.isReady = false;
  }
}
