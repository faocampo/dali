---
phase: 04-durable-boards-and-recovery
plan: "01"
subsystem: database
tags: [sqlite, durability, playwright, crash-recovery, oidc]
requires:
  - phase: 03-okta-and-board-access
    provides: Authenticated board document and image transactions
provides:
  - Verified WAL/FULL persistent SQLite startup
  - Owned file-backed child service with private commit-boundary IPC
  - Native cold-browser and transactional crash/replay evidence
affects: [04-02, 04-05, 04-10, 04-11, 04-12, 04-15]
tech-stack:
  added: []
  patterns: [Fail-closed persistent pragmas, private child-process fault injection, signed synthetic OIDC]
key-files:
  created: [tests/durability-fixtures.ts, server/testing/durability-child.ts, tests/durable-restart.spec.ts, server/storage/durability.test.ts]
  modified: [server/storage/database.ts, playwright.config.ts]
key-decisions:
  - Keep fault controls in the test child and wrap its injected connection; production exposes no fault endpoint.
  - Measure ordinary process-restart survival separately from storage-loss and operator restore acceptance.
requirements-covered: [SAVE-01]
requirements-completed: []
coverage:
  - id: D1
    description: Native sticky text, geometry, document identity and PNG hash survive SIGKILL and cold authorized reopen
    requirement: SAVE-01
    verification:
      - kind: e2e
        ref: tests/durable-restart.spec.ts#@04-01-01
        status: pass
    human_judgment: false
  - id: D2
    description: Transaction-boundary retries, failed writes and cross-account denial preserve durable state
    requirement: SAVE-01
    verification:
      - kind: integration
        ref: server/storage/durability.test.ts#@04-01-02
        status: pass
      - kind: e2e
        ref: tests/durable-restart.spec.ts#@04-01-02
        status: pass
    human_judgment: false
actuals:
  tokens: 7574
  tasks: 2
  commits: 4
plan_head_before: e96e1f26d6e06e5852b37bceb3390bb5d6b9ec72
duration: 14min
completed: 2026-09-25
status: complete
---

# Phase 04 Plan 01: Durable Restart Summary

**Persistent SQLite startup verifies WAL/FULL/foreign keys, with real process-crash and cold-browser evidence for acknowledged canvas content and PNG bytes.**

## Accomplishments

- `configureDurableDatabase(database, persistent)` configures and reads back the required settings, closes incompatible connections, and keeps explicitly selected in-memory fixtures separate.
- `createDurabilityService()` owns temporary storage, an ephemeral service port, a signed synthetic OIDC provider, and its child lifecycle. `killAndRestart()` retains the same database and identity configuration. SIGKILL exercises abrupt loss; SIGTERM closes the app and database.
- Private IPC barriers hold an actual open SQLite transaction before commit or hold the HTTP response after transaction completion. Tests independently observe acknowledged responses before the third kill boundary. No production fault routes or environment bypasses were added.
- Document and content-hashed image retries at all three boundaries produce one semantic result. SQLite read-only and page-limit failures report `SQLITE_READONLY` and `SQLITE_FULL`, return HTTP 500 without acknowledgment, and preserve previously acknowledged bytes. Missing image references return 400 without committing.
- Reopened file databases pass `integrity_check` and `foreign_key_check`. A cold unrelated account is denied board, document and image reads after normal restart.

## Task Commits

1. Task 04-01-01 RED — `6378f4f`: failing persistent restart tracer and owned fixtures.
2. Task 04-01-01 GREEN — `14511fc`: verified persistent database startup.
3. Task 04-01-02 RED — `3685c4f`: required private commit-boundary control.
4. Task 04-01-02 GREEN — `1b413e8`: boundary, replay, storage-error and normal-restart evidence.

The measured four-commit count covers implementation/test commits through `1b413e8`; documentation close-out commits follow this measurement. Tokens are realized diff bytes divided by four, rounded up; the diff is ASCII and therefore equals the chars/4 scale.

## Validation Evidence

