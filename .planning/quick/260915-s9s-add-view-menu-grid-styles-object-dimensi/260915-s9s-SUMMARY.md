---
quick_id: 260915-s9s
status: complete
completed: 2026-09-15
implementation: 4bdee55
mode: quick
---

# Grid, distances and dimensions in View

Dalí → View now provides an icon-led Grid submenu and independent Object dimensions and Distances switches. Grid choices are Off, Dots and Lines, with 20/40/80 canvas-pixel base spacing. The default is a 20 px dotted grid with both measurement switches off. Browser-local preferences survive reload and recover from malformed or unavailable storage.

The grid stays anchored to canvas coordinates as the viewport pans and zooms; density coarsens at distant zoom levels. Selection dimensions display width × height in canvas pixels. Distances show the closest horizontal/vertical edge gap in each direction where perpendicular spans overlap, within a 160-screen-pixel proximity threshold. Measurements update during dragging, resizing, multi-selection and viewport changes. Hidden collapsed topics, selected descendants, group containers and offscreen neighbors are excluded from distance targets. Selected groups and mind maps use visible leaf bounds for their dimensions.

The overlay is pointer-transparent and does not alter document content. PNG pixel equality checks establish that grid and measurement decorations stay outside image exports. Existing native alignment remains available. Additional guideline controls, snap-to-grid and extra drag-alignment modes remain follow-ups in SEED-001 and SEED-002; the View-menu reference seed is implemented.

## Validation

- TypeScript checks and the production build passed. Existing bundle-size and mixed dynamic/static import advisories remain.
- All 79 unit tests passed, including 12 new geometry and preference checks.
- All 8 new browser cases passed in production Chromium, Firefox and WebKit: 24 browser/project cases. Coverage includes keyboard navigation and focus return, stored preferences, invalid storage, live dragging, resize and multi-selection, world-pixel values under zoom, grid pan anchoring, collapsed/offscreen exclusions, group dimensions, 390/1280 px menu layouts and unchanged exported PNG pixels.
- 27 existing production Chromium regression cases passed across canvas controls, canvas editing, the Dalí menu, topic focus/new-board behavior, daily mind-map workflow and mind-map export. Together with the new cases, 51 distinct browser/project cases passed across focused runs.
- Synthetic desktop/narrow menu screenshots and the live measurement overlay were visually inspected. User board data and the supplied reference image were not used as test fixtures or committed.
- Source, staged privacy and whitespace review passed.

## Corrections found during validation

- Excluded mind-map container bounds from neighboring-object measurements and measured visible leaves for selected groups, preventing retained hidden geometry from contributing.
- Scoped Properties/Layers Escape handlers so the application menu receives its own keys. Submenu focus restoration now runs immediately after rendering; nested Escape reliably returns to the parent and then the Dalí trigger.
- Updated two stale toolbar selectors in the existing daily-workflow test to use the current Shapes/Lines palettes. A CSS expectation now accepts equivalent repeated-background serialization in Chromium/Firefox and WebKit; fractional coordinates use rounded CSS expectations.

## Delivery

Implementation commit: `4bdee55`. All three plan tasks completed inline using the GSD quick workflow. This task has its own validation evidence; Phase 2 remains approved and Phase 3 remains ready for discussion/research/planning. The phase roadmap is unchanged.
