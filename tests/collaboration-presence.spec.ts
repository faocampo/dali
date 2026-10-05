import { randomUUID } from 'node:crypto';
import { test, expect } from './fixtures';
import { acceptanceService, createIdentityContexts } from './access-fixtures';
import { seedCollaborationShapes } from './collaboration-fixtures';
import { readRecoveryEpoch } from '../server/storage/recovery-state';

test('@05-03-01 editors publish named cursors and selections while Viewers appear only in the roster', async ({ browser, baseURL }) => {
  const service = await acceptanceService(baseURL!);
  const identities = await createIdentityContexts(browser, service.origin);
  let failure: unknown;
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
    for (const page of [owner, editor, viewer]) {
      await page.goto(`/?board=${board.summary.id}`);
      await expect(page.locator('affine-edgeless-root')).toBeVisible();
    }
    await owner.getByRole('button', { name: 'People on this board: 3', exact: true }).click();
    const roster = owner.getByRole('dialog', { name: 'People on this board', exact: true });
    await expect(roster).toContainText('Synthetic Editor');
    await expect(roster).toContainText('Synthetic Viewer');
    await expect(roster).toContainText('You');
    await owner.keyboard.press('Escape');
    await expect(owner.getByRole('button', { name: 'People on this board: 3', exact: true })).toBeFocused();
    await editor.mouse.move(400, 350);
    await expect(owner.locator('.participant-cursor').filter({ hasText: 'Synthetic Editor' })).toBeVisible();
    await viewer.mouse.move(420, 360);
    await expect(owner.locator('.participant-cursor').filter({ hasText: 'Synthetic Viewer' })).toHaveCount(0);
    await editor.locator('editor-host').focus(); await editor.keyboard.press('ControlOrMeta+a');
    await expect(owner.locator('.participant-selection')).toHaveCount(2);
    await expect(viewer.locator('.participant-selection')).toHaveCount(2);
    await editor.goto('/');
    await expect(owner.getByRole('button', { name: 'People on this board: 2', exact: true })).toBeVisible();
    await expect(owner.locator('.participant-cursor').filter({ hasText: 'Synthetic Editor' })).toHaveCount(0);
    expect(identities.runtimeErrors).toEqual([]);
  } catch (error) { failure = error; throw error; }
  finally { try { await identities.close(); } catch (error) { if (!failure) throw error; } finally { await service.close(); } }
});
