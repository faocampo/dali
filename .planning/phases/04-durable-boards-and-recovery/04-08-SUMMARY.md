---
phase: 04-durable-boards-and-recovery
plan: "08"
subsystem: recovery
tags: [title-intent, indexeddb, navigation, accessibility]
requires:
  - phase: 04-02
    provides: Epoch and revision fencing
  - phase: 04-04
    provides: Authorized recovery coordinator and storage pause
  - phase: 04-05
    provides: Exact save coverage
  - phase: 04-06
    provides: Recovery download
  - phase: 04-07
    provides: Save details and recovery controls
provides:
  - Durable account/board/epoch-scoped title intent with receipt reconciliation
  - Explicit failed-save navigation confirmation and scoped native unload warning
  - Native title conflict, cold reopen, focus and preservation evidence
affects: [04-15, 04-16]
tech-stack:
  added: []
  patterns: [transactional metadata acknowledgment, captured navigation destination, native modal focus]
key-files:
  created: [src/canvas/account/title-intent.ts, src/canvas/account/title-intent.test.ts, src/canvas/leave-policy.ts, src/header/LeaveRecoveryDialog.tsx, tests/recovery-navigation.spec.ts]
  modified: [src/canvas/account/outbox.ts, src/canvas/account/recovery.ts, src/canvas/runtime.ts, src/canvas/save-status.ts, src/boards/operations.ts, src/boards/pending-recovery.ts, src/header/BoardTitleMenu.tsx, src/header/Header.tsx, src/header/SaveDetails.tsx, src/auth/session.ts, src/App.tsx, src/index.css]
key-decisions:
  - Store versioned title metadata in the existing strict journal database; acknowledge only the matching operation ID.
  - Preserve title replay failures independently of authorized document hydration, with bounded periodic retries and visible conflict copy.
  - Explicit Leave preserves available work and may proceed after the displayed local-storage loss warning; ordinary short saves remain nonblocking.
requirements-completed: []
coverage:
  - id: D-05
    description: Durable title retries, cold reopen, receipt matching and revision/authority fencing
    requirement: SAVE-02
    verification:
      - kind: unit
        ref: "src/canvas/account/title-intent.test.ts"
        status: pass
      - kind: integration
        ref: "tests/recovery-navigation.spec.ts#title outage; independent server title; late old title receipt"
        status: pass
    human_judgment: false
  - id: D-04
    description: Stay, Escape, explicit Leave, preserved markers and actual native reload warning
    requirement: SAVE-02
    verification:
      - kind: integration
        ref: "tests/recovery-navigation.spec.ts#@04-08-02"
        status: pass
      - kind: integration
        ref: "tests/library-recovery.spec.ts#download then leave"
        status: pass
    human_judgment: false
  - id: E5
    description: Safe focus, duplicate navigation suppression, local-storage loss copy and 320px containment
    requirement: SAVE-02
    verification:
      - kind: integration
        ref: "tests/recovery-navigation.spec.ts#Stay and Escape; failed local title preservation"
        status: pass
    human_judgment: false
actuals:
  tokens: 19693
  tasks: 2
  commits: 4
plan_head_before: 52295b6e7e1316a43a4c1b48cbf7ba3a4bfba88d
duration: 22min
completed: 2026-09-26
status: complete
---

# Phase 4 Plan 8: Durable Title Intent and Leave Confirmation Summary

**Board names survive outages and reopen with exact receipt acknowledgment; failed-save navigation offers focused Stay/Leave choices while retaining available recovery data.**

## Accomplishments

- Title intent carries a schema version, account, board, epoch, stable operation ID, base revision and intended title. Storage uses the existing journal database and strict transactions. The operation receipt is reconciled before a repeated PATCH; a late old receipt cannot remove newer metadata.
- Fresh session, write capability and matching epoch precede replay. Independent server revision changes retain the intended title and produce an explicit conflict explanation in Save details. Storage failure retains in-memory text, pauses mutation and keeps the focused input readonly. The File menu rename uses the same inline recovery path; library mutation dialogs retain their existing online behavior.
- Save coverage includes the exact title operation. Pending metadata also drives authorized library markers and recovery archive naming. Successful title acknowledgment advances saved coverage; downloads and leaving preserve unresolved records.
- A single App navigation guard captures the requested destination for menu, same-origin link, history and sign-out transitions. The native modal makes the background inert, focuses Stay, traps Tab, treats Escape as Stay, restores origin focus on cancel and suppresses duplicate Leave while preservation is running. The destination library heading receives focus.
- Unconfirmed preservation shows the approved loss-risk sentence, and explicit Leave can proceed after best-effort preservation. Ordinary short saves proceed without confirmation. Authorized Viewer presentation remains read only and does not manufacture a pending-save warning.
- Native beforeunload registration follows risky state and is removed on resolution/disposal. Explicitly approved navigation suppresses a duplicate native warning.

## Task Commits

1. `a435310` — Task 1 RED: nine behavioral title-intent cases failed against the initial unimplemented test seam.
2. `b1e2252` — Task 1 GREEN: durable scoped title intent and recovery integration.
3. `3e5af6f` — Task 2 RED: native failed-save navigation lacked the required confirmation.
4. `85d6ef6` — Task 2 GREEN: navigation guard, modal, title hydration correction and compatible regression assertions.

