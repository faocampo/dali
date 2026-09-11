---
phase: 01-editable-canvas-and-image-portability
plan: "04"
subsystem: ui
tags: [png, blocksuite, source-scale, export, playwright]
requires:
  - phase: 01-01
    provides: Mounted native canvas and local storage
provides:
  - Whole-board PNG with explicit 1x, 2x, 4x source rendering and white or alpha background
  - Immutable preview and dispatch geometry with conservative allocation limits
  - Decoded multi-browser fidelity and failure-recovery evidence
affects: [01-03, 01-05]
tech-stack:
  added: []
  patterns: [pinned native raster adapter, immutable export plan, bounded asynchronous preparation]
key-files:
  created: [src/canvas/export-plan.ts, src/canvas/export-plan.test.ts, tests/image-export.spec.ts]
  modified: [src/canvas/presentation-export.ts, src/canvas/export-board.ts, src/header/ExportDialog.tsx]
key-decisions:
  - Retain BlockSuite 0.22.4 rendering through two guarded internal source-scale seams.
  - Use an 8192-pixel side and 16777216-pixel area working budget verified with two simultaneous layers.
  - Temporarily activate native offscreen DOM visibility for cloning and restore it in finally.
requirements-completed: [IMG-02]
coverage:
  - id: whole-board-png
    description: Real downloads preserve native shape, rotated shape, connector label, brush, Unicode sticky text and imported image landmarks at each source scale.
    requirement: IMG-02
    verification:
      - kind: e2e
        ref: tests/image-export.spec.ts#whole board source scale preserves primitive and DOM detail at every scale
        status: pass
    human_judgment: false
  - id: viewport-independent-export
    description: Exact preview dimensions and decoded white output remain stable at DPR 1/2, zoom 0.5/1.5 and offscreen viewport positions.
    verification:
      - kind: e2e
        ref: tests/image-export.spec.ts#whole board white output stays identical across zoom and offscreen position
        status: pass
    human_judgment: false
  - id: bounded-recovery
    description: Invalid geometry and excessive output are rejected; lower scale requires selection, and seven asynchronous or document faults recover with decoded downloads.
    verification:
      - kind: unit
        ref: src/canvas/export-plan.test.ts
        status: pass
      - kind: e2e
        ref: tests/image-export.spec.ts#recovery
        status: pass
    human_judgment: false
actuals:
  tokens: 11439
  tasks: 2
  commits: 4
plan_head_before: 300512d285a41f4444176a972cd9acd10b10d18e
duration: approximately 25min
completed: 2026-09-11
status: complete
---

# Phase 1 Plan 4: Whole-board PNG Export Summary

**Whole-board downloads now render primitive and DOM content at explicit source resolution, with matching dimension previews, controlled backgrounds and verified recovery.**

## Accomplishments

- Added a frozen export plan containing options, ordered membership, world/clip bounds, pixel dimensions, revision, validity and explicit lower-scale recovery. Default output is whole-board, 1x, white, zero padding. Native rotated bounds and connector labels contribute to geometry; stroke/arrow margins preserve visible edges.
- Replaced viewport-DPR bitmap resizing with native primitive rendering at a requested matrix and native DOM rasterization at a requested scale. Local image blobs are decoded directly, composed in native layer order and released. Paper/grid decoration is excluded.
- The same plan drives preview and dispatch. Store, board identity and selected IDs are checked before and after asynchronous rendering. Errors retain controls and focus; controls are disabled during preparation; completion says "Download started".
- Added finite/safe-range checks, output ceilings, explicit 4x-to-2x recovery, bounded fonts/images/DOM/PNG encoding, origin-clean validation and canvas/object-URL/clone cleanup.

## Task Commits

| Task | RED | GREEN |
|---|---|---|
| 01-04-01 Native source-resolution download | `4cda02e` | `c075194` |
| 01-04-02 Bounds and recovery | `1df7437` | `b9c9921` |

Actual tokens are realized diff characters divided by four, rounded up. The four commits are measured from the persisted plan base before summary/tracking commits.

## Installed API Findings

