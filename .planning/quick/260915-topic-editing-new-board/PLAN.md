# Topic editing, viewport focus and File → New

## Approved scope

Correct the reported Phase 2 editing font and viewport failures. Add File → New to open a blank canvas in another tab. Keep the original board available in its existing tab.

## Implementation sequence

1. Add regressions for computed inline typography, centered child/sibling editing and independent board tabs. Confirm failures before implementation.
2. Match the native canvas font fallback in shape text editors through a scoped adapter. Preserve model typography and rich-text marks.
3. Center newly created topics before native editor focus; retain zoom, stable canvas geometry and keyboard routing.
4. Add the New menu item using a native new-tab link. Pin board identity per URL and consume new-board intent only after persistence, so reloads retain each tab's board.
5. Verify browser behavior across Chromium, Firefox and WebKit, existing mind-map/board regressions, units and static checks. Record evidence separately from user acceptance.

## Plan review

Each reported behavior has a direct observable regression. Existing source-board content, model anchors, zoom and rich-text formatting must remain intact. Use synthetic boards and isolated browser storage. Preserve the remaining Phase 2 native UAT gates; do not advance Phase 3.
