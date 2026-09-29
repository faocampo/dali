---
status: complete
phase: 04-durable-boards-and-recovery
source: [04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md, 04-04-SUMMARY.md, 04-05-SUMMARY.md, 04-06-SUMMARY.md, 04-07-SUMMARY.md, 04-08-SUMMARY.md, 04-09-SUMMARY.md, 04-10-SUMMARY.md, 04-11-SUMMARY.md, 04-12-SUMMARY.md, 04-13-SUMMARY.md, 04-14-SUMMARY.md, 04-15-SUMMARY.md, 04-16-SUMMARY.md]
started: 2026-09-28T20:09:00.123173+00:00
updated: 2026-09-28T20:30:06.290733+00:00
---

## Current Test

name: Testing complete; regression gap remains
awaiting: execution of 04-17 gap closure
note: Native tab-close warning accepted by the user. Browser/version was not supplied. Remaining pending entries concern evidence reconciliation and execution gates.

## Tests

### 1. Native tab-close warning
expected: In a disposable board with an edit waiting to save after connection loss, closing the tab shows the browser warning. Choosing Stay or Cancel keeps the board and pending edit available. Record browser/version and any platform suppression.
result: pass
source: user
coverage_id: native-recovery-acceptance
observation: Initial external-network disconnection left the local API reachable. After clarification, the user reported that the test passed.
reported: "Test passed correctly"
note: Browser/version unspecified; acceptance is scoped to the user-tested environment.

### 2. Native 200 percent browser zoom
expected: Board editing and saving remain usable at genuine 200 percent browser zoom.
result: pass
source: user
reported: "200% zoom and save works ok"
note: Browser/version still to be recorded; subsequent save-status defects have separate regression evidence.

### 3. Native sticky text, geometry, document identity and PNG hash survive SIGKILL and cold authorized reopen
expected: Native sticky text, geometry, document identity and PNG hash survive SIGKILL and cold authorized reopen
result: pass
source: automated
coverage_id: D1
evidence: tests/durable-restart.spec.ts#@04-01-01
summary: 04-01-SUMMARY.md
note: Retained passing evidence at the summary revision; current full regression remains open.

### 4. Transaction-boundary retries, failed writes and cross-account denial preserve durable state
expected: Transaction-boundary retries, failed writes and cross-account denial preserve durable state
result: pass
source: automated
coverage_id: D2
evidence: server/storage/durability.test.ts#@04-01-02; tests/durable-restart.spec.ts#@04-01-02
summary: 04-01-SUMMARY.md
note: Retained passing evidence at the summary revision; current full regression remains open.

### 5. Authorized descriptors and journal replay compare captured recovery epoch
expected: Authorized descriptors and journal replay compare captured recovery epoch
result: pass
source: automated
coverage_id: D-06
evidence: src/canvas/account/outbox.test.ts
summary: 04-02-SUMMARY.md
note: Retained passing evidence at the summary revision; current full regression remains open.

### 6. Ordinary reopen retains epoch and rotated epochs reject transactional writes
expected: Ordinary reopen retains epoch and rotated epochs reject transactional writes
result: pass
source: automated
coverage_id: D-15
evidence: server/boards/recovery.test.ts
summary: 04-02-SUMMARY.md
note: Retained passing evidence at the summary revision; current full regression remains open.

### 7. Independent capture reconstructs a second edit after native push failure and reload
expected: Independent capture reconstructs a second edit after native push failure and reload
result: pass
source: automated
summary: 04-03-SUMMARY.md
note: Corrected unsupported browser kind and inline verification mappings; classifier now recognizes the retained passing evidence. Current full regression remains separate.

### 8. Scoped checkpoints retain root, content, title and available image bytes
expected: Scoped checkpoints retain root, content, title and available image bytes
result: pass
source: automated
summary: 04-03-SUMMARY.md
note: Corrected unsupported browser kind and inline verification mappings; classifier now recognizes the retained passing evidence. Current full regression remains separate.

### 9. Authorized pending content reopens during failed sending and replays only after current identity and write permission checks
expected: Authorized pending content reopens during failed sending and replays only after current identity and write permission checks
result: pass
source: automated
coverage_id: D-05-D-06
evidence: src/canvas/account/recovery.test.ts; tests/local-recovery.spec.ts#@04-04-01
summary: 04-04-SUMMARY.md
note: Retained passing evidence at the summary revision; current full regression remains open.

