---
phase: 04-durable-boards-and-recovery
plan: "11"
subsystem: backup
tags: [sqlite, backup, scheduler, retention, admission, recovery]
requires:
  - phase: 04-02
    provides: Authorized epoch-bound durable routes
  - phase: 04-10
    provides: Verified live-connection backup publication and inspection
provides:
  - Automatic serialized backup scheduling and conservative recovery-age health
  - Thirty-day complete-set retention after verified renewal
  - Transactional freshness admission across every durable API route and pending grant activation
affects: [04-05, 04-12, 04-13, 04-14, 04-15]
tech-stack:
  added: []
  patterns: [Monotonic conservative age, verified baseline admission, explicit fixture storage policy]
key-files:
  created: [server/storage/backup-scheduler.ts, server/storage/backup-scheduler.test.ts, server/storage/write-admission.ts, server/storage/write-admission.test.ts]
  modified: [server/storage/recovery-state.ts, server/storage/backup-validation.ts, server/app.ts, server/boards/routes.ts, server/boards/actions.ts, server/boards/imports.ts, server/boards/grants.ts, docs/operations.md]
key-decisions:
  - Persist schedule observations additively but independently inspect complete destination sets before establishing restart coverage.
  - Bind coverage to the current recovery epoch and use the greater of wall age and monotonic elapsed age; uncertain clocks require operator correction and restart.
  - Keep authentication available while deferring pending-grant activation during backup fencing; later validated sign-in retries activation.
  - Existing synthetic service fixtures explicitly inject their storage policy; production startup requires configured verified coverage.
requirements-covered: [OPS-01, OPS-02, SAVE-02]
requirements-completed: []
coverage:
  - id: D-12
    description: Verified backup age alerts at 45 minutes and rejects durable transactions at 60 minutes
    requirement: OPS-02
    verification:
      - kind: integration
        ref: server/storage/write-admission.test.ts#@04-11-03
        status: pass
    human_judgment: false
  - id: D-13
    description: Retention preserves complete sets for at least 30 days and the last good set on failure
    requirement: OPS-02
    verification:
      - kind: integration
        ref: server/storage/backup-scheduler.test.ts#@04-11-01
        status: pass
    human_judgment: false
  - id: D-15
    description: Automatic startup and timer scheduling serializes work and resumes due checks
    requirement: OPS-01
    verification:
      - kind: integration
        ref: server/storage/backup-scheduler.test.ts#@04-11-01
        status: pass
    human_judgment: false
actuals:
  tokens: 24058
  tasks: 3
  commits: 6
plan_head_before: b8f771c2b0c388dd5bfb6c70d8dacf4d770dd47d
duration: 16min
completed: 2026-09-26
status: complete
---

# Phase 04 Plan 11: Scheduled Backups and Recovery-Bound Admission Summary

**Verified SQLite backups run automatically, retain complete recovery points for at least 30 days, and fence durable writes when conservative recovery age reaches one hour.**

## Accomplishments

- `BackupScheduler` owns one serialized job per live application instance. Startup inspects the independent destination and publishes a missing/due current-epoch baseline. Duplicate starts share startup, overlapping checks share a job, missed timers produce one current publication, and shutdown cancels scheduling and waits before closing owned storage. A real timer/application lifecycle test exercises automatic publication and cancellation.
- Defaults are a 900,000 ms interval, 30-day retention, 2,700,000 ms alert and 3,600,000 ms maximum age. Configuration may tighten cadence/maximum age or extend retention. Invalid/missing configuration cannot silently open durable admission. The production entrypoint requires the directory and independent-storage assertion; publication failures retain read/authentication availability.
- Age comes from independently inspected complete snapshots. Its current value is the maximum of wall-clock age and monotonic elapsed age, bound to the live recovery epoch. Wall rollback, invalid clocks, significant wall/monotonic divergence and future backup timestamps fence. Restart checks the last persisted valid wall observation and destination timestamps. Failed attempts and local staging never refresh recovery age.
- Migration 9 adds `backup_point`, `backup_completed` and `backup_checked` to the existing recovery singleton. Validation accepts complete migration-8 and migration-9 backups, returning each copy's actual version. Schedule metadata alone never establishes coverage.
- Retention runs only after renewed, independently verified publication. It deletes verified complete sets strictly older than the configured completion-time window and older than the new recovery point, preserving the newest and newly verified sets. Partial/corrupt sets remain for operator review. Publication/deletion/flush failures expose sanitized health categories; failed publication never prunes.
- Authenticated expected-account `GET /api/storage-health` exposes state, reason, recovery-point timestamp, conservative age and a publication/retention failure category. Operator monitoring consumes this sanitized endpoint.
- `requireDurableWriteAdmission` runs inside synchronous write transactions after authority checks, rechecks the expected epoch and current health, and returns `503 {code: 'BACKUP_FRESHNESS_REQUIRED'}` with `Retry-After: 60`. The shared board guard covers document/image/thumbnail, rename/delete/duplicate and grant writes; create and import staging/publication call explicit guards. Requests crossing the age bound at their asynchronous commit barrier are rejected.
- Pending-grant activation consults the same freshness policy inside its identity transaction. Authentication remains available and a later validated sign-in retries deferred activation. Owner, role and revision checks remain intact.
- Existing injected service fixtures now explicitly select `storagePolicy: {kind: 'fixture'}`. Production configuration cannot enable that policy. Reusing an injected connection resets its policy before application setup, preventing inherited fixture admission.

