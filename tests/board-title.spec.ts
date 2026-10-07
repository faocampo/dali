import { editBoardTitle, fileAction } from './app-menu';
import { test, expect } from './fixtures';

test('inline title saves with Enter and survives reload without replacing canvas', async ({ page }) => {
  await page.goto('/');
  const boardUrl = new URL(page.url());
  await expect(page.locator('affine-edgeless-root')).toHaveCount(1);
  await page.locator('affine-edgeless-root').evaluate(el => el.setAttribute('data-title-sentinel', 'mounted'));
  await (await editBoardTitle(page)).fill('Synthetic planning');
  await page.getByRole('textbox', { name: 'Board name' }).press('Enter');
  await expect(page.locator('affine-edgeless-root')).toHaveAttribute('data-title-sentinel', 'mounted');
  await expect(page.getByRole('button', { name: /^Rename board:/ })).toBeFocused();
  await page.reload();
  await expect(page.getByRole('button', { name: /^Rename board:/ })).toHaveText('Synthetic planning');
  await fileAction(page, 'All boards');
  const boardLink = page.locator(`[data-board-id="${boardUrl.searchParams.get('board')}"]`).getByRole('link', { name: 'Open Synthetic planning', exact: true });
  await expect(boardLink).toBeVisible();
  await expect(boardLink).toHaveAttribute('href', '/' + boardUrl.search);
});

test('rapid acknowledged title edits retain keyboard focus between commits', async ({ page }) => {
  await page.goto('/');
  for (let i = 0; i < 40; i++) {
    const name = `Synthetic keyboard rename ${i}`;
    await (await editBoardTitle(page)).fill(name);
    await page.getByRole('textbox', { name: 'Board name' }).press('Enter');
    const trigger = page.getByRole('button', { name: `Rename board: ${name}`, exact: true });
    await expect(trigger).toBeFocused();
    await expect(page.getByRole('textbox', { name: 'Board name' })).toHaveCount(0);
  }
  await page.reload();
  await expect(page.getByRole('button', { name: 'Rename board: Synthetic keyboard rename 39', exact: true })).toBeVisible();
});

test('inline title cancels on Escape, rejects blanks, and saves on blur', async ({ page }) => {
  await page.goto('/');
  const label = page.getByRole('button', { name: /^Rename board:/ });
  const title = await editBoardTitle(page);
  await title.fill('Discard'); await title.press('Escape');
  await expect(label).toHaveText('Untitled board'); await editBoardTitle(page);
  await title.fill('   '); await title.press('Enter');
  await expect(label).toHaveText('Untitled board'); await editBoardTitle(page);
  await title.fill('Blur saved'); await page.mouse.click(400, 500);
  await expect(label).toHaveText('Blur saved');
  await page.reload(); await expect(label).toHaveText('Blur saved');
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

test('pending keyboard rename preserves focus moved into a new topic', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
  let release!: () => void;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  let held = false;
  await page.route('**/api/boards/*', async route => {
    if (route.request().method() !== 'PATCH') return route.continue();
    const response = await route.fetch();
    expect(response.status()).toBe(200); held = true;
    await barrier; await route.fulfill({ response });
  });
  try {
    await (await editBoardTitle(page)).fill('Synthetic delayed rename');
    await page.getByRole('textbox', { name: 'Board name' }).press('Enter');
    await expect.poll(() => held).toBe(true);
    await page.getByRole('button', { name: 'Add mind map', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('Central topic');
    release();
    await expect(page.getByRole('textbox', { name: 'Board name' })).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('Central topic');
    await page.keyboard.type('Continued topic');
    await expect(page.locator('edgeless-shape-text-editor')).toContainText('Continued topic');
  } finally { release(); }
});

test('Saved waits for committed document revision before an immediate rename', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
  let committed = false; let held = false; let release!: () => void;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/docs/*/push', async route => {
    const response = await route.fetch(); expect(response.status()).toBe(200);
    committed = true; await route.fulfill({ response });
  });
  await page.route('**/api/boards/*', async route => {
    if (route.request().method() !== 'GET' || !committed || held) return route.continue();
    const response = await route.fetch(); expect(response.status()).toBe(200);
    held = true; await barrier; await route.fulfill({ response });
  });
  try {
    await page.getByRole('button', { name: 'Add mind map', exact: true }).click();
    await page.keyboard.type('Synthetic committed topic'); await page.keyboard.press('Escape');
    await expect.poll(() => held).toBe(true);
    await expect(page.getByRole('button', { name: 'Saved, Open save details', exact: true })).toHaveCount(0);
    release();
    await expect(page.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
    await (await editBoardTitle(page)).fill('Synthetic revision aligned');
    await page.getByRole('textbox', { name: 'Board name' }).press('Enter');
    await expect(page.getByRole('textbox', { name: 'Board name' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Rename board: Synthetic revision aligned', exact: true })).toBeVisible();
  } finally { release(); }
});
