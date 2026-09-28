# Recovery acceptance — Phase 4

Status: in progress. Phase 4 remains open until final automated and native acceptance gates are reconciled.

## Completed full-run result — e93b933

The complete run selected 2,036 cases: **2,029 passed, 7 failed, zero skipped**, in 1.9 hours. The strict matrix reporter withheld acceptance. Its source digest was `1874cca1f07f7daa2d61ee3336e8a847ea0a21d775f7ace88eacfd9ea7c44d98`; the tracked tree also contained the pre-existing package-script changes.

Failures: four projects expected the superseded Opening board label while recovery displayed Recovering changes; the development session-replay fixture allowed the edit to save before it installed the outage; Firefox reported cancelled-action errors in the delayed-font timeout test; WebKit reported a session-request access-control error in the image-cardinality matrix. The first two fixtures are being corrected; the runtime errors remain under investigation. Full acceptance remains open. Test sequence numbers in interim progress updates were incorrectly treated as passing totals; the final reporter counts above are authoritative.

## UAT continuation — saved library marker

The user reported native 200% zoom and saving as working, then identified a library card still marked Changes waiting to save after the board displayed Saved. Browser identification was not supplied. The user subsequently confirmed the visible tab-close test passed after clarifying the local API outage setup.

The new real-browser regression reproduced the marker: the journal was empty after Saved, and returning to the library created pending records. `suspendAccessScope` captured full document snapshots unconditionally on navigation. Navigation now captures only document state outside actual server-acknowledged coverage, while retaining uncertain work and existing recovery records. The failing assertion observed one pending marker where zero was expected. The correction is committed as `0b9f05a`.

The focused navigation/library/session run passed 114/117. Three old quota-fixture failures expected preservation of already-saved content; the fixture now creates a real unacknowledged edit after storage failure and checks that server bytes remain unchanged. The saved-navigation and corrected quota cases pass 6/6 across Chromium, Firefox and WebKit. Both static checks, all 236 client tests and all 311 serialized server tests then passed. The complete browser regression on `0b9f05a` was subsequently interrupted; it is incomplete evidence.

The broad run at `254ac6b` was deliberately interrupted for this UAT correction after 878 passes, one interrupted test and 1,131 unrun cases (2,012 selected). It is incomplete evidence, and the reporter correctly withheld aggregate acceptance. Its earlier focused 156-case result retains its original revision scope.

## Evidence boundary

Follow-up repetition: **31/32 passed**, zero skipped, 5.8 minutes across dev and three production engines. The corrected loading label now reaches the focus assertion; one WebKit repetition loses the intervening focus after editor visibility. All eight replay cases pass. The earlier font/session-request errors did not recur in eight repetitions of each affected scenario; their cause remains unresolved. Both typechecks pass. Gap G-04-38 and plan 04-17 retain the remaining work; Phase 4 is open.

The prerequisite regression passed 1,960 browser scenarios with zero failures or skips on source revision `5aefe81d00ca618c2985c8a4801131cdcb6044e6`. This establishes the baseline before the new final UI matrix and its resulting fixes. It does not certify subsequent changes.

The final matrix uses real browser rendering, native IndexedDB and synthetic authenticated local services. Each completed scenario attaches its actual project, revision and passing predicate keys. A scenario failure invalidates all its keys. The aggregate reporter requires all 13 scenarios and all 36 keys in each production engine, rejects retries and skipped scenarios, and verifies a stable tracked source-content digest including pre-existing changes.

Run the complete matrix with its fail-closed reporter:

```sh
DALI_UI_MATRIX=1 npm exec playwright test -- tests/recovery-ui-matrix.spec.ts tests/local-recovery.spec.ts tests/recovery-archive.spec.ts tests/recovery-navigation.spec.ts tests/library-recovery.spec.ts --project=prod --project=prod-firefox --project=prod-webkit
```

