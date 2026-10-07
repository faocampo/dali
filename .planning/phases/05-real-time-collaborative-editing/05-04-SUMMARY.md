---
phase: 05-real-time-collaborative-editing
plan: "04"
subsystem: collaboration
tags: [personal-history, provenance, reservations, reconnect, presence]
requires:
  - phase: 05-03
    provides: Authorized live editing, reservations and presence
provides:
  - Native tab-local operation and complete text-session history
  - Server-acknowledged property provenance and atomic inverse admission
  - Conflict skipping that preserves later foreign changes including ABA
  - Explicit clean reconnect retaining the native history instance
requirements-completed: []
affects: [05-05, 05-08, 05-09]
tech-stack:
  added: []
  patterns: [tab-scoped action provenance, transactional inverse validation, fresh reconnect fences]
key-files:
  created: [src/canvas/account/personal-history.ts, src/canvas/account/live-reconnect.test.ts, server/boards/history-provenance.ts, server/boards/history-provenance.test.ts, tests/collaboration-history.spec.ts, tests/collaboration-history-reconnect.spec.ts, tests/collaboration-history-reservation.spec.ts]
  modified: [src/canvas/account/history-footprint.ts, src/canvas/account/reservations.ts, src/canvas/account/board-workspace.ts, src/canvas/account/live-source.ts, src/canvas/runtime.ts, src/canvas/ViewportControls.tsx, server/boards/change-footprint.ts, server/boards/documents.ts, server/boards/collaboration.ts, server/storage/backup-validation.ts]
coverage:
  - id: HISTORY-CAPTURE
    description: Each reserved operation and complete native text session remains one tab-local step.
    verification:
      - {kind: unit, ref: src/canvas/account/personal-history.test.ts, status: pass}
      - {kind: e2e, ref: "tests/collaboration-history.spec.ts#@05-04-01", status: pass}
    human_judgment: false
  - id: HISTORY-INVERSE
    description: Independent properties survive; later conflicting account/tab actions and structural dependencies are protected at commit.
    verification:
      - {kind: integration, ref: server/boards/collaboration.test.ts, status: pass}
      - {kind: e2e, ref: "tests/collaboration-history.spec.ts#@05-04-02", status: pass}
    human_judgment: false
  - id: HISTORY-LIFETIME
    description: Same-tab clean reconnect retains eligible history; reload resets it; a denied action never replays after release.
    verification:
      - {kind: unit, ref: src/canvas/account/live-reconnect.test.ts, status: pass}
      - {kind: e2e, ref: tests/collaboration-history-reconnect.spec.ts, status: pass}
      - {kind: e2e, ref: tests/collaboration-history-reservation.spec.ts, status: pass}
    human_judgment: false
completed: 2026-10-06
status: automated_verified
---

# Plan 05-04 — Personal undo and redo

Both approved plan tasks have verified automated evidence. The final 98-case integrated Chromium gate passes on `8dc921c`, whose runtime is identical to `a58fcdd`. CAN-03 remains subject to collaborative mind-map and whole-phase acceptance; Phase 5 and the internal release remain incomplete.

## Delivered behavior

The native Store and UndoManager retain their lifecycle. Explicit capture boundaries make a completed gesture or multi-object operation one step and retain every text change until the editing session ends, including pauses beyond the pinned default capture timeout. Remote and hydration origins remain excluded. The history stack stays in tab memory; reload or close resets it.

The server derives affected properties from actual native Yjs update events. Migration 11 stores only authenticated account/tab/action/object/property/revision metadata. Coalesced same-value ABA counts as a later change; creation, deletion and structural dependencies receive whole-object protection. Fresh current reservations precede history admission, and the durable commit rechecks later foreign changes and actual inverse paths in the same transaction as document bytes, revision, receipt and provenance.

A conflicting step is removed through native retention semantics and announced once. The adapter isolates each validated native step so native no-effect skipping cannot execute an older unvalidated action. Redo receives the same checks. Another tab of the same account is a foreign history author. A denied reserved action leaves the stack intact and never runs merely because the other participant finishes.

Explicit Reconnect uses the same tab and native documents/history with a newly authorized connection. Runtime and isolated-server-document checks require an acknowledged, clean local state before any remote application. Pending work is retained for 05-05, without automatic merge or replay. Delayed old responses cannot replace a fresh lease. Disconnected or busy history controls are disabled. Connection feedback is separate from Saved; status stays polite, wraps, repositions on canvas/viewport changes and remains clear of drawing/history controls at 390px.

Backup validation supports complete versions 8–11, validates provenance bindings and verifies a real SQLite backup canary. Existing backup upgrades preserve board content and grants. Optional test port isolation allows an independent checkout to qualify its own source without stopping another checkout's services.

