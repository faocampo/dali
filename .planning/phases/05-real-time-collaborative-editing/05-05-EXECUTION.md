# Plan 05-05 execution — divergence-aware recovery

Status: **in progress; plan not complete**. Plan 05-04 is automated-verified at `8dc921c`, documented by `069c1ca`. This plan retains the approved two-task sequence and collaboration opt-in boundary.

## Leading reproduction and repair

The first browser launch lost its executor connection and exhausted fixture startup before selecting tests. A subsequent launch exposed an optional callback type error in the new test; that test-only correction preceded the behavioral reproduction. Neither launch is behavioral acceptance evidence.

The actual Chromium tracer then failed after reopening a disconnected editor: its locally moved shape returned from `[70,40,160,120]` to the server position `[0,0,160,120]`. The runtime's generic live-recovery error prevented candidate reconstruction, after which ordinary hydration opened server content. Three coordinator tests separately failed because title replay, inspection and drain ran without a version-decision gate; the denied-authority case already passed.

The implementation adds a typed choice gate after fresh authority and preservation, before title replay, inspection or drain. A retained choice has no automatic retry. Checkpoints gain optional shared-baseline metadata without replacing the version-2 database or legacy rows. Uncertain document submissions retain their actual transport tab, operation identity and byte digest. An authenticated read-only transaction returns a consistent root/content/title pair and only matching own receipts. Comparison uses isolated canonical Yjs operation state, including ABA, and exact title; presence or grant revision churn alone does not imply divergence. Already received remote operations advance the reconstruction checkpoint without adding unacknowledged local operations to its shared baseline.

Candidate reconstruction selects one tab and preserves all other rows. A quarantined workspace does not start document synchronization or a live feed, and remains read-only while the decision is open or dismissed. The native dialog focuses its heading; Decide later and Escape retain the candidate. Pending status cannot become Saved through unrelated coverage updates. Generic copy synchronization no longer invokes the non-live recovery drain on live boards.

## Verification checkpoint

- Initial native repair: **1/1 Chromium**, 39.1 seconds total including fixture setup.
- Expanded native gate: **3/3 Chromium**, 1.1 minutes, zero skips/retries: disjoint divergence, unknown legacy baseline and own lost acknowledgement followed by a remote change. Every case asserts separate native versions, retained journal records and zero replay before decision; dismissal/reopening retains the choice.
- Full client: **276/276 across 26 files**, 22.40 seconds.
- Full serialized server: **379/379 across 19 files**, 168.53 seconds. Four new endpoint tests failed before implementation and now pass, covering fresh effective authority, epoch, exact receipt ownership and query limits.
- Both TypeScript checks pass.
- Firefox/WebKit recovery and clean-history-reconnect matrix: **10/10**, 2.5 minutes, zero skips/retries. The legacy candidate also verifies 390px dialog gutters and absence of horizontal overflow.

## Remaining approved work and limits

This checkpoint does not complete 05-05. Unchanged-baseline replay with fresh affected-object reservations and a transactional whole-canvas precondition, active dirty reconnect, title receipt/partition handling, restored-write confirmation, concurrent tabs, storage/epoch races and outage-editing integration remain to be implemented and verified in the second task. The current conservative decision also pauses unchanged candidates. Private-copy and latest/download completion belong to 05-06; their decision actions are currently disabled. No shared overwrite exists.

The full phase still requires active-access transitions, collaborative mind maps, twenty distinct simultaneous native editors and human acceptance. No release readiness, publication, merge or shared deployment is claimed.

## Task 05-05-02 continuation — title recovery

The original and isolated histories are reconciled without mixing their incompatible migration-11 databases; see [reconciliation](05-RECONCILIATION-2026-10-06.md). The delivered preview remains at `c072cb9`. Its separate full-server investigation passed 375/375 without changing code or timeouts; [timing evidence](05-SERVER-TIMING-2026-10-06.md) preserves the earlier two timeout failures. Those checks are not evidence for the new recovery implementation.

The continuation implements unchanged-canvas recovery with fresh leases, exact durable submission identities and a transactional canvas fingerprint on document, image and rename commits. The selected tab's candidate remains isolated; restored write permission requires an explicit choice tied to the permission-loss marker version. Collaborative title intents are partitioned by tab, while legacy rows remain preserved and conservative.

Title recovery initially failed two server cases (missing original rename receipt and missing transactional divergence response), one baseline unit case and the native `unchanged-title` case, which never reached Saved. Exact rename receipts now come from the original committed operation, scoped to the current member, board and recovery epoch. A later foreign rename stays divergent. The client reconciles this proof before deciding whether to replay; it removes only the matching title intent and advances its checkpoint in one strict IndexedDB transaction. Newer local intents, another tab's intent and the previous baseline survive storage failure.

Verified title checkpoint:

- Server title/baseline cases: 7/7 after the recorded red reproduction.
- Client outbox, title and baseline suites: 52/52 across three files.
- Both TypeScript checks pass.
- Native Chromium title cases: 3/3, 53.8 seconds, zero skips/retries. They verify unchanged replay, lost acknowledgement without a second rename, foreign divergence without a write, convergence and reopening.

Integrated continuation checkpoint: **14/14 Chromium**, 2.5 minutes, covering all nine current recovery cases, both clean-history reconnect cases and all three consecutive-formatting races. Full client: **280/280**, 26 files, 15.23 seconds. Full serialized server: **382/382**, 19 files, 154.74 seconds, executed after client and browser gates had finished. No skips/retries or unexpected browser errors. Firefox/WebKit have not been rerun for this increment.

