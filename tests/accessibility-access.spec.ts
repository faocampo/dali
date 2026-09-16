import { randomUUID } from 'node:crypto';
import { test, expect, acceptanceService } from './access-fixtures';
import type { Page } from '@playwright/test';

test.use({ expectErrors: ['the server responded with a status of 401', 'the server responded with a status of 404'] });
let service: Awaited<ReturnType<typeof acceptanceService>>; let accountId: string;
test.beforeEach(async ({ page, baseURL }) => {
  service = await acceptanceService(baseURL!);
  await page.goto(service.origin + '/auth/start'); await page.getByRole('link', { name: 'Synthetic Owner', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
  accountId = (await (await page.request.get(service.origin + '/api/session')).json()).accountId;
});
test.afterEach(async () => { await service.close(); });
const headers = () => ({ Origin: service.origin, 'X-Dali-Account': accountId, 'X-Dali-Request': '1' });
async function create(page: Page, title: string) {
  const response = await page.request.post(service.origin + '/api/boards', { headers: headers(), data: { title, operationId: randomUUID() } });
  expect(response.status()).toBe(201); return response.json();
}
async function geometry(page: Page, selector: string) {
  const result = await page.locator(selector).evaluate(el => ({
    overflow: document.documentElement.scrollWidth > innerWidth,
    controls: [...el.querySelectorAll<HTMLElement>('button,input:not([type=checkbox]),select,summary,a[href]')].filter(node => node.getClientRects().length && !node.closest('[hidden]')).map(node => {
      const r = node.getBoundingClientRect(); return { name: node.getAttribute('aria-label') || node.textContent?.trim() || node.tagName, height: r.height, width: r.width };
    }),
  }));
  expect(result.overflow).toBe(false); expect(result.controls.length).toBeGreaterThan(0);
  for (const control of result.controls) { expect(control.height, control.name).toBeGreaterThanOrEqual(44); expect(control.width, control.name).toBeGreaterThanOrEqual(44); }
  return result;
}

test('@03-12-smoke recovery dialog contains focus and keeps actions visible at 490 and 1404px', async ({ page }, testInfo) => {
  await page.clock.install(); const board = await create(page, 'Synthetic recovery ' + '界'.repeat(120));
  await page.goto(service.origin + '/?board=' + board.summary.id); await expect(page.locator('affine-edgeless-root')).toBeVisible();
  await page.getByRole('textbox', { name: 'Board name', exact: true }).focus();
  await page.clock.fastForward(86400001);
  const dialog = page.getByRole('dialog'); const resume = dialog.getByRole('button', { name: 'Sign in to continue', exact: true });
  await expect(resume).toBeEnabled(); await expect(dialog).toContainText('Session expired');
  for (const width of [490, 1404]) {
    await page.setViewportSize({ width, height: 800 }); await geometry(page, 'dialog');
    await resume.focus();
    for (let i = 0; i < 8; i++) { await page.keyboard.press(i % 2 ? 'Shift+Tab' : 'Tab'); expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true); }
    await page.keyboard.press('Escape'); await expect(dialog).toBeVisible();
    expect(await resume.evaluate(el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth; })).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`synthetic-recovery-${width}.png`) });
  }
  const before = service.database.prepare('SELECT update_bytes FROM board_documents WHERE board_id=? ORDER BY doc_id').all(board.summary.id);
  await dialog.dispatchEvent('compositionstart'); await dialog.dispatchEvent('keydown', { key: 'Enter', isComposing: true }); await dialog.dispatchEvent('compositionend');
  await expect(dialog).toBeVisible(); expect(service.database.prepare('SELECT update_bytes FROM board_documents WHERE board_id=? ORDER BY doc_id').all(board.summary.id)).toEqual(before);
});

