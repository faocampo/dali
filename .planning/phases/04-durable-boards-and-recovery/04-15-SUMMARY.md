---
phase: 04-durable-boards-and-recovery
plan: "15"
subsystem: recovery
tags: [sqlite, dataset, backup, restore, browser, operations]
requires:
  - phase: 04-12
    provides: Explicit selected-backup restore and cold authorized access
  - phase: 04-13
    provides: Verified production images
  - phase: 04-14
    provides: Deployment manifests and gated cluster harness
provides:
  - Seeded representative native canvas dataset with measured raster volume
  - Real local file loss, selected restore and exact document/image/access comparison
  - Cold native browser proof at the representative content size
affects: [04-16]
tech-stack:
  added: []
  patterns: [Seeded valid RGB PNGs, API-seeded native wire content, owned synthetic live-file loss]
key-files:
  created: [server/testing/recovery-dataset.ts, server/storage/operations-drill.test.ts]
  modified: [tests/durability-fixtures.ts, tests/restored-board.spec.ts, docs/operations.md]
key-decisions:
  - Local representative I/O measurements retain their local failure-domain scope; deployment acceptance requires the explicit cluster prerequisite.
  - Preserve task sequence and stop before task 2 when its disposable-context precondition is absent.
requirements-covered: [SAVE-01, OPS-02]
requirements-completed: []
actuals:
  tokens: 8894
  tasks: 1
  commits: 2
plan_head_before: 3573e889f78ce453720d54d460a1aca3f7cf7305
duration: 13min
completed: 2026-09-26
status: halted
coverage:
  - id: representative-local-recovery
    description: Representative real SQLite backup and fresh restore preserve exact document/image hashes and current role access
    requirement: OPS-02
    verification:
      - kind: integration
        ref: server/storage/operations-drill.test.ts#@04-15-01
        status: pass
      - kind: e2e
        ref: tests/restored-board.spec.ts#@04-15-01
        status: pass
    human_judgment: false
  - id: production-recovery-envelope
    description: Independent cluster storage loss, production RPO/RTO and maintenance acceptance
    requirement: OPS-02
    verification: []
    human_judgment: true
    rationale: Task 2 prerequisite is unmet; there is no explicit disposable acceptance context or configured Kubernetes context.
---

# Phase 04 Plan 15: Representative Recovery and Operational Gates

**Seeded native boards and 143,329,267 bytes of valid PNG assets survive real local live-file loss and selected backup restoration with exact hashes and cold role verification; production drill remains blocked.**

## Completed task and commits

Only task **04-15-01** is complete. Task **04-15-02** stopped before implementation at its explicit precondition; **04-15-03** remains unexecuted in plan sequence.

- `8ce0241` — RED: require representative recovery dataset envelope.
- `dffa7c5` — GREEN: representative generator, real I/O drill, native cold browser proof and runbook.

The ledger measures two commits before this metadata close-out. Actual tokens are changed deliverable diff characters divided by four, rounded up. Five deliverable files changed. No requirement-wide acceptance changed.

## Dataset and integrity evidence

- Seed 415, schema 1, 50 boards, three synthetic owning identities, private/shared Owner/Editor/Viewer and denied cases.
- Forty-nine boards contain 100 ordinary objects each. The representative board contains 1,000 ordinary objects plus 100 native mind-map nodes. Structures include frames, linked connector endpoints, topic styles, collapsed branches and image visual-edit metadata with original/processed source references.
- Fifty distinct generated PNGs contain real deterministic RGB scanlines. Total image bytes: **143,329,267**. Largest file: exactly **8,388,608** bytes. Manifest records each image's dimensions, byte count, SHA-256 and application-compatible padded blob key; zero/one/many-image boards are present.
- Authorized signed-OIDC API requests create all boards, upload all assets and commit all content. The source contains 100 documents. The restore test verifies exact document and image digests, board ownership/title/revision and grant graph. Cold API actors traverse every board, compare all authorized documents/images, check private-board/image denials and enforce Owner/Editor versus Viewer write capability.
- The selected backup is identified by its manifest digest. The fixture closes its writer, deletes only its own synthetic live files, restores into an empty restricted directory and starts fresh-epoch service with renewed backup coverage. Public ingress remains closed until verification.
- Native cold browser profiles for Owner, Editor and Viewer hydrate the 1,100 native surface elements, frame, 100-node hierarchy, collapsed branch and original/processed image bytes. Browser image decoding verifies actual dimensions and hashes. A fourth denied identity cannot fetch board or image.

## Verification

