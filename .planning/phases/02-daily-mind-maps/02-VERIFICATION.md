---
phase: 02-daily-mind-maps
verified: 2026-09-28T14:47:14.607147+00:00
status: passed
refresh_status: passed
candidate_worktree_changes: true
candidate_source_head: 5aefe81d00ca618c2985c8a4801131cdcb6044e6
score: 4/4 Phase 2 requirements verified and user-approved
covered_files:
  - ".planning/REQUIREMENTS.md"
  - ".planning/phases/02-daily-mind-maps/02-01-PLAN.md"
  - ".planning/phases/02-daily-mind-maps/02-01-SUMMARY.md"
  - ".planning/phases/02-daily-mind-maps/02-02-PLAN.md"
  - ".planning/phases/02-daily-mind-maps/02-02-SUMMARY.md"
  - ".planning/phases/02-daily-mind-maps/02-03-PLAN.md"
  - ".planning/phases/02-daily-mind-maps/02-03-SUMMARY.md"
  - ".planning/phases/02-daily-mind-maps/02-04-PLAN.md"
  - ".planning/phases/02-daily-mind-maps/02-04-SUMMARY.md"
  - ".planning/phases/02-daily-mind-maps/02-05-PLAN.md"
  - ".planning/phases/02-daily-mind-maps/02-05-SUMMARY.md"
  - ".planning/phases/02-daily-mind-maps/02-06-PLAN.md"
  - ".planning/phases/02-daily-mind-maps/02-06-SUMMARY.md"
  - ".planning/phases/02-daily-mind-maps/02-07-PLAN.md"
  - ".planning/phases/02-daily-mind-maps/02-07-SUMMARY.md"
  - ".planning/phases/02-daily-mind-maps/02-08-PLAN.md"
  - ".planning/phases/02-daily-mind-maps/02-08-SUMMARY.md"
  - ".planning/phases/02-daily-mind-maps/02-09-PLAN.md"
  - ".planning/phases/02-daily-mind-maps/02-09-SUMMARY.md"
  - ".planning/phases/02-daily-mind-maps/02-UAT.md"
  - ".planning/phases/02-daily-mind-maps/02-UI-SPEC.md"
  - ".planning/phases/02-daily-mind-maps/02-VALIDATION.md"
  - ".planning/quick/260915-canvas-interactions/SUMMARY.md"
  - ".planning/quick/260915-topic-editing-new-board/SUMMARY.md"
  - "src/boards/operations.ts"
  - "src/canvas/BlockSuiteCanvas.tsx"
  - "src/canvas/LayersInspector.tsx"
  - "src/canvas/MindMapInspector.tsx"
  - "src/canvas/ObjectContextMenu.tsx"
  - "src/canvas/SelectionInspector.tsx"
  - "src/canvas/ViewportControls.tsx"
  - "src/canvas/account/acknowledged-update.ts"
  - "src/canvas/account/blob-source.ts"
  - "src/canvas/account/board-workspace.ts"
  - "src/canvas/account/doc-source.ts"
  - "src/canvas/account/outbox.ts"
  - "src/canvas/account/recovery.ts"
  - "src/canvas/account/title-intent.ts"
  - "src/canvas/arrangement.ts"
  - "src/canvas/blocksuite-editor.ts"
  - "src/canvas/canvas-affordances.ts"
  - "src/canvas/extensions.ts"
  - "src/canvas/mindmap-compatibility.ts"
  - "src/canvas/mindmap-export.test.ts"
  - "src/canvas/mindmap-export.ts"
  - "src/canvas/mindmap-keyboard.ts"
  - "src/canvas/mindmap-node-copy.ts"
  - "src/canvas/mindmap-state.test.ts"
  - "src/canvas/mindmap-state.ts"
  - "src/canvas/mindmap.ts"
  - "src/canvas/object-actions-toolbar.ts"
  - "src/canvas/presentation-export.ts"
  - "src/canvas/runtime.ts"
  - "src/canvas/selection-summary.ts"
  - "src/canvas/shape-text-editor.ts"
  - "src/header/DaliMenu.tsx"
  - "src/header/ExportDialog.tsx"
  - "src/index.css"
  - "tests/board-roles.spec.ts"
  - "tests/browser-fixtures.ts"
  - "tests/canvas-arrangement.spec.ts"
  - "tests/canvas-editing.spec.ts"
  - "tests/canvas-feedback.spec.ts"
  - "tests/clipboard-route.ts"
  - "tests/fixtures.ts"
  - "tests/image-visual-edits.spec.ts"
  - "tests/mindmap-accessibility.spec.ts"
  - "tests/mindmap-collapse.spec.ts"
  - "tests/mindmap-compatibility.spec.ts"
  - "tests/mindmap-copy.spec.ts"
  - "tests/mindmap-edit-format.spec.ts"
  - "tests/mindmap-export.spec.ts"
  - "tests/mindmap-formatting.spec.ts"
  - "tests/mindmap-keyboard.spec.ts"
  - "tests/mindmap-layout.spec.ts"
  - "tests/mindmap-lock.spec.ts"
  - "tests/mindmap-node-copy.spec.ts"
  - "tests/mindmap-properties.spec.ts"
  - "tests/mindmap-properties.ts"
  - "tests/mindmap-visibility.spec.ts"
  - "tests/mindmap-workflow.spec.ts"
  - "tests/mindmap.spec.ts"
  - "tests/object-actions-submenu.spec.ts"
  - "tests/object-actions.ts"
  - "tests/restored-viewer.spec.ts"
  - "tests/save-status.spec.ts"
  - "tests/session-recovery.spec.ts"
  - "tests/shape-text-lifecycle.spec.ts"
  - "tests/topic-focus-new-board.spec.ts"
  - "vite.config.ts"
