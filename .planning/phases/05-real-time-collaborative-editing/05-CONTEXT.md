# Phase 5: Real-Time Collaborative Editing - Context

**Gathered:** 2026-10-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver authorized real-time coediting of durable boards, visible presence, personal undo/redo, reconnection and active access enforcement, including concurrent mind-map editing. Requirements: CAN-03, COL-01, COL-02, COL-03, COL-04, MIND-05. Validate 20 authenticated simultaneous participants without a product admission cap; this target does not establish unlimited infrastructure capacity. Preserve acknowledged content and image durability. Follow Me and other later-phase facilitation capabilities remain in their approved phases.

Phase 4 remains user-accepted with the recorded WebKit exception deferred to backlog 999.7. This discussion authorizes planning; implementation has not started.
</domain>

<decisions>
## Implementation Decisions

### Presence
- **D-01:** Show participant avatars, named editor cursors, and colored selection outlines. Cursor names appear on movement or hover to reduce clutter.
- **D-02:** Viewers appear in the participant list; their cursors and selections remain hidden.
- **D-03:** Show one avatar per person across tabs/devices, displaying only their most recently active cursor.
- **D-04:** Fade idle cursors and avatars. Remove disconnected participants immediately upon detection, without a reconnecting display grace period. Detection timing is an implementation concern.

### Concurrent changes
- **D-05:** The first participant to begin a conflicting action reserves the affected object for that action. Apply consistently to text, move, resize, rotation, formatting, deletion, and structural edits. Other participants can select the object and see who is editing; conflicting changes wait for release. Independent objects remain editable.
- **D-06:** Text editing reserves the entire object, including geometry, formatting, and deletion. Release when editing finishes, focus leaves the text field, or the editor disconnects. A connected idle editor retains the reservation.
- **D-07:** Gesture reservations end with the gesture or disconnection. Apply the same conflict policy to multi-object and mind-map structural operations. Research must define the affected-object set and atomic behavior while preserving hierarchy; this discussion did not choose a board-wide lock.

### Personal undo and redo
- **D-08:** Preserve another participant's later conflicting changes. Skip conflicting undo steps with a brief explanation; independent changes remain undoable. Apply the same protection and reservation policy to redo.
- **D-09:** History belongs to each tab/device and covers changes made in that window. Preserve eligible history through temporary disconnections; reset it on reload or close.
- **D-10:** One completed gesture or multi-object operation is one undo step. All text changes within one editing session, before leaving the text field, undo together.

### Reconnection and recovery
- **D-11:** If pending local work exists and the shared canvas changed during disconnection, check current write permission and notify the user. Offer **Load latest changes** or **Create a private copy**. Keep divergent versions separate; do not automatically merge independent or conflicting pending edits into the shared canvas.
- **D-12:** Create a private copy of the entire local canvas including local changes, owned by the recovering user, with no inherited sharing grants. Preserve the current shared canvas. Existing authorized copy and image-portability guarantees apply.
- **D-13:** Before loading the latest shared canvas, offer to download the local version as a recovery copy. Allow download, continue without downloading, or cancel. Recovery-copy contents and unresolved image handling retain Phase 4 guarantees.
- **D-14:** Use the same choices both after ordinary disconnection and after write permission restoration. The recovery/fork choice requires current write permission. Revalidate identity and authorization when the action executes.
- **D-15:** After write permission is restored, ask before recovering preserved work. If the shared canvas is unchanged, offer to restore pending edits; if changed, use D-11 through D-14.
- **D-16:** The earlier proposal to replace the shared canvas with the entire local version was explicitly revoked. The related overwrite-warning, overwrite-race, and remote-reload proposals are superseded. Do not implement shared-canvas replacement as recovery.

### Permission changes
- **D-17:** On Editor-to-Viewer downgrade, explain the change, switch to read-only, preserve pending work locally for possible recovery after write permission restoration, and load the latest authorized canvas.
- **D-18:** On full access revocation, hide the canvas and stop synchronization on detection. Preserve pending work locally; show an access-removal message with return-to-library and check-access actions. Recovery requires restored write permission. Enforce revocation on active sessions, reconnections, direct document/image requests, and queued writes.
- **D-19:** Retain existing account isolation, effective board roles, session-expiry behavior, current-content/image acknowledgement requirements for Saved, recovery epochs, and local preservation during already-open-board outages. Known expired sessions pause editing. A disconnected local edit conveys no reservation over the online shared canvas.

