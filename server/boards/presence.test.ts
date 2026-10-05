import { describe, expect, it } from 'vitest';
import { CollaborationBroker } from './reservations.js';
import { PresenceRegistry } from './presence.js';

describe('authenticated participant projection', () => {
  const setup = () => {
    let clock = 1000;
    const broker = new CollaborationBroker(() => clock);
    const identities = new Map<string, { name: string; role: 'owner' | 'editor' | 'viewer' }>([
      ['owner', { name: 'Synthetic Owner', role: 'owner' }], ['editor', { name: 'Synthetic Editor', role: 'editor' }], ['viewer', { name: 'Synthetic Viewer', role: 'viewer' }],
    ]);
    const presence = new PresenceRegistry(broker, (_board: string, account: string) => identities.get(account), () => clock);
    return { broker, presence, identities, advance: (ms: number) => { clock += ms; } };
  };
  it('@05-03-01 derives names and roles and strips viewer decoration', () => {
    const { broker, presence } = setup();
    const editor = broker.connect('board', 'editor', 'one'); const viewer = broker.connect('board', 'viewer', 'two');
    presence.update(editor, { cursor: { x: 1, y: 2 }, selection: ['shape'] });
    presence.update(viewer, { cursor: { x: 3, y: 4 }, selection: ['shape'] });
    expect(presence.roster('board')).toEqual(expect.arrayContaining([
      expect.objectContaining({ accountId: 'editor', name: 'Synthetic Editor', role: 'editor', cursor: { x: 1, y: 2 }, selection: ['shape'], idle: false }),
      expect.objectContaining({ accountId: 'viewer', name: 'Synthetic Viewer', role: 'viewer', cursor: null, selection: [] }),
    ]));
    expect(presence.roster('foreign')).toEqual([]);
    expect(() => presence.update(editor, { name: 'Forged', role: 'owner' })).toThrow();
  });
  it('@05-03-02 deduplicates tabs using server activity ordering and immediately removes disconnected sessions', () => {
    const { broker, presence } = setup();
    const first = broker.connect('board', 'editor', 'one'), second = broker.connect('board', 'editor', 'two');
    presence.update(first, { cursor: { x: 1, y: 1 }, selection: [] });
    presence.update(second, { cursor: { x: 2, y: 2 }, selection: [] });
    expect(presence.roster('board')).toHaveLength(1);
    expect(presence.roster('board')[0]!.cursor).toEqual({ x: 2, y: 2 });
    presence.update(first, { cursor: { x: 3, y: 3 }, selection: [] });
    expect(presence.roster('board')[0]!.cursor).toEqual({ x: 3, y: 3 });
    broker.disconnect(first);
    expect(presence.roster('board')[0]!.cursor).toEqual({ x: 2, y: 2 });
    broker.disconnect(second); expect(presence.roster('board')).toEqual([]);
  });
  it('@05-03-02 heartbeat preserves liveness without resetting idle and revoked access is removed', () => {
    const { broker, presence, identities, advance } = setup();
    const editor = broker.connect('board', 'editor', 'one');
    presence.update(editor, { cursor: { x: 1, y: 2 }, selection: [] });
    for (let i = 0; i < 4; i++) { advance(10000); broker.touch(editor); }
    expect(presence.roster('board')[0]!.idle).toBe(true);
    identities.set('editor', { name: 'Synthetic Editor', role: 'viewer' });
    expect(presence.roster('board')[0]).toMatchObject({ role: 'viewer', cursor: null, selection: [] });
    identities.delete('editor'); expect(presence.roster('board')).toEqual([]);
  });
  it('@05-03-02 rejects non-finite coordinates, oversized selections and client activity timestamps', () => {
    const { broker, presence } = setup(); const editor = broker.connect('board', 'editor', 'one');
    for (const data of [{ cursor: { x: Infinity, y: 0 } }, { cursor: { x: 1e20, y: 0 } }, { selection: Array(129).fill('shape') }, { activeAt: 999999999 }]) expect(() => presence.update(editor, data)).toThrow();
  });
});
