---
phase: 03-okta-and-board-access
reviewed: 2026-09-16T22:03:02Z
depth: standard
source_head: f2769dcea41a6bf610eb4a45f35cb563d5bcc9c1
reviewed_ui_residual_delta_files: 2
reviewed_ui_delta_files: 15
reviewed_sharing_remediation_files: 2
reviewed_shared_fixture_delta: 995ec47bc0439deacbb0eea4f7f6ae6dd3ecd4dd
reviewed_acceptance_fixture_delta: 1a55d14dccb645ae2b095326f480dc089a245656
reviewed_acceptance_fixture_files: 2
reviewed_final_delta_files: 4
resolved_total_findings: 10
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
**Implementation snapshot:** `f2769dcea41a6bf610eb4a45f35cb563d5bcc9c1` (UI residual CSS/test correction; previous cumulative implementation and sharing remediation reviews retained)
**Remediation rereview:** all 19 files changed in `43bd9c5..12a2184`, read in full, retaining the original complete phase review
**Final delta:** three source/test files in `033ecc0` and the acceptance document in `7360be0`; checkpoint/tracking deltas reviewed as supporting context
**Additional test-only reviews:** `1a55d14` (two files) and `995ec47` (eight files); sharing source/test delta `7c8982c` (three files)
**Status:** clean — all seven original findings and follow-up CR-07, CR-08 and CR-09 resolved; no open finding in the pinned scope

## Narrative Findings (AI reviewer)

The eight original remediation commits address the six initial BLOCKER findings and separate test-reliability WARNING. Follow-up commit `033ecc0` resolves CR-07. Independent source review confirms the corrected contracts and their relevant consumers. The subsequent sharing delta `7c8982c` introduced two proved recovery-path defects. Independent rereview of both complete changed files in `b4877ce` confirms both are resolved as detailed below. No new defect was proved in this bounded remediation. Final acceptance remains open.

This rereview used source and test-oracle inspection. The reviewer ran no tests, build, browser or listening service; the acceptance executor owns those processes. The supplied fix report records both typechecks, 102 unit tests, 110 server tests, production build and 86 affected Chromium cases passing. Those execution results remain attributed to the fix executor. For the final CR-07 correction, the parent additionally reports both typechecks and 6/6 production Chromium cases passing in 29.1s; the semantic assertions were independently inspected, with no reviewer rerun.

Actual-provider registration and membership/claim-policy validation, native OS zoom, IME and assistive-technology acceptance remain **pending**. Full configured browser/access acceptance awaits final executor evidence. Phase 4 durability/deployment and Phase 5 live collaboration/20-user acceptance remain outside this review.




## UI residual delta review at f2769dc

Reviewed the two-file CSS/test delta against the previously read full files and their component markup. All 92 cumulative paths remain in scope, and all ten code-review findings remain resolved. **No new BLOCKER or WARNING was proved.**

- `src/index.css:1824-1825` distinguishes first-span email metadata (12px/400) from subsequent role/status spans and card access metadata (13px/600). The selectors match the current ShareBoardDialog span ordering; retained missing-row reconciliation sections have no conflicting span layout.
- Lines 1826-1828 add explicit 1px neutral borders to secondary dialog buttons and 2px accent focus outlines to route headings and board-action controls. Primary buttons retain their accent boundary. Existing target minima, focus lifecycle and modal behavior remain intact.
- The media query at line 1841 restores 16px library-header inline gutters at widths up to 700px while preserving the 24px wider layout. It follows the desktop rule, so the responsive override wins.
- `tests/accessibility-access.spec.ts` adds computed font, border, focus and responsive-padding assertions at both existing viewport widths. Existing overflow, target geometry, contrast, modal dimensions, focus restoration, IME nonmutation and recovery/history checks remain. Keyboard Tab followed by heading focus establishes keyboard-visible outline styling; it does not replace the separately reviewed initial route-focus assertions.
- Execution remains fixer-attributed: both typechecks and the complete measured suite 3/3 in 25.2s. The independent UI auditor owns fresh screenshot evaluation. This reviewer ran no test, build, listener or browser operation.
- The 1507-case full gate is pending executor evidence. Selection is not completion. No server, session, authorization or persistence implementation changed in this delta. Actual-provider/native acceptance remains pending; later committed corrections require a separate review.

## Final UI package review at 8320dd1

Read the approved `03-UI-SPEC.md`, baseline `03-UI-REVIEW.md`, all fifteen changed source/test files in full and relevant navigation/journal consumers. All paths already belong to the cumulative 92-file list; no new file or dropped scope. The uncommitted `03-UI-FIX.md` was read as an attributed execution report, while code conclusions use committed `8320dd1` exclusively.

