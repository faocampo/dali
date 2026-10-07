import { installConnectorLabelReflow } from './connector-labels';
import type { EditorHost } from '@blocksuite/affine/std';
import { GfxControllerIdentifier } from '@blocksuite/affine/std/gfx';
import { TextElementModel } from '@blocksuite/affine/model';
import { normalizeTextBound } from '@blocksuite/affine/gfx/text';
import { Bound } from '@blocksuite/global/gfx';

/** Find native controls across their open shadow roots, scoped to this editor. */
function visit(root: ParentNode, callback: (element: HTMLElement) => void) {
  for (const element of root.querySelectorAll<HTMLElement>('*')) {
    callback(element);
    if (element.shadowRoot) visit(element.shadowRoot, callback);
  }
}

export function installCanvasAffordances(host: EditorHost) {
  const stopLabelReflow = installConnectorLabelReflow(host);
  const gfx = host.std.get(GfxControllerIdentifier);
  const surface = gfx.surface!;
  let frame = 0;
  let disposed = false;
  const normalize = () => {
    frame = 0;
    if (host.store.readonly || gfx.selection.editing) return;
    for (const model of surface.elementModels) {
      if (!(model instanceof TextElementModel) || model.isLocked()) continue;
      const bound = normalizeTextBound({ yText: model.text, fontFamily: model.fontFamily, fontSize: model.fontSize, fontWeight: model.fontWeight, fontStyle: model.fontStyle, hasMaxWidth: model.hasMaxWidth }, Bound.deserialize(model.xywh), model.hasMaxWidth);
      if (Math.abs(bound.h - model.h) > 1 || (!model.hasMaxWidth && Math.abs(bound.w - model.w) > 1)) model.xywh = bound.serialize();
    }
  };
  const schedule = () => { if (!disposed && !frame) frame = requestAnimationFrame(normalize); };
  const updated = surface.elementUpdated.subscribe(schedule);
  const selected = gfx.selection.slots.updated.subscribe(schedule);
  schedule();
  void document.fonts.ready.then(schedule);
  const enhance = (element: HTMLElement) => {
    // Native autocomplete supports only shapes and note blocks. Connector
    // endpoint creation is supplied by ConnectorQuickAdd instead.
    if (element.tagName === 'EDGELESS-AUTO-COMPLETE') {
      const current = (element as HTMLElement & { current?: { type?: string; flavour?: string } }).current;
      element.style.display = current?.type === 'connector' || current?.type === 'text' ? 'none' : '';
    }
    if (element.tagName !== 'EDGELESS-SHAPE-COLOR-PICKER') return;
    const picker = element as HTMLElement & { payload?: { fillColor: string } };
    const panel = picker.shadowRoot?.querySelector<HTMLElement>('.pickers');
    if (!panel || !picker.payload) return;
    let slider = panel.querySelector<HTMLInputElement>('[data-dali-transparency]');
    if (!slider) {
      const label = document.createElement('label');
      label.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:12px;color:var(--affine-text-primary-color);';
      label.append('Fill transparency');
      slider = document.createElement('input');
      slider.type = 'range'; slider.min = '0'; slider.max = '100'; slider.step = '1';
      slider.dataset.daliTransparency = ''; slider.setAttribute('aria-label', 'Fill transparency');
      slider.style.cssText = 'width:95px;accent-color:var(--affine-primary-color)';
      const output = document.createElement('output'); output.style.minWidth = '32px';
      label.append(slider, output); panel.append(label);
      // The native toolbar prevents pointer defaults. Handle range gestures locally
      // so dragging works consistently without starting a canvas interaction.
      const setFromPointer = (event: PointerEvent) => {
        const bounds = slider!.getBoundingClientRect();
        slider!.value = String(Math.round(Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)) * 100));
        slider!.dispatchEvent(new Event('input', { bubbles: true }));
      };
      slider.addEventListener('pointerdown', event => {
        event.stopPropagation(); event.preventDefault();
        slider!.focus(); host.store.captureSync();
        slider!.setPointerCapture(event.pointerId); setFromPointer(event);
      });
      slider.addEventListener('pointermove', event => {
        if (slider!.hasPointerCapture(event.pointerId)) { event.stopPropagation(); setFromPointer(event); }
      });
      slider.addEventListener('pointerup', event => {
        if (slider!.hasPointerCapture(event.pointerId)) {
          event.stopPropagation(); slider!.releasePointerCapture(event.pointerId); host.store.captureSync();
        }
      });
      slider.addEventListener('change', () => host.store.captureSync());
      slider.addEventListener('keydown', event => event.stopPropagation());
      slider.addEventListener('input', () => {
        if (host.store.readonly) return;
        const rgba = colorPixels(picker.payload!.fillColor, picker);
        const hex = [...rgba.slice(0, 3), Math.round(255 * (1 - Number(slider!.value) / 100))].map(value => value.toString(16).padStart(2, '0')).join('');
        output.value = `${slider!.value}%`;
        picker.dispatchEvent(new CustomEvent('pickFillColor', { detail: { type: 'pick', detail: { key: `#${hex}`, value: `#${hex}` } }, bubbles: true, composed: true, cancelable: true }));
      });
    }
    if (picker.shadowRoot?.activeElement !== slider) {
      slider.value = String(Math.round(100 * (1 - colorPixels(picker.payload.fillColor, picker)[3]! / 255)));
      (slider.nextElementSibling as HTMLOutputElement).value = `${slider.value}%`;
    }
  };
  const tick = () => host.querySelectorAll<HTMLElement>('affine-toolbar-widget,edgeless-selected-rect').forEach(widget => visit(widget.shadowRoot ?? widget, enhance));
  tick();
  const timer = window.setInterval(tick, 150);
  return () => { stopLabelReflow(); disposed = true; cancelAnimationFrame(frame); clearInterval(timer); updated.unsubscribe(); selected.unsubscribe(); };
}

function colorPixels(color: string, element: HTMLElement): number[] {
  if (color.startsWith('--')) color = getComputedStyle(element).getPropertyValue(color).trim();
  if (color.startsWith('var(')) color = getComputedStyle(element).getPropertyValue(color.slice(4, -1)).trim();
  if (/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(color)) return [parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16), color.length === 9 ? parseInt(color.slice(7, 9), 16) : 255];
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d')!;
  context.fillStyle = color || '#ffffff'; context.fillRect(0, 0, 1, 1);
  const pixels = [...context.getImageData(0, 0, 1, 1).data];
  if (!pixels[3]) return [255, 255, 255, 0];
  return pixels;
}
