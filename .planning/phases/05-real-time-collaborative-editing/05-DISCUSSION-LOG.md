# Phase 5: Real-Time Collaborative Editing - Discussion Log

> **Audit trail only.** Planning, research, and execution consume `05-CONTEXT.md`. Earlier alternatives below may be superseded.

**Completed:** 2026-10-02
**Areas discussed:** Presence; Concurrent changes; Personal undo; Reconnection and permission changes

## Presence

### 1. How should participants appear while working on the board?

Alternatives presented:

1. Participant avatars, named cursors, and colored selection outlines (recommended).
2. Participant avatars and named cursors; selections visible only to the selecting person.
3. Participant avatars only.

**Final recorded choice:** Participant avatars, named cursors, and colored selection outlines. Cursor names appear on movement or hover to reduce clutter.

### 2. How should Viewers appear to other participants?

Alternatives presented:

1. Include Viewers in the participant list; hide their cursors and selections (recommended).
2. Show Viewer cursors and selections with a Viewer label.
3. Let each Viewer choose whether to share cursor and selections; presence remains visible.

**Final recorded choice:** Include Viewers in the participant list; hide their cursors and selections.

### 3. How should presence appear when the same person opens multiple tabs or devices?

Alternatives presented:

1. One avatar per person, separate cursors for active tabs/devices with distinguishing labels (recommended).
2. One avatar per person, showing only their most recently active cursor.
3. Separate avatar and cursor for every tab/device.

**Final recorded choice:** One avatar per person, showing only their most recently active cursor.

### 4. What should happen when someone becomes inactive or loses connection?

Alternatives presented:

1. Fade idle cursors; briefly mark disconnected participants as reconnecting before removing (recommended).
2. Keep idle cursors visible; remove disconnected participants immediately.
3. Hide idle cursors; keep disconnected participants listed until they reconnect or board closes.

**Final recorded choice:** Inactive: fade idle cursors and avatar. Disconnected: remove disconnected participants immediately upon detection.

**Notes:** User supplied a custom combination; no reconnecting grace display. User then chose to proceed to concurrent changes.

## Concurrent changes

### 1. When two people edit text in the same object, how should it behave?

Alternatives presented:

1. Both type simultaneously with live merge and text cursors (recommended).
2. One person edits at a time with visible reservation.
3. Simultaneous editing with live merge and a warning.

**Final recorded choice:** One person edits at a time. Reserve text for whoever starts editing and show others who is editing.

### 2. While someone edits text, what can others do to the same object?

Alternatives presented:

1. Select only; wait to modify (recommended).
2. Move, resize, and style; reserve text and deletion.
3. Any action except editing text, including deletion.

**Final recorded choice:** Select it, but wait to modify it. Reserve text, position, size, formatting, and deletion until text editing ends.

### 3. When should the editing reservation end?

Alternatives presented:

1. Finish, leave, inactivity with warning, or disconnection (recommended).
2. Finish, leave, or disconnection; retain while connected and idle.
3. Finish or leave, with Owner override and disconnection release.

**Final recorded choice:** When the editor finishes, leaves the text field, or disconnects. Keep it while connected even when idle.

### 4. When two people drag or resize the same object, how should it behave?

Alternatives presented:

1. Reserve for first person until gesture ends; show who is manipulating (recommended).
2. Allow simultaneous gestures; last accepted position or size wins.
3. Allow both previews but give first person priority.

**Final recorded choice:** First person reserves the object until the gesture ends. Apply this same approach to all conflicting actions between users.

**Notes:** User explicitly generalized first-action reservation to all conflicting concurrent actions. Follow-up summarized text, dragging, resizing, rotating, formatting, deleting, and structural changes; user chose next area. Group and mind-map reservation granularity remains to be specified during planning or further discussion; no global board lock was requested.

## Personal undo

### 1. If someone changes an object after your edit, how should Undo behave?

Alternatives presented:

1. Preserve later changes and skip conflicting steps with explanation (recommended).
2. Stop at the conflicting step and offer manual skip.
3. Offer earlier version as a separate object.

**Final recorded choice:** Preserve their later change, skip the conflicting undo step, and briefly explain why. Independent changes remain undoable.

### 2. How should undo history work across tabs and devices?

Alternatives presented:

1. Separate history for each tab or device (recommended).
2. Shared personal history across tabs and devices.

