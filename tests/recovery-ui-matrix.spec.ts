import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { unzipSync } from 'fflate';
import type { Download, Locator, Page, TestInfo } from '@playwright/test';
import type { EditorHost } from '@blocksuite/affine/std';
import { test, expect, fixtureRecoveryEpoch } from './fixtures';
import { recoveryBoardFixture, nativeRecoveryModel, journalRows, failRecoveryStorage, restoreRecoveryStorage } from './recovery-fixtures';
import { documentResponseBarrier } from './save-status-fixtures';
import { addDetailImages, openSaveDetails, saveTrigger, saveDetailsFixtures } from './save-details-fixtures';
import { recoveryAuthorizationBarrier } from './recovery-archive-fixtures';
import { acceptanceService } from './access-fixtures';
import { libraryRecoveryMember, libraryRecoveryBoard, seedLibraryPending } from './library-recovery-fixtures';
import { exactJournal, retainsRecords, panelControls, boardErrorLayout, textContrast, wrapsText, targetSize, selectedImage, holdDescriptor, failDetailsPreview, restoreDetailsPreview } from './recovery-ui-matrix-support';

// Exact predicate text inserted from the approved UI-SPEC when preparing this draft.
const predicates: Record<string, string> = {
  "E1/loading": "Show Saving or pending/recovery progress beside the title; retain the last acknowledged server time.",
  "E1/error": "Apply defined status precedence and open details only on activation; never report Saved until current content and required images are acknowledged.",
  "E1/overflow": "Use the Responsive Layout contract: viewport-clamped surfaces, vertical scrolling, reachable controls and no horizontal page overflow.",
  "E1/long-text": "Wrap explanatory text and image names while preserving full accessible labels; test the specified long-title/name fixtures and 320px layout.",
  "E2/empty": "Omit an empty image list; healthy details show the saved message and acknowledged time.",
  "E2/loading": "Update individual upload/retry rows in place without stealing focus or removing access to recovery download.",
  "E2/error": "Identify each failed image; keep its error until that required image is acknowledged or confirmed obsolete.",
  "E2/populated": "Show stable image labels, available thumbnails, row status and permitted Select image actions.",
  "E2/partial": "Use a neutral placeholder for missing previews; mixed success and failure retains unresolved rows.",
  "E2/overflow": "Use the Responsive Layout contract: viewport-clamped surfaces, vertical scrolling, reachable controls and no horizontal page overflow.",
  "E2/zero-one-many": "Omit zero-image sections, use singular/plural copy and vertically scroll the specified 50-row case.",
  "E2/long-text": "Wrap explanatory text and image names while preserving full accessible labels; test the specified long-title/name fixtures and 320px layout.",
  "E3/empty": "A valid board with no images exports without an image section; a referenced but unavailable image follows the missing-image error contract.",
  "E3/loading": "Show Preparing recovery copy and suppress duplicate preparation while retaining the board and pending data.",
  "E3/error": "Preparation or missing-image failure retains journal and in-memory content, exposes retry and never hands off a silently incomplete success archive.",
  "E3/populated": "Hand off a complete authorized snapshot archive compatible with Import; the ready message does not clear pending work or claim a disk save.",
  "E3/overflow": "Use the Responsive Layout contract: viewport-clamped surfaces, vertical scrolling, reachable controls and no horizontal page overflow.",
  "E3/long-text": "Wrap explanatory text and image names while preserving full accessible labels; test the specified long-title/name fixtures and 320px layout.",
  "E4/empty": "A valid empty board remains a valid canvas; inaccessible or unavailable board data uses the load/denied contract rather than a fabricated empty board.",
  "E4/loading": "Check current account and permission before recovery, then show recovery progress until server acknowledgment.",
  "E4/error": "Use distinct load, permission, corrupt-journal and restoration-mismatch states; retain isolated pending data and gate content/actions by current authority.",
  "E4/populated": "Display the authorized board with its images; restore a still-valid editing context without overriding a subsequent focus move.",
  "E4/overflow": "Use the Responsive Layout contract: viewport-clamped surfaces, vertical scrolling, reachable controls and no horizontal page overflow.",
  "E4/long-text": "Wrap explanatory text and image names while preserving full accessible labels; test the specified long-title/name fixtures and 320px layout.",
  "E5/loading": "After explicit Leave, suppress duplicate navigation while the requested transition completes and focus the destination heading.",
  "E5/error": "Unconfirmed local preservation adds the defined loss warning; Stay retains the current board and Leave remains an explicit informed choice.",
  "E5/overflow": "Use the Responsive Layout contract: viewport-clamped surfaces, vertical scrolling, reachable controls and no horizontal page overflow.",
  "E5/long-text": "Wrap explanatory text and image names while preserving full accessible labels; test the specified long-title/name fixtures and 320px layout.",
  "E6/empty": "Keep the existing empty-library view; zero pending records adds no marker and does not fabricate cards.",
  "E6/loading": "Load authorized cards independently and expose Checking recovery status while journal inspection is pending.",
  "E6/error": "Inspection failure shows Recovery status unavailable with Refresh boards retry; access-list failure does not reveal cached private cards.",
  "E6/populated": "Place the matching account/browser pending marker below role/access metadata without changing server edited time, grid ordering or card actions.",
  "E6/partial": "A missing preview uses the existing card fallback; marker visibility depends on authorized metadata and journal evidence, not preview success.",
  "E6/overflow": "Use the Responsive Layout contract: viewport-clamped surfaces, vertical scrolling, reachable controls and no horizontal page overflow.",
  "E6/zero-one-many": "Preserve the current zero/one/many-card layout and test 50 marked cards; clear each marker only on acknowledgment of its matching pending work.",
  "E6/long-text": "Wrap explanatory text and image names while preserving full accessible labels; test the specified long-title/name fixtures and 320px layout."
};
const completed = new WeakMap<TestInfo, string[]>();
// The reporter independently verifies this revision and the stable source-content digest.
const testedRevision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (!/^[a-f0-9]{40}$/.test(testedRevision)) throw new Error('A tested revision is required');
async function group(key: string, body: () => Promise<void>) {
  if (!predicates[key]) throw new Error('Unknown UI predicate: ' + key);
  await test.step(`[${key}] ${predicates[key]}`, body);
  const info = test.info(); completed.set(info, [...(completed.get(info) ?? []), key]);
}
test.afterEach(async ({}, info) => {
  await info.attach('executed-ui-predicates', { contentType: 'application/json', body: Buffer.from(JSON.stringify({ project: info.project.name, revision: testedRevision, test: info.title, status: info.status, completed: info.status === 'passed' ? completed.get(info) ?? [] : [] })) });
});
test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: 'reduce' }); });
test.use({ expectErrors: ['the server responded with a status of 503', 'the server responded with a status of 403', 'the server responded with a status of 404'] });
const widths = [1440, 900, 600, 490, 320];
const saved = (page: Page) => page.getByRole('button', { name: 'Saved, Open save details', exact: true });
const details = (page: Page) => page.getByRole('dialog', { name: 'Save details', exact: true });
const downloadButton = (page: Page) => details(page).getByRole('button', { name: 'Download recovery copy', exact: true });
async function outage(page: Page) { await page.route('**/docs/*/push', route => route.fulfill({ status: 503, json: { code: 'SYNTHETIC_OUTAGE' } })); }
async function pendingNote(page: Page) {
  await outage(page); await page.getByRole('button', { name: 'Add sticky note', exact: true }).click();
  await expect(saveTrigger(page)).toContainText('Save failed');
  await expect.poll(async () => (await journalRows(page)).length).toBeGreaterThan(0);
}
async function downloadBytes(download: Download) {
  const stream = await download.createReadStream(); if (!stream) throw new Error('Missing download stream');
  const chunks: Buffer[] = []; for await (const part of stream) chunks.push(Buffer.from(part)); return Buffer.concat(chunks);
}
async function archive(page: Page) {
  const event = page.waitForEvent('download'); await downloadButton(page).click();
  const bytes = await downloadBytes(await event); return { bytes, entries: unzipSync(bytes) };
}
async function boundedPanel(page: Page, panel: Locator, action: Locator) {
  for (const width of widths) {
    await page.setViewportSize({ width, height: width === 320 ? 480 : 800 });
    await expect.poll(() => panel.evaluate(el => { const r = el.getBoundingClientRect(); return r.left >= 15 && r.right <= innerWidth - 15 && r.top >= 0 && r.bottom <= innerHeight - 15; })).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await panel.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await action.scrollIntoViewIfNeeded(); await expect(action).toBeInViewport();
    await panelControls(page, panel); await reducedMotion(page, panel); await textContrast(panel);
  }
}
async function longLabels(page: Page) {
  await expect(page.getByRole('button', { name: `Rename board: ${saveDetailsFixtures.title}`, exact: true })).toBeVisible();
  await expect(details(page).getByRole('button', { name: `Select image: ${saveDetailsFixtures.name}`, exact: true }).first()).toBeVisible();
  await wrapsText(details(page).locator('.save-details-image-copy strong').first());
  await targetSize(page.getByRole('button', { name: `Rename board: ${saveDetailsFixtures.title}`, exact: true }));
  expect(await page.locator('.board-document-heading').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
}
async function reducedMotion(page: Page, surface: Locator) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await surface.evaluate(el => el.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length)).toBe(0);
}
function watchSecondary(page: Page) {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  page.on('console', message => { if (message.type() === 'error' && !message.text().includes('the server responded with a status of 503')) errors.push(message.text()); });
  return () => expect(errors).toEqual([]);
}
async function semantic(page: Page) {
  return page.locator('editor-host').evaluate(el => {
    const store = (el as EditorHost).store;
    return { notes: store.getBlocksByFlavour('affine:paragraph').map(({ model }) => String((model.props as { text?: unknown }).text ?? '')),
      images: store.getBlocksByFlavour('affine:image').map(({ model }) => { const p = model.props as Record<string, unknown>; return { sourceId: p.sourceId, width: p.width, height: p.height, caption: p.caption }; }) };
  });
}
async function beginNativePreservationHold(page: Page) {
  await page.evaluate(() => {
    const transaction = IDBDatabase.prototype.transaction; let released = false; let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    Object.assign(window, { heldRecoveryCompletions: 0, releaseRecoveryCompletions: () => { released = true; IDBDatabase.prototype.transaction = transaction; release(); } });
    IDBDatabase.prototype.transaction = function(...args: Parameters<IDBDatabase['transaction']>) {
      const tx = transaction.apply(this, args);
      if (this.name === 'dali-account-recovery-v1' && args[1] === 'readwrite') {
        const descriptor = Object.getOwnPropertyDescriptor(IDBTransaction.prototype, 'oncomplete')!;
        Object.defineProperty(tx, 'oncomplete', { configurable: true, set(callback: ((event: Event) => void) | null) {
          descriptor.set!.call(tx, callback && function(event: Event) {
            if (released) callback.call(tx, event);
            else { (window as unknown as { heldRecoveryCompletions: number }).heldRecoveryCompletions++; void gate.then(() => callback.call(tx, event)); }
          });
        }, get() { return descriptor.get!.call(tx); } });
      }
      return tx;
    };
  });
}
async function releaseNativePreservation(page: Page) { await page.evaluate(() => (window as unknown as { releaseRecoveryCompletions(): void }).releaseRecoveryCompletions()); }

