---
id: SEED-001
status: dormant
planted: 2026-09-11
planted_during: Phase 1 — Editable Canvas and Image Portability
trigger_when: After Phase 1 is accepted and complete
scope: Canvas guidelines, grid visibility, and object snapping; effort to be estimated
---

# SEED-001: Canvas guidelines, grid lines, and grid snapping

## Idea

After completing Phase 1, add options to show guidelines and grid lines on the canvas, and to snap objects to the grid.

## Why This Matters

Support precise positioning and alignment while composing canvas content.

## When to Surface

**Trigger:** After Phase 1 is accepted and complete.

Phase 1 currently awaits acceptance checks. Revisit this seed when planning follow-up work after that gate. GSD also surfaces matching seeds during `$gsd-new-milestone`.

## Scope Estimate

- Option to show canvas guidelines.
- Option to show canvas grid lines.
- Option to snap objects to the grid.

Effort and detailed interaction behavior remain to be determined during planning.

## Breadcrumbs

- `.planning/STATE.md` — current Phase 1 acceptance status.
- `.planning/ROADMAP.md` — approved phase sequence and editable-canvas scope.
- `src/canvas/BlockSuiteCanvas.tsx` — canvas integration entry point.
- `src/canvas/SelectionInspector.tsx` — existing selected-object controls.

## Notes

Captured as a follow-up seed. Activation and implementation planning occur after the trigger is met.