The reporter is opt-in so bounded debugging runs can select a single scenario without falsely certifying the whole matrix. One worker serializes browser execution. The support and reporter modules are separated from the scenario file to keep evidence checks independently reviewable.

## Explicit UI predicates

The table maps approved predicates to executable checks. All 36 rows passed in Chromium, Firefox and WebKit at source `254ac6b87f75a832316dc4a381230c7bad8a7424`. The 156-case focused gate selected and passed 52 cases per engine with zero failures or skips. The stable tracked source digest was `bc4b47d9d47fa7b34f302b5aa38dc97d8513d619a61e0fb33ea601b9cac8cc5f`; it includes the pre-existing package-script changes. Full-regression completion remains separate.

| Surface/category | Exact accepted truth | Owning plan/task | Final oracle |
|---|---|---|---|
| E1/loading | Show Saving or pending/recovery progress beside the title; retain the last acknowledged server time. | 04-07-01/02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E1 loading |
| E1/error | Apply defined status precedence and open details only on activation; never report Saved until current content and required images are acknowledged. | 04-07-01/02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E1 error |
| E1/overflow | Use the Responsive Layout contract: viewport-clamped surfaces, vertical scrolling, reachable controls and no horizontal page overflow. | 04-07-01/02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E1 overflow |
| E1/long-text | Wrap explanatory text and image names while preserving full accessible labels; test the specified long-title/name fixtures and 320px layout. | 04-07-01/02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E1 long-text |
| E2/empty | Omit an empty image list; healthy details show the saved message and acknowledged time. | 04-07-01/02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E2 empty |
| E2/loading | Update individual upload/retry rows in place without stealing focus or removing access to recovery download. | 04-07-01/02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E2 loading |
| E2/error | Identify each failed image; keep its error until that required image is acknowledged or confirmed obsolete. | 04-07-01/02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E2 error |
| E2/populated | Show stable image labels, available thumbnails, row status and per-image save state. The user-approved follow-up removed Select image actions. | 04-07-01/02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E2 populated |
| E2/partial | Use a neutral placeholder for missing previews; mixed success and failure retains unresolved rows. | 04-07-01/02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E2 partial |
| E2/overflow | Use the Responsive Layout contract: viewport-clamped surfaces, vertical scrolling, reachable controls and no horizontal page overflow. | 04-07-01/02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E2 overflow |
| E2/zero-one-many | Omit zero-image sections, use singular/plural copy and vertically scroll the specified 50-row case. | 04-07-01/02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E2 zero-one-many |
| E2/long-text | Wrap explanatory text and image names while preserving full accessible labels; test the specified long-title/name fixtures and 320px layout. | 04-07-01/02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E2 long-text |
| E3/empty | A valid board with no images exports without an image section; a referenced but unavailable image follows the missing-image error contract. | 04-06-01/02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E3 empty |
| E3/loading | Show Preparing recovery copy and suppress duplicate preparation while retaining the board and pending data. | 04-06-01/02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E3 loading |
| E3/error | Preparation or missing-image failure retains journal and in-memory content, exposes retry and never hands off a silently incomplete success archive. | 04-06-01/02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E3 error |
| E3/populated | Hand off a complete authorized snapshot archive compatible with Import; the ready message does not clear pending work or claim a disk save. | 04-06-01/02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E3 populated |
| E3/overflow | Use the Responsive Layout contract: viewport-clamped surfaces, vertical scrolling, reachable controls and no horizontal page overflow. | 04-06-01/02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E3 overflow |
| E3/long-text | Wrap explanatory text and image names while preserving full accessible labels; test the specified long-title/name fixtures and 320px layout. | 04-06-01/02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E3 long-text |
| E4/empty | A valid empty board remains a valid canvas; inaccessible or unavailable board data uses the load/denied contract rather than a fabricated empty board. | 04-04-01/02/03 | tests/recovery-ui-matrix.spec.ts — @04-ui-E4 empty |
| E4/loading | Check current account and permission before recovery, then show recovery progress until server acknowledgment. | 04-04-01/02/03 | tests/recovery-ui-matrix.spec.ts — @04-ui-E4 loading |
| E4/error | Use distinct load, permission, corrupt-journal and restoration-mismatch states; retain isolated pending data and gate content/actions by current authority. | 04-04-01/02/03 | tests/recovery-ui-matrix.spec.ts — @04-ui-E4 error |
| E4/populated | Display the authorized board with its images; restore a still-valid editing context without overriding a subsequent focus move. | 04-04-01/02/03 | tests/recovery-ui-matrix.spec.ts — @04-ui-E4 populated |
| E4/overflow | Use the Responsive Layout contract: viewport-clamped surfaces, vertical scrolling, reachable controls and no horizontal page overflow. | 04-04-01/02/03 | tests/recovery-ui-matrix.spec.ts — @04-ui-E4 overflow |
| E4/long-text | Wrap explanatory text and image names while preserving full accessible labels; test the specified long-title/name fixtures and 320px layout. | 04-04-01/02/03 | tests/recovery-ui-matrix.spec.ts — @04-ui-E4 long-text |
| E5/loading | After explicit Leave, suppress duplicate navigation while the requested transition completes and focus the destination heading. | 04-08-02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E5 loading |
| E5/error | Unconfirmed local preservation adds the defined loss warning; Stay retains the current board and Leave remains an explicit informed choice. | 04-08-02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E5 error |
| E5/overflow | Use the Responsive Layout contract: viewport-clamped surfaces, vertical scrolling, reachable controls and no horizontal page overflow. | 04-08-02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E5 overflow |
| E5/long-text | Wrap explanatory text and image names while preserving full accessible labels; test the specified long-title/name fixtures and 320px layout. | 04-08-02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E5 long-text |
| E6/empty | Keep the existing empty-library view; zero pending records adds no marker and does not fabricate cards. | 04-09-01/02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E6 empty |
| E6/loading | Load authorized cards independently and expose Checking recovery status while journal inspection is pending. | 04-09-01/02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E6 loading |
| E6/error | Inspection failure shows Recovery status unavailable with Refresh boards retry; access-list failure does not reveal cached private cards. | 04-09-01/02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E6 error |
| E6/populated | Place the matching account/browser pending marker below role/access metadata without changing server edited time, grid ordering or card actions. | 04-09-01/02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E6 populated |
| E6/partial | A missing preview uses the existing card fallback; marker visibility depends on authorized metadata and journal evidence, not preview success. | 04-09-01/02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E6 partial |
| E6/overflow | Use the Responsive Layout contract: viewport-clamped surfaces, vertical scrolling, reachable controls and no horizontal page overflow. | 04-09-01/02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E6 overflow |
| E6/zero-one-many | Preserve the current zero/one/many-card layout and test 50 marked cards; clear each marker only on acknowledgment of its matching pending work. | 04-09-01/02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E6 zero-one-many |
| E6/long-text | Wrap explanatory text and image names while preserving full accessible labels; test the specified long-title/name fixtures and 320px layout. | 04-09-01/02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E6 long-text |

