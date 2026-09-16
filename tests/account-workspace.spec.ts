import { randomUUID } from 'node:crypto';
import { test, expect } from './fixtures';

test.use({ expectErrors: ['Failed to load resource: the server responded with a status of 401 (Unauthorized)'] });

test('@03-05-02 destination staging reserves one content document without changing its source', async ({ page, context, baseURL }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Synthetic Owner', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
  const member = await (await context.request.get('/api/session')).json();
  const create = async () => (await (await context.request.post('/api/boards', {
    headers: { Origin: baseURL!, 'X-Dali-Account': member.accountId, 'X-Dali-Request': '1' },
    data: { title: 'Synthetic staging conformance', operationId: randomUUID() },
  })).json());
  const source = await create(); const destination = await create();
  const staging = await page.evaluate(async () => {
    const path = '/src/canvas/account/board-workspace.ts';
    return typeof (await import(/* @vite-ignore */ path)).createStagingWorkspace;
  });
  expect(staging, 'native destination staging is available for isolated snapshot transformation').toBe('function');
  const result = await page.evaluate(async ({ source, destination, accountId }) => {
    const path = '/tests/account-workspace-harness.ts';
    return (await import(/* @vite-ignore */ path)).stagingConformance(source, destination, accountId);
  }, { source, destination, accountId: member.accountId });
  expect(result).toMatchObject({ sourceUnchanged: true, imageUnchanged: true, destinationId: destination.contentDocId, destinationCount: 1, isolated: true });
});

test('@03-05-01 authorized native workspace edits survive disposal and fresh reopen', async ({ page, context, baseURL }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Synthetic Owner', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
  const member = await (await context.request.get('/api/session')).json();
  const response = await context.request.post('/api/boards', {
    headers: { Origin: baseURL!, 'X-Dali-Account': member.accountId, 'X-Dali-Request': '1' },
    data: { title: 'Native conformance board', operationId: randomUUID() },
  });
  expect(response.status()).toBe(201);
  const descriptor = await response.json();
  const module = await context.request.get('/src/canvas/account/board-workspace.ts');
  expect(await module.text(), 'authorized workspace contract is available for native server round-trip').toContain('createAccountWorkspace');
  const result = await page.evaluate(async ({ descriptor, accountId }) => {
    const path = '/tests/account-workspace-harness.ts';
    const harness = await import(/* @vite-ignore */ path);
    return harness.roundTrip(descriptor, accountId);
  }, { descriptor, accountId: member.accountId });
  expect(result).toMatchObject({ text: 'Account text canary', shape: 'rect', metadataCount: 1, foreignRejected: true, rootCount: 1, surfaceCount: 1 });
  expect(result.acknowledged).toBeGreaterThan(0);
});
