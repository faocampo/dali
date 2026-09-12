# Image interaction follow-up

Date: 2026-09-12

## Changes

- Replaced crop percentage fields with an on-canvas preview, shaded excluded area, and eight draggable edge/corner handles. Apply crop commits the preview; Cancel or Escape discards it. Arrow keys adjust a focused handle, with Shift for larger steps. Reopening a crop reveals the retained original so the boundary can expand again. Rotation and viewport scale are accounted for.
- Brightness and contrast save automatically after a short 60 ms input-coalescing interval. Reset edits remains available and cancels pending work. Generation and source-identity guards prevent stale asynchronous output from overwriting newer changes or replaced/deleted images.
- Moved arrangement controls into a contextual menu accessible by right-clicking an object, Shift+F10 on the canvas, or the Object actions button. The menu supports keyboard navigation, Escape, outside dismissal, and existing selection/lock constraints.

## Validation

TypeScript and the production build passed. All 51 unit tests passed. All 96 focused browser cases passed across development Chromium and production Chromium, Firefox, and WebKit. Live visual inspection confirmed the crop overlay and contextual menu; the mechanical UI detector returned no findings for the changed components. Synthetic test data covers native move/resize, rotation, replacement, duplication, crop expansion/cancellation, rapid adjustment/reset, arrangement geometry, and contextual-menu keyboard dismissal.

The supplied screenshots remain outside the repository. Phase 1 remains pending manual acceptance.
