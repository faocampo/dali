import { randomUUID } from 'node:crypto';
import { test, expect } from './fixtures';

test.use({ expectErrors: ['Failed to load resource: the server responded with a status of 401 (Unauthorized)', 'Failed to load resource: the server responded with a status of 404 (Not Found)'] });

test('@03-03-01 private creates have independent IDs and idempotent operation results', async ({ page, context, baseURL }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Synthetic Owner', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
  const member = await (await context.request.get('/api/session')).json();
  const headers = { 'X-Dali-Account': member.accountId, 'X-Dali-Request': '1', Origin: baseURL! };
  const operationId = randomUUID();
  const create = (operation = operationId) => context.request.post('/api/boards', { headers, data: { title: 'Independent synthetic boards', operationId: operation, ownerId: 'forged-owner', grants: [{ memberId: 'forged-member', role: 'editor' }] } });
  const first = await create();
  expect(first.status(), 'authenticated private creation succeeds').toBe(201);
  const a = await first.json();
  expect(a.summary).toMatchObject({ title: 'Independent synthetic boards', role: 'owner', access: 'private', pendingCount: 0, accountId: member.accountId });
  expect(await (await create()).json()).toEqual(a);
  const second = await create(randomUUID()); expect(second.status()).toBe(201);
  const b = await second.json();
  expect(new Set([a.summary.id, a.rootDocId, a.contentDocId, b.summary.id, b.rootDocId, b.contentDocId]).size).toBe(6);
  expect(await (await context.request.get(`/api/operations/${operationId}`, { headers })).json()).toMatchObject({ status: 'completed', result: a });
  const before = await (await context.request.get('/api/boards', { headers })).json();
  const denied = await context.request.get('/api/boards/absent-target', { headers });
  expect(denied.status()).toBe(404); expect(await denied.json()).toEqual({ code: 'BOARD_UNAVAILABLE' });
  expect(await (await context.request.get('/api/boards', { headers })).json()).toEqual(before);
});
