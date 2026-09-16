import { randomUUID } from 'node:crypto';
import * as Y from 'yjs';
import { imageHash } from '../server/boards/blobs';
import { test, expect, acceptanceService, createIdentityContexts, syntheticCanaries, expectDeniedWithoutChange, type AccessIdentity } from './access-fixtures';

test('operation receipts reauthorize revoked resources and reject wrong-kind import IDs @03-12-receipts', async ({ browser, baseURL }) => {
  const service = await acceptanceService(baseURL!);
  const identities = await createIdentityContexts(browser, service.origin);
  try {
    const { contexts } = identities;
    const accounts = Object.fromEntries(await Promise.all(Object.entries(contexts).map(async ([role, context]) => [role, (await (await context.request.get('/api/session')).json()).accountId as string])));
    const headers = (role: string) => ({ Origin: service.origin, 'X-Dali-Request': '1', 'X-Dali-Account': accounts[role]! });
    const createId = randomUUID();
    const created = await contexts.owner.request.post('/api/boards', { headers: headers('owner'), data: { operationId: createId, title: 'Synthetic receipt canary' } });
    expect(created.status()).toBe(201); const board = await created.json();
    service.database.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?)').run(board.summary.id, accounts.editor, 'editor');
    const renameId = randomUUID();
    const renamed = await contexts.editor.request.patch('/api/boards/' + board.summary.id, { headers: headers('editor'), data: { operationId: renameId, revision: board.revision, title: 'Synthetic revoked receipt canary' } });
    expect(renamed.status()).toBe(200);
    service.database.prepare('DELETE FROM board_grants WHERE board_id=? AND member_id=?').run(board.summary.id, accounts.editor);
    const before = service.database.prepare('SELECT * FROM boards').all();
    const receipt = await contexts.editor.request.get('/api/operations/' + renameId, { headers: headers('editor') });
    expect(receipt.status(), 'revoked operation result must not expose a stale writable descriptor').toBe(404);
    expect(await receipt.text()).not.toContain('Synthetic revoked receipt canary');
    const wrongKind = await contexts.owner.request.get('/api/imports/' + createId, { headers: headers('owner') });
    expect(await wrongKind.json(), 'a create receipt is not an import status').toEqual({ status: 'unknown' });
    expect(service.database.prepare('SELECT * FROM boards').all()).toEqual(before);
  } finally { await identities.close(); await service.close(); }
});

