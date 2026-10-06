---
phase: 05-real-time-collaborative-editing
plan: "03"
status: incomplete
requirements-completed: []
user-disposition: skip-unresolved-coordinate-check
---

# Plan 05-03 — Presence and participant controls

Presence implementation and roster UI are committed in `e9a7b82` and `ca34104`. The user skipped further repair of the unresolved native pan-coordinate check on 2026-10-06. This plan remains incomplete.

## Delivered

- Server-derived participant names and effective roles, with Viewer roster-only presence.
- Account aggregation across tabs, most-recent active cursor, idle fading and detected-disconnection removal.
- Loading, retry, only-self, missing-name and overflow roster states.
- Remote cursor and selection overlays with pointer transparency.

## Verification provenance

At `ca34104`, production Chromium passed 79/79 combined cases; client tests passed 250/250; server tests passed 354/354. Both TypeScript checks passed. These results predate the pending coordinate changes.

An added cursor-projection test passed its baseline and canvas-zoom assertions after two repairs, but failed after native panning: expected `(620, 408)`, observed `(620, 476)`. Cause remains unresolved. Current overlay/test changes remain uncommitted and are not covered by the earlier passing full gate.

## Issues Encountered

- **User-skipped, incomplete:** Cursor projection after native panning. Preserve the failing browser assertion; do not turn it into a silently skipped test or a pass.
- Native browser-chrome 200% zoom and final presence UX review remain human acceptance obligations.
- Typography backlog 999.8 remains open despite a passing observation in the combined run.

## Dependency disposition

Plan 05-04 requires 05-03 completion; all later plans depend transitively on it. No later plan is ready under the approved graph. A scoped dependency exception must be reviewed before proceeding with personal history while retaining this incomplete presence check. This SUMMARY records disposition, not completion; its existence must not be used to mark dependency readiness.

See [05-03-EXECUTION.md](05-03-EXECUTION.md) (detailed execution and failure history).
