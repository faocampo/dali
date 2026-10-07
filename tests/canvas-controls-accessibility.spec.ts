import { test, expect } from './fixtures';

for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 640 }]) {
  test(`canvas controls stay named and reachable at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.locator('affine-edgeless-root')).toHaveCount(1);
    for (const name of ['Main Menu', 'Zoom in', 'Zoom out', 'Fit to screen']) {
      const button = page.getByRole('button', { name, exact: true });
      await expect(button).toBeVisible();
      await expect(button).toBeInViewport({ ratio: 1 });
    }
    const controls = page.getByRole('toolbar', { name: 'Viewport and history' });
    await expect(controls.getByRole('button')).toHaveCount(6);
    const before = await controls.getByRole('button', { name: /^Zoom, current/ }).textContent();
    await controls.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await expect(controls.getByRole('button', { name: /^Zoom, current/ })).not.toHaveText(before!);
    await controls.getByRole('button', { name: /^Zoom, current/ }).click();
    await page.getByRole('menuitemradio', { name: '100%', exact: true }).click();
    await expect(controls.getByRole('button', { name: /^Zoom, current/ })).toHaveText('100%');
    await page.getByRole('button', { name: 'Main Menu', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Help', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Canvas shortcuts' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Upstream source' })).toHaveAttribute('href', /github.com\/DJAI-Academy/);
    await page.getByRole('menuitem', { name: 'Upstream source' }).press('Escape');
    await expect(page.getByRole('heading', { name: 'Canvas shortcuts' })).toBeHidden();
  });
}
