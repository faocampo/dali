# Plan 05-04 execution — personal undo and redo

Status: **in progress; plan not complete**. The prior stabilization is recorded at `0fdda02` with its documentation checkpoint `e0ddcb2`. No whole-phase or internal-release acceptance is inferred from this first slice.

## Session capture foundation — `661791a`

The native browser tracer first failed: after entering `First`, pausing beyond the pinned 500ms capture timeout, and entering `Second`, one Undo left `First`. This reproduced a visible violation of D-10.

`personal-history.ts` now gives native history an explicit capture lifetime. Text editing remains one capture across pauses and intermediate native widget capture stops. A completed reserved gesture or command ends its operation capture. Entering text during such an operation keeps the capture open until the field is left. The adapter preserves UndoManager's undo/redo lifecycle and restores its original method and timeout on disposal. Remote transactions retain the existing excluded origins.

The real two-editor tracer now verifies that one Undo removes the full session, Redo restores it, an independent remote object's movement survives both actions, acknowledged content reopens correctly, and reload clears local history. This tests different-object independence; it does not yet establish the same-object property conflict policy.

Executed evidence:

- Before implementation: one browser failure, expected empty text but received `First`.
- After implementation: the native tracer passes 1/1.
- New unit tests: 3/3 pass, covering pauses, native capture stops, operation boundaries, remote-origin exclusion, undo/redo and native lifecycle restoration.
- Full client: 255/255 across 23 files.
- Both TypeScript checks pass.
- Combined history/reservation/formatting/pointer Chromium qualification: 46/46 pass, zero skips/retries, 4.8 minutes.
- Focused Firefox/WebKit native history qualification: 2/2 pass (one per engine), zero skips/retries, 1.2 minutes.

## Remaining approved work

05-04-01 still requires authoritative operation/property provenance and commit-time inverse checks. 05-04-02 still requires conflicting-step skip feedback, ABA protection, deletion/creation and structural cases, same-account multiple tabs, reconnect retention, busy/empty controls and the complete native acceptance matrix. No provenance migration, history authorization endpoint or property conflict guard has been implemented in this first slice.

Implementation direction for the next slice:

1. Bind the native history entry to its server-issued reservation/action identity. Explicit capture boundaries must prevent unrelated leases from merging into one entry; a text session can contain several acknowledged document pushes under one action.
2. Record server-derived affected properties and authenticated account/tab provenance at the existing durable document commit boundary. Receipts alone contain revisions/digests and cannot prove which property was changed. Value equality alone cannot detect ABA.
3. Resolve eligibility from the original acknowledged action and current property provenance after fresh reservation acquisition. Independent properties remain eligible; creation/deletion and structural dependencies require appropriate atomic protection.
4. Revalidate the actual inverse footprint and versions in the authoritative commit transaction. A preflight-only check cannot replace that check. Scope records and guards to account, board, tab, connection, lease and epoch as appropriate.
5. Preserve native undo/redo lifecycle and tab-local in-memory stacks. Server provenance metadata is not a persisted shared undo stack. Do not claim reconnect retention until its actual lifecycle path is exercised.

All work remains inside the isolated checkout with synthetic fixtures and the existing collaboration opt-in boundary. Operator/provider access is not needed for these remaining engineering checks.
