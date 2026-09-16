import { AwarenessStore } from '@blocksuite/affine/store';
import type { Doc, ExtensionType, Workspace } from '@blocksuite/affine/store';
import { StoreExtensionManager } from '@blocksuite/affine/ext-loader';
import { BlobEngine, DocEngine } from '@blocksuite/affine/sync';
import { NoopLogger } from '@blocksuite/affine/global/utils';
import { Subject } from 'rxjs';
import { Awareness } from 'y-protocols/awareness.js';
import * as Y from 'yjs';
import type { BoardDescriptor } from '../../boards/BoardLibrary';
import { storeExtensions } from '../extensions';
import { BoardDocSource, type SourceOptions } from './doc-source';
import { BoardBlobSource, type BlobSourceOptions } from './blob-source';
import { BoardDoc } from './board-doc';
import { BoardMeta } from './board-meta';

export type AccountWorkspaceOptions = Omit<SourceOptions, 'boardId' | 'rootDocId' | 'contentDocId' | 'readonly'> & Pick<BlobSourceOptions, 'onPendingBlob'> & {
  descriptor: BoardDescriptor;
};

/** One authorized root/content pair, with no cross-board caches or network awareness. */
export class BoardWorkspace implements Workspace {
  readonly doc: Y.Doc;
  readonly meta: BoardMeta;
  readonly docSync: DocEngine;
  readonly blobSync: BlobEngine;
  readonly awarenessStore: AwarenessStore;
  readonly storeExtensions: ExtensionType[];
  readonly slots = { docListUpdated: new Subject<void>() };
  readonly idGenerator = () => crypto.randomUUID();
  readonly readonly: boolean;
  readonly key: string;
  private collections = new Map<string, Doc>();
  private disposed = false;
  private readonly abort = new AbortController();
  private readonly source: BoardDocSource;
  private readonly blobs: BoardBlobSource;
  get id() { return this.doc.guid; }
  get docs() { this.assertCurrent(); return new Map(this.collections); }
  constructor(readonly options: AccountWorkspaceOptions) {
    const { descriptor: d } = options;
    if (!options.accountId || d.summary.accountId !== options.accountId || !Number.isSafeInteger(options.generation) ||
      !d.rootDocId || !d.contentDocId || d.rootDocId === d.contentDocId || !d.summary.id || !['owner', 'editor', 'viewer'].includes(d.summary.role)) throw new Error('Invalid board scope');
    this.readonly = d.summary.role === 'viewer';
    this.key = JSON.stringify([options.accountId, d.summary.id, options.generation]);
    this.doc = new Y.Doc({ guid: d.rootDocId });
    this.awarenessStore = new AwarenessStore(new Awareness(this.doc));
    this.storeExtensions = new StoreExtensionManager(storeExtensions).get('store');
    const sourceOptions = { ...options, boardId: d.summary.id, rootDocId: d.rootDocId, contentDocId: d.contentDocId,
      readonly: this.readonly, signal: this.abort.signal };
    this.source = new BoardDocSource(sourceOptions);
    this.blobs = new BoardBlobSource(sourceOptions);
    this.docSync = new DocEngine(this.doc, this.source, [], new NoopLogger());
    this.blobSync = new BlobEngine(this.blobs, [], new NoopLogger());
    this.meta = new BoardMeta(this.doc, d.contentDocId, d.summary.title, () => {
      this.assertCurrent(); if (this.readonly) throw new Error('Board is read-only');
    });
    options.signal?.addEventListener('abort', this.dispose, { once: true });
  }
  assertCurrent() {
    if (this.disposed || this.options.signal?.aborted || this.options.isCurrent?.(this.options.generation) === false) throw new Error('Account workspace is stale');
  }
  private validateRoot = () => {
    const spaces = this.doc.getMap('spaces');
    const content = spaces.get(this.options.descriptor.contentDocId);
    if (spaces.size !== 1 || !(content instanceof Y.Doc) || content.guid !== this.options.descriptor.contentDocId || this.doc.getSubdocs().size !== 1) throw new Error('Document unavailable');
    this.meta.initialize();
    return content;
  };
  private rootChanged = () => {
    try { this.validateRoot(); } catch { this.dispose(); }
  };
  async hydrate() {
    this.assertCurrent();
    try {
      Y.applyUpdate(this.doc, (await this.source.pull(this.id, new Uint8Array([0]))).data, 'load');
      this.assertCurrent();
      const content = this.validateRoot();
      Y.applyUpdate(content, (await this.source.pull(content.guid, new Uint8Array([0]))).data, 'load');
      this.assertCurrent();
      if (content.getSubdocs().size || content.getMap('blocks').size === 0) throw new Error('Invalid board content');
      const doc = new BoardDoc(this, content, this.awarenessStore);
      this.collections.set(doc.id, doc);
      this.doc.on('update', this.rootChanged);
      const store = doc.getStore();
      store.load(); store.resetHistory();
      if (!store.root || store.getBlocksByFlavour('affine:surface').length !== 1) throw new Error('Invalid board content');
      if (!this.readonly) { this.docSync.start(); await this.waitForSynced(); }
      return this;
    } catch (error) { this.dispose(); throw error; }
  }
  createDoc(_id?: string): Doc { throw new Error('Board document is already bound'); }
  getDoc(id: string) { this.assertCurrent(); if (id !== this.options.descriptor.contentDocId) throw new Error('Document unavailable'); return this.collections.get(id) ?? null; }
  removeDoc(_id: string) { throw new Error('Board deletion requires the board service'); }
  async waitForSynced() { this.assertCurrent(); if (!this.readonly) await this.docSync.waitForSynced(this.abort.signal); this.assertCurrent(); }
  dispose = () => {
    if (this.disposed) return;
    this.disposed = true;
    this.abort.abort(); this.docSync.forceStop(); this.blobSync.stop();
    this.options.signal?.removeEventListener('abort', this.dispose);
    this.doc.off('update', this.rootChanged);
    for (const doc of this.collections.values()) doc.dispose();
    this.collections.clear(); this.meta.dispose(); this.slots.docListUpdated.complete();
    this.blobs.dispose(); this.awarenessStore.destroy(); this.doc.destroy();
  };
}

export async function createAccountWorkspace(options: AccountWorkspaceOptions) { return new BoardWorkspace(options).hydrate(); }
