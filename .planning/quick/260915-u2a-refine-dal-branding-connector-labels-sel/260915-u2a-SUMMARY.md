---
quick_id: 260915-u2a
status: complete
date: 2026-09-15
implementation_commit: d86078f
---

# Branding, connector labels and classical shapes

## Delivered behavior

- Application and board-library headers use the supplied color symbol. The document title and description use Dalí; favicon SVG/ICO and Apple touch icon come from the supplied favicon directory.
- Connector labels wrap and unwrap as the routed line length changes. Width uses canvas coordinates, preserves explicit line breaks and typography, and stays independent of zoom. Editing and canvas rendering use consistent metrics. Calculated layout and native routing updates use an untracked history origin so endpoint Undo/Redo remains available.
- The right Properties inspector appears for images and mind-map topics, where it has editing controls. Ordinary shapes, connectors, text, groups and multiple selections keep native contextual controls without the informational-only inspector.
- Shapes contains 16 choices: rectangle, rounded rectangle, ellipse, triangle, diamond, star, pentagon, hexagon, octagon, right arrow, left arrow, double arrow, parallelogram, trapezoid, cross and right triangle. The additional geometries remain native editable shape records with text, styles, resizing, rotation, duplication, connector anchors, reload and raster export.
- The expanded palette scrolls within narrow viewports and retains keyboard navigation and dismissal.

## Implementation

`classical-shape-geometry.ts` defines the shared normalized polygon paths used by palette icons, previews, hit testing and rendering. `classical-shapes.ts` extends BlockSuite 0.22.4 geometry and canvas/DOM renderers, and reuses its native shape tool gestures/history. `connector-labels.ts` synchronizes routed label layout and DOM editing typography, including the native router's calculated-position history boundary. These integration seams should be rechecked when upgrading BlockSuite.

Only supplied brand assets required by the implementation are included. Reference screenshots and real board data remain outside the repository. Synthetic screenshot and downloaded PNG inspection validate rendering separately from model assertions.

## Validation

- TypeScript static checks and production build passed.
- Existing unit suite: 79 passed.
- Focused production suite: 42 distinct browser/project cases passed across Chromium, Firefox and WebKit (14 cases per browser across focused runs), including geometry creation/reload, resize/history/text/duplication, attachment to moved/rotated polygons, decoded PNG silhouette/alpha pixels, label reflow/history/reload, inline typography, and narrow-palette containment.
- Additional focused checks cover explicit line breaks, zoom/style persistence, polygon fill controls and connected quick-add. The quick-add test now dismisses the native color popover with an outside click before selecting the polygon.
- Existing Chromium regressions: 77 passed across canvas arrangement, View controls, mind-map keyboard/properties/accessibility, image visual editing, object-action menus and PNG export.
- Total: 119 distinct passing browser/project cases across focused runs. Synthetic gallery, label render and exported star pixels were inspected.
- Existing build advisories remain: bundle chunk size and a model module imported both statically and dynamically.

## Tracking

This quick task resolves the outstanding full-shape follow-up from `260915-drawing-palettes`. It also delivers the specifically requested header/favicon portion of the dormant branding seed. Phase 2 remains user-approved; Phase 3 remains ready to plan.