covered_digest: v1:sha256:3105ba9a55b1a5d85a27f07eed8001f8cde91af8a490ffa11315f91497826e6a
behavior_unverified: 0
overrides_applied: 0
human_verification: []
human_acceptance:
  date: 2026-09-15
  source: "Phase 2 tested and approved."
  scope: Phase-wide user acceptance; per-environment details not separately reported
refresh_source_head: 5aefe81d00ca618c2985c8a4801131cdcb6044e6
refresh_browser_passed: 1960
---

## Current prerequisite verification refresh — 2026-09-28

**Passed on source/test revision `5aefe81d00ca618c2985c8a4801131cdcb6044e6`:** complete `npm run test:browser`, **1,960 selected / 1,960 passed / zero failed / zero skipped**, approximately 1.8 hours. Projects: development Chromium 463, production Chromium 457, Firefox 457, WebKit 457, access Chromium 126. Production build is included. Standalone `npm run test:access` also passed **126/126** in this resumed run. Both TypeScript checks passed after the final fixture corrections.

Client units **233/233** and serialized server tests **311/311** passed on unchanged application source at `5388e7b`; later commits modified browser fixtures and planning evidence only. The fresh full browser run includes all restored Viewer, native read-only lifecycle, save coverage, account-transition, image retry and prior-phase behavior regressions. The synthetic hydration/cancellation fixture corrections passed another 56 focused/repeated cases before the full run.

Historical user acceptance and approved deferrals remain unchanged. This refresh supersedes the earlier stale/needs-human prerequisite halt after the user explicitly resumed execution. Current fingerprints include shared runtime and browser fixture dependencies; actual working-tree content is hashed, including pre-existing user changes to package metadata/documentation where already covered. Those unrelated changes were preserved and are not included in the correction commits. Phase 4 requirement acceptance remains a separate pending gate.

Earlier dated results below retain their original revision scope.


# Phase 2: regression refresh pending — 2026-09-27

**Current refresh disposition: STALE — pending complete regression evidence.** The frontmatter verification date, status, score and digest retain the earlier acceptance record. They do not certify the current candidate. The canonical status remains stale while covered inputs differ; no new passing verdict or fingerprint has been issued.

39 of 76 previously covered files changed since recorded baseline `aec5311`, including native editing, account workspace integration, shared controls and mind-map regression fixtures. These counts were collected before the current refresh corrections. All previously listed covered files exist. The user's Phase 2 approval remains accepted, including the resolved interaction corrections. Individual native input, browser and magnification details retain their original reporting limits.

The current committed candidate is `e906986`; its complete regression gate is pending. Source review covered the cold Viewer title-projection correction and the corrections exposed during this refresh. `664122c` makes New available to eligible system members viewing a read-only source board; creation retains its active-scope guard and server identity/system-permission checks. `fca7d1e` lets the role-test setup explicitly accept the existing Account changed route after replacing synthetic identity cookies, while asserting the old editor is absent and retaining the independent owner request used for source-preservation checks.

## Chronological refresh evidence

Entries retain their original revision and observation time. The final prerequisite-refresh disposition below supersedes intermediate running or pending statements.