### 10. Native quota and aborted transactions pause mutations while retaining visible work, inspection, retry and currently authorized download
expected: Native quota and aborted transactions pause mutations while retaining visible work, inspection, retry and currently authorized download
result: pass
source: automated
coverage_id: D-07-E4
evidence: src/canvas/account/mutation-guard.test.ts; tests/local-recovery.spec.ts#@04-04-03
summary: 04-04-SUMMARY.md
note: Retained passing evidence at the summary revision; current full regression remains open.

### 11. Prior server-save age remains visible while newer work waits
expected: Prior server-save age remains visible while newer work waits
result: pass
source: automated
coverage_id: D-01
evidence: tests/save-status.spec.ts#@04-05-02
summary: 04-05-SUMMARY.md
note: Retained passing evidence at the summary revision; current full regression remains open.

### 12. Coalesced retries preserve keyed errors until their own confirmation
expected: Coalesced retries preserve keyed errors until their own confirmation
result: pass
source: automated
coverage_id: D-02
evidence: tests/save-status.spec.ts#@04-05-02
summary: 04-05-SUMMARY.md
note: Retained passing evidence at the summary revision; current full regression remains open.

### 13. Image-only failure requires acknowledged current documents; combined failure remains distinct
expected: Image-only failure requires acknowledged current documents; combined failure remains distinct
result: pass
source: automated
coverage_id: D-03
evidence: tests/save-status.spec.ts#@04-05-02
summary: 04-05-SUMMARY.md
note: Retained passing evidence at the summary revision; current full regression remains open.

### 14. Complete immutable native archive retains pending content and image fidelity
expected: Complete immutable native archive retains pending content and image fidelity
result: pass
source: automated
coverage_id: D-02
evidence: tests/recovery-archive.spec.ts#@04-06-01
summary: 04-06-SUMMARY.md
note: Retained passing evidence at the summary revision; current full regression remains open.

### 15. Missing image blocks handoff and permits retry with pending records retained
expected: Missing image blocks handoff and permits retry with pending records retained
result: pass
source: automated
coverage_id: D-03
evidence: tests/recovery-archive.spec.ts#@04-06-02
summary: 04-06-SUMMARY.md
note: Retained passing evidence at the summary revision; current full regression remains open.

### 16. Authorized storage-paused offline board exports retained content
expected: Authorized storage-paused offline board exports retained content
result: pass
source: automated
coverage_id: D-07
evidence: tests/recovery-archive.spec.ts#@04-06-01
summary: 04-06-SUMMARY.md
note: Retained passing evidence at the summary revision; current full regression remains open.

### 17. Stable deliberate details activation, save age, focus return and live acknowledgment
expected: Stable deliberate details activation, save age, focus return and live acknowledgment
result: pass
source: automated
summary: 04-07-SUMMARY.md
note: Corrected unsupported browser kind and inline verification mappings; classifier now recognizes the retained passing evidence. Current full regression remains separate.

### 18. Coalesced retry and real recovery download success and failure retain pending records
expected: Coalesced retry and real recovery download success and failure retain pending records
result: pass
source: automated
summary: 04-07-SUMMARY.md
note: Corrected unsupported browser kind and inline verification mappings; classifier now recognizes the retained passing evidence. Current full regression remains separate.

### 19. Stable image labels, failures and previews
expected: Stable image labels, failures and previews
result: pass
source: automated
summary: 04-07-SUMMARY.md
note: Corrected unsupported browser kind and inline verification mappings; classifier now recognizes the retained passing evidence. Current full regression remains separate.

scope_update: User requested removal of image-selection controls; implemented and checked by the save-status-and-font-controls follow-up.

### 20. Durable title retries, cold reopen, receipt matching and revision/authority fencing
expected: Durable title retries, cold reopen, receipt matching and revision/authority fencing
result: pass
source: automated
summary: 04-08-SUMMARY.md
note: Corrected unsupported browser kind and inline verification mappings; classifier now recognizes the retained passing evidence. Current full regression remains separate.

### 21. Stay, Escape, explicit Leave, preserved markers and actual native reload warning
expected: Stay, Escape, explicit Leave, preserved markers and actual native reload warning
result: pass
source: automated
summary: 04-08-SUMMARY.md
note: Corrected unsupported browser kind and inline verification mappings; classifier now recognizes the retained passing evidence. Current full regression remains separate.

### 22. Safe focus, duplicate navigation suppression, local-storage loss copy and 320px containment
expected: Safe focus, duplicate navigation suppression, local-storage loss copy and 320px containment
result: pass
source: automated
summary: 04-08-SUMMARY.md
note: Corrected unsupported browser kind and inline verification mappings; classifier now recognizes the retained passing evidence. Current full regression remains separate.

