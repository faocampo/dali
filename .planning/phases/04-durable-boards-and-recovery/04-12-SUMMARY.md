---
phase: 04-durable-boards-and-recovery
plan: "12"
subsystem: recovery
tags: [sqlite, restore, access, epoch, browser, operator]
requires:
  - phase: 04-02
    provides: Authorized epoch-bound durable routes
  - phase: 04-10
    provides: Complete verified backup sets
  - phase: 04-11
    provides: Current-epoch backup scheduling and write admission
provides:
  - Explicit selected-backup fresh-target restore and offline verification CLI
  - Session invalidation, random epoch rotation and reset backup coverage
  - Native cold-browser restore, access reconciliation and retained old-journal proof
  - Ordered operator runbook with production decision checkpoints
affects: [04-13, 04-14, 04-15, 04-16]
tech-stack:
  added: []
  patterns: [Offline verified fresh-target publication, explicit fencing attestation, closed-ingress access verification]
key-files:
  created: [server/storage/restore.ts, server/storage/restore.test.ts, server/operator.ts, tests/restored-board.spec.ts]
  modified: [server/storage/recovery-state.ts, tests/durability-fixtures.ts, docs/operations.md]
key-decisions:
  - Require an explicitly selected complete backup and expected manifest digest; never automatically choose a recovery point or reopen ingress.
  - Treat writer fencing as externally verified operator evidence; the synthetic drill awaits actual owned application and database shutdown.
  - Reconcile post-point access changes before startup and require renewed current-epoch backup coverage before durable writes.
requirements-covered: [OPS-02, SAVE-01, SAVE-02]
requirements-completed: []
coverage:
  - id: D-15
    description: Explicit fresh-target restore clears authentication state and rotates epoch while preserving stable content/access relationships
    requirement: OPS-02
    verification:
      - kind: integration
        ref: server/storage/restore.test.ts#@04-12-01
        status: pass
    human_judgment: false
  - id: D-14
    description: Native cold authorized reopen and byte-exact images after synthetic selected restore
    requirement: SAVE-01
    verification:
      - kind: e2e
        ref: tests/restored-board.spec.ts#@04-12-02
        status: pass
    human_judgment: false
  - id: restore-production-gate
    description: Production fencing, independent storage, private configuration recovery, access ledger completeness and representative RPO/RTO acceptance
    requirement: OPS-02
    verification: []
    human_judgment: true
    rationale: The local synthetic drill cannot establish the operator deployment's failure domain or recovery envelope; these retain the approved external gates.
actuals:
  tokens: 12650
  tasks: 2
  commits: 4
plan_head_before: 59a6ebc65db955bbddade7277b98eb5b79a3ffa2
duration: 15min
completed: 2026-09-26
status: complete
---

# Phase 04 Plan 12: Selected Fresh-Target Restore Summary

**Verified selected SQLite backups restore into fresh storage with cleared sessions, a new recovery epoch and cold-browser content/access proof before the operator reopens ingress.**

## Accomplishments

