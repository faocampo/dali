---
phase: 03-okta-and-board-access
reviewed: 2026-09-16T20:52:09Z
depth: standard
source_head: 033ecc0dd40665a6abd593d838db2e2f82453868
reviewed_final_delta_files: 4
resolved_total_findings: 8
remediation_base: 43bd9c5
remediation_files_reread: 19
resolved_prior_findings: 7
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
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
---

# Phase 3: Code Review Report

**Depth:** standard, with relevant cross-module call traces
**Cumulative scope:** all 92 configured files
**Implementation snapshot:** `033ecc0dd40665a6abd593d838db2e2f82453868`
**Remediation rereview:** all 19 files changed in `43bd9c5..12a2184`, read in full, retaining the original complete phase review
**Final delta:** three source/test files in `033ecc0` and the acceptance document in `7360be0`; checkpoint/tracking deltas reviewed as supporting context
**Status:** clean — all seven original findings and follow-up CR-07 resolved; no open review findings

## Narrative Findings (AI reviewer)

The eight original remediation commits address the six initial BLOCKER findings and separate test-reliability WARNING. Follow-up commit `033ecc0` resolves CR-07. Independent source review confirms the corrected contracts and their relevant consumers. No additional defect was proved in the final narrow delta. The clean status applies to this pinned code-review scope; final acceptance remains open.

This rereview used source and test-oracle inspection. The reviewer ran no tests, build, browser or listening service; the acceptance executor owns those processes. The supplied fix report records both typechecks, 102 unit tests, 110 server tests, production build and 86 affected Chromium cases passing. Those execution results remain attributed to the fix executor. For the final CR-07 correction, the parent additionally reports both typechecks and 6/6 production Chromium cases passing in 29.1s; the semantic assertions were independently inspected, with no reviewer rerun.

Actual-provider registration and membership/claim-policy validation, native OS zoom, IME and assistive-technology acceptance remain **pending**. Full configured browser/access acceptance awaits final executor evidence. Phase 4 durability/deployment and Phase 5 live collaboration/20-user acceptance remain outside this review.

## Final follow-up finding resolved

### CR-07: original BLOCKER — inert Viewer File Import — resolved

**Fix evidence:** `src/header/DaliMenu.tsx:73-74` sets native `disabled` for Viewer and associates `viewer-import-reason` through `aria-describedby`. The matching explanation is visibly rendered in the File submenu. The existing keyboard menu selectors exclude disabled items, so navigation passes from All boards to Export and back. Owner/Editor retain the existing enabled import command and mounted BoardControls picker. No permission or staging service was broadened.

**Inspected semantic oracles:** `tests/board-roles.spec.ts:54-72` asserts disabled state, exact accessible description, visible explanation, keyboard traversal, no picker/dialog/import request after a native button click, exact native model/vector preservation and an independent Owner-authenticated server reread. The Owner API context is retained before the separate Viewer sign-in.

`tests/board-actions.spec.ts:48-109` now runs the real archive restoration as both Owner and Editor. The Editor case signs in as a distinct member and receives an Editor grant; it does not simulate a role only in the UI. Before switching identity, the fixture waits for the server export manifest to contain the synthetic image and for acknowledged save state. Both roles retain missing-asset rejection, failed-upload retry, complete image equality, fresh identities, private destination ownership, hierarchy equality and unchanged source assertions. The manifest wait strengthens readiness without weakening any content oracle.

**Independent conclusion:** The previously enabled action without a consumer has been removed from the Viewer interaction path with an accessible explanation. Supported writable restoration remains covered by the actual picker/publication workflow. CR-07 is closed; no new issue was found in this correction.

## Resolved original findings

### CR-01: original BLOCKER — acknowledged unreadable root metadata — resolved

**Fix evidence:** `server/boards/documents.ts:29-34` now requires a Y.Array with exactly one entry containing the bound content ID, string title, finite createDate and array tags. Y.Map entries are normalized consistently with `src/canvas/account/board-meta.ts:11-25`. The push transaction validates before changing bytes, revision or preview; staged document ingestion at `server/boards/imports.ts:59` calls the same validator. API-created and staging roots retain the native shape, and successful synthetic roots were corrected.

