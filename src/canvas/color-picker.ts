import { EdgelessColorPicker } from '@blocksuite/affine/components/color-picker';
import { html } from 'lit';

let installed = false;
/** Canvas colors have one visible value; theme variants obscure immediate edits. */
export function installCanvasColorPicker() {
  if (installed) return;
  installed = true;
  EdgelessColorPicker.addInitializer(host => {
    const picker = host as EdgelessColorPicker;
    const render = picker.render.bind(picker);
    picker.render = () => html`<style>header nav, .modes { display:none !important; }</style>${render()}`;
    const firstUpdated = picker.firstUpdated.bind(picker);
    picker.firstUpdated = () => {
      firstUpdated();
      const visible = { ...picker.mode$.peek().hsva };
      picker.modes$.value[0]!.hsva = visible;
      picker.modeType$.value = 'normal';
      picker.navType$.value = 'colors';
      const commitHex = (event: Event) => {
        const field = event.composedPath()[0];
        if (field instanceof HTMLInputElement && field.closest('.field.color') && /^[0-9a-f]{6}$/i.test(field.value.trim())) {
          field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        }
      };
      picker.addEventListener('input', commitHex, true);
      picker.addEventListener('focusout', commitHex, true);
    };
  });
}