## Revision-scoped evidence

- Capture foundation: `661791a`; provenance and transactional inverse checks: `eb1d221`; clean reconnection: `fded236`; final feedback layout: `33454ae`; deterministic retry fixture: `c495c74`; connection retirement after runtime cancellation: `a58fcdd`.
- Final integrated Chromium at `8dc921c`: **98/98**, zero skips/retries, 12.6m. Includes all 13 personal-history cases plus the existing collaboration, formatting/pointer race, presence, image, arrangement, UI and cold Viewer-first restore suites.
- All 13 personal-history cases per engine at `fded236`: **26/26 Firefox/WebKit**, zero skips/retries, 7.3 minutes. After the feedback-only change in `33454ae`, the two native responsive/reservation cases pass again, **2/2**, 53.7 seconds. These are targeted later checks, not a second full matrix.
- Full client at `a58fcdd`: **265/265 across 24 files**. Both final-source TypeScript checks pass. The two connection-retirement repros failed before the fix and now pass within the **16/16** focused connection tests. Three repeated Chromium native exits confirm successful server acknowledgment and roster removal.
- Expanded final-runtime history/presence Firefox/WebKit matrix at `a58fcdd`: **41 passed, one failed**, 13.6 minutes. All **26 history cases** and every native retirement check passed. The failed Firefox many-participant fixture had no heartbeats, so its additional connections correctly expired while later identities signed in. The corrected fixture at `8dc921c` passes **2/2 Firefox/WebKit**, zero skips/retries, 1.8 minutes. The subsequent complete matrix on `8dc921c` passes **42/42**, zero skips/retries, 11.2m. The original 41/42 run remains separate failed evidence.
- Unchanged server implementation from `eb1d221`: **375/375 across 18 files**, including provenance, current authorization, commit-time races, atomic rollback, idle reservations, backup migration and local storage drills.
- Reviewed synthetic narrow screenshot confirms readable text clear of controls. Native browser-chrome zoom, OS-level IME and spoken assistive technology are not inferred from automated text insertion or viewport sizing.

No required skips/retries or unexpected browser runtime errors are accepted. The reserved-action case explicitly checks its expected HTTP 409 and preserves strict error collection for every other error.

## Failure history and limits

The first text tracer left the pre-pause text after one Undo and drove explicit session capture. A native deletion oracle initially read before restored object existence; its corrected wait preserves the content assertion. Reconnection initially left the actual viewport buttons enabled and drove the control subscription repair. A newly added optional text read failed compilation before test selection, then passed after its type-safe correction. The narrow reservation case reproduced 67px overflow; screenshot review then found drawing-rail occlusion. Measuring the inner viewport missed the sibling controls in two targeted cases; measuring the actual canvas shell fixes both. The first expanded Chromium regression passed 97/98 and exposed a keyboard retry fixture race; the corrected barrier passed three repeated Chromium cases and both other engines. The second expanded regression also passed 97/98 and exposed a real retirement race: the runtime cancellation wrapper aborted cleanup, while another path skipped interrupted connections. Cleanup now uses the independent original transport and retires the captured connection once even after interruption; native tests require an actual server acknowledgment. A later integrated run at `8dc921c` passed 97/98; the final narrow-header case stalled in initial sign-in before opening a board. Its cause was not established, and six deliberate repetitions passed on unchanged source. Subsequent complete gates are recorded above; the original stall remains a diagnostic limit rather than a claimed repair. The next rerun lost its executor session and ended without a suite summary; its retained trace failed in library setup before the formatting gesture and contained a nearly ten-minute gap. Verified orphan fixture services were stopped before a fresh run with a command-lifetime idle-sleep assertion. That interrupted run is not acceptance evidence. Original failures and interrupted executor runs remain in [the execution record](05-04-EXECUTION.md); none is relabeled as passing.

Clean reconnect is the completed history lifetime boundary. Unacknowledged/divergent candidates, restored-write confirmation, private recovery forks, latest-version/download choices, active access-transition UX, concurrent mind maps, twenty native editors and whole-phase human acceptance remain assigned to 05-05 through 05-09. General collaboration remains opt-in. The original checkout and its independent external work were not modified. No external publication, merge or shared deployment occurred.

## Self-check

Passed: implementation and named suites exist, both static checks pass, all thirteen history scenarios pass in each engine, the targeted roster correction passes both additional engines, and the complete 98-case Chromium regression passes. The next approved dependency is 05-05 divergence-aware recovery. CAN-03 and whole-phase acceptance remain open until their later integration and human checks.
