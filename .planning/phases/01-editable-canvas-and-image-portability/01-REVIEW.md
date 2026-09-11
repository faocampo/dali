---
phase: 01-editable-canvas-and-image-portability
reviewed: 2026-09-11T20:20:38Z
original_reviewed: 2026-09-11T20:02:24Z
reviewed_head: 010a276
depth: standard
files_reviewed: 49
files_reviewed_list:
  - index.html
  - package.json
  - playwright.config.ts
  - scripts/gen-blocksuite-paths.mjs
  - src/App.tsx
  - src/boards/BoardLibrary.tsx
  - src/boards/catalog.ts
  - src/boards/operations.ts
  - src/boards/preferences.ts
  - src/boards/templates.ts
  - src/canvas/BlockSuiteCanvas.tsx
  - src/canvas/EdgelessToolbarDragHandle.tsx
  - src/canvas/FrameBorderOverlay.tsx
  - src/canvas/LayersInspector.tsx
  - src/canvas/SelectionInspector.tsx
  - src/canvas/arrangement.ts
  - src/canvas/blocksuite-editor.ts
  - src/canvas/chrome-drag.ts
  - src/canvas/export-board.ts
  - src/canvas/export-plan.test.ts
  - src/canvas/export-plan.ts
  - src/canvas/extensions.ts
  - src/canvas/image-input.test.ts
  - src/canvas/image-input.ts
  - src/canvas/image-visual-edits.ts
  - src/canvas/presentation-export.ts
  - src/canvas/resize-affordance.ts
  - src/canvas/runtime.ts
  - src/canvas/save-status.test.ts
  - src/canvas/save-status.ts
  - src/canvas/selection-summary.test.ts
  - src/canvas/selection-summary.ts
  - src/canvas/sticky.ts
  - src/canvas/text.ts
  - src/canvas/workspace.ts
  - src/header/ExportDialog.tsx
  - src/header/Header.tsx
  - src/header/links.ts
  - src/main.tsx
  - src/vite-env.d.ts
  - tests/canvas-arrangement.spec.ts
  - tests/canvas-editing.spec.ts
  - tests/community.spec.ts
  - tests/fixtures.ts
  - tests/image-export.spec.ts
  - tests/image-import.spec.ts
  - tests/image-visual-edits.spec.ts
  - tsconfig.json
  - vite.config.ts
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
historical_findings:
  critical: 3
  warning: 0
  info: 0
  total: 3
status: clean
fix_status: independently_rechecked
fix_report: 01-REVIEW-FIX.md
---

# Phase 1: Code Review Report

Review range: `0259451..1065eb9`. Standard review covered the listed application, test, and configuration files, with focused cross-module tracing of image edits, arrangement, input, and export. The upstream import is part of this range. Binary assets, generated type-path mappings, and planning artifacts were excluded. CSS and documentation were outside this bounded behavioral review.

## Narrative Findings (AI reviewer)

**Final verdict at `010a276`: clean for the assigned fix recheck.** All three original blockers are resolved. No new finding was identified in the focused changes. Frontmatter counts represent open findings; the three original findings and their original source coordinates are preserved below as historical evidence.

The initial review reproduced three BLOCKER findings in isolated Chromium contexts using synthetic image data and the actual application modules. Those reproductions used native store mutations to isolate the relevant model transitions; they were API-level browser reproductions, rather than full pointer-driven end-to-end tests.

### Independent fix recheck

The recheck inspected commits `9200c6c`, `807866d`, `3d5c79d`, `a569c05`, and `010a276`, including changed source and the focused browser regression assertions. It traced the native SVG clipboard recognizer to confirm the interception targets its accepted SVG-document path. The cumulative file list adds the new image-edit regression file; the second pass was confined to the fix changes and their immediate callers.

| Finding | Independent conclusion and current evidence |
| --- | --- |
| CR-01 | Resolved. `uncroppedGeometry` derives base geometry from current native `xywh` and prior crop settings; both apply and reset use it (`src/canvas/image-visual-edits.ts:210`, `:300`, `:355`). The regression drives native movement and resizing before adjustment and reset. |
| CR-02 | Resolved. Lookup requires exact image ownership, and reconciliation creates independent schema-only metadata records with per-image geometry before mutation (`src/canvas/image-visual-edits.ts:126`, `:136`). The Duplicate caller reconciles its result. The regression checks two records, unchanged original pixels/geometry, and independent reset. |
| CR-03 | Resolved. Apply, replacement, and inspector initialization deserialize native `xywh` (`src/canvas/image-visual-edits.ts:300`, `:390`; `src/canvas/SelectionInspector.tsx:78`). Regressions cover 90° and 37° geometry apply, adjustment, crop/reset, and replacement. |
| T03SIZE | Assigned security follow-up checked. Replacement reuses PNG/JPEG header and decoded-size validation; plain-text SVG documents are intercepted before native rasterization (`src/canvas/image-input.ts:40`, `:121`; `src/canvas/image-visual-edits.ts:384`). Regression assertions check rejection before decoding, retained image state, and retry. |
| T03RACE | Assigned security follow-up checked. Replacement captures host/store/model/source identity and checks current ownership and editability after each asynchronous boundary, with no asynchronous gap before mutation (`src/canvas/image-visual-edits.ts:370-395`). Regressions cover board identity change and host disconnection during blob storage. |

The parent execution reported 64 focused browser cases passing across four projects, 14 focused input units, typecheck, and production build. This independent pass reviewed the implementation and regression oracles and ran `git diff --check 1065eb9..010a276` successfully; it did not rerun the browser suite or start a server. Archive round-trip behavior and alignment-specific regression coverage remain unverified in this bounded pass, as recorded in [01-REVIEW-FIX.md](01-REVIEW-FIX.md) (fix evidence and coverage limits). The verdict applies to the assigned defects and changes, not a new whole-repository review.

