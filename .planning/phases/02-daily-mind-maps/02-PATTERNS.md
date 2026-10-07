# Phase 2: Daily Mind Maps — Pattern Map

**Mapped:** 2026-09-12
**Scope:** Planning reference; source remains unchanged. Candidate new filenames are recommendations, subject to the final research and plan. No Phase 2 CONTEXT or RESEARCH existed when this map was prepared. The UI-SPEC supplies the interaction scope.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/canvas/extensions.ts` | config | event-driven | same file | exact |
| `src/canvas/mindmap.ts` (new) | service | CRUD | `src/canvas/arrangement.ts` | exact |
| `src/canvas/mindmap-keyboard.ts` (new) | utility | event-driven | `src/canvas/arrangement.ts` | exact |
| `src/canvas/MindMapInspector.tsx` (new, if native controls need supplementation) | component | event-driven | `src/canvas/BlockSuiteCanvas.tsx` | role-match |
| `src/canvas/BlockSuiteCanvas.tsx` | component | event-driven | same file | exact |
| `src/canvas/selection-summary.ts` | utility | transform | `src/canvas/export-plan.ts` | exact |
| `src/canvas/arrangement.ts` | service | CRUD | same file | exact |
| `src/canvas/LayersInspector.tsx` | component | event-driven | `src/canvas/BlockSuiteCanvas.tsx` | role-match |
| `src/canvas/presentation-export.ts` | service | transform / file-I/O | same file | exact |
| `src/canvas/export-plan.ts` | utility | transform | same file | exact |
| `src/header/ExportDialog.tsx` | component | event-driven | `src/canvas/BlockSuiteCanvas.tsx` | role-match |
| `src/index.css` | config | transform | none selected | no analog |
| `src/canvas/mindmap.test.ts` (new) | test | CRUD / transform | `src/canvas/export-plan.test.ts` | role-match |
| `tests/mindmap.spec.ts` (new) | test | event-driven | `tests/fixtures.ts` | exact scaffolding |
| `tests/mindmap-export.spec.ts` (new or extend existing export suite) | test | file-I/O | `tests/fixtures.ts` | role-match |

**Files classified:** 15. **Matches:** 14 / 15 (9 exact, 5 role-match, 1 no analog). Existing integration files are conditional modification targets: change only seams required by the final plan. Persistence uses existing document storage rather than a second map store.

## Pattern Assignments

### Native registration — `src/canvas/extensions.ts`

**Analog:** `src/canvas/extensions.ts` (explicit store/view registration), lines 38–45:

```ts
import { ShapeStoreExtension } from '@blocksuite/affine/gfx/shape/store';
import { ShapeViewExtension } from '@blocksuite/affine/gfx/shape/view';
import { BrushStoreExtension } from '@blocksuite/affine/gfx/brush/store';
import { BrushViewExtension } from '@blocksuite/affine/gfx/brush/view';
import { ConnectorStoreExtension } from '@blocksuite/affine/gfx/connector/store';
import { ConnectorViewExtension } from '@blocksuite/affine/gfx/connector/view';
import { GroupStoreExtension } from '@blocksuite/affine/gfx/group/store';
import { GroupViewExtension } from '@blocksuite/affine/gfx/group/view';
```

Add the researched native mind-map pair to the corresponding arrays (store lines 89–111; view lines 114–145). Preserve explicit public-subpath imports. `src/canvas/runtime.ts` lines 54–58 constructs the store manager; `src/canvas/blocksuite-editor.ts` lines 30–38 constructs the edgeless view scope. These existing consumers establish the integration points for visible and auxiliary hosts that share the registry. Research must verify any additional headless/hidden host rather than assume it shares registration.

### Guarded model operations — `src/canvas/mindmap.ts`, `src/canvas/arrangement.ts`

**Analog:** `src/canvas/arrangement.ts` (native service commands), imports lines 1–14. Use `EditorHost` as the operation boundary and obtain services from `host.std`. Guard example, lines 30–34:

```ts
export function canvasSelectionEditable(host: EditorHost): boolean {
  const gfx = host.std.get(GfxControllerIdentifier);
  return host.isConnected && !host.std.store.readonly && !gfx.selection.editing &&
    gfx.selection.selectedElements.length > 0 && !gfx.selection.selectedElements.some(protectedModel);
}
```

Mutation/history example, lines 153–160:

```ts
if (!host.isConnected || host.std.store.readonly || protectedModel(model)) return;
const index = gfx.layer.getReorderedIndex(model, direction);
if (index === model.index) return;
host.std.store.captureSync();
host.std.store.transact(() => {
  model.index = index;
});
host.std.store.captureSync();
```

Adapt guards for the requested action: root creation does not require a prior selection; child/sibling operations require exactly one visible valid topic. Validate hierarchy, locks, and geometry before writes. A document transaction groups observations; it does not establish rollback on exceptions. The UI-SPEC's retained-state error promise requires explicit preflight or restoration verified by fault injection.

Creation positioning analog: `src/canvas/text.ts` lines 42–59 obtains the viewport center, creates through native CRUD, and supplies `new Text(PLACEHOLDER).yText`. Lines 62–69 capture history and select the native ID. Mind-map creation must use the researched native tree API and open text editing per UI-SPEC.

### Focus-safe keyboard installation — `src/canvas/mindmap-keyboard.ts`

**Analog:** `src/canvas/arrangement.ts` lines 51–58:

```ts
export function installArrangementShortcuts(host: EditorHost, onError: (error: unknown) => void): () => void {
  const onKey = (event: KeyboardEvent) => {
    if (event.defaultPrevented || !host.isConnected || event.isComposing) return;
    const editing = event.composedPath().some(target => target instanceof HTMLElement &&
      (target.isContentEditable || target.matches('input, textarea, select, [role="textbox"]')));
    if (editing) return;
    const gfx = host.std.get(GfxControllerIdentifier);
    if (gfx.selection.editing) return;
```

Error/cleanup pattern, lines 73–80:

```ts
try {
  if (key === 'd') void duplicateCanvasSelection(host).catch(onError);
  else if (event.shiftKey) ungroupCanvasSelection(host);
  else groupCanvasSelection(host);
} catch (error) { onError(error); }
// ...
document.addEventListener('keydown', onKey, true);
return () => document.removeEventListener('keydown', onKey, true);
```

Extend for actual canvas focus, dialogs/menus, key-repeat suppression, Shift+Tab exit, selection cardinality, and composition-end Enter suppression. Existing `isComposing` alone does not prove the latter. Resolve native shortcut precedence explicitly; capture handlers must not cause duplicate native/application node creation.

### Application controls — `BlockSuiteCanvas.tsx`, `MindMapInspector.tsx`, `LayersInspector.tsx`, `ExportDialog.tsx`

**Analog:** `src/canvas/BlockSuiteCanvas.tsx` lines 19–28 keeps the mounted host in React state. Add mutation controls only after host readiness. Its reusable control markup, lines 379–385:

```tsx
<button
  type="button"
  aria-label={label}
  title={label}
  disabled={disabled}
  onClick={onClick}
  className="board-control"
```

Use the same labels and theme conventions while applying the phase's 44px target requirement; existing 2rem dimensions at lines 389–390 require adaptation. `StartupFailure` lines 406–461 demonstrates an alert plus retry action. Native contextual controls remain the first integration choice; add React controls for unmet contracts, with selected IDs retained while controls receive focus. Layers hierarchy originates in `src/canvas/arrangement.ts` lines 103–132: extend visibility filtering there as well as rendering the resulting list.

### Export membership and rendering — `presentation-export.ts`, `export-plan.ts`, `selection-summary.ts`

**Analog:** `src/canvas/export-plan.ts` lines 21–30 preserves native order after recursive ID inclusion:

```ts
const nodes = new Map(ordered.map(node => [node.id, node]));
const included = new Set<string>();
const add = (id: string) => {
  if (included.has(id) || !nodes.has(id)) return;
  included.add(id);
  nodes.get(id)!.children.forEach(add);
};
selected.forEach(add);
return ordered.filter(node => included.has(node.id)).map(node => node.id);
```

`src/canvas/presentation-export.ts` lines 106–141 resolves board/viewport/selection/frame membership; lines 147–161 computes bounds and returns actionable invalid plans. Apply effective mind-map visibility before membership and bounds. Selected whole maps and selected topics have different inclusion rules from ordinary groups; preserve existing ordinary connector semantics.

Native raster seam, lines 218–227:

```ts
const elements = layer.elements.filter(model => included.has(model.id) && !('type' in model && model.type === 'group'));
// ...
native._renderByBound(ctx, matrix, new RoughCanvas(canvas), renderBound, elements as GfxPrimitiveElementModel[]);
```

Preserve the native render path while explicitly proving how derived mind-map connectors enter it. Group exclusion alone does not establish mind-map overlay exclusion. Verify collapsed nodes, badges, bounds, and pixels separately. The lifecycle/revision guard at lines 189–192 fails a stale export; lines 287–289 release allocated output on failure.

### Browser and unit verification — new mind-map tests

**Analog:** `tests/fixtures.ts` lines 21–38 installs an automatic console/page-error gate:

```ts
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`);
});
await use(errors);
const unexpected = errors.filter(
  (e) => !expectErrors.some((allowed) => e.includes(allowed))
);
expect(unexpected, 'unexpected console/page errors').toEqual([]);
```

Browser suites import `test, expect` from `./fixtures`. Test user input through actual controls; use model inspection for IDs, hierarchy, bounds, and persistence assertions. Fault-injection cases declare narrowly expected errors through the fixture option.

**Unit analog:** `src/canvas/export-plan.test.ts` lines 1–2:

```ts
import { describe, expect, it } from 'vitest';
import { computeExportPlan, DEFAULT_EXPORT_OPTIONS, EXPORT_LIMITS, selectionIds, positiveIntersection, type ExportBounds } from './export-plan';
```

Lines 25–39 demonstrate identity/order assertions and table-driven invalid inputs. Apply to pure topology/visibility/keyboard-decision helpers; use browser evidence for native layout, focus, text measurement, reload, and raster output.

## Shared Patterns

- **Persistence and copying:** `src/canvas/runtime.ts` lines 99–107 opens the existing document via `store.load()`. `src/boards/operations.ts` lines 156–165 copies through `source.getTransformer([replaceIdMiddleware(workspace.idGenerator)])`, `docToSnapshot`, and `snapshotToDoc(structuredClone(snapshot))`. Preserve native metadata and ID-remapping semantics through this path; test topology and collapse round trips. Object duplication in `src/canvas/arrangement.ts` lines 36–48 serializes per-host work and invokes native `duplicate`.
- **Cleanup:** `src/canvas/blocksuite-editor.ts` lines 100–112 makes destruction idempotent and lets host disconnection own native unmount. New event subscriptions must return cleanup functions.
- **Authorization seam:** connected-host, read-only-store, selection, and locked-model guards apply now. Phase 2 introduces no identity service; later board permissions must enforce authorization separately.
- **Errors:** preflight invalid state, propagate actionable errors to controls, and retain native IDs. New error messages follow the UI-SPEC. Do not swallow mutation failures as success.
- **Public artifacts:** fixtures use synthetic labels and relative repository references. No operator settings or private evidence belong in this file or tests.

## No Analog Found

| File / behavior | Role | Data Flow | Reason |
|---|---|---|---|
| `src/index.css` additions | config | transform | Use UI-SPEC token and target contracts; no separate stylesheet analog selected. |
| Native map collapse, layout, derived connectors, explicit style preservation | service / renderer | CRUD / transform | Existing tracked application code has no mind-map implementation. Use researched pinned dependency APIs and validate their behavior; dependency installation files are not edit targets or tracked analogs. |
| Full IME terminating-Enter protection and topic-edit commit behavior | utility | event-driven | Existing composed-path guard is a starting point; the stronger phase contract needs dedicated implementation and browser evidence. |

## Metadata

**Analog search scope:** tracked `src/canvas`, `src/boards`, `tests`; 11 complete source reads plus targeted test/export symbol discovery. Five pattern families cover integration, guarded operations, UI, export, and tests; supporting lifecycle/copy sources establish cross-cutting seams.

**Tracked-source gate:** all analog paths above appeared in `git ls-files` output. No installed dependency or runtime mirror path is assigned as an analog.

**Pattern extraction date:** 2026-09-12. This artifact establishes reusable code patterns and implementation gaps, not runtime acceptance.
