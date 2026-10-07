# Topic editing, viewport focus and File → New

## Changes

- Shape text editors use the same font-family fallback as the native canvas renderer and retain the model's italic style. The adapter runs after native renders, including double-click editing.
- Topic creation rebuilds the native hierarchy inside its transaction before layout. View centering uses the new topic's final geometry before inline editing takes focus, and keeps the current zoom.
- Mind-map text input uses the actual selected range for ordinary typing. This corrects Firefox appending text to a visibly selected placeholder while retaining native composition and replacement-input handling.
- Dalí → File → New is a native new-tab link with an icon. The destination creates and persists a blank board, then pins its ID in the URL. Existing tabs retain their own board identity across reloads. Initial persistence has a bounded wait.
- Image import and replacement continue to reject a changed board in the same tab. Another tab changing the last-opened preference no longer invalidates the source tab.

## Evidence

Before implementation, the new inline-font assertion failed because its computed font stack contained only an unavailable surface font. The two viewport checks failed by hundreds of pixels. New was absent from the File menu.

A first correction narrowed the viewport error; inspection showed native children observers had not yet rebuilt the transaction's tree. Rebuilding before layout resolved it without delayed focus or scroll callbacks.

Cross-browser validation found Firefox supplying an inconsistent target range for selected placeholder text. The scoped native input hook corrects that case; typing now replaces the selection.

Final validation:

- 114 focused cases passed across production Chromium, Firefox and WebKit: typography, repeated topic creation, editing focus, zoom preservation, native layout/undo, narrow viewport accessibility, menus and board titles.
- A 40-case Chromium regression run passed: local board switching/reload/storage failures, image import/replacement, mind-map PNG export, and the focused scenarios. This includes importing into the original board with the new tab open, followed by independent reloads. Four focused scenarios overlap the first run.
- 67 unit tests, TypeScript checking, production build and whitespace checks passed. Existing build size/import advisories remain.
- Refreshed stale image-picker test locators after discovering the input had previously moved outside the toolbar container.
- Inspected a synthetic canvas screenshot after repeated child/sibling creation at 65% zoom.

The native clipboard, OS IME and actual browser zoom acceptance limits remain recorded separately in UAT.

## Acceptance

Phase 2 UAT Test 5 records the user's reported failures and awaits focused retest. Branch copy/unlock, real browser magnification, native clipboard and native IME acceptance retain their previous unconfirmed status. Phase 3 remains unstarted.
