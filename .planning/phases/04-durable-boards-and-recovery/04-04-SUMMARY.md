---
phase: 04-durable-boards-and-recovery
plan: "04"
subsystem: recovery
tags: [authorization, indexeddb, yjs, recovery, playwright]
requires:
  - phase: 04-03
    provides: Scoped reconstructable checkpoints, retained image bytes and exact acknowledgments
provides:
  - Fresh-authority recovery coordination with bounded retries and stale-callback fencing
  - Local reconstruction during failed sending and independent storage mutation pause
  - Explicit restored-board entry retaining older journals and native recovery UI evidence
affects: [04-05, 04-06, 04-07, 04-08, 04-09, 04-15, 04-16]
tech-stack:
  added: []
  patterns: [Single scoped drain, authority before local inspection, separate read and mutation permission, explicit epoch quarantine]
key-files:
  created: [src/canvas/account/recovery.ts, src/canvas/account/recovery.test.ts, src/canvas/RecoveryStateView.tsx, tests/recovery-fixtures.ts]
  modified: [src/canvas/runtime.ts, src/auth/session.ts, src/canvas/account/mutation-guard.ts, src/canvas/account/mutation-guard.test.ts, src/App.tsx, tests/local-recovery.spec.ts, src/index.css, src/canvas/account/board-workspace.ts, src/canvas/account/outbox.ts, src/canvas/export-board.ts, src/header/Header.tsx, tests/board-access.spec.ts, tests/session-recovery.spec.ts]
key-decisions:
  - Reconstruct local documents only during initial pending recovery; acknowledged recovery returns to ordinary server hydration and image authorization checks.
  - Keep storage suspension inside the active authorized scope, retain memory, and resume mutations only after preservation and successful replay.
  - Explicit restored-board entry excludes old epochs from replay without rewriting or deleting their records.
requirements-covered: [SAVE-01, SAVE-02]
requirements-completed: []
coverage:
  - id: D-05-D-06
    description: Authorized pending content reopens during failed sending and replays only after current identity and write permission checks
    requirement: SAVE-01
    verification:
      - kind: unit
        ref: src/canvas/account/recovery.test.ts
        status: pass
      - kind: e2e
        ref: tests/local-recovery.spec.ts#@04-04-01
        status: pass
    human_judgment: false
  - id: D-07-E4
    description: Native quota and aborted transactions pause mutations while retaining visible work, inspection, retry and currently authorized download
    requirement: SAVE-02
    verification:
      - kind: unit
        ref: src/canvas/account/mutation-guard.test.ts
        status: pass
      - kind: e2e
        ref: tests/local-recovery.spec.ts#@04-04-03
        status: pass
    human_judgment: false
  - id: E4-native-zoom
    description: Actual browser 200 percent zoom and browser-managed navigation warning behavior
    verification: []
    human_judgment: true
    rationale: The plan assigns actual browser zoom and warning behavior to final human acceptance; CSS emulation is not equivalent evidence.
actuals:
  tokens: 19583
  tasks: 3
  commits: 6
plan_head_before: 88f2ad2507c05bd632b3790828dd244e3146f379
duration: 32min
completed: 2026-09-26
status: complete
---

# Phase 04 Plan 04: Authorized Recovery and Mutation Pause Summary

**Fresh session and board authority fence local reconstruction and replay; storage failure freezes native mutations while the visible board, retained bytes, inspection and recovery controls remain available.**

## Accomplishments