**Inspected semantic oracles:** `server/boards/access.test.ts:154-188` checks invalid metadata for Owner/Editor, unchanged rows/bytes/vector/preview, and valid Y.Map metadata. `server/boards/actions.test.ts` rejects an invalid staging root without state changes. `tests/board-actions.spec.ts:38-50` verifies the rejected variants leave the original board opening in the native editor. The stricter invariant was traced through BoardWorkspace hydration and staging initialization.

### CR-02: original BLOCKER — missing account archive restoration — resolved for the supported writable workflow

**Fix evidence:** `src/canvas/BlockSuiteCanvas.tsx:238-278` now creates a confirmed LocalBoardCopy with a stable operation ID and captured scope. `src/boards/import-local.ts:69-96` imports native ZIP contents into an isolated memory workspace, requires one board, validates mind maps and checks referenced PNG/JPEG blobs and hashes. Cleanup runs in finally.

LocalBoardCopy stages the snapshot with server-reserved destination IDs, regenerated surface identities and native block-ID replacement, uploads documents/assets, then atomically commits. Its request wrapper checks the account/scope and freshly authorizes the originating writable board before each request. The server retains current-session, expected-account and transaction guards. Lost commit responses reconcile the same receipt. The new Open imported board link reaches the existing same-origin navigation listener in `src/auth/session.ts`, which preserves before navigation. ZIP conversion never opens persisted legacy storage.

**Inspected semantic oracles:** `tests/board-actions.spec.ts` checks export/import text, hierarchy and images; fresh identities; private ownership; unchanged source; missing images; upload failure/retry; stale role; and cross-tab account change before publication. Viewer menu availability was subsequently corrected and independently closed as CR-07 above.

### CR-03: original BLOCKER — active copy omitted pending edits — resolved

**Fix evidence:** `src/canvas/runtime.ts:39-69` captures complete current root/content updates, waits for journal preservation and replays them before export. It has a ten-second deadline, abort signal, three stability attempts and same-runtime/generation/write checks. It compares the visible encoded state after replay and gives a recoverable error if synchronization fails. `src/boards/operations.ts:99` invokes it before export and retains the guard around subsequent requests. Saved-source library copies keep their prior path. `src/header/Header.tsx:151` preserves before completion navigation.

**Concurrency trace:** Captures use distinct record IDs. Concurrent native pushes and replay can acknowledge the same record idempotently; acknowledgment removes only that record. Native writes journal before network submission and replay pending blobs first. The duplicate path also replays blobs before documents, and server pushes merge Yjs updates against the newest committed state transactionally. Existing source-revision checks prevent publishing a reserved source after subsequent server changes. The timeout aborts replay and fails the action before destination creation. No new journal-ordering defect was proved.

**Inspected semantic oracles:** The failed/held-push cases in `tests/board-actions.spec.ts` assert exact visible text, no premature destination, retained source after failure, retry, and exact reopened copy/source content. Saved-source cases retain hierarchy, typography, connectors, images and source-integrity assertions.

### CR-04: original BLOCKER — Viewer View commands inert — resolved

**Fix evidence:** `src/canvas/BlockSuiteCanvas.tsx:50-62` mounts fit/reset-zoom handling for every current authorized host and respects viewport locks. Editing/history handlers remain writable-only. `src/header/DaliMenu.tsx:81-82` disables Viewer Layers with a visible associated explanation.

**Inspected semantic oracle:** `tests/board-roles.spec.ts` invokes Viewer menu commands, checks 100% zoom and a changed viewport after Fit, verifies disabled Layers/explanation and history, and compares exact local model/vector and authorized owner rereads. It checks behavior rather than visibility alone.

### CR-05: original BLOCKER — actions broke filter/order — resolved

**Fix evidence:** `src/boards/BoardLibrary.tsx:147-153` refreshes the authoritative active-filter query after acknowledgment. The existing request effect rejects stale responses and validates account-bound summaries. The new focus effect at lines 49-55 waits for successful rows/loading completion. A duplicate excluded from Shared with me returns focus to its source; deletion chooses a surviving card or New board.