Actual commits are measured from the persisted plan ledger. Token actuals are the committed diff characters divided by four, rounded up. The 22 changed source/test files and four commits exclude this completion metadata commit.

## Validation

| Gate | Result |
|---|---|
| `npm test -- src/canvas/account/title-intent.test.ts` | 9 passed; initial RED was 9 failed |
| `npm run typecheck` and `npm run typecheck:server` | Both passed for each task and final source state |
| Exact `npm exec playwright test -- tests/recovery-navigation.spec.ts --project=prod --grep @04-08-02` | Final rebuilt run: 6 selected, 6 passed, 0 skipped; 37 seconds including fixture/build startup |
| Scoped existing title and recovery browser regressions | 9 selected, 9 passed, 0 skipped; 42 seconds including startup |
| Full unit suite | 191 passed across 17 files, 0 skipped |
| Final title/save-status focused unit checks | 29 passed across 2 files |
| Production build and diff checks | Passed; existing chunk-size/dynamic-import warnings remain |

The scoped regression command selected `inline|rapid acknowledged|download then leave|retains isolated|independent capture` across board-title, board-actions, local-recovery and library-recovery production tests. It covered 40 rapid acknowledged renames, composition and keyboard focus, archive download followed by Leave, corrupt/old-epoch isolation, and independent journal reconstruction after reload.

The six new native cases establish:

1. Stay and Escape retain the current canvas and journal; double-clicked Leave reaches one library transition with heading focus and a pending marker.
2. A title-only outage survives reload, triggers an actual Chromium beforeunload dialog after user interaction, reuses one operation ID and advances the server revision exactly once after retry.
3. Quota failure retains the entered title and focus; the readonly input and 320px modal preserve reachable controls, focus cycling, cancel focus restoration and the exact loss warning. The synthetic narrow screenshot was inspected.
4. An ordinary held short document save proceeds to the library without confirmation.
5. A real independent server rename leaves the pending local name visible, sends zero overwriting PATCH requests and displays the conflict explanation.
6. Newer native IndexedDB metadata introduced while an older PATCH is held survives the old receipt and remains pending. This simulates a second tab's capture at the transaction boundary.

## Deviations from Plan

- **[Rule 2 — Critical integration] Adjacent adapters:** the plan's declared files did not include the journal metadata adapter, runtime wiring, save coverage, library marker adapter, archive title, auth preservation or Header/SaveDetails presentation. Narrow changes to those existing adapters were necessary to deliver durable title intent and truthful navigation. Existing tests were updated for the new explicit Leave and durable rename contract. No new dependency, endpoint or database table was introduced.
- **[Rule 1 — Bug] Independent title recovery:** the first native cold-reopen case found that throwing a title transport failure fenced document hydration and left the board opening. Title transport/revision failures now retain failed title coverage while authorized document hydration proceeds; authority, epoch and storage errors still fence recovery. The cold-reopen case passed in the final run.
- **[Rule 1 — Bug] Conflict presentation:** Save details' generic failed-save copy initially masked the title-specific conflict explanation. It now retains that explanation, verified by the final rebuilt native test.

Two browser startup attempts stopped on task-local TypeScript issues before selecting tests; those were corrected. An earlier native run was 3/4 before the hydration fix; an intermediate six-case run was 5/6 before rebuilding the conflict-copy correction. The final six-case run and scoped nine-case run are clean. No mandatory gate was skipped.

## Interfaces and Security

`captureTitleIntent()` and `replayTitleIntent()` use a `TitleStore` with scoped read/write and matching-ID acknowledgment. The runtime serializes same-tab captures, performs fresh authorization, reports title coverage, and preserves metadata through normal recovery. `requestBoardNavigation()` routes captured destinations through the App guard; `shouldWarnOnLeave()` distinguishes failed/stalled saves from short saving.

T-04-08-01 is addressed by immutable title/destination capture, account/board/epoch isolation, revision checks, operation receipt validation, exact-ID deletion, safe focus and truthful loss copy. New metadata remains inside the existing browser-storage trust boundary. No additional endpoint, credential, operator configuration or production evidence was introduced. No implementation stubs remain.

## Evidence Limits and Next Work

- Native warning display was observed in Chromium on actual reload following user interaction. Browsers own the warning text, may suppress it, and do not reliably fire beforeunload in mobile app-termination scenarios. Other engines and platform-specific tab-close behavior remain phase-level verification work; local journaling remains independent of warning display.
- SAVE-02 acceptance and all other phase requirement states remain unchanged. Plan 04-15 still depends on its explicit operational prerequisites; final phase verification is 04-16.

## Documentation Consulted

React documentation via Context7: [useSyncExternalStore](https://github.com/reactjs/react.dev/blob/main/src/content/reference/react/useSyncExternalStore.md) (cached snapshots and subscription cleanup) and [useEffect](https://github.com/reactjs/react.dev/blob/main/src/content/reference/react/useEffect.md) (async cleanup and stale results).

MDN: [Window beforeunload event](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event) (user activation, browser-owned copy, mobile reliability and conditional registration).

## Self-Check: PASSED

All five new artifacts and all four implementation/test commits exist. Both tasks passed their exact verification commands. Changed production files contain no unresolved placeholder implementation. Pre-existing user files remain outside the plan commits.
