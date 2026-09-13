---
phase: 02-daily-mind-maps
plan: "06"
subsystem: canvas
tags: [mindmap, png, visibility, playwright]
requires:
  - phase: 02-05
    provides: Native hierarchy, typography and anchored layout
provides:
  - Immutable visible-topic and native-edge PNG scope
  - Exact selected-topic rendering and truthful collapsed-content guidance
  - Complete daily workflow and four-project regression evidence
affects: [phase-verification]
tech-stack:
  added: []
  patterns: [immutable export snapshots, native connector rendering, isolated WebKit lifecycle]
key-files:
  created: [src/canvas/mindmap-export.ts, src/canvas/mindmap-export.test.ts, tests/mindmap-export.spec.ts, tests/mindmap-workflow.spec.ts, tests/clipboard-route.ts]
  modified: [src/canvas/presentation-export.ts, src/canvas/blocksuite-editor.ts, src/header/ExportDialog.tsx, tests/fixtures.ts, tests/canvas-editing.spec.ts, tests/mindmap-copy.spec.ts, tests/mindmap-compatibility.spec.ts, tests/mindmap.spec.ts]
key-decisions:
  - Render immutable endpoint-authorized native edges at their original map layer slot.
  - Synchronize native pointer and viewport origins before input after chrome layout changes.
  - Isolate WebKit browser processes per context after reproducible context-64 navigation failure.
requirements-completed: []
requirements-addressed: [MIND-01, MIND-02, MIND-03, MIND-04]
coverage:
  - id: D1
    description: Visible board and frame membership with native branch pixels
    verification:
      - {kind: e2e, ref: "tests/mindmap-export.spec.ts#@02-06-01", status: pass}
    human_judgment: false
  - id: D2
    description: Exact selected topic and endpoint-authorized edge identities
    verification:
      - {kind: e2e, ref: "tests/mindmap-export.spec.ts#@02-06-02", status: pass}
    human_judgment: false
  - id: D3
    description: Settings, failure recovery and complete native daily workflow
    verification:
      - {kind: e2e, ref: "tests/mindmap-workflow.spec.ts#@02-06-03", status: pass}
    human_judgment: true
    rationale: Native OS input, clipboard and browser magnification remain separately documented.
actuals:
  tokens: 13184
  tasks: 3
  commits: 8
plan_head_before: c025a4a158c0d171c4f2a13fc1b054119a8740d7
measurement_head: fb595974f7680401ece9727f48d6a45ebf843d91
duration: 95min
completed: 2026-09-13
status: complete
---

# Phase 2 Plan 6: Visible PNG and Daily Workflow Summary

**PNG exports use immutable visible topic identities and native parent-child branches, preserving exact selection, frame clipping, typography and resource safeguards.**

## Task Commits

1. Visible board/frame export: `f997af7` RED; `347162d` implementation.
2. Selected topic/edge isolation: `ee67aac` RED; `7055bdf` implementation.
3. Guidance and daily workflow: `3b7b135` RED; `fb59597` implementation and necessary regression harness fixes.
4. Required pointer-origin repair: `5893466` RED; `7e79f9f` implementation.

## Verification