- Both TypeScript checks passed. The orchestrator reported 195/195 unit tests passed on the initial candidate.
- The first server attempt encountered sandbox loopback restrictions. A later parallel run reached 309 passes and one restore timeout at the default five-second limit; the isolated restore suite passed 11/11. The complete serialized server run passed 310/310 in 170.57 seconds. These are distinct attempts.
- The first complete browser attempt stopped with 56 passed, one failed, one interrupted and 1,862 unrun cases. It exposed the New-board visibility regression. The correction passed 12 focused permission cases across development Chromium and production Chromium, Firefox and WebKit, plus both static checks.
- The second complete browser attempt reached 66 passes before the role-fixture account-change setup failed. The explicit recovery-route correction passed eight focused Owner/Editor cases across those four projects.
- The third complete browser attempt selected 1,920 cases and ended with 211 passed, three failed, one interrupted and 1,705 unrun. Subsequent test corrections updated stale save-status labels, the storage-pause recovery flow and the explicit account-switch route while retaining behavioral assertions.
- The targeted legacy regression rerun passed 22/24 cases. The two WebKit failures were strict page-error failures in image import and sticky-shadow reload tests; content assertions passed. Repeated diagnostic execution reproduced late document pushes after beforeunload and before pagehide, with the request signal still active.
- Source tracing identified duplicate submission: recovery first acknowledged the captured native update, then the waiting native source submitted it again. The working-tree correction omits that second transport only when a fully integrated, confirmed Yjs snapshot covers the exact submitted operations and deletes, with current writable account/board/generation and unchanged recovery epoch. Unit coverage checks newer/independent operations, deletes, unresolved state, malformed input, normal submission fallback, and scope/epoch/abort rejection.
- The orchestrator reported **206/206 unit tests**, both TypeScript checks and **10/10 repeated WebKit reload cases** passed with this correction, committed as `c52bf29`. The fourth complete browser attempt on that candidate ended with **323 passed, eight failed, one interrupted and 1,588 unrun**. Confirmed fixture/selector corrections preserve sharing epochs, scope mind-map alerts, compare settled save-state geometry and remove a race with automatic retry from the library acknowledgment check.
- The 50-topic case reached its Saved checkpoint after completing its geometry assertions, then exposed a real replay backlog: approximately **4,144 journal rows / 256 KiB**, successful server responses, and repeated 30-second recovery timeouts. The correction committed as `635ce88` batches compatible document updates with bounded record/byte counts, atomically acknowledges exact captured IDs, merges checkpoint updates once per document, and coalesces status-preservation checks while retaining synchronous capture.
- The orchestrator reported **214/214 unit tests** and successful focused 50-topic Saved/reload/exact-geometry checks in **all four browser projects**, each requiring fewer than 100 pushes: development Chromium 38.3 seconds, production Chromium 33.0 seconds, Firefox approximately 78 seconds, and WebKit 58.1 seconds. Both TypeScript checks and **48/48 focused correction cases across all four browser projects** passed. The fifth complete matrix on `635ce88` ended with **381 passed, three failed, one interrupted and 1,535 unrun**.
- That attempt exposed two product gaps: the active Viewer branch hid the approved warning for retained pending changes, and generic navigation preservation could lose the explicit logout intent before the sign-out flow ran. The correction preserves ordinary read-only feedback, adds authorized account/board-scoped pending metadata with an explicit unavailable state, and delegates logout preservation to its owning flow while retaining leave confirmation and native warning behavior. Failed-replay assertions now use the current status label and a controlled acknowledgment barrier.
- The orchestrator reported **44/44 Viewer and leave-navigation cases**, **12/12 session-recovery correction cases**, **218/218 unit tests**, and both TypeScript checks passed. Five new Viewer metadata cases increased the complete matrix to **1,940 cases**. The complete run on committed candidate `a3a8020` ended with **1,921 passed, 19 failed and zero skipped**, taking approximately **1.6 hours**. This is completed failing evidence; the regression refresh remains **STALE** pending correction and successful complete validation. Focused passes and earlier interrupted attempts are not combined into a complete-matrix pass.
- The candidate now includes uncommitted fixture and test corrections: shared HTTP/WebSocket asset proxying for synthetic durability services; local-recovery geometry polling, scoped authorization checks and explicit keyboard focus; keyboard retry activation; and exact-byte retained-record checks with a separate restore-quarantine baseline. Their application does not establish passing runtime evidence. Firefox native lifecycle console errors and WebKit session-request access-control errors remain under diagnosis. The historical verification fields and canonical fingerprint remain unchanged.
- The interim candidate head is `bf02db0`, with fixture and test changes still uncommitted. The orchestrator reported successful `npm run typecheck` and `npm run typecheck:server`, **219/219 unit tests across 20 files**, and **4/4 focused Firefox/WebKit recovery-keyboard cases**. A disposed/stale coordinator authorization regression was observed failing before the guard and passing afterward. These results establish targeted correction evidence only.
- The **116-case cross-engine focused run** ended with **109 passed and seven failed**: four loading-focus fixture cases, one logout-confirmation branch, and two WebKit session-request errors after Saved. The focus correction retains a trusted click before explicitly focusing the target; the logout test accepts the existing leave confirmation before exercising preservation. The native document callback now recognizes exact previously acknowledged update coverage before starting recovery authorization, with active writable scope and unchanged epoch checks, while retaining fresh authorization for uncovered data.
- The subsequent **36-case targeted run passed all 36 cases**, covering the remaining failures across all four browser projects plus durable restart and the different-account recovery case omitted from the earlier selection. Source corrections are committed in `69058bc` and fixture corrections in `e906986`, following `bf02db0`. The complete browser attempt on `e906986` stopped after **437 passed, two failed, one interrupted and 1,500 not run**, taking approximately **16.7 minutes**. Both static checks, **219/219 unit tests**, and **310/310 serialized server tests** passed on that candidate.
- The two browser failures exposed title-revision freshness during native document commits and title-focus restoration after intervening editing. Subsequent uncommitted corrections address the keyboard event boundary, recovery completion status, scoped descriptor freshness, and proven own document revision transitions while preserving independent title conflicts. The orchestrator reported a subsequent **48/48 targeted pass** on the working fixes. Additional persistence-concurrency review and tests remain in progress. The required complete regression gate remains **pending**; no new complete-matrix pass or canonical fingerprint is recorded.

