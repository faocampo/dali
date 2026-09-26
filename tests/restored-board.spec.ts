import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import type { GfxController } from '@blocksuite/affine/std/gfx';
import { randomUUID, createHash } from 'node:crypto';
import { createRestoreService, createRepresentativeRecoveryService } from './durability-fixtures';
import { syntheticCanaries, accessIdentityLabels, type AccessIdentity } from './access-fixtures';

async function signIn(context: BrowserContext, identity: AccessIdentity) {
  context.setDefaultTimeout(15000);
  await context.clearCookies({ name: 'dali_fixture_identity' });
  const page = await context.newPage(); await page.goto('/auth/start');
  await page.getByRole('link', { name: accessIdentityLabels[identity], exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
  const member = await (await context.request.get('/api/session')).json(); return { page, member };
}
async function snapshot(page: Page) {
  return page.locator('affine-edgeless-root').evaluate(async el => {
    const doc = (el as HTMLElement & { gfx: GfxController }).gfx.doc;
    const images = await Promise.all(doc.getBlocksByFlavour('affine:image').map(async ({ model }) => {
      const image = model as typeof model & { props: { sourceId: string } }; const blob = await doc.blobSync.get(image.props.sourceId);
      return { id: model.id, key: image.props.sourceId, hash: blob ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())), n => n.toString(16).padStart(2, '0')).join('') : '' };
    }));
    return { id: doc.id, images, notes: doc.getBlocksByFlavour('affine:note').map(({ model }) => model.id) };
  });
}
async function journal(page: Page) {
  return page.evaluate(() => new Promise<{ id: string; epoch: string }[]>((resolve, reject) => {
    const opening = indexedDB.open('dali-account-recovery-v1'); opening.onerror = () => reject(opening.error);
    opening.onsuccess = () => { const db = opening.result; const request = db.transaction('journal').objectStore('journal').getAll();
      request.onsuccess = () => { db.close(); resolve(request.result.map(row => ({ id: row.id, epoch: row.epoch }))); }; request.onerror = () => reject(request.error); };
  }));
}

test('@04-15-01 representative restored canvas hydrates native shapes hierarchy frame connector and original images in cold browsers', async ({ browser, baseURL }, testInfo) => {
  test.setTimeout(300_000);
  const { service, manifest, boards, graph } = await createRepresentativeRecoveryService(baseURL!);
  const contexts: BrowserContext[] = [];
  try {
    const before = graph(); const selected = await service.backup(); const start = performance.now();
    await service.restore(selected, undefined, true); expect(graph()).toEqual(before);
    for (const identity of ['owner', 'editor', 'viewer'] as const) {
      const cold = await browser.newContext({ baseURL: service.origin, extraHTTPHeaders: service.operatorHeaders }); contexts.push(cold);
      expect((await cold.storageState()).origins).toEqual([]);
      const { page } = await signIn(cold, identity); const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto('/?board=' + boards[0]!.summary.id); await expect(page.locator('editor-host')).toBeVisible();
      const content = await page.locator('affine-edgeless-root').evaluate(async el => {
        const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
        const map = gfx.surface!.getElementById('synthetic-415-0-mindmap') as unknown as { children: Map<string, { collapsed?: boolean }>; style: number };
        const images = await Promise.all(gfx.doc.getBlocksByFlavour('affine:image').map(async ({ model }) => {
          const source = (model as typeof model & { props: { sourceId: string } }).props.sourceId; const blob = await gfx.doc.blobSync.get(source);
          if (!blob) throw new Error('Restored image absent'); const bitmap = await createImageBitmap(blob);
          const result = { source, width: bitmap.width, height: bitmap.height, sha256: Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())), n => n.toString(16).padStart(2, '0')).join('') };
          bitmap.close(); return result;
        }));
        return { elements: gfx.surface!.elementModels.length, frames: gfx.doc.getBlocksByFlavour('affine:frame').length,
          nodes: map.children.size, collapsed: map.children.get('synthetic-415-0-topic-1')?.collapsed, style: map.style, images };
      });
      expect(content).toMatchObject({ elements: 1100, frames: 1, nodes: 100, collapsed: true, style: 1 });
      expect(content.images).toHaveLength(2);
      for (const image of content.images) { const expected = manifest.imageSpecs.find(spec => spec.key === image.source)!;
        expect(image).toEqual({ source: expected.key, width: expected.width, height: expected.height, sha256: expected.sha256 }); }
      expect(errors).toEqual([]);
      await cold.close();
    }
    const denied = await browser.newContext({ baseURL: service.origin, extraHTTPHeaders: service.operatorHeaders }); contexts.push(denied);
    const actor = await signIn(denied, 'nonMember');
    expect((await denied.request.get('/api/boards/' + boards[0]!.summary.id, { headers: { 'X-Dali-Account': actor.member.accountId } })).status()).toBe(404);
    expect((await denied.request.get(`/api/boards/${boards[0]!.summary.id}/blobs/${manifest.imageSpecs[0]!.key}`, { headers: { 'X-Dali-Account': actor.member.accountId } })).status()).toBe(404);
    service.openIngress();
    await testInfo.attach('representative-local-cold-restore', { body: JSON.stringify({ seed: manifest.seed, boards: manifest.boards, images: manifest.images, imageBytes: manifest.imageBytes,
      coldRestoreMs: performance.now() - start, failureDomain: 'local-owned-directories' }), contentType: 'application/json' });
  } finally { for (const context of contexts) await context.close(); await service.close(); }
});

