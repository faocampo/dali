import { openObjectActions } from './object-actions';
import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import type { GfxController } from '@blocksuite/affine/std/gfx';

async function state(page: Page) {
  return page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    return gfx.gfxElements.map(m => ({ id: m.id, type: 'type' in m ? m.type : m.flavour,
      xywh: JSON.parse(m.xywh) as number[], group: m.group?.id ?? null, index: m.index,
      locked: m.isLocked(), color: 'fillColor' in m ? String(m.fillColor) : '',
      text: 'text' in m ? String(m.text ?? '') : '' }));
  });
}

async function shape(page: Page, x = 240, y = 180, width = 120, height = 80) {
  await page.getByRole('button', { name: 'Shapes', exact: true }).click();
  await page.getByRole('button', { name: 'Square / rectangle', exact: true }).click();
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + width, y + height, { steps: 10 });
  await page.mouse.up();
}

test('modifier D duplicates the selected native model on each invocation', async ({ page }) => {
  await page.goto('/');
  await shape(page);
  await page.mouse.click(290, 210);
  const original = await state(page);
  await page.keyboard.press('ControlOrMeta+d');
  await expect.poll(async () => (await state(page)).length).toBe(2);
  await page.keyboard.press('ControlOrMeta+d');
  await expect.poll(async () => (await state(page)).length).toBe(3);
  expect(new Set((await state(page)).map(m => m.id)).size).toBe(3);
  expect((await state(page)).find(m => m.id === original[0]!.id)?.xywh).toEqual(original[0]!.xywh);
});

for (const action of ['left', 'center-x', 'right', 'top', 'center-y', 'bottom', 'distribute-x', 'distribute-y']) {
  test(`marquee selection applies ${action} to distinct native models`, async ({ page }) => {
    await page.goto('/');
    await shape(page, 220, 180, 100, 60);
    await shape(page, 400, 270, 120, 80);
    await shape(page, 600, 390, 140, 100);
    await page.mouse.move(180, 140);
    await page.mouse.down();
    await page.mouse.move(800, 530, { steps: 12 });
    await page.mouse.up();
    const before = await state(page);
    await openObjectActions(page);
    await page.getByTestId('object-context-menu').getByRole('menuitem', { name: `Align ${action}`, exact: true }).click();
    const after = await state(page);
    expect(after.map(m => m.id)).toEqual(before.map(m => m.id));
    const axis = ['top', 'center-y', 'bottom', 'distribute-y'].includes(action) ? 1 : 0;
    if (action.startsWith('distribute')) {
      const sorted = [...after].sort((a, b) => a.xywh[axis]! - b.xywh[axis]!);
      const gap1 = sorted[1]!.xywh[axis]! - sorted[0]!.xywh[axis]! - sorted[0]!.xywh[axis + 2]!;
      const gap2 = sorted[2]!.xywh[axis]! - sorted[1]!.xywh[axis]! - sorted[1]!.xywh[axis + 2]!;
      expect(gap1).toBeCloseTo(gap2, 5);
    } else {
      const fraction = action.startsWith('center') ? 0.5 : ['right', 'bottom'].includes(action) ? 1 : 0;
      const anchors = after.map(m => m.xywh[axis]! + fraction * m.xywh[axis + 2]!);
      anchors.forEach(anchor => expect(anchor).toBeCloseTo(anchors[0]!, 5));
    }
  });
}

test('move, resize and layer controls change native bounds and order with undo', async ({ page }) => {
  await page.goto('/');
  await shape(page);
  const first = (await state(page))[0]!;
  await page.mouse.move(290, 210);
  await page.mouse.down();
  await page.mouse.move(340, 260, { steps: 10 });
  await page.mouse.up();
  await expect.poll(async () => (await state(page))[0]?.xywh[0]).toBe(first.xywh[0]! + 50);
  const moved = (await state(page))[0]!;
  const handle = page.locator('.handle[aria-label="bottom-right"] .resize');
  const bounds = (await handle.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 60, bounds.y + bounds.height / 2 + 40, { steps: 10 });
  await page.mouse.up();
  await expect.poll(async () => (await state(page))[0]?.xywh[2]).toBeGreaterThan(moved.xywh[2]!);
  const resized = (await state(page))[0]!;
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(async () => (await state(page))[0]?.xywh).toEqual(moved.xywh);
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect.poll(async () => (await state(page))[0]?.xywh).toEqual(resized.xywh);
  await shape(page, 560, 350);
  await page.mouse.click(600, 380);
  const inspector = page.getByTestId('object-context-menu');
  const before = (await state(page))[1]!;
  await openObjectActions(page);
  await inspector.getByRole('menuitem', { name: 'To back', exact: true }).click();
  await expect.poll(async () => (await state(page)).find(m => m.id === before.id)?.index).not.toBe(before.index);
  const back = (await state(page)).find(m => m.id === before.id)!.index;
  await openObjectActions(page);
  await inspector.getByRole('menuitem', { name: 'To front', exact: true }).click();
  await expect.poll(async () => (await state(page)).find(m => m.id === before.id)?.index).not.toBe(back);
});