test('staging, operation replay, current role and commit-time denial preserve reconciliation @03-12-transactions', async ({ browser, baseURL }) => {
  const service = await acceptanceService(baseURL!); const identities = await createIdentityContexts(browser, service.origin);
  try {
    const { contexts } = identities;
    const accounts = Object.fromEntries(await Promise.all(Object.entries(contexts).map(async ([role, context]) => [role, (await (await context.request.get('/api/session')).json()).accountId as string])));
    const h = (role: AccessIdentity, mime = 'application/json') => ({ Origin: service.origin, 'X-Dali-Request': '1', 'X-Dali-Account': accounts[role]!, 'Content-Type': mime });
    const createId = randomUUID(); const createBody = { operationId: createId, title: 'Synthetic transaction canary' };
    const board = await (await contexts.owner.request.post('/api/boards', { headers: h('owner'), data: createBody })).json();
    const id = board.summary.id;
    const same = await contexts.owner.request.post('/api/boards', { headers: h('owner'), data: createBody }); expect((await same.json()).summary.id).toBe(id);
    service.database.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?)').run(id, accounts.editor, 'editor');
    const renameId = randomUUID(); const rename = await contexts.editor.request.patch('/api/boards/' + id, { headers: h('editor'), data: { operationId: renameId, revision: 1, title: 'Synthetic current role canary' } }); expect(rename.status()).toBe(200);
    service.database.prepare("UPDATE board_grants SET role='viewer' WHERE board_id=? AND member_id=?").run(id, accounts.editor);
    const current = await contexts.editor.request.get('/api/operations/' + renameId, { headers: h('editor') }); expect(current.status()).toBe(200); const currentReceipt = await current.json();
    expect(currentReceipt.result.summary.role).toBe('viewer'); expect(currentReceipt.result.capabilities).not.toContain('write');
    const rows = () => ['boards', 'board_documents', 'board_blobs', 'board_thumbnails', 'board_grants', 'pending_grants', 'operations', 'import_staging', 'import_staging_blobs'].map(table => service.database.prepare(`SELECT * FROM ${table}`).all());
    const baseline = rows();
    for (const suffix of ['/api/operations/', '/api/imports/']) {
      expect(await (await contexts.nonMember.request.get(suffix + createId, { headers: h('nonMember') })).json()).toEqual({ status: 'unknown' });
      expect(await (await contexts.owner.request.get(suffix + 'missing', { headers: h('owner') })).json()).toEqual({ status: 'unknown' });
      expect((await contexts.owner.request.get(suffix + createId, { headers: { ...h('owner'), 'X-Dali-Account': accounts.viewer! } })).status()).toBe(409);
    }
    const wrongCommit = await contexts.owner.request.post('/api/imports/' + createId + '/commit', { headers: h('owner'), data: {} }); expect(wrongCommit.status()).toBe(409);
    expect(rows()).toEqual(baseline);
    const canary = syntheticCanaries(); const key = imageHash(canary.imageBytes);
    const importId = randomUUID(); const importBody = { operationId: importId, title: canary.boardText, manifest: [key] };
    const reserved = await contexts.editor.request.post('/api/imports', { headers: h('editor'), data: importBody }); expect(reserved.status()).toBe(200);
    const target = (await reserved.json()).result;
    expect((await (await contexts.editor.request.post('/api/imports', { headers: h('editor'), data: importBody })).json()).result.summary.id).toBe(target.summary.id);
    const root = new Y.Doc({ guid: target.rootDocId }); const content = new Y.Doc({ guid: target.contentDocId }); root.getMap('spaces').set(target.contentDocId, content);
    for (const flavour of ['affine:page', 'affine:surface', 'affine:image']) { const block = new Y.Map<unknown>(); const blockId = randomUUID(); block.set('sys:id', blockId); block.set('sys:flavour', flavour); if (flavour === 'affine:image') block.set('prop:sourceId', key); content.getMap('blocks').set(blockId, block); }
    const payload = { root: Buffer.from(Y.encodeStateAsUpdate(root)).toString('base64'), content: Buffer.from(Y.encodeStateAsUpdate(content)).toString('base64'), manifest: [key] }; root.destroy(); content.destroy();
    const stageBefore = rows();
    for (const operation of [importId, randomUUID()]) {
      for (const [method, suffix, data, mime] of [['PUT', '/document', payload, 'application/json'], ['PUT', '/blobs/' + encodeURIComponent(key), canary.imageBytes, 'image/png'], ['POST', '/commit', {}, 'application/json']] as const) {
        const response = await contexts.nonMember.request.fetch(`/api/imports/${operation}${suffix}`, { method, headers: h('nonMember', mime), data }); expect(response.status()).toBe(404); expect(await response.text()).not.toContain(canary.boardText); expect(rows()).toEqual(stageBefore);
      }
    }
    for (const [method, path, data, mime] of [['POST', '/api/imports', { ...importBody, operationId: randomUUID() }, 'application/json'], ['PUT', `/api/imports/${importId}/document`, payload, 'application/json'], ['PUT', `/api/imports/${importId}/blobs/${encodeURIComponent(key)}`, canary.imageBytes, 'image/png'], ['POST', `/api/imports/${importId}/commit`, {}, 'application/json']] as const) {
      for (const headers of [{ ...h('editor', mime), Origin: 'https://foreign.example.org' }, { ...h('editor', mime), 'X-Dali-Request': '' }]) {
        expect((await contexts.editor.request.fetch(path, { method, headers, data })).status()).toBe(403); expect(rows()).toEqual(stageBefore);
      }
      expect((await contexts.editor.request.fetch(path, { method, headers: { ...h('editor', mime), 'X-Dali-Account': accounts.owner! }, data })).status()).toBe(409); expect(rows()).toEqual(stageBefore);
    }
    expect((await contexts.editor.request.put(`/api/imports/${importId}/document`, { headers: h('editor'), data: payload })).status()).toBe(200);
    expect((await contexts.editor.request.put(`/api/imports/${importId}/blobs/${encodeURIComponent(key)}`, { headers: h('editor', 'image/png'), data: canary.imageBytes })).status()).toBe(200);
    const committed = await contexts.editor.request.post(`/api/imports/${importId}/commit`, { headers: h('editor'), data: {} }); expect(committed.status()).toBe(200); expect((await committed.json()).summary.id).toBe(target.summary.id);
    service.database.prepare('DELETE FROM board_grants WHERE board_id=? AND member_id=?').run(id, accounts.editor);
    for (const prefix of ['/api/operations/', '/api/imports/']) expect((await (await contexts.editor.request.get(prefix + importId, { headers: h('editor') })).json()).result.summary.id).toBe(target.summary.id);
    expect((await (await contexts.editor.request.post(`/api/imports/${importId}/commit`, { headers: h('editor'), data: {} })).json()).summary.id).toBe(target.summary.id);
    expect(await (await contexts.editor.request.get(`/api/boards/${target.summary.id}/blobs/${encodeURIComponent(key)}`, { headers: h('editor') })).body()).toEqual(canary.imageBytes);
    // An in-flight writer loses access at the transaction boundary; only the explicit revocation may change state.
    service.database.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?)').run(id, accounts.editor, 'editor');
    let afterRevoke: ReturnType<typeof rows> | undefined;
    service.setBarrier(async () => { service.database.prepare('DELETE FROM board_grants WHERE board_id=? AND member_id=?').run(id, accounts.editor); afterRevoke = rows(); });
    const denied = await contexts.editor.request.post(`/api/boards/${id}/docs/${board.contentDocId}/push`, { headers: h('editor', 'application/octet-stream'), data: Buffer.from([0, 0]) }); expect(denied.status()).toBe(404); expect(rows()).toEqual(afterRevoke);
    service.setBarrier();
    const currentBoard = await (await contexts.owner.request.get('/api/boards/' + id, { headers: h('owner') })).json(); const deleteId = randomUUID(); const deletion = { operationId: deleteId, revision: currentBoard.revision };
    const removed = await contexts.owner.request.delete('/api/boards/' + id, { headers: h('owner'), data: deletion }); expect(removed.status()).toBe(200);
    expect(await (await contexts.owner.request.get('/api/operations/' + deleteId, { headers: h('owner') })).json()).toEqual({ status: 'completed', result: { deleted: true, boardId: id } });
    expect(await (await contexts.owner.request.delete('/api/boards/' + id, { headers: h('owner'), data: deletion })).json()).toEqual({ deleted: true, boardId: id });
    expect((await contexts.owner.request.get('/api/session', { headers: h('viewer') })).status()).toBe(409);
    expect((await contexts.owner.request.post('/api/logout', { headers: { ...h('owner'), Origin: 'https://foreign.example.org' }, data: {} })).status()).toBe(403);
    expect((await contexts.owner.request.post('/api/logout', { headers: h('owner'), data: {} })).status()).toBe(204);
    expect((await contexts.owner.request.get('/api/session')).status()).toBe(401);
    expect((await contexts.owner.request.get('/api/operations/' + deleteId, { headers: h('owner') })).status()).toBe(401);
  } finally { await identities.close(); await service.close(); }
});

