import { test, expect } from './fixtures';
import type { GfxController } from '@blocksuite/affine/std/gfx';
import type { NoteBlockModel } from '@blocksuite/affine/model';

test('all sticky shadow presets render distinctly and persist after reload', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button',{name:'Add sticky note',exact:true}).click();
  const note=page.locator('edgeless-note-background');
  await expect(note).toHaveCount(1);
  await expect(note).not.toHaveCSS('box-shadow','none');
  const shadows=new Set<string>();
  for (const preset of ['box','sticker','paper','float','film','']) {
    await page.locator('affine-edgeless-root').evaluate((el,preset)=>{
      const store=(el as HTMLElement & {gfx:GfxController}).gfx.doc;
      const model=store.getBlocksByFlavour('affine:note')[0]!.model as NoteBlockModel;
      store.updateBlock(model,{edgeless:{...model.props.edgeless,style:{...model.props.edgeless.style,shadowType:preset?`--affine-note-shadow-${preset}`:''}}});
    },preset);
    if(preset) {
      await expect(note).not.toHaveCSS('box-shadow','none');
      shadows.add(await note.evaluate(el=>getComputedStyle(el).boxShadow));
    } else await expect(note).toHaveCSS('box-shadow','none');
    await page.getByRole('button',{name:'Saved locally',exact:true}).waitFor();
    await page.reload();
    await expect(note).toHaveCount(1);
    if(preset) await expect(note).not.toHaveCSS('box-shadow','none');
    else await expect(note).toHaveCSS('box-shadow','none');
  }
  expect(shadows.size).toBe(5);
});
