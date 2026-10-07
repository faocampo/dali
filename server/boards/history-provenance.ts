import type { AccountDatabase } from '../storage/database.js';
import type { NativeProperty } from './change-footprint.js';
import type { LiveConnection } from './reservations.js';

export type AcknowledgedProperty = NativeProperty & { revision: number };

/** Metadata only: undo contents and stack ordering remain private to the tab. */
export function recordNativeAction(database: AccountDatabase, connection: LiveConnection, actionId: string, properties: NativeProperty[], revision: number) {
  const insert = database.prepare(`INSERT INTO document_action_properties(board_id,account_id,tab_id,action_id,object_id,property,revision)
    VALUES(?,?,?,?,?,?,?) ON CONFLICT(board_id,account_id,tab_id,action_id,object_id,property) DO UPDATE SET revision=excluded.revision`);
  for (const { objectId, property } of properties) insert.run(connection.boardId, connection.accountId, connection.tabId, actionId, objectId, property, revision);
}

export function acknowledgedAction(database: AccountDatabase, connection: LiveConnection, actionId: string): AcknowledgedProperty[] {
  return database.prepare(`SELECT object_id AS objectId,property,revision FROM document_action_properties
    WHERE board_id=? AND account_id=? AND tab_id=? AND action_id=? ORDER BY object_id,property`)
    .all(connection.boardId, connection.accountId, connection.tabId, actionId) as AcknowledgedProperty[];
}

/** Recovery may commit different properties under fresh leases. Keep each
 * property's actual last revision; never promote old paths to a newer commit. */
export function acknowledgedActions(database: AccountDatabase, connection: LiveConnection, actionIds: readonly string[]): AcknowledgedProperty[] {
  const merged = new Map<string, AcknowledgedProperty>();
  for (const [index, actionId] of actionIds.entries()) {
    const properties = acknowledgedAction(database, connection, actionId);
    // The original action may have been entirely offline. A claimed committed
    // recovery fragment must belong to this exact account, board and tab.
    if (index > 0 && !properties.length) return [];
    for (const property of properties) {
      const key = JSON.stringify([property.objectId, property.property]);
      if ((merged.get(key)?.revision ?? -1) < property.revision) merged.set(key, property);
    }
  }
  return [...merged.values()];
}

export function historyEligible(database: AccountDatabase, connection: LiveConnection, properties: AcknowledgedProperty[]): boolean {
  if (!properties.length) return false;
  const later = database.prepare(`SELECT 1 FROM document_action_properties WHERE board_id=? AND object_id=?
    AND (property=? OR property='*' OR ?='*') AND revision>? AND (account_id<>? OR tab_id<>?) LIMIT 1`);
  return properties.every(({ objectId, property, revision }) => !later.get(connection.boardId, objectId, property, property, revision, connection.accountId, connection.tabId));
}

/** Validate actual inverse paths again in the same transaction as persistence. */
export function admitsHistoryInverse(database: AccountDatabase, connection: LiveConnection, actionIds: readonly string[], changes: NativeProperty[]): boolean {
  const properties = acknowledgedActions(database, connection, actionIds);
  return historyEligible(database, connection, properties) && changes.every(change => properties.some(original =>
    original.objectId === change.objectId && (original.property === '*' || original.property === change.property)));
}
