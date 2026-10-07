import { EditorToolbar } from '@blocksuite/affine-components/toolbar';

let installed = false;
/** Native toolbars declare a separate app-theme palette on their own host. */
export function installFormattingTheme() {
  if (installed) return;
  installed = true;
  EditorToolbar.addInitializer(toolbar => {
    toolbar.addController({ hostConnected() {
      const colors = {
        '--affine-v2-icon-primary': '--dali-ink',
        '--affine-v2-icon-secondary': '--dali-muted',
        '--affine-icon-color': '--dali-ink',
        '--affine-icon-secondary': '--dali-muted',
        '--affine-text-primary-color': '--dali-ink',
        '--affine-hover-color': '--dali-hover-overlay',
      };
      for (const [native, token] of Object.entries(colors)) toolbar.style.setProperty(native, `var(${token})`);
    } });
  });
}