- `restoreBackup()` requires a selected complete set, expected manifest SHA-256, maintenance confirmation, source database location, empty private destination and bounded writer-fencing evidence. `inspectSelectedBackup()` validates only the selected set; the CLI never chooses a backup automatically.
- Backup validation checks supported migrations, SQLite integrity/foreign keys, decoded document bindings, image hashes and metadata relationships. The copied database is verified again in exclusive sibling staging before writable migration. Migration-8 copies gain compatible schedule metadata; migration-9 copies remain supported.
- Restore clears login transactions before sessions, rotates a cryptographically random epoch and resets prior backup coverage while retaining members, owners, grants, documents, images and receipts. It flushes the prepared database/report, then renames into the still-empty target. Source storage and published backups remain untouched.
- `verifyRestore()` checks the offline target, standalone file set, integrity counters, report/epoch consistency and empty authentication tables. Unexpected WAL/SHM, symlinks, nonempty destinations, incomplete/corrupt sets, missing confirmations and future-dated recovery points fail closed. Errors and CLI output contain sanitized aggregate data.
- The import-safe operator CLI implements `inspect`, `restore` and `verify`. The runbook separates offline verification, private service startup, post-point access reconciliation, renewed backup coverage, signed cold-browser checks and deliberate ingress reopening. Destructive real replacement, incompatible schema changes and old-storage deletion remain explicit operator decision checkpoints.
- The native drill runs an owned file-backed service with signed synthetic OIDC and production browser assets. It saves a native sticky note/PNG, proves a separate planned restart, selects a real backup, acknowledges a later title change, retains offline work in IndexedDB, shuts down the writer, restores fresh storage and reconciles a post-point revoked grant before startup.
- Cold Owner/Editor/Viewer profiles reopen selected content and exact PNG bytes. The revoked identity cannot retrieve the board or image; old cookies fail. Current-epoch writes respect roles. The old browser sees the restore warning, stale submissions fail, and explicitly opening the restored board retains the old journal. The real scheduler publishes a new-epoch baseline and another timed backup before the fixture explicitly reopens public ingress.

## Task Commits

1. **04-12-01 — offline selected restore:** `02f62a4` (RED), `c491d83` (GREEN).
2. **04-12-02 — native access and runbook proof:** `8ce99a0` (RED), `ec26cbf` (GREEN).

Four implementation/test commits and 12,650 diff-character tokens were measured from the persisted plan ledger before documentation commits. Seven implementation/test/documentation files changed. The 15-minute duration runs from the first recorded execution timestamp through final source completion; initial context loading is excluded.

## TDD Gate Compliance

| Task | Intentional RED | Final GREEN |
|---|---|---|
| 04-12-01 | A real signed/file-backed restore assertion rejected at its compile-safe unimplemented boundary instead of resolving a verified report. | Eleven selected restore/CLI/clock cases pass. |
| 04-12-02 | A native browser saved a note/image and retained offline work, then its selected-restore assertion rejected at the unimplemented drill boundary. | Native cold role/image/session/epoch/journal and ingress sequence passes. |

Both persisted RED records passed `check tdd-red-evidence` with `RED_EVIDENCE_OK`; records disclose normalization of observed Vitest/Playwright assertions into the classifier's TAP format. Each test commit precedes its corresponding implementation commit. A sandbox loopback denial and a test rename-field error were corrected before accepting RED evidence. No packages were installed and commit hooks were retained.

## Verification

- Exact task-1 command, `npm run test:server -- server/storage/restore.test.ts -t @04-12-01`: **11 passed, zero skipped**, 11.01 seconds including startup. Coverage includes explicit CLI invocation, actual preexisting login transactions, session invalidation, source byte preservation, digest/corruption/completion/fencing/destination rejection and future-clock refusal.
- Exact task-2 command, `npm exec playwright test -- tests/restored-board.spec.ts --project=prod --grep @04-12-02`: **1 passed, zero skipped**, 31.6 seconds including production build/fixture startup; native test body 13.1 seconds.
- Final combined production Chromium restore/restart regression: **3 passed, zero skipped**, 38.6 seconds including startup, after the clock guard. Existing SIGKILL/cold-sign-in and normal-restart/denied-account cases also pass. Restore test body: 13.0 seconds.
- Full server regression before the added future-clock guard: **300 passed, zero skipped**, 13 files, 20.51 seconds. The subsequent exact 11-case restore suite covers the final guard. No broad-suite claim is made for the added eleventh restore case.
- Both `npm run typecheck` and `npm run typecheck:server` passed for both tasks and final source changes. `git diff --check` passed. No tracked files were deleted.

### Measured synthetic recovery evidence

Final browser output records real wall-clock elapsed time, with no simulated clock:

| Measurement | Observed |
|---|---:|
| Planned maintenance, close through cold content/image verification and reopen | 1,419 ms |
| Disaster recovery, incident/close through restore, cold access checks and reopen | 6,662 ms |
| Conservative selected recovery-point age at incident | 64 ms |
| Retained acknowledged canaries | 2: native note and image |
| Lost acknowledged canaries | 1: post-selection title change; original title and absence of its receipt verified |
| Oldest lost acknowledgment age at incident | 35 ms |

These measurements meet one hour/24 hours for this small synthetic local dataset only. The drill uses real SQLite files, backup publication, browser profiles, signed authentication and scheduler timers, but its old/new/backup directories share test infrastructure. It does not establish production failure-domain independence, representative volume/throughput, storage-loss provisioning, private secret restoration or provider acceptance.

## Deviations from Plan

1. **[Rule 1 — restore clock validation] Reject future recovery points before publication.** A final negative test showed restore could publish a report whose restore time preceded its selected backup, which offline verification would reject. Restore now checks time both before staging and before report publication. The new test observed the wrong resolution, then passed with an unchanged target. Files: `server/storage/restore.ts`, `server/storage/restore.test.ts`; commit: `ec26cbf`. Broken-windows entry 17 records this correction.
2. **[Rule 3 — native fixture reliability] Correct the rename revision field and explicit synthetic identity selection.** The test now sends the current descriptor's `revision`, clears only the remembered synthetic-provider identity before reauthentication and bounds action waits. One owned browser run was interrupted during the remembered-identity wait; the final exact and regression runs pass. Files: `tests/restored-board.spec.ts`; commits: `8ce99a0`, `ec26cbf`.

## Interfaces for Following Plans

- `restoreBackup({backup, destination, sourceDatabase, expectedManifestDigest, maintenanceConfirmed, fencing: {method, evidence}})` returns a sanitized `RestoreReport`; fencing method is `writer-stopped` or `storage-fenced`. The evidence is an operator attestation, not remote-process discovery.
- `inspectSelectedBackup(backup, expectedManifestDigest?)` returns the selected verified ID/manifest and manifest digest. `verifyRestore(destination)` runs offline before service startup. `resetRestoredRecoveryState(database)` is the offline transaction that clears sessions, rotates epoch and resets coverage.
- The CLI supports `--backup`, `--destination`, `--source-database`, `--expected-manifest-digest`, `--maintenance-confirmed`, `--writer-fenced` and `--fence-evidence`, with strict command-specific option parsing and nonzero sanitized failures.
- Parent directories/ancestors must remain operator-controlled. The source parent must exist for canonical path comparison even if its database was lost. A post-publication flush failure can leave a complete fresh target for explicit inspection, with ingress still closed.
- Post-point access reconciliation is an operator ledger responsibility and must complete before ordinary sign-in can activate restored pending grants. Offline verification describes the pre-start target; verify authorized service behavior after reconciliation/startup separately.

## Acceptance Limits and Next Work

Requirement-wide OPS-02, SAVE-01 and SAVE-02 acceptance remains with the phase verifier. The two descriptor-less operator-selection/RPO/RTO prohibitions remain judgment items despite supporting tests. Real destructive operations, incompatible schema changes and deletion of old storage were not executed. External infrastructure gates remain owned by the deployment/recovery acceptance plans. Next dependency-ordered plan: **04-13**.

## Documentation Consulted

Node.js filesystem API ([https://nodejs.org/api/fs.html](https://nodejs.org/api/fs.html)), fetched through Context7: exclusive creation, `O_NOFOLLOW`, file/directory synchronization and copy-exclusion semantics. Existing repository backup, scheduling and access interfaces supplied the remaining implementation contracts.

## Self-Check: PASSED

All four new artifacts and three modified artifacts exist; all four task commits exist. Stub scan found no remaining implementation placeholder. The new offline filesystem/restore surface is covered by the declared restore threat boundary; no production network endpoint or authentication bypass was introduced. Public evidence uses synthetic identities and aggregate measurements.
