---
phase: 01-editable-canvas-and-image-portability
plan: "05"
subsystem: canvas
tags: [png, selection, frame, blocksuite, playwright]
requires:
  - phase: 01-03
    provides: Validated native image input
  - phase: 01-04
    provides: Immutable export plan and source-scale native raster adapter
provides:
  - Recursive identity-based selection exports with native layer order and bounded padding
  - Exact frame crops with per-child intersection, backgrounds and intermediate-raster preflight
affects: [phase-01-verification, image-portability]
tech-stack:
  added: []
  patterns: [identity-first scope filtering, output-coordinate clipping, per-object allocation preflight]
key-files:
  created: []
  modified:
    - src/canvas/export-plan.ts
    - src/canvas/export-plan.test.ts
    - src/canvas/presentation-export.ts
    - src/header/ExportDialog.tsx
    - tests/image-export.spec.ts
    - tests/canvas-editing.spec.ts
key-decisions:
  - Preserve group IDs in membership while omitting their native editor-only selection outlines.
  - Apply allocation limits to each DOM raster before rendering even when its frame crop is small.
  - Preserve native Chromium clipboard testing and explicitly label constructed-event coverage in other engines.
requirements-completed: [IMG-02, IMG-03]
coverage:
  - id: scoped-selection
    description: Selected groups recursively include each child once, preserve native order and exclude overlapping unselected pixels.
    requirement: IMG-03
    verification:
      - kind: unit
        ref: src/canvas/export-plan.test.ts
        status: pass
      - kind: e2e
        ref: tests/image-export.spec.ts#selection
        status: pass
    human_judgment: false
  - id: frame-crop
    description: Frame exports clip all four edges, preserve imported pixels, omit selected-frame chrome and support empty backgrounds.
    requirement: IMG-02
    verification:
      - kind: e2e
        ref: tests/image-export.spec.ts#frame
        status: pass
    human_judgment: false
  - id: allocation-preflight
    description: Small frame crops cannot bypass intermediate DOM raster limits; lower scale requires explicit selection.
    verification:
      - kind: unit
        ref: src/canvas/export-plan.test.ts#preflights large intermediate rasters even for a small frame
        status: pass
      - kind: e2e
        ref: tests/image-export.spec.ts#frame rejects oversized intermediate objects before allocation and offers explicit lower scale
        status: pass
    human_judgment: false
actuals:
  tokens: 8745
  tasks: 2
  commits: 5
plan_head_before: 0ddf807357da032168687baafbac9156fb5d750f
duration: approximately 22min
completed: 2026-09-11
status: complete
---

# Phase 1 Plan 5: Selected-object and Frame PNG Exports Summary

**Selected objects now export by exact native identity with optional padding, while frames export a fixed rectangular crop with bounded intermediate rendering.**

## Accomplishments

- D-11: Whole-board, selection and selected-frame controls are available with actionable unavailable-scope explanations. Empty selection prevents selection export; exactly one selected frame enables frame scope.
- D-12/D-14: Selection recursively expands groups into a deduplicated ID set, then follows native layer order. Explicit and grouped connectors export independently of their endpoints. Endpoint-only selection excludes connectors. Primitive and DOM branches both filter by approved identity.
- D-13: Selection padding defaults to zero and accepts integers from 0 through 256 world units. Invalid, fractional and nonfinite inputs disable export. The same immutable plan drives dimensions and rendering. Native rotated bounds, stroke width and pinned connector endpoint geometry contribute to visible bounds.
- D-15: Each frame descendant is classified independently by positive visible-bound intersection, preserving layer order. Boundary-only contact and outside descendants are excluded. The selected frame's border/title and group selection outlines are omitted. An explicit output clip applies to both native primitives and DOM layers; native primitive culling uses a widened search rectangle with a compensating matrix, preserving the authoritative crop.
- Frame padding is always zero. Empty valid frames produce the chosen white or transparent background. DOM raster allocation is checked independently of final frame dimensions, before allocation. A 100-by-80 crop containing a 3000-by-1000 note rejects 4x and explicitly offers 2x.

## Task Commits

| Task | RED | GREEN |
|---|---|---|
| 01-05-01 Selection/group export | `274b3cb` | `d46e8fa` |
| 01-05-02 Frame clipping and workflow | `29f0a13` | `812fd05` |

Additional explicitly authorized verification correction: `cf42045` makes the existing rich-text HTML paste fixture portable while retaining real Chromium clipboard coverage. All commits use a generic contributor identity. Actual tokens are the realized source/test diff's 34978 characters divided by four, rounded up; five commits were measured from the persisted plan base before metadata.