- Corrections were committed at `d0958e1` after both static checks, **233/233 client unit tests** and **311/311 serialized server tests** passed. Storage-concurrency tests cover delayed and failed persistence plus another tab replacing a pending intent. Crash-boundary assertions now check transaction revision receipts. The complete **1,948-case browser matrix** is running on that unchanged source; no complete passing verdict is recorded yet.

This section is a regression-refresh progress record. Historical audits, their revision-specific counts and accepted human dispositions remain below. Pending automated evidence does not reopen approved product scope or manufacture a new human acceptance requirement.

---

# Phase 2: Daily Mind Maps — Verification

Goal: Users can develop and reorganize readable mind maps through rapid keyboard editing and automatic hierarchical layout.

Status: **passed**. All nine plans are implemented, all four Phase 2 requirements have behavioral evidence, and the user approved the phase on 2026-09-15. All six reported gaps are resolved. Phase 3 is ready for planning.

Verified implementation HEAD: `aec5311` (includes the interaction correction `877650d` and header logo `7cab9ea`).

Refresh method: reviewed the subsequent native editing/focus changes and their focused cross-browser evidence, refreshed the requirement-linked production regressions, and recorded the user's phase-wide approval. Earlier broad-suite counts retain their original revision scope. Browser/OS/IME details were not separately supplied with approval.

Method: Inline orchestrator goal-backward verification using the GSD verifier role and report contract. The session agent limit prevented a fresh verifier dispatch; no independent typed-verifier run is claimed. Source, wiring, actual test assertions and execution logs were inspected. Code/UI reviewers reused executor threads with the independence limits stated in their reports.

## Roadmap and requirements

| Requirement / roadmap criterion | Outcome | Implementation and behavioral evidence |
|---|---|---|
| MIND-01 — hierarchical creation/editing with child/sibling shortcuts | VERIFIED + user-approved | Native store/view registration, insertMindmap/addTopic and scoped keyboard installation. Exact parent/ID/count, text exit, repeat/stale guards, copy independence and local reopen cases. |
| MIND-02 — collapse/expand preserves descendants | VERIFIED | Validated native topology, full child-detail preservation, history snapshots and effective visibility. Nested flags, text, style, identities, Undo/Redo and copy/reload assertions. |
| MIND-03 — layout adapts to nodes and visibility | VERIFIED + user-approved | Native measured fitting and layout with retained root, direction and lifecycle guards. 7/50-topic fixtures, multiline/add/delete/toggle/direction cases and failure/retry snapshots. |
| MIND-04 — text and branch styling | VERIFIED | Topic size/weight/color validation, four native map styles, retained explicit typography. Exact international labels, style/history/copy/reload and decoded PNG assertions. |

MIND-05 belongs to Phase 5. Same-browser local persistence and simulated clipboard routes do not establish concurrent or cross-browser service durability.

## Plan truths

The 31 recorded truths from plans 02-01 through 02-07 are retained below; plans 02-08/09 have dedicated correction sections. The four roadmap criteria above aggregate them; they are not counted twice.