### Agent discretion and research obligations

Routine labels, spacing, idle thresholds, connection detection, transport, and reservation implementation are research/planning choices within the decisions above. No user-selected library or transport is implied. Explicitly assess server enforcement, stale-reservation fencing, transactional multi-object operations, read-only remote hydration, offline version isolation, fork/image durability, and undo eligibility. Any consequential conflict with approved scope or permissions must be surfaced before implementation. Existing system-wide creation restrictions and creator-ownership exceptions remain authoritative; research must reconcile any restricted-account fork edge case rather than silently broadening permissions.
</decisions>

<canonical_refs>
## Canonical References

Downstream agents must read these before planning or implementing.

### Scope and workflow
- `AGENTS.md` — contributor, privacy, product, and workflow boundaries.
- `.planning/PROJECT.md` — approved product scope and constraints.
- `.planning/REQUIREMENTS.md` — acceptance requirements including the six Phase 5 requirements.
- `.planning/ROADMAP.md` — approved phase sequence and Phase 5 success criteria.
- `.planning/config.json` — workflow and model settings.

### Carried-forward decisions
- `.planning/phases/04-durable-boards-and-recovery/04-CONTEXT.md` — acknowledgement, recovery, outage, and operator boundaries.
- `.planning/phases/04-durable-boards-and-recovery/04-VERIFICATION.md` — accepted Phase 4 evidence and explicit deferred exception.
- `.planning/phases/03-okta-and-board-access/03-CONTEXT.md` — role, sharing, identity, session, and copy semantics; superseded local-copy entry remains historical.
- `.planning/phases/01-editable-canvas-and-image-portability/01-CONTEXT.md` — editing and image-portability contract.

### Existing implementation
- `src/canvas/account/board-workspace.ts` — isolated authorized root/content pair, local awareness, hydration and disposal.
- `src/canvas/account/doc-source.ts` — scoped document requests, acknowledgement and recovery fencing; subscription currently only handles disposal.
- `server/boards/documents.ts` — authorized document pull/push, transactional merge, shape validation, and image binding checks.

No external specification was supplied for this discussion.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- BoardWorkspace provides isolated document and image engines, local awareness, account/generation boundaries, and disposal on authorization loss.
- BoardDocSource exposes pull/push and outcome hooks, recovery epochs, current-account checks, and acknowledgement callbacks.
- Document routes validate binding and image references, recheck authorization inside the write transaction, and return revision receipts.

### Established Patterns
- Current account workspace awareness is local. Document subscription lacks a remote-update feed; real-time delivery needs implementation.
- Viewer hydration currently guards against every document mutation and bypasses normal writable synchronization. Authorized remote updates need a read-only-compatible path.
- Existing server merging is durable document transport behavior. It must not silently merge divergent recovered local versions contrary to D-11.

### Integration Points
- Connect real-time delivery and presence to the scoped workspace lifecycle, with current permission checks and cleanup.
- Connect reservations to all mutation entry points and server admission, including undo, recovery, groups, and mind-map structural edits.
- Integrate connection/pending-work messaging with existing save and recovery UI while maintaining acknowledgement truthfulness.
</code_context>

<specifics>
## Specific Ideas

The user requested one consistent first-action reservation approach for all conflicting user actions. They explicitly replaced the initial full-canvas overwrite recovery idea with a private fork of local work. Preserve this final choice throughout research, UI design, planning, and testing.
</specifics>

<deferred>
## Deferred Ideas

No new out-of-phase ideas were added. Preserve existing approved backlog deferrals, including 999.7 WebKit Save Details and independent storage/capacity validation. Phase 6 owns Follow Me.
</deferred>

---

*Phase: 05-real-time-collaborative-editing*
*Context gathered: 2026-10-02*
