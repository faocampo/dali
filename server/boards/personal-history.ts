import type { AccountDatabase } from '../storage/database.js';
import type { LiveConnection } from './reservations.js';
export type PropertyPath = [objectId: string, property: string];
export type HistoryIntent = { token: string; baseline: number; paths: PropertyPath[] };
export const historyIntents = new WeakMap<LiveConnection, HistoryIntent>();
export function validHistoryPaths(value: unknown): value is PropertyPath[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 10000 && value.every(path => Array.isArray(path) && path.length === 2 && path.every(part => typeof part === 'string' && part.length > 0 && part.length <= 256));
}
/** Authoritative change records detect ABA and preserve other tabs, even of the same account. */
export function historyConflicts(db: AccountDatabase, connection: LiveConnection, baseline: number, paths: PropertyPath[]): boolean {
  const query = db.prepare(`SELECT 1 FROM document_property_changes WHERE board_id=? AND object_id=? AND revision>?
    AND (account_id<>? OR tab_id<>?) AND (property=? OR property='*' OR ?='*') LIMIT 1`);
  return paths.some(([id, property]) => !!query.get(connection.boardId, id, baseline, connection.accountId, connection.tabId, property, property));
}
export function recordPropertyChanges(db: AccountDatabase, connection: LiveConnection, revision: number, paths: PropertyPath[]) {
  const insert = db.prepare('INSERT INTO document_property_changes(board_id,object_id,property,revision,account_id,tab_id) VALUES(?,?,?,?,?,?)');
  for (const [id, property] of paths) insert.run(connection.boardId, id, property, revision, connection.accountId, connection.tabId);
}
export function coversHistoryPaths(intent: HistoryIntent, changed: PropertyPath[]): boolean {
  return changed.every(([id, property]) => intent.paths.some(([object, key]) => object === id && (key === '*' || key === property)));
}
