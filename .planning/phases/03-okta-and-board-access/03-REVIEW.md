---
phase: 03-okta-and-board-access
reviewed: 2026-09-16T19:42:00Z
depth: standard
source_head: 766918b4058c102d6dcd5ee04ea6dbaa6f61a800
diff_base: 3b48c837e73203712020c496352c908a4cc87d3f
reviewed_test_delta: f7be2f840b1110dab2b73dee4a31148cf95cbf1e
reviewed_followup_test_delta: 1d3c9cb5bfd246c86a4bb3cb51f9ded0d0a3b84f
files_reviewed: 92
files_reviewed_list:
  - docs/access-acceptance.md
  - package.json
  - playwright.config.ts
  - server/app.ts
  - server/auth/identity-policy.ts
  - server/auth/oidc.test.ts
  - server/auth/oidc.ts
  - server/auth/session-store.ts
  - server/boards/access.test.ts
  - server/boards/actions.test.ts
  - server/boards/actions.ts
  - server/boards/blobs.ts
  - server/boards/documents.ts
  - server/boards/grants.test.ts
  - server/boards/grants.ts
  - server/boards/imports.ts
  - server/boards/library.test.ts
  - server/boards/operation-receipts.test.ts
  - server/boards/routes.ts
  - server/preflight.test.ts
  - server/storage/database.ts
  - src/App.tsx
  - src/auth/AuthBoundary.tsx
  - src/auth/session.ts
  - src/boards/BoardActionDialog.tsx
  - src/boards/BoardLibrary.tsx
  - src/boards/LocalBoardCopyDialog.tsx
  - src/boards/ShareBoardDialog.tsx
  - src/boards/catalog.ts
  - src/boards/import-local.ts
  - src/boards/operations.ts
  - src/boards/preferences.ts
  - src/canvas/BlockSuiteCanvas.tsx
  - src/canvas/account/blob-source.test.ts
  - src/canvas/account/blob-source.ts
  - src/canvas/account/board-doc.ts
  - src/canvas/account/board-meta.ts
  - src/canvas/account/board-workspace.ts
  - src/canvas/account/doc-source.test.ts
  - src/canvas/account/doc-source.ts
  - src/canvas/account/mutation-guard.test.ts
  - src/canvas/account/mutation-guard.ts
  - src/canvas/account/outbox.ts
  - src/canvas/blocksuite-editor.ts
  - src/canvas/export-board.test.ts
  - src/canvas/export-board.ts
  - src/canvas/image-input.ts
  - src/canvas/legacy-runtime.ts
  - src/canvas/runtime.ts
  - src/canvas/workspace.ts
  - src/header/BoardTitleMenu.tsx
  - src/header/DaliMenu.tsx
  - src/header/ExportDialog.tsx
  - src/header/Header.tsx
  - src/index.css
  - tests/access-boundaries.spec.ts
  - tests/access-fixtures.ts
  - tests/accessibility-access.spec.ts
  - tests/account-workspace-harness.ts
  - tests/account-workspace.spec.ts
  - tests/authentication.spec.ts
  - tests/board-access.spec.ts
  - tests/board-actions.spec.ts
  - tests/board-library.spec.ts
  - tests/board-roles.spec.ts
  - tests/board-sharing.spec.ts
  - tests/canvas-arrangement.spec.ts
  - tests/canvas-editing.spec.ts
  - tests/community.spec.ts
  - tests/connector-labels.spec.ts
  - tests/dali-menu.spec.ts
  - tests/fixtures.ts
  - tests/image-export.spec.ts
  - tests/image-import.spec.ts
  - tests/local-board-import.spec.ts
  - tests/mindmap-accessibility.spec.ts
  - tests/mindmap-collapse.spec.ts
  - tests/mindmap-compatibility.spec.ts
  - tests/mindmap-copy.spec.ts
  - tests/mindmap-formatting.spec.ts
  - tests/mindmap-keyboard.spec.ts
  - tests/mindmap-layout.spec.ts
  - tests/mindmap-node-copy.spec.ts
  - tests/mindmap-workflow.spec.ts
  - tests/mindmap.spec.ts
  - tests/oidc-provider.ts
  - tests/session-recovery.spec.ts
  - tests/sticky-shadow.spec.ts
  - tests/topic-focus-new-board.spec.ts
  - tsconfig.server.json
  - vite.config.ts
  - vitest.server.config.ts
findings:
  critical: 6
  warning: 1
  info: 0
  total: 7
