import { test, expect } from './fixtures';

test.use({ expectErrors: ['Failed to load resource: the server responded with a status of 401 (Unauthorized)'] });

test('@03-02-01 UI-AUTH-loading keeps protected content unmounted until session validation', async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/session', async route => { await pending; await route.continue(); });
  await page.goto('/');
  await expect(page.getByRole('status')).toHaveText('Signing you in…');
  await expect(page.getByRole('heading', { name: 'Your boards' })).toHaveCount(0);
  await expect(page.locator('affine-editor-container')).toHaveCount(0);
  expect(await page.evaluate(async () => (await indexedDB.databases()).length)).toBe(0);
  release();
  await expect(page.getByRole('link', { name: 'Synthetic Owner', exact: true })).toBeVisible();
});

test('@03-02-01 ordinary entry signs in through OIDC and explicit logout stays signed out', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Synthetic Owner', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Synthetic Owner', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
  await expect(page.getByText('owner@example.org', { exact: true })).toBeVisible();
  const session = await context.request.get('/api/session');
  expect(session.status()).toBe(200);
  expect(Object.keys(await session.json()).sort()).toEqual(['accountId', 'displayName', 'email', 'expiresAt']);
  expect(session.headers()['cache-control']).toBe('private, no-store');
  await page.getByRole('button', { name: 'Sign out of Dalí', exact: true }).click();
  await expect(page.getByRole('heading', { name: "You're signed out of Dalí" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Sign in again' })).toBeVisible();
  expect((await context.request.get('/api/session')).status()).toBe(401);
  await expect(page.getByText('owner@example.org', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Sign in again' }).click();
  await expect(page.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
});