test('@04-16 @04-ui-E1 status transitions preserve age and open details deliberately', async ({ page, baseURL, pageErrors, expectErrors }) => {
  await recoveryBoardFixture(page, baseURL!); await addDetailImages(page, 1); await expect(saved(page)).toBeVisible();
  await openSaveDetails(page); const lastSaved = await details(page).locator('.save-details-time').textContent();
  expect(lastSaved).toMatch(/^Last saved to the server: .+/); await page.keyboard.press('Escape');
  const age = await saveTrigger(page).getAttribute('title'); expect(age).toMatch(/^Last saved .+/);
  await expect(page.locator('#save-age')).toBeVisible(); const barrier = await documentResponseBarrier(page);
  try {
    await group('E1/loading', async () => {
      await page.getByRole('button', { name: 'Add sticky note', exact: true }).click(); await expect.poll(barrier.held).toBeGreaterThan(0);
      await expect(saveTrigger(page)).toContainText(/Saving…|Changes waiting to save|Recovering changes…/);
      expect(await saveTrigger(page).getAttribute('title')).toBe(age); await expect(details(page)).toHaveCount(0);
      await expect(page.locator('#save-age')).toBeVisible(); await expect(saveTrigger(page)).toHaveAttribute('aria-describedby', 'save-age');
      await openSaveDetails(page); await expect(details(page).locator('.save-details-time')).toHaveText(lastSaved!); await page.keyboard.press('Escape');
    });
    await barrier.releaseAll(); await expect(saved(page)).toBeVisible();
    await page.unroute('**/docs/*/push'); await outage(page);
    expect(pageErrors.filter(error => !expectErrors.some(allowed => error.includes(allowed)))).toEqual([]); expectErrors.push('Error: Board image request failed');
    await page.route('**/blobs/*', route => route.request().method() === 'GET' ? route.fulfill({ status: 503, json: { code: 'SYNTHETIC_IMAGE_FAILURE' } }) : route.continue());
    await page.reload(); await expect(saveTrigger(page)).toContainText('Image not saved');
    await group('E1/error', async () => {
      await page.getByRole('button', { name: 'Add sticky note', exact: true }).click(); await expect(saveTrigger(page)).toContainText('Save failed');
      await expect(details(page)).toHaveCount(0); await saveTrigger(page).press('Space');
      await expect(details(page)).toBeVisible(); await expect(saveTrigger(page)).toHaveAttribute('aria-expanded', 'true');
      await expect(saveTrigger(page)).toHaveAttribute('aria-controls', await details(page).getAttribute('id') ?? '');
      await expect(details(page)).toContainText('Board changes and'); await expect(saved(page)).toHaveCount(0);
      const before = await nativeRecoveryModel(page); await details(page).getByRole('heading', { name: 'Save details', exact: true }).focus(); await page.keyboard.press('Delete');
      expect(await nativeRecoveryModel(page)).toBe(before); await page.keyboard.press('Escape'); await expect(saveTrigger(page)).toBeFocused();
    });
  } finally { await barrier.releaseAll(); }
});