## Verification

| Check | Result |
|---|---|
| TypeScript and whitespace checks | Passed before commits |
| `npm test` | 51 passed across four files; 23 export-plan cases |
| Focused production selection/frame matrix | 15 passed across Chromium, Firefox and WebKit |
| Production build | Passed through required Playwright server startup and final targeted rerun |
| `npm run test:browser` | 202 passed, two pre-existing clipboard permission fixture failures, 5.9 minutes |
| Corrected HTML paste test in all four projects | Four passed, 19.6 seconds |

The composed result covers all 204 browser cases successfully. The entire 204-case command was not rerun after the isolated test-file correction; only the affected four project cases were rerun, as requested. No app implementation changed after the full run began. Its 72 export cases passed, including development Chromium and all three production engines.

Downloaded PNGs are checked for completed download, signature, decoded dimensions, native membership and pixels. The nested-group fixture uses distinct native IDs and red/blue content under an overlapping green excluded object; green presence must be zero. All combinations of 1x/2x/4x and 0/16 padding produce expected dimensions. Connector tests cover explicit selection, endpoint-only selection in both orders, and group-descendant membership.

The frame workflow uses the actual picker to import a synthetic green/magenta PNG, edits native note/image geometry, selects a frame, downloads and decodes output. At 1x/2x/4x its dimensions are 200x160, 400x320 and 800x640. All four edge samples match crossing-object colors; imported green/magenta pixels survive. Outside group children, touching objects and frame chrome are excluded by ID. Empty-frame pixels are exactly white or transparent according to the chosen background. Whole-board source-scale detail, viewport/DPR independence, recovery, native editing and input regressions remain covered by the full run.

## TDD Gate Compliance

- Task 1 RED observed padding 0.5 and 257 accepted despite the bounded-integer contract. The browser test also observed the absent padding control before implementation. The named unit failure was normalized to TAP for the installed classifier and returned `RED_EVIDENCE_OK`.
- Task 2 RED observed an empty valid frame rejected. Its named failure was likewise normalized from the observed Vitest assertion and returned `RED_EVIDENCE_OK` before implementation.
- Selection tracer checks passed before frame expansion. Existing passing native scope capabilities were retained as regression tests.
- The later clipboard setup failure is a test-portability correction, not intentional behavioral RED evidence.

## Decisions and Deviations

- Native source inspection found the group renderer paints selected-group outlines/title handles. Group IDs remain in scope, while that editor-only drawing branch is omitted from presentation output.
- Native recursive traversal initially disturbed the authoritative layer order. The exact-ID browser oracle exposed it; membership expansion now runs separately from native ordering.
- Frame allocation protection extends the inherited output limits to each included DOM raster, addressing the explicit plan-04 handoff. No larger output or intermediate canvas is allocated to perform clipping.
- Two workflow fixture corrections placed the inherited covering shape outside the target area and made the top landmark actually cross the frame boundary. Pixel tolerances and membership assertions were retained.
- The orchestrator explicitly extended file ownership to `tests/canvas-editing.spec.ts` after the full run found Firefox's unsupported `clipboard-read` and WebKit's unsupported `clipboard-write` permissions. Chromium keeps browser Clipboard API plus keyboard paste; Firefox/WebKit dispatch constructed HTML paste events through native rich-text routing. All sanitization assertions remain enabled.

## Source and Remaining Limits

Source: BlockSuite v0.22.4 ([https://github.com/toeverything/blocksuite/tree/v0.22.4](https://github.com/toeverything/blocksuite/tree/v0.22.4)) (installed native group, connector, frame, renderer and selection implementations). The guarded private raster seams remain version-pinned. No dependency, endpoint, authentication path or schema changed.

No implementation stubs or skipped tests were introduced. Existing OS file-manager drag, picker-dialog cancellation and Firefox/WebKit OS clipboard coverage gaps remain as recorded in plan 01-03 and the cross-phase WINDOWS ledger. Constructed clipboard events establish routing/sanitization evidence; they do not establish native OS clipboard coverage. Existing build-size and dependency observations remain in deferred-items.md. Phase-level verification remains the orchestrator's next step.

## Self-Check: PASSED

All six changed source/test files, this summary and five task/follow-up commits exist. Static checks and the composed browser evidence pass. No tracked files were deleted. Unrelated configuration and orchestration runtime files were preserved.
