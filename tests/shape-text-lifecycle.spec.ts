import type { EdgelessShapeTextEditor } from '@blocksuite/affine/gfx/shape';
import { test, expect } from './fixtures';

type MeasurementEditor = Omit<EdgelessShapeTextEditor, never> & { _updateElementWH(): void };
type Probe = {
  held: number;
  callbacks: number;
  writes: number;
  updates: number;
  before: string;
  selection: string;
  settle(mode: 'readonly' | 'detached' | 'writable'): Promise<void>;
  snapshot(): { model: string; selection: string; callbacks: number; writes: number; updates: number };
  cleanup(): void;
};
declare global { interface Window { shapeMeasurementProbe: Probe } }

for (const mode of ['readonly', 'detached', 'writable'] as const) {
  test(`@recovery-lifecycle deferred native shape measurement respects ${mode} destination`, async ({ page, pageErrors }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Add mind map', exact: true }).click();
    const editor = page.locator('edgeless-shape-text-editor');
    await expect(editor.locator('[contenteditable=true]').first()).toBeVisible();
    await page.keyboard.type('Deferred native measurement');
    await expect(page.getByRole('button', { name: 'Saved, Open save details', exact: true })).toBeVisible();
    await editor.evaluate(async el => { await (el as EdgelessShapeTextEditor).updateComplete; });
    await editor.evaluate(el => {
      const editor = el as unknown as MeasurementEditor;
      const store = editor.std.store; const originalReadonly = store.readonly; const targetHeight = editor.element.h + 40;
      const measurement = editor._updateElementWH;
      const update = editor.crud.updateElement;
      const ownComplete = Object.getOwnPropertyDescriptor(editor, 'updateComplete');
      let release!: () => void; const gate = new Promise<boolean>(resolve => { release = () => resolve(true); });
      const model = () => JSON.stringify(store.spaceDoc.toJSON());
      const selection = () => JSON.stringify({ ids: editor.gfx.selection.selectedElements.map(value => value.id), editing: editor.gfx.selection.editing });
      const onUpdate = () => { probe.updates++; };
      const restoreComplete = () => {
        if (ownComplete) Object.defineProperty(editor, 'updateComplete', ownComplete);
        else delete (editor as unknown as { updateComplete?: Promise<boolean> }).updateComplete;
      };
      const probe: Probe = {
        held: 0, callbacks: 0, writes: 0, updates: 0, before: '', selection: '',
        async settle(mode) {
          // Change lifetime only after the native viewport handler has queued
          // its updateComplete callback. Capture after ordinary detach cleanup.
          if (mode === 'readonly') store.readonly = true;
          if (mode === 'detached') editor.std.host.remove();
          probe.before = model(); probe.selection = selection();
          probe.writes = 0; probe.updates = 0; store.spaceDoc.on('update', onUpdate);
          restoreComplete(); release();
          await Promise.resolve(); await Promise.resolve();
          await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        },
        snapshot: () => ({ model: model(), selection: selection(), callbacks: probe.callbacks, writes: probe.writes, updates: probe.updates }),
        cleanup() {
          release(); restoreComplete(); store.spaceDoc.off('update', onUpdate);
          editor._updateElementWH = measurement; editor.crud.updateElement = update;
          // Scope remains the original authorized writable board in this test.
          store.readonly = originalReadonly;
        },
      };
      Object.assign(window, { shapeMeasurementProbe: probe });
      Object.defineProperty(editor, 'updateComplete', { configurable: true, get() { probe.held++; return gate; } });
      editor._updateElementWH = function() {
        probe.callbacks++;
        // Force a real DOM measurement discrepancy at callback time, so a
        // writable control must take the native geometry mutation branch.
        editor.richText.style.minHeight = `${targetHeight}px`;
        measurement.call(editor);
      };
      editor.crud.updateElement = ((...args: Parameters<typeof update>) => {
        probe.writes++; return update.apply(editor.crud, args);
      }) as typeof update;
      const center = editor.gfx.viewport.center;
      editor.gfx.viewport.setCenter(center.x + 19, center.y + 11);
    });
    try {
      await expect.poll(() => page.evaluate(() => window.shapeMeasurementProbe.held)).toBeGreaterThan(0);
      await page.evaluate(mode => window.shapeMeasurementProbe.settle(mode), mode);
      const result = await page.evaluate(() => ({ ...window.shapeMeasurementProbe.snapshot(), before: window.shapeMeasurementProbe.before, priorSelection: window.shapeMeasurementProbe.selection }));
      expect(result.callbacks).toBeGreaterThan(0);
      if (mode === 'writable') {
        expect(result.writes).toBeGreaterThan(0); expect(result.updates).toBeGreaterThan(0);
        // Native mind-map layout may restore the original final bounds after
        // measurement; actual CRUD and Yjs updates establish the writable path.
      } else {
        expect(result.writes).toBe(0); expect(result.updates).toBe(0);
        expect(result.model).toBe(result.before); expect(result.selection).toBe(result.priorSelection);
      }
      expect(pageErrors).toEqual([]);
    } finally { await page.evaluate(() => window.shapeMeasurementProbe.cleanup()); }
  });
}
