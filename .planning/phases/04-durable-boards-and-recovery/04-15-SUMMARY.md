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
  token_estimate_scope: original-task-1
  tokens: 8894
  tasks: 2
  commits: 5
plan_head_before: 3573e889f78ce453720d54d460a1aca3f7cf7305
duration: multiple sessions
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
    rationale: Local Kubernetes/API recovery passed; storage/capacity validation is deferred to backlog 999.6; the failed cold read-only native rendering gate remains open.
---

# Phase 04 Plan 15: Representative Recovery and Operational Gates

**Local Kubernetes deployment and selected-backup recovery passed for 50 representative boards and 143,329,267 image bytes. Backup-fence replay passes in three browsers; native cold read-only rendering has an open failure.**

## Completed task and commits

Tasks **04-15-01** and **04-15-03** are complete. On 2026-09-27 the user explicitly authorized local Kubernetes setup: task **04-15-02** was implemented and its scoped local API recovery drill passed. Cold native read-only rendering found an open issue, and independent storage/capacity validation is deferred to backlog 999.6. The plan remains incomplete.

- `8ce0241` — RED: require representative recovery dataset envelope.
- `dffa7c5` — GREEN: representative generator, real I/O drill, native cold browser proof and runbook.

The original task-1 token estimate is retained below; the continuation adds three implementation commits. No requirement-wide acceptance changed.

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

## Local Kubernetes continuation and remaining gates

The user authorized local setup on 2026-09-27. A disposable kind cluster with Calico, synthetic signed TLS/OIDC, isolated kubeconfig and separate local PV directories now passes image, network-policy, deployment, fenced restart, compatible rollback, explicit backup selection and offline recovery gates. The exact scoped marker is `LOCAL_RECOVERY_DRILL_PASS`; production acceptance remains distinct.

The real backup-freshness browser test passes in Chromium, Firefox and WebKit, including the simulated 24-hour scheduler interval, pending note/image retention, fresh authorization and exact acknowledgment.

The native restored-cluster follow-up found a cold Viewer hydration failure and read-only errors. WINDOWS entry 22 tracks investigation and a read-only-first regression. Separate PV directories share one Docker backing volume and host. The roughly 500 GiB retention forecast exceeds the synthetic claim's nominal 100 GiB. These constraints remain explicit.

See [04-LOCAL-KUBERNETES-VALIDATION.md](04-LOCAL-KUBERNETES-VALIDATION.md) (measured timings, scope, corrections and native browser finding) and [04-15-CHECKPOINT.md](04-15-CHECKPOINT.md) (remaining work). Implementation commits: `ddfd11f`, `c6c0dfb`, `c3cc75e`. Requirements remain unaccepted; plan 04-16 remains dependent on this incomplete plan.

## Documentation Consulted

Context7 resolved `/yjs/docs` for the original fixture and `/websites/kind_sigs_k8s_io` for local setup. Yjs document updates: https://docs.yjs.dev/api/document-updates ; kind quick start: https://kind.sigs.k8s.io/docs/user/quick-start/ . Installed native schemas and production code supplied the data and restore contracts.

## Self-check

Local harness deliverables, scoped runtime evidence and cross-browser freshness tests exist. Storage/capacity acceptance is deferred to backlog 999.6; native read-only browser recovery remains open. No private fixture, key, kubeconfig or operational runtime report is committed.


## Approved validation deferral — 2026-09-27

The user postponed independent storage and capacity validation to backlog **999.6**. These infrastructure checks are deferred from active Phase 4 acceptance and remain unverified. Existing local test evidence is retained; WINDOWS 20 is waived for the documented deferral. The cold native Viewer rendering failure (WINDOWS 22) remains active. Production ingress/provider validation retains its separate disposition.
