---
status: complete
completed: 2026-09-15
implementation: 8e083a1
---
# Editable title and canvas navigation

The title is an editable field. Enter or blur saves through the existing board-name operation; Escape restores the prior name; blank input restores the existing name. All boards is a separate library-navigation button. The Select tool uses a mouse-pointer SVG. Hand activates the pinned native PanTool for mouse/trackpad primary-button dragging, with native viewport movement and object coordinates preserved.

Validation: 12/12 focused checks across development Chromium and production Chromium, Firefox and WebKit; 48/48 affected production regressions; 67/67 unit tests; typecheck and production build passed. The focused tests verify title persistence and cancellation, preserved canvas mount, changed viewport center with unchanged shape geometry, and switching back to Select. Source and whitespace review passed. The existing bundle-size advisory remains.

The existing local app tab was inspected through its accessibility tree and a visual capture: editable title, All boards, pointer and Hand were present. The source server was also checked. No user board data was edited and no private screenshot was saved into the repository. This user-requested behavior supersedes the earlier dropdown. Phase 2 acceptance remains pending; quick-task evidence remains separate from the prior phase-wide verification matrix.
