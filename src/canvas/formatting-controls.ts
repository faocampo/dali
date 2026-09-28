/** Pinned BlockSuite toolbar adapters, using the public custom-action registry. */
import { BlockFlavourIdentifier } from '@blocksuite/affine/std';
import type { GfxViewInteractionConfig } from '@blocksuite/affine/std/gfx';
import { createIdentifier } from '@blocksuite/global/di';
import { canvasFonts, canvasFontFamilies } from './canvas-fonts';
import { MindmapElementModel, FontWeight, FontStyle } from '@blocksuite/affine/model';
import { ViewExtensionProvider, type ViewExtensionContext } from '@blocksuite/affine/ext-loader';
import { ToolbarModuleIdentifier, type ToolbarModule, type ToolbarContext, type ToolbarGenericAction } from '@blocksuite/affine/shared/services';
import { EdgelessCRUDIdentifier } from '@blocksuite/affine/blocks/surface';
import { createTextActions } from '@blocksuite/affine/gfx/text';
import { ShapeElementModel, TextElementModel, FontFamilyList, NoteBlockModel, FontFamily } from '@blocksuite/affine/model';
import { Bound } from '@blocksuite/global/gfx';
import { html } from 'lit';
import type { ExtensionType } from '@blocksuite/affine/store';

function mergeToolbarModule(module: ToolbarModule): ExtensionType {
  return { setup(di) {
    const id = ToolbarModuleIdentifier(module.id.variant);
    const previous = di.provider().getOptional(id);
    if (previous) di.override(id, () => ({ ...previous, config: { ...previous.config, actions: [...previous.config.actions, ...module.config.actions] } }));
    else di.addImpl(id, module);
  } };
}

const controlStyle = 'box-sizing:border-box;border:0;border-radius:6px;padding:6px;min-height:32px;background:transparent;color:var(--affine-text-primary-color);font:inherit;max-width:116px';
const stop = (event: Event) => event.stopPropagation();
function typographyActions(kind: 'shape' | 'text'): ToolbarGenericAction[] {
  const klass = kind === 'shape' ? ShapeElementModel : TextElementModel;
  const models = (ctx: ToolbarContext) => {
    // Track selection/model refreshes; the native helper reads this signal with peek().
    void ctx.elementsMap$.value;
    return ctx.getSurfaceModelsByType(klass as typeof ShapeElementModel);
  };
  const apply = (ctx: ToolbarContext, props: Record<string, unknown>) => {
    if (ctx.store.readonly) return;
    ctx.store.captureSync();
    ctx.store.transact(() => models(ctx).filter(model => !model.isLocked()).forEach(model => ctx.std.get(EdgelessCRUDIdentifier).updateElement(model.id, props)));
    ctx.store.captureSync();
  };
  const prefix = kind === 'shape' ? 'g.text-' : '';
  const actions: ToolbarGenericAction[] = kind === 'shape' ? createTextActions(ShapeElementModel, 'shape', (ctx, model, props) => {
    if (!ctx.store.readonly && !model.isLocked()) ctx.std.get(EdgelessCRUDIdentifier).updateElement(model.id, props);
  }).map(action => ({ ...action, id: prefix + action.id, when: ctx => models(ctx).every(model => !!model.text && !(model.group instanceof MindmapElementModel)) })) : [];
  return [...actions, {
    id: prefix + 'a.font',
    content: ctx => html`<select style=${controlStyle} class="dali-format-select" aria-label="Font" @pointerdown=${stop} @mousedown=${stop} @click=${stop} @input=${stop} @keydown=${stop}
      @change=${(event: Event) => { const fontFamily = (event.target as HTMLSelectElement).value as FontFamily; const model = models(ctx)[0]; const faces = canvasFonts.filter(face => face.font === fontFamily); const match = faces.find(face => face.weight === model?.fontWeight && face.style === model?.fontStyle) ?? faces.find(face => face.weight === FontWeight.Regular && face.style === FontStyle.Normal); if (match) apply(ctx, { fontFamily, fontWeight: match.weight, fontStyle: match.style }); }}>
      ${FontFamilyList.filter(([value]) => canvasFontFamilies.includes(value) || models(ctx)[0]?.fontFamily === value).map(([value, name]) => html`<option value=${value} ?selected=${models(ctx)[0]?.fontFamily === value}>${name}</option>`)}
    </select>`,
  }, {
    id: prefix + 'c.font-style',
    content: ctx => {
      const model = models(ctx)[0];
      const faces = canvasFonts.filter(face => face.font === (model?.fontFamily ?? FontFamily.Inter));
      const names: Record<string, string> = { '300': 'Light', '400': 'Regular', '500': 'Medium', '600': 'Semibold', '700': 'Bold' };
      return html`<select style=${controlStyle} aria-label="Font style" ?disabled=${faces.length < 2} @pointerdown=${stop} @mousedown=${stop} @click=${stop} @keydown=${stop}
        @change=${(event: Event) => { const face = faces.find(face => `${face.weight}:${face.style}` === (event.target as HTMLSelectElement).value); if (face) apply(ctx, { fontWeight: face.weight, fontStyle: face.style }); }}>
        ${faces.map(face => html`<option value=${`${face.weight}:${face.style}`} ?selected=${face.weight === model?.fontWeight && face.style === model?.fontStyle}>${names[face.weight]}${face.style === FontStyle.Italic ? ' Italic' : ''}</option>`)}
      </select>`;
    },
  }, {
    id: prefix + 'd.font-size',
    content: ctx => html`<input style=${controlStyle + ";width:64px"} class="dali-font-size" aria-label="Font size" type="number" min="1" max="400" step="1" .value=${String(models(ctx)[0]?.fontSize ?? 16)}
      @pointerdown=${stop} @mousedown=${stop} @click=${stop} @input=${stop} @keydown=${(event: KeyboardEvent) => { stop(event); if (event.key === 'Enter') (event.target as HTMLInputElement).blur(); }}
      @change=${(event: Event) => { const input = event.target as HTMLInputElement; const value = Number(input.value); if (Number.isFinite(value) && value >= 1 && value <= 400) apply(ctx, { fontSize: value }); else input.value = String(models(ctx)[0]?.fontSize ?? 16); }} />`,
  }];
}
export const noteSizes = [{ label: 'XS', scale: .5 }, { label: 'S', scale: .75 }, { label: 'M', scale: 1 }, { label: 'L', scale: 1.5 }, { label: 'XL', scale: 2 }];

