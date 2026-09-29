---
phase: 04-durable-boards-and-recovery
reviewed: 2026-09-28
depth: standard
review_mode: inline
source_head: 0b9f05af88b5459587c5cb808af030acbddc02ba
files_reviewed: 43
files_reviewed_list:
  - server/storage/database.ts
  - server/storage/lifecycle.ts
  - server/storage/recovery-state.ts
  - server/storage/write-admission.ts
  - server/storage/backup.ts
  - server/storage/backup-validation.ts
  - server/storage/backup-scheduler.ts
  - server/storage/restore.ts
  - server/operator.ts
  - server/app.ts
  - server/boards/documents.ts
  - server/boards/blobs.ts
  - server/boards/routes.ts
  - server/boards/actions.ts
  - server/boards/grants.ts
  - server/boards/imports.ts
  - src/canvas/runtime.ts
  - src/canvas/account/acknowledged-update.ts
  - src/canvas/account/outbox.ts
  - src/canvas/account/recovery.ts
  - src/canvas/account/title-intent.ts
  - src/canvas/account/local-capture.ts
  - src/canvas/account/doc-source.ts
  - src/canvas/account/blob-source.ts
  - src/canvas/account/mutation-guard.ts
  - src/canvas/account/board-workspace.ts
  - src/canvas/save-status.ts
  - src/canvas/recovery-archive.ts
  - src/canvas/RecoveryStateView.tsx
  - src/auth/session.ts
  - src/boards/import-local.ts
  - src/boards/operations.ts
  - src/boards/pending-recovery.ts
  - src/header/SaveDetails.tsx
  - src/header/Header.tsx
  - src/header/LeaveRecoveryDialog.tsx
  - src/App.tsx
  - tests/recovery-ui-matrix-reporter.ts
  - tests/recovery-ui-matrix-support.ts
  - Dockerfile
  - deploy/nginx.conf
  - scripts/deployment-smoke.mjs
  - scripts/recovery-drill.mjs
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
---

# Phase 4: Code review

## Narrative Findings (AI reviewer)

No additional actionable defect was established in the reviewed Phase 4 changes. Review was performed inline by the implementing agent; an independent reviewer was not used. Scope includes the listed implementation files and their relevant changed call paths, with supporting test and deployment-document inspection. This is a scoped review rather than a claim that every repository file was exhaustively audited.

The review followed acknowledgment and persistence boundaries through document/image transactions, immutable local journal records, exact receipt handling, title revision reconciliation, current authorization and recovery epochs. It also traced backup publication, freshness admission, operator-selected restoration, restored-session invalidation and one-writer deployment assumptions.

For UI and evidence boundaries, review covered storage-error propagation, retained pending work during export/navigation, account-isolated markers, Viewer hydration, and the matrix reporter's required scenarios, predicate coverage, skipped/retried results and source-content identity. The quota-identity and preview-contrast defects discovered during execution have already been corrected and covered by the final focused gate.

## Validation and limits

## Complete gate at 3e9d68b

The complete frozen-source run returned **2,051 passed, one failed, zero skipped and zero retries out of 2,052 selected cases (1.9 hours)**. Revision: `3e9d68b71290988112a51742d227b6fbdf795d9c`; digest: `bf8e75b776bd8eab87457ad855560f0a8fcd9c19236eb2cfadd27c9793f4fc5d`. The reporter confirmed stable source identity; pre-existing `package.json` changes are included. Chromium and Firefox each supplied all 13 scenarios and 36 predicates. WebKit supplied 12 passing scenarios and 31 predicates; the failed details-cardinality scenario withholds E1/overflow, E1/long-text, E2/overflow, E2/zero-one-many and E2/long-text.

The remaining failure is `tests/recovery-ui-matrix.spec.ts:233` in production WebKit. Its assertions completed, but the strict error collector captured unexpected blob-read and session-read access-control page errors. Blob-read frames lead through the account blob source into canvas rendering; session frames lead through the recovery coordinator's image-failure retry. The exact rejected-promise/lifecycle boundary remains unresolved. The pagehide correction passed its fail-first regression, 88 repeated focused cases and its full-run cases, but does not resolve this remaining error class. The earlier classical-shape and connector-label full-run failures passed in this run.

