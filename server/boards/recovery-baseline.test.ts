import { readRecoveryEpoch } from '../storage/recovery-state.js';
import { afterEach, beforeEach } from 'vitest';
import { randomBytes, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { openDatabase, type AccountDatabase } from '../storage/database.js';
import { createOidcProvider, IDENTITY_COOKIE } from '../../tests/oidc-provider.js';

import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';

describe('authorized recovery baseline', () => {
  let app: FastifyInstance; let database: AccountDatabase;
  let provider: Awaited<ReturnType<typeof createOidcProvider>>;
  let barrier: () => Promise<void>; let clock: number;
  const origin = 'http://127.0.0.1:5499';
  const actors: Record<string, { cookie: string; accountId: string }> = {};
  type Descriptor = { summary: { id: string }; rootDocId: string; contentDocId: string };
  let board: Descriptor; let foreign: Descriptor;
  const cookieOf = (response: { headers: Record<string, unknown> }) => {
    const values = response.headers['set-cookie'];
    return (Array.isArray(values) ? values.at(-1) : values)?.split(';')[0] as string;
  };
  const headers = (actor = 'owner') => ({ "x-dali-recovery-epoch": readRecoveryEpoch(database), cookie: actors[actor]!.cookie, 'x-dali-account': actors[actor]!.accountId, 'x-dali-request': '1', origin });
  const bytes = (id = board.contentDocId, b = board) => (database.prepare('SELECT update_bytes FROM board_documents WHERE board_id=? AND doc_id=?').get(b.summary.id, id) as { update_bytes: Buffer }).update_bytes;
  beforeEach(async () => {
    clock = Date.now(); barrier = async () => {};
    const registration = { clientId: 'synthetic-resources', clientSecret: randomBytes(32).toString('hex'), redirectUri: origin + '/auth/callback' };
    provider = await createOidcProvider({ clients: [registration] }); database = openDatabase(':memory:');
    app = await buildApp({ storagePolicy: { kind: 'fixture' }, database, now: () => clock, beforeCommit: () => barrier(), config: {
      DALI_ORIGIN: origin, DALI_DATABASE_PATH: ':memory:', DALI_SESSION_SECRET: randomBytes(32).toString('hex'), DALI_SESSION_TTL_MS: '86400000',
      DALI_OIDC_ISSUER: provider.issuer, DALI_OIDC_CLIENT_ID: registration.clientId, DALI_OIDC_CLIENT_SECRET: registration.clientSecret,
      DALI_OIDC_CALLBACK_URL: registration.redirectUri, DALI_INTERNAL_CLAIM: 'membership', DALI_INTERNAL_VALUES_JSON: '["internal"]', DALI_INTERNAL_EMAIL_DOMAINS_JSON: '["example.org"]',
    } });
    for (const identity of ['owner', 'editor', 'viewer', 'nonMember']) {
      const start = await app.inject('/auth/start');
      const authorize = await fetch(start.headers.location!, { redirect: 'manual', headers: { cookie: `${IDENTITY_COOKIE}=${identity}` } });
      const callback = new URL(authorize.headers.get('location')!);
      const response = await app.inject({ url: callback.pathname + callback.search, headers: { cookie: cookieOf(start) } });
      const cookie = cookieOf(response); const session = await app.inject({ url: '/api/session', headers: { cookie } });
      expect(session.statusCode).toBe(200); actors[identity] = { cookie, accountId: session.json().accountId };
    }
    const create = async (actor: string, title: string) => {
      const response = await app.inject({ method: 'POST', url: '/api/boards', headers: headers(actor), payload: { title, operationId: randomUUID() } });
      expect(response.statusCode).toBe(201); return response.json() as Descriptor;
    };
    board = await create('owner', 'Owner canary'); foreign = await create('nonMember', 'Foreign private canary');
    for (const role of ['editor', 'viewer']) database.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?)').run(board.summary.id, actors[role]!.accountId, role);
  });
  afterEach(async () => { await app?.close(); database?.close(); await provider?.close(); });

  const snapshot = (actor = 'owner', attempts: unknown[] = [], extra = {}) => app.inject({ method: 'POST', url: `/api/boards/${board.summary.id}/recovery/baseline`, headers: { ...headers(actor), ...extra }, payload: { attempts } });
  it('@05-05-01 returns a consistent authorized root/content/title without changing content or revision', async () => {
    const before = database.prepare('SELECT title,revision FROM boards WHERE id=?').get(board.summary.id);
    const response = await snapshot(); expect(response.statusCode).toBe(200);
    const value = response.json(); expect(value.epoch).toBe(readRecoveryEpoch(database));
    expect(value.title).toBe('Owner canary'); expect(value.root.docId).toBe(board.rootDocId); expect(value.content.docId).toBe(board.contentDocId);
    expect(Buffer.from(value.root.data, 'base64')).toEqual(bytes(board.rootDocId));
    expect(Buffer.from(value.content.data, 'base64')).toEqual(bytes()); expect(value.receipts).toEqual([]);
    expect(database.prepare('SELECT title,revision FROM boards WHERE id=?').get(board.summary.id)).toEqual(before);
  });
  it('@05-05-01 denies Viewer, foreign account, wrong identity and stale recovery epoch', async () => {
    expect((await snapshot('viewer')).statusCode).toBe(403);
    expect((await snapshot('nonMember')).statusCode).toBe(404);
    expect((await snapshot('owner', [], { 'x-dali-account': actors.editor!.accountId })).statusCode).toBe(409);
    expect((await snapshot('owner', [], { 'x-dali-recovery-epoch': randomUUID() })).statusCode).toBe(409);
    database.prepare("UPDATE board_grants SET role='viewer' WHERE board_id=? AND member_id=?").run(board.summary.id, actors.editor!.accountId);
    expect((await snapshot('editor')).statusCode).toBe(403);
  });
  it('@05-05-01 exposes only exact own operation receipts; another tab or digest cannot impersonate one', async () => {
    const attempt = { tabId: 'original-transport-tab', operationId: randomUUID(), docId: board.contentDocId, digest: createHash('sha256').update('synthetic receipt').digest('hex') };
    database.prepare('INSERT INTO document_receipts(board_id,account_id,tab_id,operation_id,doc_id,digest,previous_revision,revision) VALUES(?,?,?,?,?,?,?,?)')
      .run(board.summary.id, actors.owner!.accountId, attempt.tabId, attempt.operationId, attempt.docId, attempt.digest, 1, 2);
    const response = await snapshot('owner', [attempt]); expect(response.statusCode).toBe(200);
    expect(response.json().receipts).toEqual([{ ...attempt, previousRevision: 1, revision: 2 }]);
    expect((await snapshot('editor', [attempt])).json().receipts).toEqual([]);
    for (const altered of [{ ...attempt, tabId: 'different-tab' }, { ...attempt, digest: '0'.repeat(64) }, { ...attempt, docId: board.rootDocId }])
      expect((await snapshot('owner', [altered])).json().receipts).toEqual([]);
  });
  it('@05-05-01 bounds receipt queries and rejects unrelated document claims', async () => {
    const attempt = { tabId: 'tab', operationId: randomUUID(), docId: board.contentDocId, digest: '0'.repeat(64) };
    expect((await snapshot('owner', Array.from({ length: 257 }, () => attempt))).statusCode).toBe(400);
    expect((await snapshot('owner', [{ ...attempt, docId: foreign.contentDocId }])).statusCode).toBe(400);
  });
});
