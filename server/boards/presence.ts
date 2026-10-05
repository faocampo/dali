import type { CollaborationBroker, LiveConnection } from './reservations.js';
export type PresenceIdentity = { name: string; role: 'owner' | 'editor' | 'viewer' };
export type PresenceParticipant = PresenceIdentity & { accountId: string; idle: boolean; activity: number; cursor: { x: number; y: number } | null; selection: string[] };
type Activity = { at: number; sequence: number; cursor: PresenceParticipant['cursor']; selection: string[] };
/** Connection activity is ephemeral; identity and capability are always resolved by the server. */
export class PresenceRegistry {
  private activity = new Map<string, Activity>();
  private sequence = 0;
  constructor(private broker: CollaborationBroker, private identity: (boardId: string, accountId: string) => PresenceIdentity | undefined, private now: () => number) {}
  update(connection: LiveConnection, input: unknown) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !['cursor', 'selection'].includes(key))) throw new Error('Invalid presence');
    const { cursor = null, selection = [] } = input as { cursor?: unknown; selection?: unknown };
    if (cursor !== null && (typeof cursor !== 'object' || Array.isArray(cursor) || Object.keys(cursor).sort().join(',') !== 'x,y' ||
      !Object.values(cursor).every(value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 10_000_000))) throw new Error('Invalid cursor');
    if (!Array.isArray(selection) || selection.length > 128 || selection.some(id => typeof id !== 'string' || !id || id.length > 256) || new Set(selection).size !== selection.length) throw new Error('Invalid selection');
    const identity = this.identity(connection.boardId, connection.accountId); if (!identity) throw new Error('Access changed');
    this.broker.touch(connection);
    this.activity.set(connection.id, { at: this.now(), sequence: ++this.sequence,
      cursor: identity.role === 'viewer' ? null : cursor as PresenceParticipant['cursor'], selection: identity.role === 'viewer' ? [] : selection });
  }
  roster(boardId: string): PresenceParticipant[] {
    const connections = this.broker.list(); const active = new Set(connections.map(connection => connection.id));
    for (const id of this.activity.keys()) if (!active.has(id)) this.activity.delete(id);
    const people = new Map<string, PresenceParticipant>();
    for (const connection of connections.filter(connection => connection.boardId === boardId)) {
      const identity = this.identity(boardId, connection.accountId);
      if (!identity) { this.broker.disconnect(connection); this.activity.delete(connection.id); continue; }
      let activity = this.activity.get(connection.id);
      if (!activity) { activity = { at: this.now(), sequence: 0, cursor: null, selection: [] }; this.activity.set(connection.id, activity); }
      const previous = people.get(connection.accountId);
      if (previous && previous.activity > activity.sequence) continue;
      people.set(connection.accountId, { accountId: connection.accountId, name: identity.name.trim() || 'Participant', role: identity.role,
        idle: this.now() - activity.at >= 30_000, activity: activity.sequence,
        cursor: identity.role === 'viewer' ? null : activity.cursor, selection: identity.role === 'viewer' ? [] : activity.selection });
    }
    return [...people.values()].sort((a, b) => a.accountId.localeCompare(b.accountId));
  }
}