## Observed final-matrix gaps

- Authorization progress: the first production Chromium run failed because the checking-access stage displayed the general opening-board label.
- Storage quota guidance: after correcting the test's scroll position, the quota case failed because full storage displayed unavailable-storage instructions. The runtime must retain typed quota identity through preservation and recovery wrappers.
- Test correction: the short-height details check had scrolled to Close before checking Retry. The assertion now scrolls Retry into view before checking reachability; vertical scrolling is allowed by the UI contract.

## Operational scope and outstanding acceptance

Plan 04-15 closed under the user's accepted local Kubernetes scope. Retained measurements prove the documented local deployment/recovery exercise. The cluster image predates later application corrections; current corrected Viewer behavior is established by fresh real-restore browser fixtures. Independent storage failure-domain and capacity validation remains deferred in backlog 999.6. Real provider setup and spoken assistive-technology acceptance remain deferred in backlog 999.4 and 999.3 respectively.

Final reconciliation still requires the complete post-fix regression, native 200% browser zoom and beforeunload observations, four requirements, fifteen decisions, the threat probes, four SAVE edge cases, two OPS assumptions and seven prohibition dispositions. No outstanding item is accepted by this in-progress report.

Sources: [UI contract](../.planning/phases/04-durable-boards-and-recovery/04-UI-SPEC.md) (approved copy, layout and interaction predicates), [coverage](../.planning/phases/04-durable-boards-and-recovery/COVERAGE.md) (decision, threat and prohibition mappings), [local operational validation](../.planning/phases/04-durable-boards-and-recovery/04-LOCAL-KUBERNETES-VALIDATION.md) (measured local results and scope limits).

