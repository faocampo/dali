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

## Acknowledged property provenance — `eb1d221`

The next slice records server-derived native property changes under the server-issued action/reservation token, authenticated account and tab. A new migration (11) adds metadata only: no undo content or shared stack is persisted. Native Yjs change events detect coalesced same-value ABA; creation, deletion and structural dependencies receive atomic whole-object protection. History admission requires a fresh held lease and an acknowledged action owned by the same tab. The durable document transaction rechecks later foreign property changes and the actual inverse footprint, then commits document bytes, revision, receipt and new provenance together.

The client tags native entries with their action identity, rejects ambiguous merged leases, and isolates each validated entry so native no-effect skipping cannot execute an older unvalidated entry. Conflicting steps use native clear/retention behavior, preserve current canvas content, continue to an eligible step and emit the approved polite message. Busy history controls are disabled. Reload resets history; temporary reconnect acceptance remains pending.

Backup validation accepts complete versions 8–11, verifies provenance bindings/versions and includes the new table in its inventory. Existing backups migrate without changing canvas bytes or grants. The new backup canary proves acknowledged provenance survives a real SQLite copy and an invalid future revision is rejected.

Evidence so far:

- New server classifiers: 12/12, including scalar ABA, text replacement/formatting, creation/deletion/replacement, image root membership, structural dependencies and idempotent reapplication.
- Authenticated collaboration/reservation/classifier gate: 56/56, including cross-tab isolation, extra inverse paths, commit-time version recheck, expired session, Editor downgrade and atomic rollback on provenance persistence failure.
- Backup/migration gate: 26/26.
- Personal-history/footprint adapter units: 8/8.
- On resumed current source: both typechecks and full client 258/258 pass.
- Expanded native Chromium history: 7/7 pass, zero skips/retries, 1.3 minutes. Covers same-object independent properties, skipped conflicting steps, redo conflicts, another tab of the same account, remotely edited creations, delete/undo/redo, complete text sessions, convergence and reopen/reset.
- Full serialized server: 375/375 across 18 files, 154.64 seconds. Includes the synthetic local storage drill; it is not independent-storage/operator acceptance.
- Expanded Firefox/WebKit gate is still running; no success is inferred.

Preserved failed evidence: the first expanded browser run passed 6/7 and failed because its deletion oracle read a not-yet-restored object; it now waits for native existence before reading bounds. An initial security assertion incorrectly expected a restricted creator to lose creator write rights; separate expired-session and Editor-downgrade cases now verify the actual product policy. A subsequent browser rerun timed out during an executor disconnection and had no final suite summary; the concurrent full server run also had no summary and the full client command did not reach its log creation. These interrupted runs are not acceptance evidence. On reconnection the original diff was verified unchanged, the WIP was backed up, only identified orphan fixture processes were stopped, and fresh runs began.

## Remaining approved work

Authoritative provenance, inverse checks, skip feedback, busy/empty controls and basic native conflict/structural cases are implemented in the qualification slice above. 05-04 remains incomplete until the remaining native structural/text/ABA cases, reservation/long-idle interactions, temporary reconnect lifetime, responsive status acceptance and relevant regression gates pass. Reconnect must retain native tab memory while keeping unacknowledged local candidates separate from remote changes; 05-05's divergent recovery obligations remain in force.

Design requirements retained for subsequent verification:

1. Bind the native history entry to its server-issued reservation/action identity. Explicit capture boundaries must prevent unrelated leases from merging into one entry; a text session can contain several acknowledged document pushes under one action.
2. Record server-derived affected properties and authenticated account/tab provenance at the existing durable document commit boundary. Receipts alone contain revisions/digests and cannot prove which property was changed. Value equality alone cannot detect ABA.
3. Resolve eligibility from the original acknowledged action and current property provenance after fresh reservation acquisition. Independent properties remain eligible; creation/deletion and structural dependencies require appropriate atomic protection.
4. Revalidate the actual inverse footprint and versions in the authoritative commit transaction. A preflight-only check cannot replace that check. Scope records and guards to account, board, tab, connection, lease and epoch as appropriate.
5. Preserve native undo/redo lifecycle and tab-local in-memory stacks. Server provenance metadata is not a persisted shared undo stack. Do not claim reconnect retention until its actual lifecycle path is exercised.

All work remains inside the isolated checkout with synthetic fixtures and the existing collaboration opt-in boundary. Operator/provider access is not needed for these remaining engineering checks.
