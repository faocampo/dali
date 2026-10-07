---
phase: 04-durable-boards-and-recovery
plan: "02"
subsystem: recovery
tags: [sqlite, epoch-fencing, authorization, imports, playwright]
requires:
  - phase: 04-01
    provides: Verified persistent database startup and real restart fixtures
provides:
  - Stable singleton recovery epoch and authenticated metadata endpoint
  - Transactional fencing for document, image, board, import and access mutations
  - Captured client epoch and acknowledgment scope validation
affects: [04-03, 04-04, 04-05, 04-10, 04-11, 04-12]
tech-stack:
  added: []
  patterns: [Commit-time epoch comparison, immutable operation scope, typed recovery mismatch]
key-files:
  created: [server/storage/recovery-state.ts, server/boards/recovery.test.ts]
  modified: [server/boards/routes.ts, server/boards/imports.ts, server/boards/grants.ts, server/boards/actions.ts, src/boards/BoardLibrary.tsx, src/boards/operations.ts, src/boards/import-local.ts, src/boards/ShareBoardDialog.tsx, src/canvas/account/doc-source.ts, src/canvas/account/blob-source.ts, src/canvas/account/outbox.ts, src/canvas/account/board-workspace.ts, src/canvas/runtime.ts, src/canvas/BlockSuiteCanvas.tsx, src/App.tsx]
key-decisions:
  - Bind staged imports to their original descriptor epoch so a fresh request header cannot publish a restored stale stage.
  - Retain legacy journal rows without an epoch and reject their replay; versioned capture and migration remain plan 04-03 work.
  - Preserve an operation's captured epoch across uncertain transport outcomes and compare acknowledgment scope before removing local work.
requirements-covered: [SAVE-01, SAVE-02, OPS-02]
requirements-completed: []
coverage:
  - id: D-06
    description: Authorized descriptors and journal replay compare captured recovery epoch
    requirement: SAVE-02
    verification:
      - kind: unit
        ref: src/canvas/account/outbox.test.ts
        status: pass
    human_judgment: false
  - id: D-15
    description: Ordinary reopen retains epoch and rotated epochs reject transactional writes
    requirement: OPS-02
    verification:
      - kind: integration
        ref: server/boards/recovery.test.ts
        status: pass
    human_judgment: false
actuals:
  tokens: 33792
  tasks: 3
  commits: 6
plan_head_before: 5d9c8c0cb33535cd3d6f5d15e8971ee269084514
duration: 25min
completed: 2026-09-25
status: complete
---

# Phase 04 Plan 02: Recovery Epoch Fencing Summary

**Every replayable board mutation carries an authenticated recovery epoch checked inside its write transaction, while client acknowledgments preserve the original account, generation, image identity and epoch.**

## Accomplishments

- Migration 8 adds a versioned singleton with a cryptographically random epoch. Initialization is idempotent and file-backed reopen retains it. `GET /api/recovery-state` requires the current expected account, and authorized descriptors expose `recoveryEpoch`.
- The shared capability path checks epochs inside durable mutation transactions. Missing and stale values return distinct `RECOVERY_EPOCH_REQUIRED` and `RECOVERY_EPOCH_MISMATCH` outcomes. Read, export and receipt authorization remains available under existing role rules.
- Document and image transports capture the epoch before asynchronous local capture, send `X-Dali-Recovery-Epoch`, and validate the response header and live scope before acknowledgment. Image key/hash checks prevent unrelated responses from removing pending bytes. Epoch errors remain separate from identity loss, transport failure and other conflicts.
- Board actions, thumbnail upload, create, import and sharing clients retain their original operation epoch through uncertain results. New-board creation validates its resulting descriptor and acknowledgment; duplicate destinations must match their captured source epoch.
- Import reservations and duplicate staging bind their epoch in the existing stored descriptor. Document staging, blob staging and publication recheck account, authority and epoch in a transaction after the scheduling barrier. An old stage cannot publish using a newly fetched epoch. Grant revision conflicts and role denials retain their distinct outcomes.
- Existing synthetic setup requests now provide explicit epoch headers. Application traffic is exercised directly; test interception does not inject missing production headers.

## Task Commits

| Task | RED | GREEN |
|---|---|---|
| 04-02-01 document epoch | `d9aaf18` | `90b6dd1` |
| 04-02-02 image/action scope | `6f6526a` | `37628d8` |
| 04-02-03 import/access entry points | `7b3b487` | `99d18e4` |

The ledger measures six implementation/test commits through `99d18e4`, across 42 changed files including evidence and fixture contracts. Documentation close-out commits follow this measurement. Actual tokens are realized Git diff characters divided by four, rounded up, matching the estimate scale.

## Verification