## Decision reconciliation

Completed slice reports retain their scoped results. The final revision must pass the matrix and regression before these rows receive a final disposition.

| Decision | Approved behavior | Slice evidence | Final disposition |
|---|---|---|---|
| D-01 | Keep save problems beside the board title, with details available on click. Preserve the existing last-save age presentation. The user selected this instead of a persistent banner or blocking failure dialog. | 04-05, 04-07 | Final reconciliation pending |
| D-02 | Retry failed saves automatically in the background. Details offer **Retry now** and **Download recovery copy**. The recovery copy includes pending changes and images available in that browser. | 04-05, 04-06, 04-07 | Final reconciliation pending |
| D-03 | When board content saves but an image upload fails, show **Image not saved** beside the title. Details identify the affected image and offer recovery actions. Show **Saved** only after content and images are confirmed saved. | 04-05, 04-06, 04-07 | Final reconciliation pending |
| D-04 | If saving has failed or stalled and the user tries to leave, warn that some changes have not reached the server and let them stay or leave. Preserve pending work locally where possible. This warning addresses unresolved save problems; routine short saves were not assigned a blocking confirmation. | 04-08 | Final reconciliation pending |
| D-05 | For an already open board during temporary connection loss or service outage, continue editing with changes preserved locally and visibly pending. Send them after reconnection and a fresh access check. A known expired session still pauses editing until sign-in. | 04-03, 04-04, 04-08 | Final reconciliation pending |
| D-06 | When the same board is reopened in the same browser, recover pending work automatically after confirming the same account and editing permission. Retry saving and show recovery progress beside the title. | 04-02, 04-03, 04-04 | Final reconciliation pending |
| D-07 | If local recovery storage becomes full or unavailable during an outage, pause further editing. Keep existing work visible and offer **Download recovery copy** and **Retry saving**. | 04-04, 04-06, 04-08 | Final reconciliation pending |
| D-08 | Mark an accessible board card with **Changes waiting to save** in the browser holding pending work. Keep that indication until saving succeeds. Maintain account isolation; another account must not receive the pending work or its metadata. | 04-09 | Final reconciliation pending |
| D-09 | Target an existing operator-managed **Kubernetes** platform for internal deployment. | 04-13, 04-14 | Final reconciliation pending |
| D-10 | Planned maintenance is acceptable. The user explicitly allowed **up to one day when necessary**, overriding the proposed 5-, 15- and 30-minute options. Preserve pending work and recover it when service returns. | 04-11, 04-14, 04-15 | Final reconciliation pending |
| D-11 | No additional platform standards were imposed. Research proposes a portable deployment, including packaging, storage, ingress/TLS, secret handling and release procedure. Real operator configuration remains exclusively outside the public repository. | 04-13, 04-14 | Final reconciliation pending |
| D-12 | After loss of server storage requiring backup restoration, permit **at most one hour of recent acknowledged saved work to be lost** (recovery point objective, RPO: 1 hour). | 04-10, 04-11, 04-12, 04-15 | Final reconciliation pending |
| D-13 | Retain backups for **30 days**. | 04-10, 04-11, 04-15 | Final reconciliation pending |
| D-14 | Restore usable service **within 24 hours** of a storage failure (recovery time objective, RTO: 24 hours). Include restoration of board content and images and verification that authorized members can reopen them. | 04-12, 04-15 | Final reconciliation pending |
| D-15 | Restoration is **operator-initiated**: an operator selects a backup, follows the documented procedure and verifies the restored service before reopening access. Scheduled backups run automatically. | 04-02, 04-10, 04-11, 04-12, 04-15 | Final reconciliation pending |

