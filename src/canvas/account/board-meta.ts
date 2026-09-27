import type { DocMeta, DocsPropertiesMeta, WorkspaceMeta } from '@blocksuite/affine/store';
import { Subject } from 'rxjs';
import * as Y from 'yjs';

/** Bounded public WorkspaceMeta contract. SQL remains authoritative for the title. */
export class BoardMeta implements WorkspaceMeta {
  readonly docMetaAdded = new Subject<string>();
  readonly docMetaRemoved = new Subject<string>();
  readonly docMetaUpdated = new Subject<void>();
  constructor(private root: Y.Doc, private contentId: string, private title: string, private readable: () => void, private writable: () => void) {}
  private get pages() {
    this.readable();
    const pages = this.root.getMap('meta').get('pages');
    if (!(pages instanceof Y.Array) || pages.length !== 1) throw new Error('Invalid board metadata');
    return pages;
  }
  get docMetas(): DocMeta[] {
    const raw = this.pages.get(0);
    const meta = raw instanceof Y.Map ? raw.toJSON() : raw;
    if (!meta || meta.id !== this.contentId || typeof meta.title !== 'string' || !Number.isFinite(meta.createDate) || !Array.isArray(meta.tags)) throw new Error('Invalid board metadata');
    return [{ ...structuredClone(meta), title: this.title }];
  }
  get docs() { return this.docMetas; }
  get properties(): DocsPropertiesMeta { this.readable(); return {}; }
  initialize() { void this.docMetas; }
  getDocMeta(id: string) { return this.docMetas.find(meta => meta.id === id); }
  addDocMeta(_props: DocMeta) { throw new Error('Board metadata is already bound'); }
  removeDocMeta(_id: string) { throw new Error('Board deletion requires the board service'); }
  setProperties(_properties: DocsPropertiesMeta) { throw new Error('Workspace properties are unavailable'); }
  setDocMeta(id: string, props: Partial<DocMeta>) {
    this.readable();
    if (id !== this.contentId || (props.id !== undefined && props.id !== id)) throw new Error('Document unavailable');
    // Native root hydration synchronizes its canvas title through this adapter.
    // Board titles are owned by the board service; this projection must not
    // write them back to Yjs, including when a renamed board is read-only.
    const changes = Object.entries(props).filter(([key]) => key !== 'title' && key !== 'id');
    if (!changes.length) return;
    this.writable();
    const pages = this.pages;
    const record = pages.get(0);
    this.root.transact(() => {
      if (record instanceof Y.Map) {
        for (const [key, value] of changes) record.set(key, value);
      } else {
        pages.delete(0); pages.insert(0, [{ ...record, ...Object.fromEntries(changes), id }]);
      }
    }, this.root.clientID);
    this.docMetaUpdated.next();
  }
  dispose() { this.docMetaAdded.complete(); this.docMetaRemoved.complete(); this.docMetaUpdated.complete(); }
}
