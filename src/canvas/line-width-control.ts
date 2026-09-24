import { EdgelessLineWidthPanel } from '@blocksuite/affine-components/edgeless-line-width-panel';
import { html } from 'lit';
let installed = false;
export function installLineWidthControl() {
  if (installed) return;
  installed = true;
  EdgelessLineWidthPanel.addInitializer(host => {
    const panel = host as EdgelessLineWidthPanel;
    panel.render = () => html`<style>
      :host { display:block; min-width:110px; }
      label { display:flex; align-items:center; gap:6px; font:12px/1.4 var(--affine-font-family); color:var(--affine-text-primary-color,#21172d); }
      input { box-sizing:border-box; width:52px; padding:5px; border:1px solid var(--dali-field-line); border-radius:4px; color:inherit; background:var(--board-surface); }
      input:focus-visible { outline:2px solid var(--dali-accent); }
    </style><label>Thickness <input aria-label="Thickness" type="number" min="1" max="32" step="1" ?disabled=${panel.disabled}
      .value=${String(panel.selectedSize)} @pointerdown=${(e: Event) => e.stopPropagation()} @keydown=${(e: KeyboardEvent) => { e.stopPropagation(); if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      @change=${(e: Event) => { const input = e.target as HTMLInputElement; const value = Number(input.value); if (value >= 1 && value <= 32) panel.dispatchEvent(new CustomEvent('select', { detail: value, bubbles: true, composed: true, cancelable: true })); else input.value = String(panel.selectedSize); }} />px</label>`;
  });
}