| Plan / truth | Observable truth | Status | Evidence |
|---|---|---|---|
| 02-01/1 | Add mind map creates one editable native root at the current viewport center; two deliberate invocations create independent maps. | VERIFIED | `mindmap.spec.ts; mindmap-compatibility.spec.ts` — active value and multi-step behavior assertions. |
| 02-01/2 | A root, child and sibling render with native connectors, reopen in the same browser and appear in a real whole-board PNG. | VERIFIED | `mindmap.spec.ts; mindmap-compatibility.spec.ts` — active value and multi-step behavior assertions. |
| 02-01/3 | Compatibility evidence proves explicit font formatting survives layout and collapse plus queued layout is one undoable action before expansion begins. | VERIFIED | `mindmap.spec.ts; mindmap-compatibility.spec.ts` — active value and multi-step behavior assertions. |
| 02-02/1 | Native object duplicate and clipboard paste preserve complete hidden descendants and remap canvas IDs independently within the destination document. | VERIFIED | `mindmap-copy.spec.ts` — active value and multi-step behavior assertions. |
| 02-02/2 | Board copy retains the native snapshot route and creates a distinct document; reused document-local surface IDs do not share mutable state. | VERIFIED | `mindmap-copy.spec.ts` — active value and multi-step behavior assertions. |
| 02-02/3 | Editing, styling or expanding any copy leaves source content, hierarchy and collapsed state unchanged. | VERIFIED | `mindmap-copy.spec.ts` — active value and multi-step behavior assertions. |
| 02-03/1 | One creation key gesture adds exactly one intended child or sibling; held keys and duplicate listeners do not create additional topics. | VERIFIED | `mindmap-keyboard.spec.ts; mindmap-collapse.spec.ts; mindmap-state.test.ts` — active value and multi-step behavior assertions. |
| 02-03/2 | Text editing, composed IME input, external controls, multi-selection and Shift+Tab retain their own focus behavior and create zero unintended topics. | ACCEPTED — user phase-wide UAT | `mindmap-keyboard.spec.ts; mindmap-collapse.spec.ts; mindmap-state.test.ts` — automated routing/CSS zoom passed; phase-wide acceptance received, individual native environments not separately reported. |
| 02-03/3 | Interrupted or superseded local commands cannot mutate a detached, readonly or locked map; deliberate sequential commands create distinct valid topics. | VERIFIED | `mindmap-keyboard.spec.ts; mindmap-collapse.spec.ts; mindmap-state.test.ts` — active value and multi-step behavior assertions. |
| 02-03/4 | Collapse/expand retains every descendant ID, text, style, parent/order and nested collapsed flag; one Undo/Redo restores the complete prior/next state. | VERIFIED | `mindmap-keyboard.spec.ts; mindmap-collapse.spec.ts; mindmap-state.test.ts` — active value and multi-step behavior assertions. |
| 02-04/1 | Hidden descendants cannot be hit, marquee-selected, keyboard-selected or selected through Layers. | VERIFIED | `mindmap-visibility.spec.ts` — active value and multi-step behavior assertions. |
| 02-04/2 | Collapsing redirects affected focus to the visible ancestor; expansion preserves that selection. | VERIFIED | `mindmap-visibility.spec.ts` — active value and multi-step behavior assertions. |
| 02-04/3 | Whole-map movement and native hierarchy-safe deletion retain all hidden content; Undo restores the complete subtree. | VERIFIED | `mindmap-visibility.spec.ts` — active value and multi-step behavior assertions. |
| 02-04/4 | Grouping and alignment cannot orphan topic shapes; ordinary canvas operations retain their accepted behavior. | VERIFIED | `mindmap-visibility.spec.ts` — active value and multi-step behavior assertions. |
| 02-05/1 | Additions, text growth, deletions and collapse/expand automatically rearrange visible topics with correct parent connectors and no sibling text overlap. | VERIFIED | `mindmap-layout.spec.ts; mindmap-formatting.spec.ts; mindmap-accessibility.spec.ts` — active value and multi-step behavior assertions. |
| 02-05/2 | Right, Left and Balanced layouts retain the root anchor and unrelated object positions, including after reload and undo/redo. | VERIFIED | `mindmap-layout.spec.ts; mindmap-formatting.spec.ts; mindmap-accessibility.spec.ts` — active value and multi-step behavior assertions. |
| 02-05/3 | Selected-topic font size, weight and text color survive later edits, relayout, presets, collapse, copying and reload. | VERIFIED | `mindmap-layout.spec.ts; mindmap-formatting.spec.ts; mindmap-accessibility.spec.ts` — active value and multi-step behavior assertions. |
| 02-05/4 | Four native map presets style connecting branches while preserving hierarchy, collapse flags and explicit topic overrides. | VERIFIED | `mindmap-layout.spec.ts; mindmap-formatting.spec.ts; mindmap-accessibility.spec.ts` — active value and multi-step behavior assertions. |
| 02-05/5 | Formatting without a selected topic is disabled; root-only maps and empty labels remain editable and can be formatted. | VERIFIED | `mindmap-layout.spec.ts; mindmap-formatting.spec.ts; mindmap-accessibility.spec.ts` — active value and multi-step behavior assertions. |
| 02-05/6 | Emoji, combining marks, CJK and RTL labels retain their exact native text sequence through formatting and layout; measured geometry, rather than byte length, determines fitting. | VERIFIED | `mindmap-layout.spec.ts; mindmap-formatting.spec.ts; mindmap-accessibility.spec.ts` — active value and multi-step behavior assertions. |
| 02-05/7 | Keyboard focus and all mind-map controls remain reachable on narrow or magnified views with readable labels and actionable errors. | ACCEPTED — user phase-wide UAT | `mindmap-layout.spec.ts; mindmap-formatting.spec.ts; mindmap-accessibility.spec.ts` — automated routing/CSS zoom passed; phase-wide acceptance received, individual native environments not separately reported. |
| 02-06/1 | Board and frame PNGs contain current visible topics and branches, with collapsed descendants excluded from counts, bounds, allocations and pixels. | VERIFIED | `mindmap-export.spec.ts; mindmap-export.test.ts; mindmap-workflow.spec.ts; image-export.spec.ts` — active value and multi-step behavior assertions. |
| 02-06/2 | Selected-map PNG includes its visible hierarchy; selected-topic PNG includes only selected visible topics and native branch edges whose two endpoints are included. | VERIFIED | `mindmap-export.spec.ts; mindmap-export.test.ts; mindmap-workflow.spec.ts; image-export.spec.ts` — active value and multi-step behavior assertions. |
| 02-06/3 | Unselected sibling topics/branches, hidden descendants and interaction badges cannot appear in selected-topic output, including overlapping geometry. | VERIFIED | `mindmap-export.spec.ts; mindmap-export.test.ts; mindmap-workflow.spec.ts; image-export.spec.ts` — active value and multi-step behavior assertions. |
| 02-06/4 | Existing ordinary selected-connector/group rules, exact frame clipping, 1x/2x/4x scale and white/transparent backgrounds remain intact. | VERIFIED | `mindmap-export.spec.ts; mindmap-export.test.ts; mindmap-workflow.spec.ts; image-export.spec.ts` — active value and multi-step behavior assertions. |
| 02-06/5 | A stale export or resource-limit failure creates no successful download, preserves map state and offers the existing explicit retry/lower-scale path. | VERIFIED | `mindmap-export.spec.ts; mindmap-export.test.ts; mindmap-workflow.spec.ts; image-export.spec.ts` — active value and multi-step behavior assertions. |
| 02-06/6 | Users can complete create, edit, style, collapse, copy, reopen and export in the existing canvas while the Phase 1 regression gate passes. | VERIFIED | `mindmap-export.spec.ts; mindmap-export.test.ts; mindmap-workflow.spec.ts; image-export.spec.ts` — active value and multi-step behavior assertions. |
| 02-07/1 | Creating/selecting topics and Tab never automatically open Properties. | VERIFIED | mindmap-properties.spec.ts checks root, child, commit and reselection with panel absent. |
| 02-07/2 | Explicit contextual Properties opens the shared right-side inspector. | VERIFIED | Actual right-click, Object actions and keyboard menu gestures; sidebar class and geometry assertions. |
| 02-07/3 | Closing and editing retain dismissal until another explicit request. | VERIFIED | Close, double-click editing, Add child, commit and reselect lifecycle assertions. |
| 02-07/4 | Formatting and hierarchy retain content and history. | VERIFIED | Explicit font value assertion and complete formatting, layout, collapse, copy and workflow matrix. |

