import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import type { GfxController } from '@blocksuite/affine/std/gfx';
import type { MindmapElementModel } from '@blocksuite/affine/model';

async function seed(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add mind map', exact: true }).click();
  await page.keyboard.press('Escape');
  return page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const map = gfx.surface!.elementModels.find(e => e.type === 'mindmap') as MindmapElementModel;
    const root = map.tree.id;
    const branch = map.addNode(root, undefined, 'after', { text: 'Visible branch' });
    const hidden = map.addNode(branch, undefined, 'after', { text: 'Hidden detail' });
    const sibling = map.addNode(root, undefined, 'after', { text: 'Visible sibling' });
    map.addNode(hidden, undefined, 'after', { text: 'Nested hidden' });
    map.addNode(sibling, undefined, 'after', { text: 'Visible leaf' });
    map.addNode(hidden, undefined, 'after', { text: 'Other hidden' });
    map.children.set(branch, { ...map.children.get(branch)!, collapsed: true });
    map.buildTree(); map.layout();
    // Distant retained hidden geometry must not affect membership or allocation.
    gfx.surface!.updateElement(hidden, { xywh: '[20000,20000,100,40]', fillColor: '#ff00ff', filled: true });
    gfx.selection.set({ elements: [map.id], editing: false });
    return { root, branch, sibling, hidden, map: map.id };
  });
}

async function preview(page: Page, scope = 'board') {
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByRole('radio', { name: 'PNG image' }).check();
  await page.locator(`input[name="export-scope"][value="${scope}"]`).check();
  return page.getByTestId('export-dimensions');
}

test('@02-06-01 hidden distant topics are excluded before board bounds and allocations', async ({ page }) => {
  const ids = await seed(page);
  const before = await page.locator('editor-host').evaluate((host: any) => JSON.stringify(host.store.spaceDoc.toJSON()));
  const dimensions = await preview(page);
  const members = JSON.parse((await dimensions.getAttribute('data-export-ids'))!);
  expect(members).not.toContain(ids.hidden);
  expect(members).toContain(ids.branch);
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Download', exact: true })).toBeEnabled();
  expect(await page.locator('editor-host').evaluate((host: any) => JSON.stringify(host.store.spaceDoc.toJSON()))).toBe(before);
});