**Independent result:** No new BLOCKER or WARNING was proved in this delta. All ten previously recorded code-review findings remain resolved.

- `src/boards/BoardLibrary.tsx:83-126` preserves the original create ID/title through uncertainty, validates the acknowledged account-bound summary and checks its lifetime before navigating to the encoded board ID. Uncertain outcomes retain disabled draft input and Check again; confirmed validation failures can correct the draft. The new regression checks the real committed private board, unchanged original POST payload, receipt identity, single operation and actual native editor destination.
- `src/header/Header.tsx:41-65` writes progress/failure text through DOM textContent into the gesture-reserved blank tab. It checks the tab remains blank before changing that content, catches inaccessible user-navigated tabs and retains existing account/generation checks on completion. The held-response two-New test verifies progress before releasing the response, distinct private destinations and unchanged source bytes. Blocked-popup reconciliation assertions remain.
- Route headings in `src/App.tsx`, `src/auth/AuthBoundary.tsx` and `src/boards/BoardLibrary.tsx` use explicit refs/tabIndex and transition effects. Library filter/refresh changes do not retrigger initial heading focus. Existing focusBoard completion and recovery-control restoration remain separate. Tests add focused auth-error/logout/changed-account/denied headings and verify filter/refresh retain their own focus.
- `src/boards/BoardActionDialog.tsx:37-41` includes the named irreversible deletion warning and stable field/submit error descriptions. `src/header/BoardTitleMenu.tsx:30-40` connects inline rename errors while preserving draft, composition and acknowledgment handling. Library filter controls now have the specified group role.
- `src/index.css:1803-1838` scopes dialog/body/control typography, neutral enabled card-action ink, field boundaries, destructive controls, dialog dimensions/insets and menu/import-link targets. Existing overflow containers, reduced-motion rules, card previews and canvas styles remain. Computed-style and geometry tests add actual action/font/border/dimension assertions and extend target selection to links. This source review does not independently establish screenshot appearance or every native accessibility condition.
- The journal test change preserves the meaningful invariant: first-board journal empty before leaving; exactly two document snapshots for that first board after departure; exact retained records unchanged while the second board's work is acknowledged; no second-board records remaining. `suspendAccessScope` captures both complete documents and `preserveBeforeNavigation` awaits their preservation, explaining those retained departure records. The helper reads complete records despite its narrower TypeScript return annotation; equality therefore compares complete stored records. This does not blanket-allow pending work.
- Other test edits adapt to the authorized auto-open workflow and add error associations, menu/import-link target sizes, safe deletion copy/color and Viewer title weight without removing source-integrity or role-denial assertions. No global error suppression or source authorization change was introduced.

**Attributed execution evidence:** The fix report records 102/102 unit and 110/110 server tests; both final TypeScript checks; sharing 18/18 at `b4877ce`; and the final complete measured suite 3/3 in 23.5s. It explicitly records intermediate 94/96, 41/42 and 29/30 runs and their subsequent corrections. Its 114 distinct production cases span overlapping focused selections, not one consolidated pass. This reviewer inspected the semantic assertions but ran none of these commands. Ten synthetic captures were reported inspected by the fixer; this reviewer did not perform a separate screenshot audit.

The complete final browser matrix remains owned by the acceptance executor and pending final evidence. Later fixture corrections or source commits need their own pinned delta review. Actual-provider, native 200% zoom, OS IME, assistive-technology speech and genuine BFCache restoration remain pending.

## Resolved critical findings in sharing follow-up

### CR-08: original BLOCKER — denied receipt reconciliation traps the sharing dialog — resolved

**File:** `src/boards/ShareBoardDialog.tsx:73-78,109-116,124` at `7c8982c`.

**Issue and code evidence:** Reconciliation treats every non-OK receipt response as a transient error and retains the operation. That retained entry disables Close and suppresses Escape. In contrast, ordinary load and mutation authorization failures invoke invalidation and close at lines 30 and 89. Server receipt handling reauthorizes grant operations against current grants capability (`server/boards/routes.ts:46-64`). Thus a missing board or denied current authority is terminal for this dialog, but its receipt path cannot leave uncertainty.

**Reproduction:** Make a grant mutation commit while losing its response and failing its first receipt lookup. Delete the board through another authorized Owner session, then choose Check again in the stale dialog. Receipt authorization returns 404; the unresolved entry remains, and Close/Escape remain blocked. A simulated current-authority 403 follows the same defect. This reproduction requires no owner-transfer product feature. Global session handling covers 401 and identity-change 409 (`src/auth/session.ts:155-159`), but does not rescue 403/404.

