import { canvasLayerLockTarget, setCanvasLayerLocked } from './arrangement';
import { mindmapOwner } from './selection-summary';
import { BlockFlavourIdentifier } from '@blocksuite/affine/std';
import { ActionPlacement, ToolbarModuleExtension } from '@blocksuite/affine/shared/services';
import { html } from 'lit';
import { ViewExtensionProvider, type ViewExtensionContext } from '@blocksuite/affine/ext-loader';

/** Keep topic properties directly in More without duplicating native object actions. */
const topicPropertiesToolbarModule = ToolbarModuleExtension({
  id: BlockFlavourIdentifier('custom:affine:surface:*'),
  config: { actions: [{
    id: 'dali.topic-properties',
    label: 'Topic properties',
    icon: html`<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M4 17h16M8 4v6M16 14v6" stroke="currentColor" stroke-width="1.6" /></svg>`,
    placement: ActionPlacement.More,
    when: context => {
      const selected = context.gfx.selection.selectedElements;
      return selected.length === 1 && !!mindmapOwner(selected[0]!) && mindmapOwner(selected[0]!)!.id !== selected[0]!.id;
    },
    run: context => context.host.dispatchEvent(new Event('dali:mindmap-properties')),
  }] },
});

const mindmapUnlockToolbarModule = ToolbarModuleExtension({
  id: BlockFlavourIdentifier('custom:affine:surface:locked'),
  config: {
    when: context => {
      const models = context.gfx.selection.selectedElements;
      return models.length === 1 && !!mindmapOwner(models[0]!);
    },
    actions: [{
      id: 'b.unlock',
      run: context => {
        const model = context.gfx.selection.selectedElements[0];
        if (!model || !context.host.isConnected || context.store.readonly || !mindmapOwner(model)) return;
        const target = canvasLayerLockTarget(context.host, model.id);
        setCanvasLayerLocked(context.host, target.id, false);
      },
    }],
  },
});

export class ObjectActionsToolbarExtension extends ViewExtensionProvider {
  override name = 'dali-object-actions-toolbar';
  override setup(context: ViewExtensionContext) {
    super.setup(context);
    if (this.isEdgeless(context.scope)) context.register([topicPropertiesToolbarModule, mindmapUnlockToolbarModule]);
  }
}