## Edge cases and review dispositions

| Item | Evidence to reconcile at the final revision | Current disposition |
|---|---|---|
| SAVE-01 idempotency | Real duplicate/uncertain document and blob submission; cold restart fixtures | Final regression pending |
| SAVE-01 concurrency | Process termination before commit, after commit and after response; current authorization at write commit | Final regression pending |
| SAVE-02 idempotency | Exact immutable captured IDs, old acknowledgment versus new edits, unrelated image failure retention | Final regression pending |
| SAVE-02 concurrency | Native two-tab sequences, blocked upgrade, compaction rollback and stale callbacks | Cross-browser gate running |
| OPS-01 environment assumption | Accepted local Kubernetes deployment, one writer, configured storage topology | Local scope accepted; production topology remains operator-specific |
| OPS-02 failure-domain assumption | Measured selected-backup recovery and independent destination/capacity | Local scope accepted; independent validation deferred to 999.6 |

Seven retained prohibition judgments remain visible separately from test results:

1. Restored-state safety: epoch mismatch isolates pending work; explicit restored-board entry retains old rows. Final regression and judgment pending.
2. Restart evidence: fresh authenticated contexts retrieve restored server content and image bytes. Cached/browser-local reopening alone supplies no restart claim. Final regression and judgment pending.
3. Save claims: exact document/image acknowledgments and completed local transactions govern the respective status. Dispatch, export and unrelated image success leave unresolved state. Final regression and judgment pending.
4. Pending retention: recovery downloads, explicit Leave and restored-board entry preserve isolated pending records. Final regression and judgment pending.
5. Repository privacy: synthetic fixtures and generic interfaces remain the public boundary; operator configuration and private runtime reports stay external. Final outgoing-content/history review pending.
6. Operator restore: selected backup and verified content/access precede traffic reopening in the runbook and measured local exercise. Independent operator judgment remains explicit.
7. Recovery targets: retained real local wall-clock measurements support only their documented local scope. Independent storage/capacity remains deferred; production RPO/RTO is not inferred. Final judgment pending.

## Validation log

- Baseline: 1,960/1,960 browser scenarios on `5aefe81`, prior to final-matrix changes.
- RED: authorization progress failed its specified label; quota guidance failed after the scrolling assertion was corrected.
- Initial complete Chromium matrix: 5 passed / 8 failed. Product quota cause loss and new-fixture defects were identified separately.
- Corrected Chromium matrix: 12 passed / 1 failed. Authorization, quota guidance, recovery/import integrity, error isolation and leave behavior passed; reduced-motion setup was moved before interaction.
- Client unit suite after runtime fixes: 236/236 across 20 files.
- Both TypeScript checks passed before final fixture commit `989696f`.
- Cross-browser matrix at `989696f`: 156 selected, 153 passed, three failed, zero skipped, eight minutes. Each engine failed the same library-preview contrast check; all other selected native recovery cases passed. The reporter withheld the entire failing scenario's five E6 predicates in each engine. Source digest: `44534d7a1fd3055dca7017b05417e166db8ff73dd8fdd1b6b03995a9e7239dfc`; the existing package-script changes were included in that tracked-content digest.
- Gradient-aware RED: rendered fallback text had a conservative worst-case contrast of 3.78:1 over the dotted preview background. The fallback now uses the design-system ink color. The corrected fallback passed in all three engines, followed by the complete 156/156 focused gate.