**Fix:** Handle terminal receipt authorization/resource failures through the same refresh/invalidation and close path as direct mutation denial, returning without resending the mutation. Preserve transient retry identity for transport/5xx failures. Add an uncertain-operation regression followed by actual board deletion (or injected denied capability), asserting dialog invalidation, protected-state removal and no second mutation.

### CR-09: original BLOCKER — another row's refresh removes an unresolved deletion's recovery control — resolved

**File:** `src/boards/ShareBoardDialog.tsx:102,114-116,146-156` at `7c8982c`.

**Issue and code evidence:** Pending operations survive independently in a Map, but their Check again controls exist only inside the current `access.grants.map`. A successful operation on a different row calls `load()`, which replaces that list. When an unresolved DELETE has already committed, that refresh removes its row and its only receipt-recovery button. Its operation remains in the Map, keeping Close/Escape blocked. The retained removal confirmation also has both buttons disabled. Per-row isolation allows the second operation, and its PATCH uses its own grant revision (`server/boards/grants.ts:94-106`), so the first deletion does not prevent this interleaving.

**Reproduction:** Start with grants A and B. Commit DELETE A, hide its mutation response and fail its first receipt lookup. Change B's role and save successfully. The authoritative refresh removes A; no A recovery control remains, while the dialog stays pending. This also occurs if B was already in flight and completes after A becomes uncertain.

**Fix:** Render unresolved operation recovery independently of the authoritative grant list, retaining the original immutable operation identity and a readable target description. Alternatively reconcile all pending operations before removing their recovery UI. Do not discard an uncertain operation merely because a grant disappears. Add a two-row regression with lost DELETE A acknowledgment and successful PATCH B, then restore receipt lookup and verify A can reconcile, each mutation ran once with its original ID, server grants are exact, and Close/Escape become usable.

**CR-08 closure evidence at `b4877ce`:** `src/boards/ShareBoardDialog.tsx:75-77` handles receipt 401/403/404/409 by clearing operation state, aborting the dialog lifetime and invoking parent refresh/close before throwing. The outer catch observes the aborted lifetime and cannot retry the mutation or restore stale error state. Concurrent requests share that lifetime; abort cancels them. Transient failures still retain their original operation for reconciliation. Tests at `tests/board-sharing.spec.ts:106-126` cause genuine server receipt responses after synthetic session expiry, account reassignment or database board deletion, and assert exact 401/409/404, removed dialog, a single POST and unchanged stored receipt/grants. The deletion is injected at the repository boundary; the test does not claim a second-session UI deletion. The identical 403 branch is source-verified.

**CR-09 closure evidence at `b4877ce`:** The operation captures its recipient at creation (`src/boards/ShareBoardDialog.tsx:86`), and lines 159-162 render missing-row operations independently of the authoritative grants list. Each recovery button uses the retained method/path/body and the existing Map entry's ID, with per-key busy protection and an associated visible error. Filtering excludes currently rendered grant rows, avoiding duplicate recovery controls/description IDs. Successful reconciliation deletes only that operation and clears the removal confirmation through the existing completion path. The two-row test at `tests/board-sharing.spec.ts:128-147` commits DELETE A with lost acknowledgment, saves B, checks recovery remains reachable after B's authoritative Editor state appears, then reconciles A. It asserts Close enabled, exactly one DELETE, one stored operation and exact remaining B/editor grant state. Existing three-method tests retain original-ID, mutation-count and dismissal/focus assertions.

**Independent conclusion:** Both control-flow defects are resolved. No introduced gap was proved in the narrow remediation. The reviewer performed source/oracle inspection only. The fixer reports both bugs RED before the change, both static checks passing and the complete 18/18 production sharing suite passing in 53.2s; execution remains attributed to that fixer.

## Bounded sharing and shared-fixture review

- Reviewed `7c8982c` sharing component and complete sharing tests, the accessibility locator delta, and receipt authorization, grant revision and global session consumers. Immutable operation method/path/body/ID survive retries; per-key active request guards prevent duplicate concurrent requests. Transient uncertainty preserves identity and blocks premature close. Approved pending-member, owner/link, success and clipboard-failure copy and associated error descriptions are present. No additional copy/ARIA defect was proved in this bounded delta.
- Reviewed all eight file deltas in `995ec47`. The shared proxy extracts the previously reviewed HTTP/HMR behavior and six isolated suites install its socket cleanup before closing their servers. The empty-library case now uses its own real synthetic OIDC/database service and updates all requests to that origin; original empty/create/foreign-target/nonmutation assertions remain. Recovery waits for exactly one native root after authentication and reload while retaining exact model and image-byte comparisons. No fixture defect or weakened oracle was proved.
- Parent-reported evidence: all three sharing methods demonstrated RED before correction; 14/14 production sharing cases passed in 47s with both typechecks. Fixture evidence is 107/108 dev followed by the corrected focused 4/4, not a complete full-matrix pass. These are executor-attributed results; that review found the two recovery gaps above, subsequently closed at `b4877ce`.
- The review pins these commits. Concurrent UI fixer edits and subsequent commits require a separate delta review. No current working-tree change is treated as final acceptance evidence.

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

