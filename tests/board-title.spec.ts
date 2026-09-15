import { fileAction } from './app-menu';
import { test, expect } from './fixtures';

test('inline title saves with Enter and survives reload without replacing canvas', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('affine-edgeless-root')).toHaveCount(1);
  await page.locator('affine-edgeless-root').evaluate(el => el.setAttribute('data-title-sentinel', 'mounted'));
  await page.getByRole('textbox', { name: 'Board name' }).fill('Synthetic planning');
  await page.getByRole('textbox', { name: 'Board name' }).press('Enter');
  await expect(page.locator('affine-edgeless-root')).toHaveAttribute('data-title-sentinel', 'mounted');
  await expect(page.getByRole('textbox', { name: 'Board name' })).toBeEnabled();
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Board name' })).toHaveValue('Synthetic planning');
  await fileAction(page, 'All boards');
  await expect(page.getByRole('button', { name: 'Open Synthetic planning', exact: true })).toBeVisible();
});

test('inline title cancels on Escape, rejects blanks, and saves on blur', async ({ page }) => {
  await page.goto('/');
  const title = page.getByRole('textbox', { name: 'Board name' });
  await title.fill('Discard'); await title.press('Escape');
  await expect(title).toHaveValue('Untitled board');
  await title.fill('   '); await title.press('Enter');
  await expect(title).toHaveValue('Untitled board');
  await title.fill('Blur saved'); await page.mouse.click(400, 500);
  await expect(title).toBeEnabled();
  await page.reload(); await expect(title).toHaveValue('Blur saved');
});

test('hand drags the viewport without changing objects and Select restores selection', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Shapes', exact: true }).click();
  await page.getByRole('button', { name: 'Square / rectangle', exact: true }).click();
  await page.mouse.move(350, 300); await page.mouse.down(); await page.mouse.move(450, 380); await page.mouse.up();
  const read = () => page.locator('affine-edgeless-root').evaluate((el: any) => ({
    center: [el.gfx.viewport.center.x, el.gfx.viewport.center.y],
    shapes: el.gfx.surface.elementModels.filter((x: any) => x.type === 'shape').map((x: any) => ({ id: x.id, xywh: x.xywh })),
  }));
  const before = await read();
  await page.getByRole('button', { name: 'Hand', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Hand', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.move(400, 340); await page.mouse.down(); await page.mouse.move(510, 420, { steps: 12 }); await page.mouse.up();
  await expect.poll(async () => (await read()).center).not.toEqual(before.center);
  expect((await read()).shapes).toEqual(before.shapes);
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Select', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Select', exact: true }).locator('svg')).toHaveCount(1);
});
