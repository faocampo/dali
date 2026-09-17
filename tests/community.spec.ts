import { fileAction } from './app-menu';
import { expect, test } from './fixtures';
import type { EditorHost } from '@blocksuite/affine/std';

async function openCanvas(page: import('@playwright/test').Page) {
  await page.goto('/');
  await expect(page.getByTestId('board-action-menu')).toBeVisible();
  await expect(page.locator('affine-edgeless-root')).toBeAttached();
}

// Playwright provides a fresh browser context, including IndexedDB, per test.
test.beforeEach(async ({ page }) => openCanvas(page));

test('opens the empty canvas with local home navigation', async ({ page }) => {
  await expect(page.getByRole('link', { name: 'Full DJAI Canvas' })).toHaveCount(0);
  await expect(page.locator('header').getByRole('button', { name: 'Export', exact: true })).toHaveCount(0);
  await fileAction(page, 'Export board');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Main Menu', exact: true })).toBeFocused();
  for (const name of ['Insert image', 'Add sticky note', 'Add text', 'Layers', 'Main Menu']) {
    await expect(page.getByRole('button', { name })).toBeVisible();
  }
  await expect(page.locator('affine-edgeless-note')).toHaveCount(0);
});

async function notes(page: import('@playwright/test').Page) {
  return page.locator('editor-host').evaluate((element) => {
    const store = (element as EditorHost).std.store;
    return {
      boardId: store.id,
      notes: store.getBlocksByFlavour('affine:note').map(({ model }) => ({
        id: model.id,
        text: model.children.map(child => child.text?.toString() ?? '').join('\n'),
      })),
    };
  });
}

test('creates, edits and reopens exactly one locally stored sticky note', async ({ page }) => {
  expect((await notes(page)).notes).toEqual([]);
  await page.getByRole('button', { name: 'Add sticky note' }).click();
  const note = page.locator('affine-edgeless-note');
  await expect(note).toHaveCount(1);
  await note.dblclick();
  await page.keyboard.type('Synthetic local canvas idea');
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await notes(page)).notes.map(n => n.text)).toEqual(['Synthetic local canvas idea']);
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  const stored = await notes(page);
  await page.reload();
  await expect(page.locator('affine-edgeless-root')).toBeAttached();
  await expect.poll(() => notes(page)).toEqual(stored);
  await expect(page.locator('editor-host')).toHaveCount(1);
});

