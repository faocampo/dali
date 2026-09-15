---
status: complete
completed: 2026-09-15
---
# Canvas accessibility, export, and toolbar fixes

Resolved all five approved canvas critique findings in the requested priority order.

- Export uses a native modal with an inert background, explicit Tab/Shift+Tab wrapping, Escape dismissal, and trigger focus restoration.
- Named viewport buttons operate the native zoom/fit controller; history lives beside them.
- PNG dimensions and Download remain in a stable footer while compact settings scroll.
- Download completion describes the artifact and offers Done or Export again. Upstream source attribution is in Help.
- Creation tools remain on the left with consistent SVG icons. Export, Import, and Help occupy a fixed board-actions group; Help explains shortcuts and board files.
- A regression exposed image quick actions overlapping Export after panning. Board actions now remain above contextual image actions.

## Validation

- Type checking and production build passed. Existing bundle-size and dynamic-import build advisories remain.
- 67 unit tests passed.
- 41 final production browser tests passed: canvas controls, canvas editing, modal accessibility, image export and recovery, and mind-map export.
- 10 focused Firefox/WebKit tests passed: keyboard boundaries, background focus prevention, Escape restoration, download retry/completion, short-viewport footer, and reachable named viewport/board controls.
- An earlier focused pass also validated board naming and local board persistence. Initial browser startup failed because temporary browser runtimes were absent; installed runtimes enabled actual execution.
- Desktop and narrow-screen browser inspection confirmed the layout, names, and modal behavior. Screenshots remained outside repository storage.
- The Impeccable static detector returned no findings. Source whitespace checks passed.

Actual screen-reader speech, native IME/clipboard, and real browser magnification were not validated by this change. Phase 2 retains its existing user-acceptance status; its earlier verification fingerprint does not certify these subsequent UI changes.
