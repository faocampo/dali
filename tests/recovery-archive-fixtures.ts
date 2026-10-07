import { expect, type Page } from '@playwright/test';

/** Shared E3 controller and downstream SaveDetails acceptance fixtures. */
export const recoveryArchiveFixtures = Object.freeze({
  empty: { imageCount: 0 },
  loading: { label: 'Preparing recovery copy…' },
  error: { label: 'Recovery copy could not be prepared' },
  populated: { label: "Recovery copy ready. Check your browser's downloads." },
  overflow: { widths: [1440, 900, 600, 490, 320], imageCount: 50 },
  longText: { title: 'Synthetic recovery '.padEnd(200, 'T'), imageName: 'I'.repeat(120) },
});

export async function recoveryAuthorizationBarrier(page: Page) {
  let held = 0; let released = false; let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/editable-export', async route => {
    const response = await route.fetch(); expect(response.status()).toBe(200);
    if (!released) { held++; await gate; }
    await route.fulfill({ response }).catch(() => undefined);
  });
  return { held: () => held, release: () => { released = true; release(); } };
}