test('@03-12-smoke independent role/resource canaries preserve owner state on every denial', async ({ browser, baseURL }) => {
  const service = await acceptanceService(baseURL!); const identities = await createIdentityContexts(browser, service.origin);
  try {
    const { contexts } = identities;
    const accounts = Object.fromEntries(await Promise.all(Object.entries(contexts).map(async ([role, context]) => [role, (await (await context.request.get('/api/session')).json()).accountId as string])));
    expect(new Set(Object.values(accounts)).size).toBe(4);
    const headers = (role: AccessIdentity, mime = 'application/json') => ({ Origin: service.origin, 'X-Dali-Request': '1', 'X-Dali-Account': accounts[role]!, 'Content-Type': mime });
    const boards = [];
    for (const role of ['owner', 'nonMember'] as const) {
      const canary = syntheticCanaries(); const operationId = randomUUID();
      const response = await contexts[role].request.post('/api/boards', { headers: headers(role), data: { operationId, title: canary.boardText } });
      expect(response.status()).toBe(201); const d = await response.json(); const key = imageHash(canary.imageBytes);
      expect((await contexts[role].request.put(`/api/boards/${d.summary.id}/blobs/${encodeURIComponent(key)}`, { headers: headers(role, 'image/png'), data: canary.imageBytes })).status()).toBe(200);
      expect((await contexts[role].request.put(`/api/boards/${d.summary.id}/thumbnail`, { headers: headers(role, 'image/png'), data: canary.imageBytes })).status()).toBe(200);
      boards.push({ d, canary, key, role, operationId });
    }
    const own = boards[0]!; const foreign = boards[1]!; const id = own.d.summary.id;
    for (const role of ['editor', 'viewer'] as const) service.database.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?)').run(id, accounts[role], role);
    const ownerRead = async () => {
      const root = await contexts.owner.request.post(`/api/boards/${id}/docs/${own.d.rootDocId}/pull`, { headers: headers('owner', 'application/octet-stream'), data: Buffer.from([0]) });
      const content = await contexts.owner.request.post(`/api/boards/${id}/docs/${own.d.contentDocId}/pull`, { headers: headers('owner', 'application/octet-stream'), data: Buffer.from([0]) });
      const blob = await contexts.owner.request.get(`/api/boards/${id}/blobs/${encodeURIComponent(own.key)}`, { headers: headers('owner') });
      const thumbnail = await contexts.owner.request.get(`/api/boards/${id}/thumbnail`, { headers: headers('owner') });
      const metadata = await contexts.owner.request.get(`/api/boards/${id}`, { headers: headers('owner') });
      const grants = await contexts.owner.request.get(`/api/boards/${id}/grants`, { headers: headers('owner') });
      for (const response of [root, content, blob, thumbnail, metadata, grants]) expect(response.status()).toBe(200);
      const docs = [await root.body(), await content.body()];
      return { documentBytes: Buffer.concat(docs), stateVector: Buffer.concat(docs.map(bytes => Buffer.from(Y.encodeStateVectorFromUpdate(bytes)))), imageBytes: Buffer.concat([await blob.body(), await thumbnail.body()]), metadata: await metadata.json(), grants: await grants.json() };
    };
    type Entry = { method: string; path: string; data?: object | Buffer; mime?: string; capability: 'read' | 'write' | 'owner' };
    const matrix = (boardId = id, docId = own.d.contentDocId, key = own.key): Entry[] => [
      { method: 'GET', path: `/api/boards/${boardId}`, capability: 'read' },
      { method: 'GET', path: `/api/boards/${boardId}/thumbnail`, capability: 'read' },
      { method: 'GET', path: `/api/boards/${boardId}/blobs`, capability: 'read' },
      { method: 'GET', path: `/api/boards/${boardId}/blobs/${encodeURIComponent(key)}`, capability: 'read' },
      { method: 'POST', path: `/api/boards/${boardId}/docs/${docId}/pull`, data: Buffer.from([0]), mime: 'application/octet-stream', capability: 'read' },
      { method: 'POST', path: `/api/boards/${boardId}/docs/${docId}/push`, data: Buffer.from([0, 0]), mime: 'application/octet-stream', capability: 'write' },
      { method: 'PUT', path: `/api/boards/${boardId}/blobs/${encodeURIComponent(key)}`, data: own.canary.imageBytes, mime: 'image/png', capability: 'write' },
      { method: 'DELETE', path: `/api/boards/${boardId}/blobs/${encodeURIComponent(key)}`, capability: 'write' },
      { method: 'PUT', path: `/api/boards/${boardId}/thumbnail`, data: own.canary.imageBytes, mime: 'image/png', capability: 'write' },
      { method: 'PATCH', path: `/api/boards/${boardId}`, data: { operationId: randomUUID(), revision: 1, title: 'Forbidden rename' }, capability: 'write' },
      { method: 'DELETE', path: `/api/boards/${boardId}`, data: { operationId: randomUUID(), revision: 1 }, capability: 'owner' },
      { method: 'GET', path: `/api/boards/${boardId}/editable-export`, capability: 'write' },
      { method: 'POST', path: `/api/boards/${boardId}/duplicate`, data: { operationId: randomUUID(), revision: 1 }, capability: 'write' },
      { method: 'GET', path: `/api/members?boardId=${boardId}&q=Synthetic`, capability: 'owner' },
      { method: 'GET', path: `/api/boards/${boardId}/grants`, capability: 'owner' },
      { method: 'POST', path: `/api/boards/${boardId}/grants`, data: { operationId: randomUUID(), revision: 1, email: 'pending@example.org' }, capability: 'owner' },
      { method: 'PATCH', path: `/api/boards/${boardId}/grants/missing`, data: { operationId: randomUUID(), revision: 1, role: 'editor' }, capability: 'owner' },
      { method: 'DELETE', path: `/api/boards/${boardId}/grants/missing`, data: { operationId: randomUUID(), revision: 1 }, capability: 'owner' },
    ];
    let denials = 0;
    const deny = async (role: AccessIdentity, entry: Entry, status: number, override?: Record<string, string>) => {
      await expectDeniedWithoutChange({ ownerRead, status, canaryText: own.canary.boardText, canaryImage: own.canary.imageBytes,
        attempt: () => contexts[role].request.fetch(entry.path, { method: entry.method, headers: override ?? headers(role, entry.mime), ...(entry.method !== 'GET' ? { data: entry.data ?? {} } : {}) }) }); denials++;
    };
    for (const role of ['owner', 'editor', 'viewer', 'nonMember'] as const) {
      for (const entry of matrix()) {
        const allowed = role === 'owner' || (role === 'editor' && entry.capability !== 'owner') || (role === 'viewer' && entry.capability === 'read');
        if (!allowed) { await deny(role, entry, role === 'nonMember' ? 404 : 403); await deny(role, entry, role === 'nonMember' ? 404 : 403); }
        else if (entry.capability === 'read') {
          const response = await contexts[role].request.fetch(entry.path, { method: entry.method, headers: headers(role, entry.mime), ...(entry.data ? { data: entry.data } : {}) });
          expect(response.status()).toBe(200); expect(response.headers()['cache-control']).toBe('private, no-store');
          if (entry.path.endsWith('/thumbnail') || entry.path.includes('/blobs/')) expect(await response.body()).toEqual(own.canary.imageBytes);
          if (entry.path.endsWith('/pull') || entry.path === `/api/boards/${id}`) expect((await response.body()).toString()).toContain(own.canary.boardText);
        }
      }
    }
    for (const target of [randomUUID(), foreign.d.summary.id]) for (const entry of matrix(target)) await deny('owner', entry, 404);
    for (const entry of matrix(id, foreign.d.contentDocId).filter(e => e.path.includes('/docs/'))) await deny('owner', entry, 404);
    await deny('owner', { method: 'GET', path: `/api/boards/${id}/blobs/${encodeURIComponent(foreign.key)}`, capability: 'read' }, 404);
    for (const entry of matrix()) {
      await deny('owner', entry, 409, { ...headers('owner', entry.mime), 'X-Dali-Account': accounts.nonMember! });
      const absentAccount: Record<string, string> = headers('owner', entry.mime); delete absentAccount['X-Dali-Account'];
      await deny('owner', entry, 409, absentAccount);
      if (entry.method !== 'GET') {
        await deny('owner', entry, 403, { ...headers('owner', entry.mime), Origin: 'https://foreign.example.org' });
        await deny('owner', entry, 403, { ...headers('owner', entry.mime), 'X-Dali-Request': '' });
      }
    }
    expect((await (await contexts.owner.request.get('/api/boards', { headers: headers('owner') })).json()).map((b: { id: string }) => b.id)).toEqual([id]);
    expect((await (await contexts.nonMember.request.get('/api/boards', { headers: headers('nonMember') })).json()).map((b: { id: string }) => b.id)).toEqual([foreign.d.summary.id]);
    await contexts.nonMember.clearCookies();
    for (const entry of matrix()) await deny('nonMember', entry, 401);
    expect(denials).toBe(189);
  } finally { await identities.close(); await service.close(); }
});
