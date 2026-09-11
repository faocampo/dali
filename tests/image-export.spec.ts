import { test, expect } from './fixtures';

test('whole board offers explicit source scale and exact downloaded dimensions', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Shape', exact: true }).click();
  await page.mouse.move(250, 200);
  await page.mouse.down();
  await page.mouse.move(450, 320, { steps: 10 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Add sticky note', exact: true }).click();
  await page.locator('affine-edgeless-note').dblclick();
  await page.keyboard.insertText('Café Fine text 123');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByRole('radio', { name: 'PNG image' }).check();
  await expect(page.getByRole('radio', { name: '4×', exact: true })).toBeVisible();
  await page.getByRole('radio', { name: '4×', exact: true }).check();
  const preview = await page.getByTestId('export-dimensions').textContent();
  const result = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download', exact: true }).click();
  const download = await result;
  expect(await download.failure()).toBeNull();
  const stream = await download.createReadStream();
  const parts: Buffer[] = [];
  for await (const part of stream!) parts.push(Buffer.from(part));
  const png = Buffer.concat(parts);
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(preview).toContain(`${png.readUInt32BE(16)} × ${png.readUInt32BE(20)}`);
});