export class FormattingControlsExtension extends ViewExtensionProvider {
  override name = 'dali-formatting-controls';
  override setup(context: ViewExtensionContext) {
    super.setup(context);
    if (!this.isEdgeless(context.scope)) return;
    context.register({ setup(di) {
      const id = createIdentifier<GfxViewInteractionConfig>('GfxViewInteraction')('affine:note');
      const native = di.provider().get(id);
      di.override(id, (): GfxViewInteractionConfig => ({ ...native, handleResize: context => {
        const handlers = native.handleResize?.(context);
        return { ...handlers,
          onResizeStart: start => { context.std.store.captureSync(); handlers?.onResizeStart?.(start); },
          onResizeMove: move => handlers?.onResizeMove?.({ ...move, lockRatio: true }),
          onResizeEnd: end => { handlers?.onResizeEnd?.(end); context.std.store.captureSync(); },
        };
      } }));
    } });
    context.register(mergeToolbarModule({ id: BlockFlavourIdentifier('custom:affine:surface:*'), config: { actions: [{
      id: 'Z.a.selection', actions: [{ id: 'a.create-frame', label: 'Frame selection', tooltip: 'Create a frame around the selected objects' }],
    }] } }));
    for (const kind of ['shape', 'text'] as const) context.register(mergeToolbarModule({ id: BlockFlavourIdentifier(`custom:affine:surface:${kind}`), config: { actions: typographyActions(kind) } }));
    for (const kind of ['group', 'frame']) context.register(mergeToolbarModule({ id: BlockFlavourIdentifier(`custom:affine:surface:${kind}`), config: { actions: [{ id: 'a.insert-into-page', when: false }] } }));
    context.register(mergeToolbarModule({ id: BlockFlavourIdentifier('custom:affine:surface:note'), config: { actions: [
      { id: 'a.show-in', when: false }, { id: 'b.display-in-page', when: false },
      { id: 'g.scale', content: ctx => {
        const models = ctx.getSurfaceModelsByType(NoteBlockModel);
        const scale = models[0]?.props.edgeless.scale ?? 1;
        const closest = noteSizes.reduce((a, b) => Math.abs(a.scale - scale) < Math.abs(b.scale - scale) ? a : b);
        return html`<select style=${controlStyle} class="dali-format-select" aria-label="Note size" @pointerdown=${stop} @mousedown=${stop} @click=${stop} @input=${stop} @keydown=${stop} @change=${(event: Event) => {
          if (ctx.store.readonly) return;
          const next = Number((event.target as HTMLSelectElement).value);
          if (!noteSizes.some(size => size.scale === next)) return;
          ctx.store.captureSync();
          ctx.store.transact(() => models.forEach(model => {
            if (model.isLocked()) return;
            const bounds = Bound.deserialize(model.xywh); const ratio = next / (model.props.edgeless.scale ?? 1);
            bounds.w *= ratio; bounds.h *= ratio;
            ctx.store.updateBlock(model, () => { model.xywh = bounds.serialize(); model.props.edgeless.scale = next; });
          }));
          ctx.store.captureSync();
        }}>${noteSizes.map(size => html`<option value=${size.scale} ?selected=${closest === size}>${size.label}</option>`)}</select>`;
      } },
    ] } }));
  }
}
