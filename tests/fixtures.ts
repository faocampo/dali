import { test as base, expect } from './browser-fixtures.js';
import { randomUUID } from 'node:crypto';
import type { Page, APIRequestContext } from '@playwright/test';

/** Explicit metadata capture for synthetic direct-API setup operations. */
export async function fixtureRecoveryEpoch(request: APIRequestContext, accountId: string, origin = ''): Promise<string> {
  const response = await request.get(origin + '/api/recovery-state', { headers: { 'X-Dali-Account': accountId } });
  expect(response.status()).toBe(200);
  const state = await response.json(); expect(state.epoch).toMatch(/^[0-9a-f-]{36}$/); return state.epoch;
}

/** Complete synthetic library setup before a test replaces its document. */
export async function waitForAuthenticatedLibrary(page: Page) {
  await expect(page.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
  const session = await page.request.get('/api/session');
  expect(session.status()).toBe(200);
  const member = await session.json();
  const response = await page.request.get('/api/boards?filter=all', { headers: { 'X-Dali-Account': member.accountId } });
  expect(response.status()).toBe(200);
  const rows: { thumbnailUrl?: string }[] = await response.json();
  await expect(page.getByText('Loading your boards…', { exact: true })).toHaveCount(0);
  await expect(page.locator('.board-card[data-board-id]')).toHaveCount(rows.length);
  // Heading visibility precedes the card effects. Waiting for these real
  // authorized previews prevents test goto/reload from cancelling their reads.
  await expect(page.locator('.board-card__preview img')).toHaveCount(rows.filter(row => row.thumbnailUrl).length);
}

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
          await waitForAuthenticatedLibrary(page);
          const session = await context.request.get('/api/session'); expect(session.status()).toBe(200);
          const member = await session.json();
          const response = await context.request.post('/api/boards', { headers: { Origin: baseURL!, 'X-Dali-Account': member.accountId, 'X-Dali-Request': '1', 'X-Dali-Recovery-Epoch': await fixtureRecoveryEpoch(context.request, member.accountId) }, data: { operationId: randomUUID(), title: 'Untitled board' } });
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
      const pendingConsole: Promise<void>[] = [];
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
      page.on('console', (m) => {
        if (m.type() !== 'error') return;
        const index = errors.push(`console: ${m.text()}`) - 1;
        // Firefox renders Error objects as "Error" or "JSHandle@object".
        // Preserve that raw text and append concrete error identity; a failed
        // argument read leaves the original strict collector entry intact.
        pendingConsole.push(Promise.all(m.args().map(arg => arg.evaluate(value =>
          value && typeof value.name === 'string' && typeof value.message === 'string'
            ? `${value.name}: ${value.message}` : ''
        ).catch(() => ''))).then(details => {
          const identities = details.filter(Boolean);
          if (identities.length) errors[index] += ` [${identities.join('; ')}]`;
        }));
      });

      await use(errors);
      await Promise.all(pendingConsole);

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
