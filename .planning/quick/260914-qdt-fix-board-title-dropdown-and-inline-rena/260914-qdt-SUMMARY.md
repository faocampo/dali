---
status: complete
completed: 2026-09-15
implementation: 3c6ae31b2f5de231a9060422fb041812d8982195
---
# Board title dropdown and rename

The board title now opens Board options with Rename board and All boards. Rename uses the existing local catalog/workspace operation, updates the title after saving and preserves the mounted canvas. The focused form supports Save/Enter, Cancel/Escape, blank-name rejection, error feedback and guarded saving. Menu keyboard navigation and outside dismissal are supported.

Validation: 12/12 focused browser checks across development Chromium and production Chromium, Firefox and WebKit; 48/48 affected production regressions; 67/67 units; typecheck and production build passed. The first navigation regression run passed 46 and failed two copied-board return paths that still assumed direct title-button navigation. Both now explicitly choose All boards, and all 48 passed on rerun. Existing bundle-size advisory remains.

Executed inline with the GSD quick fallback. Source and staged privacy review passed; user images remain untracked. No roadmap advancement or Phase 2 acceptance is recorded. This header correction changes shared CSS and navigation test gestures; the phase verification fingerprint should be refreshed when phase acceptance resumes, with these results distinguished from the earlier broader phase matrix.
