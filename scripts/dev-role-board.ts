/** Synthetic local fixtures only; never imported by production entrypoints. */
import { randomUUID } from 'node:crypto';
import { seedDocuments, type BoardRow } from '../server/boards/routes.js';
import { openDatabase } from '../server/storage/database.js';
import { identities } from '../tests/oidc-provider.js';

export const ROLE_TEST_BOARD_TITLE = 'Shared role test';

/** Seed once, retaining later edits, grant changes and deletion across restarts. */
export function seedLocalRoleBoard(databasePath: string, issuer: string): void {
  if (process.env.NODE_ENV === 'production') throw new Error('Synthetic boards require a non-production environment.');
  const database = openDatabase(databasePath);
  try {
    database.transaction(() => {
      database.exec('CREATE TABLE IF NOT EXISTS local_dev_fixtures (name TEXT PRIMARY KEY, board_id TEXT NOT NULL)');
      database.prepare("UPDATE members SET system_role='viewer' WHERE issuer=? AND subject=?").run(issuer, identities.viewer.sub);
      if (database.prepare('SELECT 1 FROM local_dev_fixtures WHERE name=?').get('shared-role-board-v1')) return;
      const members = new Map<string, string>();
      for (const role of ['owner', 'editor', 'viewer'] as const) {
        const identity = identities[role];
        database.prepare('INSERT INTO members(id,issuer,subject,email,canonical_email,display_name) VALUES(?,?,?,?,?,?) ON CONFLICT(issuer,subject) DO NOTHING')
          .run(randomUUID(), issuer, identity.sub, identity.email, identity.email, identity.name);
        const member = database.prepare('SELECT id FROM members WHERE issuer=? AND subject=?').get(issuer, identity.sub) as { id: string };
        members.set(role, member.id);
      }
      const time = Date.now();
      database.prepare("UPDATE members SET system_role='viewer' WHERE issuer=? AND subject=?").run(issuer, identities.viewer.sub);
      const board: BoardRow = { id: randomUUID(), owner_id: members.get('owner')!, title: ROLE_TEST_BOARD_TITLE,
        root_doc_id: randomUUID(), content_doc_id: randomUUID(), created_at: time, updated_at: time, revision: 1, role: 'owner' };
      database.prepare('INSERT INTO boards(id,owner_id,title,root_doc_id,content_doc_id,created_at,updated_at,revision) VALUES(@id,@owner_id,@title,@root_doc_id,@content_doc_id,@created_at,@updated_at,@revision)').run(board);
      seedDocuments(database, board);
      for (const role of ['editor', 'viewer'] as const) {
        database.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?)').run(board.id, members.get(role)!, role);
      }
      database.prepare('INSERT INTO local_dev_fixtures(name,board_id) VALUES(?,?)').run('shared-role-board-v1', board.id);
    })();
  } finally { database.close(); }
}
