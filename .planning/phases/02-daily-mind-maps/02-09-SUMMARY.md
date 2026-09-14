---
phase: 02-daily-mind-maps
plan: "09"
status: complete
completed: 2026-09-14
requirements-addressed: [MIND-01, MIND-02, MIND-04]
requirements-completed: []
---

# Plan 02-09 — Native mind-map behavior

New topics created with Enter or Tab inherit the selected topic's font size, weight, color, family, alignment and supported inline text marks. Existing text editing preserves its presentation. The approved creation shortcuts remain unchanged.

Duplicate copies a topic and all descendants as a sibling branch. Copy/paste attaches the complete branch beneath the selected topic. Duplicating a root or pasting without a selected topic creates an independent mind map. New identities preserve styles, collapse state and source isolation; existing whole-map copying and ordinary objects retain their established routes.

Locked topics remain accessible through right-click after deselection. Both the context menu and native Unlock control resolve the effective node or ancestor lock. Retained actions require a current connected host, matching selection and visible editable target.

Implementation commit: `5bb1e4c3c3781d6cb36ba4d6766357dc1aff94ad`.

## Validation

The 572-case matrix passed 571 cases and exposed one reload-hydration race in the workflow fixture. After waiting for a single hydrated editor, the workflow passed 4/4 projects (development Chromium and production Chromium, Firefox and WebKit). All 572 distinct matrix scenarios therefore have passing evidence; the original run is not represented as a clean sweep. Typecheck, production build and 67/67 unit tests passed.

Typography reproduced as three failing inheritance cases before the correction, then all five focused cases passed. Branch-copy RED assertions demonstrated detached shape creation and locked-destination mutation; the corrected focused suite passed. Unlock was reproduced after deselection, then context/native unlock passed. Final matrix includes expanded root-copy, malformed clipboard, pending-conversion failure, lock-route and stale-action cases.

The first integrated run was interrupted after the multiline-layout fixture selected an offscreen topic and could not reach its toolbar. The fixture now reveals its programmatically selected topic before requesting Properties; all four projects passed that retest. This changes test setup only. A later workflow assertion raced native editor hydration after reload; it now waits for exactly one editor before reading state. These fixture fixes preserve the behavioral assertions. Final matrix and focused rerun results are recorded separately from the interrupted run.

## Review and safeguards

Source review found and corrected two intermediate issues: a retained lock action could target an old selection; branch rollback could remove unrelated objects or overwrite intervening edits. The final converter tracks only operation-owned creations, rechecks source/destination revisions across its promise, and restores destination fields only after its own synchronous attachment begins. The regression injects an unrelated creation and destination edit during a rejected conversion and requires both to survive. Clipboard-only branch metadata is stripped before persistence.

Scoped orchestrator and reused-executor source reviews found no remaining concrete blocker. A fresh independent audit is not claimed. Tests and documentation use synthetic data; private reference images remain outside repository content.

## Acceptance

Phase 2 remains in user acceptance. Retest Enter typography, whole-branch Duplicate/Paste and lock/deselect/unlock. Native OS IME, actual browser magnification and Firefox/WebKit OS clipboard evidence remain pending in 02-UAT.md. No Phase 3 advancement is implied.
