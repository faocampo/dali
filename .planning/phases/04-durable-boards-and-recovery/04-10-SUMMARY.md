---
phase: 04-durable-boards-and-recovery
plan: "10"
subsystem: backup
tags: [sqlite, backup, integrity, fsync, recovery]
requires:
  - phase: 04-01
    provides: Durable file-backed SQLite and owned crash-test fixtures
  - phase: 04-02
    provides: Stable recovery epoch and authorized board mutation scope
provides:
  - Live-connection asynchronous verified SQLite backup publication
  - Versioned manifests and read-only complete-set inspection
  - Single-flight publication and failure/interruption preservation
affects: [04-11, 04-12, 04-13, 04-14, 04-15]
tech-stack:
  added: []
  patterns: [Online SQLite backup, immutable complete sets, conservative recovery point, restricted destination contract]
key-files:
  created: [server/storage/backup.ts, server/storage/backup-validation.ts, server/storage/backup.test.ts, docs/operations.md]
  modified: [server/boards/documents.ts, server/boards/blobs.ts]
key-decisions:
  - Require an explicit externally verified independent-storage contract and restricted destination permissions; synthetic destinations establish software behavior only.
  - Normalize only the completed snapshot to DELETE journal mode so archived files are self-contained and read-only inspection creates no WAL/SHM companions.
  - Select only complete sets that pass marker, manifest, digest, schema, document, image and relationship checks; never refresh age from a failed attempt.
  - Retain all prior complete sets in this publisher; scheduling, 30-day pruning and freshness fencing remain plan 04-11.
requirements-covered: [OPS-02]
requirements-completed: []
coverage:
  - id: D-12
    description: Verified full-database publication with documents, image bytes and authorized fresh-service reopen
    requirement: OPS-02
    verification:
      - kind: integration
        ref: server/storage/backup.test.ts#@04-10-01
        status: pass
    human_judgment: false
  - id: D-15
    description: Snapshot uses the live owned connection while writes continue
    requirement: OPS-02
    verification:
      - kind: integration
        ref: server/storage/backup.test.ts#@04-10-01
        status: pass
    human_judgment: false
actuals:
  tokens: 12371
  tasks: 2
  commits: 4
plan_head_before: 0b4cb2a1b283159a953503c8b78b6ce234b308a0
duration: 17min
completed: 2026-09-25
status: complete
---

# Phase 04 Plan 10: Verified Backup Publication Summary

**The live SQLite connection publishes restricted, independently verifiable recovery sets containing native documents, images and access metadata; failed or interrupted attempts preserve the prior verified recovery point.**

## Accomplishments

- `publishBackup` calls the existing asynchronous SQLite online backup API through the owned live connection. A unique temporary set resides on the destination filesystem. Same-connection writes continue during the snapshot; the manifest's snapshot-start timestamp conservatively bounds its recovery point.
- The finished copy is normalized to DELETE journal mode, then reopened read-only for validation. Validation checks SQLite integrity and foreign keys, the exact supported migration ledger/tables, recovery epoch, all root/content bindings, complete Yjs decoding and existing object/byte limits, every board image association/MIME/hash, image quotas, thumbnails, members, active/pending grants, operation receipts and staged import references. Legitimate deleted-board receipts and unfinished import/duplicate stages remain valid.
- The publisher computes a full-file SHA-256, byte length, application/database versions, epoch, timestamps and aggregate counts. Database/manifest files and directory metadata are flushed; the set directory is renamed atomically on the destination filesystem; the flushed completion marker is published last. Directories use mode 0700 and files 0600.
- Concurrent matching calls on one live connection join one in-flight promise. Conflicting destinations/versions reject. Caught-failure cleanup touches only the invocation's unique set; abrupt interruptions leave partial sets for separate operator review. Prior complete sets are retained even when stale.
- `inspectBackupSet` reads safe aggregate metadata only after rechecking permissions, marker, manifest, full digest, supported schema and database contents. Partial, tampered, unsupported or symlinked sets are excluded. It never prunes or modifies complete data.
- [Operations documentation](../../../docs/operations.md) is provided at the repository's `docs/operations.md`: independent failure-domain assertion, flush/locking prerequisites, one-writer fencing, permissions/encryption, capacity, manifest contract, read-only selection and later retention/freshness integration. Actual infrastructure bindings remain external.

## Task Commits

1. **04-10-01 — one verified live backup:** `3e2f136` (RED), `b284c69` (GREEN).
2. **04-10-02 — failure-safe publication and inspection:** `44f7d10` (RED), `609707e` (GREEN).

Four task commits and the diff-character token estimate were measured from the persisted plan ledger before this summary commit.

## TDD Gate Compliance

| Task | Observed RED | GREEN |
|---|---|---|
| 04-10-01 | The happy-path contract failed at an explicit unimplemented publication boundary. Compile-safe rejecting boundaries existed so the failure was behavioral rather than an import/compiler failure. Six rejection tests passing at that stage were not claimed as validation evidence. | Seven real-SQLite cases pass with implemented validation and a fresh authorized service. |
| 04-10-02 | Concurrent triggers returned two distinct published IDs. | Matching triggers share one complete publication; all failure/interruption cases pass. |

Both persisted RED evidence records passed `check tdd-red-evidence` with `RED_EVIDENCE_OK`. Normalized TAP records disclose their source and filter exclusions.