## Artifacts and wiring

| Artifact / connection | Result |
|---|---|
| extensions.ts → blocksuite-editor.ts → mounted editor | Native mind-map model/view extensions are registered through existing scopes. Substantive and wired. |
| BlockSuiteCanvas.tsx → insertMindmap / installMindmapCompatibility / installMindmapShortcuts | Accessible add control, current-host installation and effect disposal. Substantive and wired. |
| MindMapInspector.tsx → mindmap.ts → native model/history | Child/sibling/collapse/layout/style/format controls call guarded mutations. Substantive and wired. |
| mindmap-compatibility.ts → mindmap-state.ts | Shared topology checks at conversion and native operation boundaries, scoped callbacks/history preservation. Substantive and wired. |
| arrangement.ts / LayersInspector.tsx → selection-summary.ts | Effective visibility and hierarchy ownership protect selection and operations. Substantive and wired. |
| boards/operations.ts → native snapshot transformer | Independent copied document retains native hierarchy. Substantive and wired. |
| ExportDialog.tsx → presentation-export.ts → mindmap-export.ts → mindmap-state.ts | Frozen visible membership and eligible edges drive bounded, revision-guarded native PNG rendering. Substantive and wired. |

Properties wiring: SelectionInspector → ObjectContextMenu current-selection action → current-host `dali:mindmap-properties` event → MindMapInspector explicit open state. Keyboard routing gives external menus/sidebar ownership of their own keys. Shared SelectionInspector CSS establishes right-side dimensions; mounted-panel framing preserves selected-topic visibility.