test('@04-16 @04-ui-E2 @04-ui-E3 healthy empty details and decoded zero-image archive', async ({ page, baseURL }) => {
  await recoveryBoardFixture(page, baseURL!); await expect(saved(page)).toBeVisible();
  await group('E2/empty', async () => {
    const dialog = await openSaveDetails(page); await expect(dialog).toContainText('All changes and images are saved to the server.');
    await expect(dialog).toContainText('Last saved to the server:'); await expect(dialog.getByRole('list')).toHaveCount(0); await page.keyboard.press('Escape');
  });
  await group('E3/empty', async () => {
    await pendingNote(page); await openSaveDetails(page); const before = await exactJournal(page); const result = await archive(page);
    const snapshots = Object.entries(result.entries).filter(([name]) => name.endsWith('.snapshot.json')); expect(snapshots).toHaveLength(1);
    const snapshot = JSON.parse(Buffer.from(snapshots[0]![1]).toString()); expect(JSON.stringify(snapshot)).toContain('affine:note');
    expect(JSON.stringify(snapshot)).not.toContain('affine:image'); expect(Object.keys(result.entries).filter(name => name.startsWith('assets/'))).toEqual([]);
    await expect(details(page).getByRole('region', { name: 'Image save status' })).toHaveCount(0); await retainsRecords(page, before);
  });
});

test('@04-16 @04-ui-E2 individual image rows survive preview failure and acknowledged retry', async ({ page, baseURL, pageErrors, expectErrors }) => {
  await recoveryBoardFixture(page, baseURL!); await addDetailImages(page, 2); await expect(saved(page)).toBeVisible();
  const key = await page.locator('editor-host').evaluate(el => ((el as EditorHost).store.getBlocksByFlavour('affine:image')[0]!.model.props as { sourceId: string }).sourceId);
  let fail = true; let held = 0; let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  expect(pageErrors.filter(error => !expectErrors.some(allowed => error.includes(allowed)))).toEqual([]); expectErrors.push('Error: Board image request failed');
    await page.route('**/blobs/*', async route => {
    if (route.request().method() !== 'GET' || !decodeURIComponent(route.request().url()).endsWith(key)) return route.continue();
    if (fail) return route.fulfill({ status: 503, json: { code: 'SYNTHETIC_IMAGE_FAILURE' } });
    const response = await route.fetch(); held++; await gate; await route.fulfill({ response }).catch(() => undefined);
  });
  try {
    await page.reload(); await expect(saveTrigger(page)).toContainText('Image not saved');
    // Complete native failure before testing recovery-only coalescing.
    await expect.poll(() => page.locator('affine-edgeless-image').evaluateAll((elements, id) => {
      const image = elements.find(element => (element as unknown as { model: { props: { sourceId: string } } }).model.props.sourceId === id);
      return (image as unknown as { resourceController: { resolvedState$: { value: { error: boolean } } } } | undefined)?.resourceController.resolvedState$.value.error;
    }, key)).toBe(true);
    const nativeBeforePreview = await nativeRecoveryModel(page); await failDetailsPreview(page);
    const dialog = await openSaveDetails(page); const rows = dialog.getByRole('listitem');
    await group('E2/partial', async () => {
      await expect(rows).toHaveCount(2); await expect(rows.first()).toContainText('Image not saved'); await expect(rows.last()).toContainText('Saved');
      await expect(rows.last().locator('.save-details-preview')).toHaveAttribute('aria-hidden', 'true'); await expect(rows.last().locator('img')).toHaveCount(0);
      expect(await nativeRecoveryModel(page)).toBe(nativeBeforePreview);
    });
    await restoreDetailsPreview(page);
    const labels = await rows.locator('strong').allTextContents();
    await group('E2/error', async () => { await expect(rows.first()).toContainText('Image not saved'); await expect(rows.last()).toContainText('Saved'); expect(await rows.locator('strong').allTextContents()).toEqual(labels); });
    await group('E2/loading', async () => {
      await rows.evaluateAll(elements => { Object.assign(window, { matrixImageRows: elements }); });
      fail = false; const retry = dialog.getByRole('button', { name: 'Retry now', exact: true }); await retry.focus(); await retry.press('Enter');
      await expect.poll(() => held).toBe(1); await expect(retry).toBeFocused(); await expect(downloadButton(page)).toBeEnabled();
      expect(await rows.locator('strong').allTextContents()).toEqual(labels); release(); await expect(saved(page)).toBeVisible();
      await expect(dialog.getByRole('heading', { name: 'Save details' })).toBeFocused(); await expect(rows.first()).toContainText('Saved');
      expect(await rows.evaluateAll(elements => elements.every((el, i) => el === (window as unknown as { matrixImageRows: Element[] }).matrixImageRows[i]))).toBe(true);
    });
    await group('E2/populated', async () => {
      await page.keyboard.press('Escape'); await openSaveDetails(page);
      await expect(details(page).locator('img').first()).toHaveJSProperty('naturalWidth', 8);
      const imageId = await page.locator('editor-host').evaluate(el => (el as EditorHost).store.getBlocksByFlavour('affine:image')[0]!.model.id);
      const before = await nativeRecoveryModel(page); await details(page).getByRole('button', { name: /^Select image:/ }).first().click();
      await expect(details(page)).toHaveCount(0); await expect(page.locator('editor-host')).toBeFocused(); expect(await nativeRecoveryModel(page)).toBe(before);
      await selectedImage(page, imageId);
    });
  } finally { release(); await restoreDetailsPreview(page); }
});

