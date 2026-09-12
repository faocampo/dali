---
phase: 02-daily-mind-maps
plan: "01"
subsystem: canvas
tags: [blocksuite, mindmap, typography, history, playwright]
requires:
  - phase: 01-editable-canvas-and-image-portability
    provides: Native editor, local persistence, selection and PNG pipeline
provides:
  - Native root-only mind-map creation with inline text focus and local reload
  - Existing-field typography preservation and synchronous atomic collapse layout
  - Native duplicate, clipboard and independent board-copy evidence
affects: [02-02, 02-03, 02-04, 02-05, 02-06]
tech-stack:
  added: []
  patterns: [scoped native model wrappers, geometry-only layout, affected-field restoration]
key-files:
  created: [src/canvas/mindmap.ts, src/canvas/mindmap-compatibility.ts, tests/mindmap.spec.ts, tests/mindmap-compatibility.spec.ts]
  modified: [src/canvas/extensions.ts, src/canvas/BlockSuiteCanvas.tsx, vite.config.ts]
key-decisions:
  - Keep native fontSize, fontWeight and color authoritative through routine layout and preset changes.
  - Execute collapse, visibility and geometry synchronously inside one captured native transaction.
  - Retain the native complete-detail clipboard conversion and document transformer routes.
requirements-completed: []
requirements-addressed: [MIND-01, MIND-02, MIND-03, MIND-04]
coverage:
  - id: D1
    description: Create, edit, reopen and export an expanded native map
    requirement: MIND-01
    verification:
      - kind: e2e
        ref: tests/mindmap.spec.ts#@02-01-01
        status: pass
    human_judgment: false
  - id: D2
    description: Preserve typography, atomic collapse history and native copy details
    verification:
      - kind: e2e
        ref: tests/mindmap-compatibility.spec.ts#@02-01-02
        status: pass
    human_judgment: false
actuals:
  tokens: 7471
  tasks: 2
  commits: 4
plan_head_before: db5255c30a57c001ab138ba2425ea6773bc7d805
measurement_head: a960707
duration: 24min
completed: 2026-09-12
status: complete
---

# Phase 2 Plan 1: Native Mind-Map Tracer and Compatibility Summary

**Native editable maps now preserve explicit typography, local hierarchy and one-action collapse history, with decoded PNG and real copy-route evidence.**

## Accomplishments

- Registered the pinned BlockSuite 0.22.4 mind-map store/view extensions and matching Vite entries. The existing mounted editor and PNG renderer consume the native map representation.
- Added a 44px Add mind map action. One invocation creates one native root, measures its text at the viewport center, and selects Central topic for inline editing. Connected-host, writable-store, mount-point and finite-coordinate checks precede creation; cleanup removes newly created elements on synchronous failure.
- Added per-model layout, layout-delegate, requestLayout and collapse wrappers. Existing native fontSize/fontWeight/color fields remain authoritative. Native preset changes update shapes/branches, after which text fields are restored, content is fitted and native geometry-only layout runs. New nodes retain native initial styling.
- Collapse uses captureSync, one outer transaction, native toggleCollapse with layout disabled, synchronous geometry, and the closing capture boundary. Snapshots of child details, hidden flags, geometry and text formatting restore the affected state on injected failure. The transaction itself supplies observation batching.
- Native requestLayout calls drain synchronously. Connected-document, readonly and lock checks prevent stale writes. Disposal invalidates captured wrappers, releases subscriptions and restores original methods for later mounts.

## Task Commits

1. `81c38bc` — test(02-01): specify native mind-map tracer
2. `d6d6960` — feat(02-01): create editable native mind maps with PNG coverage
3. `b469ad8` — test(02-01): specify native typography and atomic collapse compatibility
4. `a960707` — feat(02-01): preserve native typography and atomic collapse history

The measured implementation count is four commits from plan_head_before through measurement_head; tokens are ceiling(realized diff characters / 4). Documentation close-out follows separately.

## Verification

- `npm run typecheck` — passed before task commits and after the final test additions.
- `npm run build` — passed after the final source changes. Existing chunk-size and mixed-import warnings remain unchanged in kind.
- `npm exec playwright test -- tests/mindmap.spec.ts --project=prod --grep "@02-01-01"` — passed. UI input creates the root, native Tab child and native Enter sibling after committing text with Enter. Exact IDs, labels and parents survive reload. The PNG is decoded, contains topic ink and connector ink within the gap between topic boxes, and the native map reports two edges. A second deliberate creation produces a second map. Measured initial root center stays within two model units.
- `npm exec playwright test -- tests/mindmap-compatibility.spec.ts tests/mindmap.spec.ts tests/canvas-editing.spec.ts --project=prod` — final run **14 passed, 13.3 seconds**. Seven compatibility cases cover seven-node nested typography/preset/reload, exact collapse Undo/Redo, retained preceding independent edit, injected-failure restoration, detached callbacks, duplicate/clipboard conversion, board-copy independence, and readonly/locked zero-write checks. Synthetic markup remains inert.
- Affected regression run additionally passed all **15 canvas-arrangement** and **18 image-export** cases. The initial combined run passed 44/46; its toolbar-height and clipboard-readiness failures were corrected, and both affected cases passed in the final 14-case run. Assertions were retained.
- Browser tests used the existing external browser cache. The warm production preview was rebuilt after source changes. Typical focused cases took approximately 0.6–1.5 seconds; production build time was approximately nine seconds, separate from browser timing.

