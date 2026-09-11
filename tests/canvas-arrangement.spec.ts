import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import type { GfxController } from '@blocksuite/affine/std/gfx';

async function state(page: Page) {
  return page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    return gfx.gfxElements.map(m => ({ id: m.id, type: 'type' in m ? m.type : m.flavour,
      xywh: JSON.parse(m.xywh) as number[], group: m.group?.id ?? null, index: m.index,
      locked: m.isLocked(), text: 'text' in m ? String(m.text ?? '') : '' }));
  });
}

async function shape(page: Page, x = 240, y = 180) {
  await page.getByRole('button', { name: 'Shape', exact: true }).click();
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 120, y + 80, { steps: 10 });
  await page.mouse.up();
}

test('modifier D duplicates the selected native model on each invocation', async ({ page }) => {
  await page.goto('/');
  await shape(page);
  await page.mouse.click(290, 210);
  const original = await state(page);
  await page.keyboard.press('ControlOrMeta+d');
  await expect.poll(async () => (await state(page)).length).toBe(2);
  await page.keyboard.press('ControlOrMeta+d');
  await expect.poll(async () => (await state(page)).length).toBe(3);
  expect(new Set((await state(page)).map(m => m.id)).size).toBe(3);
  expect((await state(page)).find(m => m.id === original[0]!.id)?.xywh).toEqual(original[0]!.xywh);
});
