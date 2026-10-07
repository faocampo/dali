# Phase 5: Real-Time Collaborative Editing — Research

**Researched:** 2026-10-02
**Status:** Research complete for planning; UI contract gate pending
**Confidence:** Medium — source inspection and official documentation; no runtime prototype or load benchmark performed
**Method:** Inline research under the Codex skill adapter. Independent planner/checker review has not run.

## Summary

Retain the pinned Yjs 13.6.31 and BlockSuite 0.22.4 document model and existing durable server commit boundary. Implement an authorized live delivery channel, authoritative object reservations, operation-aware history, and a divergence gate before pending changes can enter shared state. An off-the-shelf provider alone cannot implement the approved first-action reservations or private-fork recovery policy.

The first executable plan should be a production end-to-end tracer: two authenticated editors modifying independent native shapes, server-authorized reservations and durable commit, remote delivery without refresh, plus a Viewer observing without writes. Add the remaining object families and failure paths only after that tracer passes. Twenty participants is an acceptance target, not a product admission limit.

## User constraints

All D-01 through D-19 in `05-CONTEXT.md` remain binding. In particular: whole-object text reservations; connected idle editors retain reservations; separate tab history; one text session per undo step; divergent offline versions never merge into or replace the shared board; private fork or latest-version choice requires current write authority. Phase 4 remains accepted with backlog 999.7 explicitly deferred.

## Existing implementation evidence

| Source | Observation | Planning implication |
|---|---|---|
| `src/canvas/account/board-workspace.ts` | Per-board root/content documents, local Awareness, scoped disposal; Viewer updates trigger a mutation guard and writable synchronization is skipped | Add remote delivery with explicit trusted origin and no hydration/observer writes; preserve account/generation isolation |
| `src/canvas/account/doc-source.ts` | Pull/push receipts and epoch checks; subscribe currently only reports disposal | Implement subscription/catch-up rather than assuming live delivery exists |
| `server/boards/documents.ts` | Authorizes inside transaction, applies incoming bytes to latest stored document, checks structure and image references, returns revision receipt | Insert reservation/operation validation before durable commit; broadcast only committed results |
| `src/canvas/runtime.ts` | Reconstructs local baselines and invokes replayJournal during recovery | Gate all replay paths before any divergent bytes reach server or current shared document |
| `src/canvas/account/recovery.ts` | Coordinator authorizes, inspects and drains; retries outages | Add awaiting-choice, permission-restored confirmation, and fork lifecycle states |
| `src/canvas/account/outbox.ts` | Schema-v2 checkpoints include complete documents, assets and tab ID, but no shared revision baseline field | Evolve compatible recovery metadata; preserve legacy rows conservatively rather than claiming they are current |
| `src/canvas/account/mutation-guard.ts` | Wraps native Y types and Store/undo methods for current writable scope | Local enforcement seam; supplement with reservation ownership and authoritative server checks |
| `server/boards/actions.ts`, `server/boards/imports.ts` | Duplicate reserves a private destination; staging binds source revision and image manifest | Reuse staging/receipts, but a fork of local work needs its own manifest and lifecycle, rather than duplicating latest server bytes |
| `server/boards/routes.ts` | Effective Owner overrides system Viewer for an existing owned board; duplicate is a board capability | Gate recovery fork on current source authority and preserve existing creation distinctions |
| `src/canvas/account/board-doc.ts` | Uses StoreContainer and native store history | Verify pinned native history boundaries before adapting undo |
| `src/canvas/mindmap-compatibility.ts` | Native layout can generate observer writes; history replay already has special handling | Include layout-generated changes and ancestor/child effects in operation footprints |
| `deploy/kubernetes/base/deployment.yaml` | Current deployment uses one replica | An in-process event broker can fit current deployment, but must not silently claim multi-replica coordination |

## Recommended architecture to validate during planning

### Authorized transport and catch-up

Prefer a scoped server broker with authenticated bounded long-poll delivery plus existing HTTP mutation requests for the initial tracer. This is an architectural recommendation, not a measured performance conclusion. It minimizes new dependencies and reuses existing request identity/CSRF/epoch checks. Evaluate event batching and cursor latency in the tracer; switch transport if measured requirements demand it without changing authorization semantics.