No error allowlist, test retry, skip or weakened oracle was introduced. No complete-gate run remains active. Phase 4 stays open under G-04-38; autonomous continuation awaits the required retry/skip/stop choice. Seven scoped judgments and native acceptance remain accepted.


### Plan 04-17 incremental inline review

Latest lifecycle continuation: reviewed `src/auth/session.ts` and `tests/recovery-pagehide.spec.ts` through scope suspension, request abort, journal preservation, persisted-page reauthorization and listener cleanup. The pagehide handler aborts synchronously and preserves unacknowledged content without marking it saved. A transition guard prevents late preservation errors from overwriting a newer session transition. The new test proves cancellation, read-only state, retained pending records and eventual acknowledgment. Initial WebKit evidence is four passes; repeated cross-engine verification subsequently passed 88/88 with zero skips/retries or unexpected errors. Both static checks and 236 client tests pass. No additional actionable finding was identified in this delta; the full gate remains open.

The complete run at `6296526` was stopped with 1,604 passes, two WebKit reload request errors, one interrupted case and 429 unrun cases. The findings below preserve their earlier scope and do not constitute full acceptance.

Reviewed `src/canvas/blocksuite-editor.ts`, `tests/local-recovery.spec.ts`, `tests/connector-labels.spec.ts`, and `tests/fixtures.ts`, including the pinned native cursor/range notification and dispatcher lifecycle. No additional actionable finding was identified. Cursor notification remains synchronous, dispatcher state is restored in `finally`, and editor destruction restores the original method. Actual pointer dispatch remains enabled. The stronger focus oracle first failed against the original application, then passed all eight project/repetition combinations. The clock correction preserves the geometry/timeout oracle, and stack capture leaves the strict error check intact.

Final focused evidence: 32/32 passed, zero skips/retries; 236/236 client tests and both static checks passed. The earlier WebKit session-request error remains causally unresolved and did not reproduce. This review is inline, with full regression still pending; it does not close G-04-38. See [04-17 diagnosis](04-17-DIAGNOSIS.md) (root-cause evidence, rejected broad guard, and remaining uncertainty).

Current continuation: the complete `e93b933` gate failed (2,029/2,036 passed). Test-fixture corrections are committed in `c06600b`; repeated focused validation passes 31/32 and exposes a WebKit recovery-focus failure. Two earlier runtime errors did not reproduce in those repetitions. The historical clean review below does not resolve these runtime findings; G-04-38 and 04-17 retain them. Phase 4 is not accepted.

UAT subsequently found that scope suspension wrote acknowledged full snapshots back into the pending journal. The correction in `0b9f05a` was reviewed through the confirmed-document ledger, synchronous capture and suspension lifecycle: only uncovered state is captured, and existing pending records are retained. A fail-first native regression proves the Saved-to-library transition; three-engine tests also verify quota failure for genuinely unsaved work. The 236 client and 311 server suites and both static checks passed again. The complete regression is running on this corrected revision.

The 156-case production-engine recovery gate, 236 client tests, 311 server tests, production build and 126-case access suite passed at the reviewed source. The complete 2,012-case browser regression is still running when this review is written; its final result belongs in the acceptance report and verification artifact.

Native 200% zoom and visible tab-close outcomes remain manual acceptance items. Independent storage/capacity, actual-provider setup and spoken assistive-technology checks retain their approved backlog scope. These acceptance limits are recorded separately from code findings.

The source-history scan from the Phase 4 base through the reviewed head found no match for the inspected private-path, token/private-key and private-domain patterns in added lines. Documentation and fixtures use synthetic examples. This bounded scan supplements review of the changed content; operator-owned configuration and private drill artifacts remain outside the repository.

Sources: [acceptance report](../../../docs/recovery-acceptance.md) (executed predicates and acceptance limits), [04-16 summary](04-16-SUMMARY.md) (implementation changes and test results), [local Kubernetes validation](04-LOCAL-KUBERNETES-VALIDATION.md) (retained operational scope).
