import { randomUUID } from 'node:crypto';
import { test, expect } from './fixtures';
import { createRestoreService } from './durability-fixtures';
import { createIdentityContexts } from './access-fixtures';
import { seedCollaborationShapes, moveLocalShape, shapeBounds } from './collaboration-fixtures';
import { journalRows } from './recovery-fixtures';

test('@05-05-02 a real restored collaborative server quarantines the old local candidate without replay', async ({ browser, baseURL }) => {
  const service = await createRestoreService(baseURL!); const identities = await createIdentityContexts(browser, service.origin);
  const context = identities.contexts.owner; const owner = context.pages()[0]!;
  let interrupt = () => {}; let failure: unknown;
  try {
    const member = await (await context.request.get('/api/session')).json(); const epoch = service.currentEpoch();
    const headers = { Origin: service.origin, 'X-Dali-Request': '1', 'X-Dali-Account': member.accountId, 'X-Dali-Recovery-Epoch': epoch };
    const created = await context.request.post('/api/boards', { headers, data: { operationId: randomUUID(), title: 'Synthetic collaborative restore' } });
    expect(created.status()).toBe(201); const board = (await created.json()).summary.id as string;
    const [shape] = await seedCollaborationShapes(owner, service.database, board);
    const held = new Promise<void>(resolve => { interrupt = resolve; });
    await owner.route('**/live/poll', async route => { await held; await route.fulfill({ status: 200, contentType: 'application/json', body: '{' }); });
    await owner.goto(`/?board=${board}`); await expect(owner.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
    const selected = await service.backup();
    interrupt(); await expect(owner.getByRole('button', { name: 'Reconnect', exact: true })).toBeVisible();
    await moveLocalShape(owner, shape!, 70); await expect.poll(() => shapeBounds(owner, shape!)).toBe('[70,40,160,120]');
    await expect.poll(async () => (await journalRows(owner)).length).toBeGreaterThan(0); const retained = await journalRows(owner);
    owner.once('dialog', dialog => dialog.accept()); await owner.goto('/');
    await expect(owner.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
    await owner.unroute('**/live/poll');
    await expect(service.restore(selected, undefined, true)).resolves.toMatchObject({ integrity: 'verified', ingress: 'closed', sessionsInvalidated: true });
    expect(service.currentEpoch()).not.toBe(epoch); service.openIngress();
    // The synthetic provider remembers the same identity; only the restored
    // application's invalidated session is renewed through ordinary OIDC.
    await owner.goto('/auth/start'); await expect(owner.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
    const writes: Array<{ path: string; epoch?: string }> = [];
    owner.on('request', request => {
      const path = new URL(request.url()).pathname;
      if (path.includes(`/api/boards/${board}/docs/`) && path.endsWith('/push')) writes.push({ path, epoch: request.headers()['x-dali-recovery-epoch'] });
    });
    await owner.goto(`/?board=${board}`);
    await expect(owner.getByRole('heading', { name: 'Recovery needs attention', exact: true })).toBeVisible();
    await expect(owner.getByText('The server copy changed after a restore.', { exact: false })).toBeVisible();
    expect(await journalRows(owner)).toEqual(expect.arrayContaining(retained)); expect(writes).toEqual([]);
    await owner.getByRole('button', { name: 'Open restored board', exact: true }).click();
    await expect.poll(() => shapeBounds(owner, shape!)).toBe('[0,0,160,120]');
    expect(await journalRows(owner)).toEqual(expect.arrayContaining(retained));
    expect(writes.filter(write => write.epoch !== service.currentEpoch())).toEqual([]);
    expect(identities.runtimeErrors).toEqual([]);
  } catch (error) { failure = error; throw error; }
  finally { interrupt(); try { await identities.close(); } catch (error) { if (!failure) throw error; } finally { await service.close(); } }
});
