---
phase: 01-editable-canvas-and-image-portability
fixed_at: 2026-09-11T20:19:00Z
review_path: .planning/phases/01-editable-canvas-and-image-portability/01-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
independent_recheck: pending
---

# Phase 1: Code Review Fix Report

Five assigned findings have individual commits. The three review blockers and two security follow-ups are implemented; independent review remains pending. Logic changes retain the fixer classification **fixed: requires human verification**.

## Fixed issues

### CR-01: Preserve native placement during image edits

**Commit:** `9200c6c`
**Status:** fixed: requires human verification
**Files:** `src/canvas/image-visual-edits.ts`, `tests/image-visual-edits.spec.ts` (new regression file).

Recover uncropped geometry from current native placement and previous crop settings before subsequent adjustments and reset. The inspector geometry writer uses the same inverse calculation. Regression drives actual native move/resize handles, adjusts brightness, then resets and checks the restored extent.

### CR-02: Independent history for copied images

**Commit:** `807866d`
**Status:** fixed: requires human verification
**Files:** `src/canvas/image-visual-edits.ts`, `src/canvas/arrangement.ts`, `tests/image-visual-edits.spec.ts`.

Lookup only returns records owned by the requested image. Native duplication and legacy source remapping reconcile independent records before an owner's history changes, preserving base pixels and deriving each image's placement. Copy only persisted schema values, excluding BlockSuite reactive signals. Regression invokes the actual Duplicate action, adjusts and resets the copy, verifies the original remains unchanged, and then resets the original independently.

### CR-03: Use native image geometry for rotation

**Commit:** `3d5c79d`
**Status:** fixed: requires human verification
**Files:** `src/canvas/image-visual-edits.ts`, `src/canvas/SelectionInspector.tsx`, `tests/image-visual-edits.spec.ts`.

Read native `xywh` for edit base capture, replacement sizing and inspector geometry. Preserve fractional coordinates in the inspector. Visual bounds still position controls. Regressions at 90° and 37° verify geometry apply, brightness, transformed crop offsets, reset and replacement aspect ratio.

### T03SIZE: Bound all exposed image input routes

**Commit:** `a569c05`
**Status:** fixed
**Files:** `src/canvas/image-input.ts`, `src/canvas/image-visual-edits.ts`, `src/canvas/SelectionInspector.tsx`, `tests/image-import.spec.ts`, `tests/image-visual-edits.spec.ts`.

Plain-text SVG documents enter the supported-format rejection path before native rasterization. Replacement reuses PNG/JPEG header preflight and decoded dimension validation, retaining the 16 MiB, 16 megapixel and 8192-pixel-per-side budgets. The adapter returns validated dimensions, avoiding another decoding allocation. Regressions verify rejection before decoding, retained edited pixels/history, successful retry, and ordinary text/native object clipboard behavior.

### T03RACE: Guard replacement after asynchronous work

**Commit:** `010a276`
**Status:** fixed: requires human verification
**Files:** `src/canvas/image-input.ts`, `src/canvas/image-visual-edits.ts`, `src/canvas/SelectionInspector.tsx`, `tests/image-visual-edits.spec.ts`.

Replacement captures its host/store/image identity and checks current board, connectivity, editability and source identity after validation and again after blob storage. The final check and model transaction have no asynchronous gap. Regressions change active-board identity during storage and actually leave the board while replacement is pending; both retain the original image, and retry succeeds after a recoverable board mismatch.

## Verification

All gates ran in the **main checkout**, with `workflow.use_worktrees=false`.

- `npm run typecheck`: passed before commits.
- `npm run build`: passed through the Playwright production-server setup.
- `npm test -- src/canvas/image-input.test.ts`: 14 passed.
- `npx playwright test tests/image-visual-edits.spec.ts tests/image-import.spec.ts`: **64 passed** across development Chromium, production Chromium, production Firefox and production WebKit. Fixtures reject unexpected console and page errors.
- `git diff --check`: passed. Each source fix has an individual commit using the synthetic contributor identity.

The broad existing suite was not repeated. Archive re-import was outside the assigned user scope: the legacy source-remapping fallback is preserved through independent-record reconciliation, but no archive round-trip regression was added. No additional alignment-specific regression was added; native movement/resize and the shared geometry recovery are covered. Actual OS clipboard integration is exercised in Chromium; other engines use explicitly constructed clipboard events.

The reports are left uncommitted for the orchestrator. The original review preserves its findings and records implemented/pending-independent-recheck status.
