---
phase: 04-durable-boards-and-recovery
plan: "16"
subsystem: recovery-acceptance
tags: [playwright, indexeddb, recovery, accessibility, evidence]
requires:
  - phase: 04-15
    provides: Accepted local Kubernetes recovery scope and corrected cold Viewer rendering
provides:
  - Explicit runtime assertions for all 36 approved recovery UI predicates
  - Three-engine evidence gate with stable source identity and required scenario counts
  - Distinct access-check progress and quota guidance with corrected preview contrast
affects: [phase-4-verification]
tech-stack:
  added: []
  patterns: [Per-scenario evidence attachments, fail-closed aggregate coverage, typed storage failure propagation]
key-files:
  created: [tests/recovery-ui-matrix.spec.ts, tests/recovery-ui-matrix-support.ts, tests/recovery-ui-matrix-reporter.ts, docs/recovery-acceptance.md]
  modified: [playwright.config.ts, src/App.tsx, src/canvas/runtime.ts, src/canvas/account/outbox.ts, src/canvas/account/recovery.ts, src/canvas/account/title-intent.ts, src/header/SaveDetails.tsx, src/index.css, src/canvas/account/recovery.test.ts, src/header/SaveDetails.test.ts, tests/board-access.spec.ts]
requirements-covered: [SAVE-01, SAVE-02, OPS-01, OPS-02]
requirements-completed: []
candidate_source_head: 0b9f05af88b5459587c5cb808af030acbddc02ba
candidate_worktree_changes: true
status: in_progress
coverage:
  - id: recovery-ui-36
    description: All 36 recovery surface/category predicates in three production browser engines
    requirement: SAVE-02
    verification:
      - kind: automated_ui
        ref: tests/recovery-ui-matrix.spec.ts
        status: pass
    human_judgment: false
  - id: native-recovery-acceptance
    description: Native tab-close warning acceptance; 200 percent zoom passed by user report
    requirement: SAVE-02
    verification: []
    human_judgment: true
    rationale: The user reported native 200 percent zoom and saving passed. The user also confirmed the native tab-close test passed; browser/version was not supplied. Reload dialogs passed in automated real-browser execution.
---

# Plan 04-16 — Recovery acceptance

## Complete gate at 3e9d68b

The complete frozen-source run returned **2,051 passed, one failed, zero skipped and zero retries out of 2,052 selected cases (1.9 hours)**. Revision: `3e9d68b71290988112a51742d227b6fbdf795d9c`; digest: `bf8e75b776bd8eab87457ad855560f0a8fcd9c19236eb2cfadd27c9793f4fc5d`. The reporter confirmed stable source identity; pre-existing `package.json` changes are included. Chromium and Firefox each supplied all 13 scenarios and 36 predicates. WebKit supplied 12 passing scenarios and 31 predicates; the failed details-cardinality scenario withholds E1/overflow, E1/long-text, E2/overflow, E2/zero-one-many and E2/long-text.

The remaining failure is `tests/recovery-ui-matrix.spec.ts:233` in production WebKit. Its assertions completed, but the strict error collector captured unexpected blob-read and session-read access-control page errors. Blob-read frames lead through the account blob source into canvas rendering; session frames lead through the recovery coordinator's image-failure retry. The exact rejected-promise/lifecycle boundary remains unresolved. The pagehide correction passed its fail-first regression, 88 repeated focused cases and its full-run cases, but does not resolve this remaining error class. The earlier classical-shape and connector-label full-run failures passed in this run.

No error allowlist, test retry, skip or weakened oracle was introduced. No complete-gate run remains active. Phase 4 stays open under G-04-38; autonomous continuation awaits the required retry/skip/stop choice. Seven scoped judgments and native acceptance remain accepted.

Earlier validation results below retain their original scope. Plan 04-16 remains in progress.

## Delivered behavior

- Thirteen explicit matrix scenarios cover status/details, image rows, recovery archives, access and restoration states, leave confirmation and library markers. Layout checks cover 1440, 900, 600, 490 and 320 CSS pixels, long labels, zero/one/50 rows, reduced motion, focus and rendered contrast.
- Required project/scenario/predicate counts, zero required skips/retries and a stable tracked source-content digest guard the aggregate result. Failed scenarios contribute no passing predicate keys.
- Authorization checks display Checking access before ordinary board opening. Typed quota failures survive IndexedDB callback aborts and coordinator wrappers, allowing accurate storage-full guidance. Library preview fallback text uses the design-system ink color after a measured contrast failure.

## RED and corrections

The first runs reproduced incorrect authorization copy and lost quota-error identity. Fixture corrections scoped expected injected image errors, disambiguated headings, compared parsed native JSON, created repeat fixtures without resetting authentication, and enabled reduced motion before interactions.