status: issues_found
---

# Phase 3: Code Review Report

**Depth:** standard, with relevant cross-module call traces
**Scope:** all 92 configured source, configuration, documentation and test files
**Implementation snapshot:** `766918b4058c102d6dcd5ee04ea6dbaa6f61a800`
**Additional test review:** `f7be2f840b1110dab2b73dee4a31148cf95cbf1e` and `1d3c9cb5bfd246c86a4bb3cb51f9ded0d0a3b84f`

## Narrative Findings (AI reviewer)

The reviewed implementation has six proved product defects and one separate test-reliability warning. Evidence below distinguishes executed pure analysis from source-derived reproduction procedures. No browser, build, listening service or test suite was started by this reviewer; the acceptance executor retained that slot.

Actual-provider registration, membership/claim-policy validation and native OS zoom, IME and assistive-technology acceptance remain **pending**. Phase 4 durability/deployment and Phase 5 live collaboration/20-user acceptance are outside this review. Existing synthetic test results do not establish those outcomes.

## Critical Issues

### CR-01: BLOCKER — accepted root updates can make an acknowledged board unreadable

**File:** `server/boards/documents.ts:30`
**Related evidence:** `server/boards/documents.ts:76-87`; `src/canvas/account/board-meta.ts:11-25`; `src/canvas/account/board-workspace.ts:85-90`.

**Issue:** Root validation permits absent `meta.pages`, an empty array, and an entry with the correct content ID but missing native metadata fields. The push route persists that state and returns `{ acknowledged: true }`. The account client requires exactly one entry containing a string title, finite createDate and array tags; hydration then throws `Invalid board metadata`. A currently authorized writer can therefore commit a root the application cannot reopen. The content bytes remain stored, but normal board access is broken for every reader.

**Reproduction and oracle:** Start from an API-created board, pull its root, remove `meta.pages` in Yjs, and POST the incremental update to the root's push endpoint as Owner or Editor. Current code returns 200/acknowledged and changes stored root bytes. A fresh account-workspace open fails before rendering. Empty pages and a sole correct-ID entry missing tags/createDate behave similarly. Pure in-memory execution of the actual `validateDocument` and `BoardMeta.initialize` implementations reproduced all three variants: server validator accepted; client threw `Invalid board metadata`. Existing `server/boards/access.test.ts:158-159` also intentionally submits an incomplete metadata entry and expects success, so that test currently preserves this contract mismatch.

**Fix:** Require exactly one native metadata entry and validate the same mandatory field types as BoardMeta before committing root updates. Apply the invariant to staged import/duplicate publication too, since it calls the same validator. Update successful synthetic roots to valid native metadata. Add rejection cases that assert unchanged bytes, vectors, revision and thumbnail plus a successful owner reopen.

### CR-02: BLOCKER — File Import cannot restore any editable archive

**File:** `src/canvas/BlockSuiteCanvas.tsx:229`
**Related evidence:** `src/header/DaliMenu.tsx:73`; `src/canvas/BlockSuiteCanvas.tsx:242-265`; `src/boards/BoardLibrary.tsx:136-137`; `src/canvas/export-board.ts:28-30`.

**Issue:** Every mounted account canvas has an active access scope, so choosing any ZIP file returns immediately with “Open your boards to import a copy into your account.” The library's Copy local boards action only inventories existing legacy browser storage; it provides no ZIP-file restoration path. The remaining ZipTransformer import branch is unreachable through the current authenticated application. Editable export still advertises a file “re-importable here,” and the save-recovery UI offers that archive as a backup.

**Reproduction and oracle:** As an Owner, export a board containing text and an image as Editable board file, then choose File > Import board and select that archive. The picker opens, but no import request or copied board follows; the action displays the redirect instruction. Navigate to Your boards: Copy local boards cannot select the downloaded archive. The existing `tests/dali-menu.spec.ts:31-38` asserts only that the picker opens and therefore misses restoration failure.

**Fix:** Connect ZIP ingestion to the authorized, isolated destination staging/import pipeline with fresh board/document/element identities, complete image validation and atomic publication. Keep original boards unchanged. Verify export → ZIP selection → private account copy → fresh reopen with content/image equality. Do not restore the legacy branch against account storage.

### CR-03: BLOCKER — duplicating an open board silently omits pending edits and leaves without preservation

**File:** `src/boards/operations.ts:95`
**Related evidence:** `src/boards/operations.ts:107-124`; `src/header/Header.tsx:147-151`; `src/canvas/runtime.ts:25-37`; `src/auth/session.ts:169-177`.