## Acceptance-fixture delta review

The two-file test-only commit `1a55d14` was read in full and traced into the unchanged error collector, configured HTTP dev/production origins and native image cancellation path. No introduced defect or weakened protected-state oracle was found.

- `tests/access-fixtures.ts:35-63` forwards actual `vite-hmr` WebSocket upgrades to the configured fixture asset origin, preserving request headers, upstream upgrade response headers and buffered data in both directions. It rejects other upgrade protocols, destroys sockets on transport failure/non-upgrade response, tracks both peers and destroys them before service closure. The configured origins are loopback HTTP, matching `node:http`. Production assets do not request HMR; protected API routing and OIDC authorization remain unchanged. The identity-context console/page-error collector is still strict.
- `tests/board-access.spec.ts:155-197` permits the specific `console: Error: Account source is stale` cancellation only after marking the injected denial phase. Before adding that allowance it asserts no stale cancellation, no unexpected collected error and no pageerror. It retains loading/missing-image/retry checks and the original denied heading, removed editor, removed blob-image and absent canary-text predicates. After denial it again asserts no pageerror and checks every observed stale console message occurred in the marked phase.
- The source trace supports classifying that message as a handled cancellation: native `ImageEdgelessBlock.refreshData` calls `refreshData(this).catch(console.error)`; its helper awaits resource refresh; `BoardBlobSource.assertCurrent` revokes URLs and throws the stated error on disposed/aborted/stale scope. This allowance does not establish real-provider revocation; the test injects the protected-resource denial response. Existing server/role suites retain real grant-removal checks.
- The automatic fixture at `tests/fixtures.ts` continues to collect all errors and reject unmatched messages after the test. No global suppression or listener removal was introduced. The expected message is a specific console prefix under the existing substring-matching contract, rather than an allowance for arbitrary stale errors or pageerrors.
- The parent reports both typechecks and 16 focused dev cases passing in 41s. These execution claims are attributed to the executor; this reviewer ran no tests or services. The first full dev run exposed fixture HMR handshake errors, and the complete 1462-case matrix is reported rerunning. Selection and focused passes do not establish full-matrix completion.

## Coverage, evidence limits and deltas

- The original standard-depth review read all 92 listed files. This rereview preserves the full scope and rereads all 19 remediation files, plus relevant consumers and native ZIP-transformer code. No scope was dropped.
- Commits reviewed: `8654e1c`, `536f5d3`, `b1b262b`, `19528cd`, `2cfd25c`, `f635a62`, `46a8402`, `12a2184`.
- Prior reviewed test deltas `f7be2f8` and `1d3c9cb` remain included in the cumulative scope.
- No structural pre-pass was supplied.
- The fix report's “requires human verification” label is role-mandated wording. Its automated semantic assertions directly address the original defects. Independent source review establishes corrected control flow/contracts, while execution results remain attributed to the fix executor. Neither establishes actual-provider or native OS acceptance.
- Final delta `033ecc0` was reviewed in all three affected source/test files, retaining the full 92-file scope. The accepted `docs/access-acceptance.md` change from `7360be0` describes the implemented writable-board/private-copy archive flow, retry/reconciliation and private evidence handling.
- The `7360be0` checkpoint and tracking changes correctly attribute 2/2 smoke, 102 unit, 110 server and 110 access results to `12a2184`. They explicitly record that the full browser matrix had **not started** at that handoff, distinguish 1452 selected cases from executed cases, and keep Plan 12, Phase 3 and actual-provider/native acceptance open. The launcher termination is not represented as a failed access suite or completed final gate. No inconsistency was found against the supplied gate facts.
- The full suite previously selected 1462 cases. Its final pass/fail/skip counts must be recorded against the final executor run and implementation; neither selection nor focused passes establishes completion. The earlier checkpoint's 1452 count is historical.
- The earlier inspection at `d65a469` included a security-report-only follow-up. This bounded review now pins fixture `995ec47`, sharing `7c8982c`, its remediation `b4877ce` and final UI package `8320dd1`; later UI changes, security report reconciliation and final acceptance artifacts remain assigned to their owners and require current evidence.
- Untracked planning/operator and image assets remain outside the pinned source scope and were preserved.
- This reviewer changed only this report and performed no implementation/test edits, commits or runtime validation during rereview.

_Reviewer: gsd-code-reviewer_
_Reviewed: 2026-09-16T22:03:02Z_
