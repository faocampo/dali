import { expect, type Locator, type Page } from '@playwright/test';
import type { GfxController } from '@blocksuite/affine/std/gfx';

/** Preserve every stored field and byte; additions before quarantine are allowed. */
export async function exactJournal(page: Page) {
  return page.evaluate(() => new Promise<Record<string, unknown>[]>((resolve, reject) => {
    const request = indexedDB.open('dali-account-recovery-v1', 2);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result; const tx = db.transaction('journal'); const rows = tx.objectStore('journal').getAll();
      tx.onabort = () => { db.close(); reject(tx.error); };
      tx.oncomplete = () => {
        db.close();
        resolve(rows.result.map(row => ({ ...row, data: Array.from(new Uint8Array(row.data)) })).sort((a, b) => a.id.localeCompare(b.id)));
      };
    };
  }));
}
export async function retainsRecords(page: Page, originals: Record<string, unknown>[]) {
  const rows = await exactJournal(page);
  for (const original of originals) expect(rows.find(row => row.id === original.id)).toEqual(original);
}
export async function targetSize(control: Locator) {
  const box = await control.boundingBox(); expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThanOrEqual(44); expect(box!.width).toBeGreaterThanOrEqual(44);
}
export async function boardErrorLayout(page: Page, heading: Locator) {
  const surface = heading.locator('..');
  for (const width of [1440, 900, 600, 490, 320]) {
    await page.setViewportSize({ width, height: width === 320 ? 480 : 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await surface.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    for (const control of await surface.locator('button, a').all()) {
      await control.scrollIntoViewIfNeeded(); await expect(control).toBeInViewport(); await targetSize(control);
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await surface.evaluate(el => el.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length)).toBe(0);
    await textContrast(surface);
  }
}
export async function wrapsText(text: Locator) {
  expect(await text.evaluate(el => {
    const range = document.createRange(); range.selectNodeContents(el);
    const rects = [...range.getClientRects()]; const parent = el.getBoundingClientRect();
    return { lines: new Set(rects.map(r => Math.round(r.top))).size,
      contained: rects.every(r => r.left >= parent.left - 1 && r.right <= parent.right + 1) };
  })).toMatchObject({ contained: true });
  expect(await text.evaluate(el => { const range = document.createRange(); range.selectNodeContents(el); return new Set([...range.getClientRects()].map(r => Math.round(r.top))).size; })).toBeGreaterThan(1);
}
export async function panelControls(page: Page, panel: Locator) {
  const width = page.viewportSize()!.width;
  for (const button of await panel.getByRole('button').all()) await targetSize(button);
  const actions = panel.locator('.save-details-actions, .leave-recovery-actions');
  if (width <= 490 && await actions.count()) {
    const parent = (await actions.boundingBox())!; let bottom = parent.y;
    for (const button of await actions.getByRole('button').all()) {
      const box = (await button.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(parent.width - 2);
      expect(box.y).toBeGreaterThanOrEqual(bottom - 1); bottom = box.y + box.height;
    }
  }
  if (await panel.locator('.save-details-heading').count()) {
    const header = (await page.locator('header.djai-header').boundingBox())!;
    const box = (await panel.boundingBox())!; expect(box.y).toBeGreaterThanOrEqual(header.y + header.height);
    const close = panel.getByRole('button', { name: 'Close save details', exact: true });
    await close.scrollIntoViewIfNeeded(); await expect(close).toBeInViewport();
  }
}

/** Rendered sRGB text contrast; unsupported compositing fails rather than certifies. */
export async function textContrast(surface: Locator) {
  const failures = await surface.evaluate(root => {
    type RGB = [number, number, number, number];
    const parse = (color: string): RGB => {
      const values = color.match(/[\d.]+/g)?.map(Number);
      if (!color.startsWith('rgb') || !values || values.length < 3) throw new Error(`Unsupported rendered color ${color}`);
      return [values[0]!, values[1]!, values[2]!, values[3] ?? 1];
    };
    const blend = (front: RGB, back: RGB): RGB => [front[0] * front[3] + back[0] * (1-front[3]), front[1] * front[3] + back[1] * (1-front[3]), front[2] * front[3] + back[2] * (1-front[3]), 1];
    const luminance = (rgb: RGB) => rgb.slice(0, 3).map(c => c / 255).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i]!, 0);
    const failures: string[] = [];
    for (const el of [root, ...root.querySelectorAll('*')]) {
      if (!el.getClientRects().length || el.matches(':disabled') || ![...el.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())) continue;
      const style = getComputedStyle(el); const chain: Element[] = []; let parent: Element | null = el;
      while (parent) { chain.unshift(parent); parent = parent.parentElement; }
      let bg: RGB = [255, 255, 255, 1];
      for (const ancestor of chain) {
        const css = getComputedStyle(ancestor);
        if (css.backgroundImage !== 'none' || Number(css.opacity) !== 1) throw new Error('Contrast requires explicit image/opacity sampling for this surface');
        bg = blend(parse(css.backgroundColor), bg);
      }
      const fg = blend(parse(style.color), bg); const a = luminance(fg), b = luminance(bg);
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700);
      if (ratio < (large ? 3 : 4.5)) failures.push(`${el.textContent?.trim().slice(0, 60)}: ${ratio.toFixed(2)}`);
    }
    return failures;
  });
  expect(failures).toEqual([]);
}
export async function selectedImage(page: Page, id: string) {
  await expect.poll(() => page.locator('affine-edgeless-root').evaluate((el, id) => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const selected = gfx.selection.selectedElements;
    const model = selected.find(model => model.id === id);
    if (!model) return { ids: selected.map(model => model.id), centerDistance: -1 };
    const bound = gfx.viewport.toViewBound(model.elementBound);
    return { ids: selected.map(model => model.id), centerDistance: Math.hypot(bound.x + bound.w / 2 - gfx.viewport.width / 2, bound.y + bound.h / 2 - gfx.viewport.height / 2) };
  }, id)).toMatchObject({ ids: [id] });
  const distance = await page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const bound = gfx.viewport.toViewBound(gfx.selection.selectedElements[0]!.elementBound);
    return Math.hypot(bound.x + bound.w / 2 - gfx.viewport.width / 2, bound.y + bound.h / 2 - gfx.viewport.height / 2);
  });
  expect(distance).toBeLessThan(3);
}

/** Arms all matching authorization requests, with no dependency on request ordinals. */
export async function holdDescriptor(page: Page, boardId: string) {
  let armed = true; let held = 0; let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/boards/' + boardId, async route => {
    if (route.request().method() !== 'GET') return route.continue();
    if (armed) { held++; await gate; }
    await route.continue().catch(() => undefined);
  });
  return { held: () => held, release: () => { armed = false; release(); } };
}

/** Optional thumbnail failure only; native image elements and blob URLs stay intact. */
export async function failDetailsPreview(page: Page) {
  await page.evaluate(() => {
    const fail = () => document.querySelectorAll<HTMLImageElement>('.save-details-image img').forEach(img => {
      if (img.dataset.matrixPreviewFailed) return;
      img.dataset.matrixPreviewFailed = 'true';
      // Real decode failure on the optional preview element, never on native images.
      img.src = 'data:image/png;base64,AA==';
    });
    const observer = new MutationObserver(fail); observer.observe(document.body, { childList: true, subtree: true }); fail();
    Object.assign(window, { restoreMatrixPreviews: () => observer.disconnect() });
  });
}
export async function restoreDetailsPreview(page: Page) {
  await page.evaluate(() => (window as unknown as { restoreMatrixPreviews?: () => void }).restoreMatrixPreviews?.());
}
