---
status: complete
quick_id: 260924-s1x
date: 2026-09-24
implementation_commit: 07f3170
---

# Import a board file from the library

Removed the **Copy local boards** menu and migration dialog. The library **Import** button now opens an accessible dialog with a file picker and drop zone. Import accepts one exported Dalí board archive (.zip), up to 32 MB, and creates a new private canvas owned by the signed-in importer. Native editable objects, mind-map structure and formatting, and included PNG/JPEG images are preserved. Successful import refreshes the library and offers **Open board**.

File validation, progress, retry and uncertain-outcome reconciliation use the existing staged importer. Unsupported, empty, oversized, corrupt, multi-board and incomplete-image archives cannot publish a partial canvas. Retries reuse the operation receipt. System Viewers cannot start a library import. Session loss hides the dialog and a newly signed-in account must deliberately choose its own file. Browser-local documents, image stores and catalog remain unchanged.

The archive reader now obtains its schema from a memory workspace when no editor is mounted, and checks the original imported-document result count so a partially failed multi-board archive cannot be accepted as a single board. Library activation explicitly focuses the Import trigger for correct focus restoration in WebKit. Validation also exposed a stale canvas import error covering the File menu after dismissal; closing that dialog now clears the error and restores Main Menu focus.

## Validation

- Application, server and development TypeScript checks passed after the final source changes.
- All **110 unit tests** and **116 server tests** passed. The server run required local-listener permission after the sandbox initially denied its test ports.
- Production builds passed with the existing bundle-size and dynamic-import warnings.
- **96 distinct focused browser/project cases passed** across Chromium, Firefox and WebKit, accumulated across the relevant runs. The 90-case library/import/accessibility run passed 88 cases and found two WebKit focus-return failures. After correction, the final **18/18** run passed all affected focus and positive-import cases plus six existing canvas archive round trips. The unrelated interrupted broad run is not claimed as complete evidence.
- Real exported ZIPs were selected through the browser picker and dropped via DataTransfer. Checks verify new private ownership, no inherited grants, exact image bytes, editable native hierarchy/formatting, reload persistence and unchanged original local stores.
- Negative cases cover malformed/missing/multiple/oversized files, upload failure, transactional rollback, quota rejection, receipt reconciliation, Viewer denial, foreign staging access, expiration and account changes.
- Reviewed synthetic screenshots at 320px and 707px; responsive checks also cover 1404px. Keyboard focus, close/Escape, 44px targets and dialog bounds passed.
- Initial testing caught the archive result-count issue, a missing role-claim mapping in the synthetic fixture, WebKit trigger focus and the pre-existing canvas error overlay. Each was corrected and its affected checks passed. Staged diff and privacy checks passed; test data and domains are synthetic.

## Scope and acceptance

The user explicitly superseded the optional browser-local migration UI. Phase 3 UAT item 9 remains skipped by that scope decision; the current UAT review records the file-based replacement. Historical migration evidence retains its original revision scope. The checklist remains **6 passes, 3 skips (2 deferred follow-ups and 1 waiver), and 1 pending item (8)**. Phase 3 remains open and its historical full-gate score remains unchanged.

## Files

- [BoardImportDialog.tsx](../../../src/boards/BoardImportDialog.tsx) (file selection, dropping, validation, import progress and recovery).
- [BoardLibrary.tsx](../../../src/boards/BoardLibrary.tsx) (direct Import button and library refresh).
- [import-local.ts](../../../src/boards/import-local.ts) (memory-only archive conversion and staged import service).
- [local-board-import.spec.ts](../../../tests/local-board-import.spec.ts) (replacement file-import and source-preservation regressions; existing filename retained for the access-suite configuration).
- [03-UAT.md](../../phases/03-okta-and-board-access/03-UAT.md) (current acceptance checklist).

Unrelated pre-existing edits were excluded. No user export, screenshot, board content, identity configuration or operational data was added to repository content.