| Command / gate | Observed result |
|---|---|
| `npm exec playwright test -- tests/durable-restart.spec.ts --project=prod --grep @04-01-01` RED | 1 selected, 1 failed at the expected pragma assertion: DELETE instead of WAL |
| Same tracer after implementation | 1 passed, 0 skipped; 3.8s case, 23.3s total including service/build startup |
| Same tracer feedback gate before task 2 | 1 passed, 0 skipped; 3.8s case, 23.2s total |
| `npm run test:server -- server/storage/durability.test.ts` final | 11 passed, 0 skipped, 7.68s total |
| `npm exec playwright test -- tests/durable-restart.spec.ts --project=prod --grep @04-01-02` | 1 passed, 0 skipped; 4.1s case, 23.7s total |
| Final combined browser suite, `--project=prod` | 2 passed, 0 skipped; 3.9s each, 28.4s total; runtime-error collectors enabled |
| Durability plus existing `server/boards/access.test.ts` | 29 passed, 0 skipped (11 durability plus 18 access regressions), 8.23s |
| `npm run typecheck && npm run typecheck:server` | Both passed after final code edits |
| `git diff --check` and changed-file stub scan | Passed; no unfinished product stubs |

Browser runs used the operator's already installed Playwright cache through `PLAYWRIGHT_BROWSERS_PATH`. Initial sandbox loopback denial and missing default-cache browser were environment setup failures, excluded from RED evidence. No package installation occurred. Existing build chunk/static-import advisories remained unchanged.

## TDD Gate Compliance

Both RED records were validated with `check tdd-red-evidence` and received `RED_EVIDENCE_OK`. The records explicitly disclose normalization from Playwright/Vitest reporters to the classifier's TAP format. Task 1 RED targets missing persistent WAL behavior. Task 2 RED targets newly required private fault-harness behavior; existing transaction correctness received added regression coverage without inventing a production defect. No separate refactor commit was needed.

## Deviations from Plan

- **Rule 3 — fixture/environment setup:** Used the existing browser cache and loopback escalation, with only owned test listeners. No user development services were stopped.
- **Rule 1 — test fixture corrections:** The first expanded run exposed an omitted initial title in expected semantic text and a canned PNG rejected by the existing CRC validator. Expectations now include the original title; images use the established synthetic PNG builder. Subsequent complete runs passed.
- The before-commit probe was strengthened from the existing pre-transaction scheduling hook to holding the injected SQLite transaction after its writes and before commit. This proves rollback of an interrupted transaction.
- Requirement-wide completion remains for the orchestrator/verifier: this plan proves the ordinary-restart slice; later plans own restored-state replay fencing.

## Interfaces for Following Plans

- `tests/durability-fixtures.ts`: `createDurabilityService(assets)`, `durabilityActor(origin, identity)`, returned `origin`, `databasePath`, `pragmas`, `command(mode)`, `waitForBoundary()`, `killAndRestart(signal?)`, and `close()`.
- The child is compiled by the existing server compiler; server durability tests compile it before execution and Playwright's existing service setup builds it. Commands are private IPC, with `before`, `after`, `readonly`, `full`, and `none` modes.
- `database.ts`: exported `configureDurableDatabase(database, persistent)` and existing `openDatabase(path)` signature retained.

## Limits and Remaining Verification

- Evidence covers a real local SQLite file, process loss, normal shutdown, HTTP/OIDC and Chromium cold contexts. Host power loss, physical disk exhaustion, container/pod restarts, operator storage and disaster restore remain their later plan gates. `SQLITE_FULL` is induced with SQLite's page cap; read-only failure uses its real query-only mode.
- The plan's descriptor-less prohibitions retain judgment review. The cold-browser test supplies direct cache-independent evidence; prevention of replay over operator-selected restored state belongs to subsequent phase work.
- No production security surface was added. The new child entrypoint belongs to the synthetic test compiler; production packaging must continue to exclude test entrypoints under plan 04-13.

## Self-Check: PASSED

All six declared artifacts exist. All four task commit objects exist. Required named suites selected tests with zero skips. Static checks pass. Pre-existing README, package metadata, assets, installation script and legal-review changes were preserved outside the task commits.

## Documentation Sources

Better SQLite3 API ([transaction and pragma documentation](https://github.com/wiselibs/better-sqlite3/blob/master/docs/api.md)) and Better SQLite3 performance guidance ([WAL and synchronous FULL](https://github.com/wiselibs/better-sqlite3/blob/master/docs/performance.md)), retrieved through Context7 before the startup change.