### 23. Authorized cards identify browser-local pending work with isolated inspection and exact save lifecycle
expected: Authorized cards identify browser-local pending work with isolated inspection and exact save lifecycle
result: pass
source: automated
coverage_id: D-08
evidence: src/boards/pending-recovery.test.ts; tests/library-recovery.spec.ts#@04-09-01; tests/library-recovery.spec.ts#@04-09-02
summary: 04-09-SUMMARY.md
note: Retained passing evidence at the summary revision; current full regression remains open.

### 24. Verified full-database publication with documents, image bytes and authorized fresh-service reopen
expected: Verified full-database publication with documents, image bytes and authorized fresh-service reopen
result: pass
source: automated
coverage_id: D-12
evidence: server/storage/backup.test.ts#@04-10-01
summary: 04-10-SUMMARY.md
note: Retained passing evidence at the summary revision; current full regression remains open.

### 25. Snapshot uses the live owned connection while writes continue
expected: Snapshot uses the live owned connection while writes continue
result: pass
source: automated
coverage_id: D-15
evidence: server/storage/backup.test.ts#@04-10-01
summary: 04-10-SUMMARY.md
note: Retained passing evidence at the summary revision; current full regression remains open.

### 26. Verified backup age alerts at 45 minutes and rejects durable transactions at 60 minutes
expected: Verified backup age alerts at 45 minutes and rejects durable transactions at 60 minutes
result: pass
source: automated
coverage_id: D-12
evidence: server/storage/write-admission.test.ts#@04-11-03
summary: 04-11-SUMMARY.md
note: Retained passing evidence at the summary revision; current full regression remains open.

### 27. Retention preserves complete sets for at least 30 days and the last good set on failure
expected: Retention preserves complete sets for at least 30 days and the last good set on failure
result: pass
source: automated
coverage_id: D-13
evidence: server/storage/backup-scheduler.test.ts#@04-11-01
summary: 04-11-SUMMARY.md
note: Retained passing evidence at the summary revision; current full regression remains open.

### 28. Automatic startup and timer scheduling serializes work and resumes due checks
expected: Automatic startup and timer scheduling serializes work and resumes due checks
result: pass
source: automated
coverage_id: D-15
evidence: server/storage/backup-scheduler.test.ts#@04-11-01
summary: 04-11-SUMMARY.md
note: Retained passing evidence at the summary revision; current full regression remains open.

### 29. Explicit fresh-target restore clears authentication state and rotates epoch while preserving stable content/access relationships
expected: Explicit fresh-target restore clears authentication state and rotates epoch while preserving stable content/access relationships
result: pass
source: automated
coverage_id: D-15
evidence: server/storage/restore.test.ts#@04-12-01
summary: 04-12-SUMMARY.md
note: Retained passing evidence at the summary revision; current full regression remains open.

### 30. Native cold authorized reopen and byte-exact images after synthetic selected restore
expected: Native cold authorized reopen and byte-exact images after synthetic selected restore
result: pass
source: automated
coverage_id: D-14
evidence: tests/restored-board.spec.ts#@04-12-02
summary: 04-12-SUMMARY.md
note: Retained passing evidence at the summary revision; current full regression remains open.

### 31. Pinned production app and web images with native SQLite and actual secure authenticated durable restart
expected: Pinned production app and web images with native SQLite and actual secure authenticated durable restart
result: pass
source: automated
coverage_id: D-09
evidence: docker build --target app -t dali-phase4-app:acceptance .; docker build --target web -t dali-phase4-web:acceptance .; node scripts/production-smoke.mjs --app-image dali-phase4-app:acceptance --web-image dali-phase4-web:acceptance
summary: 04-13-SUMMARY.md
note: Retained passing evidence at the summary revision; current full regression remains open.

### 32. Production output excludes test startup and uses external generic identity/storage configuration
expected: Production output excludes test startup and uses external generic identity/storage configuration
result: pass
source: automated
coverage_id: D-11
evidence: server/preflight.test.ts#@04-13-02; PRODUCTION_BOUNDARY_NATIVE_PASS runtime image probe
summary: 04-13-SUMMARY.md
note: Retained passing evidence at the summary revision; current full regression remains open.

