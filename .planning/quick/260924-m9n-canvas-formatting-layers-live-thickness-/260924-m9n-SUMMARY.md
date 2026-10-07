---
status: complete
---
# Canvas interaction refinements

Implementation commit: `18bb38e`.

## Delivered

- Formatting menus render above measurement guides and the drawing tool rail, while application menus retain precedence. The native editor host no longer traps formatting inside a lower stacking context.
- Thickness has decrease/increase controls, a numeric field, and a line sample. Valid changes update the selected border immediately, preserve geometry, and support Undo. Invalid input restores the current value on blur.
- Automatic note, text, mind-map, and picker/pasted-image insertion seeks free visible space near the viewport center. Bounds account for the tool rail and viewport controls. A full viewport falls back to visible placement with a front-layer index. Explicit drawing and image-drop coordinates remain intentional placement.
- Enabled formatting icons inherit the design system's deep plum ink. Translucent hover/selection overlays keep their icons visible.
- Dimensions and distances appear only during moving or resizing, including arrow-key movement, when enabled in View. They disappear after the interaction and remain outside exported content.
- Removed the duplicate native More-menu Object actions submenu. Right-click and Shift+F10 retain arrangement commands; mind-map Topic properties is directly available in More.
- Renamed Frame section to Frame selection and added the explanation: Create a frame around the selected objects.
- Updated [DESIGN.md](../../../DESIGN.md) (canvas feedback, placement, and menu conventions).

## Validation

- TypeScript check and production build passed.
- Unit tests: 110 passed across 13 files, including free-space placement, narrow gaps, full viewports, oversized objects, and invalid/offscreen bounds.
- Cross-browser regression run: 156 of 159 passed. The three failures exposed one shared layering issue: native formatting could intercept the application Grid menu. Adjusted the formatting layer below the header and above the canvas tool rail.
- Final verification after that correction: all 45 affected canvas interaction, View/export, and control accessibility cases passed across Chromium, Firefox, and WebKit. Together these runs provide 159 distinct passing browser/project cases (201 passing executions). The remaining 114 cases retain their earlier run provenance; they were not repeated after the final layer-only adjustment.
- Coverage includes live border changes and Undo, geometry preservation, insertion and front-layer fallback, gesture-only measurements, menu hit-testing, frame creation, direct topic properties, arrangement, text paste, image import/drop/recovery, typography, and keyboard access.
- Formatting screenshots were reviewed at 390, 707, and 1456 pixels. Real hit-tests verify final menu precedence over canvas guides and the tool rail; application-menu clicks and decoded export pixels pass in every browser.
- Impeccable detector reported no primary findings. Its grid-preview advisory was retained because the preview represents the actual canvas grid.
- Staged whitespace and privacy checks passed. Repository evidence uses synthetic data.

## Scope

This addresses the seven canvas interaction comments. Phase 3 human acceptance and its ten pending UAT items remain unchanged. Validation uses isolated local browser fixtures; it does not claim operator-environment acceptance.
