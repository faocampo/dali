import { randomUUID } from 'node:crypto';
import { test, expect } from './fixtures';
import { acceptanceService, createIdentityContexts } from './access-fixtures';
import { seedCollaborationShapes, moveNativeShape, shapeBounds } from './collaboration-fixtures';
import { journalRows, failRecoveryStorage, restoreRecoveryStorage } from './recovery-fixtures';
import { readRecoveryEpoch } from '../server/storage/recovery-state';
import { editBoardTitle } from './app-menu';

for (const scenario of ['disjoint', 'legacy', 'own-receipt', 'active', 'active-unchanged', 'active-replay-receipt', 'active-replay-quota', 'active-check-race', 'active-commit-race', 'unchanged', 'restored'] as const) test(`@05-05-${['active', 'active-unchanged', 'active-replay-receipt', 'active-replay-quota', 'active-check-race', 'active-commit-race', 'unchanged', 'restored'].includes(scenario) ? '02' : '01'} ${scenario} pending work opens an isolated version choice before server hydration or replay`, async ({ browser, browserName, baseURL }, testInfo) => {
  const service = await acceptanceService(baseURL!); const identities = await createIdentityContexts(browser, service.origin);
  let failure: unknown; let release: (() => void) | undefined; let breakPoll: (() => void) | undefined;
  try {
    const creatorContext = identities.contexts.owner;
    const ownerContext = scenario === 'restored' ? identities.contexts.editor : identities.contexts.owner;
    const editorContext = scenario === 'restored' ? identities.contexts.owner : identities.contexts.editor;
    const ownerAccount = (await (await ownerContext.request.get('/api/session')).json()).accountId;
    const editorAccount = (await (await editorContext.request.get('/api/session')).json()).accountId;
    const creatorAccount = scenario === 'restored' ? editorAccount : ownerAccount;
    const created = await creatorContext.request.post('/api/boards', {
      headers: { Origin: service.origin, 'X-Dali-Request': '1', 'X-Dali-Account': creatorAccount, 'X-Dali-Recovery-Epoch': readRecoveryEpoch(service.database) },
      data: { operationId: randomUUID(), title: 'Synthetic separate recovery versions' },
    });
    expect(created.status()).toBe(201); const board = (await created.json()).summary.id as string;
    service.database.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?)').run(board, scenario === 'restored' ? ownerAccount : editorAccount, 'editor');
    const owner = ownerContext.pages()[0]!; const editor = editorContext.pages()[0]!;
    const [shape, second] = await seedCollaborationShapes(owner, service.database, board);
    if (scenario === 'own-receipt') {
      const interrupted = new Promise<void>(resolve => { breakPoll = resolve; });
      await owner.route('**/live/poll', async route => { await interrupted; await route.fulfill({ status: 200, contentType: 'application/json', body: '{' }); });
    }
    for (const page of [owner, editor]) { await page.goto(`/?board=${board}`); await expect(page.locator('affine-edgeless-root')).toBeVisible(); }
    const original = await shapeBounds(owner, shape!); const otherOriginal = await shapeBounds(owner, second!);
    let attempted!: () => void; const attempt = new Promise<void>(resolve => { attempted = resolve; });
    const held = new Promise<void>(resolve => { release = resolve; });
    await owner.route('**/docs/*/push', async route => {
      if (scenario === 'own-receipt') expect((await route.fetch()).status()).toBe(200);
      attempted(); await held;
      // Incomplete success response keeps the exact attempted operation uncertain
      // without a fabricated browser console error or committing its bytes.
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{' });
    });
    await moveNativeShape(owner, shape!, 70); await attempt;
    const moved = await shapeBounds(owner, shape!); expect(moved).not.toBe(original);
    let interrupted = false;
    await owner.route('**/live/poll', async route => {
      if (interrupted) { await route.continue(); return; }
      interrupted = true; await route.fulfill({ status: 200, contentType: 'application/json', body: '{' });
    });
    await editor.mouse.move(310, 360);
    breakPoll?.();
    await expect(owner.getByRole('button', { name: 'Reconnect', exact: true })).toBeVisible({ timeout: 30000 });
    release!();
    await expect.poll(async () => (await journalRows(owner)).length).toBeGreaterThan(0);
    const retained = await journalRows(owner);
    if (!scenario.startsWith('active')) {
      const left = service.acknowledgedDisconnects(ownerAccount);
      owner.once('dialog', dialog => dialog.accept()); await owner.goto('/');
      await expect.poll(() => service.acknowledgedDisconnects(ownerAccount)).toBeGreaterThan(left);
    }
    await owner.unroute('**/docs/*/push'); await owner.unroute('**/live/poll');
    if (scenario === 'legacy') await owner.evaluate(() => new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('dali-account-recovery-v1', 2); open.onerror = () => reject(open.error);
      open.onsuccess = () => { const db = open.result; const tx = db.transaction('checkpoints', 'readwrite'); const store = tx.objectStore('checkpoints'); const all = store.getAll();
        all.onsuccess = () => { for (const row of all.result) { delete row.shared; store.put(row); } };
        tx.oncomplete = () => { db.close(); resolve(); }; tx.onabort = () => reject(tx.error);
      };
    }));
    if (!['unchanged', 'restored', 'active-unchanged', 'active-replay-receipt', 'active-replay-quota', 'active-check-race', 'active-commit-race'].includes(scenario)) {
      const released = editor.waitForResponse(response => response.url().endsWith('/live/release') && response.ok());
      await moveNativeShape(editor, second!, 45); await released;
    }
    let remote = await shapeBounds(editor, second!);
    expect(remote === otherOriginal).toBe(['unchanged', 'restored', 'active-unchanged', 'active-replay-receipt', 'active-replay-quota', 'active-check-race', 'active-commit-race'].includes(scenario));
    if (scenario === 'restored') {
      service.database.prepare("UPDATE board_grants SET role='viewer',revision=revision+1 WHERE board_id=? AND member_id=?").run(board, ownerAccount);
      await owner.goto(`/?board=${board}`); await expect(owner.locator('editor-host')).toBeVisible();
      await expect(owner.getByRole('button', { name: 'Your access has changed, Open save details', exact: true })).toBeVisible();
      expect(await shapeBounds(owner, shape!)).toBe(original);
      await owner.goto('/');
      service.database.prepare("UPDATE board_grants SET role='editor',revision=revision+1 WHERE board_id=? AND member_id=?").run(board, ownerAccount);
    }
    if (scenario === 'legacy') await owner.setViewportSize({ width: 390, height: 740 });
    const replayed: string[] = [];
    owner.on('request', request => { if (/\/docs\/[^/]+\/push$/.test(new URL(request.url()).pathname)) replayed.push(request.url()); });
    let lostReplay = false;
    if (scenario === 'active-replay-receipt' || scenario === 'active-replay-quota') await owner.route('**/docs/*/push', async route => {
      if (lostReplay) { await route.continue(); return; }
      lostReplay = true; const response = await route.fetch(); expect(response.ok()).toBe(true);
      if (scenario === 'active-replay-quota') { await failRecoveryStorage(owner, 'quota'); await route.fulfill({ response }); }
      else await route.fulfill({ response, body: '{' });
    });
    let rejectedReplay: { status: number; code: string } | undefined;
    if (scenario === 'active-check-race' || scenario === 'active-commit-race') {
      let raced = false;
      await owner.route(scenario === 'active-check-race' ? '**/recovery/baseline' : '**/docs/*/push', async route => {
        if (raced) { await route.continue(); return; } raced = true;
        const comparison = scenario === 'active-check-race' ? await route.fetch() : undefined;
        const released = editor.waitForResponse(response => response.url().endsWith('/live/release') && response.ok());
        await moveNativeShape(editor, second!, 45); await released;
        remote = await shapeBounds(editor, second!); expect(remote).not.toBe(otherOriginal);
        const result = comparison ?? await route.fetch();
        if (scenario === 'active-commit-race') rejectedReplay = { status: result.status(), code: (await result.json()).code };
        await route.fulfill({ response: result });
      });
    }
    const comparison = owner.waitForResponse(response => response.url().endsWith('/recovery/baseline') && response.ok(), { timeout: 20000 });
    if (scenario.startsWith('active')) await owner.getByRole('button', { name: 'Reconnect', exact: true }).click();
    else await owner.goto(`/?board=${board}`);
    const comparisonResult = await (await comparison).json();
    if (scenario === 'own-receipt') expect(comparisonResult.receipts.length).toBeGreaterThan(0);
    await expect(owner.locator('editor-host')).toBeVisible();
    if (scenario === 'active-replay-quota') {
      await expect(owner.getByRole('button', { name: 'Editing paused, Open save details', exact: true })).toBeVisible();
      await expect.poll(() => shapeBounds(editor, shape!)).toBe(moved);
      expect(await journalRows(owner)).toEqual(expect.arrayContaining(retained));
      expect(replayed).toHaveLength(1);
      await restoreRecoveryStorage(owner);
      await owner.getByRole('button', { name: 'Editing paused, Open save details', exact: true }).click();
      await owner.getByRole('button', { name: 'Retry saving', exact: true }).click();
      await expect(owner.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
      await owner.keyboard.press('Escape');
    }
    if (scenario === 'unchanged' || scenario === 'active-unchanged' || scenario === 'active-replay-receipt' || scenario === 'active-replay-quota') {
      await expect(owner.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
      expect(await shapeBounds(owner, shape!)).toBe(moved);
      await expect.poll(() => shapeBounds(editor, shape!)).toBe(moved);
      // Reconnecting DocEngine may still acknowledge an idempotent root send
      // after the visible content is covered. Wait for that durable cleanup.
      await expect.poll(() => journalRows(owner)).toEqual([]);
      if (scenario === 'unchanged') {
        await expect(owner.getByRole('button', { name: 'People on this board: 2', exact: true })).toBeVisible();
        const released = owner.waitForResponse(response => response.url().endsWith('/live/release') && response.ok());
        await moveNativeShape(owner, second!, 25); await released;
        await expect.poll(() => shapeBounds(editor, second!)).toBe('[425,40,160,120]');
        await owner.reload(); expect(await shapeBounds(owner, shape!)).toBe(moved); expect(await shapeBounds(owner, second!)).toBe('[425,40,160,120]');
      }
      if (scenario === 'active-replay-receipt' || scenario === 'active-replay-quota') {
        expect(lostReplay).toBe(true); expect(replayed).toHaveLength(1);
        await owner.unroute('**/docs/*/push'); await owner.getByRole('button', { name: 'Reconnect', exact: true }).click();
      }
      if (scenario.startsWith('active')) {
        await expect(owner.getByRole('button', { name: 'Reconnect', exact: true })).toHaveCount(0);
        await owner.getByRole('button', { name: 'Undo', exact: true }).click();
        for (const page of [owner, editor]) await expect.poll(() => shapeBounds(page, shape!)).toBe(original);
        await owner.getByRole('button', { name: 'Redo', exact: true }).click();
        for (const page of [owner, editor]) await expect.poll(() => shapeBounds(page, shape!)).toBe(moved);
        const released = owner.waitForResponse(response => response.url().endsWith('/live/release') && response.ok());
        await moveNativeShape(owner, second!, 25); await released;
        const next = await shapeBounds(owner, second!); await expect.poll(() => shapeBounds(editor, second!)).toBe(next);
        await expect(owner.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
        await owner.reload(); expect(await shapeBounds(owner, shape!)).toBe(moved); expect(await shapeBounds(owner, second!)).toBe(next);
      }
      expect(identities.runtimeErrors).toEqual([]);
      return;
    }
    if (scenario === 'restored') {
      const restored = owner.getByRole('dialog', { name: 'Editing access restored', exact: true });
      await expect(restored).toBeVisible(); expect(await shapeBounds(editor, shape!)).toBe(original); expect(replayed).toEqual([]);
      await restored.getByRole('button', { name: 'Restore pending edits', exact: true }).click();
      await expect(restored).toHaveCount(0);
      await expect(owner.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
      await expect.poll(() => shapeBounds(editor, shape!)).toBe(moved); expect(await journalRows(owner)).toEqual([]);
      expect(identities.runtimeErrors).toEqual([]); return;
    }
    // The first oracle is the actual native local candidate, before the new
    // decision UI: reopening must not hydrate remote bytes over its meaning.
    expect(await shapeBounds(owner, shape!)).toBe(moved);
    expect(await shapeBounds(owner, second!)).toBe(otherOriginal);
    const title = scenario === 'legacy' ? 'Choose a version to recover' : 'This board changed while you were away';
    const decision = owner.getByRole('dialog', { name: title, exact: true });
    await expect(decision).toBeVisible();
    await expect(decision.getByRole('heading', { name: title, exact: true })).toBeFocused();
    const geometry = await decision.evaluate(el => ({ width: el.getBoundingClientRect().width, viewport: innerWidth, scroll: el.scrollWidth, client: el.clientWidth }));
    expect(geometry.width).toBeLessThanOrEqual(geometry.viewport - 32); expect(geometry.scroll).toBeLessThanOrEqual(geometry.client);
    if (scenario === 'legacy') await testInfo.attach('isolated-local-version-narrow', { body: await owner.screenshot(), contentType: 'image/png' });
    expect(await shapeBounds(owner, shape!)).toBe(moved);
    expect(await shapeBounds(owner, second!)).toBe(otherOriginal);
    expect(await shapeBounds(editor, shape!)).toBe(scenario === 'own-receipt' ? moved : original);
    expect(await shapeBounds(editor, second!)).toBe(remote);
    expect(replayed).toHaveLength(scenario === 'active-commit-race' ? 1 : 0);
    if (scenario === 'active-commit-race') expect(rejectedReplay).toEqual({ status: 409, code: 'RECOVERY_DIVERGED' });
    expect(await journalRows(owner)).toEqual(expect.arrayContaining(retained));
    await decision.getByRole('button', { name: 'Decide later', exact: true }).click();
    await expect(decision).toHaveCount(0);
    await expect(owner.getByRole('button', { name: 'Saved, Open save details', exact: true })).toHaveCount(0);
    await owner.getByRole('button', { name: 'Review pending changes', exact: true }).click();
    await expect(decision).toBeVisible(); await owner.keyboard.press('Escape'); await expect(decision).toHaveCount(0);
    await expect(owner.getByRole('button', { name: 'Review pending changes', exact: true })).toBeFocused();
    expect(replayed).toHaveLength(scenario === 'active-commit-race' ? 1 : 0);
    expect(identities.runtimeErrors).toEqual(scenario === 'active-commit-race' && browserName !== 'firefox' ? ['owner: Failed to load resource: the server responded with a status of 409 (Conflict)'] : []);
    identities.runtimeErrors.length = 0;
  } catch (error) { failure = error; throw error; }
  finally { release?.(); breakPoll?.(); try { await identities.close(); } catch (error) { if (!failure) throw error; } finally { await service.close(); } }
});

for (const scenario of ['unchanged-title', 'acknowledged-title', 'foreign-title'] as const) test(`@05-05-02 ${scenario} uses exact rename proof without adopting a later foreign name`, async ({ browser, baseURL }) => {
  const service = await acceptanceService(baseURL!); const identities = await createIdentityContexts(browser, service.origin);
  let release = () => {}; let interrupt = () => {}; let failure: unknown;
  try {
    const context = identities.contexts.owner; const owner = context.pages()[0]!; const editor = identities.contexts.editor.pages()[0]!;
    const accountId = (await (await context.request.get('/api/session')).json()).accountId;
    const editorId = (await (await identities.contexts.editor.request.get('/api/session')).json()).accountId;
    const created = await context.request.post('/api/boards', { headers: { Origin: service.origin, 'X-Dali-Account': accountId, 'X-Dali-Request': '1', 'X-Dali-Recovery-Epoch': readRecoveryEpoch(service.database) }, data: { operationId: randomUUID(), title: 'Original title' } });
    expect(created.status()).toBe(201); const board = (await created.json()).summary.id as string;
    service.database.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?)').run(board, editorId, 'editor');
    await seedCollaborationShapes(owner, service.database, board);
    const poll = new Promise<void>(resolve => { interrupt = resolve; });
    await owner.route('**/live/poll', async route => { await poll; await route.fulfill({ status: 200, contentType: 'application/json', body: '{' }); });
    for (const page of [owner, editor]) { await page.goto(`/?board=${board}`); await expect(page.locator('affine-edgeless-root')).toBeVisible(); }
    let attempted!: () => void; const started = new Promise<void>(resolve => { attempted = resolve; });
    const held = new Promise<void>(resolve => { release = resolve; });
    await owner.route(`**/api/boards/${board}`, async route => {
      if (route.request().method() !== 'PATCH') { await route.continue(); return; }
      if (scenario !== 'unchanged-title') expect((await route.fetch()).status()).toBe(200);
      attempted(); await held; await route.fulfill({ status: 200, contentType: 'application/json', body: '{' });
    });
    const input = await editBoardTitle(owner); await input.fill('Local pending name'); await input.press('Enter'); await started;
    interrupt(); await expect(owner.getByRole('button', { name: 'Reconnect', exact: true })).toBeVisible(); release();
    const titleRows = () => owner.evaluate(boardId => new Promise<Array<{ operationId: string; title: string }>>((resolve, reject) => {
      const open = indexedDB.open('dali-account-recovery-v1', 2); open.onerror = () => reject(open.error);
      open.onsuccess = () => { const db = open.result; const tx = db.transaction('sequences'); const request = tx.objectStore('sequences').getAll();
        request.onsuccess = () => resolve(request.result.filter(row => row.id.startsWith('title:') && row.boardId === boardId));
        tx.oncomplete = () => db.close(); tx.onabort = () => reject(tx.error);
      };
    }), board);
    await expect.poll(async () => (await titleRows()).length).toBe(1);
    const left = service.acknowledgedDisconnects(accountId); owner.once('dialog', dialog => dialog.accept()); await owner.goto('/');
    await expect.poll(() => service.acknowledgedDisconnects(accountId)).toBeGreaterThan(left);
    await owner.unroute(`**/api/boards/${board}`); await owner.unroute('**/live/poll');
    if (scenario === 'foreign-title') {
      await expect(editor.getByRole('button', { name: /^Rename board:/ })).toHaveText('Local pending name');
      const remote = await editBoardTitle(editor); await remote.fill('Later foreign name'); await remote.press('Enter');
      await expect(editor.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
    }
    const patches: string[] = []; owner.on('request', request => { if (request.method() === 'PATCH') patches.push(request.url()); });
    const comparison = owner.waitForResponse(response => response.url().endsWith('/recovery/baseline') && response.ok());
    await owner.goto(`/?board=${board}`); const inspected = await (await comparison).json();
    if (scenario !== 'unchanged-title') expect(inspected.titleReceipt).toMatchObject({ title: 'Local pending name' });
    if (scenario === 'foreign-title') {
      await expect(owner.getByRole('dialog', { name: 'This board changed while you were away', exact: true })).toBeVisible();
      await expect(owner.getByRole('button', { name: /^Rename board:/ })).toHaveText('Local pending name');
      expect(service.database.prepare('SELECT title FROM boards WHERE id=?').get(board)).toEqual({ title: 'Later foreign name' });
      expect(patches).toEqual([]); expect(await titleRows()).toHaveLength(1);
    } else {
      await expect(owner.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
      expect(await titleRows()).toEqual([]); expect(patches.length).toBe(scenario === 'unchanged-title' ? 1 : 0);
      for (const page of [owner, editor]) await expect(page.getByRole('button', { name: /^Rename board:/ })).toHaveText('Local pending name');
      await owner.reload(); await expect(owner.getByRole('button', { name: /^Rename board:/ })).toHaveText('Local pending name');
    }
    expect(identities.runtimeErrors).toEqual([]);
  } catch (error) { failure = error; throw error; }
  finally { release(); interrupt(); try { await identities.close(); } catch (error) { if (!failure) throw error; } finally { await service.close(); } }
});
