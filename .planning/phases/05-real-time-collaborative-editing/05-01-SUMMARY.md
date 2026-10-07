---
phase: 05-real-time-collaborative-editing
plan: "01"
subsystem: collaboration
tags: [native-canvas, reservations, durable-receipts, long-poll]
requires:
  - phase: 04-durable-boards-and-recovery
    provides: Authorized durable documents, recovery epochs and image acknowledgments
provides:
  - Authenticated native shape movement with server-fenced reservations
  - Live remote hydration for editors and Viewers
  - Transactional operation receipts and bounded identical retry
  - Compatible additive database migration and cold-restart evidence
affects: [05-02, 05-03, 05-05, 05-07, 05-09]
actuals:
  tokens: 24686
  tasks: 2
  commits: 1
tech-stack:
  added: []
  patterns: [revisioned full-snapshot long-poll, before-after native effect admission]
key-files:
  created: [server/boards/collaboration.ts, src/canvas/account/live-source.ts, tests/collaboration.spec.ts]
  modified: [server/boards/documents.ts, src/canvas/account/board-workspace.ts, src/canvas/account/mutation-guard.ts, server/storage/backup-validation.ts]
key-decisions:
  - Full bounded document snapshots replace retained event queues; revision cursors catch subscription gaps and clients discard older or duplicate snapshots.
  - Keep collaboration activation gated while unsupported mutation families and recovery choices are implemented in subsequent plans.
  - Retain reservations through native drag-end completion and acknowledged document synchronization.
requirements-completed: [COL-01, COL-04]
coverage:
  - id: LIVE-SHAPE
    description: Two authenticated editors move independent native shapes while a Viewer receives both changes; cold server and browser reopening retains the moves.
    requirement: COL-01
    verification:
      - kind: e2e
        ref: tests/collaboration.spec.ts#@05-01-01
        status: pass
    human_judgment: false
  - id: LIVE-RECEIPT
    description: A deliberately lost commit response retries the identical operation and returns its original receipt without a duplicate commit.
    requirement: COL-01
    verification:
      - kind: e2e
        ref: tests/collaboration.spec.ts#@05-01-02
        status: pass
    human_judgment: false
  - id: LIVE-AUTH
    description: Held delivery reauthorizes access, and invalid actors, epochs, leases and Viewer writes cannot expose or change content.
    requirement: COL-04
    verification:
      - kind: integration
        ref: server/boards/collaboration.test.ts
        status: pass
    human_judgment: false
completed: 2026-10-02
status: complete
---

# Plan 05-01 — Live native editing tracer

Two editors can move separate native shapes, see committed changes live, and reopen them after a cold restart; a Viewer observes without local writes.

## Implementation

- Connection scope binds board, authenticated account, tab and recovery epoch. Atomic reservations fence actual native before/after effects at the durable transaction boundary.
- A receipt records operation ID, actor, tab, payload digest and committed revision in the same transaction. An identical retry returns the original acknowledgment; conflicting payloads fail.
- Revisioned snapshots catch subscription gaps. Older/duplicate snapshots are ignored; both native documents are decoded before delivery. Remote application uses the source origin to prevent echoes and allow read-only hydration.
- Lost connections stop the live source. Pending recovery on live-enabled boards is quarantined until the later version-choice plans provide the approved recovery flow.
- Migration 10 adds collaboration activation and receipts. Backup validation retains versions 8 and 9, and repeated opening preserves prior documents/grants.

## Commits and checks

Implementation and both coupled tasks: `9dbc9f9`.

- Production Chromium: **2/2** native browser scenarios, zero skips/retries, including two editors plus Viewer, native hit-testable models, cold process restart/fresh browser contexts, and intentionally lost acknowledgment.
- Collaboration server: **19/19** final cases, including snapshot gaps, revoked held delivery, failed transaction with no event/receipt, actor/epoch/token fencing, hidden effects and idempotency.
- Backup compatibility: **24/24** cases. Combined earlier run passed 42 cases before the final added container-metadata test; the final collaboration run passed all 19 separately.
- Client document/live/guard suites: **34/34** cases.
- Frontend and server typechecks passed. Staged whitespace check passed. Production assets rebuilt by the browser suite.
- The response-loss browser scenario expects exactly one injected network failure; every other browser error remains fatal.

## Corrections and deviations

- The first native run exposed stale initial viewport coordinates. Initialize the viewport rectangle before reservation hit testing.
- A capture-phase microtask released the lease before native drag-end completed. Observe bubbling completion before waiting for synchronization and releasing.
- Native root bootstrap needs canonical encoded-state comparison; uninitialized shared-map JSON incorrectly classified a no-op as an unsupported mutation.
- Canonical property ordering and native container metadata checks prevent false effect classification and unreserved wrapper changes.
- Backup validation and descriptor types were added to the ownership list because the additive schema and activation boundary require them. No dependency was added.
- Full bounded snapshots serve as gap catch-up instead of retaining an event log. One active poll per connection and bounded account connections/reservation work constrain queues; there is no board participant admission cap.
- Tasks share one implementation commit because transport, gesture admission and the failure checks establish the same tracer boundary.

## Remaining phase obligations

This completes the plan-scoped contribution to COL-01/COL-04; those requirements remain pending in the phase requirement tracker until full acceptance. Ordinary boards retain existing behavior while activation is gated. Plans 02–09 must add complete action coverage, presence, personal history, approved disconnected-work/fork choices, permission transitions, mind maps and the measured 20-participant/cross-browser gate. The tracer does not establish those later capabilities.

## Self-check

All named implementation/test artifacts exist and the production commit is present. No Phase 5 acceptance or whole-phase completion is claimed.