### CR-01: Image adjustments overwrite placement changes made through native canvas tools

**Fix status:** RESOLVED — implemented in `9200c6c`; independently rechecked at `010a276`.

**Classification:** BLOCKER
**File:** `src/canvas/image-visual-edits.ts:248-251`
**Related paths:** `src/canvas/image-visual-edits.ts:298-311`, `src/canvas/image-visual-edits.ts:345-371`, `src/canvas/arrangement.ts:199-202`

**Issue:** After the first visual edit, subsequent edits always reuse stored `baseX/baseY/baseWidth/baseHeight`. Only the custom `updateImageGeometry` path updates that state. Native movement, resize, and alignment update the image's `xywh` independently. Applying brightness, contrast, another crop, or reset subsequently restores stale geometry and discards those later arrangement changes.

**Observed reproduction:** Create a 200 × 100 image at `[100,100,200,100]`. Apply brightness 10 and a 10% left crop; its geometry becomes `[120,100,180,100]`. Update the native image geometry to `[520,500,180,100]`, then apply brightness 20 with the same crop. The actual result returns to `[120,100,180,100]`; the expected position remains `[520,500,180,100]`.

**Fix:** Before applying or resetting visual edits, derive the uncropped base geometry from the current native `xywh`, current rotation, and previous crop percentages. Centralize that inverse-crop calculation and reuse it from the inspector. Alternatively, synchronize edit metadata transactionally for every native geometry-change path. Preserve later movement and resize when changing pixel adjustments.

**Regression validation:** Crop, then move/resize with native handles and align with another object; changing brightness and resetting edits must preserve the latest arrangement while restoring the appropriate uncropped extent.

### CR-02: Duplicated edited images share mutable edit metadata

**Fix status:** RESOLVED — implemented in `807866d`; independently rechecked at `010a276`.

**Classification:** BLOCKER
**File:** `src/canvas/image-visual-edits.ts:125-133`
**Related paths:** `src/canvas/image-visual-edits.ts:280-283`, `src/canvas/image-visual-edits.ts:298-311`, `src/canvas/arrangement.ts:36-44`

**Issue:** When an image has no exact metadata record, `getImageVisualEdit` returns any record with the same `processedSourceId`. Native image duplication shares the source blob but creates a distinct image identity. The fallback therefore returns the original image's mutable metadata for the duplicate. Editing the duplicate rewrites the original record's `imageId`; resetting or replacing the duplicate deletes the original record entirely. The original loses its base-image/reset history, and the duplicate can jump to the original's saved geometry.

**Observed reproduction:** After creating and editing an image, create a second native image using its processed source at `[700,100,180,100]`. Both calls to `getImageVisualEdit` return the same metadata ID. Resetting the copy moves it to `[100,100,200,100]` and leaves `getImageVisualEdit(originalId)` null. This isolates the source-sharing transition used by native duplication.

**Fix:** Make metadata ownership strictly per image ID. When duplicating or importing images, create or remap an independent metadata record for each resulting image and translate its base geometry to that image's placement. If a source-based fallback is required for legacy imports, use it only to clone/reassociate state safely; never return another live image's mutable record for update or deletion.

**Regression validation:** Use the actual Duplicate action on a cropped image, then adjust, replace, and reset each copy independently. Assert independent metadata IDs, retained original base pixels and settings, and preserved individual placement. Include board archive re-import because ID remapping is another route into the fallback.

### CR-03: Rotated image edits treat visual bounds as unrotated geometry

**Fix status:** RESOLVED — implemented in `3d5c79d`; independently rechecked at `010a276`.

**Classification:** BLOCKER
**File:** `src/canvas/image-visual-edits.ts:197-198`
**Related paths:** `src/canvas/image-visual-edits.ts:248-260`, `src/canvas/image-visual-edits.ts:323-336`, `src/canvas/SelectionInspector.tsx:77-84`

**Issue:** `elementBound` is the axis-aligned bounding box after rotation, while native `xywh` describes the unrotated rectangle. Applying the first visual edit captures that rotated bounding box as base geometry, then writes it back as `xywh` while retaining rotation. The replacement path and inspector geometry initialization make the same assumption. Even a brightness-only edit resizes or distorts a rotated image.

**Observed reproduction:** A native image with `xywh = [100,100,200,100]` and rotation 90° has `elementBound = [150,50,100,200]`. Applying brightness 10 with all crop percentages zero changes `xywh` to `[150,50,100,200]` while keeping rotation 90°. Expected: unchanged geometry for a pixel-only adjustment.

**Fix:** Deserialize the image's native `xywh` for geometry editing, base-state capture, and replacement sizing. Use `elementBound` only for visual positioning of controls and bounds calculations. Apply crop offsets around the unrotated rectangle's center using the rotation transform exactly once.

**Regression validation:** Check 90° and non-right-angle images through brightness-only editing, zero-change geometry apply, crop/reset, and replacement. Assert native geometry and visible aspect ratio against the intended transformation.

## Review evidence and limits

The three original reproductions ran against `1065eb9` through the local Vite application with fresh synthetic browser contexts. The temporary initial-review server was stopped. The parent workflow's earlier unit/build/browser results were context only; this review did not rerun that full suite.

The apparent unmatched `ctx.save()` in the native export canvas branch was investigated and excluded: the pinned BlockSuite `CanvasRenderer._renderByBound` ends with `ctx.restore()`. No structural pre-pass was supplied.

The review changes only this artifact. No source files were modified and no commits were created.