- Exact task command `npm run test:server -- server/storage/operations-drill.test.ts -t @04-15-01`: **3 passed, zero skipped**, final run **66.60 seconds**.
- `npm exec playwright test -- tests/restored-board.spec.ts --project=prod --grep @04-15-01`: **1 passed, zero skipped**, approximately **1.4 minutes** including startup/build, approximately **1.1 minutes** test body. Used the existing browser cache and owned acceptance listeners.
- Existing retention and payload-boundary suites: `npm run test:server -- server/storage/backup-scheduler.test.ts server/boards/access.test.ts`: **34 passed, zero skipped**, **4.01 seconds**. Clock tests establish retention semantics; real I/O evidence below establishes this local throughput envelope.
- Both `npm run typecheck` and `npm run typecheck:server` passed before RED and GREEN commits. `git diff --check` passed. No package installation or tracked-file deletion occurred. Normal commit hooks remained active.
- Existing runtime/build warnings included Node experimental localStorage, color environment notices and Vite chunk/import warnings; those retain their preexisting scope.

## Measured local report

The final server gate writes ignored runtime artifact `.gsd/representative-recovery.json` (sanitized report, dataset manifest and pre-loss content digests) and emits `REPRESENTATIVE_LOCAL_IO_PASS`.

| Measurement | Observed |
|---|---:|
| Images | 50 |
| Image bytes | 143,329,267 |
| Backup bytes | 147,025,920 |
| Backup wall duration | 5,308.74 ms |
| Restore through cold API access verification | 39,982.63 ms |
| Target canary cadence | 100 ms |
| Acknowledged canaries | 5 |
| Latest restored canary sequence | 3 |
| Selected recovery-point age at incident | 5,307 ms |
| Latest acknowledgment to restored acknowledgment gap | 5,000 ms |
| 30-day capacity, boundary set and 25% headroom | 529,477,094,400 bytes |

All durations are real clocks. Synchronous backup validation delays timer delivery; actual timestamped acknowledgments determine the gap. Capacity assumes complete copies at 15-minute cadence: `(30 × 24 × 4 + 1) × backup bytes × 1.25`. The source and destination are owned directories on one host. These measurements establish local representative behavior; production independent storage, alert delivery, planned-maintenance duration and cluster RPO/RTO remain unverified. The separate browser test exercises cold native rendering at the same envelope.

## TDD Gate Compliance

The named RED assertion expected 50 boards and observed 0 from the compile-safe initial generator. The selected test failed intentionally. The initial GSD classifier did not count Vitest's nested TAP totals; the persisted record normalizes the observed assertion and selected/pass/fail counts into flat TAP and passed `RED_EVIDENCE_OK`. RED commit precedes GREEN. Global workflow TDD mode is disabled; ordinary task RED/GREEN applied.

## Deviations and corrections

**[Rule 1 — fixture bug] Application-compatible image keys.** The first native browser run rejected unpadded generated blob keys in local recovery caching. The generator now uses the application's padded URL-safe SHA-256 convention. The corrected exact server and native browser gates pass. Files: `server/testing/recovery-dataset.ts`; commit: `dffa7c5`. This was a synthetic fixture correction; no production hash policy changed.

## Blocking prerequisite and remaining tasks

Task 2 precondition: **DALI_ACCEPTANCE_CONTEXT names an explicitly disposable cluster; container images are available there; synthetic TLS/OIDC and independently surviving live/backup storage have passed read-only prerequisite checks.**

Fresh read-only checks found `DALI_ACCEPTANCE_CONTEXT` absent, `DALI_ACCEPTANCE_REPORT` absent, and `kubectl config get-contexts -o name` returned an empty list. Consequently image availability, synthetic TLS/OIDC, independent volume survival/flush/locking/capacity and exclusive writer in a selected cluster cannot be established.

No cluster resource was created, no cluster acceptance was simulated, and no task-2 implementation was started. The exact `RECOVERY_DRILL_PASS` gate remains unrun. Task 3's browser backup-fence integration remains unexecuted because it follows this blocked task. Resume from **04-15-02** only after the explicit disposable environment is supplied and its read-only checks pass, or after an explicit user-approved plan change.

See [04-15-CHECKPOINT.md](04-15-CHECKPOINT.md) (blocking prerequisite and continuation record). Plan 04-16 remains dependent on this halted plan. Existing deployment blocker in the cross-phase ledger remains open; additional unrun task gates are recorded there.

## Known Stubs and Threat Surface

No stub remains in completed task 1. Tasks 2 and 3 are unexecuted deliverables. New helper data and file deletion remain restricted to generated synthetic resources owned by the fixture; no production endpoint or authentication bypass was introduced. Physical storage independence retains the existing operational threat gate.

## Documentation Consulted

Context7 resolved `/yjs/docs` and fetched the document-update API: Yjs ([https://docs.yjs.dev/api/document-updates](https://docs.yjs.dev/api/document-updates)). Pinned BlockSuite wire schemas and existing repository API/restore implementations supplied the fixture contracts.

## Self-Check: PASSED

All five task deliverables and RED evidence exist. Commits `8ce0241` and `dffa7c5` exist. The final local report matches the recorded measurements. Task 2 and task 3 remain visibly incomplete; requirements remain unchecked.
