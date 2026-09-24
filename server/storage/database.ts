import Database from 'better-sqlite3';
export type AccountDatabase = Database.Database;
export type Migration = { version: number; sql: string };
const migrations: Migration[] = [{ version: 1, sql: `
CREATE TABLE members (id TEXT PRIMARY KEY, issuer TEXT NOT NULL, subject TEXT NOT NULL,
 email TEXT NOT NULL, canonical_email TEXT NOT NULL, display_name TEXT NOT NULL, UNIQUE(issuer,subject));
CREATE TABLE sessions (id TEXT PRIMARY KEY, member_id TEXT REFERENCES members(id), expires_at INTEGER NOT NULL, data TEXT NOT NULL);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE login_transactions (state TEXT PRIMARY KEY, browser_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
 nonce TEXT NOT NULL, verifier TEXT NOT NULL, return_to TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE INDEX login_browser ON login_transactions(browser_id);
` }, { version: 7, sql: `ALTER TABLE members ADD COLUMN system_role TEXT NOT NULL DEFAULT 'member' CHECK(system_role IN ('member','viewer'));` }];
/** Additive migrations and their ledger commit together. */
export function runMigrations(database: AccountDatabase, additional: Migration[] = []) {
  database.pragma('foreign_keys = ON');
  database.transaction(() => {
    database.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY)');
    for (const migration of [...migrations, ...additional].sort((a, b) => a.version - b.version)) {
      if (!Number.isSafeInteger(migration.version) || migration.version < 1) throw new Error('Invalid migration');
      if (database.prepare('SELECT version FROM schema_migrations WHERE version=?').get(migration.version)) continue;
      database.exec(migration.sql);
      database.prepare('INSERT INTO schema_migrations(version) VALUES (?)').run(migration.version);
    }
  })();
}
export function openDatabase(path: string): AccountDatabase {
  const database = new Database(path);
  try { runMigrations(database); return database; }
  catch (error) { database.close(); throw error; }
}
