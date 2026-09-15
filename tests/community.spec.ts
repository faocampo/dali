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
  await page.getByRole('button', { name: 'Export board', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Export board', exact: true })).toBeFocused();
  for (const name of ['Insert image', 'Add sticky note', 'Add text', 'Layers', 'Export board']) {
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
  await expect(page.getByRole('button', { name: 'Saved locally', exact: true })).toBeVisible();
  const stored = await notes(page);
  await page.reload();
  await expect(page.locator('affine-edgeless-root')).toBeAttached();
  await expect.poll(() => notes(page)).toEqual(stored);
  await expect(page.locator('editor-host')).toHaveCount(1);
});

test('repeated editor reopen preserves IDs without duplicate objects or handlers', async ({ page }) => {
  await page.getByRole('button', { name: 'Add sticky note' }).click();
  await expect(page.locator('affine-edgeless-note')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Saved locally', exact: true })).toBeVisible();
  const stored = await notes(page);
  for (let repeat = 0; repeat < 3; repeat += 1) {
    await page.locator('.djai-board-switcher').click();
    await expect(page.locator('editor-host')).toHaveCount(0);
    await page.getByRole('button', { name: 'Open Untitled board', exact: true }).click();
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
  await expect(page.getByRole('button', { name: 'Saved locally', exact: true })).toBeVisible();
  const first = await notes(page);
  await page.locator('.djai-board-switcher').click();
  await page.getByRole('button', { name: '+ New board', exact: true }).click();
  await expect(page.getByTestId('board-action-menu')).toBeVisible();
  const second = await notes(page);
  expect(second.boardId).not.toBe(first.boardId);
  expect(second.notes).toEqual([]);

  for (const title of ['Untitled board', 'Untitled board 2', 'Untitled board']) {
    await page.locator('.djai-board-switcher').click();
    await page.getByRole('button', { name: `Open ${title}`, exact: true }).click();
    // The React header exists before the asynchronous native editor finishes.
    await page.locator('.djai-board-switcher').click();
    await expect(page.locator('editor-host')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
    await page.getByRole('button', { name: `Open ${title}`, exact: true }).click();
    await expect(page.getByTestId('board-action-menu')).toBeVisible();
    await expect(page.locator('editor-host')).toHaveCount(1);
    await expect.poll(() => notes(page)).toEqual(title === 'Untitled board' ? first : second);
  }
  await page.locator('.djai-board-switcher').click();
  await page.getByRole('button', { name: 'Open Untitled board 2', exact: true }).click();
  await expect(page.getByTestId('board-action-menu')).toBeVisible();
  await page.getByRole('button', { name: 'Add sticky note' }).click();
  await expect.poll(async () => (await notes(page)).notes.length).toBe(1);
  await expect(page.getByRole('button', { name: 'Saved locally', exact: true })).toBeVisible();
  await page.locator('.djai-board-switcher').click();
  await page.getByRole('button', { name: 'Open Untitled board', exact: true }).click();
  await expect.poll(() => notes(page)).toEqual(first);
});

test.describe('local write failures', () => {
  test.use({ expectErrors: ['Synthetic storage quota'] });
  test('a failed IndexedDB write is reported without a saved acknowledgement', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Saved locally', exact: true })).toBeVisible();
    await page.evaluate(() => {
      const transaction = IDBDatabase.prototype.transaction;
      IDBDatabase.prototype.transaction = function (...args: Parameters<IDBDatabase['transaction']>) {
        if (this.name === 'djai-storyboard' && args[1] === 'readwrite') {
          throw new DOMException('Synthetic storage quota', 'QuotaExceededError');
        }
        return transaction.apply(this, args);
      };
    });
    await page.getByRole('button', { name: 'Add sticky note' }).click();
    await expect(page.getByRole('button', { name: 'Save failed', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Saved locally', exact: true })).toHaveCount(0);
    await expect(page.locator('affine-edgeless-note')).toHaveCount(1);
    await page.getByRole('button', { name: 'Save failed', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Local save recovery' })).toContainText('local storage is full');
    await page.reload();
    await expect(page.getByTestId('board-action-menu')).toBeVisible();
    await expect.poll(async () => (await notes(page)).notes).toEqual([]);
  });
});

if (process.env.DALI_ERROR_CONTROL === '1') {
  test('unexpected page error is rejected by the automatic fixture', async ({ page }) => {
    await page.evaluate(() => setTimeout(() => { throw new Error('Synthetic unexpected page error'); }, 0));
    await page.waitForFunction(() => document.readyState === 'complete');
    await page.waitForTimeout(100);
  });
}
