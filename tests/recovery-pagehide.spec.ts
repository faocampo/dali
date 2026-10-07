import { test, expect } from './fixtures';
import { recoveryBoardFixture, journalRows } from './recovery-fixtures';
import { addStickyNote } from './sticky-tool';
import type { EditorHost } from '@blocksuite/affine/std';

for (const requestKind of ['session', 'push']) for (const persisted of [false, true]) test(`pagehide aborts active ${requestKind} requests and preserves pending work (${persisted ? 'BFCache' : 'reload'})`, async ({ page, baseURL }) => {
  await recoveryBoardFixture(page, baseURL!);
  await expect(page.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
  await page.evaluate(() => {
    const signals: AbortSignal[] = [];
    Object.assign(window, { recoveryRequestSignals: signals });
    const original = window.fetch;
    window.fetch = (input, init) => {
      const path = new URL(input instanceof Request ? input.url : String(input), location.href).pathname;
      if ((path === '/api/session' || path.endsWith('/push')) && init?.signal) signals.push(init.signal);
      return original(input, init);
    };
  });
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const requests = new Set<string>();
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (requestKind === 'session' ? path === '/api/session' : path.endsWith('/push')) { requests.add(requestKind); await held; }
    await route.continue();
  });
  try {
    await addStickyNote(page);
    await expect.poll(() => requests.has(requestKind)).toBe(true);
    const pending = await journalRows(page);
    expect(pending.length).toBeGreaterThan(0);
    await page.evaluate(persisted => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted })), persisted);
    await expect.poll(() => page.evaluate(() => {
      const signals = (window as unknown as { recoveryRequestSignals: AbortSignal[] }).recoveryRequestSignals;
      return signals.length > 0 && signals.every(signal => signal.aborted);
    })).toBe(true);
    expect(await page.locator('editor-host').evaluate(el => (el as EditorHost).store.readonly)).toBe(true);
    expect(await journalRows(page)).toEqual(expect.arrayContaining(pending));
    release(); await page.unrouteAll({ behavior: 'wait' });
    if (persisted) await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
    else { page.once('dialog', dialog => dialog.accept()); await page.reload(); }
    await expect(page.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
    await expect(page.locator('affine-edgeless-note')).toHaveCount(1);
    await expect.poll(() => journalRows(page)).toEqual([]);
  } finally { release(); }
});