The three-engine run at `989696f` passed 153/156 with the same E6 contrast check failing in every engine. A gradient-aware check then measured 3.78:1 for preview fallback text. The CSS correction passed three focused engine cases and the complete final 156-case matrix.

## Current validation

| Gate | Observed result |
|---|---|
| Focused five-suite recovery gate | 156 selected / 156 passed / zero failed or skipped, 6.5 minutes |
| Matrix coverage | 13 scenarios and 36 predicates in each of prod, prod-firefox and prod-webkit |
| Tracked source digest | `bc4b47d9d47fa7b34f302b5aa38dc97d8513d619a61e0fb33ea601b9cac8cc5f` |
| Client unit suite | 236/236 across 20 files |
| Serialized server suite | 311/311 across 14 files, including representative real backup/restore I/O |
| Production build | Passed |
| Standalone access suite | 126/126, zero skipped, 10.5 minutes |
| Earlier full browser regression | Interrupted for UAT marker defect; 878 passed, one interrupted, 1,131 unrun out of 2,012 |
| Final full browser regression | Running again on `0b9f05a`; includes new saved-navigation regression |
| Native 200% zoom | Passed by user report; browser identification pending |
| Native warning | Real reload beforeunload dialogs passed in three engines; visible native tab-close passed by user report |

The tested tree includes pre-existing package-script changes. Those user changes are preserved and excluded from this plan's commits. The retained Kubernetes image predates the current corrections; earlier local cluster measurements retain their original revision scope.

## Task commits

- `4165ce4` — explicit UI acceptance predicates and aggregate reporter.
- `4aa9f2b` — quota failure identity and access-check progress.
- `989696f` — stable recovery fixtures and source-mapped evidence.
- `254ac6b` — preview fallback contrast over canvas dots.
- `0b9f05a` — navigation preserves only unacknowledged documents, preventing false pending library cards.

## UAT correction during final regression

The user confirmed native 200% zoom and saving worked, then reported a saved board marked pending in the library. A new native browser regression first failed with one marker where zero was expected: leaving a saved board unconditionally captured two full snapshots as new pending work. Navigation now tests the exact current documents against server-confirmed update/deletion coverage before capture. Existing unresolved records remain intact.

The restarted broad run exposed two older assertions awaiting correction after the run: `board-access.spec.ts` expects two redundant pending snapshots after leaving a saved board, and `community.spec.ts` expects the old generic storage message instead of the quota-specific guidance. Their observed differences are zero pending snapshots and the correct storage-full message. Source and tests remain frozen while collecting the full run's results; no final passing broad gate is claimed.

The focused navigation/library/session run passed 114/117; the three failures were the same old quota fixture expecting preservation failure for an already-saved board. That fixture now creates a genuinely unacknowledged edit after storage failure and verifies unchanged server bytes. Both the new navigation regression and corrected quota case pass in Chromium, Firefox and WebKit: 6/6. Both static checks, 236 client tests and 311 serialized server tests subsequently passed. The complete browser gate is running again on the committed correction.

## Deviations and acceptance limits

The support/reporter modules separate reusable assertions and evidence accounting from the scenario file. Product faults discovered by the matrix were corrected in their existing runtime/UI owners. No dependency installation was required.

Independent storage failure-domain and retention-capacity acceptance remains deferred to 999.6; real-provider and spoken assistive-technology acceptance remain in 999.4 and 999.3. Native manual checks passed by user report, and all seven scoped prohibition dispositions were explicitly accepted. Phase 4 requirements remain unchecked until their acceptance gate is reconciled.

Sources: [acceptance report](../../../docs/recovery-acceptance.md) (36 predicates, decisions, threat probes and remaining gates), [plan](04-16-PLAN.md) (approved task and native acceptance contract), [local Kubernetes evidence](04-LOCAL-KUBERNETES-VALIDATION.md) (retained measured local scope).

## Final regression continuation

Completed result supersedes the running paragraph below: 2,029 passed, seven failed, zero skipped. After correcting loading-stage and replay-setup fixtures, 31/32 repeated focused cases pass; one WebKit focus-retention assertion still fails. Earlier runtime errors did not recur in those repetitions. Plan 04-17 owns G-04-38 and final regression closure. Both static checks pass; requirements remain unaccepted at phase level.

At `e93b933`, stale journal/quota assertions were corrected after reproducing both failures. The two cases pass in all three production browser engines (6/6); both typechecks, 236 client tests and 311 serialized server tests pass. The complete 2,036-case browser run is in progress with the strict recovery UI matrix reporter. User acceptance covers native 200% zoom, tab-close warning and all seven scoped prohibition dispositions; infrastructure/provider/speech deferrals remain unchanged.
