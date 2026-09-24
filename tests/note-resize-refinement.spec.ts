import { test, expect } from './fixtures';

test('manual note resizing scales text with its geometry and supports undo', async ({ page }, info) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add sticky note', exact: true }).click();
  await page.locator('affine-edgeless-note').dblclick();
  await page.keyboard.insertText('A note that scales'); await page.keyboard.press('Escape');
  await page.mouse.click(1000, 600); await page.locator('affine-edgeless-note').click();
  const metrics = () => page.locator('[data-testid="edgeless-note-container"]').evaluate(el => ({ width: el.getBoundingClientRect().width, scale: Number(el.getAttribute('data-scale')) }));
  const before = await metrics();
  const handle = page.locator('.handle[aria-label="bottom-right"] .resize');
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + 120, box.y + 120, { steps: 10 }); await page.mouse.up();
  await expect.poll(async () => (await metrics()).scale).toBeGreaterThan(before.scale);
  const after = await metrics();
  expect(after.width / before.width).toBeCloseTo(after.scale / before.scale, 1);
  await page.screenshot({ path: info.outputPath('proportional-note.png') });
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(async () => (await metrics()).width).toBeCloseTo(before.width, 1);
  await expect.poll(async () => (await metrics()).scale).toBe(before.scale);
});
