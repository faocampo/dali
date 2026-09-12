---
phase: 02-daily-mind-maps
plan: "04"
subsystem: canvas
tags: [mindmap, selection, layers, arrangement, playwright]
requires:
  - phase: 02-03
    provides: Validated native topology and effective visibility
provides:
  - Effective visibility across grid hits, selection, keyboard and Layers
  - Hierarchy-safe arrangement and descendant-lock deletion guards
  - Cross-browser native subtree deletion and exact Undo evidence
affects: [02-05, 02-06]
tech-stack:
  added: []
  patterns: [native visibility projection, scoped command guards]
key-files:
  created: [tests/mindmap-visibility.spec.ts]
  modified: [src/canvas/arrangement.ts, src/canvas/selection-summary.ts, src/canvas/LayersInspector.tsx, src/canvas/mindmap-compatibility.ts]
key-decisions:
  - Filter hidden topic rows and redirect stale topic selection to the visible collapsed ancestor.
  - Keep whole-map native operations and reject partial-topic grouping and alignment with an explanation.
requirements-completed: []
requirements-addressed: [MIND-01, MIND-02, MIND-03]
coverage:
  - id: D1
    description: Hidden selection exclusion and hierarchy-safe native arrangement and Undo
    requirement: MIND-02
    verification:
      - kind: e2e
        ref: tests/mindmap-visibility.spec.ts#@02-04-01
        status: pass
    human_judgment: false
actuals:
  tokens: 7125
  tasks: 1
  commits: 2
plan_head_before: f8a2da995f62b9af9f4b82088454083550c0f499
measurement_head: a4ee078
duration: 22min
completed: 2026-09-12
status: complete
---

# Phase 2 Plan 4: Visibility and Hierarchy-Safe Arrangement Summary

**Collapsed descendants are excluded from pointer, marquee, keyboard and Layers selection while native whole-map movement, grouping and subtree deletion preserve complete content.**

## Task Commits

1. `1320df9` — RED assertions for hidden Layers rows, selection and partial-topic arrangement.
2. `a4ee078` — Shared visibility projection, native command guards, readable eligibility and browser verification.

## Verification

- Typecheck, production build and all 64 unit tests passed.
- All 40 visibility cases passed: 10 each in dev, production Chromium, Firefox and WebKit. Cases include real pointer/marquee input, visible bounds and parent connectors, hidden locks, native leaf/branch/root deletion with exact one-Undo snapshots, all-topic movement, ordinary grouping and mixed whole-map grouping/ungrouping.
- Existing production arrangement/keyboard/collapse/copy regression initially passed **51 of 52**. The unchanged board-copy case failed after immediate reload following Redo; its in-memory Redo assertion had passed. An isolated unchanged rerun passed **1 of 1**. This is recorded as a timing concern, not an entirely clean aggregate run.
- No new placeholders, skipped tests, file deletions or additional trust boundaries were introduced. Requirements remain open for phase-level verification.

## TDD Gate Compliance

- RED: the actual named Layers assertion expected zero hidden rows and received one; the runtime evidence checker returned `RED_EVIDENCE_OK` before implementation.
- GREEN: the named suite passed in all four configured projects after implementation.
- REFACTOR: native grid return-container compatibility and browser-default cancellation were verified without relaxing behavior assertions.

## Deviations from Plan

### Auto-fixed Issues

1. **[Rule 1 - Bug] Native grid declaration/runtime mismatch.** Exported types described a Set while the pinned runtime returned an array. The scoped filter now preserves the actual container type; pointer and marquee cases passed in all projects.
2. **[Rule 1 - Bug] WebKit Backspace navigation.** Native deletion left the browser history-navigation default active. Cancel that default for a nonediting canvas selection while retaining native deletion. All three deletion/Undo cases now pass in WebKit.

Both fixes remain inside the planned compatibility/arrangement ownership and commit `a4ee078`.

## Deferred Issues

- Plan 02-06 should add the legitimate Saved locally synchronization after Redo in `tests/mindmap-copy.spec.ts` before reload, then run full regression. The existing case passed on isolated rerun; no persistence fix is claimed here.

## Self-Check: PASSED

All five task files and both task commits exist. Staged content uses synthetic data and repository-relative references; contributor identity is neutral. Phase 2 advances to four of six plans; Phase 1 stays complete.
