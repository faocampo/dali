import { addStickyNote } from './sticky-tool';
import { test, expect, type Page } from './browser-fixtures.js';
import { recoveryBoardFixture, journalRows, failRecoveryStorage } from './recovery-fixtures';
import { addSavedImage } from './save-status-fixtures';
import type { GfxController } from '@blocksuite/affine/std/gfx';
import type { MindmapElementModel, ShapeElementModel } from '@blocksuite/affine/model';
import type { EditorHost } from '@blocksuite/affine/std';
import { unzipSync } from 'fflate';
import { createHash } from 'node:crypto';
import { recoveryArchiveFixtures, recoveryAuthorizationBarrier } from './recovery-archive-fixtures';

async function startRecovery(page: Page) {
  const paused = page.getByRole('button', { name: 'Editing paused, Open save details', exact: true });
  await (await paused.count() ? paused : page.getByRole('button', { name: 'Save failed, Open save details', exact: true })).click();
}
async function pending(page: Page) {
  await page.route('**/docs/*/push', route => route.fulfill({ status: 503, json: { code: 'SYNTHETIC_OUTAGE' } }));
  await addStickyNote(page);
  await expect.poll(async () => (await journalRows(page)).length).toBeGreaterThan(0);
}
async function readDownload(download: import('@playwright/test').Download) {
  const chunks: Buffer[] = []; for await (const chunk of (await download.createReadStream())!) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}
async function semantic(page: Page) {
  return page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx; const surface = gfx.surface!; const store = gfx.doc;
    const map = surface.elementModels.find(model => model.type === 'mindmap') as MindmapElementModel | undefined;
    const text = (id?: string) => id ? (surface.getElementById(id) as ShapeElementModel)?.text?.toString() : undefined;
    const plain = (props: object) => Object.fromEntries(Object.entries(props).filter(([key, value]) => key !== 'imageId' && ['number', 'string', 'boolean'].includes(typeof value)));
    const images = store.getBlocksByFlavour('affine:image').map(({ model }) => plain(model.props));
    const edits = store.getBlocksByFlavour('djai:image-visual-edit').map(({ model }) => { const imageId = (model.props as unknown as { imageId: string }).imageId; return { ...plain(model.props), validImage: store.getBlocksByFlavour('affine:image').some(row => row.model.id === imageId) }; });
    return { images, edits,
      notes: store.getBlocksByFlavour('affine:paragraph').map(({ model }) => (model.props as { text: { toString(): string } }).text.toString()),
      shapes: surface.elementModels.filter(model => model.type === 'shape').map(model => { const s = model as ShapeElementModel; return { xywh: s.xywh, text: s.text?.toString(), color: s.color, fontSize: s.fontSize, fontWeight: s.fontWeight }; }).sort((a, b) => a.xywh.localeCompare(b.xywh)),
      hierarchy: map ? [...map.children].map(([id, detail]) => ({ ...detail, parent: text(detail.parent), text: text(id) })).sort((a, b) => a.text!.localeCompare(b.text!)) : [],
      connectors: surface.elementModels.filter(model => model.type === 'connector').map(model => { const c = model as unknown as { source: { id?: string; position?: number[] }; target: { id?: string; position?: number[] } }; return { source: { ...c.source, id: c.source.id ? surface.getElementById(c.source.id)?.xywh : undefined }, target: { ...c.target, id: c.target.id ? surface.getElementById(c.target.id)?.xywh : undefined } }; }),
    };
  });
}

test('@04-06-01 zero-image pending board downloads a timestamped editable recovery archive', async ({ page, baseURL }) => {
  await recoveryBoardFixture(page, baseURL!);
  await page.route('**/docs/*/push', route => route.fulfill({ status: 503, json: { code: 'SYNTHETIC_OUTAGE' } }));
  await addStickyNote(page);
  await expect.poll(async () => (await journalRows(page)).length).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Save failed, Open save details', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download recovery copy', exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/-recovery-\d{4}-.*\.bs\.zip$/);
  expect((await journalRows(page)).length).toBeGreaterThan(0);
});