- `RecoveryCoordinator` coalesces each runtime's drain, distinguishes checking/recovering/pending/retrying/saved/expired/denied/storage-paused/corrupt/epoch-mismatch, and rechecks the current scope after awaited work. Retries use jittered 1/2/4/8/16/30-second capped backoff, a 15-second stalled indication and a 30-second abort. Disposed or superseded work cannot publish late success.
- Opening obtains the session and current descriptor before journal inspection. Different account, denied access and known expiry produce zero local recovery opens and zero replay requests in native browser tests. Viewer recovery displays the current authorized server board read-only and retains the editor's pending journal separately.
- Validated checkpoint root/content updates merge with the scoped pending updates before native mounting when sending fails. Available image bytes travel with this baseline. Successful replay returns to server hydration; later native synchronization cannot repopulate the initial hydration cache. Images precede document references during replay, and newer pending records prevent the coordinator from reporting a completed drain.
- Local storage failure keeps an active read-authorized scope, marks the native store read-only, retains failed memory bytes and stops unsafe writes. The native mutation guard covers direct nested Yjs setters and store/history methods; input admission blocks typing, paste and drop while keeping inspection and viewport controls usable. Retry first confirms current authority, preserves memory, then replays; a download does not resume editing.
- Corrupt and unsupported rows remain untouched with distinct explanatory copy. Restoration mismatch exposes explicit Open restored board; the new authorized epoch opens without rewriting or deleting older records. Existing denied-access discard remains a separately confirmed action.
- Recovery controls use the existing title group, keyboard dismissal and trigger focus return. User keyboard or pointer interaction cancels deferred recovery-focus restoration. Focus restoration also waits for acknowledged recovery. The native suite proves empty, loading, error, populated, overflow and long-text E4 states with five widths, reduced motion, 200-character titles and a real image with a 120-character filename prefix.
- The visible paused-board recovery action uses the existing authorized archive exporter. A native quota case downloads an image-bearing archive while remaining paused. Dedicated offline and quarantined snapshot archive construction remains assigned to plan 04-06; this plan does not claim that later contract.

## Task Commits

1. **04-04-01 — fresh-authority reopen and drain:** `1c17b1b` (RED), `443476f` (GREEN).
2. **04-04-02 — inspectable storage pause and restored entry:** `42bd325` (RED), `131db36` (GREEN).
3. **04-04-03 — native lifecycle, focus and responsive proof:** `b322d4a` (RED), `ec01b15` (GREEN).

The six task commits and 19,583 diff-character token estimate were measured from the persisted plan ledger before documentation commits. Seventeen implementation/test files changed. Duration is approximately 32 minutes from the first recorded behavioral verification through final task commit; initial context loading is excluded.

## TDD Gate Compliance

| Task | Observed intentional RED | Final GREEN |
|------|--------------------------|-------------|
| 04-04-01 | The ordered authorization test rejected with Recovery coordination unavailable instead of resolving the authorized descriptor. | Seven coordinator tests pass; four named native authority/outage cases pass. |
| 04-04-02 | A deferred setter changed Yjs bytes after storage-paused, corrupt and epoch-mismatch transitions. | Nine mutation/authority cases and seven coordinator cases pass. |
| 04-04-03 | Escape left Retry saving visible rather than closing recovery details and returning trigger focus. | Five named native cases pass, including dismissal, focus, retained journals and responsive storage pause. |

All three persisted RED records passed `check tdd-red-evidence` with `RED_EVIDENCE_OK`. Vitest and Playwright observed failures were explicitly normalized to TAP for the runtime's parser. The first task-3 fixture startup failed before test discovery because the new fixture imports were incomplete; it was not accepted as RED. Initial task-3 storage/layout cases already passed; the missing Escape behavior supplied the intentional RED before its implementation.

## Verification

- Final `npm test`: **141 passed**, 14 files, zero skipped.
- Exact coordinator command: **7 passed**. Exact coordinator plus mutation-guard command: **16 passed**, zero skipped.
- Exact `@04-04-01` production browser command on final source: **4 passed**, **22.0 seconds** including startup/build.
- Exact `@04-04-03` production browser command on final source: **5 passed**, **30.5 seconds** including startup/build.
- Final production regression over local recovery, board access, session recovery and durable restart: **52 passed**, zero skipped, **2.0 minutes** including startup/build. It covers actual SIGKILL/cold restart, delayed old-identity responses, role changes at replay commit, reauthentication and native text-selection restoration.
- Both `npm run typecheck` and `npm run typecheck:server`: passed after final source changes and before task commits. Production builds ran during native test startup. `git diff --check`: passed; no tracked files were deleted.
- Native quota/abort tests attempt typing, delete, paste, image drop, direct nested Yjs mutation and undo/redo; compare exact serialized model state; exercise zoom, fit, pointer selection and pan; retain visible image/content; and assert download alone leaves editing paused. All five approved widths keep recovery controls within the viewport, with no horizontal page overflow and a bounded header.
- Inspected the generated 320px recovery screenshot. The initial screenshot exposed a title consuming most of the viewport. Final styling contains the title, preserves its full accessible text and keeps controls reachable with the existing palette.
- Earlier broad runs passed 46/52 and then 49/52. Their failures were investigated and corrected; the final 52/52 supersedes them. The intermediate focused image/recovery run passed 7/7.

