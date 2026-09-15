---
status: awaiting-decision
updated: 2026-09-15
---
# Application menu and drawing palettes

Implemented File, View, Edit, Settings, and Help categories in the consolidated Dalí header menu. Edit uses document undo/redo with history availability; Settings persists viewport-control visibility, with graceful fallback when local storage is unavailable. The floating board-utilities container remains removed.

Shapes now opens a keyboard-operable palette for native rectangles, rounded rectangles, ellipses, triangles, and diamonds. Lines offers straight, curved, and angled geometry with either plain or arrow endpoints, preserving native attachment behavior. Palettes dismiss on Escape/outside interaction and fit narrow viewports.

Outstanding: full editable stars, arrow shapes, pentagons, and other polygons. The engine only supplies the five native shape geometries. A user decision is pending between extending full shape support and using grouped line outlines; the former is recommended. These additional shapes are not implemented in this change.

Validation: typecheck, production build, and 67 unit tests passed. Eleven initial Chromium editing/menu/palette checks passed. The broad three-browser run passed 122 cases and exposed one ambiguous test selector; that selector was scoped to the palette. All nine final focused checks passed across Chromium, Firefox, and WebKit after the selector correction and history-availability changes. Desktop and narrow-screen palette inspection passed. Build retains its existing chunk-size advisory.

Phase 2 acceptance and deferred positioning/branding scope are unchanged.