Bind connection identity to authenticated account, board, tab, generation and server recovery epoch. Authorize before returning each held response, including a permission change that occurs while waiting. Wake readers after commit, with an ordered sequence and bounded event retention. Detect gaps and use authorized catch-up; do not rely on a transient event queue as durable storage. Close the initial snapshot/subscription race with a consistent revision boundary. Separate content revision from presence and permission events. Bound payloads and queued work, coalesce cursor updates, and define backpressure without a fixed participant admission cap.

Use server-derived names/roles and connection ownership. Treat client awareness data as untrusted cursor/selection input; reject identity spoofing and strip Viewer cursor/selection data server-side. Aggregate avatars by account; choose the most recently active connected cursor. Idle fading is separate from connection liveness. Heartbeat expiry detects silent disconnects; remove presence and release reservations immediately upon detection, not at an impossible instant of network failure. A live idle editor renews a reservation through heartbeat, not pointer activity.

### Reservations and write admission

Acquire affected IDs atomically using a server-issued operation/fencing token. Define operation start, update, commit, cancellation and release. Reserve all affected IDs or none, preventing partial multi-object actions. Stale tokens after disconnect, permission change, epoch change or server restart cannot write. Authenticate every operation and recheck capability at commit. A native gesture must not mutate shared state before acquisition; a pending preview may remain private.

Do not trust a submitted list of affected IDs. Apply candidate updates to an isolated validated document, derive changed surface/block objects and structural relationships, and verify the full effect is covered by the token. Include nested native surface elements, deleted objects, parent/child membership, connector endpoints and mind-map layout effects. Reject malformed or incomplete updates. Determine this mapping against the pinned schema during the tracer; generic top-level block validation is insufficient. Freeze admission on paths that cannot yet be validated rather than leaving a legacy raw-push bypass.

All mutation surfaces need the same enforcement: toolbars, keyboard shortcuts, native menu actions, text/IME, drag/resize/rotation, delete, group/frame operations, mind-map restructuring, undo/redo, and queued replay. Shared-board metadata changes need explicit scope treatment. Blob operations retain authorization and binding checks. Keep text reservations until blur/finish/disconnect, even when idle. Ensure unmount/blur caused by another control does not accidentally commit an unauthorized mutation.

### Remote updates and history

Apply authorized remote bytes under a distinct transaction origin. Exclude that origin, hydration and native layout side effects from local history and outgoing writes. Viewer hydration must allow trusted remote integration while preventing local observer mutations. Test this with actual native objects, not only synthetic Y.Map documents.

Y.UndoManager trackedOrigins can isolate local history; stopCapturing defines boundaries, but the default timeout groups typing into bursts and does not implement the selected entire-text-session policy. Inspect the pinned Store history integration and use explicit session boundaries. Per-operation metadata must identify affected properties/objects and later authorship so conflicting undo/redo can be skipped with explanation. A later edit on the same object is not automatically a conflict when the affected property is independent. Undo also requires reservations and commit-time validation; a local eligibility check alone races remote changes. Reload clears history; temporary reconnect retains only eligible steps.

### Divergence and recovery

Before automatic replay, obtain fresh authority and compare a durable local shared baseline with current server content. Record operation receipts so a committed write whose response was lost is recognized as acknowledged, rather than mistaken for remote divergence. Board revision currently also changes on rename; planning must define which content/metadata changes trigger the canvas-changed choice and retain epoch fences independently.

Hold the complete local snapshot and assets separately while loading/inspecting latest server state. Any remote change during the disconnected interval triggers the agreed choice, even if pending edits would technically merge. Do not call Y.applyUpdate with remote bytes on the local recovery candidate before the choice. Check again transactionally before replaying an unchanged-baseline candidate; a race routes to the same fork/latest choice. Unknown legacy baselines require conservative recovery, not silent replay.

Loading latest first offers a recovery download, continue without downloading, or cancel. Clear or mark resolved only the chosen tab's retained work after successful transition; never erase another tab's pending edits. Fork from immutable local content with new root/content IDs and remapped internal references, its own image manifest, private ownership, idempotent staging and final acknowledgement. Do not reuse duplicate's server-image manifest when local additions differ. Reauthorize source writes throughout staging/commit. Remote source edits do not authorize replacement; a private fork preserves source state. Retain pending work if fork/export/load fails.

