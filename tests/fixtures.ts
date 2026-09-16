import { test as base, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

/**
 * Every test gets console/page-error checking automatically.
 *
 * Opt-in collection meant a test only failed on errors if its author remembered
 * to ask, which quietly left the direct-manipulation tests ungated. Collection
 * now starts before navigation and is asserted after the body runs, so a test
 * cannot silently pass over a broken page.
 *
 * A test that legitimately provokes errors (the blocked-IndexedDB case) declares
 * them with `expectErrors`.
 */
export const test = base.extend<{
  /** Substrings of errors this test is allowed to produce. */
  expectErrors: string[];
  pageErrors: string[];
  /** Public and explicit legacy inventory tests retain their own entry flow. */
  entryMode: 'auto' | 'account' | 'public-entry' | 'local-only';
}>({
  browser: [async ({ browser, browserName, playwright, launchOptions }, use) => {
    if (browserName !== 'webkit') { await use(browser); return; }
    // The installed WebKit runtime stalls on navigation in its 64th context,
    // including a minimal app-readiness probe. Isolate its process lifecycle
    // while preserving Playwright's complete native context options/fixtures.
    const original = browser.newContext.bind(browser);
    browser.newContext = async options => {
      const isolated = await playwright.webkit.launch(launchOptions);
      try {
        const context = await isolated.newContext(options);
        const close = context.close.bind(context);
        context.close = async options => {
          try { await close(options); } finally { await isolated.close(); }
        };
        return context;
      } catch (error) { await isolated.close(); throw error; }
    };
    try { await use(browser); } finally { browser.newContext = original; }
  }, { scope: 'worker' }],

  expectErrors: [[], { option: true }],
  entryMode: ['auto', { option: true }],
  page: async ({ page, context, baseURL, entryMode }, use, testInfo) => {
    const publicSuite = /(?:authentication|board-access|board-library|board-sharing|board-actions|board-roles|session-recovery|local-board-import|access-boundaries|accessibility-access|account-workspace)\.spec\.ts$/.test(testInfo.file);
    const account = entryMode === 'account' || (entryMode === 'auto' && !publicSuite);
    const original = page.goto.bind(page); let boardId: string | undefined;
    page.goto = async (url, options) => {
      if (account && url === '/') {
        if (!boardId) {
          await original('/auth/start');
          await page.getByRole('link', { name: 'Synthetic Owner', exact: true }).click();
          await expect(page.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
          const session = await context.request.get('/api/session'); expect(session.status()).toBe(200);
          const member = await session.json();
          const response = await context.request.post('/api/boards', { headers: { Origin: baseURL!, 'X-Dali-Account': member.accountId, 'X-Dali-Request': '1' }, data: { operationId: randomUUID(), title: 'Untitled board' } });
          expect(response.status()).toBe(201); boardId = (await response.json()).summary.id as string;
        }
        return original('/?board=' + encodeURIComponent(boardId), options);
      }
      return original(url, options);
    };
    try { await use(page); } finally { page.goto = original; }
  },

  pageErrors: [
    async ({ page, expectErrors }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(`console: ${m.text()}`);
      });

      await use(errors);

      const unexpected = errors.filter(
        (e) => !expectErrors.some((allowed) => e.includes(allowed))
      );
      expect(unexpected, 'unexpected console/page errors').toEqual([]);
    },
    // auto: applies to EVERY test whether or not it names the fixture. Without
    // this, lazy fixture resolution would silently skip the gate.
    { auto: true },
  ],
});

export { expect };