test('rendered contrast, 44px targets and fifty long library/sharing rows fit both viewports @03-12-ui', async ({ page }, testInfo) => {
  const title = '👩🏽‍💻'.repeat(200); const board = await create(page, title);
  for (let i = 1; i < 50; i++) await create(page, `Synthetic ${String(i).padStart(2, '0')} ` + 'x'.repeat(120));
  for (let i = 0; i < 50; i++) {
    const member = `synthetic-acceptance-member-${i}`;
    const email = `${String(i).padStart(2, '0')}${'m'.repeat(120)}@example.org`;
    service.database.prepare('INSERT INTO members(id,issuer,subject,email,canonical_email,display_name) VALUES(?,?,?,?,?,?)').run(member, service.provider.issuer, member, email, email, email);
    service.database.prepare('INSERT INTO board_grants(board_id,member_id,role) VALUES(?,?,?)').run(board.summary.id, member, i % 2 ? 'editor' : 'viewer');
  }
  await page.reload(); await expect(page.locator('[data-board-id]')).toHaveCount(50);
  await expect(page.getByRole('heading', { name: 'Your boards', exact: true })).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Your boards', exact: true })).toHaveCSS('outline-color', 'rgb(180, 69, 31)');
  const card = page.locator(`[data-board-id="${board.summary.id}"]`);
  await expect(card.getByRole('link', { name: 'Open ' + title, exact: true })).toBeVisible();
  for (const width of [490, 1404]) {
    await page.setViewportSize({ width, height: 900 }); await geometry(page, 'main');
    await expect(page.locator('.board-library__header')).toHaveCSS('padding-left', width <= 700 ? '16px' : '24px');
    await expect(page.locator('.board-library__header')).toHaveCSS('padding-right', width <= 700 ? '16px' : '24px');
    for (const label of await card.locator('.board-card__metadata > span').all()) { await expect(label).toHaveCSS('font-size', '13px'); await expect(label).toHaveCSS('font-weight', '600'); }
    await expect(card.locator('small')).toHaveCSS('font-size', '12px'); await expect(card.locator('small')).toHaveCSS('font-weight', '400');
    const actions = await card.locator('.board-card__actions button').evaluateAll(nodes => nodes.map(node => { const s = getComputedStyle(node); return { color: s.color, size: s.fontSize, weight: s.fontWeight }; }));
    expect(actions.length).toBe(4); for (const action of actions) expect(action).toEqual({ color: 'rgb(27, 26, 24)', size: '13px', weight: '600' });
    await expect(page.getByLabel('Board name', { exact: true })).toHaveCSS('border-top-color', 'rgb(118, 115, 110)');
    await page.getByRole('heading', { name: 'Your boards', exact: true }).evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await expect(page.getByRole('heading', { name: 'Your boards', exact: true })).toBeInViewport();
    await page.keyboard.press('Tab'); await page.getByRole('heading', { name: 'Your boards', exact: true }).focus();
    await expect(page.getByRole('heading', { name: 'Your boards', exact: true })).toHaveCSS('outline-color', 'rgb(180, 69, 31)');
    await expect(page.getByRole('heading', { name: 'Your boards', exact: true })).toHaveCSS('outline-width', '2px');
    await page.screenshot({ path: testInfo.outputPath(`synthetic-library-${width}.png`) });
    await card.getByRole('button', { name: 'Share board' }).click(); const dialog = page.getByRole('dialog', { name: 'Share board' });
    await expect(dialog.getByRole('combobox', { name: 'Access role', exact: true })).toHaveCount(50);
    for (const select of await dialog.locator('select').all()) await expect(select).toHaveCSS('height', '44px');
    await geometry(page, 'dialog');
    for (const label of await dialog.locator('.share-owner > span:not(:first-of-type), .share-row > span:not(:first-of-type)').all()) { await expect(label).toHaveCSS('font-size', '13px'); await expect(label).toHaveCSS('font-weight', '600'); }
    for (const email of await dialog.locator('.share-owner > span:first-of-type, .share-row > span:first-of-type').all()) { await expect(email).toHaveCSS('font-size', '12px'); await expect(email).toHaveCSS('font-weight', '400'); }
    for (const button of await dialog.locator('button:not(.djai-primary)').all()) await expect(button).toHaveCSS('border-top-width', '1px');
    const panel = await dialog.evaluate(el => { const s = getComputedStyle(el); return { width: el.getBoundingClientRect().width, border: s.borderTopWidth, gap: s.gap, size: s.fontSize, weight: s.fontWeight }; });
    expect(panel).toEqual({ width: Math.min(640, width - 32), border: '1px', gap: '0px', size: '15px', weight: '400' });
    await expect(dialog.locator('header')).toHaveCSS('padding', '24px'); await expect(dialog.locator('.share-dialog__body')).toHaveCSS('padding', '24px');
    await expect(dialog.locator('h2')).toHaveCSS('font-size', '20px'); await expect(dialog.locator('h2')).toHaveCSS('font-weight', '600');
    await expect(dialog.getByRole('combobox', { name: 'Access', exact: true })).toHaveCSS('border-top-color', 'rgb(118, 115, 110)');
    const field = dialog.getByRole('combobox', { name: 'Find an internal member or enter an internal email', exact: true }); await expect(field).toBeFocused(); await field.fill('NoSuchMember' + 'x'.repeat(120));
    const before = service.database.prepare('SELECT * FROM board_grants WHERE board_id=? ORDER BY member_id').all(board.summary.id);
    await field.dispatchEvent('compositionstart'); await field.dispatchEvent('keydown', { key: 'Enter', isComposing: true }); await field.dispatchEvent('compositionend');
    expect(service.database.prepare('SELECT * FROM board_grants WHERE board_id=? ORDER BY member_id').all(board.summary.id)).toEqual(before);
    const contrast = await dialog.evaluate(el => {
      const rgb = (value: string) => (value.match(/[\d.]+/g) ?? []).map(Number);
      const luminance = (c: number[]) => c.slice(0, 3).map(v => { const n = v / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; }).reduce((sum, n, i) => sum + n * [.2126, .7152, .0722][i]!, 0);
      return [...el.querySelectorAll<HTMLElement>('h2,p,label,button')].filter(node => node.getClientRects().length && !(node instanceof HTMLButtonElement && node.disabled) && node.textContent?.trim()).map(node => {
        const style = getComputedStyle(node); let parent: Element | null = node; let bg = [255, 255, 255];
        while (parent) { const color = rgb(getComputedStyle(parent).backgroundColor); if (color.length === 3 || color[3] === 1) { bg = color; break; } parent = parent.parentElement; }
        const a = luminance(rgb(style.color)); const b = luminance(bg); return { text: node.textContent!.trim().slice(0, 40), color: style.color, background: bg, ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) };
      });
    });
    await testInfo.attach(`contrast-${width}`, { body: JSON.stringify(contrast), contentType: 'application/json' });
    expect(contrast.length).toBeGreaterThan(5); for (const row of contrast) expect(row.ratio, row.text).toBeGreaterThanOrEqual(4.5);
    await page.screenshot({ path: testInfo.outputPath(`synthetic-sharing-${width}.png`) });
    await dialog.getByRole('button', { name: 'Close', exact: true }).click(); await expect(card.getByRole('button', { name: 'Share board' })).toBeFocused();
    await card.getByRole('button', { name: 'Rename board' }).click(); const action = page.getByRole('dialog', { name: 'Rename board' });
    await geometry(page, 'dialog'); await expect(action).toHaveCSS('font-size', '15px'); await expect(action.getByRole('textbox')).toHaveCSS('border-top-color', 'rgb(118, 115, 110)');
    await expect(action.getByRole('textbox')).toBeFocused(); await expect(action.getByRole('textbox')).toHaveCSS('outline-color', 'rgb(180, 69, 31)'); await expect(action.getByRole('textbox')).toHaveCSS('outline-width', '2px');
    for (const button of await action.getByRole('button').all()) await expect(button).toHaveCSS('border-top-width', '1px');
    await expect(action.getByRole('button', { name: 'Save name' })).toHaveCSS('font-size', '13px'); await expect(action.getByRole('heading')).toHaveCSS('font-weight', '600');
    await page.screenshot({ path: testInfo.outputPath(`synthetic-action-${width}.png`) }); await action.getByRole('button', { name: 'Keep name' }).click();
    await page.getByRole('button', { name: 'Copy local boards' }).click(); const copy = page.getByRole('dialog', { name: 'Copy local boards' });
    await geometry(page, 'dialog'); expect((await copy.boundingBox())!.width).toBe(Math.min(640, width - 32)); await expect(copy.locator('header')).toHaveCSS('padding', '24px');
    await expect(copy.getByRole('button', { name: 'Close local copies' })).toHaveCSS('border-top-width', '1px');
    await page.screenshot({ path: testInfo.outputPath(`synthetic-local-copy-${width}.png`) }); await copy.getByRole('button', { name: 'Close local copies', exact: true }).click();
  }
});