Task 05-05-02 remains incomplete. Active pending reconnect with retained personal history, partial-action provenance, native disconnected editing, concurrent candidates and remaining storage/access/epoch races require additional evidence before this plan can close. Private-copy/latest choices remain plan 05-06; the preview and published branch are unchanged.

## Task 05-05-02 continuation — recovered personal history

The title/unchanged-replay checkpoint is committed locally as `3e6f0e2`. Subsequent tests reproduced one client failure and three server failures for partial action provenance: replacing the original action with its most recent recovery token lost earlier acknowledged properties; an inverse spanning both fragments was rejected. The server now combines the original and bounded recovered fragments using their actual per-property revisions, scoped to the same account, board and transport tab. Foreign intervening writes remain ineligible; unknown and other-tab fragments cannot be borrowed. The fresh history lease binds the whole checked set, and the commit rechecks that same set. No schema or database migration is introduced.

A separate native reproduction committed the recovery update but lost its acknowledgement. The next retry reached Saved, yet Undo left the shape at its moved position. Recovery submissions now preserve their fresh action identity before network delivery. Only an exact operation/digest receipt restores the mapping to the original personal step; normal hydration and unrelated receipts cannot invent it. Storage failure retains the original rows.

Focused evidence: 51/51 client tests across five files, 33/33 collaboration server tests and both TypeScript checks. Native Chromium active recovery: 2/2, 49.7 seconds, no skips/retries. Both acknowledged replay and replay with a lost acknowledgement retain native undo/redo, converge with a second editor, permit a subsequent freshly reserved gesture, and survive reopening. Wider regression is in progress; these results do not close the plan or claim cross-browser acceptance for this increment.

The first expanded Chromium run passed 25/26. The active-unchanged test inspected an empty journal synchronously while the restarted DocEngine's idempotent root submission was still being acknowledged. Its trace records that root receipt with `previousRevision=3` and `revision=3`; it did not change shared content. The test now waits for the actual IndexedDB cleanup before continuing its native history assertions, using the existing bounded expectation timeout. Application source, assertions about content/history and timeouts are unchanged by this test correction. The initial failure and trace are retained separately. The complete corrected run passes **26/26 Chromium**, 4.4 minutes, zero skips/retries, covering personal history, clean and pending reconnect, titles and the consecutive-formatting regressions.

The active recovery and title matrix also passes **10/10 across Firefox and WebKit**, 2.5 minutes, zero skips/retries or unexpected errors. Full client/server reruns for this later history increment have not been performed; its targeted gates are listed above and the complete 280/382 gates retain the earlier `3e6f0e2` scope. Continue the unresolved 05-05-02 cases before plan completion.

## Task 05-05-02 continuation — remote writes during comparison/replay

The personal-history increment is committed locally as `e91fc2c`. Two subsequent native Chromium reproductions failed because a remote editor changed a separate object after comparison or immediately before the recovery commit: replay correctly stopped, but the recovery dialog was absent. The first attempted browser launch could not bind its loopback fixture port under the sandbox; that startup failure is not behavioral evidence. The authorized isolated repetition selected both tests and observed the missing-dialog failures.

Recovery now carries an explicit divergent/unknown reason and publishes that choice only for the current, non-aborted runtime while retaining its isolated candidate. Unsupported candidate shapes remain unknown rather than being described as a confirmed remote change. Both repaired native cases pass **2/2 Chromium**, 42.8 seconds total, zero skips/retries. They verify separate local/remote native content, a real commit-time `409 RECOVERY_DIVERGED` where applicable, retained journal rows, no retry after dismissal and reachable/focused review actions. Both TypeScript checks pass. These focused results do not complete 05-05 or replace the earlier broader regression evidence.

## Task 05-05-02 continuation — new actions during an open-board outage

The remote-write decision fix is committed locally as `717a88d`. Two native offline-editing reproductions then failed: a newly started gesture could not change the already-open canvas. Two source-level cases separately failed with unavailable editing access. The negative case for a reservation denied by another editor already passed and remains unchanged in purpose.

An interrupted, previously connected board can now admit an explicit local action while its current account/session still permits editing and local storage is available. The action has a separate local identity, preserves its captured journal before release and obtains no online reservation. Starting a reconnect retires local admission before checking authority. Known expiry, read-only access, stale runtime, quarantine and storage pause block admission. History remains unavailable while disconnected; after unchanged replay it uses the fresh committed fragments. A separate failing unit assertion established that a retired local identity could be formatted as a remote header; that path now rejects it explicitly.

Native Chromium: **4/4**, 1.1 minutes, zero skips/retries. Unchanged and divergent cases each make two consecutive real pointer gestures while disconnected, assert no reserve/document-push requests and unchanged server content, and then verify safe replay with undo/redo/reopen or an isolated version choice. Quota and known-session-expiry cases retain prior journal rows and block further editing without publishing them. Focused source/history units passed 23/23 before the final local-token guard; full current regression and static checks are being run separately. Plan 05-05 remains open for the remaining concurrency, authority/epoch and recovery/storage race matrix.

Integrated checkpoint at `8157503`: **285/285 client**, 26 files, 12.44 seconds; **386/386 serialized server**, 19 files, 146.02 seconds; both TypeScript checks. The full selected Chromium matrix passes **33/33**, 6.0 minutes, zero skips/retries: thirteen recovery cases, four outage-editing cases, ten history cases, two clean-history reconnects, three consecutive-formatting races and cold Viewer-first opening after a real restore. No application/test changes occurred during these gates. The new outage/race matrix also passes **12/12 Firefox/WebKit**, 2.6 minutes, zero skips/retries or unexpected browser errors. See [remaining acceptance matrix](05-05-MATRIX.md).
