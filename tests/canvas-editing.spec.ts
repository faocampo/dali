import { test, expect } from './fixtures';

test('drawing palette stays on the left at both supported sizes', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('board-action-menu')).toBeVisible();
  for (const viewport of [{ width: 1280, height: 800 }, { width: 900, height: 700 }]) {
    await page.setViewportSize(viewport);
    const palette = page.locator('edgeless-toolbar-widget .edgeless-toolbar-container');
    await expect(palette).toBeVisible();
    await expect.poll(async () => (await palette.boundingBox())!.x).toBeLessThan(120);
    const box = (await palette.boundingBox())!;
    expect(box.width).toBeLessThan(120);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  }
});
