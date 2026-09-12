import { test, expect } from './fixtures';
import type { GfxController } from '@blocksuite/affine/std/gfx';
import type { MindmapElementModel, ShapeElementModel } from '@blocksuite/affine/model';

test('@02-01-01 native map creation, keyboard hierarchy, reload and PNG', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Add mind map', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add mind map', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('Central topic');
  await page.keyboard.insertText('Synthetic central topic');
  await page.keyboard.press('Enter');
  await expect(page.locator('edgeless-shape-text-editor')).toHaveCount(0);
  await page.keyboard.press('Tab');
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('New node');
  await page.keyboard.insertText('Synthetic child');
  await page.keyboard.press('Enter');
  await expect(page.locator('edgeless-shape-text-editor')).toHaveCount(0);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('New node');
  await page.keyboard.insertText('Synthetic sibling');
  await page.keyboard.press('Enter');
  await expect(page.locator('edgeless-shape-text-editor')).toHaveCount(0);
  const read = () => page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    return gfx.surface!.elementModels.filter(e => e.type === 'mindmap').map(e => {
      const map = e as MindmapElementModel;
      return { id: map.id, nodes: [...map.children].map(([id, detail]) => ({ id, ...detail, text: (map.getNode(id)!.element as ShapeElementModel).text?.toString() })) };
    });
  });
  await expect.poll(async () => (await read())[0]?.nodes.length).toBe(3);
  const before = await read();
  expect(before).toHaveLength(1);
  const root = before[0]!.nodes.find(n => !n.parent)!;
  expect(root.text).toBe('Synthetic central topic');
  expect(before[0]!.nodes.filter(n => n.parent === root.id).map(n => n.text).sort()).toEqual(['Synthetic child', 'Synthetic sibling']);
  await page.getByRole('button', { name: 'Saved locally', exact: true }).waitFor();
  await page.reload();
  await expect.poll(read).toEqual(before);
  const bridge = await page.locator('affine-edgeless-root').evaluate(el => {
    const gfx = (el as HTMLElement & { gfx: GfxController }).gfx;
    const map = gfx.surface!.elementModels.find(e => e.type === 'mindmap') as MindmapElementModel;
    const root = map.tree.element;
    const child = map.tree.children[0]!.element;
    return { x: (root.x + root.w + child.x) / 2 - root.x, edges: map.getConnectors(map.tree)?.length };
  });
  expect(bridge.edges).toBe(2);
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByRole('radio', { name: 'PNG image' }).check();
  await page.locator('input[name="export-scope"][value="board"]').check();
  const pending = page.waitForEvent('download');
  await page.getByRole('dialog').getByRole('button', { name: 'Download', exact: true }).click();
  const download = await pending;
  expect(await download.failure()).toBeNull();
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const png = Buffer.concat(chunks);
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  const ink = await page.evaluate(async ({ base64, bridgeX }) => {
    const img = new Image(); img.src = `data:image/png;base64,${base64}`; await img.decode();
    const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
    const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0);
    const pixels = ctx.getImageData(0, 0, img.width, img.height).data;
    let count = 0, connector = 0;
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 3]! > 0 && Math.min(pixels[i]!, pixels[i + 1]!, pixels[i + 2]!) < 180) {
      count++;
      if (Math.abs((i / 4) % img.width - bridgeX) < 12) connector++;
    }
    return { count, connector };
  }, { base64: png.toString('base64'), bridgeX: bridge.x });
  expect(ink.count).toBeGreaterThan(1000);
  expect(ink.connector, 'native connector ink between separated topic boxes').toBeGreaterThan(15);
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Add mind map', exact: true }).click();
  await expect.poll(async () => (await read()).length).toBe(2);
});