test('repeated editor reopen preserves IDs without duplicate objects or handlers', async ({ page }) => {
  await page.getByRole('button', { name: 'Add sticky note' }).click();
  await expect(page.locator('affine-edgeless-note')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  const stored = await notes(page);
  const originalUrl = page.url();
  for (let repeat = 0; repeat < 3; repeat += 1) {
    await fileAction(page, 'All boards');
    await expect(page.locator('editor-host')).toHaveCount(0);
    await page.locator(`a[href="/${new URL(originalUrl).search}"]`).click();
    await expect(page.getByTestId('board-action-menu')).toBeVisible();
    await expect.poll(() => notes(page)).toEqual(stored);
    await expect(page.locator('editor-host')).toHaveCount(1);
  }
  await page.getByRole('button', { name: 'Add sticky note' }).click();
  await expect.poll(async () => (await notes(page)).notes.length).toBe(2);
});

// Explicit opt-in negative control: normal passing suites never inject errors.
test('interrupted mounting and rapid board switching keep the final board isolated', async ({ page }) => {
  await page.getByRole('button', { name: 'Add sticky note' }).click();
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  const first = await notes(page);
  const firstUrl = page.url();
  await fileAction(page, 'All boards');
  await expect(page.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
  const secondTitle = 'Synthetic switch ' + crypto.randomUUID();
  await page.getByRole('textbox', { name: 'Board name', exact: true }).fill(secondTitle);
  await page.getByRole('button', { name: 'New board', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Board name', exact: true })).toHaveValue(secondTitle);
  await expect(page.getByTestId('board-action-menu')).toBeVisible();
  const second = await notes(page);
  const secondUrl = page.url();
  expect(second.boardId).not.toBe(first.boardId);
  expect(second.notes).toEqual([]);

  for (const url of [firstUrl, secondUrl, firstUrl]) {
    await fileAction(page, 'All boards');
    await page.locator(`a[href="/${new URL(url).search}"]`).click();
    // The React header exists before the asynchronous native editor finishes.
    await fileAction(page, 'All boards');
    await expect(page.locator('editor-host')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
    await page.locator(`a[href="/${new URL(url).search}"]`).click();
    await expect(page.getByTestId('board-action-menu')).toBeVisible();
    await expect(page.locator('editor-host')).toHaveCount(1);
    await expect.poll(() => notes(page)).toEqual(url === firstUrl ? first : second);
  }
  await fileAction(page, 'All boards');
  await page.locator(`a[href="/${new URL(secondUrl).search}"]`).click();
  await expect(page.getByTestId('board-action-menu')).toBeVisible();
  await page.getByRole('button', { name: 'Add sticky note' }).click();
  await expect.poll(async () => (await notes(page)).notes.length).toBe(1);
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  await fileAction(page, 'All boards');
  await page.locator(`a[href="/${new URL(firstUrl).search}"]`).click();
  await expect.poll(() => notes(page)).toEqual(first);
});

test.describe('account recovery write failures', () => {
  test.use({ expectErrors: ['Synthetic storage quota'] });
  test('a failed IndexedDB write is reported without a saved acknowledgement', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
    const session = await (await page.request.get('/api/session')).json();
    const boardId = new URL(page.url()).searchParams.get('board');
    const read = async () => { const response = await page.request.get(`/api/boards/${boardId}/editable-export`, { headers: { 'X-Dali-Account': session.accountId } }); expect(response.status()).toBe(200); return response.json(); };
    const before = await read();
    await page.evaluate(() => {
      const put = IDBObjectStore.prototype.put;
      const probe = { failures: 0, restore: () => { IDBObjectStore.prototype.put = put; } }; Object.assign(window, { quotaProbe: probe });
      IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore['put']>) {
        if (this.transaction.db.name === 'dali-account-recovery-v1') {
          probe.failures++;
          throw new DOMException('Synthetic storage quota', 'QuotaExceededError');
        }
        return put.apply(this, args);
      };
    });
    await page.getByRole('button', { name: 'Add sticky note' }).click();
    await expect(page.getByRole('button', { name: 'Retry preservation', exact: true })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { quotaProbe: { failures: number } }).quotaProbe.failures)).toBeGreaterThan(0);
    await expect(page.getByRole('button', { name: 'Saved', exact: true })).toHaveCount(0);
    const pending = await notes(page); expect(pending.notes).toHaveLength(1);
    expect(await read()).toEqual(before);
    await expect(page.getByText('Pending changes could not be secured for sign-in. Keep this tab open and retry preservation.', { exact: true })).toBeVisible();
    await page.evaluate(() => (window as unknown as { quotaProbe: { restore(): void } }).quotaProbe.restore());
    await page.getByRole('button', { name: 'Retry preservation', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Sign in to continue', exact: true })).toBeEnabled();
    await page.reload();
    await expect(page.getByTestId('board-action-menu')).toBeVisible();
    await expect(page.locator('editor-host')).toHaveCount(1);
    await expect.poll(() => notes(page)).toEqual(pending);
    await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
    await page.reload(); await expect(page.locator('editor-host')).toHaveCount(1); await expect.poll(() => notes(page)).toEqual(pending);
  });
});

if (process.env.DALI_ERROR_CONTROL === '1') {
  test('unexpected page error is rejected by the automatic fixture', async ({ page }) => {
    await page.evaluate(() => setTimeout(() => { throw new Error('Synthetic unexpected page error'); }, 0));
    await page.waitForFunction(() => document.readyState === 'complete');
    await page.waitForTimeout(100);
  });
}