- Final mandatory gate: **67/67 unit tests, production build and 604/604 browser cases passed**, with 151 cases each in dev Chromium and production Chromium, Firefox and WebKit. Browser elapsed time: **13.6 minutes**. Typecheck passed. Existing build chunk/import warnings remain.
- Explicit unchanged Phase 1 focused gates: 23 export-plan units passed; 18 production image-export cases passed in 44.7 seconds.
- Decoded PNG tests verify hidden distant content excluded before bounds/allocation, visible branch ink, absent collapsed tails, crossing frame branches with both endpoint boxes outside, exact crop edges, selected endpoint authorization, overlapping sibling exclusion and ordinary group/connector semantics.
- Settings cover 1x/2x/4x, padding, white/transparent backgrounds, relevant-only collapsed hints, stale rejection, explicit retry and oversized intermediate raster recovery. Before/after snapshots establish observational export behavior.
- Real daily input creates ordinary shapes/connectors and a generated image beside a multiline formatted map; collapse, layout, independent copy, local reload and selected PNG all pass.
- Visually inspected actual synthetic board and selected-workflow PNG files: readable labels, native colored branches and topic styling; hidden descendants and interaction controls absent. The board includes an expanded sibling branch and a collapsed branch; the selected workflow retains the collapsed visible pair.
- Initial full gate: 601/604 passed in 17.0 minutes. After tracer typing repair, second gate: 602/604 passed in 16.7 minutes. Both remaining failures were WebKit initial navigation at context 64/128. The final clean aggregate follows the diagnosed lifecycle fix; isolated reruns alone were not treated as completion.

## TDD Gate Compliance

All three tasks and the pointer integration fix began with actual named assertion failures and separate RED commits. Runtime checks returned RED_EVIDENCE_OK before implementation. Failures covered hidden membership, absent selected branch pixels, absent scope guidance and the 66px drawing displacement. Selector/setup failures were excluded from RED evidence. Final assertions retain exact content, topology, geometry and decoded pixels.

## Deviations from Plan

1. **[Rule 1 - Bug] First-load drawing and editing offset.** Header layout moved the canvas origin by 66px while native PointerControl and Viewport retained different cached origins. Refresh both before input through guarded native seams. The ordinary test now asserts drawing at the requested view center, edits at measured model-to-view center and retains the exact `Synthetic shape` and reload assertions (`7e79f9f`). A speculative pointer-events patch was removed.
2. **[Rule 1 - Bug] Persistence and native typing readiness.** Board-copy Redo now waits for actual Saved locally before reload. Ordinary ASCII fixtures use native key events; the tracer explicitly selects text before replacement. Genuine composition-event tests remain intact (`fb59597`).
3. **[Rule 3 - Blocking] Clipboard permission availability.** Chromium retains actual clipboard operations. Firefox/WebKit feed the actual native serialized MIME payload through the native paste route using a simulated clipboard boundary. No payload or successful result is fabricated. Only Firefox simulated clipboard cases allow the exact known `XML Parsing Error: no root element found` diagnostic from native empty-plain-text SVG parsing; other runtime-error gates remain active (`fb59597`).
4. **[Rule 3 - Blocking] WebKit context lifecycle.** Two full runs stalled at the 64th and 128th WebKit contexts before app assertions. An independent minimal probe reached the app for contexts 1–63, then context 64 remained about:blank even waiting for DOMContentLoaded. The test fixture isolates each WebKit browser process and preserves complete native context options and cleanup. The affected UI checks passed 66/66 in 1.9 minutes, then the entire 604-case gate passed. Chromium and Firefox lifecycle behavior stays intact (`fb59597`).

## Threat Coverage and Evidence Limits

T-02-14 filters validated visible identities and authorized endpoints before bounds/rendering; T-02-15 retains bounded traversal and raster budgets; T-02-16 uses immutable snapshots and revision/host guards without temporary document visibility writes; T-02-17 uses synthetic fixture data and repository-relative evidence. No new network, authentication, storage schema or trust boundary was introduced. No unfinished stubs, skipped tests or tracked deletions were introduced.

Native OS IME, real 200% browser magnification and Firefox/WebKit OS clipboard integration remain separately unverified (WINDOWS entries 3–5). Human interaction-feel acceptance remains for phase review. MIND-02 and MIND-03 unclassified probe markers remain unresolved classification assumptions. All four requirements stay open until phase verification.

## Self-Check: PASSED

All thirteen changed task files and eight task/test commits exist. Actuals measure 52,734 diff characters divided by four, rounded up. Public content and contributor identity are neutral; user-owned image files remain untouched. All six Phase 2 plans are implemented; phase verification is next.
