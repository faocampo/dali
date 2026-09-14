---
phase: 02-daily-mind-maps
plan: "07"
subsystem: canvas
tags: [mindmap, properties, accessibility, playwright]
status: complete
completed: 2026-09-14
requirements-completed: []
requirements-addressed: [MIND-01, MIND-04]
gap_ids: [G-02-1]
key-files:
  created: [tests/mindmap-properties.spec.ts, tests/mindmap-properties.ts]
  modified: [src/canvas/MindMapInspector.tsx, src/canvas/ObjectContextMenu.tsx, src/canvas/SelectionInspector.tsx, src/canvas/mindmap-keyboard.ts, src/index.css, tests/mindmap-accessibility.spec.ts, tests/mindmap-collapse.spec.ts, tests/mindmap-formatting.spec.ts, tests/mindmap-keyboard.spec.ts, tests/mindmap-layout.spec.ts, tests/mindmap-workflow.spec.ts]
plan_head_before: 4eaae5e
measurement_head: 28329b35dd40c1d8e3a69fff341229e6d6a95555
actuals:
  tasks: 2
  commits: 1
---

# Plan 02-07 — Explicit Properties sidebar

Properties opens only through the selected topic's contextual Properties action. Tab, creation and selection keep it closed; entering editing closes it. The pane shares the existing right-side inspector shell and preserves formatting, hierarchy controls, accessible feedback and keyboard focus.

## Change and verification

Implementation commit: `28329b3`.

- Current-host event and captured menu selection reject removed topics, changed selection and detached hosts.
- Menu Escape restores trigger focus; pane Escape restores canvas focus.
- Explicit opening frames the selected topic beside or below the pane without changing zoom or model coordinates. No panel framing runs while closed.
- Existing suites now request Properties through an actual menu gesture before using controls.
- Final typecheck, production build and **67/67 unit tests passed**.
- Final mind-map matrix: **392/392 passed**, across dev Chromium and production Chromium, Firefox and WebKit (7.9 minutes).
- Production arrangement, canvas editing, image editing and keyboard regression: **40/40 passed** (33.6 seconds).
- Diff whitespace check passed. Production build retains the existing bundle-size advisory.

RED reproduced automatic opening, swallowed menu Escape and narrow viewport containment. An exploratory production run was 97/98 before correcting a missing explicit Properties test gesture; an earlier matrix stopped at 31 passes for the containment correction. Those runs are superseded by the final clean matrix above.

Synthetic 1280×800 and 390×844 screenshots were inspected by executor and orchestrator. Both show the shared sidebar; the selected topic remains visible with 16px separation. Captures remain outside the repository. Private user screenshots and branding files were not added.

## Review and acceptance

A reused executor performed the read-only source review, followed by orchestrator diff inspection. No fresh independent verifier dispatch is claimed. Editing lifecycle and menu focus findings are closed; T-02-23 mitigation is wired and tested.

G-02-1 is implemented and awaits user presentation retest. The user reported keyboard actions working; exact native IME/browser environment was not separately reported. Actual browser magnification and native Firefox/WebKit clipboard checks remain pending. Phase 2 remains in UAT and Phase 3 is pending.
