---
status: complete
quick_id: 260924-kqt
completed: 2026-09-24
implementation_commit: 5b76249
---

# Menu icons, sharing alignment and zoom presets

- Shared decorative SVG icons now cover application, account, library board actions, import, grid-spacing and object context-menu actions while retaining their accessible text names.
- Sharing separates each person's identity and access status from its control row. Role selectors and save/remove buttons align on desktop, with a two-column button row beneath the selector on narrow screens. Sharing buttons include icons, including retry, confirmation, closing and copying the link.
- Clicking the viewport percentage opens 25%, 50%, 100%, 200% and 300% presets. Current scale is marked, selection updates the native viewport, arrow/Home/End keys navigate, Escape restores trigger focus, and outside clicks dismiss the menu.

## Validation

TypeScript checks and the production build passed. Existing bundle-size warnings remain.

83 distinct browser/project cases passed across focused runs (87 executions): 18 sharing regressions and 2 application-menu cases in Chromium; 19 menu, sharing-layout and object-arrangement cases in each of Chromium, Firefox and WebKit; and 2 viewport accessibility cases per browser. Checks cover mutation recovery, owner access changes, long lists, zoom values, keyboard navigation, focus, dismissal and 390px controls.

Rendered sharing layouts were inspected at 1456px and 390px. Synthetic screenshots remain ignored local test artifacts. The local app responds successfully on its default port. Unrelated working-tree files were excluded. Existing phase acceptance status remains unchanged.
