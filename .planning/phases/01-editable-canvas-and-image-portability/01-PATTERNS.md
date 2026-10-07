# Phase 1: Editable Canvas and Image Portability - Pattern Map

**Mapped:** 2026-09-11. **Detailed change targets:** 18; all have at least a partial structural analog. Proposed addition names remain planner choices.

Source: DJAI Academy, [djai-open-canvas](https://github.com/DJAI-Academy/djai-open-canvas/tree/27f8bb97b10984e04e48d7650d954d0a7ecd212c) (pinned application source). Every `upstream/` reference below means a path within this revision; each named analog was confirmed with `git ls-files` in the upstream repository. Dali currently requires foundation incorporation. These are planning references; runtime/API compatibility remains subject to the research checkpoints.

## File Classification

| New/modified target | Role | Data flow | Closest analog / assignment | Quality |
|---|---|---|---|---|
| `src/canvas/BlockSuiteCanvas.tsx` | component | event-driven | upstream same path, A | exact |
| `src/canvas/image-input.ts` (proposed) | service | file-I/O | upstream `src/canvas/BlockSuiteCanvas.tsx`, A | partial |
| `src/canvas/export-plan.ts` (proposed) | utility | transform | upstream `src/canvas/presentation-export.ts`, B | partial |
| `src/canvas/presentation-export.ts` | service | transform | upstream same path, B | exact |
| `src/header/ExportDialog.tsx` | component | event-driven | upstream same path, C | exact |
| `src/canvas/export-board.ts` | service | file-I/O | upstream same path, C | exact |
| `src/canvas/arrangement.ts` | utility | CRUD | upstream same path, D | exact |
| `src/canvas/EdgelessToolbarDragHandle.tsx` | component | event-driven | upstream `src/canvas/BlockSuiteCanvas.tsx`, A | role-match |
| `src/index.css` | config | transform | upstream `src/canvas/BlockSuiteCanvas.tsx` layout styles, A | partial |
| `src/canvas/export-plan.test.ts` | test | transform | upstream `src/canvas/selection-summary.test.ts`, E | exact |
| `src/canvas/image-input.test.ts` (proposed) | test | transform | upstream `src/canvas/selection-summary.test.ts`, E | exact |
| `tests/canvas-editing.spec.ts` | test | event-driven | upstream `tests/fixtures.ts`, E | role-match |
| `tests/canvas-arrangement.spec.ts` | test | event-driven | upstream `tests/fixtures.ts`, E | role-match |
| `tests/image-import.spec.ts` | test | file-I/O | upstream `tests/fixtures.ts`, E | role-match |
| `tests/image-export.spec.ts` | test | file-I/O | upstream `tests/fixtures.ts`, E | role-match |
| `tests/fixtures.ts` | test | event-driven | upstream same path, E | exact |
| `playwright.config.ts` | config | batch | upstream same path, E | exact |
| `vite.config.ts` | config | transform | upstream same path, E | exact |

### Foundation incorporation inventory

The researcher already audited source adoption. Incorporate its reviewed dependency closure and notices before changing the targets above. Additional files explicitly referenced by context/research are classified here as retained foundation, with same-path upstream origins verified as tracked: `src/App.tsx` and `src/header/Header.tsx` (component/event-driven); `src/canvas/blocksuite-editor.ts` and `src/canvas/runtime.ts` (provider/event-driven); `src/canvas/extensions.ts` (config/transform); `src/canvas/workspace.ts` (provider/CRUD); `src/boards/catalog.ts` and `src/boards/preferences.ts` (store/CRUD); `package.json` and `package-lock.json` (config/batch); `LICENSE` (documentation/file-I/O); `tests/community.spec.ts` (test/event-driven). Preserve storage identifiers and native registrations. Carry necessary transitive source/assets from the reviewed incorporation inventory; this map does not authorize copying generated/runtime directories or operator settings.

## Pattern Assignments

### A — Canvas lifecycle, controls and image input

**Analog:** upstream `src/canvas/BlockSuiteCanvas.tsx` (editor integration), imports 1–16; mount/cleanup 37–70; controls 74–82; picker 115–134; vertical layout 185–197.

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { addImages } from '@blocksuite/affine/blocks/image';
import { MAX_IMAGE_WIDTH } from '@blocksuite/affine/model';
// Lines 63–69: disposable view ownership
return () => {
  cancelled = true;
  handle?.destroy();
  setHost(null);
};
// Lines 117, 120–121, 126: picker insertion seam
const files = [...(event.target.files ?? [])];
event.target.value = '';
if (files.length === 0) return;
await addImages(host.std, files, { maxWidth: MAX_IMAGE_WIDTH });
```

Apply host gating to toolbar/inspector controls; retain cancelled-mount cleanup. Move drawing tools into the left rail using the existing absolute-left, column-flex layout. Normalize picker/drop/paste through one insertion adapter. Read the installed pinned API before adding placement arguments or handlers, so native clipboard/drop listeners cannot duplicate inserts. Replace the picker’s swallowed catch (127–131) with an import-specific alert and retry; preserve text-editing focus and image proportions.

### B — Pure export plan and mixed-layer renderer

**Analog:** upstream `src/canvas/presentation-export.ts` (membership, geometry and rendering), imports 1–11; descendants 64–72; scopes 74–103; layer loop 175–207.

```ts
import { CanvasRenderer, ExportManager } from '@blocksuite/affine/blocks/surface';
import { Bound } from '@blocksuite/global/gfx';
// Lines 65–71: selected group membership
const result = new Map<string, GfxModel>();
const add = (model: GfxModel) => {
  result.set(model.id, model);
  if (isGfxGroupCompatibleModel(model)) model.descendantElements.forEach(add);
};
models.forEach(add);
return [...result.values()];
// Lines 178–180: filter every rendered layer by membership
for (const layer of gfx.layer.layers) {
  const elements = layer.elements.filter(model => included.has(model.id));
  if (!elements.length) continue;
  // Preserve distinct primitive/DOM rendering branches at lines 181–203.
}
```

Extract membership and dimensions into the pure plan shared by preview and renderer. Preserve native model IDs and group descendants. Frame bounds control the crop; selected-object membership excludes overlapping unselected objects. Replace DPR-derived scale, fixed padding and paper/grid background with D-07–D-15 rules. The existing primitive `getCanvasByBound` and DOM `edgelessToCanvas` calls establish integration seams; source-raster scale support requires the dependency spike. Keep the `finally` restoration of temporary DOM styles (205–206).

### C — Export UI, encoding and dispatch

**Analogs:** upstream `src/header/ExportDialog.tsx` (dialog state), 4–9, 23–40, 100–108, 172–175; upstream `src/canvas/export-board.ts` (encoding/dispatch), 60–82, 146–160.

```ts
// ExportDialog.tsx lines 35–39
} catch (cause) {
  setError(cause instanceof Error ? cause.message : String(cause));
} finally {
  setExporting(false);
}
// export-board.ts lines 79–82
async function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('The browser could not encode this canvas as PNG.');
  return blob;
}
```

Use the dialog’s disabled states, `role="alert"`, focus recovery and async retry. Route scale/background/scope through one typed options contract; obtain preview dimensions from the same plan used for rendering. Offer explicit lower-resolution recovery on limits. Reuse filename normalization and object-URL cleanup. Report download dispatch accurately; browser tests must inspect completed downloaded files. Restrict Phase 1 image controls to approved PNG behavior.

### D — Native arrangement and history

**Analog:** upstream `src/canvas/arrangement.ts` (document mutation), imports 1–12; grouping 111–129; validation/transactions 147–205.

```ts
// Lines 116–119
host.std.store.captureSync();
const [, result] = host.std.command.exec(createGroupFromSelectedCommand);
host.std.store.captureSync();
if (!result.groupId) throw new Error('These objects cannot be grouped together.');
```

Reuse native commands for shortcuts and inspector actions. Batch geometry changes through `store.transact`; preserve lock checks and undo boundaries. Validate shortcuts in native rich-text editing as well as canvas selection.

### E — Unit/browser tests and configuration

**Analogs:** upstream `src/canvas/selection-summary.test.ts` (table-driven unit test), 1–20; upstream `tests/fixtures.ts` (automatic error gate), 1, 14–42; upstream `playwright.config.ts` (dev/prod projects), 6–31; upstream `vite.config.ts` (transforms/test discovery), 38–44, 110–140.

```ts
// selection-summary.test.ts lines 1–2: use local pure-module imports
import { describe, expect, it } from 'vitest';
import { canvasItemKind } from './selection-summary';
// fixtures.ts lines 31–34: assert unexpected browser errors after each test
const unexpected = errors.filter(
  (e) => !expectErrors.some((allowed) => e.includes(allowed))
);
expect(unexpected, 'unexpected console/page errors').toEqual([]);
```

All browser specs import `{ test, expect }` from `./fixtures`; retain its `{ auto: true }` option. Use pure table-driven membership/dimension/validation tests. Broaden the inherited community-only `testMatch`, fail missing unit suites, and verify discovery. Preserve ES2022, vanilla-extract and `useDefineForClassFields: false` across source/optimizer builds. Add synthetic fixtures and downloaded-PNG decoding oracles described in research; cover DPR/zoom independence, alpha, clipping, nested groups, connector membership and failure recovery.

## Shared Patterns

Relative application imports, explicit type imports and native BlockSuite imports recur across A–D. Component boundaries normalize unknown failures to messages; services throw actionable errors. Disposable effects and `finally` blocks restore editor state. Native commands and transactions preserve document history. Authentication remains assigned to Phase 3; Phase 1 readiness guards concern the mounted editor and valid inputs.

## No Complete Behavioral Analog Found

Image decode/placement normalization, pure export planning, measured browser allocation limits, and decoded downloaded-PNG assertions require new behavior. Their structural assignments above are starting points; use `01-RESEARCH.md` (technical checkpoints and validation architecture) for the missing contracts and oracles.

## Metadata

**Scope:** tracked upstream `src/canvas`, `src/header`, `tests`, root build/test configuration; existing Dali planning. **Detailed source files read:** 9. **Change coverage:** 10 exact, 5 role-match, 3 partial; 18 total, plus retained foundation inventory. **Validation:** tracked-source gate and source excerpts checked; implementation/runtime verification belongs to execution. No source modifications or commits.
