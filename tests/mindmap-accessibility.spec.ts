import { openMindmapProperties } from "./mindmap-properties";
import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import type { GfxController } from '@blocksuite/affine/std/gfx';
import type { MindmapElementModel } from '@blocksuite/affine/model';

async function create(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add mind map', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('Central topic');
  await page.keyboard.press('Enter');
  await openMindmapProperties(page);
}

async function expectTopicClear(page: Page) {
  await expect.poll(() => page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const topic = gfx.selection.selectedElements[0]!;
    const bound = gfx.viewport.toViewBound(topic.elementBound);
    const host = el.closest('editor-host')!.getBoundingClientRect();
    const controls = document.querySelector('.mindmap-panel')!.getBoundingClientRect();
    const left = bound.x + host.x, top = bound.y + host.y;
    const separate = left + bound.w + 8 <= controls.left || left >= controls.right + 8 ||
      top + bound.h + 8 <= controls.top || top >= controls.bottom + 8;
    return separate && left >= 8 && top >= 8 && left + bound.w <= innerWidth - 8 && top + bound.h <= innerHeight - 8;
  })).toBe(true);
}

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test(`@02-ui-review committed topic stays clear of one contextual inspector at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await create(page);
    await expectTopicClear(page);
    await page.getByRole('button', { name: 'Add child', exact: true }).click();
    await page.keyboard.type('Synthetic review topic');
    await page.keyboard.press('Enter');
    await openMindmapProperties(page);
    const panel = page.getByRole('region', { name: 'Mind-map topic', exact: true });
    await expect(panel).toBeVisible();
    await expectTopicClear(page);
    await expect(page.getByTestId('selection-inspector')).toHaveCount(0);
    await expect(page.locator('.object-actions-trigger')).toHaveCount(0);
    await page.locator('affine-edgeless-root').evaluate(el => {
      const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
      const id = gfx.surface!.addElement({ type: 'shape', xywh: '[10,10,100,80]' });
      gfx.selection.set({ elements: [id], editing: false });
    });
    await expect(page.getByTestId('selection-inspector')).toBeVisible();
    await expect(panel).toHaveCount(0);
  });
}

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  for (const scale of [1, 2]) test(`@02-05-03 responsive focus targets ${viewport.width}px CSS zoom ${scale}x`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await create(page);
    // CSS zoom is layout magnification evidence, not real browser/OS zoom.
    await page.evaluate(scale => { document.documentElement.style.zoom = String(scale); }, scale);
    const panel = page.getByRole('region', { name: 'Mind-map topic', exact: true });
    await expect(page.getByRole('button', { name: 'Close mind-map controls', exact: true })).toBeVisible({ timeout: 2000 });
    const rect = await panel.boundingBox();
    expect(rect).not.toBeNull();
    expect(rect!.x).toBeGreaterThanOrEqual(8); expect(rect!.y).toBeGreaterThanOrEqual(8);
    expect(rect!.x + rect!.width).toBeLessThanOrEqual(viewport.width - 8);
    expect(rect!.y + rect!.height).toBeLessThanOrEqual(viewport.height - 8);
    const controls = panel.locator('button,input,select');
    for (let i = 0; i < await controls.count(); i++) {
      const control = controls.nth(i);
      await control.scrollIntoViewIfNeeded();
      const box = await control.boundingBox();
      expect(Number(box!.width.toFixed(3))).toBeGreaterThanOrEqual(44 * scale);
      expect(Number(box!.height.toFixed(3))).toBeGreaterThanOrEqual(44 * scale);
    }
    const size = page.getByRole('spinbutton', { name: 'Font size', exact: true });
    await size.focus(); await expect(size).toBeFocused();
    await page.keyboard.press('Tab'); await expect(page.getByRole('combobox', { name: 'Font weight' })).toBeFocused();
    await page.keyboard.press('Shift+Tab'); await expect(size).toBeFocused();
    await page.getByRole('button', { name: 'Close mind-map controls', exact: true }).click();
    await expect(panel).toHaveCount(0);
    await expect(page.locator('editor-host')).toBeFocused();
    await page.keyboard.press('Escape'); await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);
  });
}

test('@02-05-03 empty loading populated partial and long-text states retain usable guidance', async ({ page }) => {
  await page.addInitScript(() => {
    const evidence = { opening: false, mutationAvailable: false };
    Object.assign(window, { mindmapLoadingEvidence: evidence });
    new MutationObserver(() => {
      if ([...document.querySelectorAll('[role="status"]')].some(el => el.textContent === 'Opening board…')) {
        evidence.opening = true;
        evidence.mutationAvailable ||= [...document.querySelectorAll('button')].some(el => el.getAttribute('aria-label') === 'Add mind map' && !el.disabled);
      }
    }).observe(document, { childList: true, subtree: true });
  });
  await page.goto('/');
  await expect(page.getByText('Start a mind map', { exact: true })).toBeVisible({ timeout: 2000 });
  await expect(page.getByText('Add a mind map, then name the central topic. Select a topic and press Tab to add a child or Enter to add a sibling.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { mindmapLoadingEvidence: unknown }).mindmapLoadingEvidence)).toEqual({ opening: true, mutationAvailable: false });
  await page.getByRole('button', { name: 'Add mind map', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('Central topic');
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Backspace');
  await expect.poll(() => page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const map = gfx.surface!.elementModels.find(e => e.type === 'mindmap') as MindmapElementModel;
    return String((map.tree.element as unknown as { text: unknown }).text);
  }), { timeout: 3000 }).toBe('');
  await page.keyboard.press('Enter');
  await openMindmapProperties(page);
  await expect(page.getByText('Topic: Empty topic', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('spinbutton', { name: 'Font size' })).toBeEnabled();
  await page.getByRole('button', { name: 'Add child', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('New topic');
  await page.keyboard.type('A long accessible topic '.repeat(12)); await page.keyboard.press('Enter');
  await openMindmapProperties(page);
  await expect(page.getByRole('status').filter({ hasText: 'Level 1. Parent: Empty topic.' })).toBeVisible();
  await expect(page.getByText('Start a mind map', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Saved locally', exact: true })).toBeVisible();
});

test('@02-05-03 live counts readonly controls error retry and zoomed-out canvas', async ({ page }) => {
  await create(page);
  await page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const map = gfx.surface!.elementModels.find(e => e.type === 'mindmap') as MindmapElementModel;
    map.addNode(map.tree.id, undefined, 'after', { text: 'Research' }); map.layout();
    gfx.selection.set({ elements: [map.tree.id], editing: false }); gfx.viewport.setZoom(0.25);
  });
  await page.getByRole('button', { name: 'Collapse branch', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Expand branch: 1 direct branch hidden' })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByText('Branch collapsed. 1 direct branch hidden.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Expand branch: 1 direct branch hidden' }).click();
  await expect(page.getByText('Branch expanded.', { exact: true })).toBeVisible();
  await page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const map = gfx.surface!.elementModels.find(e => e.type === 'mindmap') as MindmapElementModel;
    const delegate = (map as unknown as { _layout: Parameters<typeof map.setLayoutMethod>[0] })._layout;
    map.setLayoutMethod(() => { map.setLayoutMethod(delegate); throw new Error('Synthetic layout fault'); });
  });
  await page.getByRole('button', { name: 'Arrange mind map', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('The mind map could not be arranged. Try Arrange mind map again.');
  await page.getByRole('button', { name: 'Arrange mind map', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    gfx.doc.readonly = true; gfx.selection.set({ elements: [...gfx.selection.selectedElements.map(e => e.id)], editing: false });
  });
  await expect(page.getByRole('button', { name: 'Arrange mind map', exact: true })).toBeDisabled();
});

test('@02-05-03 rendered panel text controls and keyboard focus have measurable contrast', async ({ page }) => {
  await create(page);
  const panel = page.getByRole('region', { name: 'Mind-map topic', exact: true });
  await page.getByRole('group', { name: 'Mind-map layout', exact: true }).getByRole('button', { name: 'Right', exact: true }).focus();
  const colors = await panel.evaluate(el => {
    const style = getComputedStyle(el);
    const button = el.querySelector('button[aria-pressed="true"]')!;
    const control = getComputedStyle(button);
    return { text: style.color, background: style.backgroundColor, control: control.color,
      controlBackground: control.backgroundColor, border: control.borderColor, focus: control.outlineColor, outline: control.outlineWidth };
  });
  const luminance = (color: string) => {
    const rgb = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(n => n / 255).map(n => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4);
    return rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722;
  };
  const contrast = (a: string, b: string) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
  expect(contrast(colors.text, colors.background)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(colors.control, colors.controlBackground)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(colors.border, colors.background)).toBeGreaterThanOrEqual(3);
  expect(contrast(colors.focus, colors.background)).toBeGreaterThanOrEqual(3);
  expect(parseFloat(colors.outline)).toBeGreaterThanOrEqual(2);
});
