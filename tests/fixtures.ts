import { test as base, expect } from '@playwright/test';

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