## TDD Gate Compliance

- Tracer RED: the named test failed its visible Add mind map assertion because the control did not exist. Earlier server permission, missing default browser cache and test typing failures were prerequisite failures and did not authorize implementation. The actual named assertion result was represented as TAP for the runtime's TAP-only validator; it returned RED_EVIDENCE_OK.
- Compatibility RED: the named seven-node typography assertion showed explicit 31px/700/#123456 fields reverting to native 18/16px, 600 and black after layout/preset. The Playwright JSON assertion result was converted to TAP for the same validator, which returned RED_EVIDENCE_OK.
- GREEN: native registration/creation enabled the tracer; scoped compatibility wrappers made typography, history, restoration and lifecycle assertions pass. Test and implementation commits are separate.
- Refactoring was kept within the two implementation commits; no additional behavior or storage schema was introduced.

## Observed Native Seams

| Seam | Source | Browser evidence |
|---|---|---|
| Native geometry delegate | `node_modules/@blocksuite/affine-gfx-mindmap/src/view/view.ts` (`setLayoutMethod`) and `view/utils.ts` (`handleLayout`) | Explicit native font fields survive routine layout, preset fitting and reload. |
| Collapse/history | `node_modules/@blocksuite/affine-model/src/elements/mindmap/mindmap.ts` (`toggleCollapse`, `requestLayout`) | One Undo restores exact IDs, text, parent/order, nested collapse flags, hidden state and geometry; Redo restores the collapse; independent prior text remains. |
| Native object duplicate and clipboard | `node_modules/@blocksuite/affine-block-root/src/edgeless/clipboard/canvas.ts` (`createCanvasElement`, MINDMAP complete-detail remapping) | Both paths retain seven nodes, the collapsed nested branch and its hidden descendant; copied parent IDs resolve within each independent copy and source state is unchanged. |
| Board transformer | `src/boards/operations.ts` (`duplicateLocalBoard`, `docToSnapshot`, `snapshotToDoc`, replaceIdMiddleware) | Real board-library duplication retains document-scoped map/node IDs and exact hierarchy; editing the copy leaves the reopened source unchanged. |
| Expanded-map raster | `node_modules/@blocksuite/affine-gfx-mindmap/src/element-renderer.ts` | Existing native connector renderer produces decoded connector-gap pixels in whole-board PNG. |

## Deviations from Plan

1. **[Rule 1 — Bug] Toolbar viewport containment.** The new 44px action exposed six pixels of overflow at a 700px viewport. The rail now uses a dynamic-viewport maximum and border-box sizing. Existing viewport assertions pass. Files: `src/canvas/BlockSuiteCanvas.tsx`; commit `a960707`.
2. **[Rule 1 — Bug] Measured root centering.** Native root styling and content fitting determine the final dimensions. Creation now centers those measured dimensions before opening the editor. The model-space center assertion passes. Files: `src/canvas/mindmap.ts`, `tests/mindmap.spec.ts`; commit `a960707`.

Test synchronization follows observed native behavior: child/sibling editor focus is deferred to an animation frame; clipboard serialization is asynchronous and replacing a clipboard item can invalidate an in-progress read. Tests await selected initial text and a fresh native clipboard payload, retrying only the transient InvalidStateError.

## Evidence Limits and Handoff

- This plan establishes the tracer and compatibility interfaces. MIND-01–04 remain open until dependent expansion and phase verification complete.
- Native Enter reliably finishes topic editing. The initial Escape probe left the native editor mounted; the approved keyboard plan 02-03 owns Escape/focus hardening. The tracer uses the specified Enter commit action and retains its native Tab/Enter creation assertions.
- Complete copy controls and failure cases belong to 02-02; keyboard, bounded topology/visibility, direction changes, contextual formatting/accessibility and scoped/collapsed export behavior remain in their approved dependent plans.
- No new dependencies, dependency-source edits, storage identifiers, persistence schema, network endpoint or authentication surface were introduced. No blocking stubs or skipped task verification remain. Full cross-browser phase verification follows dependent implementation.

## Self-Check: PASSED

All seven source/test files exist, all four listed task commits exist, task changes pass static checks, and the native tracer/compatibility evidence is recorded above. No tracked file deletions occurred. User-owned untracked images were left untouched.
