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
