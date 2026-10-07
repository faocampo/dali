---
phase: "04"
slug: durable-boards-and-recovery
status: verified
threats_open: 0
asvs_level: 1
created: "2026-09-28"
review_mode: inline
source_head: e93b933
---

# Phase 4 — Threat mitigation verification

This is the L1 verification of the 18 threats authored in the approved plans. It checks the declared mitigation boundaries in source and their named behavioral evidence. It is scoped to Phase 4; final full-regression acceptance is recorded separately in [recovery acceptance](../../../docs/recovery-acceptance.md).

## Threat register

All entries have high severity. CLOSED means the declared implementation mitigation exists, with the explicitly accepted infrastructure exception below.

| Threat | Boundary and verified mitigation | Evidence | Status |
|---|---|---|---|
| T-04-01-01 | Database commit precedes acknowledgment; persistent WAL/FULL is checked at startup. | `server/storage/database.ts`, `server/boards/documents.ts`, `server/storage/durability.test.ts`, `tests/durable-restart.spec.ts` | CLOSED |
| T-04-02-01 | Random recovery epoch is checked inside mutation transactions after current authorization. | `server/storage/recovery-state.ts`, `server/boards/recovery.test.ts` | CLOSED |
| T-04-03-01 | Journal schema/scope validation, transaction completion, immutable IDs and exact acknowledgment preserve uncertain work. | `src/canvas/account/outbox.ts`, `outbox.test.ts`, `tests/local-recovery.spec.ts` | CLOSED |
| T-04-04-01 | Current authority precedes recovery; generation/epoch checks and mutation pause reject stale callbacks. | `src/canvas/account/recovery.ts`, `mutation-guard.ts`, their unit suites and `tests/local-recovery.spec.ts` | CLOSED |
| T-04-05-01 | Only acknowledged current document/title/image coverage establishes Saved. | `src/canvas/save-status.ts`, `acknowledged-update.ts`, `tests/save-status.spec.ts` | CLOSED |
| T-04-06-01 | Archive captures immutable content and scope, validates required images and rechecks authority before handoff. | `src/canvas/recovery-archive.ts`, its unit suite and `tests/recovery-archive.spec.ts` | CLOSED |
| T-04-07-01 | Names render as escaped text; labels are bounded, thumbnails scoped, object URLs disposed. | `src/header/SaveDetails.tsx`, `tests/save-details.spec.ts` | CLOSED |
| T-04-08-01 | Title intent and destination remain immutable; leaving preserves unresolved records and discloses failed preservation. | `src/canvas/account/title-intent.ts`, `src/header/LeaveRecoveryDialog.tsx`, `tests/recovery-navigation.spec.ts` | CLOSED |
| T-04-09-01 | Library recovery metadata is filtered through current authorized cards and current account scope. | `src/boards/pending-recovery.ts`, `src/boards/BoardLibrary.tsx`, `tests/library-recovery.spec.ts` | CLOSED |
| T-04-10-01 | Restricted backup publication validates integrity, references and digest before atomic completion. Independent storage proof is explicitly deferred. | `server/storage/backup.ts`, `backup-validation.ts`, `backup.test.ts`; accepted risk R1 | CLOSED |
| T-04-11-01 | Verified backup age governs commit-time mutation admission; read and repair paths remain available. | `server/storage/backup-scheduler.ts`, `write-admission.ts`, their unit suites, `tests/backup-fence.spec.ts` | CLOSED |
| T-04-12-01 | Explicit selected backup, fresh destination, fencing evidence, session invalidation and epoch rotation precede reopened service. | `server/storage/restore.ts`, `server/operator.ts`, `tests/restored-board.spec.ts`, `docs/operations.md` | CLOSED |
| T-04-13-01 | Pinned production images exclude fixture services; proxy trust is loopback-only and secure runtime is exercised. | `Dockerfile`, `.dockerignore`, `server/storage/lifecycle.ts`, `server/preflight.test.ts`, `04-13-SUMMARY.md` | CLOSED |
| T-04-SC | Recorded registry source/integrity and official image digest checks preceded clean installation; no dependency upgrade in this continuation. | `04-13-CHECKPOINT.md`, `04-13-SUMMARY.md`, pinned `Dockerfile` and lockfile | CLOSED |
| T-04-14-01 | One Recreate writer, restricted pods, TLS, external secrets and network allowlists; real local replacement-pod checks. | `deploy/kubernetes/base/`, `scripts/deployment-smoke.mjs`, `04-LOCAL-KUBERNETES-VALIDATION.md` | CLOSED |
| T-04-15-01 | Drill requires explicit context, synthetic ownership, selected digest and fenced fresh restore target. | `scripts/recovery-drill.mjs`, `server/testing/recovery-dataset.ts`, `server/storage/operations-drill.test.ts` | CLOSED |
| T-04-15-02 | Real freshness rejection preserves pending content and images; resumed replay rechecks authority and acknowledgment. | `tests/backup-fence.spec.ts`, recovery coordinator and save-status reducer | CLOSED |
| T-04-16-01 | Reporter rejects absent scenarios/predicates, retries/skips and changed revision/content identity. | `tests/recovery-ui-matrix-reporter.ts`, `tests/recovery-ui-matrix.spec.ts`; full-run outcome remains a separate gate | CLOSED |

## Accepted risks and evidence limits

| Risk | Threat references | Scope | Accepted by | Date |
|---|---|---|---|---|
| R1 | T-04-10-01, T-04-14-01, T-04-15-01 | Independent failure-domain and retention-capacity validation deferred to backlog 999.6. Local Kubernetes evidence retains its measured scope and original image revision. | User | 2026-09-27 |

Actual-provider configuration and speech-based assistive technology remain approved backlog items 999.4 and 999.3. Source existence, local runtime checks and deferred infrastructure checks are distinct evidence classes. The seven scoped acceptance judgments were explicitly accepted on 2026-09-28. No private operator configuration or raw operational artifact is included.

## Audit trail

| Date | Threats | Closed | Open | Method |
|---|---|---|---|---|
| 2026-09-28 | 18 | 18 | 0 | Inline L1 source-boundary verification, named tests and retained scoped operational evidence |

Frontend/server typechecks, 236 client tests and 311 serialized server tests pass at the current source. The complete browser run is still a mandatory, separate acceptance gate; this L1 report does not declare it complete.