test('@04-16 @04-ui-E1 @04-ui-E2 details cardinality full labels and responsive geometry', async ({ page, baseURL, pageErrors, expectErrors }) => {
  await recoveryBoardFixture(page, baseURL!, saveDetailsFixtures.title); await addDetailImages(page, 1, saveDetailsFixtures.name); await expect(saved(page)).toBeVisible();
  await group('E2/zero-one-many', async () => {
    let dialog = await openSaveDetails(page); await expect(dialog.getByRole('heading', { name: '1 image', exact: true })).toBeVisible(); await page.keyboard.press('Escape');
    await page.locator('editor-host').evaluate(el => { const store = (el as EditorHost).store; store.deleteBlock(store.getBlocksByFlavour('affine:image')[0]!.model); }); await expect(saved(page)).toBeVisible();
    await addDetailImages(page, 50, saveDetailsFixtures.name); await expect(saved(page)).toBeVisible();
    expect(pageErrors.filter(error => !expectErrors.some(allowed => error.includes(allowed)))).toEqual([]); expectErrors.push('Error: Board image request failed');
    await page.route('**/blobs/*', route => route.request().method() === 'GET' ? route.fulfill({ status: 503, json: {} }) : route.continue());
    await page.reload(); await expect(saveTrigger(page)).toContainText('Image not saved'); dialog = await openSaveDetails(page);
    await expect(dialog.getByRole('heading', { name: '50 images', exact: true })).toBeVisible(); await expect(dialog.getByRole('listitem')).toHaveCount(50);
    await dialog.getByRole('button', { name: /^Select image:/ }).last().scrollIntoViewIfNeeded(); await expect(dialog.getByRole('button', { name: /^Select image:/ }).last()).toBeInViewport();
  });
  await group('E1/overflow', async () => {
    await boundedPanel(page, details(page), downloadButton(page));
    for (const width of widths) {
      await page.setViewportSize({ width, height: 800 });
      const title = (await page.locator('.board-title-label').boundingBox())!;
      const status = (await saveTrigger(page).boundingBox())!;
      expect(status.x).toBeGreaterThanOrEqual(0); expect(status.x + status.width).toBeLessThanOrEqual(width);
      if (width <= 900) expect(status.y).toBeGreaterThanOrEqual(title.y + title.height - 1);
      await targetSize(saveTrigger(page));
    }
  });
  await group('E1/long-text', async () => { await page.setViewportSize({ width: 320, height: 480 }); await longLabels(page); });
  await group('E2/overflow', async () => { await boundedPanel(page, details(page), details(page).getByRole('button', { name: /^Select image:/ }).last()); await reducedMotion(page, details(page)); });
  await group('E2/long-text', async () => { await longLabels(page); expect(await details(page).evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true); });
});

test('@04-16 @04-ui-E3 recovery preparation and missing bytes preserve exact pending content', async ({ page, baseURL, pageErrors, expectErrors }) => {
  await recoveryBoardFixture(page, baseURL!, saveDetailsFixtures.title); await addDetailImages(page, 1, saveDetailsFixtures.name); await expect(saved(page)).toBeVisible(); await pendingNote(page); await openSaveDetails(page);
  const barrier = await recoveryAuthorizationBarrier(page);
  const preparationModel = await nativeRecoveryModel(page); const preparationRows = await exactJournal(page);
  const preparedDownloads: Download[] = []; page.on('download', value => preparedDownloads.push(value));
  try {
    await group('E3/loading', async () => {
      const download = page.waitForEvent('download'); await downloadButton(page).click(); await downloadButton(page).evaluate(el => (el as HTMLButtonElement).click());
      await expect.poll(barrier.held).toBe(1); await expect(downloadButton(page)).toBeDisabled(); await expect(details(page)).toContainText('Preparing recovery copy…');
      await details(page).getByRole('button', { name: 'Close save details' }).click(); await openSaveDetails(page); await expect(details(page)).toContainText('Preparing recovery copy…');
      expect(preparedDownloads).toHaveLength(0); expect(await nativeRecoveryModel(page)).toBe(preparationModel); await retainsRecords(page, preparationRows);
      barrier.release(); await download; expect(barrier.held()).toBe(1); expect(preparedDownloads).toHaveLength(1); await retainsRecords(page, preparationRows);
    });
  } finally { barrier.release(); }
  const bytes = Buffer.from(await page.evaluate(() => { const c = document.createElement('canvas'); c.width = c.height = 16; c.getContext('2d')!.fillRect(0, 0, 16, 16); return c.toDataURL().split(',')[1]!; }), 'base64');
  const key = createHash('sha256').update(bytes).digest('base64url') + '='; let available = false;
  expect(pageErrors.filter(error => !expectErrors.some(allowed => error.includes(allowed)))).toEqual([]); expectErrors.push('Error: Board image request failed');
    await page.route('**/blobs/*', route => decodeURIComponent(route.request().url()).endsWith(key) ? available ? route.fulfill({ status: 200, contentType: 'image/png', body: bytes }) : route.fulfill({ status: 503, json: {} }) : route.continue());
  await page.locator('editor-host').evaluate((el, value) => { const store = (el as EditorHost).store; store.updateBlock(store.getBlocksByFlavour('affine:image')[0]!.model, { sourceId: value }); }, key);
  const before = await nativeRecoveryModel(page); const retained = await exactJournal(page); const downloads: Download[] = []; page.on('download', value => downloads.push(value));
  await group('E3/error', async () => {
    await downloadButton(page).click(); await expect(details(page).getByRole('alert')).toContainText(saveDetailsFixtures.name);
    expect(downloads).toHaveLength(0); expect(await nativeRecoveryModel(page)).toBe(before);
    await retainsRecords(page, retained); await expect(downloadButton(page)).toBeEnabled();
  });
  await group('E3/overflow', async () => { await boundedPanel(page, details(page), downloadButton(page)); });
  await group('E3/long-text', async () => { await expect(details(page).getByRole('alert')).toContainText(saveDetailsFixtures.name); await longLabels(page); });
  available = true; await downloadButton(page).click(); await expect.poll(() => downloads.length).toBe(1);
  expect(Object.keys(unzipSync(await downloadBytes(downloads[0]!))).some(path => path.includes(key))).toBe(true);
});

