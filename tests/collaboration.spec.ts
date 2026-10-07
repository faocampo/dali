import { randomUUID } from 'node:crypto';
import { test, expect } from './fixtures';
import { acceptanceService, createIdentityContexts } from './access-fixtures';
import { createDurabilityService } from './durability-fixtures';
import { openDatabase } from '../server/storage/database';
import { seedCollaborationShapes, shapeBounds, moveNativeShape, renderedShapeBounds } from './collaboration-fixtures';
import { readRecoveryEpoch } from '../server/storage/recovery-state';

test('@05-01-01 two native editors move independent shapes and a Viewer observes both', async ({ browser, baseURL }) => {
  const service = await createDurabilityService(baseURL!);
  const database = openDatabase(service.databasePath);
  let identities = await createIdentityContexts(browser, service.origin);
  try {
    const accounts: Record<string, string> = {};
    for (const [name, context] of Object.entries(identities.contexts)) accounts[name] = (await (await context.request.get('/api/session')).json()).accountId;
    const created = await identities.contexts.owner.request.post('/api/boards', { headers: { Origin: service.origin, 'X-Dali-Request': '1', 'X-Dali-Account': accounts.owner!, 'X-Dali-Recovery-Epoch': readRecoveryEpoch(database) }, data: { operationId: randomUUID(), title: 'Synthetic collaboration' } });
    expect(created.status()).toBe(201); const board = await created.json();
    for (const role of ['editor', 'viewer']) database.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?)').run(board.summary.id, accounts[role]!, role);
    const [shapeA, shapeB] = await seedCollaborationShapes(identities.contexts.owner.pages()[0]!, database, board.summary.id);
    const pages = [identities.contexts.owner.pages()[0]!, identities.contexts.editor.pages()[0]!, identities.contexts.viewer.pages()[0]!];
    for (const page of pages) { await page.goto(`/?board=${board.summary.id}`); await expect(page.locator('affine-edgeless-root')).toBeVisible(); }
    const beforeA = await shapeBounds(pages[0]!, shapeA!); const beforeB = await shapeBounds(pages[1]!, shapeB!);
    await Promise.all([moveNativeShape(pages[0]!, shapeA!, 60), moveNativeShape(pages[1]!, shapeB!, -60)]);
    await expect.poll(() => shapeBounds(pages[0]!, shapeA!)).not.toBe(beforeA);
    await expect.poll(() => shapeBounds(pages[1]!, shapeB!)).not.toBe(beforeB);
    const a = await shapeBounds(pages[0]!, shapeA!); const b = await shapeBounds(pages[1]!, shapeB!);
    for (const page of pages) {
      await expect.poll(() => shapeBounds(page, shapeA!)).toBe(a);
      await expect.poll(() => shapeBounds(page, shapeB!)).toBe(b);
    }
    await pages[2]!.reload(); await expect(pages[2]!.locator('affine-edgeless-root')).toBeVisible();
    expect(await shapeBounds(pages[2]!, shapeA!)).toBe(a); expect(await shapeBounds(pages[2]!, shapeB!)).toBe(b);
    for (const page of pages.slice(0, 2)) await expect(page.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
    await identities.close(); database.close();
    await service.killAndRestart();
    identities = await createIdentityContexts(browser, service.origin);
    for (const role of ['owner', 'editor', 'viewer'] as const) {
      const page = identities.contexts[role].pages()[0]!;
      await page.goto(`/?board=${board.summary.id}`);
      await expect(page.locator('affine-edgeless-root')).toBeVisible();
      expect(await shapeBounds(page, shapeA!)).toBe(a);
      expect(await shapeBounds(page, shapeB!)).toBe(b);
      expect(await renderedShapeBounds(page, shapeA!)).toBe(a);
      expect(await renderedShapeBounds(page, shapeB!)).toBe(b);
    }

  } finally { try { await identities.close(); } finally { if (database.open) database.close(); await service.close(); } }
});


test('@05-01-02 a lost commit response retries the same receipt and reaches the native Viewer', async ({ browser, baseURL }) => {
  const service = await acceptanceService(baseURL!);
  const identities = await createIdentityContexts(browser, service.origin);
  try {
    const accounts: Record<string, string> = {};
    for (const [role, context] of Object.entries(identities.contexts)) accounts[role] = (await (await context.request.get('/api/session')).json()).accountId;
    const response = await identities.contexts.owner.request.post('/api/boards', { headers: { Origin: service.origin, 'X-Dali-Request': '1', 'X-Dali-Account': accounts.owner!, 'X-Dali-Recovery-Epoch': readRecoveryEpoch(service.database) }, data: { operationId: randomUUID(), title: 'Synthetic response loss' } });
    expect(response.status()).toBe(201); const board = await response.json();
    service.database.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?)').run(board.summary.id, accounts.viewer!, 'viewer');
    const owner = identities.contexts.owner.pages()[0]!; const viewer = identities.contexts.viewer.pages()[0]!;
    const [shape] = await seedCollaborationShapes(owner, service.database, board.summary.id);
    for (const page of [owner, viewer]) { await page.goto(`/?board=${board.summary.id}`); await expect(page.locator('affine-edgeless-root')).toBeVisible(); }
    await expect(owner.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
    let dropped: { operation: string; revision: number } | undefined;
    let retried = false;
    await owner.route(`**/docs/${board.contentDocId}/push`, async route => {
      const operation = route.request().headers()['x-dali-operation']!;
      const committed = await route.fetch(); expect(committed.ok()).toBe(true);
      const result = await committed.json();
      if (!dropped) { dropped = { operation, revision: result.revision }; await route.abort('failed'); return; }
      if (operation === dropped.operation) { expect(result.revision).toBe(dropped.revision); retried = true; }
      await route.fulfill({ response: committed });
    });
    const before = await shapeBounds(owner, shape!);
    await moveNativeShape(owner, shape!, 60);
    await expect.poll(() => retried).toBe(true);
    await expect.poll(() => shapeBounds(owner, shape!)).not.toBe(before);
    await expect(owner.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
    const changed = await shapeBounds(owner, shape!);
    await expect.poll(() => renderedShapeBounds(viewer, shape!)).toBe(changed);
    const receipt = service.database.prepare('SELECT count(*) AS count FROM document_receipts WHERE board_id=? AND operation_id=?').get(board.summary.id, dropped!.operation) as { count: number };
    expect(receipt.count).toBe(1);
    expect(identities.runtimeErrors).toEqual(['owner: Failed to load resource: net::ERR_FAILED']);
    identities.runtimeErrors.length = 0; // Only the explicitly injected lost response is expected.
  } finally { try { await identities.close(); } finally { await service.close(); } }
});
