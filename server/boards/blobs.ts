import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import type { FastifyInstance } from 'fastify';
import * as Y from 'yjs';
import type { AuthConfig } from '../app.js';
import { requireMutation } from '../auth/session-store.js';
import { runMigrations, type AccountDatabase } from '../storage/database.js';
import { requireBoardCapability } from './routes.js';
import { documentBytes, referencedImageKeys, type BeforeCommit } from './documents.js';
import { currentRecoveryFingerprint } from './recovery-baseline.js';

/** Same input limits as canvas/image-input; checked before raster allocation. */
export const IMAGE_LIMITS = { bytes: 16 * 1024 * 1024, pixels: 16_000_000, dimension: 8192, boardBytes: 256 * 1024 * 1024 };
export const validBlobKey = (key: string) => /^[A-Za-z0-9_-]{43}=?$/.test(key);
export const imageHash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('base64').replace(/\+/g, '-').replace(/\//g, '_');
function dimensions(width: number, height: number) {
  if (!width || !height || width > IMAGE_LIMITS.dimension || height > IMAGE_LIMITS.dimension || width * height > IMAGE_LIMITS.pixels) throw new Error('Invalid dimensions');
}
function crc32(data: Buffer) {
  let crc = 0xffffffff;
  for (const byte of data) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
export function validateImageBytes(bytes: Buffer, mime: string) {
  if (!bytes.length || bytes.length > IMAGE_LIMITS.bytes) throw new Error('Invalid image length');
  if (mime === 'image/png') {
    if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error('Invalid PNG');
    let offset = 8; let width = 0; let height = 0; let bits = 0; let channels = 0; let interlace = 0; let ended = false;
    const compressed: Buffer[] = [];
    while (offset + 12 <= bytes.length) {
      const size = bytes.readUInt32BE(offset); if (size > bytes.length - offset - 12) throw new Error('Invalid chunk');
      const kind = bytes.toString('ascii', offset + 4, offset + 8); const data = bytes.subarray(offset + 8, offset + 8 + size);
      if (bytes.readUInt32BE(offset + size + 8) !== crc32(bytes.subarray(offset + 4, offset + size + 8))) throw new Error('Invalid checksum');
      if (offset === 8 && kind !== 'IHDR') throw new Error('Missing header');
      if (kind === 'IHDR') {
        if (offset !== 8 || size !== 13) throw new Error('Invalid header');
        width = data.readUInt32BE(0); height = data.readUInt32BE(4); dimensions(width, height);
        bits = data[8]!; channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[data[9]!] ?? 0; interlace = data[12]!;
        const allowed: Record<number, number[]> = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
        if (!channels || !allowed[data[9]!]?.includes(bits) || data[10] || data[11] || interlace > 1) throw new Error('Invalid encoding');
      }
      if (kind === 'IDAT') compressed.push(data);
      if (kind === 'acTL') throw new Error('Animated image unsupported');
      offset += size + 12;
      if (kind === 'IEND') { if (size || offset !== bytes.length) throw new Error('Invalid end'); ended = true; break; }
    }
    if (!ended || !compressed.length) throw new Error('Incomplete PNG');
    // Bound inflation independently from the compressed bytes, including all Adam7 passes.
    const raw = inflateSync(Buffer.concat(compressed), { maxOutputLength: height * (Math.ceil(width * channels * bits / 8) + 8) + 128 });
    const passes = interlace ? [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]] : [[0, 0, 1, 1]];
    let index = 0;
    for (const [x, y, dx, dy] of passes as [number, number, number, number][]) {
      const w = Math.max(0, Math.ceil((width - x) / dx)); const h = Math.max(0, Math.ceil((height - y) / dy));
      if (!w || !h) continue;
      const row = Math.ceil(w * channels * bits / 8);
      for (let i = 0; i < h; i++) { if (index >= raw.length || raw[index]! > 4) throw new Error('Invalid scanline'); index += row + 1; }
    }
    if (index !== raw.length) throw new Error('Invalid raster length');
    return;
  }
  if (mime !== 'image/jpeg' || bytes[0] !== 255 || bytes[1] !== 216) throw new Error('Unsupported image');
  let offset = 2; let frame = false; let scan = false;
  while (offset < bytes.length) {
    if (bytes[offset++] !== 255) throw new Error('Invalid JPEG marker');
    while (bytes[offset] === 255) offset++;
    const marker = bytes[offset++];
    if (marker === 217) { if (!frame || !scan || offset !== bytes.length) throw new Error('Incomplete JPEG'); return; }
    if (offset + 2 > bytes.length) throw new Error('Truncated JPEG');
    const size = bytes.readUInt16BE(offset); if (size < 2 || offset + size > bytes.length) throw new Error('Invalid JPEG segment');
    if (marker !== undefined && [192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)) {
      if (size < 8) throw new Error('Invalid JPEG frame'); dimensions(bytes.readUInt16BE(offset + 5), bytes.readUInt16BE(offset + 3)); frame = true;
    }
    offset += size;
    if (marker === 218) {
      if (!frame) throw new Error('Missing JPEG frame'); scan = true;
      while (offset < bytes.length) {
        if (bytes[offset] !== 255) { offset++; continue; }
        const next = bytes[offset + 1];
        if (next === 0 || (next !== undefined && next >= 208 && next <= 215)) { offset += 2; continue; }
        break;
      }
    }
  }
  throw new Error('Incomplete JPEG');
}
/** Shared persisted-image integrity check; identical key semantics to upload. */
export function validateStoredImage(bytes: Buffer, mime: string, key: string, hash = key) {
  if (!Buffer.isBuffer(bytes) || !validBlobKey(key) || !validBlobKey(hash)) throw new Error('Invalid image identity');
  validateImageBytes(bytes, mime);
  const actual = imageHash(bytes).replace(/=$/, '');
  if (actual !== key.replace(/=$/, '') || actual !== hash.replace(/=$/, '')) throw new Error('Invalid image hash');
}
export class BlobRepository {
  constructor(private database: AccountDatabase) {}
  get(boardId: string, key: string) { return this.database.prepare('SELECT bytes,mime,hash FROM board_blobs WHERE board_id=? AND blob_key=?').get(boardId, key) as { bytes: Buffer; mime: string; hash: string } | undefined; }
  list(boardId: string) { return (this.database.prepare('SELECT blob_key FROM board_blobs WHERE board_id=? ORDER BY blob_key').all(boardId) as { blob_key: string }[]).map(row => row.blob_key); }
  set(boardId: string, key: string, bytes: Buffer, mime: string) {
    const used = (this.database.prepare('SELECT coalesce(sum(length(bytes)),0) AS n FROM board_blobs WHERE board_id=? AND blob_key<>?').get(boardId, key) as { n: number }).n;
    if (used + bytes.length > IMAGE_LIMITS.boardBytes) return false;
    this.database.prepare('INSERT INTO board_blobs(board_id,blob_key,mime,bytes,hash) VALUES(?,?,?,?,?) ON CONFLICT(board_id,blob_key) DO NOTHING').run(boardId, key, mime, bytes, imageHash(bytes)); return true;
  }
  delete(boardId: string, key: string) { this.database.prepare('DELETE FROM board_blobs WHERE board_id=? AND blob_key=?').run(boardId, key); }
}
export function registerBlobRoutes(app: FastifyInstance, config: AuthConfig, database: AccountDatabase, now: () => number, beforeCommit?: BeforeCommit) {
  runMigrations(database, [{ version: 4, sql: `CREATE TABLE board_blobs(board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE, blob_key TEXT NOT NULL, mime TEXT NOT NULL CHECK(mime IN ('image/png','image/jpeg')), bytes BLOB NOT NULL, hash TEXT NOT NULL, PRIMARY KEY(board_id,blob_key));` }]);
  app.addContentTypeParser(['image/png', 'image/jpeg'], { parseAs: 'buffer' }, (_request, body, done) => done(null, body));
  const repository = new BlobRepository(database);
  app.get<{ Params: { boardId: string } }>('/api/boards/:boardId/blobs', async (request, reply) => {
    const board = requireBoardCapability(database, request, reply, request.params.boardId, 'image', now); if (board) return repository.list(board.id);
  });
  for (const method of ['GET', 'PUT', 'DELETE'] as const) app.route<{ Params: { boardId: string; key: string }; Body: Buffer }>({ method, url: '/api/boards/:boardId/blobs/:key', bodyLimit: IMAGE_LIMITS.bytes,
    onRequest: async (request, reply) => { if (method !== 'GET') requireMutation(request, reply, config, method === 'PUT' ? ['image/png', 'image/jpeg'] : ['application/json', 'image/png', 'image/jpeg']); },
    errorHandler: (error, _request, reply) => { const overflow = error instanceof Error && 'code' in error && error.code === 'FST_ERR_CTP_BODY_TOO_LARGE'; return reply.code(overflow ? 413 : 500).send({ code: overflow ? 'PAYLOAD_REJECTED' : 'REQUEST_FAILED' }); },
    handler: async (request, reply) => {
      const { boardId, key } = request.params;
      const board = requireBoardCapability(database, request, reply, boardId, method === 'GET' ? 'image' : 'write', now); if (!board) return;
      if (!validBlobKey(key)) return reply.code(404).send({ code: 'BOARD_UNAVAILABLE' });
      if (method === 'GET') {
        const blob = repository.get(boardId, key); if (!blob) return reply.code(404).send({ code: 'IMAGE_UNAVAILABLE' });
        return reply.header('X-Content-Type-Options', 'nosniff').type(blob.mime).send(blob.bytes);
      }
      const mime = (request.headers['content-type'] ?? '').split(';')[0]!.trim().toLowerCase();
      if (method === 'PUT') {
        try { if (!Buffer.isBuffer(request.body)) throw new Error(); validateImageBytes(request.body, mime); if (imageHash(request.body).replace(/=$/, '') !== key.replace(/=$/, '')) throw new Error(); }
        catch { return reply.code(400).send({ code: 'INVALID_IMAGE' }); }
      }
      await beforeCommit?.();
      return database.transaction(() => {
        const latest = requireBoardCapability(database, request, reply, boardId, 'write', now); if (!latest) return;
        const expectedBaseline = request.headers['x-dali-recovery-baseline'];
        if (expectedBaseline !== undefined) {
          if (typeof expectedBaseline !== 'string' || !/^[a-f0-9]{64}$/.test(expectedBaseline)) return reply.code(400).send({ code: 'INVALID_RECOVERY_BASELINE' });
          if (currentRecoveryFingerprint(database, latest) !== expectedBaseline) return reply.code(409).send({ code: 'RECOVERY_DIVERGED' });
        }
        if (method === 'DELETE') {
          const doc = new Y.Doc();
          try { Y.applyUpdate(doc, documentBytes(database, latest, latest.content_doc_id)!); if (referencedImageKeys(doc).has(key)) return reply.code(409).send({ code: 'IMAGE_REFERENCED' }); }
          finally { doc.destroy(); }
          repository.delete(boardId, key);
        } else if (!repository.set(boardId, key, request.body, mime)) return reply.code(413).send({ code: 'BOARD_IMAGE_QUOTA' });
        return { acknowledged: true, key };
      })();
    },
  });
}
