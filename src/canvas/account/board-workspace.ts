import { AwarenessStore, Transformer } from '@blocksuite/affine/store';
import type { Doc, ExtensionType, Schema, Workspace } from '@blocksuite/affine/store';
import { StoreExtensionManager } from '@blocksuite/affine/ext-loader';
import { BlobEngine, DocEngine, DocEngineStep, NoopDocSource } from '@blocksuite/affine/sync';
import type { BlobSource } from '@blocksuite/affine/sync';
import { replaceIdMiddleware } from '@blocksuite/affine/shared/adapters';
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

export type AccountWorkspaceOptions = Omit<SourceOptions, 'boardId' | 'rootDocId' | 'contentDocId' | 'readonly'> & Pick<BlobSourceOptions, 'onPendingBlob' | 'onFetchedBlob'> & {
  descriptor: BoardDescriptor;
  onReadonlyMutation?: (error: Error) => void;
  recoveryBaseline?: { root: Uint8Array; content: Uint8Array; assets: Map<string, Blob> };
  openRestored?: boolean;
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
  private hydrated = false;
  private content?: Y.Doc;
  private memoryBlobs = new Map<string, Blob>();
  readonlyMutations = 0;
  private readonly abort = new AbortController();
  private readonly source: BoardDocSource;
  private readonly blobs: BoardBlobSource;
  get id() { return this.doc.guid; }
  get docs() { this.assertCurrent(); return new Map(this.collections); }
  constructor(readonly options: AccountWorkspaceOptions, private mode: 'account' | 'staging' = 'account') {
    this.options = { ...options, descriptor: structuredClone(options.descriptor) };
    options = this.options;
    const { descriptor: d } = options;
    if (!options.accountId || d.summary.accountId !== options.accountId || !Number.isSafeInteger(options.generation) ||
      !d.rootDocId || !d.contentDocId || d.rootDocId === d.contentDocId || !d.summary.id || !['owner', 'editor', 'viewer'].includes(d.summary.role)) throw new Error('Invalid board scope');
    if (mode === 'staging' && d.summary.role === 'viewer') throw new Error('Board is read-only');
    this.readonly = d.summary.role === 'viewer';
    this.key = JSON.stringify([options.accountId, d.summary.id, options.generation]);
    this.doc = new Y.Doc({ guid: d.rootDocId });
    this.awarenessStore = new AwarenessStore(new Awareness(this.doc));
    this.storeExtensions = new StoreExtensionManager(storeExtensions).get('store');
    const sourceOptions = { ...options, getRecoveryEpoch: options.getRecoveryEpoch ?? (() => d.recoveryEpoch), boardId: d.summary.id, rootDocId: d.rootDocId, contentDocId: d.contentDocId,
      readonly: this.readonly, signal: this.abort.signal, onAuthorizationLost: (error: Parameters<NonNullable<SourceOptions['onAuthorizationLost']>>[0]) => {
        // Runtime must freeze/capture buffered updates before destroying native documents.
        if (options.onAuthorizationLost) options.onAuthorizationLost(error);
        else this.dispose();
      } };
    this.source = new BoardDocSource(sourceOptions);
    this.blobs = new BoardBlobSource(sourceOptions);
    this.docSync = new DocEngine(this.doc, mode === 'staging' ? new NoopDocSource() : this.source, [], new NoopLogger());
    const memory: BlobSource = { name: 'isolated-board-staging', readonly: false,
      get: async key => { this.assertCurrent(); return this.memoryBlobs.get(key) ?? null; },
      set: async (key, blob) => { this.assertCurrent(); this.memoryBlobs.set(key, blob); return key; },
      delete: async key => { this.assertCurrent(); this.memoryBlobs.delete(key); },
      list: async () => { this.assertCurrent(); return [...this.memoryBlobs.keys()]; } };
    this.blobSync = new BlobEngine(mode === 'staging' ? memory : this.blobs, [], new NoopLogger());
    this.meta = new BoardMeta(this.doc, d.contentDocId, d.summary.title, () => this.assertCurrent(), () => {
      this.assertCurrent(); if (this.readonly) throw new Error('Board is read-only');
    });
    options.signal?.addEventListener('abort', this.dispose, { once: true });
    if (mode === 'staging') {
      this.content = new Y.Doc({ guid: d.contentDocId });
      this.doc.getMap('spaces').set(d.contentDocId, this.content);
      this.doc.getMap('meta').set('pages', Y.Array.from([{ id: d.contentDocId, title: d.summary.title, createDate: d.summary.updatedAt, tags: [] }]));
      this.meta.initialize();
    }
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
  private contentChanged = () => {
    if (this.content?.getSubdocs().size) this.dispose();
  };
  private readonlyChanged = () => {
    this.readonlyMutations++;
    const error = new Error('Read-only hydration generated a mutation');
    this.dispose(); this.options.onReadonlyMutation?.(error);
  };
  async hydrate() {
    this.assertCurrent();
    if (this.mode !== 'account' || this.hydrated) throw new Error('Workspace is already initialized');
    this.hydrated = true;
    const timeout = setTimeout(this.dispose, 20_000);
    try {
      const baseline = this.options.recoveryBaseline;
      Y.applyUpdate(this.doc, baseline?.root ?? (await this.source.pull(this.id, new Uint8Array([0]))).data, 'load');
      this.assertCurrent();
      const content = this.validateRoot();
      this.content = content;
      Y.applyUpdate(content, baseline?.content ?? (await this.source.pull(content.guid, new Uint8Array([0]))).data, 'load');
      this.assertCurrent();
      if (content.getSubdocs().size || content.getMap('blocks').size === 0) throw new Error('Invalid board content');
      const doc = new BoardDoc(this, content, this.awarenessStore);
      this.collections.set(doc.id, doc);
      this.doc.on('update', this.rootChanged);
      content.on('subdocs', this.contentChanged);
      if (this.readonly) {
        // SyncPeer unconditionally queues hydration pushes. Readers hydrate
        // explicitly and refresh through a fresh authorized workspace instead.
        this.doc.on('update', this.readonlyChanged); content.on('update', this.readonlyChanged);
      }
      const store = doc.getStore();
      store.load(); store.resetHistory();
      if (!store.root || store.getBlocksByFlavour('affine:surface').length !== 1) throw new Error('Invalid board content');
      if (!this.readonly) { this.docSync.start(); if (!baseline) await this.waitForSynced(); }
      this.assertCurrent();
      return this;
    } catch (error) { this.dispose(); throw error; } finally { clearTimeout(timeout); }
  }
  createDoc(id = this.options.descriptor.contentDocId): Doc {
    this.assertCurrent();
    if (this.mode !== 'staging' || id !== this.options.descriptor.contentDocId || this.collections.size || !this.content) throw new Error('Board document is already bound');
    const doc = new BoardDoc(this, this.content, this.awarenessStore); this.collections.set(id, doc); return doc;
  }
  /** One transformer per reserved destination; source models and blobs stay untouched. */
  createImportTransformer(schema: Schema) {
    this.assertCurrent();
    if (this.mode !== 'staging' || this.collections.size) throw new Error('Staging is already initialized');
    let first = true;
    return new Transformer({ schema,
      middlewares: [replaceIdMiddleware(() => { if (first) { first = false; return this.options.descriptor.contentDocId; } return this.idGenerator(); })],
      blobCRUD: { get: key => this.blobSync.get(key), set: (key, blob) => this.blobSync.set(key, blob),
        list: () => this.blobSync.list(), delete: key => { this.assertCurrent(); this.memoryBlobs.delete(key); } },
      docCRUD: { create: id => this.createDoc(id).getStore(), get: id => this.getDoc(id)?.getStore() ?? null, delete: id => this.removeDoc(id) },
    });
  }
  getDoc(id: string) { this.assertCurrent(); if (id !== this.options.descriptor.contentDocId) throw new Error('Document unavailable'); return this.collections.get(id) ?? null; }
  removeDoc(_id: string) { throw new Error('Board deletion requires the board service'); }
  async waitForSynced() {
    this.assertCurrent();
    if (!this.readonly && this.mode === 'account' && this.docSync.status.step !== DocEngineStep.Synced) {
      await new Promise<void>((resolve, reject) => {
        const abort = () => { subscription.unsubscribe(); reject(new Error('Account workspace is stale')); };
        const subscription = this.docSync.onStatusChange.subscribe(status => {
          if (status.step === DocEngineStep.Synced) {
            subscription.unsubscribe(); this.abort.signal.removeEventListener('abort', abort); resolve();
          }
        });
        this.abort.signal.addEventListener('abort', abort, { once: true });
      });
    }
    this.assertCurrent();
  }
  dispose = () => {
    if (this.disposed) return;
    this.disposed = true;
    this.abort.abort(); this.docSync.forceStop(); this.blobSync.stop();
    this.docSync.onStatusChange.complete();
    this.options.signal?.removeEventListener('abort', this.dispose);
    this.doc.off('update', this.rootChanged);
    this.doc.off('update', this.readonlyChanged); this.content?.off('update', this.readonlyChanged);
    this.content?.off('subdocs', this.contentChanged);
    for (const doc of this.collections.values()) doc.dispose();
    this.collections.clear(); this.meta.dispose(); this.slots.docListUpdated.complete();
    this.blobs.dispose(); this.memoryBlobs.clear(); this.awarenessStore.destroy(); this.doc.destroy();
  };
}

export async function createAccountWorkspace(options: AccountWorkspaceOptions) {
  const workspace = new BoardWorkspace(options);
  try { return await workspace.hydrate(); } catch (error) { workspace.dispose(); throw error; }
}
export function createStagingWorkspace(options: AccountWorkspaceOptions) {
  const workspace = new BoardWorkspace(options, 'staging');
  try { workspace.assertCurrent(); return workspace; } catch (error) { workspace.dispose(); throw error; }
}