- Final focused matrix at `254ac6b`: 156 selected, 156 passed, zero failed/skipped, 6.5 minutes; all 13 matrix scenarios and 36 predicates per production engine.
- Final client suite: 236/236 across 20 files. Final serialized server suite: 311/311 across 14 files, including real representative backup/restore I/O.
- Final production build passed. Standalone access passed 126/126. The complete 2,012-case browser regression was interrupted for the subsequent UAT correction; no full passing result is claimed.
- Native 200% Chrome acceptance was attempted through visible browser controls, but user activity changed the active browser before zoom could be exercised. The attempt was stopped and remains unverified. No native tab-close result was observed. Real beforeunload dialogs after genuine UI interaction and reload passed in the focused browser gate in all three engines; this narrower result does not close the visible native checks.

## Threat probe reconciliation

The final server and client suites passed at `254ac6b`. Browser rows below have passing focused evidence; their final broad regression is still running. Operational rows retain the explicitly accepted local scope and original image revision.

| Threat | Mitigation and executed probe | Evidence scope |
|---|---|---|
| T-04-01-01 | WAL/FULL startup readback, real process kill before/after commit/response, cold authorized reads | `server/storage/durability.test.ts`, `tests/durable-restart.spec.ts` |
| T-04-02-01 | Recovery epoch checked after authority and at write commit, stale documents/images/imports rejected | `server/boards/recovery.test.ts`, `src/canvas/account/doc-source.test.ts`, `src/canvas/account/blob-source.test.ts` |
| T-04-03-01 | Immutable record IDs, strict transaction completion, quarantine and exact acknowledgment | `src/canvas/account/outbox.test.ts`, `tests/local-recovery.spec.ts` |
| T-04-04-01 | Fresh access before inspection/replay, generation checks, mutation pause and bounded retry | `src/canvas/account/recovery.test.ts`, `src/canvas/account/mutation-guard.test.ts`, `tests/local-recovery.spec.ts` |
| T-04-05-01 | Current document and required-image coverage determines Saved; unrelated success cannot clear failures | `src/canvas/save-status.test.ts`, `tests/save-status.spec.ts` |
| T-04-06-01 | Immutable export snapshot, current authority, complete referenced images, no journal deletion | `src/canvas/recovery-archive.test.ts`, `tests/recovery-archive.spec.ts` |
| T-04-07-01 | Scoped image actions/previews, stable labels, focus and reachable actions | `tests/save-details.spec.ts`, final focused UI matrix |
| T-04-08-01 | Stable title operation IDs, revision receipts, retained pending work and explicit navigation | `src/canvas/account/title-intent.test.ts`, `tests/recovery-navigation.spec.ts` |
| T-04-09-01 | Authorized card list precedes account-scoped journal inspection; failures stay explicit | `src/boards/pending-recovery.test.ts`, `tests/library-recovery.spec.ts` |
| T-04-10-01 | Complete SQLite graph validation, digest/fsync publication, last good backup retained on failure | `server/storage/backup.test.ts` |
| T-04-11-01 | Verified backup age checked inside each durable write transaction; 19-route matrix | `server/storage/backup-scheduler.test.ts`, `server/storage/write-admission.test.ts` |
| T-04-12-01 | Explicit selected digest, fresh destination, new epoch and invalidated sessions | `server/storage/restore.test.ts`, `tests/restored-board.spec.ts` |
| T-04-13-01 | Production-only compilation, native SQLite image probe, trusted loopback proxy and bounded drain | `server/preflight.test.ts`; retained `IMAGE_SMOKE_PASS` |
| T-04-14-01 | One Recreate writer, restricted mounts/probes/security and explicit disposable context | retained manifest/self-tests and `LOCAL_DEPLOYMENT_SMOKE_PASS` |
| T-04-15-01 | Representative exact hashes and real local loss/restore measurements | `server/storage/operations-drill.test.ts`; retained `LOCAL_RECOVERY_DRILL_PASS` |
| T-04-15-02 | Real freshness rejection retains browser work until renewed coverage and exact acknowledgment | `tests/backup-fence.spec.ts`; simulated elapsed maintenance is labeled separately from actual I/O timing |
| T-04-16-01 | Explicit predicate keys, required scenario/project counts, zero required skips/retries and stable source digest | `tests/recovery-ui-matrix-reporter.ts`; focused aggregate gate passed |