test('real history navigation revalidates revoked board access and reports BFCache outcome @03-12-bfcache', async ({ page }, testInfo) => {
  const board = await create(page, 'Synthetic history canary');
  await page.addInitScript(() => { addEventListener('pageshow', event => { (window as unknown as { cacheRestored: boolean }).cacheRestored = event.persisted; }); });
  await page.goto(service.origin + '/?board=' + board.summary.id); await expect(page.locator('affine-edgeless-root')).toBeVisible();
  await page.goto('about:blank');
  service.database.prepare('INSERT INTO members(id,issuer,subject,email,canonical_email,display_name) VALUES(?,?,?,?,?,?)').run('synthetic-new-owner', service.provider.issuer, 'new-owner', 'new@example.org', 'new@example.org', 'Synthetic New Owner');
  service.database.prepare('UPDATE boards SET owner_id=? WHERE id=?').run('synthetic-new-owner', board.summary.id);
  await page.goBack();
  await expect(page.getByText(/You don't have access to this board|Your access has changed/)).toBeVisible(); await expect(page.locator('affine-edgeless-root')).toHaveCount(0);
  const restored = await page.evaluate(() => (window as unknown as { cacheRestored?: boolean }).cacheRestored === true);
  testInfo.annotations.push({ type: 'bfcache-observation', description: restored ? 'Actual persisted pageshow observed after history navigation' : 'Browser performed ordinary history reload; actual BFCache restoration remains unobserved' });
});