## Task Commits

1. **04-11-01 — scheduling, retention and health:** `5382414` (RED), `7e28d08` (GREEN).
2. **04-11-02 — durable route admission:** `b3948bf` (RED), `1d529e0` (GREEN).
3. **04-11-03 — grants and full route/time proof:** `9458e05` (RED), `7587232` (GREEN).

Six task commits and 24,058 diff-character tokens were measured from the persisted plan ledger before documentation commits. The realized change touches 29 source/test/documentation files, including minimal explicit-policy updates to existing fixtures. Duration is 16 minutes from the first recorded RED run through the final source commit; initial context loading is excluded.

## TDD Gate Compliance

| Task | Observed RED | GREEN |
|---|---|---|
| 04-11-01 | The real-database startup contract rejected at an explicit compile-safe scheduling boundary instead of publishing a verified baseline. | Real publication, restart, retention, failure, clock and lifecycle cases pass. |
| 04-11-02 | A stale-coverage create returned 201 and changed durable storage instead of returning 503. | All non-grant mutation cases reject stale and crossing-bound commits, retain data and resume. |
| 04-11-03 | Signed authentication activated a pending grant and advanced its board revision while fenced. | Sign-in succeeds while grant activation remains deferred, then activates after renewed coverage. |

All three persisted evidence records passed `check tdd-red-evidence` with `RED_EVIDENCE_OK`. Records disclose normalization of observed Vitest assertions to the GSD parser's TAP format. Each GREEN commit follows its corresponding test commit; no packages were installed and normal commit hooks were retained.

## Verification

- Exact scheduler command: `npm run test:server -- server/storage/backup-scheduler.test.ts` — **16 passed, zero skipped**, 3.83 seconds including startup. Initial task-1 completion had 14 passing cases; task-3 integration added epoch-change and reused-policy checks.
- Exact admission command: `npm run test:server -- server/storage/write-admission.test.ts` — **113 passed, zero skipped**, 15.10 seconds including startup. Task-2 completion had 16 passing cases.
- Final full `npm run test:server` — **290 passed, zero skipped**, 12 files, 16.87 seconds including startup. This includes all existing authentication, board access, recovery, grant and real backup regressions.
- Both `npm run typecheck` and `npm run typecheck:server` passed for each task and after final source changes. `git diff --check` passed. No tracked files were deleted.
- The 95-case matrix covers **19 durable cases × five time states**: fresh, 59:59, 60:00, a delayed commit crossing the boundary, and resumed verified backup. Cases cover create; root/content pushes; image put/delete; thumbnail; rename/delete/duplicate; import stage/document/image/commit; and active/pending grant create/patch/revoke. Every rejection compares all durable board, document, image, thumbnail, grant, stage and receipt tables before/after. Authentication-session maintenance is intentionally outside that application-data snapshot.
- The matrix publishes and independently inspects real SQLite copies. Clock advancement is deterministic and the scheduler timer is explicitly suppressed in these boundary tests; a separate real timer lifecycle case verifies automatic scheduling. These distinctions do not establish production infrastructure guarantees.
- Scheduler tests cover exact 15-minute due checks, duplicate start, overlapping work, missed wakeups, restart, 31-day pruning with exact 30-day retention boundary, partial-set preservation, injected publication/disk-full and deletion failures, missing destination, forged completion metadata, stale coverage, invalid clocks and renewed admission.
- Earlier task-3 matrix run passed 103/113 and exposed 10 pending-grant router-limit failures. The documented bounded router correction resolved all ten; the final 113/113 and 290/290 results supersede that run.

## Deviations from Plan