**Final recorded choice:** Separate history for each tab or device; undo affects changes made in that window.

### 3. How long should undo history remain available?

Alternatives presented:

1. Keep through temporary disconnections; reset on reload or close (recommended).
2. Keep across reloads in the same tab, validating content and permissions.

**Final recorded choice:** Keep eligible history through temporary disconnections; reset when the board is reloaded or closed.

### 4. How should changes be grouped into undo steps?

Alternatives presented:

1. One step per meaningful action, with typing grouped into short bursts (recommended).
2. One step per completed editing session; text changes before leaving the field undo together.

**Final recorded choice:** One step per completed editing session. A drag, resize, rotation, or multi-object operation is one step; all text changes before leaving a text field undo together.

## Reconnection and permission changes

### 1. How should pending edits be handled when the shared canvas changed during disconnection?

Alternatives presented:

1. Automatically apply independent edits; review conflicts.
2. Automatically recover conflicting objects as copies.
3. Review all pending edits.

**Final recorded choice:** With current write permission, notify the user that the canvas changed and offer Load latest or Create a private copy containing the entire local version. Do not merge divergent changes or overwrite the shared canvas.

**Notes:** User rejected merging and initially chose full shared-canvas overwrite. Later explicitly revoked that choice in favor of a separate private fork, then confirmed this applies both to ordinary reconnection and restored write permission. Earlier overwrite and overwrite-race decisions are superseded.

### 2. What should Load latest do with unsaved local work?

Alternatives presented:

1. Keep a downloadable recovery copy then load latest.
2. Discard after explicit confirmation.

**Final recorded choice:** Offer to download the local version as a recovery copy before loading the updated shared canvas. User can download, continue without downloading, or cancel.

**Notes:** User supplied the download offer as a third option.

### 3. What happens if an Editor becomes a Viewer with pending work?

Alternatives presented:

1. Switch to read-only and preserve work until write permission returns (recommended).
2. Switch to read-only and offer an editable recovery download.
3. Pause at permission-change screen with return or retry.

**Final recorded choice:** Switch to read-only, explain the permission change, preserve pending work locally for recovery if write permission returns, and load the latest authorized canvas.

### 4. What happens after full access removal?

Alternatives presented:

1. Preserve pending work locally until access returns (recommended).
2. Remove local pending work immediately.

**Final recorded choice:** Hide the canvas and stop synchronization upon detection. Preserve pending work locally until access is restored. Show access-removal message with return-to-library and check-access actions. Recovery requires current write permission.

### 5. How should preserved work be recovered after write permission returns?

Alternatives presented:

1. Ask before recovering (recommended).
2. Automatically recover if unchanged.

**Final recorded choice:** Ask before recovering it. If the shared canvas is unchanged, offer to restore pending edits. If changed, offer Load latest or Create a private copy.

**Notes:** Final divergent-version choices reflect the later explicit rollback of shared-canvas overwrite.

### 6. What should other participants experience after Keep my version replaces the canvas?

Alternatives presented:

1. Reload replacement with notice and preserve others pending work.
2. Pause on Canvas replaced notice.

**Final recorded choice:** User revoked the shared-canvas replacement capability entirely. Fork local work into a separate private board owned by the recovering user, or load latest after offering a recovery download.

**Notes:** Neither proposed replacement behavior is authorized; the user supplied a revised recovery design.

### 7. Use Load latest or Create a private copy for ordinary disconnection as well as restored write permission?

Alternatives presented:

1. Yes, use both choices in both situations (recommended).
2. Only offer a fork after permission restoration.

**Final recorded choice:** Yes. Apply the same choice in both situations, gated by current write permission.

## Superseded decisions

The user initially chose Keep my version as full shared-canvas replacement, then selected a fresh warning if shared content changed again. When discussing effects on other participants, the user explicitly revoked replacement and requested Load latest or a private fork. Both replacement and its race-handling questions are historical only. The final choice applies equally to ordinary reconnection and restored write permission.

## Agent discretion

No explicit technology choice was delegated during questioning. Routine implementation choices remain bounded by the canonical context; consequential unresolved behavior must be surfaced.

## Deferred ideas

No new deferred ideas. Existing backlog dispositions remain unchanged.

## Completion

User approved writing the context after reviewing the four-area summary. No Phase 5 implementation or test result is claimed.
