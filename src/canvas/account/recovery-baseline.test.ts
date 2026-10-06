import { expect, it } from 'vitest';
import * as Y from 'yjs';
import { advanceSharedBaseline, canonicalRecoveryUpdate, reconcileRecoveryReceipts, recoveryDigest, recoveryVersionsDiffer, validSharedRecoveryBaseline, type SharedRecoveryBaseline } from './recovery-baseline';
const epoch = '11111111-1111-4111-8111-111111111111';
function fixture() {
  const root = new Y.Doc(); const content = new Y.Doc(); content.getMap('shapes').set('a', 0); content.getMap('shapes').set('b', 0);
  const baseline: SharedRecoveryBaseline = { version: 1, epoch, root: { docId: 'root', data: Y.encodeStateAsUpdate(root) }, content: { docId: 'content', data: Y.encodeStateAsUpdate(content) }, title: 'Synthetic board', revision: 1, titleRevision: 1 };
  root.destroy(); content.destroy(); return baseline;
}
function change(base: SharedRecoveryBaseline, key: string, value: number) {
  const doc = new Y.Doc(); Y.applyUpdate(doc, base.content.data); const vector = Y.encodeStateVector(doc);
  doc.getMap('shapes').set(key, value); const update = Y.encodeStateAsUpdate(doc, vector); doc.destroy();
  return { update, baseline: { ...base, revision: base.revision + 1, content: { ...base.content, data: canonicalRecoveryUpdate([base.content.data, update]) } } };
}
it('@05-05-01 treats disjoint remote edits, ABA, title-only edits and unknown legacy baselines as a version choice', () => {
  const base = fixture();
  expect(recoveryVersionsDiffer(base, change(base, 'b', 2).baseline)).toBe(true);
  expect(recoveryVersionsDiffer(base, change(change(base, 'a', 1).baseline, 'a', 0).baseline)).toBe(true);
  expect(recoveryVersionsDiffer(base, { ...base, title: 'Renamed' })).toBe(true);
  expect(recoveryVersionsDiffer(undefined, base)).toBe(true);
  expect(recoveryVersionsDiffer(base, { ...base, revision: 900, titleRevision: 900 })).toBe(false);
  expect(recoveryVersionsDiffer(base, { ...base, epoch: '22222222-2222-4222-8222-222222222222' })).toBe(true);
});
it('@05-05-01 reconciles a lost own acknowledgement without mutating or accepting divergent candidate bytes', async () => {
  const base = fixture(); const original = structuredClone(base); const own = change(base, 'a', 5); const local = change(own.baseline, 'a', 10); const immutable = structuredClone(local.baseline);
  const attempt = { tabId: 'original-tab', operationId: 'own-operation', digest: await recoveryDigest(own.update) };
  const row = { id: 'submission', resource: 'content', data: own.update, attempt, coveredIds: ['local-event'] };
  const receipt = { ...attempt, docId: 'content', previousRevision: 1, revision: 2 };
  const result = await reconcileRecoveryReceipts(base, [row], [receipt]);
  expect(result.acknowledgedIds).toEqual(['submission', 'local-event']);
  expect(recoveryVersionsDiffer(result.baseline, own.baseline)).toBe(false);
  expect(recoveryVersionsDiffer(result.baseline, change(own.baseline, 'b', 7).baseline)).toBe(true);
  expect(local.baseline).toEqual(immutable); expect(base).toEqual(original);
  for (const altered of [{ ...receipt, tabId: 'other-tab' }, { ...receipt, digest: '0'.repeat(64) }, { ...receipt, docId: 'root' }])
    expect((await reconcileRecoveryReceipts(base, [row], [altered])).acknowledgedIds).toEqual([]);
  expect((await reconcileRecoveryReceipts(base, [{ ...row, data: local.update }], [receipt])).acknowledgedIds).toEqual([]);
});
it('@05-05-01 an older poll cannot erase a newer committed operation or acknowledged title', () => {
  const base = fixture(); const committed = change(base, 'a', 6).baseline;
  const observed = { ...committed, title: 'New name', titleRevision: 2 };
  const merged = advanceSharedBaseline(observed, base);
  expect(recoveryVersionsDiffer(merged, observed)).toBe(false);
  const remote = change(committed, 'b', 7).baseline;
  expect(recoveryVersionsDiffer(advanceSharedBaseline(merged, remote), { ...remote, title: 'New name' })).toBe(false);
});
it('@05-05-01 incomplete or mismatched baseline metadata cannot authorize replay', () => {
  const base = fixture();
  expect(validSharedRecoveryBaseline(base)).toBe(true);
  expect(validSharedRecoveryBaseline({ ...base, content: base.root })).toBe(false);
  expect(validSharedRecoveryBaseline({ ...base, titleRevision: 2 })).toBe(false);
  expect(() => advanceSharedBaseline(base, { ...base, epoch: '22222222-2222-4222-8222-222222222222' })).toThrow();
  expect(() => canonicalRecoveryUpdate([change(base, 'a', 5).update])).toThrow();
});
