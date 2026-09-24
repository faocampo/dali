import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium, expect } from '@playwright/test';

const bind = async (port = 0) => {
  const server = createServer(); server.listen({ host: '127.0.0.1', port }); await once(server, 'listening'); return server;
};
const closeServer = server => new Promise(resolve => server.close(resolve));
async function settings() {
  const directory = await mkdtemp(join(tmpdir(), 'dali-dev-regression-'));
  const reservations = await Promise.all([bind(), bind(), bind()]);
  const [ui, api, oidc] = reservations.map(server => server.address().port);
  await Promise.all(reservations.map(closeServer));
  return { directory, ports: [ui, api, oidc], origin: `http://127.0.0.1:${ui}`, env: {
    DALI_DEV_UI_PORT: String(ui), DALI_DEV_API_PORT: String(api), DALI_DEV_OIDC_PORT: String(oidc), DALI_DEV_STATE_DIR: directory,
  } };
}
function launch(config, overrides = {}, args = []) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('DALI_') && key !== 'NODE_ENV'));
  const child = spawn('npm', ['run', 'dev', '--', ...args], { env: { ...env, ...config.env, ...overrides }, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { output += chunk; });
  const exited = once(child, 'exit');
  return { child, exited, output: () => output,
    async stop(signal = 'SIGINT') {
      if (child.exitCode !== null || child.signalCode !== null) return;
      process.kill(-child.pid, signal);
      try { await Promise.race([exited, delay(15_000, undefined, { ref: false }).then(() => { throw new Error('Development shutdown timed out'); })]); }
      finally { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }
    },
    async ready() {
      for (let attempt = 0; attempt < 900; attempt++) {
        if (output.includes('Dali local development ready:')) return;
        assert.equal(child.exitCode, null, 'Launcher exited before becoming ready: ' + output);
        await delay(100);
      }
      throw new Error('Development startup timed out');
    },
  };
}
async function portsFree(config) {
  for (const port of config.ports) { const server = await bind(port); await closeServer(server); }
}
async function expectFailure(run, pattern) {
  const [code] = await Promise.race([run.exited, delay(90_000, undefined, { ref: false }).then(() => { throw new Error('Expected startup rejection timed out'); })]);
  assert.notEqual(code, 0); assert.match(run.output(), pattern);
}
async function signIn(context, origin, identity = 'Owner') {
  const page = await context.newPage(); await page.goto(origin);
  await expect(page).toHaveTitle('Dali local development — synthetic sign-in');
  await expect(page.getByText('Local development only.', { exact: false })).toBeVisible();
  await page.getByRole('link', { name: `Synthetic ${identity}`, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible({ timeout: 60_000 });
  return page;
}

test('npm dev signs in, saves and reopens after restart, and preserves authorization boundaries', { timeout: 300_000 }, async () => {
  const config = await settings(); let run; let browser;
  const pageErrors = [];
  try {
    run = launch(config); await run.ready();
    assert.equal((await fetch(config.origin + '/api/session')).status, 401);
    assert.equal((await fetch(config.origin + '/auth/start', { redirect: 'manual' })).status, 302);
    const privateFile = await fetch(config.origin + `/@fs/${config.directory}/identity.json`);
    assert.equal(privateFile.status, 403);
    const identity = await readFile(join(config.directory, 'identity.json'), 'utf8');
    assert.equal((await stat(config.directory)).mode & 0o777, 0o700);
    assert.equal((await stat(join(config.directory, 'identity.json'))).mode & 0o777, 0o600);
    browser = await chromium.launch();
    const owner = await browser.newContext(); owner.on('page', p => p.on('pageerror', e => pageErrors.push(e.message)));
    const page = await signIn(owner, config.origin);
    const session = await (await owner.request.get(config.origin + '/api/session')).json();
    const headers = { Origin: config.origin, 'X-Dali-Request': '1', 'X-Dali-Account': session.accountId };
    const samples = await (await owner.request.get(config.origin + '/api/boards', { headers })).json();
    assert.equal(samples.length, 1); assert.equal(samples[0].title, 'Shared role test'); assert.equal(samples[0].role, 'owner');
    const sharedPath = config.origin + '/api/boards/' + samples[0].id;
    const sharedUrl = config.origin + '/?board=' + samples[0].id;
    await page.getByLabel('Board name', { exact: true }).fill('Synthetic restart board');
    await page.getByRole('button', { name: 'New board', exact: true }).click();
    await expect(page.locator('editor-host')).toBeVisible({ timeout: 60_000 });
    const boardUrl = page.url(); const boardId = new URL(boardUrl).searchParams.get('board'); assert.ok(boardId);
    await page.getByRole('button', { name: 'Add sticky note', exact: true }).click();
    await page.locator('affine-edgeless-note').dblclick(); await page.keyboard.insertText('Synthetic saved content'); await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
    const text = p => p.locator('editor-host').evaluate(el => el.std.store.getBlocksByFlavour('affine:paragraph').map(({ model }) => model.text?.toString()));
    await expect.poll(() => text(page)).toContain('Synthetic saved content');
    const wrongOrigin = await owner.request.post(config.origin + '/api/boards', { headers: { ...headers, Origin: 'https://foreign.example.org' }, data: { title: 'Rejected', operationId: randomUUID() } });
    assert.equal(wrongOrigin.status(), 403);
    const editor = await browser.newContext(); const editorPage = await signIn(editor, config.origin, 'Editor');
    const editorSession = await (await editor.request.get(config.origin + '/api/session')).json();
    const editorHeaders = { ...headers, 'X-Dali-Account': editorSession.accountId };
    const sharedEditor = await (await editor.request.get(sharedPath, { headers: editorHeaders })).json();
    assert.equal(sharedEditor.summary.role, 'editor'); assert.ok(sharedEditor.capabilities.includes('write'));
    await editorPage.getByRole('link', { name: 'Open Shared role test', exact: true }).click();
    await expect(editorPage.locator('.board-role')).toHaveText('Editor');
    await editorPage.getByRole('button', { name: 'Add sticky note', exact: true }).click();
    await editorPage.locator('affine-edgeless-note').dblclick(); await editorPage.keyboard.insertText('Shared role canary'); await editorPage.keyboard.press('Escape');
    await expect(editorPage.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
    const viewer = await browser.newContext(); const viewerPage = await signIn(viewer, config.origin, 'Viewer');
    await expect(viewerPage.getByRole('button', { name: 'New board', exact: true })).toHaveCount(0);
    await expect(viewerPage.locator('.board-library__import')).toHaveCount(0);
    const viewerSession = await (await viewer.request.get(config.origin + '/api/session')).json();
    const viewerHeaders = { ...headers, 'X-Dali-Account': viewerSession.accountId };
    const sharedViewer = await (await viewer.request.get(sharedPath, { headers: viewerHeaders })).json();
    assert.equal(sharedViewer.summary.role, 'viewer'); assert.ok(!sharedViewer.capabilities.includes('write'));
    await viewerPage.getByRole('link', { name: 'Open Shared role test', exact: true }).click();
    await expect(viewerPage.locator('.board-role')).toHaveText('Viewer · View only');
    await expect.poll(() => text(viewerPage)).toContain('Shared role canary');
    await expect(viewerPage.getByRole('button', { name: 'Add mind map', exact: true })).toHaveCount(0);
    assert.equal(await viewerPage.locator('editor-host').evaluate(el => el.store.readonly), true);
    const model = p => p.locator('editor-host').evaluate(el => JSON.stringify(el.store.spaceDoc.toJSON()));
    const before = await model(viewerPage);
    const stored = await (await owner.request.get(sharedPath + '/editable-export', { headers })).json();
    await viewerPage.locator('affine-edgeless-note').dblclick(); await viewerPage.keyboard.insertText('Denied edit');
    for (const key of ['Delete', 'Backspace', 'ControlOrMeta+z']) await viewerPage.keyboard.press(key);
    assert.equal(await model(viewerPage), before);
    const denied = await viewer.request.patch(sharedPath, { headers: viewerHeaders, data: { operationId: randomUUID(), revision: sharedViewer.revision, title: 'Denied rename' } });
    assert.equal(denied.status(), 403);
    const afterDenied = await (await owner.request.get(sharedPath + '/editable-export', { headers })).json();
    // The editor's asynchronous thumbnail upload may complete during this probe.
    for (const snapshot of [stored, afterDenied]) delete snapshot.descriptor.summary.thumbnailUrl;
    assert.deepEqual(afterDenied, stored);
    // System Viewers cannot create boards, even though other members can.
    const viewerOwned = await viewer.request.post(config.origin + '/api/boards', { headers: viewerHeaders, data: { operationId: randomUUID(), title: 'Viewer-owned board' } });
    assert.equal(viewerOwned.status(), 403); assert.equal(viewerSession.systemRole, 'viewer');
    await viewer.close();
    const boardPath = config.origin + '/api/boards/' + boardId;
    assert.equal((await editor.request.get(boardPath, { headers: editorHeaders })).status(), 404);
    // The sample must preserve edits and access changes when the development stack restarts.
    const sampleGrants = await (await owner.request.get(sharedPath + '/grants', { headers })).json();
    const editorGrant = sampleGrants.grants.find(grant => grant.memberId === editorSession.accountId);
    assert.ok(editorGrant);
    assert.equal((await owner.request.delete(sharedPath + '/grants/' + editorGrant.id, { headers, data: { operationId: randomUUID(), revision: editorGrant.revision } })).status(), 200);
    const grants = await (await owner.request.get(boardPath + '/grants', { headers })).json();
    const granted = await owner.request.post(boardPath + '/grants', { headers, data: { operationId: randomUUID(), revision: grants.revision, memberId: editorSession.accountId, role: 'editor' } });
    assert.equal(granted.status(), 200);
    assert.equal((await editor.request.get(boardPath, { headers: editorHeaders })).status(), 200);
    const grant = (await granted.json()).grants[0];
    assert.equal((await owner.request.delete(boardPath + '/grants/' + grant.id, { headers, data: { operationId: randomUUID(), revision: grant.revision } })).status(), 200);
    assert.equal((await editor.request.get(boardPath, { headers: editorHeaders })).status(), 404);
    const savedCookies = await owner.cookies();
    await owner.close(); await editor.close();
    await run.stop(); await portsFree(config);
    run = launch(config); await run.ready();
    assert.equal(await readFile(join(config.directory, 'identity.json'), 'utf8'), identity);
    const retained = await browser.newContext(); await retained.addCookies(savedCookies);
    assert.deepEqual(await (await retained.request.get(config.origin + '/api/session')).json(), session);
    const clean = await browser.newContext(); clean.on('page', p => p.on('pageerror', e => pageErrors.push(e.message)));
    const reopened = await signIn(clean, config.origin);
    const again = await (await clean.request.get(config.origin + '/api/session')).json(); assert.equal(again.accountId, session.accountId);
    const restartedBoards = await (await clean.request.get(config.origin + '/api/boards', { headers })).json();
    assert.equal(restartedBoards.filter(board => board.id === samples[0].id).length, 1);
    assert.deepEqual((await (await clean.request.get(sharedPath + '/grants', { headers })).json()).grants.map(grant => grant.role), ['viewer']);
    await reopened.goto(sharedUrl); await expect.poll(() => text(reopened)).toContain('Shared role canary');
    await reopened.goto(config.origin);
    await reopened.getByRole('link', { name: 'Open Synthetic restart board', exact: true }).click();
    await expect.poll(() => text(reopened)).toContain('Synthetic saved content');
    await reopened.goto(config.origin); await reopened.locator('.board-account summary').click();
    await reopened.getByRole('button', { name: 'Sign out of Dalí', exact: true }).click();
    await expect(reopened.getByRole('heading', { name: "You're signed out of Dalí" })).toBeVisible();
    await reopened.reload(); await expect(reopened.getByRole('button', { name: 'Sign in again' })).toBeVisible();
    assert.equal((await clean.request.get(config.origin + '/api/session')).status(), 401);
    await clean.close(); await retained.close();
    assert.deepEqual(pageErrors, []);
    await run.stop('SIGTERM'); await portsFree(config);
  } finally { await browser?.close(); await run?.stop(); await rm(config.directory, { recursive: true, force: true }); }
});

test('occupied UI, API and provider ports reject startup and preserve existing listeners', { timeout: 180_000 }, async () => {
  const config = await settings();
  try {
    for (const port of config.ports) {
      const occupied = await bind(port); const run = launch(config);
      try { await expectFailure(run, new RegExp(`port ${port} is unavailable`)); assert.equal(occupied.listening, true); }
      finally { await run.stop(); await closeServer(occupied); }
      await portsFree(config);
    }
  } finally { await rm(config.directory, { recursive: true, force: true }); }
});

test('production mode, non-loopback host, corrupt state and changed identity origins fail closed', { timeout: 180_000 }, async () => {
  const config = await settings(); let run;
  try {
    for (const [env, args, pattern] of [[{ NODE_ENV: 'production' }, [], /non-production/], [{}, ['--host', '0.0.0.0'], /127.0.0.1/]]) {
      run = launch(config, env, args); await expectFailure(run, pattern); await portsFree(config);
    }
    await writeFile(join(config.directory, 'identity.json'), '{invalid');
    run = launch(config); await expectFailure(run, /identity state is invalid/); await portsFree(config);
    assert.equal(await readFile(join(config.directory, 'identity.json'), 'utf8'), '{invalid');
    await writeFile(join(config.directory, 'identity.json'), JSON.stringify({ version: 1, origin: config.origin, issuer: 'http://127.0.0.1:1', sessionSecret: 'a'.repeat(43) }));
    run = launch(config); await expectFailure(run, /ports differ from the saved identity origin/); await portsFree(config);
  } finally { await run?.stop(); await rm(config.directory, { recursive: true, force: true }); }
});

test('compiler child termination leaves no listeners', { timeout: 60_000, skip: process.platform === 'win32' }, async () => {
  const config = await settings(); const run = launch(config);
  try {
    let compiler;
    for (let attempt = 0; attempt < 100 && !compiler; attempt++) {
      const rows = execFileSync('ps', ['-eo', 'pid=,pgid=,args='], { encoding: 'utf8' }).split('\n');
      const row = rows.find(value => value.trim().split(/\s+/)[1] === String(run.child.pid) && value.includes('node_modules/typescript/bin/tsc'));
      if (row) compiler = Number(row.trim().split(/\s+/)[0]); else await delay(20);
    }
    assert.ok(compiler, 'Expected an actual compiler child'); process.kill(compiler, 'SIGKILL');
    await expectFailure(run, /compilation failed/); await portsFree(config);
  } finally { await run.stop(); await rm(config.directory, { recursive: true, force: true }); }
});
