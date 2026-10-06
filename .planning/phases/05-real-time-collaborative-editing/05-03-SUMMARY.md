---
phase: 05-real-time-collaborative-editing
plan: "03"
subsystem: collaboration
tags: [presence, participants, native-projection, accessibility]
requires:
  - phase: 05-02
    provides: Authenticated native reservations and acknowledged live operations
provides:
  - Server-derived account presence and role-filtered editor decoration
  - Account aggregation, idle state and disconnect handling
  - Accessible roster loading, empty, error, retry and overflow states
  - Current-source native cursor projection and combined regression evidence
requirements-completed: []
affects: [05-04, 05-09]
tech-stack:
  added: []
  patterns: [separate presence delivery cursor, acknowledged publication recovery, live viewport origin]
key-files:
  created: [server/boards/presence.ts, server/boards/presence.test.ts, src/canvas/account/presence.ts, src/header/Participants.tsx, src/header/participants.css, tests/collaboration-presence.spec.ts]
  modified: [server/boards/collaboration.ts, src/canvas/account/live-source.ts, src/canvas/account/live-source.test.ts, src/canvas/blocksuite-editor.ts, src/header/Header.tsx]
coverage:
  - id: PRESENCE-IDENTITY
    description: Authenticated names and roles, account aggregation and Viewer cursor filtering.
    verification:
      - {kind: integration, ref: server/boards/presence.test.ts, status: pass}
      - {kind: e2e, ref: "tests/collaboration-presence.spec.ts#@05-03-01", status: pass}
    human_judgment: false
  - id: PRESENCE-STATES
    description: Loading, only-self, partial name, error/retry, idle, tabs and 21-account roster projection.
    verification:
      - {kind: unit, ref: src/canvas/account/live-source.test.ts, status: pass}
      - {kind: e2e, ref: "tests/collaboration-presence.spec.ts#@05-03-02", status: pass}
    human_judgment: false
  - id: PRESENCE-UX
    description: Native browser-chrome zoom and final collaborative usability judgment.
    human_judgment: true
    rationale: Actual 390px and 640px layout and native canvas zoom/pan are automated; browser-chrome 200 percent zoom and final presence UX remain explicit phase acceptance obligations.
completed: 2026-10-06
status: complete
---

# Plan 05-03 — Presence and participant controls

The required automated plan gate passes. COL-02 remains subject to whole-phase acceptance; this summary does not mark Phase 5 or the internal release complete.

## Delivered behavior

- Server-derived account identity and effective role prevent client impersonation. Viewer sessions appear in the roster without cursor or selection decoration. Bounded payloads reject spoofed identity/activity fields, non-finite coordinates and oversized selections.
- A person appears once across tabs. Server activity order chooses the active editor cursor; another connected tab preserves account presence when one disconnects. Heartbeat liveness does not reset idle state.
- The roster distinguishes loading, only-self, populated, partial-name and error states. It wraps long names, scrolls internally for many participants, supports Escape/outside dismissal and returns focus. Unknown names use Participant without exposing account identifiers.
- Canvas decoration is pointer-transparent and excluded from assistive announcements. Cursor coordinates use the actual viewport shell origin, including native focus scrolling, 50 percent canvas zoom and Hand panning. Selection dimensions preserve the incoming view-scale correction.
- Successful roster reads do not clear a failed outgoing presence publication. Retry remains available until an acknowledged publication recovers it.

## Implementation and evidence

Initial tracer and roster expansion were committed in `e9a7b82` and `ca34104`. Authorized resumption preserved incoming modifications and delivered projection/formatting stabilization in `1f15749` and publication-error recovery in `4433d01`, fresh pointer admission in `ef8a5f1` and explicit disconnect in `0fdda02`. Total elapsed implementation time spans multiple sessions and is not asserted.

At final implementation `0fdda02`:

- Combined production Chromium gate: **85/85 passed**, zero skips/retries, 8.4 minutes. It includes all eight presence cases, deterministic sequential typography and pointer barriers, native reservations, two live transport tracers, cold Viewer-first restore, arrangement, images and UI refinements.
- Full client suite: **252/252**, 22 files, including publication recovery and explicit disconnect.
- Full serialized server suite: **354/354**, 17 files; server source is unchanged by the final client repairs.
- Both TypeScript checks and whitespace validation passed.
- Focused Firefox/WebKit qualification: **26/26 passed**, 13 per engine, zero skips/retries, 7.9 minutes. Failure history is recorded separately in [the resumption report](05-RESUMPTION-2026-10-06.md).

The coordinate and publication defects were reproduced before repair. Historical failures and the distinction between product fixes and atomic DOM test measurements remain in [05-03-EXECUTION.md](05-03-EXECUTION.md) and [the resumption report](05-RESUMPTION-2026-10-06.md). No failing assertion was removed to obtain the passing gate.

## Limits and next dependency

Reviewed synthetic screenshots cover narrow/compact roster layout and desktop cursor projection. Native browser-chrome zoom, spoken assistive technology and final presence UX are not inferred from those screenshots. The 21-account roster scenario is not a 20-editor native workload.

General collaboration remains opt-in. The next approved engineering slice is **05-04 personal undo and redo**, including full text-session grouping, server-acknowledged property provenance, independent-property preservation, commit-time inverse protection and tab lifetime. Plans 05-05 through 05-09 and the operator gates in [the release runbook](../../../docs/internal-release.md) remain outstanding.

## Self-check

Named artifacts and implementation commits exist. Required automated plan checks pass; historical failed evidence and human-only obligations remain explicit.