| Command / gate | Observed result |
|---|---|
| `npm run test:server -- server/boards/recovery.test.ts -t @04-02-01` | 4 selected passed |
| `npm test -- src/canvas/account/doc-source.test.ts src/canvas/account/blob-source.test.ts` | 27 passed |
| `npm run test:server -- server/boards/recovery.test.ts -t @04-02-02` | 1 selected passed |
| `npm run test:server -- server/boards/recovery.test.ts -t @04-02-03` | 7 selected passed; 1.86s final targeted run |
| Final unfiltered `server/boards/recovery.test.ts` | 12 passed, 0 skipped; 2.30s |
| Final document/image/journal unit suite | 31 passed, 0 skipped; 244ms |
| `npm run test:server` | 139 passed, 0 skipped; 10.22s |
| `npm test` | 122 passed, 0 skipped; 2.85s |
| `npm run test:access -- tests/durable-restart.spec.ts` | 2 passed, 0 skipped; 28.9s including startup; native sticky/PNG SIGKILL and normal restart |
| `npm run test:access -- tests/local-board-import.spec.ts tests/board-sharing.spec.ts tests/board-actions.spec.ts` | 51 passed, 0 skipped; 2.3min including startup |
| `npm run test:access -- tests/board-access.spec.ts -g 'two New commands\|blocked popup retry'` | 2 passed, 0 skipped; 22.6s including fresh production build/startup, final creation changes |
| `npm run typecheck && npm run typecheck:server` | Both passed after final changes |
| Production build in browser setup; `git diff --check` | Passed; existing bundle/static-import advisories remain |

Named Vitest filters exclude the other task groups and print them as skipped; no mandatory case was skipped. The final unfiltered recovery suite executes all 12. Server and browser checks use owned synthetic listeners and the existing installed browser cache. No new packages or user-service lifecycle changes were needed. The broad unit/server runs preceded final strengthening of grant/duplicate assertions and creation retry validation; the changed recovery file, source suite, static checks and creation browser cases were subsequently rerun as shown.

## TDD Gate Compliance

All three tasks first observed an assertion failure: missing document epoch returned 200; image recovery mismatch produced a generic error; missing create epoch returned 201. Each RED record is committed as `04-02-0N-RED.json` and received `RED_EVIDENCE_OK`. Records explicitly disclose normalization from the Vitest reporter to the classifier's TAP format. GREEN gates passed before their implementation commits. No separate refactor commit was needed.

## Deviations from Plan

- **Rule 2 — required integration:** Descriptor validation in `App`, the workspace epoch getter, runtime journal scope, thumbnail transport and journal replay were updated alongside declared transports. Without these minimal connections, native writes would omit epochs or replay old bytes under newly loaded metadata. Legacy rows remain retained and fail closed pending plan 04-03.
- **Rule 2 — duplicate staging and creation retries:** The duplicate route needed the same stored epoch as ordinary imports. Creation retry state now retains its captured epoch by account and operation ID until receipt confirmation.
- **Rule 3 — test contract migration:** Existing server, browser and crash fixture setup mutations acquired explicit current epochs. This preserves their original authorization, idempotency and native behavior assertions under the newly required header contract.
- Requirement-wide completion remains with the phase verifier. This plan demonstrates fencing when the epoch rotates; operator restore tooling and production deployment acceptance belong to later plans.

## Interfaces for Following Plans

- `server/storage/recovery-state.ts`: `RecoveryState { epoch, schemaVersion }`, `initializeRecoveryState(database)`, `readRecoveryEpoch(database)`, `requireRecoveryEpoch(database, request, reply)`; schema version 1, migration number 8.
- `BoardDescriptor.recoveryEpoch` is required. `SourceOptions.getRecoveryEpoch` captures the currently authorized workspace epoch. `RecoveryEpochError` carries the two stable recovery error codes.
- Journal scope now carries an optional epoch for compatibility with stored rows. Replay rejects missing or different values before transmission and retains their bytes. Plan 04-03 owns versioned reconstructable capture and migration; following recovery UI must surface that retained state.
- Import stages use their existing JSON descriptor to bind the epoch. There is no automatic staged-intent migration or grant/delete/duplicate replay.

## Limits and Remaining Verification

These checks cover local SQLite, real signed HTTP/OIDC, native Chromium and unit transport races. Operator-selected restore, container/pod lifecycle, deployment storage guarantees and the full cross-browser matrix remain later phase gates. The complete Phase 3 browser matrix was not rerun for this bounded plan; the selected 55 browser cases exercise affected imports, sharing, actions, creation and durable restarts. No unfinished product stubs were found.

## Self-Check: PASSED

All declared artifacts exist and all six task commit objects were verified. The final source tree passes both typechecks, recovery assertions and focused browser checks. No tracked-file deletions occurred. Pre-existing branding, README, package metadata, installation and legal-review work remains outside these commits.
