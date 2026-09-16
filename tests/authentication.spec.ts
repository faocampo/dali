import { test, expect } from './fixtures';

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
