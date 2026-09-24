---
status: complete
quick_id: 260924-j0y
completed: 2026-09-24
implementation_commit: 4adb017
---

# Canvas controls and system Viewer access

Delivered the reported canvas and header refinements and the explicitly approved system-wide Viewer policy.

## Access

Verified identity roles persist on members and clamp effective board capabilities, including boards a Viewer previously owned. Board creation and every import mutation require a system writer; existing board mutations use effective capabilities. Read synchronization remains available. Existing sessions observe the persisted role. The synthetic local launcher configures the claim and applies Viewer restrictions on startup without replacing boards.

Generic operator configuration is documented in `docs/local-role-testing.md` (trusted application role claim and permitted writer values). Actual provider configuration remains operator-controlled and unverified; an unset optional role claim preserves the existing per-board model. Membership admission remains required.

## Canvas and shell

- Compact image error feedback appears outside the tool rail, with retry and dismissal.
- Undo/Redo menu items and viewport tooltips show platform shortcuts.
- Numeric line thickness is visible and editable; connector quick-add follows each actual endpoint with a centered SVG plus.
- Ordinary shape typography preserves geometry and clips text; smaller font sizes are accepted. Mind-map auto-layout is retained.
- Working Inter/Kalam font choices use bundled assets with font licenses; text blocks expose font and size controls.
- Sticky sizes use XS/S/M/L/XL. Text scales with preset and manual note resizing. Manual resize has its own Undo boundary.
- Freehand exposes Pen and Eraser; erasing supports Undo.
- Insert/Display in Page actions are hidden on the affected selections.
- Roles appear inside the account menu. Save status and elapsed time appear beside the title. The header uses the logo's plum/violet palette and adapts to narrow screens.

## Validation

- Frontend and server TypeScript checks: passed.
- Production build: passed, retaining existing chunk-size warnings.
- Unit tests: 106 passed.
- Server tests: 114 passed, including previously owned board restrictions, existing sessions, successful read synchronization, denied write/create/import/editable-export and missing-role fail-closed behavior.
- Local startup tests: 4 passed, including actual signed Viewer read access, blocked editing and creation, server persistence/restart and port cleanup.
- Browser checks: 75 passed across Chromium, Firefox and WebKit for drawing, editing, controls, shapes, image feedback, header, typography, notes, connectors and erasing; another 3 passed for proportional manual note resize and Undo.
- Inspected rendered desktop/narrow header and error states and a resized note. Screenshots remain ignored local test artifacts.
- Scoped design detector: only the intentional canvas grid advisory.
- Local app restarted and returned HTTP 200 on the default development port.

The local integration check caught and corrected a POST read-sync authorization regression. Manual resize verification caught and corrected history grouping with note creation. These fixes are included in the passing results above.

Phase 3 remains pending its existing human acceptance checklist. Unrelated working-tree changes were preserved.
