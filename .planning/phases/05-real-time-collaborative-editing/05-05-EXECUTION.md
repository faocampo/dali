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