### 33. Portable restricted single-writer manifests with TLS and network boundaries
expected: Portable restricted single-writer manifests with TLS and network boundaries
result: pass
source: automated
coverage_id: kubernetes-static
evidence: kubectl kustomize deploy/kubernetes/base; node scripts/deployment-smoke.mjs --check-manifests; node --test-reporter=tap scripts/deployment-smoke.mjs --self-test
summary: 04-14-SUMMARY.md
note: Retained passing evidence at the summary revision; current full regression remains open.

### 34. Representative real SQLite backup and fresh restore preserve exact document/image hashes and current role access
expected: Representative real SQLite backup and fresh restore preserve exact document/image hashes and current role access
result: pass
source: automated
coverage_id: representative-local-recovery
evidence: server/storage/operations-drill.test.ts#@04-15-01; tests/restored-board.spec.ts#@04-15-01
summary: 04-15-SUMMARY.md
note: Retained passing evidence at the summary revision; current full regression remains open.

### 35. All 36 recovery surface/category predicates in three production browser engines
expected: All 36 recovery surface/category predicates in three production browser engines
result: pass
source: automated
coverage_id: recovery-ui-36
evidence: tests/recovery-ui-matrix.spec.ts
summary: 04-16-SUMMARY.md
note: Retained passing evidence at the summary revision; current full regression remains open.

### 36. Local Kubernetes deployment and recovery
expected: The accepted synthetic local cluster exercise preserves board/image content and enforces roles after restore.
result: pass
source: user-and-automated
evidence: 04-15-SUMMARY.md; 04-LOCAL-KUBERNETES-VALIDATION.md
note: Supersedes earlier pending local-runtime rows in plans 12 through 14; production scope remains separate.

### 37. Independent deployment storage and capacity
expected: Validate independent storage failure domains and retention capacity on the target operator infrastructure.
result: skipped
reason: Deferred follow-up: user postponed independent storage and capacity validation to ROADMAP backlog 999.6 on 2026-09-27. Actual-provider and speech acceptance remain separately deferred to 999.4 and 999.3.

### 38. Current full regression and source-mapped acceptance
expected: Complete current-source gate and required matrix evidence.
result: skipped
reason: Deferred follow-up: user validated Phase 4 on 2026-09-29 and moved the remaining WebKit Save Details runtime-error fix to backlog 999.7. Full-run evidence remains 2,051/2,052 passed, one failed, zero skips/retries.

## Summary

total: 38
passed: 36
issues: 0
pending: 0
skipped: 2
blocked: 0

## Gaps

No active acceptance gaps. G-04-38 is deferred by the user to backlog 999.7; the technical failure remains unresolved.

## Historical final acceptance checkpoint

## Complete gate at 3e9d68b

The complete frozen-source run returned **2,051 passed, one failed, zero skipped and zero retries out of 2,052 selected cases (1.9 hours)**. Revision: `3e9d68b71290988112a51742d227b6fbdf795d9c`; digest: `bf8e75b776bd8eab87457ad855560f0a8fcd9c19236eb2cfadd27c9793f4fc5d`. The reporter confirmed stable source identity; pre-existing `package.json` changes are included. Chromium and Firefox each supplied all 13 scenarios and 36 predicates. WebKit supplied 12 passing scenarios and 31 predicates; the failed details-cardinality scenario withholds E1/overflow, E1/long-text, E2/overflow, E2/zero-one-many and E2/long-text.

The remaining failure is `tests/recovery-ui-matrix.spec.ts:233` in production WebKit. Its assertions completed, but the strict error collector captured unexpected blob-read and session-read access-control page errors. Blob-read frames lead through the account blob source into canvas rendering; session frames lead through the recovery coordinator's image-failure retry. The exact rejected-promise/lifecycle boundary remains unresolved. The pagehide correction passed its fail-first regression, 88 repeated focused cases and its full-run cases, but does not resolve this remaining error class. The earlier classical-shape and connector-label full-run failures passed in this run.

No error allowlist, test retry, skip or weakened oracle was introduced. No complete-gate run remains active. Phase 4 stays open under G-04-38; autonomous continuation awaits the required retry/skip/stop choice. Seven scoped judgments and native acceptance remain accepted.

The native tab-close and zoom checks retain their user-confirmed pass. All seven scoped dispositions remain explicitly accepted.

## User acceptance — 2026-09-29

User accepted Phase 4 as validated on 2026-09-29 and explicitly deferred the remaining WebKit Save Details runtime-error fix to backlog 999.7. The observed full run remains 2,051/2,052 passed, one failed, zero skips/retries; this is acceptance with an explicit exception.
