import { EdgelessLineWidthPanel } from '@blocksuite/affine-components/edgeless-line-width-panel';
import type { EditorHost } from '@blocksuite/affine/std';
import { html } from 'lit';

function editorHost(element: HTMLElement): EditorHost | undefined {
  let node: Node | null = element;
  while (node) {
    if (node instanceof HTMLElement && node.tagName === 'EDITOR-HOST') return node as EditorHost;
    node = node.parentNode ?? (node instanceof ShadowRoot ? node.host : null);
  }
}

let installed = false;
export function installLineWidthControl() {
  if (installed) return;
  installed = true;
  EdgelessLineWidthPanel.addInitializer(host => {
    const panel = host as EdgelessLineWidthPanel;
    const boundary = () => editorHost(panel)?.store.captureSync();
    const apply = (value: number) => {
      if (panel.disabled || !Number.isFinite(value) || value < 1 || value > 32 || editorHost(panel)?.store.readonly) return;
      panel.selectedSize = value;
      panel.dispatchEvent(new CustomEvent('select', { detail: value, bubbles: true, composed: true, cancelable: true }));
    };
    const step = (delta: number) => { boundary(); apply(Math.max(1, Math.min(32, panel.selectedSize + delta))); boundary(); };
    panel.render = () => html`<style>
      :host { display:block; }
      .control { display:flex; align-items:center; gap:6px; font:12px/1.4 var(--affine-font-family); color:var(--dali-ink); }
      .stepper { display:flex; align-items:center; border:1px solid var(--dali-field-line); border-radius:var(--dali-radius-control); overflow:hidden; background:var(--dali-surface); }
      input { box-sizing:border-box; width:34px; padding:4px 0; border:0; text-align:center; color:inherit; background:transparent; font:inherit; font-variant-numeric:tabular-nums; appearance:textfield; }
      input::-webkit-inner-spin-button { appearance:none; }
      button { display:grid; place-items:center; width:26px; height:30px; padding:0; border:0; background:transparent; color:var(--dali-accent-ink); cursor:pointer; }
      button:hover:not(:disabled) { background:var(--dali-accent-soft); }
      button:disabled, input:disabled { color:var(--dali-disabled); cursor:default; }
      button:focus-visible, input:focus-visible { outline:2px solid var(--dali-accent); outline-offset:-2px; }
      .sample { width:24px; height:32px; color:var(--dali-ink); }
      .sample.disabled { color:var(--dali-disabled); }
    </style><div class="control" @pointerdown=${(e: Event) => e.stopPropagation()} @mousedown=${(e: Event) => e.stopPropagation()} @click=${(e: Event) => e.stopPropagation()}>
      <span id="label">Thickness</span>
      <span class="stepper">
        <button aria-label="Decrease thickness" ?disabled=${panel.disabled || panel.selectedSize <= 1} @click=${() => step(-1)}><svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16"><path d="M3 8h10" fill="none" stroke="currentColor" stroke-width="1.5" /></svg></button>
        <input aria-labelledby="label" type="number" min="1" max="32" step="1" ?disabled=${panel.disabled}
          .value=${String(panel.selectedSize)} @focus=${boundary}
          @keydown=${(e: KeyboardEvent) => { e.stopPropagation(); if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          @input=${(e: Event) => apply(Number((e.target as HTMLInputElement).value))}
          @blur=${(e: Event) => { (e.target as HTMLInputElement).value = String(panel.selectedSize); boundary(); }} />
        <button aria-label="Increase thickness" ?disabled=${panel.disabled || panel.selectedSize >= 32} @click=${() => step(1)}><svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16"><path d="M3 8h10M8 3v10" fill="none" stroke="currentColor" stroke-width="1.5" /></svg></button>
      </span>
      <svg class=${`sample${panel.disabled ? ' disabled' : ''}`} aria-hidden="true" viewBox="0 0 24 32"><path d="M0 16h24" stroke="currentColor" stroke-width=${panel.selectedSize} /></svg>
    </div>`;
  });
}
