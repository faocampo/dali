import type { Page } from '@playwright/test';
import { expect } from './fixtures';
import type { EditorHost } from '@blocksuite/affine/std';
import type { GfxController } from '@blocksuite/affine/std/gfx';
import type { MindmapElementModel } from '@blocksuite/affine/model';

export async function richRecoveryCanvas(page: Page) {
  return page.locator('editor-host').evaluate(element => {
    const host = element as EditorHost; const root = host.querySelector('affine-edgeless-root') as HTMLElement & { gfx: GfxController }; const surface = root.gfx.surface!;
    const text = (id?: string) => id ? String((surface.getElementById(id) as { text?: { toString(): string } } | undefined)?.text ?? '') : undefined;
    const geometry = (id?: string) => id ? surface.getElementById(id)?.xywh ?? (host.store.getBlock(id)?.model as { xywh?: string } | undefined)?.xywh : undefined;
    const images = host.store.getBlocksByFlavour('affine:image').map(row => row.model);
    const plain = (value: object) => Object.fromEntries(Object.entries(value).filter(([key, value]) => key !== 'imageId' && ['number', 'string', 'boolean'].includes(typeof value)));
    const snapshot = {
      shapes: surface.elementModels.filter(m => m.type === 'shape').map(m => ({ xywh: m.xywh, text: text(m.id) })).sort((a, b) => a.xywh.localeCompare(b.xywh)),
      maps: surface.elementModels.filter(m => m.type === 'mindmap').map(model => [...(model as MindmapElementModel).children].map(([id, detail]) => ({ ...detail, parent: text(detail.parent), text: text(id) })).sort((a, b) => a.text!.localeCompare(b.text!))),
      groups: surface.elementModels.filter(m => m.type === 'group').map(model => [...(model as unknown as { children: Map<string, unknown> }).children.keys()].map(id => geometry(id)).sort()),
      connectors: surface.elementModels.filter(m => m.type === 'connector').map(model => { const c = model as unknown as { source: { id?: string }; target: { id?: string } }; return [geometry(c.source.id), geometry(c.target.id)]; }),
      images: images.map(model => plain(model.props)).sort((a, b) => String(a.sourceId).localeCompare(String(b.sourceId))),
      edits: host.store.getBlocksByFlavour('djai:image-visual-edit').map(({ model }) => ({ ...plain(model.props), validImage: images.some(image => image.id === (model.props as { imageId: string }).imageId) })),
    };
    return { ids: [...host.store.spaceDoc.getMap('blocks').keys(), ...surface.elementModels.map(model => model.id)], snapshot };
  });
}

/** Seed native content before any live participant opens this synthetic board. */
export async function prepareRichRecoverySeed(page: Page) {
  await page.getByRole('button', { name: 'Add mind map', exact: true }).click(); await page.keyboard.type('Recovery map'); await page.keyboard.press('Enter');
  await page.locator('affine-edgeless-root').evaluate(element => {
    const gfx = (element as HTMLElement & { gfx: GfxController }).gfx; const surface = gfx.surface!;
    const map = surface.elementModels.find(m => m.type === 'mindmap') as MindmapElementModel;
    const branch = map.addNode(map.tree.id, undefined, 'after', { text: 'Local branch' }); map.addNode(branch, undefined, 'after', { text: 'Hidden recovery topic' });
    map.toggleCollapse(map.getNode(branch)!, { layout: true });
    const first = surface.addElement({ type: 'shape', shapeType: 'rect', xywh: '[1000,600,100,80]' });
    const second = surface.addElement({ type: 'shape', shapeType: 'rect', xywh: '[1310,600,100,80]' });
    surface.addElement({ type: 'connector', source: { id: first, position: [1, 0.5] }, target: { id: second, position: [0, 0.5] } });
    gfx.selection.set({ elements: [first, second], editing: false }); gfx.doc.captureSync();
  });
  await page.locator('editor-host').focus(); await page.keyboard.press('ControlOrMeta+g');
  await expect.poll(async () => (await richRecoveryCanvas(page)).snapshot.groups.length).toBe(1);
  const raster = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 200; c.height = 100; const ctx = c.getContext('2d')!; ctx.fillStyle = '#80a040'; ctx.fillRect(0, 0, 200, 100); return c.toDataURL().split(',')[1]!; });
  await page.locator('input[type=file][accept="image/*"]').setInputFiles({ name: 'Synthetic adjustable.png', mimeType: 'image/png', buffer: Buffer.from(raster, 'base64') });
  await expect(page.locator('affine-edgeless-image')).toHaveCount(1); await expect(page.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Fit to screen', exact: true }).click(); await page.locator('affine-edgeless-image').click();
  await page.locator('.selection-inspector').getByRole('button', { name: 'Crop', exact: true }).click();
  await page.getByRole('button', { name: 'Crop left', exact: true }).press('Shift+ArrowRight'); await page.getByRole('button', { name: 'Apply crop', exact: true }).click();
  await expect.poll(async () => (await richRecoveryCanvas(page)).snapshot.edits.length).toBe(1);
  await expect(page.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
}

/** Include the unmodified original pixels retained by a crop/filter state. */
export async function recoveryAssetHashes(page: Page) {
  return page.locator('editor-host').evaluate(async element => {
    const store = (element as EditorHost).store;
    const keys = new Set(store.getBlocksByFlavour('affine:image').map(({ model }) => (model.props as { sourceId: string }).sourceId));
    for (const { model } of store.getBlocksByFlavour('djai:image-visual-edit')) {
      const props = model.props as { sourceId: string; processedSourceId: string }; keys.add(props.sourceId); keys.add(props.processedSourceId);
    }
    return Promise.all([...keys].sort().map(async key => {
      const blob = await store.blobSync.get(key); if (!blob) throw new Error('Retained recovery image is missing');
      const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()));
      return { key, hash: Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('') };
    }));
  });
}
