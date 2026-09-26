---
phase: 04-durable-boards-and-recovery
plan: "05"
subsystem: persistence
tags: [yjs, save-status, recovery, images, acknowledgments]
requires:
  - phase: 04-02
    provides: Epoch-bound document and image acknowledgments
  - phase: 04-03
    provides: Reconstructable local capture and exact journal acknowledgment
  - phase: 04-04
    provides: Authorized coalesced recovery coordination
provides:
  - Immutable current-scope document and required-image save coverage
  - Stable previous server-save age during pending work and failures
  - Automatic and manual image verification within one authorized recovery flight
affects: [04-06, 04-07, 04-12, 04-13, 04-15]
tech-stack:
  added: []
  patterns: [Yjs semantic coverage, keyed image attempts, response delivery barriers]
key-files:
  created: [tests/save-status.spec.ts, tests/save-status-fixtures.ts]
  modified: [src/canvas/save-status.ts, src/canvas/save-status.test.ts, src/canvas/account/doc-source.ts, src/canvas/account/blob-source.ts, src/canvas/account/outbox.ts, src/canvas/account/recovery.ts, src/canvas/runtime.ts, src/header/Header.tsx]
key-decisions:
  - Derive Saved from confirmed current Yjs content and every current required image, preserving the previous full server-save time during pending work.
  - Scope callbacks by account, board, generation and recovery epoch, and scope image results by individual attempt.
  - Verify failed required image reads through the same authorized recovery flight as journal replay, retaining their errors until matching confirmation.
requirements-covered: [SAVE-02]
requirements-completed: []
coverage:
  - id: D-01
    description: Prior server-save age remains visible while newer work waits
    requirement: SAVE-02
    verification:
      - kind: integration
        ref: tests/save-status.spec.ts#@04-05-02
        status: pass
    human_judgment: false
  - id: D-02
    description: Coalesced retries preserve keyed errors until their own confirmation
    requirement: SAVE-02
    verification:
      - kind: integration
        ref: tests/save-status.spec.ts#@04-05-02
        status: pass
    human_judgment: false
  - id: D-03
    description: Image-only failure requires acknowledged current documents; combined failure remains distinct
    requirement: SAVE-02
    verification:
      - kind: integration
        ref: tests/save-status.spec.ts#@04-05-02
        status: pass
    human_judgment: false
actuals:
  tokens: 14531
  tasks: 2
  commits: 4
plan_head_before: 877dc4b70c60dbbb69b3f146b3894e5db4a5b1c6
duration: 24min
completed: 2026-09-26
status: complete
---

# Phase 4 Plan 5: Current Save Coverage Summary

**Saved now follows actual current document and required-image acknowledgments, with stable prior save age and individually retained image failures.**

## Accomplishments

- Added immutable `SaveSnapshot`, `ImageSaveRow`, `SaveEvent` and `reduceSaveStatus` while retaining the existing external-store subscription interface. Legacy local-only workspace status remains isolated from account-board status.
- Transport and journal replay outcomes accumulate actual confirmed Yjs updates. Live document coverage includes causal structure and deletion coverage; an older acknowledgment cannot cover a newer local edit. Local preservation, request dispatch and recovery export cannot establish Saved.
- Required-image rows distinguish waiting, uploading, failed and saved. Unrelated successful images cannot erase a failure. Removing a failed image locally retains its failure until the current reference removal is acknowledged.
- Header status preserves the last full server-save age during pending/failure and uses the shared recovery retry. Ordinary retries retain their known errors; unsafe authorization/storage/recovery states keep priority.
- Recovery verifies required images through fresh authorized server reads even when the journal is empty. Automatic and repeated manual retry requests coalesce, use existing backoff, and ignore stale board/account lifetimes. Document and image stalls report failure after 15 seconds.

## Task Commits

| Task | RED | GREEN |
|---|---|---|
| 04-05-01 Exact current save coverage | `f0f848f` | `1776d8e` |
| 04-05-02 Real request barriers and image verification | `5cda52f` | `0b123c2` |

The four task commits were measured from the persisted plan base before this summary was written. Actual tokens are 58,125 realized source/test diff characters divided by four and rounded; planning metadata is excluded.

## TDD Gate Compliance

Both tasks followed RED → GREEN. Task 1 first failed the assertion that current confirmed documents establish Saved at the expected timestamp. Task 2 first failed after a real image read error: clicking Retry saving never issued the required successful read, and Saved remained absent for the 20-second assertion timeout. Each observed assertion was recorded with command, exit code, target, expected and actual behavior; both GSD checks returned `RED_EVIDENCE_OK` before implementation. RED commits contain the failing cases, and GREEN commits contain their completed behavior. No mandatory test was skipped.

## Verification