**Issue:** The header invokes the same action used by the library. Duplication reads only the server's editable snapshot and never synchronizes the current native workspace first. If the open board contains visible edits whose document pushes have failed, the duplicate succeeds from older server content and reports success. Header completion immediately calls `window.location.assign`, bypassing the explicit capture/preservation path used by normal library navigation. The proved defect is an incomplete successful copy; loss of edits that have not yet reached the journal is an additional risk, not an executed data-loss claim.

**Reproduction and oracle:** Open an authorized board with acknowledged text A. Make its document push requests return 503 while allowing metadata/export/duplicate/import routes to work. Change the visible text to B and invoke File > Duplicate board. The exported server snapshot still contains A, and the private destination commits A without warning that B was excluded. The header navigates away. Compare the destination's reopened native text to the visible source snapshot captured immediately before duplication: they differ. No concurrent-user or Phase 5 transport behavior is required.

**Fix:** When duplicating the active board, finish a bounded, generation-checked synchronization of its current edits before taking the server snapshot; show a recoverable failure if that cannot complete. Before any completion navigation, explicitly secure pending source work using the established preservation path, and retain the source tab if preservation fails. Preserve the existing authoritative revision and commit-time role checks. Add a header duplicate case with failed/held pushes and an exact destination-content oracle; keep the saved-source/library duplicate case.

### CR-04: BLOCKER — Viewer Main Menu navigation commands are inert

**File:** `src/canvas/BlockSuiteCanvas.tsx:96`
**Related evidence:** `src/canvas/BlockSuiteCanvas.tsx:167-180`; `src/canvas/BlockSuiteCanvas.tsx:104-106`; `src/header/DaliMenu.tsx:78-82`.

**Issue:** The sole `dali:board-command` listener for fit, reset-zoom and layers lives inside BoardControls, which is mounted only for writable users. Viewers receive ViewportControls instead, while Main Menu still offers all three commands. Selecting the menu items closes the menu without acting. Layers is additionally suppressed by the writable-only inspector render condition.

**Reproduction and oracle:** Open a shared board as Viewer; pan and set zoom to 50%. Select Main Menu > View > Reset zoom to 100%: zoom stays at 50%. Fit to screen leaves the viewport unchanged; Layers opens no panel. The ViewportControls buttons' separate handlers do not service these menu events. Existing role tests verify pointer navigation and menu visibility, but do not invoke these Viewer menu actions.

**Fix:** Mount the nonmutating viewport-command listener for every authorized canvas. Provide a read-only layer-selection view or remove/disable the unavailable Layers action with an explanation. Keep history and mutation handlers behind write authorization. Verify Viewer menu zoom/fit outcomes and unchanged local/server document state.

### CR-05: BLOCKER — successful library actions violate the active filter and recent-first ordering

**File:** `src/boards/BoardLibrary.tsx:141`
**Related evidence:** `src/boards/BoardLibrary.tsx:123-134`; `src/boards/BoardLibrary.tsx:107-108`; `server/boards/routes.ts` (authoritative filtered, ordered library query).

**Issue:** Action completion directly prepends duplicates or replaces renamed summaries in the current array. It neither applies the selected filter nor restores server ordering. Duplicating an Editor board while Shared with me is selected inserts the new private Owner board into that filter. Renaming an older board changes its updatedAt but leaves it at its old position until refresh. This contradicts the implemented All/Mine/Shared with me and recent-first library contract.

**Reproduction and oracle:** In Shared with me, duplicate an Editor board and wait for “Private copy created.” A Private/Owner card now appears while Shared with me remains selected; a fresh GET with `filter=shared` excludes that destination. Separately, create two boards with distinct timestamps, rename the older one, and compare rendered IDs with a fresh authoritative GET: the renamed board remains lower despite being newest. Initial-load ordering tests do not exercise either mutation.

**Fix:** Refetch the active filtered library after acknowledgment, or route all action results through one filter-and-sort reducer that uses the same role membership and timestamp/ID ordering as the server. If the product wants to focus the duplicate, deliberately switch to All or Mine before showing it. Verify both active-filter membership and order after rename/duplicate, including timestamp ties.

### CR-06: BLOCKER — inline rename leaves exported archive metadata and filenames at the old title

