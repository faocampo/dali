import type { GfxController } from '@blocksuite/affine/std/gfx';
import type { Page } from '@playwright/test';
import type { EditorHost } from '@blocksuite/affine/std';
import type { AccountDatabase } from '../server/storage/database';
import { expect } from './fixtures';
/** Seed through the native model before enabling collaboration on the fixture. */
export async function seedCollaborationShapes(page: Page, database: AccountDatabase, boardId: string, positions = [0, 400]) {
  await page.goto(`/?board=${boardId}`); await expect(page.locator('affine-edgeless-root')).toBeVisible();
  const ids = await page.locator('affine-edgeless-root').evaluate((element, positions) => {
    const gfx = (element as HTMLElement & { gfx: GfxController }).gfx;
    return positions.map(x => gfx.surface!.addElement({ type: 'shape', shapeType: 'rect', xywh: `[${x},0,160,120]`, shapeStyle: 'General', filled: true, fillColor: '#f5cf67', strokeColor: '#211830', strokeWidth: 2 }));
  }, positions);
  await expect(page.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
  await page.goto('/'); await expect(page.getByRole('heading', { name: 'Your boards', exact: true })).toBeVisible();
  database.prepare('UPDATE boards SET live_enabled=1 WHERE id=?').run(boardId);
  return ids;
}
export async function shapeBounds(page: Page, id: string) {
  return page.locator('editor-host').evaluate((element, objectId) => {
    const host = element as EditorHost;
    const blocks = host.store.spaceDoc.getMap('blocks');
    const data = blocks.toJSON() as Record<string, { 'sys:flavour': string; 'prop:elements': { value: Record<string, { xywh: string }> } }>;
    return Object.values(data).find(block => block['sys:flavour'] === 'affine:surface')!['prop:elements'].value[objectId]!.xywh;
  }, id);
}
export async function moveNativeShape(page: Page, id: string, dx: number, dy = 40) {
  await expect(page.locator('affine-edgeless-root')).toBeVisible();
  const position = await page.locator('affine-edgeless-root').evaluate((element, objectId) => {
    const gfx = (element as HTMLElement & { gfx: GfxController }).gfx;
    const model = gfx.getElementById(objectId);
    if (!model || !('x' in model)) throw new Error('Missing native shape');
    const p = gfx.viewport.toViewCoord(model.x + model.w / 2, model.y + model.h / 2);
    const rect = element.getBoundingClientRect();
    return { x: p[0] + rect.left, y: p[1] + rect.top };
  }, id);
  const reserved = page.waitForResponse(response => response.url().endsWith('/live/reserve') && response.ok(), { timeout: 10000 });
  await page.mouse.move(position.x, position.y); await page.mouse.down();
  await reserved;
  await page.mouse.move(position.x + dx, position.y + dy, { steps: 8 }); await page.mouse.up();
}

/** Read the native renderer model and confirm it remains hit-testable. */
export async function renderedShapeBounds(page: Page, id: string) {
  return page.locator('affine-edgeless-root').evaluate((element, objectId) => {
    const gfx = (element as HTMLElement & { gfx: GfxController }).gfx;
    const model = gfx.getElementById(objectId);
    if (!model || !('x' in model)) throw new Error('Native shape did not hydrate');
    if (gfx.getElementByPoint(model.x + model.w / 2, model.y + model.h / 2)?.id !== objectId) throw new Error('Native shape is not hit-testable');
    return JSON.stringify([model.x, model.y, model.w, model.h]);
  }, id);
}
