import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { historyConflicts, recordPropertyChanges } from './personal-history.js';

describe('authoritative personal history provenance', () => {
  const setup = () => {
    const db = new Database(':memory:');
    db.exec('CREATE TABLE document_property_changes(board_id TEXT, object_id TEXT, property TEXT, revision INTEGER, account_id TEXT, tab_id TEXT)');
    const owner = { id: 'a', boardId: 'board', accountId: 'owner', tabId: 'one' };
    const other = { id: 'b', boardId: 'board', accountId: 'editor', tabId: 'two' };
    return { db, owner, other };
  };
  it('@05-04-01 allows independent properties and detects conflicting values even after ABA restoration', () => {
    const {db,owner,other}=setup();
    recordPropertyChanges(db, other, 3, [['shape','fillColor']]);
    expect(historyConflicts(db,owner,2,[['shape','xywh']])).toBe(false);
    recordPropertyChanges(db, other, 4, [['shape','xywh']]);
    recordPropertyChanges(db, other, 5, [['shape','xywh']]);
    expect(historyConflicts(db,owner,2,[['shape','xywh']])).toBe(true);
    expect(historyConflicts(db,owner,5,[['shape','xywh']])).toBe(false); db.close();
  });
  it('@05-04-01 treats structural steps atomically and another tab as independent authorship', () => {
    const {db,owner,other}=setup();
    recordPropertyChanges(db,other,3,[['child','text']]);
    expect(historyConflicts(db,owner,2,[['parent','*'],['child','*']])).toBe(true);
    recordPropertyChanges(db,{...owner,tabId:'other-tab'},4,[['shape','text']]);
    expect(historyConflicts(db,owner,2,[['shape','text']])).toBe(true);
    recordPropertyChanges(db,owner,5,[['own','text']]);
    expect(historyConflicts(db,owner,2,[['own','text']])).toBe(false); db.close();
  });
  it('@05-04-01 lifecycle changes conflict with every property and remain board-scoped', () => {
    const {db,owner,other}=setup();
    recordPropertyChanges(db,{...other,boardId:'different'},8,[['shape','*']]);
    expect(historyConflicts(db,owner,2,[['shape','text']])).toBe(false);
    recordPropertyChanges(db,other,9,[['shape','*']]);
    expect(historyConflicts(db,owner,2,[['shape','text']])).toBe(true); db.close();
  });
});
