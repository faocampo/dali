import { test as base, expect } from '@playwright/test';
export type { Page, BrowserContext } from '@playwright/test';

/** Browser lifecycle only; suites keep their existing entry and error policies. */
export const test = base.extend({
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
});

export { expect };
