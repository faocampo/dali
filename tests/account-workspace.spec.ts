import { randomUUID } from 'node:crypto';
import { readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import type { BrowserContext, Page } from '@playwright/test';
import { test, expect } from './fixtures';

async function signIn(page: Page, identity: 'Owner' | 'Editor' | 'Viewer') {
  await page.context().clearCookies({ name: 'dali_fixture_identity' });
  await page.goto('/auth/start'); await page.getByRole('link', { name: 'Synthetic ' + identity, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
}
async function createBoard(context: BrowserContext, baseURL: string) {
  const member = await (await context.request.get('/api/session')).json();
  const headers = { Origin: baseURL, 'X-Dali-Account': member.accountId, 'X-Dali-Request': '1' };
  const response = await context.request.post('/api/boards', { headers, data: { title: 'Synthetic native board', operationId: randomUUID() } });
  expect(response.status()).toBe(201);
  return { descriptor: await response.json(), accountId: member.accountId, headers };
}
/** Repository seeding lives only in the test process. Locate the harness-owned
 * temporary database by this test's freshly created unpredictable board ID. */
function seedViewer(boardId: string, accountId: string) {
  for (const name of readdirSync(tmpdir()).filter(name => name.startsWith('dali-access-'))) {
    const file = join(tmpdir(), name, 'app-0.sqlite'); if (!existsSync(file)) continue;
    const db = new Database(file, { fileMustExist: true });
    try {
      if (!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='boards'").get()) continue;
      if (!db.prepare('SELECT id FROM boards WHERE id=?').get(boardId)) continue;
      db.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?)').run(boardId, accountId, 'viewer'); return;
    } finally { db.close(); }
  }
  throw new Error('Synthetic board fixture database not found');
}

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

test('@03-05-02 images nested formatted collapsed maps history and native export survive reopen', async ({ page, context, baseURL }) => {
  await signIn(page, 'Owner'); const input = await createBoard(context, baseURL!);
  const result = await page.evaluate(async ({ descriptor, accountId }) => {
    const path = '/tests/account-workspace-harness.ts'; return (await import(/* @vite-ignore */ path)).nativeFeatures(descriptor, accountId);
  }, input);
  expect(result).toMatchObject({ snapshotEqual: true, mapEqual: true, imageEqual: true, canUndo: true, undo: true, redo: true });
  expect(result.exported.width).toBeGreaterThan(100); expect(result.exported.height).toBeGreaterThan(100); expect(result.exported.ink).toBeGreaterThan(1000);
  expect(result.exported.imageInk).toBeGreaterThan(100); expect(result.exported.png).toBe(true);
  const branch = result.map.find((node: { text: string }) => node.text === 'Formatted branch');
  expect(branch).toMatchObject({ fontSize: 28, fontWeight: '700', color: '#2468ab', collapsed: true });
  expect(result.map.find((node: { text: string }) => node.text === 'Hidden descendant').parent).toBe(branch.id);
  const siblings = result.map.filter((node: { parent?: string }) => node.parent === branch.parent);
  expect(siblings.map((node: { text: string }) => node.text)).toEqual(['Formatted branch', 'Ordered sibling']);
});

test('@03-05-02 viewer authoritative load navigation export reload and double disposal emit zero writes', async ({ page, context, browser, baseURL }) => {
  await signIn(page, 'Owner'); const input = await createBoard(context, baseURL!);
  await page.evaluate(async ({ descriptor, accountId }) => {
    const path = '/tests/account-workspace-harness.ts'; return (await import(/* @vite-ignore */ path)).nativeFeatures(descriptor, accountId);
  }, input);
  const read = async () => {
    const outputs = [];
    for (const id of [input.descriptor.rootDocId, input.descriptor.contentDocId]) {
      const response = await context.request.post(`/api/boards/${input.descriptor.summary.id}/docs/${id}/pull`, { headers: { ...input.headers, 'Content-Type': 'application/octet-stream' }, data: Buffer.from([0]) });
      expect(response.status()).toBe(200); outputs.push((await response.body()).toString('base64'));
    }
    outputs.push(await (await context.request.get(`/api/boards/${input.descriptor.summary.id}`, { headers: input.headers })).text());
    return outputs;
  };
  const viewer = await browser.newContext({ baseURL }); const tab = await viewer.newPage(); const errors: string[] = [];
  tab.on('pageerror', error => errors.push(error.message)); tab.on('console', message => { if (message.type() === 'error' && !message.text().includes('401 (Unauthorized)')) errors.push(message.text()); });
  try {
    await signIn(tab, 'Viewer'); const member = await (await viewer.request.get('/api/session')).json(); seedViewer(input.descriptor.summary.id, member.accountId);
    const descriptor = await (await viewer.request.get('/api/boards/' + input.descriptor.summary.id, { headers: { 'X-Dali-Account': member.accountId } })).json();
    expect(descriptor.summary.role).toBe('viewer');
    let writes = 0; tab.on('request', request => { if (request.url().endsWith('/push') || ['PUT', 'DELETE'].includes(request.method())) writes++; });
    const before = await read();
    for (let i = 0; i < 2; i++) {
      const result = await tab.evaluate(async ({ descriptor, accountId }) => {
        const path = '/tests/account-workspace-harness.ts'; return (await import(/* @vite-ignore */ path)).viewerConformance(descriptor, accountId);
      }, { descriptor, accountId: member.accountId });
      expect(result).toMatchObject({ readonly: true, writes: 0, mutations: [], unchanged: true, localMutations: 0 }); expect(result.width).toBeGreaterThan(100);
      await tab.reload(); await expect(tab.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
    }
    expect(writes).toBe(0); expect(await read()).toEqual(before); expect(errors).toEqual([]);
  } finally { await viewer.close(); }
});

test('@03-05-02 failed opens retry late responses abort and injected foreign subdocs cannot expose a runtime', async ({ page, context, baseURL }) => {
  await signIn(page, 'Owner'); const input = await createBoard(context, baseURL!);
  const result = await page.evaluate(async ({ descriptor, accountId }) => {
    const path = '/tests/account-workspace-harness.ts'; return (await import(/* @vite-ignore */ path)).lifecycleConformance(descriptor, accountId);
  }, input);
  expect(result).toEqual({ failed: true, retry: true, lateRejected: true, foreignRootRejected: true, foreignContentRejected: true, staleRejected: true, disposalWrites: 0 });
});

test('@03-05-02 two signed identities repeatedly alternate without foreign document or cached text fallback', async ({ page, context, baseURL }) => {
  const scopes = [];
  for (const identity of ['Owner', 'Editor'] as const) {
    await signIn(page, identity); const input = await createBoard(context, baseURL!); scopes.push({ ...input, identity, canary: identity + '-' + randomUUID() });
    await page.evaluate(async input => {
      const path = '/tests/account-workspace-harness.ts'; return (await import(/* @vite-ignore */ path)).canary(input.descriptor, input.accountId, input.canary);
    }, scopes.at(-1)!);
  }
  for (let i = 0; i < 4; i++) {
    const selected = scopes[i % 2]!; const other = scopes[(i + 1) % 2]!;
    await signIn(page, selected.identity);
    const result = await page.evaluate(async input => {
      const path = '/tests/account-workspace-harness.ts'; return (await import(/* @vite-ignore */ path)).canary(input.descriptor, input.accountId);
    }, selected);
    expect(result.snapshot).toContain(selected.canary); expect(result.snapshot).not.toContain(other.canary);
    expect(result.docIds).toEqual([selected.descriptor.contentDocId]); expect(result.disposedRejected).toBe(true);
    const foreign = await context.request.get('/api/boards/' + other.descriptor.summary.id, { headers: { 'X-Dali-Account': selected.accountId } }); expect(foreign.status()).toBe(404);
  }
});
