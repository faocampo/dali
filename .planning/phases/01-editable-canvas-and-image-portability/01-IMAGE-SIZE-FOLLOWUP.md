# Image detail at high zoom

Date: 2026-09-12

Manual feedback reported difficulty reading a reduced image even at high canvas zoom. Read-only DOM inspection confirmed that decoded source dimensions exceeded the displayed dimensions. A synthetic Chromium comparison found identical pixels between a 6x CSS transform and direct rendering at the same screen size; no additional transform blur was reproduced.

Added **Restore original size** to image Properties. It restores the currently rendered source's pixel dimensions as canvas dimensions, preserves its center, and uses the existing geometry/history path. Existing crop and color edits and source bytes remain intact. A load failure produces a retry message. The control explains using 100% canvas zoom to inspect original pixel dimensions.

Validation: TypeScript and production build passed. The new synthetic browser regression passed in development Chromium and production Chromium, Firefox, and WebKit (4 cases). It checks source dimensions, center preservation, SHA-256 equality of stored image bytes, and Undo. The control was also observed in the running manual-test page.

Manual confirmation of readability remains pending; this update does not mark Phase 1 complete.
