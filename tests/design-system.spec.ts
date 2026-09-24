import { test, expect } from './fixtures';
test.use({ actionTimeout: 15000 });

for (const width of [390, 768, 1456]) test(`design system keeps library and editor controls readable at ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 998 });
  await page.goto('/');
  await expect(page.locator('affine-edgeless-root')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const boardUrl = page.url();
  const session = await (await page.request.get('/api/session')).json();
  const boards = [
    'Product discovery', 'Release planning', 'Research synthesis',
    'A board with a long descriptive title that wraps without hiding its actions',
  ].map((title, index) => ({ id: `visual-${index}`, title, updatedAt: Date.UTC(2026, 8, 24, 12, 0), role: 'owner', access: index % 2 ? 'shared' : 'private', pendingCount: 0, accountId: session.accountId }));
  await page.route('**/api/boards?filter=*', route => route.fulfill({ json: boards }));
  await page.goto('/?library');
  await expect(page.locator('.board-card')).toHaveCount(4);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole('button', { name: 'New board', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const boxes = await page.locator('.board-library__create input, .board-library__create button').evaluateAll(nodes => nodes.map(el => el.getBoundingClientRect().toJSON()));
  expect(Math.abs(boxes[0]!.bottom - boxes[1]!.bottom)).toBeLessThanOrEqual(1);
  for (const box of boxes) { expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44); }
  const contrast = await page.locator('.board-library').evaluate(el => {
    const luminance = (value: string) => (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number).map(v => { const n = v / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; }).reduce((a, n, i) => a + n * [.2126, .7152, .0722][i]!, 0);
    return [...el.querySelectorAll<HTMLElement>('h1,p,small,label,button,.board-card__metadata')].filter(node => node.getClientRects().length && !node.matches(':disabled')).map(node => {
      let parent: Element | null = node; let bg = 'rgb(255, 255, 255)';
      while (parent) { const color = getComputedStyle(parent).backgroundColor; if (color !== 'rgba(0, 0, 0, 0)') { bg = color; break; } parent = parent.parentElement; }
      const a = luminance(getComputedStyle(node).color), b = luminance(bg);
      return { text: node.textContent?.slice(0, 40), ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) };
    });
  });
  for (const item of contrast) expect(item.ratio, item.text).toBeGreaterThanOrEqual(4.5);
  await page.screenshot({ animations: 'disabled', path: info.outputPath(`library-${width}.png`) });
  await page.locator('.board-account summary').click();
  await expect(page.getByText('owner@example.org', { exact: true })).toBeVisible();
  expect(await page.locator('.board-account > div').evaluate(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; })).toBe(true);
  await page.keyboard.press('Escape');
  await page.goto(boardUrl);
  await expect(page.locator('affine-edgeless-root')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole('button', { name: 'Main Menu', exact: true }).click();
  const menu = page.locator('.dali-menu-popup');
  expect(await menu.evaluate(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; })).toBe(true);
  await page.screenshot({ animations: 'disabled', path: info.outputPath(`canvas-menu-${width}.png`) });
  await page.keyboard.press('Escape');
  const zoom = page.getByRole('button', { name: /^Zoom, current/ });
  await zoom.click(); await page.getByRole('menuitemradio', { name: '200%', exact: true }).click();
  await expect(zoom).toHaveText('200%'); await expect(zoom).toBeFocused();
  if (width !== 768) {
    await zoom.click(); await page.getByRole('menuitemradio', { name: '100%', exact: true }).click();
    await page.getByRole('button', { name: 'Add sticky note', exact: true }).click();
    await expect(page.locator('affine-edgeless-note')).toBeVisible();
    await page.locator('affine-edgeless-note').click();
    await expect(page.getByRole('combobox', { name: 'Note size', exact: true })).toBeVisible();
    await page.screenshot({ animations: 'disabled', path: info.outputPath(`note-toolbar-${width}.png`) });
    await page.getByRole('button', { name: 'Shapes', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Shapes palette', exact: true })).toBeVisible();
    await page.screenshot({ animations: 'disabled', path: info.outputPath(`palette-${width}.png`) });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Main Menu', exact: true }).click();
    await page.getByRole('menuitem', { name: 'File', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Export board', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.screenshot({ animations: 'disabled', path: info.outputPath(`export-${width}.png`) });
  }
});