## Verification

- Task 1 exact command: `npm run test:server -- server/storage/backup.test.ts -t @04-10-01` — **7 selected/passed**.
- Task 2 exact command: `npm run test:server -- server/storage/backup.test.ts -t @04-10-02` — **15 selected/passed**, 7 unrelated task-1 tests excluded by the name filter.
- Complete backup file without a name filter — **22 passed, zero skipped** in 5.50 seconds including startup.
- Full `npm run test:server` — **161 passed, zero skipped**, 10 files, 7.95 seconds including startup.
- Both existing TypeScript checks passed for each task and after final source/test changes. `git diff --check` passed; no tracked files were deleted.
- Real backup progress executes a write on the live connection. The copy passes integrity checks, complete-file digest/length verification and image equality, then is copied into fresh writable service storage. Fresh owner/editor/viewer sign-ins retain roles; Owner and Editor write, Viewer receives 403, and an unrelated account receives 404.
- Separate real SQLite copies reject missing images, malformed Yjs bytes, invalid image hashes, unsupported migrations, missing document bindings and broken member/grant references.
- Nine injected publication boundaries cover snapshot, validation, digest, file/manifest flush, rename, directory sync, marker publication and final sync. Injected `ENOSPC`/I/O failures preserve the older verified set and its original recovery timestamp. Unavailable/permissively accessible destinations also fail safely.
- Two actual child processes receive SIGKILL during online backup and after set rename before completion-marker publication. Inspection selects only the old verified set; a subsequent normal publication succeeds. Children operate on owned fixture database copies and isolated synthetic destinations.

## Deviations from Plan

### Auto-fixed Issues

1. **[Rule 3 — fixture runtime] Use the installed bundler for crash children.** The initial child command referenced an unavailable TypeScript loader. No package installation was attempted. The existing esbuild dependency bundles the actual backup module to the child's stdin, retaining real SQLite/file/process behavior. Final SIGKILL cases pass. File: `server/storage/backup.test.ts`; commit: `609707e`.
2. **[Rule 1 — archive self-containment] Normalize snapshot journal mode.** A real file-set assertion showed that read-only validation of a WAL-mode snapshot created WAL/SHM companions. The completed copy now switches to DELETE journal mode before validation/digest; the published set contains exactly the three intended files. Live database settings remain unchanged. File: `server/storage/backup.ts`; commit: `609707e`.
3. **[Rule 2 — receipt semantics] Preserve legitimate lifecycle metadata.** Duplicate receipts record the source board separately from their destination descriptor, and receipts can outlive deleted boards. Validation recognizes those bindings and requires existing/deleted resource references where appropriate. A real API fixture covers pending access, unfinished imports/duplicates and deleted-board receipts. Files: `server/storage/backup-validation.ts`, `server/storage/backup.test.ts`; commit: `609707e`.

## Interfaces for Following Plans

- `BackupDestination = {directory, independentStorage: true}` requires an existing restricted mounted directory. The boolean records an external assertion; it does not discover topology.
- `publishBackup({database, destination, applicationVersion, now?, progress?, onBoundary?})` returns `{id, manifest}` after completion. `now` supports deterministic scheduling tests; progress and boundary hooks support owned fault tests without production routes.
- `BackupManifest` schema 1 contains `applicationVersion`, `databaseVersion`, `epoch`, `recoveryPointAt`, `completedAt`, `byteLength`, `sha256` and aggregate `counts`. `completedAt` records validation/digest completion before final publication flushes; success is the resolved publication plus valid completion marker.
- `validateBackupDatabase(path)` opens an existing copy read-only and returns `{databaseVersion, epoch, counts}`; it never migrates or changes live storage. `BACKUP_DATABASE_VERSION` is currently 8.
- `inspectBackupSet(destination)` returns only verified `{id, manifest}` sets sorted by conservative recovery point descending. `backupDigest(path)` streams SHA-256. `validateStoredDocument` and `validateStoredImage` reuse existing request validation limits without weakening request handlers.

## Acceptance Limits and Next Work

All destinations used here are synthetic directories on test storage. No independent production failure domain, encryption policy, 30-day capacity, actual-full-device behavior, RPO, RTO or throughput acceptance is claimed. The tests inject disk-full errors rather than filling a real device. Actual independent storage and storage-loss recovery remain external gates E-02/E-03 and plan 04-15 work.

This publisher retains all complete sets. The selected 15-minute cadence, 30-day retention/pruning, 45-minute alert and 60-minute freshness fencing belong to plan 04-11. Restore orchestration, authentication-state clearing and epoch rotation belong to plan 04-12. Requirement-wide OPS-02 acceptance remains pending phase verification.

## Documentation Consulted

- better-sqlite3 API ([https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md)), fetched through Context7: asynchronous online backup, progress, same-connection writes and read-only opening.
- Node.js filesystem API ([https://nodejs.org/api/fs.html](https://nodejs.org/api/fs.html)), fetched through Context7: exclusive file creation, fsync and same-filesystem atomic rename.

## Self-Check: PASSED

All declared artifacts exist and all four task commits exist. The final suites exercise real SQLite, files, signed synthetic authentication and abrupt child-process termination. Stub scan found no unimplemented boundary. The new filesystem surface is covered by the declared backup threat model; no additional network or authentication endpoint was introduced.