- Exact `npm test -- src/canvas/save-status.test.ts`: **20 passed**, zero skipped; final run 161 ms including startup. Cases include newer edits, immutable rows, stale scope/attempts, image-only/combined failures, unrelated success, confirmed removal, prior saved time, unsafe-state priority and forbidden dispatch/local/export success signals.
- Full `npm test`: **157 passed**, 14 files, zero skipped, 9.11 seconds including startup. This includes the existing recovery coordinator regression suite.
- Exact `npm exec playwright test -- tests/save-status.spec.ts --project=prod --grep @04-05-02`: **9 passed**, zero skipped, 46.7 seconds including owned server/build startup. Individual cases total approximately 28.1 seconds; the real 15-second stall case took 16.0 seconds.
- Native cases cover: individual image retry; old document acknowledgment with newer edits and retained save age; timed document stall; no initial document response; confirmed failed-image reference removal; unrelated image success with coalesced automatic/manual retry; combined missing-image/reference failure with newer edits; late old-board response; and late previous-account acknowledgment.
- Three focused prior browser regressions passed in the combined run: quota pause/recovery and responsive controls (2.2 seconds), interrupted acknowledgment with idempotent committed replay (3.1 seconds), and delayed image response across an actual account switch (3.8 seconds). That combined run had one barrier-fixture failure subsequently corrected and superseded by the exact nine-case gate.
- Both `npm run typecheck` and `npm run typecheck:server` passed per task and after final production changes. The native gate built the production bundle. `git diff --check` passed; no tracked file deletions occurred.

Browser fixtures fetch real server responses and hold their delivery. Failure injection uses synthetic HTTP errors; actual native canvas mutations, authentication, image storage and document/reference admission remain in the path. These tests establish application response behavior in Chromium with the explicit synthetic service storage policy. Production backup-fence integration remains 04-15-03; cross-browser phase-wide acceptance remains with the later verifier.

## Deviations from Plan

1. **[Rule 2 — acknowledgment integration]** Added the minimal `ReplayObserver` callback to `outbox.ts`, because replay confirmations must reach the same current-coverage reducer as direct native transport. Added Header status visibility, preserved age and shared retry wiring so the specified behavior is visible. Commit: `1776d8e`.
2. **[Rule 1 — empty-journal image retry]** The required browser RED exposed that journal-only recovery could never recheck a failed image read when no pending records remained. Added optional post-drain verification to the existing coordinator and a fresh scoped `BoardBlobSource` read for each unconfirmed required image. Commit: `0b123c2`.
3. **[Rule 3 — deterministic response fixtures]** Scoped old-board barriers to the old board and retained their bypass handler until page teardown. Traces demonstrated that unregistering a route during `route.fetch` could race automatic continuation (`Route is already handled`), producing a fixture failure. The final exact gate passed after correction. Commit: `0b123c2`.

Broken-windows entry 16 records the completed integration correction as fixed. No packages were installed; existing user files and services were preserved.

## Interfaces for Following Plans

- `getAccountSaveSnapshot()` returns the immutable current account-board snapshot. `documents` contains per-document revision/acknowledgment/failure; `images` contains keyed labels, attempt, required/previously-required flags and state. `savedAt` remains the last fully covered server time.
- `reportSaveCoverage`, `reportImageOutcome` and `dispatchSaveEvent` feed the reducer using the current scope identifier. Scope includes account, board, generation and epoch. Image completion carries its attempt identifier.
- Document/blob sources report sending, loaded, acknowledged and failed outcomes; pending local image reads do not establish server coverage. `ReplayObserver` reports the actual replay request and acknowledgment outcome.
- `RecoveryCoordinator` accepts optional `verify(authority, signal)` after journal drain. `retryIfIdle()` starts background recovery without replacing an active flight or scheduled backoff. `retryRecovery()` remains the shared manual retry operation.

## Deferred Issues and Acceptance Limits

The source-review finding in [deferred-items.md](deferred-items.md) concerns an existing authorized Viewer path: the coordinator emits `denied` to isolate pending writes, App allows the read-only canvas, and Header can render recovery attention. This predates the plan base and has no native reproduction in this plan. **04-07 reproduction target:** open a board as an authorized Viewer, with and without an isolated pending journal, and assert the visible save/read-only status and available controls; distinguish this from actual access loss. The orchestrator owns routing this finding before phase verification.

No unfinished implementation stubs were found in the changed files. The declared asynchronous-response trust boundary covers the added acknowledgment and verification paths; there are no new server endpoints or storage schemas. SAVE-02 requirement-wide acceptance and judgment prohibitions remain pending the phase verifier. Next dependency-ordered plan is **04-12**.

## Documentation Consulted

- Yjs snapshot coverage ([https://github.com/yjs/yjs/blob/main/src/utils/Snapshot.js](https://github.com/yjs/yjs/blob/main/src/utils/Snapshot.js)) and update application ([https://github.com/yjs/yjs/blob/main/src/utils/encoding.js](https://github.com/yjs/yjs/blob/main/src/utils/encoding.js)), retrieved through Context7 for causal state/deletion coverage.
- Playwright request interception ([https://github.com/microsoft/playwright/blob/main/tests/page/page-request-intercept.spec.ts](https://github.com/microsoft/playwright/blob/main/tests/page/page-request-intercept.spec.ts)) and route lifecycle ([https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/client/network.ts](https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/client/network.ts)), retrieved through Context7 while correcting asynchronous barrier cleanup.

## Self-Check: PASSED

Both new test artifacts exist, all ten implementation/test files exist, and all four task commits exist. Required automated gates passed without skips. The Viewer follow-up is explicitly scoped to later native verification rather than counted as accepted behavior.