## Deviations from Plan

### Auto-fixed Integration and Regression Issues

1. **[Rule 2 — integration] Native hydration and validation seams.** Local reconstruction required a `recoveryBaseline` option in the existing workspace, reuse of the journal validator, and an explicit current-epoch replay filter for restored entry. Files: `src/canvas/account/board-workspace.ts`, `src/canvas/account/outbox.ts`. Task 1/2 commits: `443476f`, `131db36`.
2. **[Rule 2 — integration] Header and export admission.** Existing status/menu controls and the archive export write guard needed the new mutation/read distinction. The header mounts recovery controls, disables mutation commands during pause, and forwards restored-board entry. Export still enforces current read/editor authority while permitting storage pause. Files: `src/header/Header.tsx`, `src/canvas/export-board.ts`. Commits: `131db36`, `ec01b15`.
3. **[Rule 1 — regression] Initial hydration race and image caching failure.** Native sync can inspect pending data before runtime publication; that inspection repopulated a cache after successful replay and suppressed server image-loading/access tests. Reconstruction now runs only during initialization. Failed cache admission retains validated bytes and pauses edits without making an authorized image unreadable for recovery export; corrupt bytes still fail. File: `src/canvas/runtime.ts`. Commit: `ec01b15`.
4. **[Rule 1 — regression] Denied replay and focus timing.** A denial after authorization could retain the earlier authority object and enter hydration; it now returns the denied outcome before mounting. Recovery focus waits for acknowledgment and yields to intervening user input. Files: `src/canvas/runtime.ts`, `src/auth/session.ts`. Commit: `ec01b15`.
5. **[Rule 2 — acceptance alignment] Earlier browser assertions.** The earlier Viewer case expected a blocked recovery screen, while this plan requires authorized server content read-only. The earlier failed-replay case expected no visible canvas, while D-05/D-06 require preserved work to remain visible. Updated those assertions and added an explicit empty-journal barrier before the server-image loading case. The zoom assertion now measures a real increase from the actual viewport rather than assuming image fitting left it at 100 percent. Files: `tests/session-recovery.spec.ts`, `tests/board-access.spec.ts`, `tests/local-recovery.spec.ts`. Commit: `ec01b15`.

No dependency was installed. Unrelated user changes were preserved. No authentication gate required operator action.

## Interfaces and Following Work

- `RecoveryCoordinator.open()`, `retryRecovery()` and `dispose()` own retry lifetime. `RecoveryDependencies` separates authorization, inspection, preservation and drain. `RecoveryOutcome` is the shared state vocabulary.
- `AccessScope.recoveryState` and `stalled` expose status. `canMutateCurrentScope()` and `canExportRecoveryScope()` separate mutation admission from authorized read/export. `pauseRecoveryStorage()` retains the visible runtime; exported `retryRecovery()` addresses its current coordinator.
- `AccountWorkspaceOptions.recoveryBaseline` supplies validated initial bytes; `openRestored` is the explicit opt-in to the current epoch while older journal rows stay stored. The App's Open restored board action allocates a fresh runtime generation.
- `RecoveryStateView` and native failure fixtures can be reused by following save-status/details/navigation plans. Exact document/image acknowledgment presentation, complete offline/quarantined recovery archives, richer save details and pending library markers remain plans 04-05 through 04-09.
- Native 200 percent browser zoom and browser-managed warning behavior remain the plan's stated final human checks. CSS viewport/reduced-motion evidence does not substitute for them. Requirement-wide SAVE-01/SAVE-02 acceptance remains with phase verification.

## Documentation Consulted

Yjs document updates, fetched through Context7, supplied the `mergeUpdates`, `applyUpdate` and transaction-origin contract: Yjs documentation ([https://github.com/yjs/docs/blob/main/api/document-updates.md](https://github.com/yjs/docs/blob/main/api/document-updates.md)). Installed native workspace/sync code supplied the integration boundaries.

## Self-Check: PASSED

All four created files and all six task commits exist. Every named automated gate selected tests and passed in its final run. Stub scan found no placeholder implementation preventing this plan's scoped outcome. No new network endpoint, schema or authentication mechanism was introduced; recovery reads remain behind the existing session/descriptor trust boundary. Public artifacts contain synthetic evidence only.
