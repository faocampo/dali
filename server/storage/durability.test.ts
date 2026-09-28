import { beforeAll, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import Database from 'better-sqlite3';
import { configureDurableDatabase } from './database.js';
import { createDurabilityService, durabilityActor } from '../../tests/durability-fixtures.js';
import { randomUUID } from 'node:crypto';
import * as Y from 'yjs';
import { imageHash } from '../boards/blobs.js';
import { syntheticCanaries } from '../../tests/access-fixtures.js';

beforeAll(() => { execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.server.json']); }, 30000);

it('@04-01-02 child can arm an exact transaction boundary over private IPC', async () => {
  const service = await createDurabilityService('http://127.0.0.1:1');
  try { expect(await service.command('before'), 'child must acknowledge its armed boundary').toBe(true); }
  finally { await service.close(); }
});

async function setup() {
  const service = await createDurabilityService('http://127.0.0.1:1');
  const headers = await durabilityActor(service.origin);
  const request = (path: string, method = 'GET', body?: Uint8Array | string, mime = 'application/octet-stream') => fetch(service.origin + path, {
    method, headers: { ...headers, 'content-type': mime }, ...(body === undefined ? {} : { body: typeof body === 'string' ? body : Buffer.from(body) }),
  });
  const created = await request('/api/boards', 'POST', JSON.stringify({ operationId: randomUUID(), title: 'Crash boundary' }), 'application/json');
  expect(created.status).toBe(201);
  const board = await created.json() as { summary: { id: string }; contentDocId: string };
  const path = `/api/boards/${board.summary.id}/docs/${board.contentDocId}`;
  const read = async () => { const response = await request(path + '/pull', 'POST', new Uint8Array([0])); expect(response.status).toBe(200); return new Uint8Array(await response.arrayBuffer()); };
  const initial = await read();
  const doc = new Y.Doc(); Y.applyUpdate(doc, initial);
  const page = [...doc.getMap<Y.Map<unknown>>('blocks').values()].find(block => block.get('sys:flavour') === 'affine:page')!;
  const title = page.get('prop:title') as Y.Text;
  const edit = (text: string) => { const vector = Y.encodeStateVector(doc); title.insert(title.length, text); return Y.encodeStateAsUpdate(doc, vector); };
  const semantic = async () => { const reopened = new Y.Doc(); try { Y.applyUpdate(reopened, await read()); return [...reopened.getMap<Y.Map<unknown>>('blocks').values()].find(block => block.get('sys:flavour') === 'affine:page')!.get('prop:title')!.toString(); } finally { reopened.destroy(); } };
  const integrity = () => { const disk = new Database(service.databasePath); try { expect(disk.pragma('integrity_check', { simple: true })).toBe('ok'); expect(disk.pragma('foreign_key_check')).toEqual([]); } finally { disk.close(); } };
  return { service, request, board, path, read, edit, semantic, integrity, doc, async close() { doc.destroy(); await service.close(); } };
}

for (const boundary of ['before', 'after', 'response'] as const) it(`@04-01-02 document replay survives kill ${boundary} without losing acknowledged work`, async () => {
  const fixture = await setup();
  try {
    const baseline = await fixture.request(fixture.path + '/push', 'POST', fixture.edit('acknowledged;'));
    expect(await baseline.json()).toEqual({ acknowledged: true, previousRevision: 1, revision: 2 });
    const update = fixture.edit('uncertain;');
    if (boundary !== 'response') expect(await fixture.service.command(boundary)).toBe(true);
    const reached = boundary !== 'response' ? fixture.service.waitForBoundary() : undefined;
    const pending = fixture.request(fixture.path + '/push', 'POST', update).then(async response => ({ status: response.status, body: await response.text() }), () => null);
    if (reached) expect(await reached).toBe(boundary);
    else expect(JSON.parse((await pending)!.body)).toEqual({ acknowledged: true, previousRevision: 2, revision: 3 });
    await fixture.service.killAndRestart();
    if (boundary !== 'response') expect(await pending).toBeNull();
    expect(await fixture.semantic()).toBe(boundary === 'before' ? 'Crash boundaryacknowledged;' : 'Crash boundaryacknowledged;uncertain;');
    for (let i = 0; i < 2; i++) expect(await (await fixture.request(fixture.path + '/push', 'POST', update)).json()).toEqual({ acknowledged: true, previousRevision: boundary === 'before' && i === 0 ? 2 : 3, revision: 3 });
    expect(await fixture.semantic()).toBe('Crash boundaryacknowledged;uncertain;'); fixture.integrity();
  } finally { await fixture.close(); }
}, 20000);

// Minimal real PNG; content hash, validation and actual stored bytes are exercised.
const png = syntheticCanaries().imageBytes;
for (const boundary of ['before', 'after', 'response'] as const) it(`@04-01-02 image replay survives kill ${boundary} with one association`, async () => {
  const fixture = await setup(); const key = imageHash(png); const path = `/api/boards/${fixture.board.summary.id}/blobs/${key}`;
  try {
    if (boundary !== 'response') expect(await fixture.service.command(boundary)).toBe(true);
    const reached = boundary !== 'response' ? fixture.service.waitForBoundary() : undefined;
    const pending = fixture.request(path, 'PUT', png, 'image/png').then(async r => ({ status: r.status, body: await r.text() }), () => null);
    if (reached) expect(await reached).toBe(boundary); else expect((await pending)?.status).toBe(200);
    await fixture.service.killAndRestart();
    if (boundary !== 'response') expect(await pending).toBeNull();
    expect((await fixture.request(path)).status).toBe(boundary === 'before' ? 404 : 200);
    for (let i = 0; i < 2; i++) expect(await (await fixture.request(path, 'PUT', png, 'image/png')).json()).toEqual({ acknowledged: true, key });
    expect(Buffer.from(await (await fixture.request(path)).arrayBuffer())).toEqual(png);
    expect(await (await fixture.request(`/api/boards/${fixture.board.summary.id}/blobs`)).json()).toEqual([key]); fixture.integrity();
  } finally { await fixture.close(); }
}, 20000);

for (const fault of ['readonly', 'full'] as const) it(`@04-01-02 ${fault} write failure emits no acknowledgment and survives restart`, async () => {
  const fixture = await setup();
  try {
    expect(await (await fixture.request(fixture.path + '/push', 'POST', fixture.edit('preserved;'))).json()).toEqual({ acknowledged: true, previousRevision: 1, revision: 2 });
    expect(await fixture.service.command(fault)).toBe(true);
    const failed = fixture.service.waitForBoundary();
    const response = await fixture.request(fixture.path + '/push', 'POST', fixture.edit('x'.repeat(200000)));
    expect(await failed).toBe(fault === 'readonly' ? 'SQLITE_READONLY' : 'SQLITE_FULL');
    expect(response.status).toBe(500); expect(await response.text()).not.toContain('acknowledged');
    await fixture.service.killAndRestart(); expect(await fixture.semantic()).toBe('Crash boundarypreserved;'); fixture.integrity();
  } finally { await fixture.close(); }
}, 20000);

it('@04-01-02 missing image references cannot commit across restart', async () => {
  const fixture = await setup();
  try {
    const before = await fixture.read(); const image = new Y.Map<unknown>();
    image.set('sys:id', 'missing-image'); image.set('sys:flavour', 'affine:image'); image.set('prop:sourceId', imageHash(png));
    fixture.doc.getMap('blocks').set('missing-image', image);
    expect((await fixture.request(fixture.path + '/push', 'POST', Y.encodeStateAsUpdate(fixture.doc))).status).toBe(400);
    await fixture.service.killAndRestart(); expect(await fixture.read()).toEqual(before); fixture.integrity();
  } finally { await fixture.close(); }
}, 20000);

it('@04-01-02 incompatible persistent configuration closes and rejects the connection', () => {
  const database = new Database(':memory:');
  expect(() => configureDurableDatabase(database, true)).toThrow('Required database durability');
  expect(database.open).toBe(false);
  const unit = new Database(':memory:'); configureDurableDatabase(unit, false);
  expect(unit.open).toBe(true); unit.close();
});