1. **[Rule 2 — schema integration] Preserve prior backup compatibility.** Adding schedule columns required the backup validator to recognize migration 9 while continuing to accept complete migration-8 copies. File: `server/storage/backup-validation.ts`; commit: `7e28d08`.
2. **[Rule 2 — explicit fixture contracts] Update existing injected services.** Default-deny admission required existing synthetic tests and owned browser/process fixtures to declare their deterministic storage policy. This preserves earlier capability tests while keeping production policy explicit. Files: existing server tests, `server/testing/durability-child.ts` and browser/provider fixtures; commit: `1d529e0`.
3. **[Rule 3 — pending-grant routing] Raise the bounded route-parameter limit.** Required pending-grant PATCH/DELETE IDs encode issuer/email and exceeded Fastify's default 100-character limit, returning 414 before the handler. `routerOptions.maxParamLength: 8192` lets these existing identifiers reach authorization and admission. The five-state matrix verifies both pending routes. File: `server/app.ts`; commit: `7587232`. Broken-windows entry 15 records this correction as fixed.
4. **[Rule 2 — authority integration] Bind health to the current epoch and reset reused policies.** A current request epoch cannot use coverage from another epoch, and application reuse cannot inherit a prior fixture policy. Files: `server/storage/backup-scheduler.ts`, `server/app.ts`, scheduler tests; commit: `7587232`.

## Interfaces for Following Plans

- `readStorageConfig(env)` returns `{destination, intervalMs, retentionDays, alertAgeMs, maxAgeMs}`. Required settings are `DALI_BACKUP_DIRECTORY` and `DALI_BACKUP_INDEPENDENT_STORAGE=true`; optional numeric settings are `DALI_BACKUP_INTERVAL_MS`, `DALI_BACKUP_RETENTION_DAYS`, `DALI_BACKUP_MAX_AGE_MS`.
- `BackupScheduler({database, destination, applicationVersion, ...})` exposes `start()`, `check()`, `health()`, `close()`. Injectable clocks, publication/inspection/removal and timer callbacks are module-level fixture seams, with no production request routes for fault injection.
- `BackupHealth` contains `state: healthy|alert|fenced`, `recoverableAgeMs`, `recoveryPointAt`, `reason: fresh|aging|stale|no-baseline|clock-invalid`, and `failure: publication|retention|null`.
- `getBackupHealth(database)`, `durableWritesAvailable(database)` and `requireDurableWriteAdmission(database, request, reply)` are shared freshness interfaces. The transaction guard also enforces the expected recovery epoch.
- `buildApp` accepts an explicit programmatic fixture policy or health provider. The production entrypoint configures a real scheduler, and default application setup starts fenced until coverage is established.

## Acceptance Limits and Next Work

The tests use synthetic data and local owned fixture destinations. They prove software scheduling, verification, retention and transactional enforcement; independent failure domains, trustworthy host time, capacity, encryption, actual-full-device behavior and production RPO/RTO still require the approved deployment/storage-loss gates. A process cannot infer every clock manipulation while it was stopped; the operator must maintain trustworthy time. Clock-invalid state remains fenced until clock correction and restart establish valid coverage.

Backup-related browser pending-to-Saved integration belongs to **04-15-03**, following the coordinator and save-status dependencies. No browser acceptance claim is added by this plan. Restore orchestration and epoch rotation remain **04-12**. OPS-01, OPS-02 and SAVE-02 requirement-wide acceptance remains pending the phase verifier. Next dependency-ordered plan is **04-05**.

## Threat Flags

| Flag | File | Description |
|---|---|---|
| threat_flag: router-limit | server/app.ts | Existing parameter limit expands to a bounded 8192 characters for encoded pending-grant IDs; authority checks and prepared queries remain required and exercised. |

The authenticated sanitized health endpoint and filesystem retention belong to the declared backup-health trust boundary. No new unauthenticated repair or fault-injection endpoint was introduced.

## Documentation Consulted

- Node.js timers ([https://nodejs.org/api/timers.html](https://nodejs.org/api/timers.html)) and monotonic clock ([https://nodejs.org/api/perf_hooks.html#performancenow](https://nodejs.org/api/perf_hooks.html#performancenow)), fetched through Context7: timer delivery can be late, `unref()` lifecycle and monotonic elapsed time.
- Fastify server router options ([https://github.com/fastify/fastify/blob/main/docs/Reference/Server.md](https://github.com/fastify/fastify/blob/main/docs/Reference/Server.md)), fetched through Context7: `routerOptions.maxParamLength` and its default 100-character bound.

## Self-Check: PASSED

All four new artifacts exist and all six task commits exist. Stub scanning found no unimplemented scheduling/admission boundary. Required automated commands passed without skips; remaining infrastructure and browser gates retain their planned ownership.