test('@04-06-01 native pending map geometry connectors adjusted images round trip through private Import', async ({ page, context, baseURL }) => {
  const { member, descriptor } = await recoveryBoardFixture(page, baseURL!);
  await page.getByRole('button', { name: 'Add mind map', exact: true }).click(); await page.keyboard.type('Recovery root'); await page.keyboard.press('Enter');
  await page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx; const surface = gfx.surface!;
    const map = surface.elementModels.find(model => model.type === 'mindmap') as MindmapElementModel;
    const branch = map.addNode(map.tree.id, undefined, 'after', { text: 'Recovery branch' }); map.addNode(branch, undefined, 'after', { text: 'Hidden topic' });
    surface.updateElement(branch, { fontSize: 27, fontWeight: '700', color: '#234567' }); map.toggleCollapse(map.getNode(branch)!, { layout: true });
    const a = surface.addElement({ type: 'shape', shapeType: 'rect', xywh: '[10,600,100,80]' });
    const b = surface.addElement({ type: 'shape', shapeType: 'rect', xywh: '[310,600,100,80]' });
    surface.addElement({ type: 'connector', source: { id: a, position: [1, 0.5] }, target: { id: b, position: [0, 0.5] } }); gfx.doc.captureSync();
  });
  const raster = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 100; const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#80a040'; ctx.fillRect(0, 0, 200, 100); return canvas.toDataURL().split(',')[1]!; });
  await page.locator('input[type=file][accept="image/*"]').setInputFiles({ name: 'Synthetic adjustable.png', mimeType: 'image/png', buffer: Buffer.from(raster, 'base64') });
  await expect(page.locator('affine-edgeless-image')).toHaveCount(1); await expect(page.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Fit to screen', exact: true }).click(); await page.locator('affine-edgeless-image').click();
  await page.locator('.selection-inspector').getByRole('button', { name: 'Crop', exact: true }).click();
  await page.getByRole('button', { name: 'Crop left', exact: true }).press('Shift+ArrowRight'); await page.getByRole('button', { name: 'Apply crop', exact: true }).click();
  await page.locator('.image-slider').filter({ hasText: 'Brightness' }).locator('input').fill('20');
  await expect.poll(async () => (await semantic(page)).edits.some(e => (e as Record<string, unknown>).brightness === 20)).toBe(true);
  await expect(page.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
  await pending(page); const before = await semantic(page); await startRecovery(page);
  const downloadPromise = page.waitForEvent('download', { timeout: 20000 }); await page.getByRole('button', { name: 'Download recovery copy', exact: true }).click();
  const archive = await readDownload(await downloadPromise); const entries = unzipSync(archive);
  const snapshot = JSON.parse(Buffer.from(Object.entries(entries).find(([key]) => key.endsWith('.snapshot.json'))![1]).toString());
  expect(JSON.stringify(snapshot)).toContain('Hidden topic');
  const hashes = Object.entries(entries).filter(([key]) => key.startsWith('assets/')).map(([key, bytes]) => { const hash = createHash('sha256').update(bytes).digest('base64url') + '='; expect(key).toContain(hash); return hash; });
  expect(hashes.length).toBeGreaterThanOrEqual(2); expect((await journalRows(page)).length).toBeGreaterThan(0);
  const copy = await context.newPage(); await copy.goto(baseURL!); await copy.getByRole('button', { name: 'Import', exact: true }).click();
  const dialog = copy.getByRole('dialog', { name: 'Import board', exact: true });
  await dialog.locator('input[type=file]').setInputFiles({ name: 'Recovery roundtrip.bs.zip', mimeType: 'application/zip', buffer: archive });
  await dialog.getByRole('button', { name: 'Import board', exact: true }).click();
  await expect(dialog.getByRole('link', { name: 'Open board', exact: true })).toBeVisible();
  await dialog.getByRole('link', { name: 'Open board', exact: true }).click(); await expect(copy.locator('editor-host')).toBeVisible();
  expect(await semantic(copy)).toEqual(before);
  const id = new URL(copy.url()).searchParams.get('board')!; expect(id).not.toBe(descriptor.summary.id);
  const result = await (await copy.request.get(`/api/boards/${id}`, { headers: { 'X-Dali-Account': member.accountId } })).json();
  expect(result.summary).toMatchObject({ access: 'private', role: 'owner', accountId: member.accountId });
  for (const hash of hashes) { const bytes = await (await copy.request.get(`/api/boards/${id}/blobs/${encodeURIComponent(hash)}`, { headers: { 'X-Dali-Account': member.accountId } })).body(); expect(createHash('sha256').update(bytes).digest('base64url') + '=').toBe(hash); }
  await copy.reload(); await expect(copy.locator('editor-host')).toBeVisible(); expect(await semantic(copy)).toEqual(before); await copy.close();
});

