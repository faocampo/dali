import { expect, type Page, type Route } from '@playwright/test';
import { syntheticCanaries } from './access-fixtures';
export { recoveryBoardFixture as saveBoardFixture } from './recovery-fixtures';

export async function addSavedImage(page: Page, name = 'Synthetic image.png') {
  const bytes = syntheticCanaries().imageBytes;
  await page.locator('input[type=file][accept="image/*"]').setInputFiles({ name, mimeType: 'image/png', buffer: bytes });
  await expect(page.locator('affine-edgeless-image')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
  return bytes;
}

/** Fetches the actual server response, then holds its delivery to the active browser. */
export async function documentResponseBarrier(page: Page, boardId?: string) {
  let bypass = false; let requests = 0; const held: { release: () => void; delivered: Promise<void> }[] = [];
  const handler = async (route: Route) => {
    if (bypass || (boardId && !new URL(route.request().url()).pathname.includes(`/boards/${boardId}/`))) return route.continue();
    requests++;
    const response = await route.fetch();
    expect(response.status()).toBe(200); expect((await response.json()).acknowledged).toBe(true);
    if (bypass) return route.fulfill({ response });
    let release!: () => void; const ready = new Promise<void>(resolve => { release = resolve; });
    let delivered!: () => void; const done = new Promise<void>(resolve => { delivered = resolve; });
    held.push({ release, delivered: done }); await ready;
    await route.fulfill({ response }).catch(() => undefined); delivered();
  };
  await page.route('**/docs/*/push', handler);
  return { count: () => requests, held: () => held.length,
    async release(index: number) { const item = held[index]!; item.release(); await item.delivered; },
    // Keep the bypass installed for this page's lifetime: removing it while a
    // route.fetch is still in flight races Playwright's automatic continuation.
    async releaseAll() { bypass = true; held.forEach(item => item.release()); await Promise.all(held.map(item => item.delivered)); },
  };
}
