---
id: SEED-004
status: dormant
planted: 2026-09-15
planted_during: Phase 2 — Daily Mind Maps, user acceptance
trigger_when: When planning or implementing grid, distance, and object-dimension visibility
scope: View-menu organization and visibility controls; effort unknown
---

# SEED-004: View-menu reference for grid, distances, and dimensions

## Idea

When implementing grid, distance, and dimension visibility, draw interaction ideas from the supplied View menu reference. Revisit this seed alongside SEED-001 and SEED-002.

## Why This Matters

Keep canvas viewing and measurement options discoverable in one place, with clearly visible enabled/disabled states.

## When to Surface

**Trigger:** When planning or implementing grid, nearby-object distance indicators, or object-dimension visibility.

## Reference Ideas

- A top-level View entry opens a grouped submenu.
- Grid has a nested submenu for its related options. The reference does not show the contents of that submenu; grid choices remain a planning decision.
- Object dimensions has an explicit visibility toggle.
- Apply the same clear toggle pattern to distance indicators and alignment guidelines from the existing seeds. Distance indicators are an adaptation of the pattern, rather than an option visible in this screenshot.
- Menu rows combine an icon, descriptive label, and either a submenu chevron or a switch with an evident current state.
- The reference also shows visibility switches for collaborator cursors, board comments, scroll bars, Undo/Redo controls, and flow connectors, followed by a separated full-screen action. These are contextual design examples to assess against the approved scope during planning.

## Scope Estimate

Unknown. Decide the exact menu location, control inventory, defaults, and preference persistence during planning. This capture adds design context; implementation timing follows the existing canvas-positioning work.

## Breadcrumbs

- [SEED-001](SEED-001-canvas-guidelines-grid-and-snapping.md) — guidelines, grid visibility, and grid snapping.
- [SEED-002](SEED-002-nearby-object-distances-and-alignment.md) — nearby-object distances, pixel threshold, and drag alignment.
- `src/canvas/BlockSuiteCanvas.tsx` — canvas controls and tool integration.
- `src/canvas/SelectionInspector.tsx` — object position and size controls.
- `.planning/ROADMAP.md` — approved capability sequence.

## Notes

The user-supplied screenshot is a visual reference. Only this organization-neutral description is retained in the repository; the image and its underlying board content remain outside it. Displayed switch values are reference states, not approved defaults.