test('@04-06-01 paused memory remains downloadable offline with retained image bytes', async ({ page, baseURL }) => {
  await recoveryBoardFixture(page, baseURL!); await addSavedImage(page); await failRecoveryStorage(page, 'quota');
  await addStickyNote(page);
  await expect(page.getByRole('button', { name: 'Editing paused, Open save details', exact: true })).toBeVisible();
  await page.route('**/api/**', route => route.abort('internetdisconnected'));
  await startRecovery(page); const download = page.waitForEvent('download', { timeout: 20000 });
  await page.getByRole('button', { name: 'Download recovery copy', exact: true }).click();
  const entries = unzipSync(await readDownload(await download)); expect(Object.keys(entries).some(path => path.startsWith('assets/'))).toBe(true);
  expect(Buffer.from(Object.entries(entries).find(([key]) => key.endsWith('.snapshot.json'))![1]).toString()).toContain('affine:note');
  await expect(page.getByRole('button', { name: 'Editing paused, Open save details', exact: true })).toBeVisible();
});

test('@04-06-01 access loss during delayed authorization prevents all downloads', async ({ page, context, baseURL }) => {
  await recoveryBoardFixture(page, baseURL!); await pending(page); await startRecovery(page);
  let release!: () => void; let held = false; const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/editable-export', async route => { const response = await route.fetch(); held = true; await gate; await route.fulfill({ response }).catch(() => undefined); });
  const downloads: string[] = []; page.on('download', download => downloads.push(download.suggestedFilename()));
  await page.getByRole('button', { name: 'Download recovery copy', exact: true }).click(); await expect.poll(() => held).toBe(true);
  await context.clearCookies({ name: 'dali_fixture_identity' }); const other = await context.newPage(); await other.goto(baseURL! + '/auth/start');
  await other.getByRole('link', { name: 'Synthetic Editor', exact: true }).click(); await expect(other.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Account changed', exact: true })).toBeVisible(); release();
  await expect(page.locator('editor-host')).toHaveCount(0); expect(downloads).toEqual([]); await other.close();
});

test('@04-06-02 preparing state survives details reopening and coalesces duplicate activation while later edits stay pending', async ({ page, baseURL }) => {
  await recoveryBoardFixture(page, baseURL!, recoveryArchiveFixtures.longText.title); await pending(page); await startRecovery(page);
  const beforeIds = (await journalRows(page)).map(row => row.id); const barrier = await recoveryAuthorizationBarrier(page);
  const downloads: import('@playwright/test').Download[] = []; page.on('download', download => downloads.push(download));
  await page.getByRole('button', { name: 'Download recovery copy', exact: true }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
  await expect.poll(barrier.held).toBe(1);
  await expect(page.getByText(recoveryArchiveFixtures.loading.label, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download recovery copy', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Save failed, Open save details', exact: true }).click(); await page.getByRole('button', { name: 'Save failed, Open save details', exact: true }).click();
  await expect(page.getByText(recoveryArchiveFixtures.loading.label, { exact: true })).toBeVisible();
  await addStickyNote(page);
  await expect(page.locator('affine-edgeless-note')).toHaveCount(2);
  await page.getByRole('button', { name: 'Save failed, Open save details', exact: true }).click(); barrier.release();
  await expect.poll(() => downloads.length).toBe(1); await expect(page.getByText(recoveryArchiveFixtures.populated.label, { exact: true })).toBeVisible();
  const entries = unzipSync(await readDownload(downloads[0]!)); const text = Buffer.from(Object.entries(entries).find(([key]) => key.endsWith('.snapshot.json'))![1]).toString();
  expect((text.match(/"flavour":"affine:note"/g) ?? []).length).toBe(1);
  const afterIds = (await journalRows(page)).map(row => row.id); expect(beforeIds.every(id => afterIds.includes(id))).toBe(true);
  await expect(page.getByRole('button', { name: 'Saved, Open save details', exact: true })).toHaveCount(0);
});

test('@04-06-02 missing required bytes expose a named retryable error and preserve pending IDs at narrow widths', async ({ page, baseURL }, testInfo) => {
  await recoveryBoardFixture(page, baseURL!, recoveryArchiveFixtures.longText.title); await addSavedImage(page); await pending(page);
  const encoded = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = canvas.height = 16; const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#92ab45'; ctx.fillRect(0, 0, 16, 16); return canvas.toDataURL().split(',')[1]!; });
  const bytes = Buffer.from(encoded, 'base64'); const key = createHash('sha256').update(bytes).digest('base64url') + '='; let available = false;
  await page.route('**/blobs/*', route => {
    if (decodeURIComponent(new URL(route.request().url()).pathname.split('/').at(-1)!) !== key) return route.continue();
    return available ? route.fulfill({ status: 200, contentType: 'image/png', body: bytes }) : route.fulfill({ status: 503, json: { code: 'SYNTHETIC_IMAGE_UNAVAILABLE' } });
  });
  await page.locator('editor-host').evaluate((el, { key, label }) => { const store = (el as EditorHost).store; store.updateBlock(store.getBlocksByFlavour('affine:image')[0]!.model, { sourceId: key, caption: label }); }, { key, label: recoveryArchiveFixtures.longText.imageName });
  await startRecovery(page); const before = (await journalRows(page)).map(row => row.id);
  const downloads: import('@playwright/test').Download[] = []; page.on('download', value => downloads.push(value));
  await page.getByRole('button', { name: 'Download recovery copy', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Save details' }).getByRole('alert')).toContainText(recoveryArchiveFixtures.longText.imageName); expect(downloads).toHaveLength(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of recoveryArchiveFixtures.overflow.widths) {
    await page.setViewportSize({ width, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Download recovery copy', exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: 'Download recovery copy', exact: true })).toBeInViewport();
  }
  await page.screenshot({ path: testInfo.outputPath('recovery-missing-narrow.png') });
  available = true; await page.getByRole('button', { name: 'Download recovery copy', exact: true }).click();
  await expect.poll(() => downloads.length).toBe(1); await expect(page.getByText(recoveryArchiveFixtures.populated.label, { exact: true })).toBeVisible();
  const after = (await journalRows(page)).map(row => row.id); expect(before.every(id => after.includes(id))).toBe(true);
  await expect(page.getByRole('button', { name: 'Saved, Open save details', exact: true })).toHaveCount(0);
});

test('@04-06-02 missing visual preview still exports retained complete image bytes', async ({ page, baseURL }) => {
  await recoveryBoardFixture(page, baseURL!); await addSavedImage(page); await pending(page);
  await page.locator('affine-edgeless-image').evaluate(el => el.querySelector('img')?.remove());
  await startRecovery(page); const download = page.waitForEvent('download', { timeout: 20000 }); await page.getByRole('button', { name: 'Download recovery copy', exact: true }).click();
  const files = unzipSync(await readDownload(await download)); expect(Object.keys(files).filter(path => path.startsWith('assets/'))).toHaveLength(1);
  await expect(page.getByText(recoveryArchiveFixtures.populated.label, { exact: true })).toBeVisible(); expect((await journalRows(page)).length).toBeGreaterThan(0);
});