These probes establish their tested boundaries. They do not establish independent physical storage survival, production capacity, actual-provider integration or spoken assistive-technology acceptance.

## Current acceptance continuation — 2026-09-28

- User-confirmed native 200% zoom and tab-close warning are passed in `04-UAT.md`; browser/version was not supplied, so these claims retain the user-tested environment scope.
- Eight pending UAT entries were caused by unsupported `browser` verification kinds and inline YAML mappings. Expanded mappings and the supported `e2e` kind make existing evidence machine-readable; this changes no historical test outcome.
- Two stale regression assertions reproduced failures in production Chromium. The corrected assertions require no fabricated pending records after confirmed saving and actionable quota-specific guidance. Both pass in Chromium, Firefox and WebKit (6/6). Correction: `e93b933`.
- Both TypeScript checks and 236 client unit tests pass. A concurrent server run reported a failure and was interrupted; the isolated serialized rerun passed all 311 tests across 14 files.
- The current complete browser gate selects 2,036 cases at `e93b933`, with `DALI_UI_MATRIX=1` to enforce all 13 scenarios and 36 predicates in each production engine. It remains running until a final recorded result. Existing package-script changes are included in the reporter's source digest.
- The native lifecycle follow-up independently covers creating from the library and File menu, saving, reload, process restart, and deletion through both library and canvas controls. See the local-board-lifecycle quick summary for exact results and the development-only storage policy.

No phase-completion claim follows from a running or interrupted gate. The final regression remains the sole pending UAT execution item; canonical phase verification must follow its reconciliation.

## Prohibition review continuation

The following dispositions are scoped source/evidence judgments; final regression remains open.

1. Restored-state isolation: `tests/restored-board.spec.ts` exercises a selected restore and quarantines old browser work. Recovery epoch checks and the mismatch view require deliberate handling before replay. Retain the final browser result as the execution gate.
2. Restart proof: `tests/durable-restart.spec.ts` kills the owned server and reopens through a cold authorized browser; its checks compare native note/image content. Local cached reopening alone is not used as its oracle.
3. Save acknowledgment: save-status, outbox, transport and recovery tests cover transaction completion, exact IDs/current document coverage and required-image acknowledgment. The new cold-recovery and navigation regressions retain these controls. The current client suite passed 236 tests.
4. Pending-work retention: recovery export, explicit Leave and restored-state scenarios check retained IDs and bytes; completed download alone does not acknowledge a save. Covered by the archive/navigation/restore suites in the final run.
5. Public repository boundary: inspected added history from the Phase 4 base through `e93b933` for host paths, private-key blocks and credential assignments. No host-path or private-key match was found. The one credential-pattern candidate is an explicitly synthetic OIDC secret in the production preflight fixture. This bounded scan supplements the existing scoped source review; operator reports remain ignored and external.
6. Operator restore: `server/operator.ts` is offline-only, requires an explicitly selected backup/digest and does not start service or open ingress. `restoreBackup` validates maintenance/fencing and a fresh destination; the runbook requires content/access review before opening ingress. Server restore tests pass in the 311-test isolated suite. Deployment attestations remain operator responsibilities.
7. Recovery targets: the fresh representative I/O test measures actual backup/restore durations and acknowledged-loss windows for its owned local dataset. Simulated cadence and retention cases remain identified separately. Production failure-domain and capacity validation retain the approved backlog deferral; no production RPO/RTO is inferred.

User judgment acceptance: the user explicitly replied "Accept all seven scoped dispositions" to the seven-item review above. Each judgment is accepted within that scope. The full automated regression and canonical verification remain required.
