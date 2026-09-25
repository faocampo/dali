import { openAccount } from './app-menu';
import { test, expect, waitForAuthenticatedLibrary } from './fixtures';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test.use({ expectErrors: ['Failed to load resource: the server responded with a status of 401 (Unauthorized)', 'Failed to load resource: the server responded with a status of 404 (Not Found)'] });

test('@library-compact external accounts are rejected while approved internal members can sign in', async ({ page, context }) => {
  await page.goto('/'); await page.getByRole('link', { name: 'Synthetic External Account', exact: true }).click();
  await expect(page.getByRole('heading', { name: "We couldn't sign you in." })).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Your boards' })).toHaveCount(0);
  expect((await context.request.get('/api/session')).status()).toBe(401);
  expect((await context.request.get('/api/boards')).status()).toBe(401);
  await page.getByRole('button', { name: 'Sign in again', exact: true }).click();
  await page.getByRole('link', { name: 'Synthetic Internal Member', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
  expect((await context.request.get('/api/session')).status()).toBe(200);
});

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

test('@03-02-02 D-04 persistent session survives a real browser process restart', async ({ playwright, baseURL }) => {
  const directory = await mkdtemp(join(tmpdir(), 'dali-browser-auth-'));
  const errors: string[] = [];
  let context = await playwright.chromium.launchPersistentContext(directory, { baseURL });
  const collect = () => context.on('page', page => {
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !m.text().includes('401 (Unauthorized)')) errors.push(m.text()); });
  });
  try {
    collect(); const page = await context.newPage(); await page.goto('/');
    await page.getByRole('link', { name: 'Synthetic Owner', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
    const before = await (await context.request.get('/api/session')).json();
    const cookie = (await context.cookies()).find(c => c.name === 'dali_session')!;
    expect(cookie.httpOnly).toBe(true); expect(cookie.sameSite).toBe('Lax'); expect(cookie.expires).toBeGreaterThan(Date.now() / 1000);
    await context.clearCookies({ name: 'dali_fixture_identity' });
    await context.close();
    context = await playwright.chromium.launchPersistentContext(directory, { baseURL }); collect();
    const reopened = await context.newPage(); await reopened.goto('/');
    await expect(reopened.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
    expect(await (await context.request.get('/api/session')).json()).toEqual(before);
    expect((await context.cookies()).find(c => c.name === 'dali_session')?.expires).toBe(cookie.expires);
    expect(errors).toEqual([]);
  } finally { await context.close(); await rm(directory, { recursive: true, force: true }); }
});

test('@03-02-02 callback rejection stays on a recoverable error and retries real provider sign-in', async ({ page, context }) => {
  await page.goto('/auth/callback?state=invalid&code=invalid');
  await expect(page.getByRole('heading', { name: "We couldn't sign you in." })).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Your boards' })).toHaveCount(0);
  expect((await context.request.get('/api/session')).status()).toBe(401);
  await page.reload(); await expect(page.getByRole('button', { name: 'Sign in again' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign in again' }).click();
  await page.getByRole('link', { name: 'Synthetic Owner', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your boards' })).toBeVisible();
});

test('@03-02-02 signed provider token with tampered nonce is rejected without account exposure', async ({ page, context }) => {
  await page.route('**/authorize?**', route => {
    const url = new URL(route.request().url()); url.searchParams.set('nonce', 'synthetic-wrong-nonce');
    return route.continue({ url: url.href });
  });
  await page.goto('/'); await page.getByRole('link', { name: 'Synthetic Owner', exact: true }).click();
  await expect(page.getByRole('heading', { name: "We couldn't sign you in." })).toBeFocused();
  expect((await context.request.get('/api/session')).status()).toBe(401);
  await expect(page.getByText('owner@example.org', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Your boards' })).toHaveCount(0);
  await page.unroute('**/authorize?**'); await page.getByRole('button', { name: 'Sign in again' }).click();
  await expect(page.getByRole('heading', { name: 'Your boards' })).toBeVisible();
});

test('@03-02-02 expired browser cookie denies the real session endpoint', async ({ page, context }) => {
  await page.goto('/'); await page.getByRole('link', { name: 'Synthetic Owner', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your boards' })).toBeVisible();
  await waitForAuthenticatedLibrary(page);
  const cookie = (await context.cookies()).find(c => c.name === 'dali_session')!;
  await context.addCookies([{ ...cookie, expires: Math.floor(Date.now() / 1000) - 1 }]);
  expect((await context.request.get('/api/session')).status()).toBe(401);
  await context.clearCookies({ name: 'dali_fixture_identity' }); await page.reload();
  await expect(page.getByRole('link', { name: 'Synthetic Owner', exact: true })).toBeVisible();
});

test('@03-02-02 absolute UI expiry clears account content and offers deliberate reauthentication', async ({ page }) => {
  await page.clock.install(); await page.goto('/');
  await page.getByRole('link', { name: 'Synthetic Owner', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your boards' })).toBeVisible();
  await page.clock.fastForward(86400001);
  await expect(page.getByRole('heading', { name: 'Session expired — sign in to continue.' })).toBeVisible();
  await expect(page.getByText('owner@example.org', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sign in to continue', exact: true })).toBeVisible();
});

for (const intent of ['?board=synthetic-board', '?new=1']) {
  test(`@03-02-02 D-01 signed provider restores ${intent}`, async ({ page, context }) => {
    await page.goto(`/${intent}`); await page.getByRole('link', { name: 'Synthetic Owner', exact: true }).click();
    if (intent.startsWith('?board=')) {
      await expect(page.getByRole('heading', { name: "You don't have access to this board" })).toBeVisible();
      expect(new URL(page.url()).search).toBe(intent);
    } else {
      await expect(page.locator('editor-host')).toBeVisible();
      await expect(page.getByRole('button', { name: /^Rename board:/ })).toHaveText('Untitled board');
      const id = new URL(page.url()).searchParams.get('board'); expect(id).toBeTruthy();
      const member = await (await context.request.get('/api/session')).json();
      const descriptor = await context.request.get('/api/boards/' + id, { headers: { 'X-Dali-Account': member.accountId } });
      expect(descriptor.status()).toBe(200);
      expect((await descriptor.json()).summary).toMatchObject({ id, accountId: member.accountId, role: 'owner', access: 'private', title: 'Untitled board' });
    }
  });
}

test('@03-02-02 AUTH-01 empty configuration error is recoverable without mounting protected content', async ({ page }) => {
  await page.goto('/?authError=configuration');
  await expect(page.getByRole('heading', { name: "We couldn't sign you in." })).toBeFocused();
  await expect(page.getByRole('alert')).toHaveText('Try signing in again.');
  await expect(page.getByRole('heading', { name: 'Your boards' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Sign in again' }).click();
  await expect(page.getByRole('link', { name: 'Synthetic Owner', exact: true })).toBeVisible();
});

test('@03-02-01 ordinary entry signs in through OIDC and explicit logout stays signed out', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Synthetic Owner', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Synthetic Owner', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
  await openAccount(page); await expect(page.getByText('owner@example.org', { exact: true })).toBeVisible();
  for (const width of [490, 1404]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect((await page.getByRole('button', { name: 'Sign out of Dalí', exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: `.gsd/auth-${width}.png` });
  }
  const session = await context.request.get('/api/session');
  expect(session.status()).toBe(200);
  const descriptor = await session.json();
  expect(Object.keys(descriptor).sort()).toEqual(['accountId', 'displayName', 'email', 'expiresAt', 'systemRole']);
  expect(descriptor.systemRole).toBe('member');
  expect(session.headers()['cache-control']).toBe('private, no-store');
  await page.getByRole('button', { name: 'Sign out of Dalí', exact: true }).click();
  await expect(page.getByRole('heading', { name: "You're signed out of Dalí" })).toBeFocused();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Sign in again' })).toBeVisible();
  expect((await context.request.get('/api/session')).status()).toBe(401);
  await expect(page.getByText('owner@example.org', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Sign in again' }).click();
  await expect(page.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
});