Inspected the exact installed sources/declarations from [BlockSuite v0.22.4](https://github.com/toeverything/blocksuite/tree/v0.22.4) (native renderer/export manager source) and html2canvas 1.4.1 (installed DOM rasterizer). No dependency was installed or replaced.

- `CanvasRenderer.getCanvasByBound(bound, surfaceElements?, canvas?, clearBeforeDrawing?, withZoom?)` hardcodes `window.devicePixelRatio`. The optional zoom boolean does not provide independent requested source scale.
- `ExportManager.edgelessToCanvas(renderer, bound, gfx, blocks?, elements?, edgelessBackground?)` hardcodes DPR and 50-pixel padding. Its optional final argument controls background grid zoom.
- The bounded adapter uses native `_renderByBound(ctx, matrix, roughCanvas, bound, elements)` with the exported `RoughCanvas`, and native `_html2canvas(element, options)` which forwards `scale`, dimensions and clone options to html2canvas. Both method identities are guarded before use. These private seams are version-coupled and require rerunning the fidelity suite on a BlockSuite upgrade.
- Native `GfxViewportElement` marks offscreen blocks idle. html2canvas copies computed styles for custom elements before `onclone`, including descendants' inherited hidden visibility. The adapter temporarily activates the source element while cloning, then restores its visibility in `finally`; clone-only transform normalization removes viewport zoom. No global DPR or document geometry is mutated.

## Verification

| Check | Result |
|---|---|
| `npm run typecheck` | Passed |
| `npm test` | 25 passed: 11 export-plan cases plus 14 existing cases |
| Development/production whole-board matrix | 8 passed; subsequent final labeled-connector production run 4 passed |
| Full production export suite | 39 passed across three engines in 2.4 minutes |
| Final development limits/recovery | 9 passed in 42.4 seconds |
| Production build | Passed through each owned Playwright server startup; existing bundle-size advisory remains |

The fixture uses synthetic red/blue shapes, a labeled arrow, a purple brush stroke, Unicode sticky text and a local green/magenta PNG. Downloads are completed, PNG signatures/IHDR checked, and pixels decoded. Production fixture dimensions are **742 x 431**, **1484 x 862**, and **2968 x 1724** at 1x/2x/4x. Alpha corners equal zero; white corners equal `[255,255,255,255]`. Zoom/offscreen comparisons require fewer than 0.1% differing channel samples at both DPR settings.

The 4x text-crop oracle rejects nearest-neighbor and bilinear enlarged 1x controls when over 1% of pixels differ by over 20 in any channel. Chromium measured **8.63% / 9.74%** differing pixels. A separate fine-line crop requires over 0.2%; it measured **2.16% / 3.34%**. Firefox and WebKit passed the same assertions. These controls exercise newly rasterized source detail, independently of IHDR dimensions. Synthetic PNGs and quantitative metrics are attached to the browser test results; selected comparison PNGs and JSON are also written under ignored test output.

## Measured Working Limits

| Engine | Exact version | Largest passing square | Largest passing wide output | Two-layer raw pixel budget |
|---|---|---|---|---|
| Chromium | 151.0.7922.34 | 4096 x 4096 | 8192 x 2048 | 134217728 bytes |
| Firefox | 153.0 | 4096 x 4096 | 8192 x 2048 | 134217728 bytes |
| WebKit | 26.5 | 4096 x 4096 | 8192 x 2048 | 134217728 bytes |

Each bounded probe ascended through 1024-square, 2048-square, 4096-square and 8192 x 2048 allocations. It filled two canvases, composed them, encoded a PNG, decoded it and immediately released both layers. The runtime policy accepts a maximum side of **8192** and area of **16777216** pixels. The next-pixel policy boundary is rejected by pure preflight. No browser exhaustion or absolute browser maximum is claimed; live editor, source images, clone DOM and encoding buffers consume additional memory. Runtime failures below the policy limits still remain recoverable.

All three engines passed explicit lower-scale consent and seven fault cases: encoder null, encoder throw, origin-clean pixel exception, missing blob, stale document, font timeout and image timeout. Fault injection causes failure only; restored browser/native methods perform the successful retry and real downloaded-file decode. The shared unexpected console/page-error fixture remains enabled throughout.

## TDD Gate Compliance

- Task 1 failed at the named missing 4x radio assertion before implementation; its RED commit preceded the renderer/UI change.
- Task 2 failed because a world x-coordinate of `Number.MAX_VALUE` produced a valid plan. Its RED commit preceded the safe-range guard.
- Observed Playwright/Vitest failures were normalized to TAP for the installed GSD evidence classifier. Both returned `RED_EVIDENCE_OK`; passing inherited behavior was retained as regression coverage.
- The tracer was reverified end-to-end before task 2. Native source-scale acceptance preceded expansion into failure handling.

## Deviations and Fixes

- **Rule 1:** Made preview recomputation synchronous with option changes so its visible dimensions match the dispatched plan.
- **Rule 1:** Corrected offscreen DOM cloning after decoded image comparisons exposed omitted sticky pixels. Clone-only visibility changes were insufficient because computed descendant styles were copied earlier; temporary source visibility with `finally` restoration passed the strict unchanged-pixel test.
- **Rule 2:** Included `export-board.ts` in task 2 to bound encoder waiting and release the final canvas after success or failure. It was already within the overall plan's file ownership.
- Routine fixture corrections used the native edgeless-image tag, scoped the Download button to the dialog and supplied connector label geometry. These setup corrections are separate from RED evidence.

## Known Stubs and Remaining Scope

No blocking stubs, skipped tests or unrun plan verification commands remain. Existing selection/frame controls and PDF export were retained; the claims above cover whole-board PNG. Plan 01-05 owns selection/frame membership and clipping refinements, including preflight of intermediate layers for cropped scopes. Plan 01-03 owns the image-input adapter; this plan used the existing picker with synthetic local files. No network endpoint, storage schema or authentication surface was added.

## Self-Check: PASSED

All six source/test paths exist and all four task commits are present. Static checks, units, production build and required browser assertions passed. Staged changes use synthetic data and public references; no tracked files were deleted. Unrelated configuration and orchestration runtime files were left untouched.
