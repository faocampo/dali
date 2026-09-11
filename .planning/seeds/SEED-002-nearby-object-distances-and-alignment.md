---
id: SEED-002
status: dormant
planted: 2026-09-11
planted_during: Phase 1 — Editable Canvas and Image Portability
trigger_when: After Phase 1 is accepted and complete
scope: Nearby-object distance indicators and alignment while dragging; effort to be estimated
---

# SEED-002: Nearby-object distances and alignment while dragging

## Idea

After completing Phase 1, add an option to show distances to nearby objects while dragging an object, using a default proximity threshold in pixels. Add the ability to align the dragged object with the top, middle, or bottom of surrounding objects.

## Why This Matters

Support precise spacing and alignment directly while positioning canvas objects.

## When to Surface

**Trigger:** After Phase 1 is accepted and complete.

Revisit alongside SEED-001 when planning follow-up canvas positioning capabilities. GSD also surfaces matching seeds during `$gsd-new-milestone`.

## Scope Estimate

- Optional distance indicators between the dragged object and nearby objects.
- A default pixel threshold determines which surrounding objects qualify as nearby.
- Alignment with surrounding objects at their top, middle, or bottom during dragging.

Effort, the default threshold value, coordinate behavior under zoom, and alignment interaction details remain to be determined during planning.

## Breadcrumbs

- `.planning/seeds/SEED-001-canvas-guidelines-grid-and-snapping.md` — related guidelines, visible grid, and grid-snapping seed.
- `.planning/STATE.md` — current Phase 1 acceptance status.
- `.planning/ROADMAP.md` — approved phase sequence.
- `src/canvas/BlockSuiteCanvas.tsx` — canvas integration entry point.
- `src/canvas/SelectionInspector.tsx` — existing selection alignment actions to consider during planning.

## Notes

The supplied visual reference shows numeric horizontal and vertical spacing labels, measurement lines with endpoint markers, and dashed alignment guides around the selected object and surrounding objects. Use these as interaction references during planning.

The reference image remains outside the repository; only this organization-neutral behavior description is retained. Activation and implementation planning occur after the trigger is met.
