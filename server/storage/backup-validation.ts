import Database from 'better-sqlite3';
import { validateStoredDocument } from '../boards/documents.js';
import { IMAGE_LIMITS, validateStoredImage, validateImageBytes, validBlobKey } from '../boards/blobs.js';
import type { BoardRow } from '../boards/routes.js';
import { readRecoveryEpoch } from './recovery-state.js';

export const BACKUP_DATABASE_VERSION = 8;
const tables = ['schema_migrations', 'members', 'sessions', 'login_transactions', 'boards', 'board_grants', 'pending_grants', 'board_documents', 'operations', 'board_thumbnails', 'board_blobs', 'import_staging', 'import_staging_blobs', 'recovery_state'];
const bounded = (value: unknown, maximum = 4000): value is string => typeof value === 'string' && value.length > 0 && value.length <= maximum;
function json(value: string): any {
  if (!bounded(value, 4 * 1024 * 1024)) throw new Error('Invalid stored metadata');
  return JSON.parse(value);
}
/** Opens only an existing copy, never migrates it, and returns aggregate metadata. */
export function validateBackupDatabase(path: string): { databaseVersion: number; epoch: string; counts: Record<string, number> } {
  let database: Database.Database | undefined;
  try {
    database = new Database(path, { readonly: true, fileMustExist: true }); database.pragma('query_only=ON');
    if (JSON.stringify(database.pragma('integrity_check')) !== '[{"integrity_check":"ok"}]' || (database.pragma('foreign_key_check') as unknown[]).length) throw new Error('Invalid database');
    const schema = (database.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[]).map(row => row.name);
    if (JSON.stringify(schema) !== JSON.stringify([...tables].sort())) throw new Error('Unsupported schema');
    const migrations = (database.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as { version: number }[]).map(row => row.version);
    if (JSON.stringify(migrations) !== JSON.stringify(Array.from({ length: BACKUP_DATABASE_VERSION }, (_, index) => index + 1))) throw new Error('Unsupported database version');
    const epoch = readRecoveryEpoch(database);
    if ((database.prepare('SELECT count(*) AS n FROM recovery_state').get() as { n: number }).n !== 1) throw new Error('Invalid recovery state');
    const exists = (table: string, id: string) => !!database!.prepare(`SELECT 1 FROM ${table} WHERE id=?`).get(id);
    for (const member of database.prepare('SELECT * FROM members').iterate() as Iterable<{ id: string; issuer: string; subject: string; email: string; canonical_email: string; display_name: string; system_role: string; email_history: string }>) {
      if (![member.id, member.issuer, member.subject, member.email, member.canonical_email, member.display_name].every(value => bounded(value)) || !['member', 'viewer'].includes(member.system_role) || !Array.isArray(json(member.email_history))) throw new Error('Invalid member');
    }
    let documents = 0;
    for (const board of database.prepare('SELECT * FROM boards').iterate() as Iterable<BoardRow>) {
      if (![board.id, board.root_doc_id, board.content_doc_id, board.title].every(value => bounded(value)) || board.root_doc_id === board.content_doc_id || !exists('members', board.owner_id) || !Number.isSafeInteger(board.revision) || board.revision < 1) throw new Error('Invalid board');
      const rows = database.prepare('SELECT doc_id,update_bytes FROM board_documents WHERE board_id=?').all(board.id) as { doc_id: string; update_bytes: Buffer }[];
      if (rows.length !== 2 || !rows.some(row => row.doc_id === board.root_doc_id) || !rows.some(row => row.doc_id === board.content_doc_id)) throw new Error('Invalid document bindings');
      for (const row of rows) {
        const keys = validateStoredDocument(row.update_bytes, board, row.doc_id); documents++;
        for (const key of keys) if (!database.prepare('SELECT 1 FROM board_blobs WHERE board_id=? AND blob_key=?').get(board.id, key)) throw new Error('Missing image');
      }
      const imageBytes = (database.prepare('SELECT coalesce(sum(length(bytes)),0) AS n FROM board_blobs WHERE board_id=?').get(board.id) as { n: number }).n;
      if (imageBytes > IMAGE_LIMITS.boardBytes) throw new Error('Image quota exceeded');
    }
    for (const row of database.prepare('SELECT * FROM board_blobs').iterate() as Iterable<{ board_id: string; bytes: Buffer; mime: string; blob_key: string; hash: string }>) {
      if (!exists('boards', row.board_id)) throw new Error('Invalid image association'); validateStoredImage(row.bytes, row.mime, row.blob_key, row.hash);
    }
    for (const row of database.prepare('SELECT * FROM board_thumbnails').iterate() as Iterable<{ board_id: string; bytes: Buffer; mime: string }>) {
      if (!exists('boards', row.board_id) || row.mime !== 'image/png' || row.bytes.length > 512 * 1024) throw new Error('Invalid thumbnail'); validateImageBytes(row.bytes, row.mime);
    }
    for (const table of ['board_grants', 'pending_grants']) for (const row of database.prepare(`SELECT * FROM ${table}`).iterate() as Iterable<{ board_id: string; member_id?: string; issuer?: string; canonical_email?: string; role: string; revision: number }>) {
      if (!exists('boards', row.board_id) || !['editor', 'viewer'].includes(row.role) || !Number.isSafeInteger(row.revision) || row.revision < 1 || (table === 'board_grants' ? !exists('members', row.member_id!) : !bounded(row.issuer) || !bounded(row.canonical_email))) throw new Error('Invalid grant');
    }
    for (const row of database.prepare('SELECT * FROM operations').iterate() as Iterable<{ member_id: string; operation_id: string; board_id: string; kind: string; status: string; result: string }>) {
      if (!exists('members', row.member_id) || !bounded(row.operation_id, 128) || !bounded(row.board_id, 256) || !['staging', 'completed'].includes(row.status)) throw new Error('Invalid receipt');
      const value = json(row.result);
      if (!value || typeof value !== 'object') throw new Error('Invalid receipt result');
      if (row.kind === 'delete') { if (value.deleted !== true || value.boardId !== row.board_id) throw new Error('Invalid deletion receipt'); }
      else if (['create', 'rename', 'import', 'duplicate'].includes(row.kind)) { if (value.summary?.id !== row.board_id) throw new Error('Invalid board receipt'); }
      else { const kind = json(row.kind); if (!Array.isArray(kind) || kind[0] !== 'grant') throw new Error('Unknown receipt'); }
      // Receipts can outlive deleted boards; their member and recorded resource binding remain checked.
    }
    for (const stage of database.prepare('SELECT * FROM import_staging').iterate() as Iterable<{ member_id: string; operation_id: string; descriptor: string; manifest: string; root: Buffer | null; content: Buffer | null }>) {
      const descriptor = json(stage.descriptor); const manifest = json(stage.manifest);
      if (!exists('members', stage.member_id) || !database.prepare("SELECT 1 FROM operations WHERE member_id=? AND operation_id=? AND status='staging' AND board_id=?").get(stage.member_id, stage.operation_id, descriptor.summary?.id) || !Array.isArray(manifest) || manifest.length > 10000 || !manifest.every(key => typeof key === 'string' && validBlobKey(key)) || new Set(manifest).size !== manifest.length) throw new Error('Invalid staged references');
      const binding = { root_doc_id: descriptor.rootDocId, content_doc_id: descriptor.contentDocId } as BoardRow;
      if (!bounded(binding.root_doc_id, 256) || !bounded(binding.content_doc_id, 256) || binding.root_doc_id === binding.content_doc_id || (!!stage.root !== !!stage.content)) throw new Error('Invalid staged binding');
      if (stage.root && stage.content) { validateStoredDocument(stage.root, binding, binding.root_doc_id); for (const key of validateStoredDocument(stage.content, binding, binding.content_doc_id)) if (!manifest.includes(key)) throw new Error('Invalid staged image reference'); }
      let size = 0;
      for (const image of database.prepare('SELECT * FROM import_staging_blobs WHERE member_id=? AND operation_id=?').iterate(stage.member_id, stage.operation_id) as Iterable<{ bytes: Buffer; mime: string; blob_key: string }>) { if (!manifest.includes(image.blob_key)) throw new Error('Invalid staged image'); validateStoredImage(image.bytes, image.mime, image.blob_key); size += image.bytes.length; }
      if (size > IMAGE_LIMITS.boardBytes) throw new Error('Staged quota exceeded');
    }
    const count = (table: string) => (database!.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n;
    if (count('board_documents') !== documents) throw new Error('Unbound document');
    return { databaseVersion: BACKUP_DATABASE_VERSION, epoch, counts: { boards: count('boards'), documents, images: count('board_blobs'), grants: count('board_grants'), pendingGrants: count('pending_grants'), members: count('members'), receipts: count('operations'), stagedImports: count('import_staging'), stagedImages: count('import_staging_blobs'), thumbnails: count('board_thumbnails') } };
  } catch { throw new Error('Backup database validation failed'); }
  finally { database?.close(); }
}
