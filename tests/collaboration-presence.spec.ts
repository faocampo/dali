import { randomUUID } from 'node:crypto';
import { test, expect } from './fixtures';
import { acceptanceService, createIdentityContexts } from './access-fixtures';
import { seedCollaborationShapes } from './collaboration-fixtures';
import { readRecoveryEpoch } from '../server/storage/recovery-state';

for (const scenario of ['tracer', 'tabs', 'layout', 'idle', 'failure', 'many', 'loading', 'partial'] as const) test(`${scenario === 'tracer' ? '@05-03-01' : '@05-03-02'} participant presence: ${scenario}`, async ({ browser, baseURL }) => {
  const service = await acceptanceService(baseURL!);
  const identities = await createIdentityContexts(browser, service.origin);
  let failure: unknown;
  let releaseConnect = () => {};
  const extraContexts: import('@playwright/test').BrowserContext[] = [];
  try {
    const accounts = Object.fromEntries(await Promise.all(['owner', 'editor', 'viewer'].map(async role => {
      const context = identities.contexts[role as 'owner' | 'editor' | 'viewer'];
      return [role, (await (await context.request.get('/api/session')).json()).accountId];
    })));
    const response = await identities.contexts.owner.request.post('/api/boards', {
      headers: { Origin: service.origin, 'X-Dali-Request': '1', 'X-Dali-Account': accounts.owner, 'X-Dali-Recovery-Epoch': readRecoveryEpoch(service.database) },
      data: { operationId: randomUUID(), title: 'Synthetic presence board' },
    });
    expect(response.status()).toBe(201); const board = await response.json();
    for (const role of ['editor', 'viewer']) service.database.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?)').run(board.summary.id, accounts[role], role);
    const owner = identities.contexts.owner.pages()[0]!;
    const editor = identities.contexts.editor.pages()[0]!;
    const viewer = identities.contexts.viewer.pages()[0]!;
    await seedCollaborationShapes(owner, service.database, board.summary.id);
    if (scenario === 'loading') {
      const gate = new Promise<void>(resolve => { releaseConnect = resolve; });
      await owner.route('**/live/poll', async route => { await gate; await route.continue(); });
    }
    for (const page of [owner, editor, viewer]) {
      await page.goto(`/?board=${board.summary.id}`);
      if (scenario === 'loading' && page === owner) {
        await expect(owner.getByRole('button', { name: 'People loading', exact: true })).toBeVisible();
        await owner.getByRole('button', { name: 'People loading', exact: true }).click();
        await expect(owner.getByRole('dialog', { name: 'People on this board', exact: true })).toContainText('People loading');
        await owner.keyboard.press('Escape'); releaseConnect();
      }
      await expect(page.locator('affine-edgeless-root')).toBeVisible();
      if (page === owner) {
        await owner.getByRole('button', { name: 'People on this board: 1', exact: true }).click();
        await expect(owner.getByText('Only you are here.', { exact: true })).toBeVisible();
        await owner.keyboard.press('Escape');
      }
    }
    await owner.getByRole('button', { name: 'People on this board: 3', exact: true }).click();
    const roster = owner.getByRole('dialog', { name: 'People on this board', exact: true });
    await expect(roster).toContainText('Synthetic Editor');
    await expect(roster).toContainText('Synthetic Viewer');
    await expect(roster).toContainText('You');
    await owner.keyboard.press('Escape');
    await expect(owner.getByRole('button', { name: 'People on this board: 3', exact: true })).toBeFocused();
    const pointerPacket = editor.waitForRequest(request => request.url().endsWith('/live/presence') && request.postDataJSON()?.presence?.cursor != null);
    await editor.mouse.move(400, 350);
    const transmittedPoint = (await pointerPacket).postDataJSON().presence.cursor as { x: number; y: number };
    await expect(owner.locator('.participant-cursor').filter({ hasText: 'Synthetic Editor' })).toBeVisible();
    await viewer.mouse.move(420, 360);
    await expect(owner.locator('.participant-cursor').filter({ hasText: 'Synthetic Viewer' })).toHaveCount(0);
    await editor.locator('editor-host').focus(); await editor.keyboard.press('ControlOrMeta+a');
    await expect(owner.locator('.participant-selection')).toHaveCount(2);
    await expect(viewer.locator('.participant-selection')).toHaveCount(2);
    if (scenario === 'tracer') {
      // Use the point sent by the actual pointer event. Focusing the native
      // editor can subsequently scroll its viewport without moving the pointer.
      const modelPoint = [transmittedPoint.x, transmittedPoint.y];
      const cursor = owner.locator('.participant-cursor').filter({ hasText: 'Synthetic Editor' });
      const assertProjection = async () => {
        const expected = await owner.locator('affine-edgeless-root').evaluate((element, point) => {
          const gfx = (element as HTMLElement & { gfx: import('@blocksuite/affine/std/gfx').GfxController }).gfx;
          const [x, y] = gfx.viewport.toViewCoord(point[0]!, point[1]!);
          return [Math.round(x + gfx.viewport.left), Math.round(y + gfx.viewport.top)];
        }, modelPoint);
        await expect.poll(async () => { const box = await cursor.boundingBox(); return box && [Math.round(box.x), Math.round(box.y)]; }).toEqual(expected);
        await expect(owner.locator('.participant-overlays')).toHaveCSS('pointer-events', 'none');
      };
      await assertProjection();
      await owner.getByRole('button', { name: /^Zoom, current/ }).click();
      await owner.getByRole('menuitemradio', { name: '50%', exact: true }).click();
      await expect(owner.getByRole('button', { name: 'Zoom, current 50%', exact: true })).toBeVisible();
      await assertProjection();
      const before = await cursor.boundingBox();
      await owner.getByRole('button', { name: 'Hand', exact: true }).click();
      await owner.mouse.move(900, 550); await owner.mouse.down(); await owner.mouse.move(1000, 600, { steps: 8 }); await owner.mouse.up();
      await expect.poll(async () => Math.round((await cursor.boundingBox())!.x)).not.toBe(Math.round(before!.x));
      await assertProjection();
    }
    if (scenario === 'tabs') {
      const second = await identities.contexts.editor.newPage(); await second.goto(`/?board=${board.summary.id}`);
      await expect(second.locator('affine-edgeless-root')).toBeVisible();
      await second.mouse.move(500, 400);
      const cursor = owner.locator('.participant-cursor').filter({ hasText: 'Synthetic Editor' });
      await expect.poll(async () => Math.round((await cursor.boundingBox())!.x)).toBe(500);
      await expect(owner.getByRole('button', { name: 'People on this board: 3', exact: true })).toBeVisible();
      await editor.mouse.move(450, 380);
      await expect.poll(async () => Math.round((await cursor.boundingBox())!.x)).toBe(450);
      await second.close();
      await expect(owner.getByRole('button', { name: 'People on this board: 3', exact: true })).toBeVisible();
      await expect(cursor).toHaveCount(1);
    }
    if (scenario === 'layout') {
      const longName = 'Synthetic participant with a deliberately long display name '.repeat(4);
      service.database.prepare('UPDATE members SET display_name=? WHERE id=?').run(longName, accounts.editor);
      await owner.setViewportSize({ width: 390, height: 740 });
      await owner.getByRole('button', { name: 'People on this board: 3', exact: true }).click();
      await expect(roster).toContainText(longName.trim());
      const bounds = await roster.boundingBox(); expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
      expect(await roster.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
      await owner.screenshot({ path: '/tmp/dali-presence-narrow.png' });
      await owner.keyboard.press('Escape');
      await owner.setViewportSize({ width: 1280, height: 800 });
      await owner.getByRole('button', { name: 'People on this board: 3', exact: true }).click();
      await owner.mouse.click(350, 600); await expect(roster).toHaveCount(0);
      // Half-width CSS layout coverage; native browser-chrome zoom remains a manual acceptance judgment.
      await owner.setViewportSize({ width: 640, height: 400 });
      await owner.getByRole('button', { name: 'People on this board: 3', exact: true }).click({ timeout: 10000 });
      const compact = await roster.boundingBox(); expect(compact!.x + compact!.width).toBeLessThanOrEqual(640);
      await owner.screenshot({ path: '/tmp/dali-presence-compact.png' });
      await owner.keyboard.press('Escape');
      await owner.setViewportSize({ width: 1280, height: 800 });
    }
    if (scenario === 'partial') {
      service.database.prepare("UPDATE members SET display_name='' WHERE id=?").run(accounts.editor);
      await owner.getByRole('button', { name: 'People on this board: 3', exact: true }).click();
      await expect(roster.getByText('Participant', { exact: true })).toBeVisible();
      await expect(roster).not.toContainText(accounts.editor); await expect(roster).not.toContainText('editor@example.org');
      await owner.keyboard.press('Escape');
    }
    if (scenario === 'idle') {
      await owner.getByRole('button', { name: 'People on this board: 3', exact: true }).click();
      const row = roster.getByRole('listitem').filter({ hasText: 'Synthetic Editor' });
      await expect(row).toContainText('Idle', { timeout: 40000 });
      await expect(row.locator('.participant-avatar')).toHaveCSS('opacity', '0.5');
      await editor.mouse.move(420, 370); await expect(row).not.toContainText('Idle');
      await expect(row.locator('.participant-avatar')).toHaveCSS('opacity', '1');
      await owner.keyboard.press('Escape');
    }
    if (scenario === 'failure') {
      await owner.route('**/live/presence', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{' }));
      await owner.mouse.move(550, 450);
      await owner.getByRole('button', { name: 'People unavailable', exact: true }).click();
      await expect(roster.getByRole('button', { name: 'Retry presence', exact: true })).toBeVisible();
      await owner.unroute('**/live/presence');
      await roster.getByRole('button', { name: 'Retry presence', exact: true }).click();
      await expect(owner.getByRole('button', { name: 'People on this board: 3', exact: true })).toBeVisible();
      await owner.keyboard.press('Escape');
    }
    if (scenario === 'many') {
      for (let i = 0; i < 18; i++) {
        service.provider.setFaults({ claims: { sub: `synthetic-presence-${i}`, name: `Synthetic Participant ${i}`, email: `participant-${i}@example.org` } });
        const context = await browser.newContext({ baseURL: service.origin }); extraContexts.push(context);
        context.on('page', page => { page.on('pageerror', error => identities.runtimeErrors.push(error.message)); page.on('console', message => { if (message.type() === 'error') identities.runtimeErrors.push(message.text()); }); });
        const page = await context.newPage(); await page.goto('/auth/start');
        await page.getByRole('link', { name: 'Synthetic Editor', exact: true }).click();
        await page.waitForURL(url => url.origin === service.origin && !url.pathname.startsWith('/auth/'));
        service.provider.setFaults({});
        const accountId = (await (await context.request.get('/api/session')).json()).accountId;
        service.database.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?)').run(board.summary.id, accountId, 'viewer');
        const joined = await context.request.post(`/api/boards/${board.summary.id}/live/connect`, { headers: { Origin: service.origin, 'X-Dali-Request': '1', 'X-Dali-Account': accountId, 'X-Dali-Recovery-Epoch': readRecoveryEpoch(service.database) }, data: { tabId: randomUUID() } });
        expect(joined.status()).toBe(200);
        if (i === 16) await expect(owner.getByRole('button', { name: 'People on this board: 20', exact: true })).toBeVisible();
      }
      await owner.getByRole('button', { name: 'People on this board: 21', exact: true }).click();
      await expect(roster.getByRole('listitem')).toHaveCount(21);
      await expect(owner.locator('.participants-avatars')).toContainText('+18');
      expect(await roster.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
      await owner.screenshot({ path: '/tmp/dali-presence-many.png' });
      await owner.keyboard.press('Escape');
      // This is roster projection coverage; concurrent native editing is the later load plan.
      expect(identities.runtimeErrors).toEqual([]); return;
    }
    await editor.goto('/');
    await expect(owner.getByRole('button', { name: 'People on this board: 2', exact: true })).toBeVisible();
    await expect(owner.locator('.participant-cursor').filter({ hasText: 'Synthetic Editor' })).toHaveCount(0);
    expect(identities.runtimeErrors).toEqual([]);
  } catch (error) { failure = error; throw error; }
  finally { releaseConnect(); await Promise.all(extraContexts.map(context => context.close())); try { await identities.close(); } catch (error) { if (!failure) throw error; } finally { await service.close(); } }
});
