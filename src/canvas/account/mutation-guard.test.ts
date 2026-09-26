import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import type { Store } from '@blocksuite/affine/store';
import type { AccessScope } from '../runtime';
const access = vi.hoisted(() => ({ scope: null as AccessScope | null, listeners: new Set<() => void>() }));
vi.mock('../runtime', () => ({ getActiveAccessScope: () => access.scope, subscribeAccessScope: (fn: () => void) => { access.listeners.add(fn); return () => access.listeners.delete(fn); } }));
import { installMutationGuard, canExportRecoveryScope, canMutateCurrentScope, accessScopeCurrent } from './mutation-guard';
describe('account mutation lifetime', () => {
  it('@04-04-02 storage pause preserves read and export authority separately from mutation', () => {
    const scope: AccessScope = { accountId: 'synthetic-a', boardId: 'synthetic-b', generation: 1, role: 'editor', canWrite: true, phase: 'active' };
    access.scope = { ...scope, canWrite: false, recoveryState: 'storage-paused' };
    expect(accessScopeCurrent(scope)).toBe(true); expect(canExportRecoveryScope(scope)).toBe(true); expect(canMutateCurrentScope(scope)).toBe(false);
    access.scope = { ...scope, recoveryState: 'denied' }; expect(canExportRecoveryScope(scope)).toBe(false);
    access.scope = { ...scope, role: 'viewer' }; expect(canExportRecoveryScope(scope)).toBe(false);
  });
  for (const transition of ['viewer', 'paused', 'account', 'board', 'storage-paused', 'epoch-mismatch', 'corrupt'] as const) it(`@04-04-02 deferred insertion after ${transition} scope loss leaves exact local bytes unchanged`, async () => {
    const scope: AccessScope = { accountId: 'synthetic-a', boardId: 'synthetic-b', generation: 1, role: 'editor', canWrite: true, phase: 'active' };
    access.scope = scope; const doc = new Y.Doc(); const map = doc.getMap('elements'); map.set('canary', 'retained');
    const store = { spaceDoc: doc, readonly: false, history: { undoManager: {} } } as unknown as Store;
    const release = installMutationGuard(store, scope); let resolve!: () => void;
    const decoding = new Promise<void>(done => { resolve = done; }); const pending = decoding.then(() => map.set('late', 'denied'));
    const before = Y.encodeStateAsUpdate(doc); const vector = Y.encodeStateVector(doc);
    access.scope = transition === 'viewer' ? { ...scope, role: 'viewer', canWrite: false } : transition === 'paused' ? { ...scope, phase: 'paused' } : transition === 'account' ? { ...scope, accountId: 'synthetic-other' } : transition === 'board' ? { ...scope, boardId: 'synthetic-other' } : { ...scope, recoveryState: transition };
    access.listeners.forEach(listener => listener()); resolve(); await pending;
    expect(Y.encodeStateAsUpdate(doc)).toEqual(before); expect(Y.encodeStateVector(doc)).toEqual(vector); release(); doc.destroy();
  });
  it('guards newly attached nested types, captured calls and stale identity without changing state vectors', () => {
    const scope: AccessScope = { accountId: 'synthetic-a', boardId: 'synthetic-b', generation: 1, role: 'editor', canWrite: true, phase: 'active' };
    access.scope = scope;
    const doc = new Y.Doc(); const root = doc.getMap('root');
    const store = { spaceDoc: doc, readonly: false, history: { undoManager: { undo: vi.fn(), redo: vi.fn() } }, transact: (fn: () => void) => doc.transact(fn) } as unknown as Store;
    const original = root.set; const release = installMutationGuard(store, scope); const releaseSecond = installMutationGuard(store, scope);
    release(); root.set('allowed', 1); expect(root.get('allowed')).toBe(1);
    const child = new Y.Map(); const text = new Y.Text(); child.set('text', text); root.set('child', child);
    text.insert(0, 'allowed'); const captured = text.insert.bind(text);
    const before = Y.encodeStateAsUpdate(doc); const vector = Y.encodeStateVector(doc);
    access.scope = { ...scope, generation: 2 };
    captured(0, 'denied'); child.set('denied', true); root.clear(); store.transact(() => root.set('bad', true));
    expect(Y.encodeStateAsUpdate(doc)).toEqual(before); expect(Y.encodeStateVector(doc)).toEqual(vector);
    releaseSecond(); expect(root.set).toBe(original); expect(access.listeners.size).toBe(0);
    captured(0, 'still denied'); expect(Y.encodeStateVector(doc)).toEqual(vector);
    doc.destroy();
  });
});