Downgrade: capture pending work, switch to read-only and render latest permitted content. Revocation: hide content, terminate reads/writes, preserve local work inaccessible through current recovery/export UI. Restoration: fresh authority followed by explicit recovery confirmation. Cancellation, switching accounts, session expiry, opening another board and server restore epochs must invalidate stale callbacks. The existing owner/system-Viewer exception must remain consistent with source-board duplicate authority; generic import must not become a bypass for system-wide creation restrictions.

## Do not build or assume

- No shared-canvas overwrite recovery endpoint.
- No automatic merge of divergent offline work, including disjoint edits.
- No identity or lock authority from awareness packets.
- No automatic server-room writes before the existing durable commit.
- No full-board lock for independent online edits.
- No assumption that Yjs convergence establishes the product's reservation or undo policy.
- No infrastructure scale claim from a local 20-user test.

## Validation Architecture

Use existing Vitest client/server suites and Playwright projects `prod`, `prod-firefox`, `prod-webkit` with synthetic authenticated accounts. Preserve existing raw error collection and Phase 4 exception provenance. Proposed new tests belong to execution plans; none were created or run during research.

1. Transport tracer: two editors and one Viewer, actual native shapes/images, committed remote updates without reload, cold reopen, bootstrap gap, dropped/duplicate/reordered delivery, and lost acknowledgements.
2. Reservation race barriers: simultaneous acquire, atomic group sets, stale fencing, connected-idle renewal, disconnect release, unauthorized raw pushes, nested-object changes outside token and server restart.
3. Presence: role-filtered identity, multiple tabs, active-cursor selection, idle fading, close/heartbeat detection, spoofed account/client IDs and board isolation.
4. History: full text session including pauses/IME, per-tab scope, independent remote edits, same-property later edits, structural changes, undo/redo reservations, reconnect retention and reload reset.
5. Recovery: disjoint and overlapping divergence both offer fork/latest; lost response reconciliation; no server writes before choice; immutable local fork/images/ownership; download cancellation/failure; source changes during decision; permission downgrade/revoke/restore during every stage.
6. Mind maps: concurrent disjoint branches, conflicting reparent/delete, ancestor footprints, native layout side effects, save/reopen hierarchy, cycles and orphan rejection.
7. Acceptance: 20 genuinely distinct authenticated browser contexts concurrently edit one board; inspect visible convergence and acknowledged persistence, no browser errors, correct presence and no client/server admission cap. Record actual latency distributions and deployment characteristics without inventing a target already approved by the user.

Run focused verification after each task and broaden at integration boundaries. Full regression results must be reported with exact source revision, including any unchanged known backlog failure; do not relabel exceptions as passes or disable strict error assertions.

## Suggested planning decomposition

Tracer; complete reservation coverage; presence; personal history; divergence/fork recovery; live permission transitions; mind-map integration; multi-browser/20-participant acceptance. These are candidate capability slices, not executable plans or approved wave counts. Every eventual plan needs bounded file ownership, runnable tests, D-ID and requirement traceability, and relevant threat mitigations.

## Open implementation questions

- Exact changed-object extraction and dependent-layout footprints in pinned BlockSuite require executable proof before generalizing reservations.
- Native text-session history integration must be inspected/tested; default Yjs timeout is inadequate.
- Recovery metadata migration and lost-ack detection need an explicit durable baseline/receipt design.
- Transport responsiveness under 20 real sessions is unmeasured; long-poll is a tracer hypothesis.
- UI-SPEC is missing. The deterministic planning gate returns frontend=true, hasUiSpec=false, block=true. Generate the UI contract before executable planning.

## Sources

- Yjs documentation, UndoManager: https://github.com/yjs/docs/blob/main/api/undo-manager.md — trackedOrigins, captureTimeout and stopCapturing; queried through Context7 on 2026-10-02.
- Yjs documentation, Awareness: https://github.com/yjs/docs/blob/main/api/about-awareness.md — ephemeral state, clocks, heartbeats and offline detection; queried through Context7 on 2026-10-02.
- Yjs documentation, document updates: https://github.com/yjs/docs/blob/main/api/document-updates.md — origins, state vectors and diff application; queried through Context7 on 2026-10-02.
- Local files in the implementation table — inspected current integration behavior. Upstream documentation is current guidance, not a version-specific guarantee for the installed libraries; verify against pinned packages during the tracer.