test('@04-16 @04-ui-E3 complete recovery archive imports into an independent private board', async ({ page, context, baseURL }) => {
  await group('E3/populated', async () => {
    const { member, descriptor } = await recoveryBoardFixture(page, baseURL!); await addDetailImages(page, 1); await expect(saved(page)).toBeVisible(); await pendingNote(page);
    const before = await semantic(page); const pending = await exactJournal(page); await openSaveDetails(page); const output = await archive(page);
    await expect(details(page)).toContainText("Recovery copy ready. Check your browser's downloads."); await expect(saved(page)).toHaveCount(0);
    await retainsRecords(page, pending); const copy = await context.newPage(); const clean = watchSecondary(copy);
    try {
      await copy.goto(baseURL!); await copy.getByRole('button', { name: 'Import', exact: true }).click(); const dialog = copy.getByRole('dialog', { name: 'Import board', exact: true });
      await dialog.locator('input[type=file]').setInputFiles({ name: 'Synthetic recovery.bs.zip', mimeType: 'application/zip', buffer: output.bytes });
      await dialog.getByRole('button', { name: 'Import board', exact: true }).click(); await dialog.getByRole('link', { name: 'Open board', exact: true }).click();
      await expect(copy.locator('editor-host')).toBeVisible(); expect(await semantic(copy)).toEqual(before);
      const id = new URL(copy.url()).searchParams.get('board')!; expect(id).not.toBe(descriptor.summary.id);
      const result = await (await copy.request.get(baseURL! + '/api/boards/' + id, { headers: { 'X-Dali-Account': member.accountId } })).json(); expect(result.summary).toMatchObject({ access: 'private', role: 'owner' });
      const assets = Object.entries(output.entries).filter(([name]) => name.startsWith('assets/') && !name.endsWith('/'));
      expect(assets).toHaveLength(before.images.length); expect(assets.length).toBeGreaterThan(0);
      for (const [name, data] of assets) {
        const hash = createHash('sha256').update(data).digest('base64url') + '='; expect(name).toContain(hash);
        const response = await copy.request.get(baseURL! + '/api/boards/' + id + '/blobs/' + encodeURIComponent(hash), { headers: { 'X-Dali-Account': member.accountId } }); expect(response.status()).toBe(200); expect(await response.body()).toEqual(Buffer.from(data));
      }
      await copy.reload(); await expect(copy.locator('editor-host')).toBeVisible(); expect(await semantic(copy)).toEqual(before); clean();
    } finally { await copy.close(); }
  });
});

test('@04-16 @04-ui-E4 valid empty unavailable and denied boards stay distinct', async ({ page, baseURL }) => {
  const { member, descriptor } = await recoveryBoardFixture(page, baseURL!);
  await group('E4/empty', async () => { await expect(page.locator('editor-host')).toBeVisible(); await expect(page.locator('affine-edgeless-note')).toHaveCount(0); });
  await pendingNote(page); const retained = await exactJournal(page); page.on('dialog', dialog => dialog.accept());
  let status = 503; const path = '**/api/boards/' + descriptor.summary.id;
  await page.route(path, route => status ? route.fulfill({ status, json: {} }) : route.continue());
  await group('E4/error', async () => {
    await page.reload(); await expect(page.getByRole('heading', { name: "We couldn't open this board.", exact: true })).toBeVisible(); await expect(page.locator('editor-host')).toHaveCount(0);
    await retainsRecords(page, retained); await group('E4/overflow', () => boardErrorLayout(page, page.getByRole('heading', { name: "We couldn't open this board.", exact: true }))); status = 0; await page.unroute('**/docs/*/push'); await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await expect(page.locator('affine-edgeless-note')).toHaveCount(1); await expect(saved(page)).toBeVisible();
    status = 404; await page.reload(); await expect(page.getByRole('heading', { name: "You don't have access to this board", exact: true })).toBeVisible(); await expect(page.locator('editor-host')).toHaveCount(0); await group('E4/overflow', () => boardErrorLayout(page, page.getByRole('heading', { name: "You don't have access to this board", exact: true })));
    for (const kind of ['corrupt', 'restore'] as const) {
      await page.setViewportSize({ width: 1280, height: 800 });
      const response = await page.request.post('/api/boards', { headers: { Origin: baseURL!, 'X-Dali-Account': member.accountId, 'X-Dali-Request': '1', 'X-Dali-Recovery-Epoch': await fixtureRecoveryEpoch(page.request, member.accountId) }, data: { operationId: crypto.randomUUID(), title: 'Synthetic isolated recovery' } });
      expect(response.status()).toBe(201); const fixture = { descriptor: await response.json() };
      await page.goto('/?board=' + fixture.descriptor.summary.id); await expect(saved(page)).toBeVisible(); await pendingNote(page);
      await page.evaluate(({ boardId, kind }) => new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('dali-account-recovery-v1', 2); request.onerror = () => reject(request.error);
        request.onsuccess = () => { const db = request.result; const tx = db.transaction('journal', 'readwrite'); const store = tx.objectStore('journal'); const rows = store.getAll();
          rows.onsuccess = () => rows.result.filter(row => row.boardId === boardId).forEach(row => store.put(kind === 'corrupt' ? { ...row, schemaVersion: 999 } : { ...row, epoch: '22222222-2222-4222-8222-222222222222', recoveryEpoch: '22222222-2222-4222-8222-222222222222' }));
          tx.oncomplete = () => { db.close(); resolve(); }; tx.onabort = () => reject(tx.error);
        };
      }), { boardId: fixture.descriptor.summary.id, kind });
      const isolated = await exactJournal(page); const replays: string[] = [];
      const recordReplay = (request: import('@playwright/test').Request) => { if (request.method() === 'POST' && request.url().includes('/boards/' + fixture.descriptor.summary.id + '/docs/') && request.url().endsWith('/push')) replays.push(request.url()); };
      page.on('request', recordReplay); await page.reload(); await expect(page.getByRole('heading', { name: 'Recovery needs attention', exact: true })).toBeVisible();
      await expect(page.locator('editor-host')).toHaveCount(0); await retainsRecords(page, isolated); const quarantined = await exactJournal(page); expect(replays).toEqual([]); await group('E4/overflow', () => boardErrorLayout(page, page.getByRole('heading', { name: 'Recovery needs attention', exact: true }))); expect(await exactJournal(page)).toEqual(quarantined); expect(replays).toEqual([]); page.off('request', recordReplay);
      if (kind === 'corrupt') { await expect(page.getByText("These pending changes could not be opened safely. Keep this browser's data and contact your operator for recovery help.", { exact: true })).toBeVisible(); await expect(page.getByRole('button', { name: 'Open restored board', exact: true })).toHaveCount(0); }
      else await expect(page.getByRole('button', { name: 'Open restored board', exact: true })).toBeVisible();
    }
  });
});

