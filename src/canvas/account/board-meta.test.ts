import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { BoardMeta } from './board-meta';

function fixture(readonly: boolean) {
  const root = new Y.Doc();
  root.getMap('meta').set('pages', Y.Array.from([{ id: 'content', title: 'Old canvas title', createDate: 1, tags: [] }]));
  const meta = new BoardMeta(root, 'content', 'Server board title', () => {}, () => { if (readonly) throw new Error('Board is read-only'); });
  return { root, meta };
}
describe('server-owned board titles', () => {
  it.each([true, false])('projects a received server title without a document write when readonly=%s', readonly => {
    const { root, meta } = fixture(readonly); const before = Y.encodeStateAsUpdate(root);
    meta.receiveTitle('Live server title');
    expect(meta.getDocMeta('content')!.title).toBe('Live server title');
    expect(Y.encodeStateAsUpdate(root)).toEqual(before); root.destroy();
  });
  it.each([true, false])('ignores native title synchronization without changing Yjs when readonly=%s', readonly => {
    const { root, meta } = fixture(readonly); const before = Y.encodeStateAsUpdate(root);
    expect(() => meta.setDocMeta('content', { title: 'Old canvas title' })).not.toThrow();
    expect(meta.getDocMeta('content')!.title).toBe('Server board title');
    expect(Y.encodeStateAsUpdate(root)).toEqual(before); root.destroy();
  });
  it('still rejects Viewer metadata writes and foreign document IDs', () => {
    const { root, meta } = fixture(true); const before = Y.encodeStateAsUpdate(root);
    expect(() => meta.setDocMeta('content', { title: 'Other', tags: ['changed'] })).toThrow('Board is read-only');
    expect(() => meta.setDocMeta('foreign', { title: 'Other' })).toThrow();
    expect(Y.encodeStateAsUpdate(root)).toEqual(before); root.destroy();
  });
  it('preserves authorized non-title metadata changes', () => {
    const { root, meta } = fixture(false); meta.setDocMeta('content', { title: 'Ignored', tags: ['allowed'] });
    expect(meta.getDocMeta('content')).toMatchObject({ title: 'Server board title', tags: ['allowed'] }); root.destroy();
  });
});
