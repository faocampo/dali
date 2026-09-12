import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import type { GfxController } from '@blocksuite/affine/std/gfx';
import type { MindmapElementModel, ShapeElementModel } from '@blocksuite/affine/model';

async function seed(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add mind map', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('Central topic');
}
async function nodes(page: Page) {
  return page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const map = gfx.surface!.elementModels.find(e => e.type === 'mindmap') as MindmapElementModel;
    return [...map.children].map(([id, detail]) => ({ id, ...detail, text: (map.getNode(id)!.element as ShapeElementModel).text?.toString() }));
  });
}

test('@02-03-01 Escape finishes inline editing and retains text and topic selection', async ({ page }) => {
  await seed(page);
  await page.keyboard.insertText('Synthetic edited topic');
  await page.keyboard.press('Escape');
  await expect(page.locator('edgeless-shape-text-editor')).toHaveCount(0);
  expect((await nodes(page)).map(n => n.text)).toEqual(['Synthetic edited topic']);
  await page.keyboard.press('Tab');
  await expect.poll(async () => (await nodes(page)).length).toBe(2);
});

test('@02-03-01 child sibling root Enter and context controls create one intended topic', async ({ page }) => {
  await seed(page); await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await nodes(page)).length).toBe(2);
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('New topic');
  await page.keyboard.insertText('First child'); await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await nodes(page)).length).toBe(3);
  await page.keyboard.press('Enter');
  const before = await nodes(page);
  expect(before[1]!.parent).toBe(before[0]!.id);
  expect(before[2]!.parent).toBe(before[0]!.id);
  expect(before[2]!.index > before[1]!.index).toBe(true);
  await page.getByRole('button', { name: 'Add child', exact: true }).click();
  await expect.poll(async () => (await nodes(page)).length).toBe(4);
  expect((await nodes(page))[3]!.parent).toBe(before[2]!.id);
});

test('@02-03-01 Tab exits editing, Escape exits selection, Shift+Tab reaches chrome', async ({ page }) => {
  await seed(page); await page.keyboard.insertText('Retained');
  await page.keyboard.press('Tab');
  await expect(page.locator('edgeless-shape-text-editor')).toHaveCount(0);
  expect(await nodes(page)).toHaveLength(1);
  await page.keyboard.press('Escape'); await page.keyboard.press('Tab');
  expect(await nodes(page)).toHaveLength(1);
  await page.keyboard.press('Shift+Tab');
  expect(await nodes(page)).toHaveLength(1);
});

test('@02-03-01 composition and terminating Enter preserve inline text and create zero topics', async ({ page }) => {
  await seed(page);
  const input = page.locator('edgeless-shape-text-editor [contenteditable="true"]');
  await page.keyboard.insertText('Synthetic composed text');
  // Constructed composition events prove routing over retained real inline text.
  // Native OS composition text production remains a separately documented check.
  await input.dispatchEvent('compositionstart');
  await input.dispatchEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, composed: true });
  await input.dispatchEvent('compositionend');
  await input.dispatchEvent('keydown', { key: 'Enter', bubbles: true, composed: true });
  await input.dispatchEvent('keyup', { key: 'Enter', bubbles: true, composed: true });
  expect(await nodes(page)).toHaveLength(1);
  await expect(page.locator('edgeless-shape-text-editor')).toHaveCount(1);
  expect((await nodes(page))[0]!.text).toBe('Synthetic composed text');
});

test('@02-03-01 held keys, external shadow input and context focus create no extra topics', async ({ page }) => {
  await seed(page); await page.keyboard.press('Enter');
  await page.keyboard.down('Tab'); await page.keyboard.down('Tab'); await page.keyboard.up('Tab');
  await expect.poll(async () => (await nodes(page)).length).toBe(2);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Add sibling', exact: true }).focus();
  await page.keyboard.press('Tab');
  expect(await nodes(page)).toHaveLength(2);
  await page.evaluate(() => {
    const box = document.createElement('div'); document.body.append(box);
    const shadow = box.attachShadow({ mode: 'open' });
    const input = document.createElement('input'); shadow.append(input); input.focus();
  });
  await page.keyboard.press('Enter'); await page.keyboard.press('Tab');
  expect(await nodes(page)).toHaveLength(2);
});

for (const guard of ['readonly', 'locked', 'multiple', 'detached'] as const) {
  test(`@02-03-01 ${guard} selection cannot create a topic`, async ({ page }) => {
    await seed(page); await page.keyboard.press('Enter');
    const unchanged = await page.locator('affine-edgeless-root').evaluate((el, guard) => {
      const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
      const map = gfx.surface!.elementModels.find(e => e.type === 'mindmap') as MindmapElementModel;
      if (guard === 'readonly') gfx.doc.readonly = true;
      if (guard === 'locked') map.tree.element.lock();
      if (guard === 'multiple') gfx.selection.set({ elements: [map.id, map.tree.id], editing: false });
      if (guard === 'detached') el.closest('editor-host')!.remove();
      const before = JSON.stringify(gfx.doc.spaceDoc.toJSON());
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
      document.body.dispatchEvent(new KeyboardEvent('keyup', { key: 'Tab', bubbles: true }));
      return before === JSON.stringify(gfx.doc.spaceDoc.toJSON());
    }, guard);
    expect(unchanged).toBe(true);
  });
}
