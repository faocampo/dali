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
- Expanded Firefox/WebKit native history: 14/14 (seven per engine), zero skips/retries, 2.9 minutes on the same runtime source.

Preserved failed evidence: the first expanded browser run passed 6/7 and failed because its deletion oracle read a not-yet-restored object; it now waits for native existence before reading bounds. An initial security assertion incorrectly expected a restricted creator to lose creator write rights; separate expired-session and Editor-downgrade cases now verify the actual product policy. A subsequent browser rerun timed out during an executor disconnection and had no final suite summary; the concurrent full server run also had no summary and the full client command did not reach its log creation. These interrupted runs are not acceptance evidence. On reconnection the original diff was verified unchanged, the WIP was backed up, only identified orphan fixture processes were stopped, and fresh runs began.

## Clean reconnection checkpoint — 2026-10-06

Explicit Reconnect obtains a fresh authorized connection while keeping the same tab and native Store/UndoManager. Both before and after the request, the runtime requires acknowledged local documents, no current-tab journal/title work and a current generation. Isolated authoritative documents must contain the acknowledged local operations before any remote bytes enter the local pair. Pending candidates remain separate for 05-05. Delayed reservation/history/presence responses cannot install an old connection fence. The existing native sync engine resumes on the retained documents; no rejected input is replayed.

Connection status is separate from Saved. The actual viewport Undo/Redo buttons now observe busy/disconnected state. Reservation notices re-clamp on canvas/window resize without changing focus or repeating their live-region text. The first narrow screenshot exposed overlap with the drawing rail after the viewport-bound correction; rail separation remains a follow-up before final UI qualification.

Executed checkpoint evidence:

- Both TypeScript checks pass. Full client passes **263/263 across 24 files**, including five fresh-connection/pending-candidate/stale-response cases.
- Expanded native history plus reconnection passes **12/12 Chromium**, zero skips/retries, 1.7 minutes: ten history cases plus two reconnection cases. Additional native cases cover ABA, grouped structural protection and remote text replacement.
- Native reserved-history/no-replay case passes **1/1 Chromium** after correcting a reproduced 67px overflow on viewport shrink. It proves a 409 leaves history intact, release does not replay it, deliberate later actions acquire current access, and acknowledged results converge/reopen. Numeric bounds pass; screenshot review still requires the rail-separation follow-up above.
- Firefox/WebKit expansion and the integrated current-source regression are still running/pending at this checkpoint; do not count them as passing yet. The server implementation is unchanged from the independently completed **375/375** gate at `eb1d221`.

The first expanded run after executor reconnection exited before test selection because a newly added optional native text read failed TypeScript compilation. The read now handles absent text, both static checks pass, and the fresh 12-case run above passes. This was a real compile failure, not attributed to executor transport. Interrupted runs remain unaccepted. The original checkout now contains independent external work and active services; it was left untouched. `dc575a5` adds optional fixture port isolation so the gates can coexist with that work.

## Final feedback and regression qualification

The full history/reconnection matrix on `fded236` passes **26/26 Firefox/WebKit**, thirteen per engine, zero skips/retries, 7.3 minutes. `33454ae` then keeps status text clear of the actual sibling drawing and history controls. Two responsive native cases pass again in Firefox/WebKit, **2/2**, 53.7 seconds; the reviewed synthetic screenshot confirms the text remains readable at 390px. The first attempt to find the controls inside the inner viewport failed both targeted assertions, so the implementation now measures the actual canvas shell. Both final-source typechecks pass.

The first expanded integrated Chromium gate on `33454ae` completed **97 passed, one failed**, 11.2 minutes. All thirteen history cases, all formatting/pointer barriers, native reservations, images and the cold Viewer-first restore passed. The sole failure was the presence fixture's keyboard retry: the successful publication removed Retry presence during `locator.press`, and Playwright retried the correctly detached button until timeout. The failure snapshot already showed the recovered three-person roster. This is separate from the earlier product defect where incoming polls incorrectly cleared an outgoing-publication error.

`c495c74` holds successful outgoing publication behind completion of the real keyboard action. It retains the healthy-poll/error persistence assertions, requires keyboard focus, then releases the actual service request and verifies recovery. No assertion, runtime-error collection or timeout was weakened. It passes **3/3 deliberately repeated Chromium executions** and **2/2 Firefox/WebKit cases**, zero automatic retries. The second integrated Chromium gate on that revision completed **97 passed, one failed**, 12.2 minutes. Retry now passed, as did every history case and cold Viewer-first hydration. The failure was a real connection-retirement defect: after navigation, the departed editor remained in the roster. It is not a layout assertion failure or a repeat of the retry fixture race.

## Connection retirement correction

The auth pagehide listener cancels scoped runtime requests before the live cleanup listener. The runtime fetch wrapper then attached that already-aborted signal to the keepalive disconnect request. A second path skipped cleanup when an interrupted poll had already marked the known connection disconnected. Two deterministic unit reproductions failed before the correction (2 failed, 9 passed).

Retirement now uses a separate cleanup transport and captures the original connection ID even after interruption. It retains the original account and epoch, does not apply any response, and remains idempotent. Normal runtime requests retain their existing cancellation. The synthetic service records successful disconnect acknowledgments, and native presence tests now require a real acknowledgment before checking roster removal instead of relying on eventual expiry.

Current focused evidence: **16/16 connection/reconnection units**, **265/265 full client tests across 24 files**, and **3/3 deliberately repeated Chromium native layout/exit cases**. The repeated native cases confirm successful server retirement and roster removal. Final cross-browser history/presence and the complete 98-case integrated Chromium rerun remain pending; 05-04 is still open.

## Remaining approved work

Authoritative provenance, inverse checks, skip feedback, busy/empty controls and basic native conflict/structural cases are implemented in the qualification slice above. 05-04 remains incomplete until the remaining native structural/text/ABA cases, reservation/long-idle interactions, temporary reconnect lifetime, responsive status acceptance and relevant regression gates pass. Reconnect must retain native tab memory while keeping unacknowledged local candidates separate from remote changes; 05-05's divergent recovery obligations remain in force.

Design requirements retained for subsequent verification:

1. Bind the native history entry to its server-issued reservation/action identity. Explicit capture boundaries must prevent unrelated leases from merging into one entry; a text session can contain several acknowledged document pushes under one action.
2. Record server-derived affected properties and authenticated account/tab provenance at the existing durable document commit boundary. Receipts alone contain revisions/digests and cannot prove which property was changed. Value equality alone cannot detect ABA.
3. Resolve eligibility from the original acknowledged action and current property provenance after fresh reservation acquisition. Independent properties remain eligible; creation/deletion and structural dependencies require appropriate atomic protection.
4. Revalidate the actual inverse footprint and versions in the authoritative commit transaction. A preflight-only check cannot replace that check. Scope records and guards to account, board, tab, connection, lease and epoch as appropriate.
5. Preserve native undo/redo lifecycle and tab-local in-memory stacks. Server provenance metadata is not a persisted shared undo stack. Do not claim reconnect retention until its actual lifecycle path is exercised.

All work remains inside the isolated checkout with synthetic fixtures and the existing collaboration opt-in boundary. Operator/provider access is not needed for these remaining engineering checks.
