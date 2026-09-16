import { randomUUID } from 'node:crypto';
import { test, expect, acceptanceService, createIdentityContexts } from './access-fixtures';

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
