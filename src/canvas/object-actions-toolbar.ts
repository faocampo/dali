import { BlockFlavourIdentifier } from '@blocksuite/affine/std';
import { ActionPlacement, ToolbarModuleExtension } from '@blocksuite/affine/shared/services';
import { html } from 'lit';
import { ViewExtensionProvider, type ViewExtensionContext } from '@blocksuite/affine/ext-loader';

export const OBJECT_ACTIONS_EVENT = 'dali:object-actions';

/** Add the canvas commands through BlockSuite's public More-menu registry. */
const objectActionsToolbarModule = ToolbarModuleExtension({
  id: BlockFlavourIdentifier('custom:affine:surface:*'),
  config: {
    actions: [{
      id: 'dali.object-actions',
      placement: ActionPlacement.More,
      when: context => context.gfx.selection.selectedElements.length > 0,
      content: context => {
        const open = (event: Event) => {
          event.stopPropagation();
          const anchor = event.currentTarget as HTMLElement;
          if (!context.host.isConnected) return;
          context.host.dispatchEvent(new CustomEvent(OBJECT_ACTIONS_EVENT, { detail: { anchor } }));
        };
        return html`<style>
          .native-object-actions { display:flex; align-items:center; justify-content:space-between; gap:16px; width:100%; min-height:36px; padding:4px 8px; border:0; border-radius:4px; background:transparent; color:inherit; font:inherit; text-align:left; cursor:pointer; }
          .native-object-actions:hover, .native-object-actions:focus-visible { background:var(--affine-hover-color,#eee9e3); outline:2px solid #6c503c; outline-offset:-2px; }
        </style><button class="native-object-actions" role="menuitem" aria-haspopup="menu" aria-expanded="false"
          @click=${open} @keydown=${(event: KeyboardEvent) => {
            if (event.key === 'ArrowRight') { event.preventDefault(); event.stopPropagation(); open(event); }
            if (event.key === 'Escape' || event.key === 'ArrowLeft') {
              event.preventDefault(); event.stopPropagation();
              const menu = (event.currentTarget as HTMLElement).closest('editor-menu-button') as HTMLElement & { hide(): void };
              menu?.hide();
              (menu?.shadowRoot?.querySelector('editor-icon-button') as HTMLElement | null)?.focus();
            }
          }}>Object actions <span aria-hidden="true">›</span></button>`;
      },
    }],
  },
});

export class ObjectActionsToolbarExtension extends ViewExtensionProvider {
  override name = 'dali-object-actions-toolbar';
  override setup(context: ViewExtensionContext) {
    super.setup(context);
    if (this.isEdgeless(context.scope)) context.register(objectActionsToolbarModule);
  }
}
