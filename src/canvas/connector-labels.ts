import type { EditorHost } from '@blocksuite/affine/std';
import { GfxControllerIdentifier } from '@blocksuite/affine/std/gfx';
import { ConnectorElementModel } from '@blocksuite/affine/model';
import { TextUtils } from '@blocksuite/affine/blocks/surface';
import { getFontString, getTextWidth, normalizeTextBound } from '@blocksuite/affine/gfx/text';
import { Bound } from '@blocksuite/global/gfx';
import type { LitElement } from 'lit';
import { ConnectorPathGenerator } from '@blocksuite/affine/gfx/connector';

const LAYOUT_ORIGIN = 'dali:connector-label-layout';
let pathHistoryInstalled = false;
function installPathHistory() {
  if (pathHistoryInstalled) return;
  pathHistoryInstalled = true;
  const updatePath = ConnectorPathGenerator.updatePath;
  // The native router also writes labelXYWH after endpoint undo/redo. Its
  // derived writes need the same history boundary as our width calculation.
  ConnectorPathGenerator.updatePath = (connector, path, getElement) => {
    if (!(connector instanceof ConnectorElementModel)) return updatePath(connector, path, getElement);
    connector.surface.store.doc.spaceDoc.transact(() => updatePath(connector, path, getElement), LAYOUT_ORIGIN);
  };
}

/** Use canvas units, so zooming never changes wrapping. Sample the routed path
 * (including curves/elbows), leaving space around both endpoints. */
export function connectorLabelLayout(model: ConnectorElementModel) {
  if (!model.text || model.absolutePath.length < 2) return null;
  let length = 0;
  let previous = model.getPointByOffsetDistance(0);
  for (let i = 1; i <= 32; i++) {
    const point = model.getPointByOffsetDistance(i / 32);
    length += Math.hypot(point[0]! - previous[0]!, point[1]! - previous[1]!);
    previous = point;
  }
  if (!Number.isFinite(length)) return null;
  const maxWidth = Math.max(48, Math.min(2048, Math.round(length * .75)));
  const font = getFontString(model.labelStyle);
  const naturalWidth = Math.max(16, ...model.text.toString().split('\n').map(line => getTextWidth(line, font)));
  const width = Math.min(Math.ceil(naturalWidth) + 1, maxWidth);
  const bound = normalizeTextBound({ yText: model.text, ...model.labelStyle, hasMaxWidth: true, maxWidth }, new Bound(0, 0, width, 0), true);
  bound.center = model.getPointByOffsetDistance(model.labelOffset.distance);
  return { maxWidth, bound };
}

type LabelEditor = LitElement & { connector?: ConnectorElementModel; richText?: HTMLElement };
let typographyInstalled = false;
function installLabelEditorLayout() {
  if (typographyInstalled) return;
  const ElementClass = customElements.get('edgeless-connector-label-editor') as typeof LitElement | undefined;
  if (!ElementClass) return;
  typographyInstalled = true;
  ElementClass.addInitializer(host => {
    const editor = host as LabelEditor;
    editor.addController({ hostUpdated() {
      const model = editor.connector;
      const container = editor.querySelector<HTMLElement>('.edgeless-connector-label-editor');
      if (!model || !container || !editor.richText) return;
      const layout = connectorLabelLayout(model);
      if (!layout) return;
      // Explicit width defeats absolute-position shrink-to-fit near the
      // viewport edge. The native ResizeObserver then measures the same wrap
      // used by the canvas renderer, including while typing and IME input.
      container.style.width = `${layout.bound.w + 6}px`;
      container.style.maxWidth = `${layout.maxWidth + 6}px`;
      editor.richText.style.fontFamily = `${TextUtils.wrapFontFamily(model.labelStyle.fontFamily)}, sans-serif`;
      editor.richText.style.fontStyle = model.labelStyle.fontStyle;
    } });
  });
}

export function installConnectorLabelReflow(host: EditorHost) {
  installPathHistory();
  installLabelEditorLayout();
  const gfx = host.std.get(GfxControllerIdentifier);
  const surface = gfx.surface!;
  let frame = 0;
  let disposed = false;
  const reflow = () => {
    frame = 0;
    if (host.store.readonly) return;
    // Derived geometry must never clear redo or add an undo step. The outer
    // Yjs origin is deliberately excluded from the native user undo manager.
    host.store.doc.spaceDoc.transact(() => {
      for (const model of surface.elementModels) {
        if (!(model instanceof ConnectorElementModel)) continue;
        const layout = connectorLabelLayout(model);
        if (!layout) continue;
        const { bound, maxWidth } = layout;
        if (!model.labelConstraints.hasMaxWidth || model.labelConstraints.maxWidth !== maxWidth) {
          model.labelConstraints = { hasMaxWidth: true, maxWidth };
        }
        // While editing, the native DOM observer owns the measured bounds.
        if (!model.labelEditing && (!model.labelXYWH || bound.toXYWH().some((n, i) => Math.abs(n - model.labelXYWH![i]!) > .5))) {
          model.labelXYWH = bound.toXYWH();
        }
      }
    }, LAYOUT_ORIGIN);
  };
  const schedule = () => { if (!disposed && !frame) frame = requestAnimationFrame(reflow); };
  const subscriptions = [surface.elementUpdated.subscribe(schedule), surface.elementAdded.subscribe(schedule), gfx.selection.slots.updated.subscribe(schedule)];
  schedule();
  void document.fonts.ready.then(schedule);
  return () => { disposed = true; cancelAnimationFrame(frame); subscriptions.forEach(subscription => subscription.unsubscribe()); };
}
