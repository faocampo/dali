import { afterEach, describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { acknowledgedUpdateCovered } from './acknowledged-update';

const documents: Y.Doc[] = [];
const document = () => { const doc = new Y.Doc(); documents.push(doc); return doc; };
afterEach(() => { documents.splice(0).forEach(doc => doc.destroy()); });

describe('acknowledged document update coverage', () => {
  it('covers an acknowledged submission and its subset without changing confirmed bytes', () => {
    const source = document(); const confirmed = document();
    source.getText('text').insert(0, 'First');
    const first = Y.encodeStateAsUpdate(source);
    source.getText('text').insert(5, ' second');
    const complete = Y.encodeStateAsUpdate(source);
    Y.applyUpdate(confirmed, complete); const before = Y.encodeStateAsUpdate(confirmed);
    expect(acknowledgedUpdateCovered(confirmed, first)).toBe(true);
    expect(acknowledgedUpdateCovered(confirmed, complete)).toBe(true);
    expect(Y.encodeStateAsUpdate(confirmed)).toEqual(before);
  });

  it('does not let an older receipt cover a newer edit or an independent client operation', () => {
    const source = document(); const confirmed = document(); const independent = document();
    source.getText('text').insert(0, 'First'); Y.applyUpdate(confirmed, Y.encodeStateAsUpdate(source));
    source.getText('text').insert(5, ' newer');
    independent.getText('text').insert(0, 'Independent');
    expect(acknowledgedUpdateCovered(confirmed, Y.encodeStateAsUpdate(source))).toBe(false);
    expect(acknowledgedUpdateCovered(confirmed, Y.encodeStateAsUpdate(independent))).toBe(false);
  });

  it('requires acknowledgment of deletion as well as insertion clocks', () => {
    const source = document(); const confirmed = document();
    source.getText('text').insert(0, 'Retained'); Y.applyUpdate(confirmed, Y.encodeStateAsUpdate(source));
    const vector = Y.encodeStateVector(source); source.getText('text').delete(0, 3);
    const deletion = Y.encodeStateAsUpdate(source, vector);
    expect(acknowledgedUpdateCovered(confirmed, deletion)).toBe(false);
    Y.applyUpdate(confirmed, deletion);
    expect(acknowledgedUpdateCovered(confirmed, deletion)).toBe(true);
  });

  it('refuses a confirmed document with unresolved out-of-order structures', () => {
    const source = document(); const confirmed = document();
    source.getText('text').insert(0, 'First'); const vector = Y.encodeStateVector(source);
    source.getText('text').insert(5, ' later'); Y.applyUpdate(confirmed, Y.encodeStateAsUpdate(source, vector));
    expect(confirmed.store.pendingStructs).not.toBeNull();
    expect(acknowledgedUpdateCovered(confirmed, new Uint8Array([0, 0]))).toBe(false);
  });

  it('refuses a confirmed document with unresolved deletes', () => {
    const source = document(); const confirmed = document();
    source.getText('text').insert(0, 'First'); const vector = Y.encodeStateVector(source);
    source.getText('text').delete(0, 1); Y.applyUpdate(confirmed, Y.encodeStateAsUpdate(source, vector));
    expect(confirmed.store.pendingDs).not.toBeNull();
    expect(acknowledgedUpdateCovered(confirmed, new Uint8Array([0, 0]))).toBe(false);
  });

  it('does not establish acknowledgment from absent confirmation or malformed bytes', () => {
    expect(acknowledgedUpdateCovered(undefined, new Uint8Array([0, 0]))).toBe(false);
    expect(acknowledgedUpdateCovered(document(), new Uint8Array([255]))).toBe(false);
  });
});