**File:** `src/canvas/export-board.ts:159`
**Related evidence:** `src/canvas/export-board.ts:166-178`; `src/canvas/runtime.ts:79`; `src/canvas/account/board-workspace.ts:47-49,72`; `src/App.tsx:52-56,85`.

**Issue:** Rename acknowledgment updates the React board descriptor, but the mounted runtime and BoardMeta retain their construction-time descriptor/title clones. Export takes the title from that stale runtime and explicitly writes it into `snapshot.meta.title`. Its fresh authorization response is consumed and discarded. Thus a successful rename is reflected in the header and SQL but not in an immediately downloaded editable archive, PNG or PDF filename. The editable snapshot also records the old title.

**Reproduction and oracle:** Open board “Synthetic old,” rename it to “Synthetic new” using the inline field, wait for server acknowledgment, and export without reloading. The filename uses “Synthetic old”; unzip the editable archive and read `snapshot.meta.title`: it is also “Synthetic old,” while the authorized descriptor GET and header say “Synthetic new.” Reopening the board refreshes the clone and hides the defect.

**Fix:** Propagate acknowledged title changes to the active runtime/metadata facade through a scoped update, or obtain and validate the current authorized descriptor during export and use its title consistently for snapshot metadata and filenames. Add an immediate rename/export assertion covering both downloaded filename and decoded archive title.

## Warnings

### WR-01: WARNING — migrated regression fixtures still exercise removed local-library contracts

**File:** `tests/community.spec.ts:65`
**Related evidence:** `tests/community.spec.ts:80-105,116-129`; `tests/mindmap-compatibility.spec.ts:175-188`; `tests/mindmap-copy.spec.ts:120-140`; `tests/fixtures.ts:43-59`; `src/boards/BoardLibrary.tsx:119,129,133`.

**Issue:** The default fixture now signs these suites into account-backed boards. Several tests still locate Open board as a button, click “+ New board” or “Duplicate,” and assume an immediate local copy. The actual library uses Open links, New board, Duplicate board and a confirmation dialog. The old board-copy assertions also require equality of source/copied native IDs, whereas the account duplicate intentionally regenerates them. Community's quota test intercepts readwrite transactions only for `djai-storyboard`; account edits use the recovery journal and server source, so the intended failure injection no longer reaches the exercised persistence path. These tests cannot establish their advertised regression predicates.

**Reproduction and oracle:** Run the affected existing browser cases with the default account fixture. The removed button locators cannot match current library markup. For the quota case, count intercepted `djai-storyboard` writes: account editing generates none, so Save failed is never induced by that hook. These are source-proved fixture inconsistencies; this reviewer did not execute the suite.

**Fix:** Adapt the scenarios to actual account-library links/actions and confirmation/acknowledgment, verify fresh IDs plus semantic hierarchy/content equality for board copies, and inject failure into the real account persistence path. Preserve source-integrity assertions and error collection. Any explicit legacy-only conformance should use an isolated legacy harness; it must not stand in for the account regression gate. Rerun the affected cases before the full browser gate.

## Coverage, evidence limits and deltas

- All 92 configured files were read at standard depth, with additional traces into the relevant account runtime, native synchronization/metadata contracts and consumers.
- No structural pre-pass was supplied.
- Executed focused evidence: actual server root validator versus actual client metadata initializer, in memory, using synthetic Yjs documents. Three accepted-server/rejected-client variants reproduced CR-01.
- Other reproductions above are deterministic source traces with explicit browser oracles; browser execution remains with the acceptance executor.
- A mocked preservation-order experiment was excluded from findings because it did not prove the real journal's scheduling order. No claim of a confirmed logout race is made.
- The two-file test-only delta `f7be2f8` was reviewed in full context. It creates the missing native board fixture through the authorized API and rereads the correct protected board owner while checking both canaries. No additional finding in that delta.
- Follow-up test-only commit `1d3c9cb` changes `tests/board-library.spec.ts:101` from an immediate ordering assertion to `expect.poll`, retaining the exact expected ID array. Its final committed delta was inspected and has no additional finding. At final inspection, HEAD was `1d3c9cb5bfd246c86a4bb3cb51f9ded0d0a3b84f`; there were no further tracked source/test deltas awaiting review. Subsequent edits require reconciliation.
- Untracked planning/operator checkpoint and image assets are outside the immutable source scope. They were preserved and are not covered by this report.
- This report changes only its own review artifact. Implementation, tests and commits remain with their assigned owners.

_Reviewer: gsd-code-reviewer_
_Reviewed: 2026-09-16T19:42:00Z_
