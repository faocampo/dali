import Database from 'better-sqlite3';
import { validateStoredDocument } from '../boards/documents.js';
import { IMAGE_LIMITS, validateStoredImage, validateImageBytes, validBlobKey } from '../boards/blobs.js';
import type { BoardRow } from '../boards/routes.js';
import { readRecoveryEpoch } from './recovery-state.js';

export const BACKUP_DATABASE_VERSION = 11;
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

    const migrations = (database.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as { version: number }[]).map(row => row.version);
    const databaseVersion = migrations.at(-1)!;
    if (![8, 9, 10, BACKUP_DATABASE_VERSION].includes(databaseVersion) || JSON.stringify(migrations) !== JSON.stringify(Array.from({ length: databaseVersion }, (_, index) => index + 1))) throw new Error('Unsupported database version');
    const expectedTables = [...tables, ...(databaseVersion >= 10 ? ['document_receipts'] : []), ...(databaseVersion >= 11 ? ['document_action_properties'] : [])];
    if (JSON.stringify(schema) !== JSON.stringify([...expectedTables].sort())) throw new Error('Unsupported schema');
    if (databaseVersion >= 10) for (const receipt of database.prepare('SELECT * FROM document_receipts').iterate() as Iterable<{ board_id: string; account_id: string; tab_id: string; operation_id: string; doc_id: string; digest: string; previous_revision: number; revision: number }>) {
      if (![receipt.board_id, receipt.account_id, receipt.tab_id, receipt.operation_id, receipt.doc_id].every(value => bounded(value, 256)) || !/^[a-f0-9]{64}$/.test(receipt.digest) || !Number.isSafeInteger(receipt.previous_revision) || receipt.previous_revision < 1 || !Number.isSafeInteger(receipt.revision) || receipt.revision < receipt.previous_revision || receipt.revision > receipt.previous_revision + 1) throw new Error('Invalid document receipt');
      const board = database.prepare('SELECT root_doc_id,content_doc_id,revision FROM boards WHERE id=?').get(receipt.board_id) as { root_doc_id: string; content_doc_id: string; revision: number } | undefined;
      if (!board || ![board.root_doc_id, board.content_doc_id].includes(receipt.doc_id) || receipt.revision > board.revision) throw new Error('Invalid receipt binding');
    }
    const epoch = readRecoveryEpoch(database);
    if (databaseVersion >= 11) for (const property of database.prepare('SELECT * FROM document_action_properties').iterate() as Iterable<{ board_id: string; account_id: string; tab_id: string; action_id: string; object_id: string; property: string; revision: number }>) {
      if (![property.board_id, property.account_id, property.tab_id, property.object_id, property.property].every(value => bounded(value, 256)) ||
        !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(property.action_id) || !Number.isSafeInteger(property.revision) || property.revision < 1) throw new Error('Invalid history provenance');
      const board = database.prepare('SELECT revision FROM boards WHERE id=?').get(property.board_id) as { revision: number } | undefined;
      if (!board || property.revision > board.revision || !database.prepare('SELECT 1 FROM members WHERE id=?').get(property.account_id)) throw new Error('Invalid history binding');
    }
    if ((database.prepare('SELECT count(*) AS n FROM recovery_state').get() as { n: number }).n !== 1) throw new Error('Invalid recovery state');
    const exists = (table: string, id: string) => !!database!.prepare(`SELECT 1 FROM ${table} WHERE id=?`).get(id);
    for (const member of database.prepare('SELECT * FROM members').iterate() as Iterable<{ id: string; issuer: string; subject: string; email: string; canonical_email: string; display_name: string; system_role: string; email_history: string }>) {
      if (![member.id, member.issuer, member.subject, member.email, member.canonical_email, member.display_name].every(value => bounded(value)) || !['member', 'viewer'].includes(member.system_role) || !Array.isArray(json(member.email_history))) throw new Error('Invalid member');
    }
    let documents = 0;
    for (const board of database.prepare('SELECT * FROM boards').iterate() as Iterable<BoardRow>) {
      if (databaseVersion >= 10 && ![0, 1].includes((board as BoardRow & { live_enabled: number }).live_enabled)) throw new Error('Invalid collaboration state');
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
      const knownBoard = (id: string) => exists('boards', id) || !!database!.prepare("SELECT 1 FROM operations WHERE kind='delete' AND status='completed' AND board_id=?").get(id);
      if (row.status === 'completed' && row.kind !== 'delete' && !knownBoard(row.kind === 'duplicate' ? value.summary?.id : row.board_id)) throw new Error('Missing receipt resource');
      if (row.kind === 'delete') { if (value.deleted !== true || value.boardId !== row.board_id) throw new Error('Invalid deletion receipt'); }
      else if (['create', 'rename', 'import'].includes(row.kind)) { if (value.summary?.id !== row.board_id) throw new Error('Invalid board receipt'); }
      else if (row.kind === 'duplicate') {
        // A duplicate receipt records its source board separately from the destination descriptor.
        if (!bounded(value.summary?.id, 256) || !bounded(value.rootDocId, 256) || !bounded(value.contentDocId, 256) || value.rootDocId === value.contentDocId) throw new Error('Invalid duplicate receipt');
      }
      else { const kind = json(row.kind); if (!Array.isArray(kind) || kind[0] !== 'grant') throw new Error('Unknown receipt'); }
      // Receipts can outlive deleted boards; their member and recorded resource binding remain checked.
    }
    for (const stage of database.prepare('SELECT * FROM import_staging').iterate() as Iterable<{ member_id: string; operation_id: string; source_id: string | null; descriptor: string; manifest: string; root: Buffer | null; content: Buffer | null }>) {
      const descriptor = json(stage.descriptor); const manifest = json(stage.manifest);
      const receipt = database.prepare("SELECT kind,board_id FROM operations WHERE member_id=? AND operation_id=? AND status='staging'").get(stage.member_id, stage.operation_id) as { kind: string; board_id: string } | undefined;
      if (!exists('members', stage.member_id) || !receipt || receipt.board_id !== (receipt.kind === 'duplicate' ? stage.source_id : descriptor.summary?.id) || descriptor.summary?.accountId !== stage.member_id || !Array.isArray(manifest) || manifest.length > 10000 || !manifest.every(key => typeof key === 'string' && validBlobKey(key)) || new Set(manifest).size !== manifest.length) throw new Error('Invalid staged references');
      const binding = { root_doc_id: descriptor.rootDocId, content_doc_id: descriptor.contentDocId } as BoardRow;
      if (!bounded(binding.root_doc_id, 256) || !bounded(binding.content_doc_id, 256) || binding.root_doc_id === binding.content_doc_id || (!!stage.root !== !!stage.content)) throw new Error('Invalid staged binding');
      if (stage.root && stage.content) { validateStoredDocument(stage.root, binding, binding.root_doc_id); for (const key of validateStoredDocument(stage.content, binding, binding.content_doc_id)) if (!manifest.includes(key)) throw new Error('Invalid staged image reference'); }
      let size = 0;
      for (const image of database.prepare('SELECT * FROM import_staging_blobs WHERE member_id=? AND operation_id=?').iterate(stage.member_id, stage.operation_id) as Iterable<{ bytes: Buffer; mime: string; blob_key: string }>) { if (!manifest.includes(image.blob_key)) throw new Error('Invalid staged image'); validateStoredImage(image.bytes, image.mime, image.blob_key); size += image.bytes.length; }
      if (size > IMAGE_LIMITS.boardBytes) throw new Error('Staged quota exceeded');
    }
    const count = (table: string) => (database!.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n;
    if (count('board_documents') !== documents) throw new Error('Unbound document');
    return { databaseVersion, epoch, counts: { boards: count('boards'), documents, images: count('board_blobs'), grants: count('board_grants'), pendingGrants: count('pending_grants'), members: count('members'), receipts: count('operations'), stagedImports: count('import_staging'), stagedImages: count('import_staging_blobs'), thumbnails: count('board_thumbnails'), ...(databaseVersion >= 10 ? { documentReceipts: count('document_receipts') } : {}), ...(databaseVersion >= 11 ? { historyProperties: count('document_action_properties') } : {}) } };
  } catch { throw new Error('Backup database validation failed'); }
  finally { database?.close(); }
}
