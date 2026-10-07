---
phase: 02-daily-mind-maps
plan: "08"
status: complete
completed: 2026-09-14
requirements-addressed: [MIND-04]
requirements-completed: []
---

# Plan 02-08 — Native More submenu

Object actions is a submenu of the native selection toolbar's More menu. The standalone canvas trigger is removed. Alignment entries appear only for multi-selection; distribution retains its minimum of three objects. Properties and right-click access remain available.

The pinned native ToolbarModuleExtension registers ActionPlacement.More content with scoped Lit styling. The submenu measures its parent and available viewport, supports keyboard opening/exit and retains current-host/selection guards. Committing an offscreen mind-map topic pans it into reach of the native toolbar without changing zoom or model coordinates or opening Properties.

Implementation commit: `cc7fd89fa6680728e43bc1d147227e9754869404`.

## Validation

- Typecheck and production build passed; **67/67 unit tests passed**.
- **204/204 browser checks passed** across dev Chromium and production Chromium, Firefox and WebKit (4.2 minutes). Coverage includes arrangement, image edits, Properties lifecycle, accessibility, keyboard editing and the new submenu/multi-selection cases.
- Initial RED proved the old standalone trigger remained. The first broad dev run passed 39/41 and exposed narrow toolbar reachability and keyboard focus timing; both are covered by the final green run.
- Synthetic desktop screenshot inspected: styled Object actions entry in native More, submenu beside it, and no alignment entries for one topic. Narrow viewport reachability is asserted in the browser matrix. Private reference screenshots remain outside repository content.
- A reused executor performed scoped read-only source review; no concrete blocker was found. Existing source/history and mutation safeguards remain.

New files: `src/canvas/object-actions-toolbar.ts`, `tests/object-actions.ts`, `tests/object-actions-submenu.spec.ts`. Existing menu, extension registration, keyboard and affected test gestures were updated. Diff whitespace check passed. The production build retains its existing bundle-size advisory.

Phase 2 remains in user acceptance. The retest is More → Object actions → Properties and alignment visibility for one versus multiple selected objects. Native input evidence limits remain in 02-UAT.md.