## Test quality and execution

- UAT correction `28329b3`: **392/392 mind-map browser cases**, **40/40 production ordinary/keyboard regressions**, **67/67 unit tests**, typecheck and build passed. Synthetic desktop/narrow screenshots were inspected. See 02-07-SUMMARY.md for RED/GREEN provenance.


- Full implementation gate at `e52dab1`: **604/604 browser cases** in 13.6 minutes across dev, production Chromium, Firefox and WebKit; **67/67 unit cases**, typecheck and production build passed.
- Focused prior-phase export regression: **23 unit and 18 browser cases passed**.
- Post-review `a5c6f8d`: **68/68 copy cases** across four projects and **67/67 unit tests**, typecheck/build passed.
- Post-review `a05b94d`: **36/36 accessibility cases** across four projects and **25/25 production canvas/image/keyboard regressions**, typecheck/build passed. Synthetic desktop/narrow captures were inspected.
- Post-review corrections have separate focused evidence in 02-REVIEW.md and 02-UI-REVIEW.md. The 604-case result precedes those corrections; it is not relabeled as a full-suite run on the final revision.

| Test family | Requirements | Active / skipped | Assertion strength | Quality outcome |
|---|---|---|---|---|
| creation, keyboard, copy | MIND-01/02 | Active; zero skipped | Exact counts/parents/text, unchanged source, independent edits, rejected stale mutation | Behavioral |
| collapse, state, visibility | MIND-02/03 | Active; zero skipped | Full content snapshots, hidden hit/Layers exclusion, malformed topology, bounded traversal | Behavioral |
| layout, formatting, accessibility | MIND-01–04 | Active; zero skipped | Measured geometry/root tolerance, explicit text values, focus/contrast/targets, failure/retry | Behavioral; native OS and real zoom limits explicit |
| export, workflow | MIND-01–04 | Active; zero skipped | Decoded PNG colors/bounds/clipping/exclusions and complete edit/copy/reopen/export | Behavioral |

No requirement-linked skip/todo or generated expected-output fixture was found. PNG writes save observed output for visual inspection; assertions use independent membership, geometry and color predicates. Native branch-style comparisons prove adapter consistency with the pinned renderer; decoded pixels and four distinguishable presets provide additional output evidence. Synthetic payload routes in Firefox/WebKit remain explicitly limited.

## Review and scope decisions

- CR-01: copy order/depth validation discrepancy found by adversarial review; correction and RED/GREEN evidence recorded in 02-REVIEW.md.
- UI topic occlusion, duplicate inspector and action-button collision findings: corrected in `a05b94d`; viewport evidence in 02-UI-REVIEW.md. Remaining advisory items concern style guidance, accent-role wording and inherited narrow header clipping.
- The two unclassified planning probe markers received explicit semantic classifications in 02-VALIDATION.md: descendant preservation/reversibility and geometry/lifecycle. Original plan markers remain for provenance.
- No phase CONTEXT.md or locked D-NN decisions exist. The approved plans provide defaults and acceptance boundaries. No requirement override or risk acceptance was invented.
- Security register and remaining evidence limitations are recorded in 02-SECURITY.md and WINDOWS.md. The phase register has 23 plan-qualified rows (21 distinct IDs).
- Grid/guideline/snapping, proximity distances/alignment and branding seeds retain their separate deferred scope.

No unresolved functional review blocker remains. Phase-wide user approval on 2026-09-15 closes the acceptance gate.

## User acceptance — 2026-09-15