test('touching objects align without merging and nested groups retain descendants', async ({ page }) => {
  await page.goto('/');
  await shape(page);
  await shape(page, 360, 180);
  const ids = (await state(page)).map(m => m.id);
  await page.mouse.click(600, 500);
  await page.keyboard.press('ControlOrMeta+a');
  const inspector = page.getByTestId('object-context-menu');
  await openObjectActions(page);
  await inspector.getByRole('menuitem', { name: 'Align left', exact: true }).click();
  await expect.poll(async () => new Set((await state(page)).map(m => m.xywh[0])).size).toBe(1);
  expect((await state(page)).map(m => m.id)).toEqual(ids);
  await openObjectActions(page);
  await inspector.getByRole('menuitem', { name: 'Group', exact: true }).click();
  await expect.poll(async () => (await state(page)).filter(m => m.type === 'group').length).toBe(1);
  const group = (await state(page)).find(m => m.type === 'group')!;
  expect((await state(page)).filter(m => ids.includes(m.id)).every(m => m.group === group.id)).toBe(true);
  await openObjectActions(page);
  await inspector.getByRole('menuitem', { name: 'Duplicate', exact: true }).click();
  await expect.poll(async () => (await state(page)).length).toBe(6);
  await page.mouse.click(700, 550);
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('ControlOrMeta+g');
  await expect.poll(async () => (await state(page)).filter(m => m.type === 'group').length).toBe(3);
  await page.keyboard.press('ControlOrMeta+Shift+g');
  await expect.poll(async () => (await state(page)).filter(m => m.type === 'group').length).toBe(2);
  expect((await state(page)).filter(m => m.type === 'shape').length).toBe(4);
});

test('single and locked selections disable arrangement and protect native geometry', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('selection-inspector')).toHaveCount(0);
  await shape(page);
  await page.mouse.click(290, 210);
  const inspector = page.getByTestId('object-context-menu');
  await openObjectActions(page);
  await expect(inspector.getByRole('menuitem', { name: 'Group', exact: true })).toBeDisabled();
  await openObjectActions(page);
  await expect(inspector.getByRole('menuitem', { name: 'Align left', exact: true })).toHaveCount(0);
  const original = await state(page);
  await openObjectActions(page);
  await inspector.getByRole('menuitem', { name: 'Lock object', exact: true }).click();
  await openObjectActions(page);
  await expect(inspector.getByRole('menuitem', { name: 'Duplicate', exact: true })).toBeDisabled();
  await openObjectActions(page);
  await expect(inspector.getByRole('menuitem', { name: 'To front', exact: true })).toBeDisabled();
  await page.mouse.move(290, 210);
  await page.mouse.down();
  await page.mouse.move(390, 300, { steps: 10 });
  await page.mouse.up();
  await page.keyboard.press('Delete');
  expect((await state(page)).map(m => ({ id: m.id, xywh: m.xywh }))).toEqual(original.map(m => ({ id: m.id, xywh: m.xywh })));
});

test('canvas shortcuts preserve rich-text characters and deletion semantics', async ({ page }) => {
  await page.goto('/');
  await shape(page);
  await page.mouse.dblclick(290, 210);
  await page.keyboard.insertText('Draft');
  await page.keyboard.press('ControlOrMeta+d');
  await page.keyboard.press('ControlOrMeta+g');
  await page.keyboard.type('v');
  await page.keyboard.press('Backspace');
  await expect.poll(async () => (await state(page)).length).toBe(1);
  await expect.poll(async () => (await state(page))[0]?.text).toBe('Draft');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.mouse.click(700, 500);
  await page.mouse.click(290, 210);
  await page.keyboard.press('Delete');
  await expect.poll(async () => (await state(page)).length).toBe(0);
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(async () => (await state(page)).length).toBe(1);
});

test('native contextual style controls persist the selected shape color', async ({ page }) => {
  await page.goto('/');
  await shape(page);
  await page.mouse.click(290, 210);
  const original = (await state(page))[0]!;
  await page.getByRole('button', { name: 'Color', exact: true }).click();
  await page.getByRole('listbox', { name: 'Fill color', exact: true }).locator('edgeless-color-button').nth(3).click();
  await expect.poll(async () => (await state(page))[0]?.color).not.toBe(original.color);
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  const colored = await state(page);
  await page.reload();
  await expect(page.getByTestId('board-action-menu')).toBeVisible();
  await expect.poll(() => state(page)).toEqual(colored);
});

test('right-click opens object actions with keyboard dismissal outside the inspector', async ({page}) => {
  await page.goto('/');
  await shape(page,220,180,100,60);
  await page.mouse.click(270,210);
  await expect(page.getByTestId('selection-inspector').getByText('Arrange',{exact:true})).toHaveCount(0);
  await page.mouse.click(270,210,{button:'right'});
  await expect(page.getByRole('menu',{name:'Object actions',exact:true})).toBeVisible();
  await page.getByRole('menuitem',{name:'Duplicate',exact:true}).press('Escape');
  await expect(page.getByRole('menu',{name:'Object actions',exact:true})).toHaveCount(0);
  await expect(page.locator('editor-host')).toBeFocused();
});