test('@04-12-02 selected native restore reopens cold authorized content and quarantines old browser work', async ({ browser, baseURL }, testInfo) => {
  test.setTimeout(180_000);
  const service = await createRestoreService(baseURL!); const contexts: BrowserContext[] = [];
  const context = await browser.newContext({ baseURL: service.origin, extraHTTPHeaders: service.operatorHeaders }); contexts.push(context);
  try {
    const { page, member } = await signIn(context, 'owner'); const epoch = service.currentEpoch();
    const headers = { Origin: service.origin, 'X-Dali-Account': member.accountId, 'X-Dali-Request': '1', 'X-Dali-Recovery-Epoch': epoch };
    const response = await context.request.post('/api/boards', { headers, data: { operationId: randomUUID(), title: 'Synthetic restored canvas' } });
    expect(response.status()).toBe(201); const board = await response.json();
    let deniedId = '';
    for (const identity of ['editor', 'viewer', 'nonMember'] as const) {
      const actor = await browser.newContext({ baseURL: service.origin, extraHTTPHeaders: service.operatorHeaders }); contexts.push(actor);
      const signed = await signIn(actor, identity);
      service.database.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?)').run(board.summary.id, signed.member.accountId, identity === 'editor' ? 'editor' : 'viewer');
      if (identity === 'nonMember') deniedId = signed.member.accountId;
      await actor.close();
    }
    await page.goto('/?board=' + board.summary.id); await expect(page.locator('editor-host')).toBeVisible();
    await page.getByRole('button', { name: 'Add sticky note', exact: true }).click();
    await page.locator('affine-edgeless-note').dblclick(); await page.keyboard.type('Restored synthetic canary'); await page.keyboard.press('Escape');
    const png = syntheticCanaries().imageBytes;
    await page.locator('input[type=file][accept="image/*"]').setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: png });
    await expect(page.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
    const before = await snapshot(page); expect(before.images).toHaveLength(1); expect(before.images[0]!.hash).toBe(createHash('sha256').update(png).digest('hex'));
    const maintenanceStarted = Date.now(); await service.plannedRestart();
    const maintenanceBrowser = await browser.newContext({ baseURL: service.origin, extraHTTPHeaders: service.operatorHeaders }); contexts.push(maintenanceBrowser);
    const maintenanceActor = await signIn(maintenanceBrowser, 'owner'); await maintenanceActor.page.goto('/?board=' + board.summary.id);
    await expect(maintenanceActor.page.locator('affine-edgeless-note')).toContainText('Restored synthetic canary');
    await expect(maintenanceActor.page.locator('affine-edgeless-image img')).toBeVisible(); expect(await snapshot(maintenanceActor.page)).toEqual(before);
    service.openIngress(); const plannedMaintenanceMs = Date.now() - maintenanceStarted; await maintenanceBrowser.close();
    const acknowledgedBefore = Date.now(); const selected = await service.backup();
    // This access change occurs after the selected recovery point and must be reconciled from a separate ledger.
    service.database.prepare('DELETE FROM board_grants WHERE board_id=? AND member_id=?').run(board.summary.id, deniedId);
    const latest = await (await context.request.get('/api/boards/' + board.summary.id, { headers })).json();
    const lostOperation = randomUUID();
    expect((await context.request.patch('/api/boards/' + board.summary.id, { headers, data: { title: 'Acknowledged after selected backup', operationId: lostOperation, revision: latest.revision } })).ok()).toBeTruthy();
    const acknowledgedAfter = Date.now();
    await context.setOffline(true); await page.getByRole('button', { name: 'Add sticky note', exact: true }).click();
    await expect.poll(async () => (await journal(page)).length).toBeGreaterThan(0); const retained = await journal(page);
    const oldCookie = (await context.cookies()).find(cookie => cookie.name === 'dali_session')!;
    const incidentStarted = Date.now();
    await expect(service.restore(selected, { boardId: board.summary.id, memberId: deniedId })).resolves.toMatchObject({ integrity: 'verified', ingress: 'closed', sessionsInvalidated: true });
    expect(service.currentEpoch()).not.toBe(epoch);
    expect(service.database.prepare('SELECT 1 FROM operations WHERE operation_id=?').get(lostOperation)).toBeUndefined();
    const publicResponse = await fetch(service.origin + '/api/session'); expect(publicResponse.status).toBe(503);
    expect((await fetch(service.origin + '/api/session', { headers: { ...service.operatorHeaders, cookie: `${oldCookie.name}=${oldCookie.value}` } })).status).toBe(401);
    const baseline = await service.completeSets(); expect(baseline.some(set => set.manifest.epoch === service.currentEpoch())).toBe(true);
    const initialCurrentCount = baseline.filter(set => set.manifest.epoch === service.currentEpoch()).length;
    for (const identity of ['owner', 'editor', 'viewer', 'nonMember'] as const) {
      const cold = await browser.newContext({ baseURL: service.origin, extraHTTPHeaders: service.operatorHeaders }); contexts.push(cold);
      expect((await cold.storageState()).origins).toEqual([]);
      const actor = await signIn(cold, identity); const access = { 'X-Dali-Account': actor.member.accountId };
      const descriptor = await cold.request.get('/api/boards/' + board.summary.id, { headers: access });
      expect(descriptor.status()).toBe(identity === 'nonMember' ? 404 : 200);
      const image = await cold.request.get(`/api/boards/${board.summary.id}/blobs/${before.images[0]!.key}`, { headers: access });
      if (identity === 'nonMember') { expect(image.status()).toBe(404); await cold.close(); continue; }
      const restored = await descriptor.json(); expect(restored.summary.role).toBe(identity); expect(restored.summary.title).toBe('Synthetic restored canvas'); expect(await image.body()).toEqual(png);
      await actor.page.goto('/?board=' + board.summary.id);
      await expect(actor.page.locator('affine-edgeless-note')).toContainText('Restored synthetic canary');
      await expect(actor.page.locator('affine-edgeless-image img')).toBeVisible(); expect(await snapshot(actor.page)).toEqual(before);
      const permission = await cold.request.post(`/api/boards/${board.summary.id}/docs/${board.contentDocId}/push`, { headers: { ...access, Origin: service.origin, 'X-Dali-Request': '1', 'X-Dali-Recovery-Epoch': service.currentEpoch(), 'Content-Type': 'application/octet-stream' }, data: Buffer.from([0, 0]) });
      expect(permission.status()).toBe(identity === 'viewer' ? 403 : 200);
      await cold.close();
    }
    await context.setOffline(false); await signIn(context, 'owner'); await page.reload();
    await expect(page.getByText('The server copy changed after a restore.', { exact: false })).toBeVisible();
    expect(await journal(page)).toEqual(retained);
    const stale = await context.request.post(`/api/boards/${board.summary.id}/docs/${board.contentDocId}/push`, { headers: { ...headers, 'Content-Type': 'application/octet-stream' }, data: Buffer.from([0, 0]) });
    expect(stale.status()).toBe(409); expect((await stale.json()).code).toBe('RECOVERY_EPOCH_MISMATCH');
    await page.getByRole('button', { name: 'Open restored board', exact: true }).click();
    await expect(page.locator('affine-edgeless-note')).toContainText('Restored synthetic canary');
    expect(await snapshot(page)).toEqual(before); expect(await journal(page)).toEqual(retained);
    await expect.poll(async () => (await service.completeSets()).filter(set => set.manifest.epoch === service.currentEpoch()).length).toBeGreaterThan(initialCurrentCount);
    service.openIngress(); expect((await fetch(service.origin + '/api/session')).status).toBe(401);
    const disasterMs = Date.now() - incidentStarted;
    const conservativeLossWindowMs = incidentStarted - selected.manifest.recoveryPointAt;
    expect(disasterMs).toBeLessThan(86_400_000); expect(plannedMaintenanceMs).toBeLessThan(86_400_000); expect(conservativeLossWindowMs).toBeLessThan(3_600_000);
    expect(acknowledgedBefore).toBeLessThanOrEqual(selected.manifest.recoveryPointAt); expect(acknowledgedAfter).toBeGreaterThanOrEqual(selected.manifest.recoveryPointAt);
    const timing = { disasterMs, plannedMaintenanceMs, conservativeLossWindowMs, retainedAcknowledgedCanaries: 2, lostAcknowledgedCanaries: 1, oldestLostAcknowledgmentAgeMs: incidentStarted - acknowledgedAfter };
    console.info('synthetic-restore-timing', JSON.stringify(timing));
    await testInfo.attach('synthetic-restore-timing', { body: JSON.stringify(timing), contentType: 'application/json' });
  } finally { for (const item of contexts) await item.close(); await service.close(); }
});