The user stated **"Phase 2 tested and approved."** The UAT record closes all five checklist items and all six reported gaps on that phase-wide acceptance. Native IME, actual 200% browser zoom and Firefox/WebKit OS clipboard environments were not individually reported; retain that evidence granularity alongside the existing automated routing, viewport and payload tests. No new per-browser native execution claim is made.

Canonical acceptance: [02-UAT.md](02-UAT.md) (user approval and resolved gaps). MIND-01 through MIND-04 are complete; MIND-05 stays allocated to Phase 5.

## Plan 02-08 correction verification

Native ToolbarModuleExtension → More → Object actions → current-host menu event is registered through extensions.ts. The standalone trigger is removed. Alignment entries require selection.count > 1 and existing guards remain. Properties, right-click access and keyboard focus persist. Current correction evidence: 204/204 affected browser cases, 67/67 units, typecheck and build passed; see 02-08-SUMMARY.md. Earlier broader suite counts retain their recorded revisions. Phase acceptance is now passed following the final user approval.


## Plan 02-09 correction verification

The 572-case matrix passed 571 cases and exposed one reload-hydration race in the workflow fixture. After waiting for a single hydrated editor, the workflow passed 4/4 projects (development Chromium and production Chromium, Firefox and WebKit). All 572 distinct matrix scenarios therefore have passing evidence; the original run is not represented as a clean sweep. Typecheck, production build and 67/67 unit tests passed.

Native addTopic inherits presentation; clipboard/duplicate conversion preserves topology with fresh identities and operation-owned rollback. ObjectContextMenu stays mounted after deselection and both unlock routes resolve the effective lock owner. The original 31-truth score retains its historical scope; the corrective plan has behavior-specific test evidence and is accepted by the final phase-wide approval. See 02-09-SUMMARY.md.

## Current revision refresh — 2026-09-15

- Reviewed later interaction fixes: canvas pointer focus ownership, native text editor fallback and selected-range handling, synchronous tree rebuild before layout, and centering on final node geometry before editing.
- `877650d` already has 114 focused production Chromium/Firefox/WebKit cases and a 40-case Chromium regression run (four cases overlap), plus 67 unit tests, typecheck and production build. See [quick correction summary](../../quick/260915-topic-editing-new-board/SUMMARY.md) (font, focus and new-tab evidence).
- Current-HEAD focused production results are recorded in [02-VALIDATION.md](02-VALIDATION.md) (requirements and test provenance).
- Existing security report has zero open threats. The later typography/focus changes retain model mutation guards; no new service or permission boundary is introduced. Existing UI advisory findings retain their original audit scope.
- This is an inline refresh of the canonical verification, not a new independent review or a rerun of the historical 604-case matrix.

## Revision d0958e1 broad-run outcome

The complete-matrix attempt stopped after **1,810 passed, two failed and 136 not run** (approximately 1.5 hours). Firefox quota recovery completed its behavioral assertions but logged a deferred native measurement attempting a write after the store became read-only. WebKit stalled during `/auth/start` navigation in the final save-details case and reported an internal WebLoaderStrategy error; those suites bypassed the existing per-context WebKit lifecycle fixture. Both findings are being corrected and revalidated. This is incomplete failing evidence, and canonical verification remains stale.

### Lifecycle correction follow-up

`5781eaf` fences deferred native text measurements after read-only or detached transitions; deterministic red evidence reproduced the exact readonly exception and detached write. All **16 lifecycle/quota cases pass across four browser projects**, with writable measurement still verified. `5388e7b` shares existing WebKit process isolation with all recovery suites. A separate **65-consecutive-context authentication check passed** (39.4-second test body). Both static checks and 233 unit tests passed before these commits. The complete expanded browser gate is running on the unchanged implementation at `5388e7b`; prior failing runs remain historical and are not combined into a pass.

## Final prerequisite-refresh disposition — 2026-09-28

The complete browser run on `5388e7b` finished with **1,958 passed, two failed and zero skipped** across 1,960 selected cases. Both failures were synthetic account-transition fixture races in Firefox. Corrections in `348de18` pass **20 focused cases across four projects** plus **10 repeated Firefox cases**, with both TypeScript checks passing. Client units (233/233) and serialized server tests (311/311) passed on the unchanged application source. The restored Viewer regression passed in all three production engines.

The autonomous retry ceiling is reached: **needs_human**. A passing full gate on the corrected test revision remains outstanding, so the historical acceptance and old covered digest are retained and canonical freshness remains stale. See [04-PREREQUISITE-REFRESH.md](../04-durable-boards-and-recovery/04-PREREQUISITE-REFRESH.md) (complete counts, corrections, failed attempts and resume boundary). Approved UAT dispositions and deferrals are unchanged.
