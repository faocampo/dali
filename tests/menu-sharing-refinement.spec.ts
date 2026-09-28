import { test, expect } from './fixtures';

test('zoom presets support selection, keyboard navigation and dismissal', async ({ page }) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: /^Zoom, current/ });
  for (const value of [25, 50, 100, 200, 300]) {
    await trigger.click();
    await page.getByRole('menuitemradio', { name: `${value}%`, exact: true }).click();
    await expect(trigger).toHaveText(`${value}%`);
    await expect(trigger).toBeFocused();
  }
  await trigger.press('ArrowDown'); await page.keyboard.press('Home'); await page.keyboard.press('Enter');
  await expect(trigger).toHaveText('25%');
  await trigger.click(); await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
  await expect(page.getByRole('menu', { name: 'Zoom presets' })).toHaveCount(0);
  await trigger.click(); await page.mouse.click(900, 600); await expect(page.getByRole('menu', { name: 'Zoom presets' })).toHaveCount(0);
});

test('application menu actions have decorative icons', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Main Menu', exact: true }).click();
  for (const category of ['File', 'Edit', 'Settings', 'Help']) {
    await page.getByRole('menuitem', { name: category, exact: true }).click();
    for (const item of await page.locator('.dali-submenu [role="menuitem"]').all()) await expect(item.locator('svg[aria-hidden="true"]')).toHaveCount(1);
  }
});

for (const width of [1456, 390]) test(`sharing controls align with icons at ${width}`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 998 }); await page.goto('/');
  await page.route('**/grants', async route => {
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    const access = await response.json();
    await route.fulfill({ response, json: { ...access, grants: [
    { id: 'editor', memberId: 'editor', email: 'editor@example.org', displayName: 'Synthetic Editor', role: 'editor', status: 'active', revision: 1 },
    { id: 'viewer', memberId: 'viewer', email: 'viewer@example.org', displayName: 'Synthetic Viewer', role: 'viewer', status: 'active', revision: 1 },
    ] } });
  });
  await page.getByRole('button', { name: 'Share board', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Share board' });
  await expect(dialog.locator('.share-row')).toHaveCount(2);
  for (const row of await dialog.locator('.share-row-controls').all()) {
    const save = (await row.getByRole('button', { name: 'Save access', exact: true }).boundingBox())!;
    const remove = (await row.getByRole('button', { name: 'Remove access', exact: true }).boundingBox())!;
    expect(Math.abs(save.y - remove.y)).toBeLessThan(2);
    if (width > 600) { const select = (await row.getByRole('combobox').boundingBox())!; expect(Math.abs(select.y - save.y)).toBeLessThan(2); }
  }
  for (const button of await dialog.getByRole('button').all()) await expect(button.locator('svg[aria-hidden="true"]')).toHaveCount(1);
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath(`sharing-${width}.png`) });
});