test('@04-16 @04-ui-E4 recovery authorization and acknowledgment progress precede content and focus', async ({ page, baseURL }) => {
  const { descriptor } = await recoveryBoardFixture(page, baseURL!); await addDetailImages(page, 1); await expect(saved(page)).toBeVisible(); await pendingNote(page);
  await page.getByRole('button', { name: 'Add sticky note', exact: true }).focus(); await page.unroute('**/docs/*/push');
  const original = await nativeRecoveryModel(page);
  const writes = await documentResponseBarrier(page); const authorization = await holdDescriptor(page, descriptor.summary.id);
  await page.addInitScript(() => {
    Object.assign(window, { matrixJournalReads: 0 }); const transaction = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function(...args: Parameters<IDBDatabase['transaction']>) {
      const names = typeof args[0] === 'string' ? [args[0]] : Array.from(args[0]);
      if (this.name === 'dali-account-recovery-v1' && names.includes('journal')) (window as unknown as { matrixJournalReads: number }).matrixJournalReads++;
      return transaction.apply(this, args);
    };
  });
  page.on('dialog', dialog => dialog.accept());
  try {
    await group('E4/loading', async () => {
      await page.reload(); await expect.poll(authorization.held).toBeGreaterThan(0);
      // Approved contract; currently expected to expose the Opening-board copy gap.
      await expect(page.getByRole('status', { name: '' }).filter({ hasText: /^Checking access…$/ })).toBeVisible(); await expect(page.locator('editor-host')).toHaveCount(0);
      expect(writes.count()).toBe(0); expect(await page.evaluate(() => (window as unknown as { matrixJournalReads: number }).matrixJournalReads)).toBe(0);
      authorization.release(); await expect.poll(writes.held).toBeGreaterThan(0); await expect(page.getByRole('status').filter({ hasText: /^Recovering changes…$/ })).toBeVisible(); await expect(saved(page)).toHaveCount(0);
    });
    await group('E4/populated', async () => {
      await page.evaluate(() => { const b = document.createElement('button'); b.id = 'matrix-user-focus'; b.textContent = 'Keep my focus'; document.body.append(b); }); await page.getByRole('button', { name: 'Keep my focus' }).click(); await page.getByRole('button', { name: 'Keep my focus' }).focus();
      await writes.releaseAll(); await expect(page.locator('affine-edgeless-note')).toHaveCount(1); await expect(page.locator('affine-edgeless-image')).toHaveCount(1);
      await expect(saved(page)).toBeVisible(); await expect(page.getByRole('button', { name: 'Keep my focus' })).toBeFocused();
      await expect.poll(() => page.locator('affine-edgeless-image').evaluate(el => [...el.querySelectorAll('img')].some(img => img.complete && img.naturalWidth > 0))).toBe(true);
      expect(JSON.parse(await nativeRecoveryModel(page))).toEqual(JSON.parse(original));
    });
  } finally { authorization.release(); await writes.releaseAll(); }
});

