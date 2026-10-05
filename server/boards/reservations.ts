import { randomUUID } from 'node:crypto';

export type LiveConnection = Readonly<{ id: string; boardId: string; accountId: string; tabId: string }>;
type ConnectionState = { connection: LiveConnection; seen: number };
type Reservation = { connectionId: string; objects: Set<string> };
const CONNECTION_TIMEOUT = 30_000;
const MAX_OBJECTS = 10_000;
/** Ephemeral fencing state. Durable document receipts remain in SQLite. */
export class CollaborationBroker {
  private connections = new Map<string, ConnectionState>();
  private reservations = new Map<string, Reservation>();
  private objects = new Map<string, Map<string, string>>();
  constructor(private now: () => number) {}
  connect(boardId: string, accountId: string, tabId: string): LiveConnection {
    this.sweep();
    if (![boardId, accountId, tabId].every(x => typeof x === 'string' && x.length > 0 && x.length <= 256)) throw new Error('Invalid connection');
    // A resumed tab obtains a fresh fence, never revives its former leases.
    for (const state of this.connections.values()) if (state.connection.boardId === boardId && state.connection.accountId === accountId && state.connection.tabId === tabId) this.disconnect(state.connection);
    const sameAccount = [...this.connections.values()].filter(state => state.connection.accountId === accountId).sort((a, b) => a.seen - b.seen);
    // Bound a single account's abandoned-tab footprint without a board user cap.
    while (sameAccount.length >= 64) this.disconnect(sameAccount.shift()!.connection);
    const connection = Object.freeze({ id: randomUUID(), boardId, accountId, tabId });
    this.connections.set(connection.id, { connection, seen: this.now() });
    return connection;
  }
  list(): LiveConnection[] { this.sweep(); return [...this.connections.values()].map(state => state.connection); }
  touch(connection: LiveConnection) {
    this.sweep();
    const state = this.connections.get(connection.id);
    if (state?.connection !== connection) throw new Error('Connection expired');
    state.seen = this.now();
  }
  find(id: string, boardId: string, accountId: string): LiveConnection | undefined {
    this.sweep();
    const connection = this.connections.get(id)?.connection;
    return connection?.boardId === boardId && connection.accountId === accountId ? connection : undefined;
  }
  acquire(connection: LiveConnection, objectIds: string[]): string | null {
    this.touch(connection);
    if (!Array.isArray(objectIds) || !objectIds.length || objectIds.length > MAX_OBJECTS || new Set(objectIds).size !== objectIds.length || objectIds.some(id => typeof id !== 'string' || !id.length || id.length > 256)) throw new Error('Invalid objects');
    const owned = [...this.reservations.values()].filter(item => item.connectionId === connection.id);
    if (owned.length >= 64 || owned.reduce((total, item) => total + item.objects.size, 0) + objectIds.length > MAX_OBJECTS) throw new Error('Reservation capacity exceeded');
    const held = this.objects.get(connection.boardId) ?? new Map<string, string>();
    if (objectIds.some(id => held.has(id))) return null;
    const token = randomUUID();
    this.reservations.set(token, { connectionId: connection.id, objects: new Set(objectIds) });
    for (const id of objectIds) held.set(id, token);
    this.objects.set(connection.boardId, held);
    return token;
  }
  blockingAccount(connection: LiveConnection, objectIds: string[]): string | undefined {
    this.sweep();
    const held = this.objects.get(connection.boardId);
    for (const id of objectIds) {
      const token = held?.get(id); const lease = token && this.reservations.get(token);
      const owner = lease && this.connections.get(lease.connectionId);
      if (owner) return owner.connection.accountId;
    }
    return undefined;
  }
  owns(connection: LiveConnection, token: string, objectIds: string[]): boolean {
    this.sweep();
    if (this.connections.get(connection.id)?.connection !== connection) return false;
    const reservation = this.reservations.get(token);
    return reservation?.connectionId === connection.id && objectIds.length > 0 && objectIds.every(id => reservation.objects.has(id));
  }
  /** Add server-derived new IDs; callers must undo this if the durable commit fails. */
  extend(connection: LiveConnection, token: string, ids: string[]): boolean {
    this.sweep();
    const lease = this.reservations.get(token); const held = this.objects.get(connection.boardId);
    if (this.connections.get(connection.id)?.connection !== connection || lease?.connectionId !== connection.id || !held ||
        !ids.length || new Set(ids).size !== ids.length || ids.some(id => !id || id.length > 256 || held.has(id))) return false;
    const count = [...this.reservations.values()].filter(item => item.connectionId === connection.id).reduce((total, item) => total + item.objects.size, 0);
    if (count + ids.length > MAX_OBJECTS) return false;
    for (const id of ids) { lease.objects.add(id); held.set(id, token); }
    return true;
  }
  releaseObjects(connection: LiveConnection, token: string, ids: string[]) {
    const lease = this.reservations.get(token); if (lease?.connectionId !== connection.id) return;
    const held = this.objects.get(connection.boardId);
    for (const id of ids) { lease.objects.delete(id); if (held?.get(id) === token) held.delete(id); }
  }
  release(connection: LiveConnection, token: string) {
    const reservation = this.reservations.get(token);
    if (reservation?.connectionId !== connection.id) return;
    const held = this.objects.get(connection.boardId);
    for (const id of reservation.objects) if (held?.get(id) === token) held.delete(id);
    if (!held?.size) this.objects.delete(connection.boardId);
    this.reservations.delete(token);
  }
  releaseAll(connection: LiveConnection) {
    for (const [token, reservation] of this.reservations) if (reservation.connectionId === connection.id) this.release(connection, token);
  }
  disconnect(connection: LiveConnection) {
    if (this.connections.get(connection.id)?.connection !== connection) return;
    this.releaseAll(connection);
    this.connections.delete(connection.id);
  }
  private sweep() {
    for (const state of this.connections.values()) if (this.now() - state.seen >= CONNECTION_TIMEOUT) this.disconnect(state.connection);
  }
}

