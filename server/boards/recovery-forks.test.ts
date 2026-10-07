import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateBackupDatabase } from '../storage/backup-validation.js';
import { readRecoveryEpoch } from '../storage/recovery-state.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomBytes, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { openDatabase, type AccountDatabase } from '../storage/database.js';
import { createOidcProvider, IDENTITY_COOKIE } from '../../tests/oidc-provider.js';
import * as Y from 'yjs';
import { syntheticCanaries } from '../../tests/access-fixtures.js';
import { imageHash } from './blobs.js';

describe('@05-06 recovery fork transactions', () => {
  let provider: Awaited<ReturnType<typeof createOidcProvider>>;
  let app: FastifyInstance; let database: AccountDatabase;
  let barrier: () => Promise<void> = async () => {};
  const origin = 'http://127.0.0.1:5499';
  const actors: Record<string, { cookie: string; accountId: string }> = {};
  const cookieOf = (response: { headers: Record<string, unknown> }) => {
    const values = response.headers['set-cookie'];
    return (Array.isArray(values) ? values.at(-1) : values)?.split(';')[0] as string;
  };
  beforeEach(async () => {
    const registration = { clientId: 'synthetic-library', clientSecret: randomBytes(32).toString('hex'), redirectUri: origin + '/auth/callback' };
    provider = await createOidcProvider({ clients: [registration] }); database = openDatabase(':memory:');
    barrier = async () => {};
    app = await buildApp({ storagePolicy: { kind: 'fixture' }, database, beforeCommit: () => barrier(), config: { DALI_ORIGIN: origin, DALI_DATABASE_PATH: ':memory:',
      DALI_SESSION_SECRET: randomBytes(32).toString('hex'), DALI_SESSION_TTL_MS: '86400000',
      DALI_OIDC_ISSUER: provider.issuer, DALI_OIDC_CLIENT_ID: registration.clientId, DALI_OIDC_CLIENT_SECRET: registration.clientSecret,
      DALI_OIDC_CALLBACK_URL: registration.redirectUri, DALI_INTERNAL_CLAIM: 'membership',
      DALI_INTERNAL_VALUES_JSON: '["internal"]', DALI_INTERNAL_EMAIL_DOMAINS_JSON: '["example.org"]' } });
    for (const identity of ['owner', 'editor', 'viewer', 'nonMember']) {
      const start = await app.inject('/auth/start');
      const authorize = await fetch(start.headers.location!, { redirect: 'manual', headers: { cookie: `${IDENTITY_COOKIE}=${identity}` } });
      const callback = new URL(authorize.headers.get('location')!);
      const response = await app.inject({ url: callback.pathname + callback.search, headers: { cookie: cookieOf(start) } });
      const cookie = cookieOf(response); const session = await app.inject({ url: '/api/session', headers: { cookie } });
      expect(session.statusCode).toBe(200); actors[identity] = { cookie, accountId: session.json().accountId };
    }
  });
  afterEach(async () => { await app?.close(); database?.close(); await provider?.close(); });
  const headers = (identity = 'owner') => ({ "x-dali-recovery-epoch": readRecoveryEpoch(database), cookie: actors[identity]!.cookie, 'x-dali-account': actors[identity]!.accountId, 'x-dali-request': '1', origin });
  const create = async (identity = 'owner', title = 'Synthetic board') => {
    const response = await app.inject({ method: 'POST', url: '/api/boards', headers: headers(identity), payload: { title, operationId: randomUUID() } });
    expect(response.statusCode).toBe(201); return response.json();
  };

  async function validateBackup() { const directory = await mkdtemp(join(tmpdir(), 'dali-fork-backup-')); try { const path = join(directory, 'synthetic.sqlite'); await database.backup(path); return validateBackupDatabase(path); } finally { await rm(directory, { recursive: true, force: true }); } }
  const image = syntheticCanaries().imageBytes; const key = imageHash(image);
  const grant = (boardId: string, actor = 'editor') => database.prepare("INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,'editor')").run(boardId, actors[actor]!.accountId);
  const sourceState = (id: string) => ['boards', 'board_documents', 'board_blobs', 'board_grants', 'pending_grants'].map(table => database.prepare('SELECT * FROM ' + table + (table === 'boards' ? ' WHERE id=?' : ' WHERE board_id=?')).all(id));
  const reserve = (boardId: string, body: Record<string, unknown>, actor = 'editor') => app.inject({ method: 'POST', url: '/api/boards/' + boardId + '/recovery-forks', headers: headers(actor), payload: body });
  const request = () => ({ operationId: randomUUID(), title: 'Synthetic local recovery', snapshotDigest: 'a'.repeat(64), manifest: [key] });
  const document = (destination: { rootDocId: string; contentDocId: string }) => {
    const root = new Y.Doc(); const content = new Y.Doc();
    root.getMap('spaces').set(destination.contentDocId, new Y.Doc({ guid: destination.contentDocId }));
    root.getMap('meta').set('pages', Y.Array.from([{ id: destination.contentDocId, title: 'Synthetic local recovery', createDate: Date.now(), tags: [] }]));
    for (const flavour of ['affine:page', 'affine:surface', 'affine:image']) {
      const id = randomUUID(); const block = new Y.Map(); block.set('sys:id', id); block.set('sys:flavour', flavour);
      if (flavour === 'affine:image') block.set('prop:sourceId', key);
      content.getMap('blocks').set(id, block);
    }
    const payload = { root: Buffer.from(Y.encodeStateAsUpdate(root)).toString('base64'), content: Buffer.from(Y.encodeStateAsUpdate(content)).toString('base64'), manifest: [key] };
    root.destroy(); content.destroy(); return payload;
  };
  const upload = (operationId: string, payload: ReturnType<typeof document>, actor = 'editor') => app.inject({ method: 'PUT', url: '/api/imports/' + operationId + '/document', headers: headers(actor), payload });
  const uploadImage = (operationId: string, actor = 'editor') => app.inject({ method: 'PUT', url: '/api/imports/' + operationId + '/blobs/' + key, headers: { ...headers(actor), 'content-type': 'image/png' }, payload: image });
  const commit = (operationId: string, actor = 'editor') => app.inject({ method: 'POST', url: '/api/imports/' + operationId + '/commit', headers: headers(actor), payload: {} });

  it.each(['editor', 'legacy-owner'] as const)('publishes immutable local image copy for %s without inherited grants or source mutations', async mode => {
    const board = await create(); grant(board.summary.id);
    if (mode === 'legacy-owner') {
      database.prepare('UPDATE boards SET owner_id=? WHERE id=?').run(actors.editor!.accountId, board.summary.id);
      database.prepare("UPDATE members SET system_role='viewer' WHERE id=?").run(actors.editor!.accountId);
    }
    const body = request(); const initial = sourceState(board.summary.id);
    const staged = await reserve(board.summary.id, body); expect(staged.statusCode).toBe(200); const d = staged.json().result;
    expect((await reserve(board.summary.id, body)).json()).toEqual(staged.json());
    expect(sourceState(board.summary.id)).toEqual(initial); expect((await validateBackup()).counts.stagedImports).toBe(1);
    expect((await commit(body.operationId)).statusCode).toBe(409);
    expect((await upload(body.operationId, document(d))).statusCode).toBe(200);
    expect((await commit(body.operationId)).statusCode).toBe(409);
    expect((await uploadImage(body.operationId)).statusCode).toBe(200);
    database.prepare('UPDATE boards SET revision=revision+1,title=? WHERE id=?').run('New shared version', board.summary.id);
    const changed = sourceState(board.summary.id);
    const completed = await commit(body.operationId); expect(completed.statusCode).toBe(200);
    expect(completed.json().summary).toMatchObject({ title: body.title, role: 'owner', access: 'private', accountId: actors.editor!.accountId, pendingCount: 0 });
    expect(completed.json().liveEnabled).toBe(false);
    expect((await commit(body.operationId)).json()).toEqual(completed.json());
    expect((await app.inject({ url: '/api/operations/' + body.operationId, headers: headers('editor') })).json()).toEqual({ status: 'completed', result: completed.json() });
    expect((await app.inject({ url: '/api/operations/' + body.operationId, headers: headers('owner') })).json()).toEqual({ status: 'unknown' });
    expect(database.prepare('SELECT member_id FROM board_grants WHERE board_id=?').all(d.summary.id)).toEqual([]);
    expect(database.prepare('SELECT canonical_email FROM pending_grants WHERE board_id=?').all(d.summary.id)).toEqual([]);
    expect((database.prepare('SELECT bytes FROM board_blobs WHERE board_id=?').get(d.summary.id) as { bytes: Buffer }).bytes).toEqual(image);
    expect(sourceState(board.summary.id)).toEqual(changed);
    expect(database.prepare('SELECT id FROM boards').all()).toHaveLength(2); expect((await validateBackup()).counts.boards).toBe(2);
  });

  it('binds actor operation to source epoch title manifest and immutable staged document', async () => {
    const board = await create(); grant(board.summary.id); const body = request();
    const staged = await reserve(board.summary.id, body); expect(staged.statusCode).toBe(200); const d = staged.json().result;
    const before = database.prepare('SELECT * FROM import_staging').all();
    for (const changed of [{ title: 'Different title' }, { snapshotDigest: 'b'.repeat(64) }, { manifest: [] }]) {
      expect((await reserve(board.summary.id, { ...body, ...changed })).statusCode).toBe(409);
      expect(database.prepare('SELECT * FROM import_staging').all()).toEqual(before);
    }
    const other = await create(); grant(other.summary.id);
    expect((await reserve(other.summary.id, body)).statusCode).toBe(409);
    const first = document(d); expect((await upload(body.operationId, first)).statusCode).toBe(200);
    expect((await upload(body.operationId, first)).statusCode).toBe(200);
    expect((await upload(body.operationId, document(d))).statusCode).toBe(409);
    const stored = database.prepare('SELECT root,content FROM import_staging').get() as { root: Buffer; content: Buffer };
    expect(stored.root.toString('base64')).toBe(first.root); expect(stored.content.toString('base64')).toBe(first.content);
  });

  it.each(['stage', 'document', 'image', 'commit'] as const)('revalidates source access at the %s transaction boundary', async step => {
    const board = await create(); grant(board.summary.id); const body = request();
    let d: { rootDocId: string; contentDocId: string } | undefined;
    if (step !== 'stage') { const staged = await reserve(board.summary.id, body); expect(staged.statusCode).toBe(200); d = staged.json().result; }
    if (step === 'commit') { expect((await upload(body.operationId, document(d!))).statusCode).toBe(200); expect((await uploadImage(body.operationId)).statusCode).toBe(200); }
    const before = database.prepare('SELECT * FROM import_staging').all();
    const blobs = database.prepare('SELECT * FROM import_staging_blobs').all();
    barrier = async () => { database.prepare('DELETE FROM board_grants WHERE board_id=?').run(board.summary.id); };
    const response = await (step === 'stage' ? reserve(board.summary.id, body) : step === 'document' ? upload(body.operationId, document(d!)) : step === 'image' ? uploadImage(body.operationId) : commit(body.operationId));
    expect(response.statusCode).toBe(404);
    expect(database.prepare('SELECT id FROM boards').all()).toEqual([{ id: board.summary.id }]);
    expect(database.prepare('SELECT * FROM import_staging').all()).toEqual(before); expect(database.prepare('SELECT * FROM import_staging_blobs').all()).toEqual(blobs);
  });

  it.each(['viewer', 'nonMember', 'system-viewer'] as const)('rejects %s without staging or returning source bytes', async actor => {
    const board = await create(); grant(board.summary.id);
    if (actor === 'viewer') database.prepare("INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,'viewer')").run(board.summary.id, actors.viewer!.accountId);
    if (actor === 'system-viewer') database.prepare("UPDATE members SET system_role='viewer' WHERE id=?").run(actors.editor!.accountId);
    const before = sourceState(board.summary.id);
    const denied = await reserve(board.summary.id, request(), actor === 'system-viewer' ? 'editor' : actor);
    expect(denied.statusCode).toBe(actor === 'nonMember' ? 404 : 403); expect(denied.body).not.toContain(image.toString('base64'));
    expect(database.prepare('SELECT * FROM import_staging').all()).toEqual([]); expect(sourceState(board.summary.id)).toEqual(before);
  });

  it.each(['stage', 'document', 'image', 'commit'] as const)('fences an epoch change at the %s transaction boundary', async step => {
    const board = await create(); grant(board.summary.id); const body = request(); let d: { rootDocId: string; contentDocId: string } | undefined;
    if (step !== 'stage') { const staged = await reserve(board.summary.id, body); expect(staged.statusCode).toBe(200); d = staged.json().result; }
    if (step === 'commit') { expect((await upload(body.operationId, document(d!))).statusCode).toBe(200); expect((await uploadImage(body.operationId)).statusCode).toBe(200); }
    const before = database.prepare('SELECT * FROM import_staging').all();
    barrier = async () => { database.prepare('UPDATE recovery_state SET epoch=?').run(randomUUID()); };
    const response = await (step === 'stage' ? reserve(board.summary.id, body) : step === 'document' ? upload(body.operationId, document(d!)) : step === 'image' ? uploadImage(body.operationId) : commit(body.operationId));
    expect(response.statusCode).toBe(409); expect(response.json().code).toBe('RECOVERY_EPOCH_MISMATCH');
    expect(database.prepare('SELECT * FROM import_staging').all()).toEqual(before); expect(database.prepare('SELECT id FROM boards').all()).toEqual([{ id: board.summary.id }]);
  });
});