test('@04-16 @04-ui-E4 valid retained editing context restores after acknowledged recovery', async ({ page, baseURL }) => {
  const { member, descriptor } = await recoveryBoardFixture(page, baseURL!);
  await addDetailImages(page, 1); await expect(saved(page)).toBeVisible(); await pendingNote(page);
  const original = await nativeRecoveryModel(page);
  await page.evaluate(({ accountId, boardId }) => sessionStorage.setItem('dali-recovery-focus', JSON.stringify({ accountId, boardId, label: 'Add sticky note', tag: 'button', elements: [], editing: false })), { accountId: member.accountId, boardId: descriptor.summary.id });
  await page.unroute('**/docs/*/push'); const barrier = await documentResponseBarrier(page, descriptor.summary.id);
  page.on('dialog', dialog => dialog.accept());
  try {
    await group('E4/populated', async () => {
      await page.reload(); await expect.poll(barrier.held).toBeGreaterThan(0);
      await barrier.releaseAll(); await expect(saved(page)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Add sticky note', exact: true })).toBeFocused();
      expect(JSON.parse(await nativeRecoveryModel(page))).toEqual(JSON.parse(original));
      expect(await page.evaluate(() => sessionStorage.getItem('dali-recovery-focus'))).toBeNull();
    });
  } finally { await barrier.releaseAll(); }
});

test('@04-16 @04-ui-E4 paused quota recovery retains readable labels and reachable controls', async ({ page, baseURL }) => {
  await recoveryBoardFixture(page, baseURL!, saveDetailsFixtures.title); await addDetailImages(page, 1, saveDetailsFixtures.name); await expect(saved(page)).toBeVisible(); await failRecoveryStorage(page, 'quota');
  try {
    await page.getByRole('button', { name: 'Add sticky note', exact: true }).click(); await expect(saveTrigger(page)).toContainText('Editing paused'); await openSaveDetails(page);
    await group('E4/overflow', async () => { await boundedPanel(page, details(page), downloadButton(page)); await details(page).getByRole('button', { name: 'Retry saving', exact: true }).scrollIntoViewIfNeeded(); await expect(details(page).getByRole('button', { name: 'Retry saving', exact: true })).toBeInViewport(); });
    await group('E4/long-text', async () => {
      await longLabels(page);
      // Preserve approved quota-specific guidance; do not substitute generic storage copy.
      await expect(details(page)).toContainText("This browser's recovery storage is full. Keep this tab open. Download a recovery copy, free space for this site, then retry saving.");
      expect(await details(page).evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    });
  } finally { await restoreRecoveryStorage(page); }
});

test('@04-16 @04-ui-E5 leave confirmation retains warnings and suppresses duplicate navigation', async ({ page, baseURL }) => {
  await recoveryBoardFixture(page, baseURL!, saveDetailsFixtures.title); await pendingNote(page); await beginNativePreservationHold(page);
  try {
    await page.getByRole('button', { name: 'Add sticky note', exact: true }).click(); await expect.poll(() => page.evaluate(() => (window as unknown as { heldRecoveryCompletions: number }).heldRecoveryCompletions)).toBeGreaterThan(0);
    await page.getByRole('link', { name: 'Dalí', exact: true }).click(); const dialog = page.getByRole('dialog', { name: 'Leave with changes waiting to save?', exact: true });
    await group('E5/error', async () => {
      await expect(dialog.getByRole('alert')).toHaveText('This browser could not preserve all pending changes. Leaving may lose them.'); await expect(dialog.getByRole('button', { name: 'Stay on board' })).toBeFocused();
      const model = await nativeRecoveryModel(page); await dialog.getByRole('button', { name: 'Stay on board' }).click(); expect(await nativeRecoveryModel(page)).toBe(model); await expect(page.getByRole('link', { name: 'Dalí', exact: true })).toBeFocused();
      await page.getByRole('link', { name: 'Dalí', exact: true }).click();
    });
    await group('E5/overflow', async () => {
      await boundedPanel(page, dialog, dialog.getByRole('button', { name: 'Leave board', exact: true }));
      const stay = dialog.getByRole('button', { name: 'Stay on board' }); const leave = dialog.getByRole('button', { name: 'Leave board', exact: true });
      await stay.focus(); await page.keyboard.press('Shift+Tab'); await expect(leave).toBeFocused();
      await page.keyboard.press('Tab'); await expect(stay).toBeFocused();
      await page.getByRole('link', { name: 'Dalí', exact: true }).evaluate(el => (el as HTMLElement).focus());
      expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
    });
    await group('E5/long-text', async () => { await expect(dialog).toHaveAccessibleName('Leave with changes waiting to save?'); await expect(dialog).toHaveAccessibleDescription('Some changes have not reached the server. Stay to retry or download a recovery copy before leaving.'); await wrapsText(dialog.locator('#leave-recovery-description')); await wrapsText(dialog.getByRole('alert')); });
    await group('E5/loading', async () => {
      await page.evaluate(() => { const push = history.pushState.bind(history); Object.assign(window, { matrixDestinations: 0 }); history.pushState = (...args) => { if (new URL(String(args[2]), location.href).pathname === '/' && !new URL(String(args[2]), location.href).search) (window as unknown as { matrixDestinations: number }).matrixDestinations++; return push(...args); }; });
      await dialog.getByRole('button', { name: 'Leave board', exact: true }).click(); await expect(dialog).toHaveAttribute('aria-busy', 'true'); await expect(dialog.getByRole('status')).toHaveText('Leaving board…');
      for (const control of await dialog.getByRole('button').all()) await expect(control).toBeDisabled();
      await dialog.getByRole('button', { name: 'Leave board', exact: true }).evaluate(el => (el as HTMLButtonElement).click()); await releaseNativePreservation(page);
      await expect(page.getByRole('heading', { name: 'Your boards', exact: true })).toBeFocused(); expect(await page.evaluate(() => (window as unknown as { matrixDestinations: number }).matrixDestinations)).toBe(1);
    });
  } finally { await releaseNativePreservation(page); }
});

test.describe('@04-16 @04-ui-E6 library matrix', () => {
  test.use({ entryMode: 'public-entry' });
  let service: Awaited<ReturnType<typeof acceptanceService>>;
  test.beforeEach(async ({ baseURL }) => { service = await acceptanceService(baseURL!); });
  test.afterEach(async () => { await service.close(); });
  test('empty pending and failed inspection preserve authorized cards', async ({ page }) => {
    const account = await libraryRecoveryMember(page, service.origin);
    await group('E6/empty', async () => { await expect(page.locator('[data-board-id]')).toHaveCount(0); await seedLibraryPending(page, 'foreign-synthetic-member', ['foreign-board']); await page.getByRole('button', { name: 'Refresh boards' }).click(); await expect(page.locator('[data-board-id]')).toHaveCount(0); await expect(page.locator('.board-card__pending')).toHaveCount(0); });
    const board = await libraryRecoveryBoard(page, service.origin, account); await seedLibraryPending(page, account, [board.summary.id]);
    await group('E6/loading', async () => {
      await page.evaluate(() => { const original = indexedDB.databases.bind(indexedDB); let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; }); indexedDB.databases = async () => { await gate; return original(); }; Object.assign(window, { restoreInspection: () => { indexedDB.databases = original; release(); } }); });
      await page.getByRole('button', { name: 'Refresh boards' }).click(); await expect(page.locator('[data-board-id]')).toHaveCount(1); await expect(page.getByText('Checking recovery status…', { exact: true })).toBeVisible();
      await page.evaluate(() => (window as unknown as { restoreInspection(): void }).restoreInspection()); await expect(page.locator('.board-card__pending')).toHaveCount(1);
      await expect(page.locator('[data-board-id]')).toHaveCount(1);
      await page.setViewportSize({ width: 320, height: 480 });
      expect(await page.locator('[data-board-id]').evaluate(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; })).toBe(true);
    });
    await group('E6/error', async () => {
      await page.evaluate(() => { const original = indexedDB.databases.bind(indexedDB); Object.assign(window, { restoreInspection: () => { indexedDB.databases = original; } }); indexedDB.databases = async () => { throw new Error('Synthetic inspection failure'); }; });
      await page.getByRole('button', { name: 'Refresh boards' }).click(); await expect(page.getByText('Recovery status unavailable. Refresh boards to try again.', { exact: true })).toBeVisible(); await expect(page.locator('[data-board-id]')).toHaveCount(1);
      await page.evaluate(() => (window as unknown as { restoreInspection(): void }).restoreInspection()); await page.getByRole('button', { name: 'Refresh boards' }).click(); await expect(page.locator('.board-card__pending')).toHaveCount(1);
      await page.route('**/api/boards?*', route => route.fulfill({ status: 503, json: {} })); await page.getByRole('button', { name: 'Refresh boards' }).click(); await expect(page.getByText("We couldn't load your boards. Try again.", { exact: true })).toBeVisible(); await expect(page.locator('[data-board-id]')).toHaveCount(0);
    });
  });
  test('fifty markers preserve metadata layout labels and exact acknowledgment', async ({ page, context }) => {
    const account = await libraryRecoveryMember(page, service.origin); const ids: string[] = [];
    for (let i = 0; i < 50; i++) ids.push((await libraryRecoveryBoard(page, service.origin, account, i === 0 ? saveDetailsFixtures.title : `Synthetic ${i}`)).summary.id);
    await page.getByRole('button', { name: 'Refresh boards' }).click(); await expect(page.locator('[data-board-id]')).toHaveCount(50);
    const metadata = () => page.locator('[data-board-id]').evaluateAll(cards => cards.map(card => [card.getAttribute('data-board-id'), card.querySelector('small')!.textContent, card.querySelector('.board-card__metadata')!.textContent, card.querySelector('summary')?.getAttribute('aria-label')]));
    const editor = await context.newPage(); const clean = watchSecondary(editor);
    try {
      await editor.goto(service.origin + '/?board=' + ids[0]); await expect(saved(editor)).toBeVisible(); await page.getByRole('button', { name: 'Refresh boards' }).click(); await expect(page.getByText('Loading your boards…', { exact: true })).toHaveCount(0); await expect(page.locator('[data-board-id]')).toHaveCount(50); const before = await metadata();
      await seedLibraryPending(page, account, ids.slice(1)); await expect(page.locator('.board-card__pending')).toHaveCount(49); await pendingNote(editor); await page.getByRole('button', { name: 'Refresh boards' }).click(); await expect(page.locator('.board-card__pending')).toHaveCount(50);
      const first = page.locator(`[data-board-id="${ids[0]}"]`);
      await group('E6/populated', async () => { await expect.poll(metadata).toEqual(before); const marker = first.locator('.board-card__pending'); const metaBox = (await first.locator('.board-card__metadata').boundingBox())!; expect((await marker.boundingBox())!.y).toBeGreaterThanOrEqual(metaBox.y + metaBox.height); await first.locator('summary').click(); await expect(first.getByRole('button', { name: 'Rename board' })).toBeVisible(); await expect(first.getByRole('button', { name: 'Rename board' })).toBeEnabled(); await page.keyboard.press('Escape'); });
      await group('E6/partial', async () => { const previewless = page.locator(`[data-board-id="${ids[1]}"]`); await expect(previewless.getByText('Preview unavailable')).toBeVisible(); await expect(previewless.locator('.board-card__pending')).toBeVisible(); });
      await group('E6/overflow', async () => { for (const width of widths) {
        await page.setViewportSize({ width, height: width === 320 ? 480 : 800 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        expect(await page.locator('[data-board-id]').evaluateAll(cards => cards.every(card => { const b = card.getBoundingClientRect(); const m = card.querySelector('.board-card__pending')!.getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth && m.left >= b.left && m.right <= b.right; }))).toBe(true);
        if (width === 320) expect(await page.locator('[data-board-id]').evaluateAll(cards => new Set(cards.map(card => Math.round(card.getBoundingClientRect().left))).size)).toBe(1);
        const last = page.locator('[data-board-id]').last(); await targetSize(last.locator('summary')); await last.locator('summary').scrollIntoViewIfNeeded(); await last.locator('summary').click(); await expect(last.getByRole('button', { name: 'Rename board' })).toBeInViewport(); await page.keyboard.press('Escape'); await reducedMotion(page, page.locator('.board-grid')); await textContrast(first);
      } });
      await group('E6/long-text', async () => { await page.setViewportSize({ width: 320, height: 480 }); await expect(first.getByRole('link', { name: `Open ${saveDetailsFixtures.title}`, exact: true })).toHaveAccessibleName(`Open ${saveDetailsFixtures.title}`); await expect(first.getByRole('link')).toHaveAccessibleDescription(/Open this board in this browser/); await wrapsText(first.locator('.board-card__pending p')); const marker = (await first.locator('.board-card__pending').boundingBox())!; const menu = (await first.locator('summary').boundingBox())!; expect(marker.y).toBeGreaterThanOrEqual(menu.y + menu.height); });
      await group('E6/zero-one-many', async () => {
        await expect(page.locator('.board-card__pending')).toHaveCount(50);
        // Later route has priority; route.fetch reaches the real server without an unguarded gap.
        const acknowledgment = await documentResponseBarrier(editor, ids[0]);
        try {
          await expect.poll(acknowledgment.held).toBeGreaterThan(0); await page.getByRole('button', { name: 'Refresh boards' }).click(); await expect(page.locator('.board-card__pending')).toHaveCount(50); await expect(saved(editor)).toHaveCount(0);
          await acknowledgment.releaseAll(); await expect(saved(editor)).toBeVisible(); await expect(first.locator('.board-card__pending')).toHaveCount(0); await expect(page.locator(`[data-board-id="${ids[1]}"] .board-card__pending`)).toHaveCount(1); await expect(page.locator('.board-card__pending')).toHaveCount(49);
        } finally { await acknowledgment.releaseAll(); }
      }); clean();
    } finally { await editor.close(); }
  });
});