**Inspected semantic oracles:** `tests/board-actions.spec.ts` compares exact rendered IDs with authoritative responses after older-board rename, timestamp ties and duplication under Shared with me. Existing duplicate/deletion cases assert target/fallback focus. Effect dependencies were traced to ensure focus is not consumed on the acknowledgment render before refresh starts.

### CR-06: original BLOCKER — exports used stale renamed title — resolved

**Fix evidence:** `src/canvas/export-board.ts:148-184,199-213` parses a fresh authorized summary, verifies board/account identity and title type, then uses its title for archive metadata and all filenames. Final authorization rejects a changed title during preparation and rechecks scope immediately before download. The construction-time runtime title is no longer used.

**Inspected semantic oracles:** `tests/board-roles.spec.ts` renames and exports without reload, checking ZIP/PNG/PDF filenames and decoded snapshot title. `src/canvas/export-board.test.ts` now supplies the descriptor contract and asserts rendering occurred before identity-change rejection, avoiding a false pass from an early mock-contract error. The concurrent-title rejection is source-verified; independent execution of that interleaving is not claimed.

### WR-01: original WARNING — obsolete regression fixtures — resolved

**Fix evidence:** `tests/community.spec.ts`, `tests/mindmap-compatibility.spec.ts` and `tests/mindmap-copy.spec.ts` use account-library links, named actions, confirmations and acknowledgments. Copy checks require fresh identities while comparing hierarchy, geometry, typography, collapse details and source independence.

Community's fault injection targets `dali-account-recovery-v1`. It asserts the injected failure occurred, pending state remained, the server stayed unchanged, preservation failed visibly, and retry/reopen recovered the pending model. Error collection remains enabled. These are test-reliability repairs, separate from product defects.

## Coverage, evidence limits and deltas

- The original standard-depth review read all 92 listed files. This rereview preserves the full scope and rereads all 19 remediation files, plus relevant consumers and native ZIP-transformer code. No scope was dropped.
- Commits reviewed: `8654e1c`, `536f5d3`, `b1b262b`, `19528cd`, `2cfd25c`, `f635a62`, `46a8402`, `12a2184`.
- Prior reviewed test deltas `f7be2f8` and `1d3c9cb` remain included in the cumulative scope.
- No structural pre-pass was supplied.
- The fix report's “requires human verification” label is role-mandated wording. Its automated semantic assertions directly address the original defects. Independent source review establishes corrected control flow/contracts, while execution results remain attributed to the fix executor. Neither establishes actual-provider or native OS acceptance.
- Final delta `033ecc0` was reviewed in all three affected source/test files, retaining the full 92-file scope. The accepted `docs/access-acceptance.md` change from `7360be0` describes the implemented writable-board/private-copy archive flow, retry/reconciliation and private evidence handling.
- The `7360be0` checkpoint and tracking changes correctly attribute 2/2 smoke, 102 unit, 110 server and 110 access results to `12a2184`. They explicitly record that the full browser matrix had **not started** at that handoff, distinguish 1452 selected cases from executed cases, and keep Plan 12, Phase 3 and actual-provider/native acceptance open. The launcher termination is not represented as a failed access suite or completed final gate. No inconsistency was found against the supplied gate facts.
- The full suite is now reported running by the acceptance executor after the CR-07 fix. Its final selection/result counts must be recorded against that later run; the earlier checkpoint's 1452 count is historical, not a claim about the final corrected suite.
- At final inspection HEAD remained `033ecc0dd40665a6abd593d838db2e2f82453868`. No further tracked source/test/document delta was present outside this review artifact. Subsequent test corrections and final acceptance documentation require delta reconciliation.
- Untracked planning/operator and image assets remain outside the pinned source scope and were preserved.
- This reviewer changed only this report and performed no implementation/test edits, commits or runtime validation during rereview.

_Reviewer: gsd-code-reviewer_
_Reviewed: 2026-09-16T20:52:09Z_
