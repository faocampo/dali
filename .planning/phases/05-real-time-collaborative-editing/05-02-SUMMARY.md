---
phase: 05-real-time-collaborative-editing
plan: "02"
subsystem: collaboration
tags: [reservations, native-actions, admission, concurrent-editing]
requires:
  - phase: 05-01
    provides: Authenticated live documents and server-fenced native operations
provides:
  - Whole-object text editing reservations and named conflict feedback
  - Native creation, formatting, history, grouping, frame and image admission
  - Cancellation, disconnect release and asynchronous affected-set revalidation
  - Combined production browser regression evidence
requirements-completed: [COL-01]
affects: [05-03, 05-04, 05-09]
tech-stack:
  added: []
  patterns: [private deferred gesture preview, complete affected-set reservation, acknowledged release]
key-files:
  created: [src/canvas/account/deferred-creation.ts, src/canvas/account/history-footprint.ts, tests/collaboration-reservations.spec.ts]
  modified: [src/canvas/account/reservations.ts, server/boards/change-footprint.ts, server/boards/reservations.ts]
key-decisions:
  - Reserve complete dependent sets before native mutation, then release after acknowledgment.
  - Preserve sequential typography failure evidence in user-requested backlog 999.8 despite the latest passing case.
coverage:
  - id: RESERVATION-TEXT
    description: Text sessions fence conflicting movement and name the authenticated editor while independent objects remain editable.
    verification:
      - {kind: e2e, ref: "tests/collaboration-reservations.spec.ts#@05-02-01", status: pass}
    human_judgment: false
  - id: RESERVATION-ACTIONS
    description: Native creation, formatting, grouping, frame membership, history, image controls and interruption scenarios converge between editors.
    verification:
      - {kind: e2e, ref: "tests/collaboration-reservations.spec.ts#@05-02-02", status: pass}
      - {kind: integration, ref: server/boards/reservations.test.ts, status: pass}
    human_judgment: false
  - id: RESERVATION-UX
    description: Reservation feedback remains understandable and usable during real collaborative editing.
    human_judgment: true
    rationale: Automated tests verify feedback text and action outcomes; perceived adequacy of the complete collaborative experience remains phase UAT.
completed: 2026-10-05
status: complete
---

# Plan 05-02 — Complete object reservations

Native text sessions and object actions acquire their server-derived dependencies before mutation and retain their leases until resulting writes are acknowledged.

## Implementation and commits

The earlier implementation is committed in `2e4d42a`. Continued native frame membership, group-member release and pending-gesture cancellation are committed in `0966002`. Two coupled tasks were executed across multiple resumed sessions; a reliable total duration was not retained.

- Text sessions fence geometry, style and deletion conflicts with named feedback.
- Native commands include creation, clipboard, grouping, ordering, locking, history, connector retargeting/quick-add, populated-frame transforms and image visual controls.
- Dependent gestures preview locally until the final affected objects can be admitted. Frame resize revalidates identity, geometry, lock state and membership after admission.
- Cancelled pending input cannot replay after a late acquisition response. Detected disconnection releases ownership.
- Tests verify denied operations preserve content, remote convergence, image source/geometry replacement, reopening, and cancellation when another editor changes a proposed frame's contents during admission.

## Verification

At implementation revision `0966002`:

- Combined production Chromium: **71/71 passed**, zero skips/retries, 6.4 minutes. Suites: collaboration reservations, collaboration durability, canvas arrangement, image visual edits and UI refinements.
- Focused expanded native-action checks: **7/7 passed** before the combined run.
- Client account suites: **117/117 passed across 10 files**.
- Server reservation suite: **15/15 passed**.
- Client/server TypeScript checks and whitespace validation passed.
- Prior full serialized server result remains **349/349** at its earlier revision; server implementation was unchanged in this final slice.

## Issues and limits

The user explicitly deferred size-then-Bold formatting to backlog 999.8. The current combined typography case passed; no repair to that specific race was attempted here. Preserve the earlier 62/63 failures and GitHub issue #1 until deliberate diagnosis and regression verification establish resolution. This passing run does not establish that an intermittent issue is fixed.

Trace inspection corrected test geometry that had left a shape partially outside a frame. A group-release failure required parent-container admission. The extended image test initially failed static checking on native property access, then passed after using image props. Detailed historical failures and repairs remain in [05-02-EXECUTION.md](05-02-EXECUTION.md) (execution evidence).

Current automated plan gate passes. Whole-phase COL-01 acceptance and general collaboration activation still require later plans and phase verification. Participant presence is the next capability in Plan 05-03.

## Self-Check: PASSED

Implementation commits and named artifacts exist; current required automated checks pass. Deferred typography evidence and remaining phase UAT remain explicit.
