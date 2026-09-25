---
phase: "4"
slug: "durable-boards-and-recovery"
status: approved
reviewed_at: "2026-09-25T19:39:34Z"
user_confirmed: "2026-09-25"
shadcn_initialized: false
preset: none
created: "2026-09-25"
---

# Phase 4 — UI Design Contract

This contract defines SAVE-01 and SAVE-02 and the user-visible consequences of OPS-01 and OPS-02. All 15 approved Phase 4 decisions are carried forward. Dimensions, additional copy and focus behavior are defaults chosen under the delegated routine-design discretion. This is a design contract; runtime, durability, export integrity and accessibility verification remain execution obligations.

## Sources and Decision Status

- [04-CONTEXT.md](04-CONTEXT.md) (D-01–D-15: save details, recovery, deployment and backup decisions) supplies the locked behavior.
- [PROJECT.md](../../PROJECT.md) (current import, role and acceptance decisions), [REQUIREMENTS.md](../../REQUIREMENTS.md) (SAVE-01, SAVE-02, OPS-01, OPS-02), [ROADMAP.md](../../ROADMAP.md) (Phase 4 outcomes and Phase 5 collaboration boundary), [STATE.md](../../STATE.md) (approved foundation), and [config.json](../../config.json) (research and verification workflow) establish scope.
- [AGENTS.md](../../../AGENTS.md) (public repository and workflow constraints) requires generic artifacts and synthetic verification data.
- [03-UI-SPEC.md](../03-okta-and-board-access/03-UI-SPEC.md) (existing shell, access and focus conventions) informs reuse. Current source tokens supersede its historical brown palette and typography. Current PROJECT decisions supersede its historical local-copy workflow; archive Import remains the current entry point.
- [tokens.css](../../../src/styles/tokens.css) (logo-derived palette, font and dimensions), [controls.css](../../../src/styles/controls.css) (shared controls and focus), and [index.css](../../../src/index.css) (header, card and responsive geometry) define the existing visual system.
- [Header.tsx](../../../src/header/Header.tsx) (title-adjacent state and recovery disclosure), [BoardLibrary.tsx](../../../src/boards/BoardLibrary.tsx) (authorized cards), [Dropdown.tsx](../../../src/header/Dropdown.tsx) (disclosure and dismissal), and [BoardActionDialog.tsx](../../../src/boards/BoardActionDialog.tsx) (confirmation conventions) are implementation seams.
- [save-status.ts](../../../src/canvas/save-status.ts) (current aggregation), [outbox.ts](../../../src/canvas/account/outbox.ts) (account-scoped pending journal), [runtime.ts](../../../src/canvas/runtime.ts) (board lifecycle), [session.ts](../../../src/auth/session.ts) (identity interruption), and [export-board.ts](../../../src/canvas/export-board.ts) (editable archive export) require alignment with this contract.

Technical RESEARCH is absent at authoring. Research selects durable acknowledgments, retry/stall timing, journal validation and server-restoration detection. Those mechanisms must implement the states below. Existing React shell, CSS tokens and native canvas are retained; this contract introduces no package or infrastructure selection.

## Design System

| Property | Value |
|----------|-------|
| Tool | none; existing manual logo-derived CSS system |
| Preset | not applicable |
| Component library | Existing HTML/React shell and native BlockSuite canvas |
| Icon library | Existing inline SVG/MenuIcon conventions |
| Font | `--dali-font`: bundled Dali UI (Inter), system sans-serif fallback |

Source inspection found no components.json. Preserve the existing system under the locked reuse instruction; shadcn initialization is superseded by that decision. No packaged component inventory applies to Tool none. Reuse source components above; this is a non-exhaustive seam list rather than a package-export claim.

The board canvas remains the visual anchor. Keep saving information in the existing title/status group. A background failure updates that group without opening a modal, moving focus, or adding a persistent banner. Save details open on deliberate activation. Session interruption retains its existing authorization surface. Pausing editing due to local-storage failure keeps the board visible and its status actionable.

## Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| space-1 | 4px | Icon/text micro-spacing |
| space-2 | 8px | Related controls, status/title gap and rows |
| space-4 | 16px | Popover padding, paragraph/action separation, narrow gutters |
| space-5 | 24px | Confirmation padding and grouped sections |
| space-6 | 32px | Maximum content separation within new recovery surfaces |
| space-7 | 48px | Existing library empty-state vertical spacing |
| phase page spacing | 64px | Reserved page-level separation when required; no global token change |

The phase-declared spacing set is 4, 8, 16, 24, 32, 48 and 64px. Use existing matching tokens where available. New or touched recovery controls use 8px vertical and 16px horizontal padding; compact status triggers may use 8px horizontal padding. Preserve the global 12px token and unrelated controls that use it. No Phase 4 spacing exceptions. Touched recovery buttons and status triggers have minimum 44px height; icon-only close targets are at least 44px square. Borders are 1px and focus outlines 2px with 2px offset. These are line dimensions. Control/panel/dialog radii remain 8/12/16px. Preserve canvas model geometry and existing board previews.

## Typography

Four sizes and exactly two weights apply to new or touched Phase 4 state surfaces. Other existing chrome and authored canvas text retain their appearance.

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Metadata / last-save age / board-card marker | 12px | 400 | 1.5 |
| Status / action label / image-row label | 13px | 600 | 1.5 |
| Details / error / helper body | 14px | 400 | 1.5 |
| Recovery / confirmation heading | 20px | 600 | 1.2 |

The last-save age remains beside Saved; use 12px for this touched element instead of introducing an 11px exception. Distinguish the compact sizes through weight and placement: 12px/400 metadata sits beside the semibold status or in its own card metadata row; 13px/600 labels belong to state/action groups; 14px/400 explanatory copy occupies a separate paragraph with 16px separation from the action group. Related metadata rows use an 8px gap. State labels carry semibold weight and age is muted. Long titles and image names retain full accessible text. Details and confirmation copy wrap with `overflow-wrap: anywhere` where needed. These rules apply to Phase 4 state surfaces and preserve unrelated existing typography.

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `--dali-workspace` / `#f7f6fa` | Existing application ground |
| Secondary (30%) | `--dali-surface` / `#ffffff`; `--dali-surface-subtle` / `#f4f1f8` | Status details, cards and confirmations |
| Accent (10%) | `--dali-accent` / `#6840e8` | The single primary recovery action and focus |
| Destructive | `--dali-danger` / `#b12d52` | Explicit loss-risk Leave board action and established destructive actions |

Accent reserved for Download recovery copy in save-error details; Retry saving when it is the sole available recovery action; Sign in to continue in existing session recovery; Stay on board in the leave confirmation; and keyboard focus outlines. Other actions remain neutral. Only one filled primary button per surface. Preserve the existing accent treatment of unrelated shell actions.

Text uses `--dali-ink` (#171126), secondary text `--dali-muted` (#6b6179), and essential boundaries `--dali-field-line` (#91859f). Saved uses existing success (#34704c); pending/offline uses warning (#865900); failed/storage-paused states use danger (#b12d52). These semantic status colors accompany explicit words and icons, separate from the accent allocation. Decorative dividers use `--dali-line`; no faint divider is the sole control boundary. The 60/30/10 ratio applies to chrome composition; the existing #f1f0ed canvas paper and authored colors remain intact. Verify rendered text at 4.5:1 and essential control/focus graphics at 3:1 during execution.

## Copywriting Contract

Placeholders below are escaped text, never HTML or raw server exceptions. Human-readable image labels use a filename when available or stable session labels such as Image 1. Do not expose asset keys, account identifiers, storage paths or exception traces.

| Element | Copy |
|---------|------|
| Primary recovery CTA | Download recovery copy |
| Standard manual retry | Retry now |
| Storage-paused retry | Retry saving |
| Detail heading / close label | Save details / Close save details |
| Saved status / empty detail | Saved / All changes and images are saved to the server. |
| Age | just now / {n}m ago / {n}h ago / {n}d ago |
| Exact save time | Last saved to the server: {localized date and time} |
| No acknowledged save | No server save confirmed yet. |
| Normal save / detail | Saving… / Sending your latest changes and images to the server. |
| Preserved pending / detail | Changes waiting to save / Changes are kept in this browser. We'll retry automatically when the service is available. |
| Pending without preservation confirmation | Changes waiting to save / Some changes have not reached the server. Keep this tab open while we check local recovery. |
| Stalled or failed save / detail | Save failed / Some changes have not reached the server. We'll retry automatically. You can retry now or download a recovery copy. |
| Image-specific failure / detail | Image not saved / Board changes are saved, but {image name} has not reached the server. Retry now or download a recovery copy. |
| Multiple image failures | {n} images have not reached the server. Retry now or download a recovery copy. |
| Combined content and image failure | Board changes and {n} image(s) have not reached the server. Retry now or download a recovery copy. |
| Image row state | Waiting to upload / Uploading… / Image not saved / Saved |
| Manual retry in flight | Retrying… |
| Recovery authorization / application progress | Checking access… / Recovering changes… |
| Recovery in progress detail | Restoring changes kept in this browser and checking their save status. |
| Local storage full / status | Editing paused / This browser's recovery storage is full. Keep this tab open. Download a recovery copy, free space for this site, then retry saving. |
| Local storage unavailable / status | Editing paused / This browser cannot preserve more changes. Keep this tab open. Download a recovery copy, allow storage for this site, then retry saving. |
| Storage retry failure | Changes still cannot be preserved or saved. Keep this tab open and download a recovery copy. |
| Pending library marker / description | Changes waiting to save / This browser holds changes waiting to reach the server. Open this board to recover them. |
| Pending marker inspection failure | Recovery status unavailable / This browser could not check pending changes. Open the board to check recovery. |
| Recovery preparation / helper | Preparing recovery copy… / Includes pending changes and images available in this browser. Import the archive to create a new private board. |
| Recovery download handed off | Recovery copy ready. Check your browser's downloads. |
| Recovery archive failure | We couldn't prepare the recovery copy. Keep this tab open and try downloading again. |
| Missing required image during export | The recovery copy could not include {image name}. Keep this tab open, retry saving, then try downloading again. |
| Leave heading / body | Leave with changes waiting to save? / Some changes have not reached the server. Stay to retry or download a recovery copy before leaving. |
| Leave confirmation actions | Stay on board / Leave board |
| Leave with failed local storage addition | This browser could not preserve all pending changes. Leaving may lose them. |
| Session expiry | Session expired — sign in to continue. |
| Session recovery CTA | Sign in to continue |
| Different-account recovery | You're signed in with a different account. Return to your boards or sign in with the previous account to recover its pending changes. |
| Read permission retained; write permission lost | Your access has changed. Pending changes have not been applied. Contact the board owner to restore editing access. |
| Board access denied | You don't have access to this board. Ask the board owner to grant access to your internal account. |
| Authorized navigation action | Back to your boards |
| Restoration mismatch status / detail | Recovery needs attention / The server copy changed after a restore. Pending changes have been kept separately. Download a recovery copy before continuing with the restored board. |
| Malformed or unsupported recovery data | Recovery needs attention / These pending changes could not be opened safely. Keep this browser's data and contact your operator for recovery help. |
| Authorized restored-board route | Open restored board |
| Opening board / failure | Opening board… / We couldn't open this board. Try again. |
| Retry board load | Try again |

Use singular/plural grammar rather than rendering “image(s)”. Empty image lists omit the image section. Healthy details show the empty-detail message and acknowledged time; no retry button is needed. Library empty, loading, denied, and create/import copy stays as currently implemented. No new data-deletion action is introduced. Leave board is an explicit loss-risk confirmation and does not delete a journal or clear a pending marker.

## Save and Recovery Interaction Contract

### Title-adjacent state and details — D-01–D-03

Keep one stable save-status button immediately beside the title on wide layouts and below it within the same heading group on narrow layouts. It always opens Save details, including while pending or saved, using Enter, Space or pointer activation. Display the visible state plus a decorative icon. Its accessible name is the state followed by “Open save details”; `aria-expanded` and `aria-controls` expose disclosure state. Provide exact acknowledged date/time within details; retain the existing age presentation and make it available to assistive technology without announcing every clock tick.

Saved requires the current board content and every required image to have durable server acknowledgment. Browser persistence, request dispatch, export completion, one successful image upload, or a reopened cached canvas cannot establish Saved. Pending generations keep the label pending even if an older request succeeds. The last acknowledged timestamp remains available during subsequent failures and changes only after full acknowledgment. An empty new board can become Saved after its actual server acknowledgment. Pending count zero with an unresolved image error remains a failure.

State precedence is authorization interruption, unsafe recovery/local-storage pause, image failure with acknowledged content, content failure/stall, recovery/retry, locally preserved pending, ordinary saving, then fully saved. Combined document/image failures use Save failed and enumerate both in details. An already known failure stays visible while retrying; add Retrying… inside details rather than briefly displaying healthy status. A new unrelated upload succeeding must not clear a failed image row.

The nonmodal details panel contains heading/close, concise condition, last acknowledged time, affected image rows when applicable, preservation detail, then actions. Retry now is secondary; Download recovery copy is primary. Auto retry neither opens nor closes the panel. On success update it to the saved detail and preserve focus; do not remove a focused retry control until focus can safely move to the detail heading. Manual retry starts one current-scope attempt, disables duplicate submission, and reports progress. Repeated failure preserves context and the download option. Technical research defines bounded retry and stall thresholds; the UI must not present an indefinitely stalled request as an ordinary short save.

Identify each failed image by stable label and thumbnail if the local bytes can render. A missing preview uses a neutral image placeholder plus its name and state. Provide a Select image action for a still-present canvas image: close details, reveal/select it without editing, and focus the canvas. Omit that action with helper “Image is no longer on this board.” when no corresponding object remains. Successful individual rows may update in place while other rows remain retryable. Remove obsolete failures only after confirming the image is no longer required by the current saved board.

### Outage, local preservation and same-browser reopen — D-05–D-07

An already authorized open board stays editable during a temporary service outage while local preservation succeeds. Show the pending state and keep automatic retry active. Fresh access confirmation precedes replay after reconnect. A known expired session pauses editing through the existing session flow; inability to contact the service alone follows the outage behavior, not a fictitious confirmed expiration.

Same-account reopen checks authorization before exposing or applying the account-scoped journal. Checking access… precedes Recovering changes…; recovery remains pending until server acknowledgment. Journal load errors are recovery errors, never an empty journal or Saved. An inaccessible cold browser shows load failure/retry; this phase promises recovery for the already-open/same-browser case, not unavailable data from another browser.

If local preservation fails during an outage, pause all further mutations: typing, paste/drop, image import, drawing, delete, undo/redo, title changes and mutation menu actions. Preserve the latest available document and image bytes in memory and keep the board visible. Pan/zoom, existing selection, opening save details, recovery download and retry remain operable under the current access rules. Selecting a disabled mutation affordance must not mutate; expose the pause reason through its accessible description or the status group. No automatic recovery modal or persistent banner is added.

Retry saving checks both server availability and safe local preservation. Resume editing only after pending work has a safe preservation path or durable acknowledgment and current write access. A failed probe keeps editing paused. Successful export alone does not resume editing, clear pending records or establish Saved. On recovery restore the previous editing context only if the same account, board, access generation and editable target remain valid and the user has not moved focus elsewhere.

### Account and restoration safety

Recheck current account and effective permission before reading a journal into the UI, replaying changes or completing an asynchronous export. Ignore stale callbacks after board/account changes. Another account sees none of the previous account's pending content, image names, timestamps, board markers or download results. Deliberate sign-out follows the current preservation-first flow; recovery never silently signs the user back in.

When editing permission is lost, preserve pending work separately and show the existing read-only authorized server view. Hide replay and editable-recovery export actions until current permissions authorize them; retain permitted presentation-export behavior. When all board access is lost, show the denied route and hide protected board content. Session expiry uses sign-in recovery; a different identity uses the generic different-account message without prior-account metadata.

After a server restore, incompatible/stale pending journals must not silently reapply over the operator-selected restored state. Research supplies a trustworthy restoration/baseline signal. On mismatch pause replay and editing, preserve the journal, and show Recovery needs attention in the title group. Same-account currently authorized editors can download a recovery copy or explicitly Open restored board. That action loads the authorized restored state while retaining the older journal separately; it does not discard it or imply it was saved. Keep its library pending marker until that work is actually resolved. Automatic retry cannot bypass this safeguard. Corrupt journals likewise stay intact for later recovery and show a distinct error; no successful downloadable archive is claimed when parsing fails.

### Recovery archive and download lifecycle — D-02, D-03, D-07

Produce an editable Dali archive compatible with the existing Import flow, capturing a consistent snapshot of pending board content, hierarchy, styles, image relationships and all referenced image bytes available locally or through authorized reads. Retain crop/adjustment metadata and mind-map structure. Capture a fixed snapshot at activation; edits made afterward remain pending independently. Use a sanitized board-derived filename with a recovery suffix and timestamp, keeping the existing archive extension.

While preparing, retain visible board content and a busy download button. Suppress duplicate export attempts. The panel may close without canceling preservation or falsely confirming completion; reopening shows current progress. Account/access changes cancel or invalidate export completion before handing out bytes. Failure or missing required image bytes leaves the journal and in-memory snapshot intact, shows the specific error and offers retry. Do not download a silently incomplete file under a success label; a partial-archive product path would require a separate explicit contract.

After a successful browser download handoff show Recovery copy ready, not a claim that the user saved a file on disk. Browser cancellation does not clear pending work. Download actions remain available after preparation failure where access permits. Validate recovery integrity by importing the generated archive as a new private board and checking editable content and all expected images; a download event alone is insufficient.

### Leaving and board-library pending markers — D-04, D-08

For in-app navigation that abandons a board with failed/stalled saving, open the leave confirmation. Focus Stay on board initially; Escape stays. Leave board proceeds with the requested destination while preserving pending work where possible. Include the additional storage-failure warning when preservation is unconfirmed. Ordinary short saves do not trigger this confirmation. Browser-controlled reload/tab-close navigation uses the native warning where supported; browsers control its text and may suppress it. Reliable local journaling remains required independently of the warning. Research verifies those browser limits.

The marker is a separate text row on each currently authorized card with matching-account, matching-board pending work in this browser. Place it below the existing role/access metadata; preserve title, preview, edited date and existing actions. Use warning ink with a decorative pending icon. Associate its helper with the card's open link. It neither changes the server Edited timestamp nor indicates collaborators' unsaved changes. Zero pending work adds no row; one/many marked cards retain ordinary grid widths and ordering. Clear only after the matching pending work is durably acknowledged, never merely because a board opened, a download finished, or the user left.

Library journal inspection loads independently from authorized cards. While checking, do not claim that boards have no pending changes; expose a compact polite “Checking recovery status…” status. A journal inspection error uses the generic recovery-status error and retry through Refresh boards; do not infer empty state. Access-list failure preserves the existing library error route without exposing cached private cards. Switching accounts cancels pending inspections and clears old markers synchronously.

## Responsive Layout, Keyboard and Focus

Desktop save details use width `min(384px, calc(100vw - 32px))`, 16px padding and 8px row gaps, aligned to the title/status trigger and clamped inside the viewport. At 900px and below the status moves beneath the title within that group. At 600px and below the details panel uses 16px side gutters and the full available width. Position it below the actual wrapped header rather than a fixed assumed header height. Maximum height is the visible viewport space below the header minus 16px; scroll the body vertically while keeping close/actions reachable. At short viewport heights allow the entire panel to scroll rather than hiding controls.

At 490px stack action buttons at full width, retain 44px targets, and wrap state labels rather than collapsing to a color-only dot. Keep the title input's caret scrolling behavior. The library retains its current grid and one-column narrow layout. Card pending markers wrap fully; they do not steal room from the three-dot menu. Long image lists scroll without horizontal overflow; names wrap without compressing controls. Confirmations use width `min(480px, calc(100vw - 32px))`, 24px padding and maximum height `calc(100dvh - 32px)` with vertical scrolling.

Save details are a named nonmodal dialog with explicit close, Escape and outside-pointer dismissal. On opening focus its heading (`tabindex=-1`); the header close button follows the heading in DOM and visual order, then image actions, retry and download. Tab follows that natural DOM order without a focus trap or positive tabindex. Tab leaving the panel dismisses it without stealing focus. Escape/Close returns focus to the status trigger. Outside-pointer dismissal preserves the pointer's intended focus. Opening another disclosure closes this one. Nested native canvas shortcuts do not fire while focus is inside the panel or leave dialog.

The leave confirmation is a modal dialog with background inertness, focus containment, named heading/body and initial safe-action focus. Closing returns to the origin control; confirmed navigation focuses the destination heading. Mutation pause never moves keyboard focus automatically. A currently editing control becomes nonmutating without losing visible content; attempted edits announce the pause once. Read-only or paused controls must remain distinguishable from a busy retry action.

Use one polite live region for meaningful state transitions; announce failure/pause once with an alert when user action is necessary. Avoid duplicate announcements from the visible button, details and timer. Do not announce background retry counts or age ticks. Each image failure has visible text; decorative icons/previews have empty alternatives. Reduced motion uses static status indicators and immediate panel presentation. Screen-reader speech acceptance remains the approved backlog item; this phase still requires accessible semantics, keyboard operation and automated checks.

## Operational Scope

D-09–D-15 are operator documentation and validation obligations: Kubernetes deployment; planned maintenance allowed up to 24 hours; disaster RPO at most 1 hour; retention 30 days; disaster RTO at most 24 hours; automatic scheduled backups with operator-selected restoration and verification. Ordinary service restarts preserve every acknowledged save. These values introduce no admin dashboard, backup picker, countdown, progress percentage or end-user restoration promise. Outage/reconnect UI uses the states above. Public artifacts and test fixtures remain synthetic; actual deployment configuration stays outside the repository.

## UI Considerations

The compiled UI probe raised **36 applicable considerations across six surfaces**. The independent design checker passed all seven dimensions. The user confirmed the following classifications and all 36 explicit behavior resolutions on 2026-09-25. Coverage: 36 resolved / explicit, zero unresolved. Runtime verification remains an execution obligation.

| Surface | Detected kinds | Confirmed classification |
|---------|----------------|-------------------------|
| E1 Title status and age | Navigation, interactive control, static content | Keep detected kinds |
| E2 Save details and image rows | List, media, interactive control, static content | Keep detected kinds |
| E3 Recovery download | Media, interactive control, static content | Keep detected kinds |
| E4 Board recovery | Navigation, interactive control, static content | Add media for the visible board and images |
| E5 Leave confirmation | Navigation, interactive control, static content | Keep detected kinds |
| E6 Library pending markers | List, navigation, media, static content | Keep detected kinds |

The E4 media override was run through the compiled probe to expose empty/populated considerations missed by the heuristic. The confirmed resolutions reference Copywriting Contract rather than duplicating copy. Each row is an explicit acceptance truth for planning; runtime evidence remains an execution obligation.

| Surface | Category | Acceptance truth | Resolution |
|---------|----------|---------------------------|------------|
| E1 | loading | Show Saving or pending/recovery progress beside the title; retain the last acknowledged server time. | resolved / explicit |
| E1 | error | Apply defined status precedence and open details only on activation; never report Saved until current content and required images are acknowledged. | resolved / explicit |
| E1 | overflow | Use the Responsive Layout contract: viewport-clamped surfaces, vertical scrolling, reachable controls and no horizontal page overflow. | resolved / explicit |
| E1 | long-text | Wrap explanatory text and image names while preserving full accessible labels; test the specified long-title/name fixtures and 320px layout. | resolved / explicit |
| E2 | empty | Omit an empty image list; healthy details show the saved message and acknowledged time. | resolved / explicit |
| E2 | loading | Update individual upload/retry rows in place without stealing focus or removing access to recovery download. | resolved / explicit |
| E2 | error | Identify each failed image; keep its error until that required image is acknowledged or confirmed obsolete. | resolved / explicit |
| E2 | populated | Show stable image labels, available thumbnails, row status and permitted Select image actions. | resolved / explicit |
| E2 | partial | Use a neutral placeholder for missing previews; mixed success and failure retains unresolved rows. | resolved / explicit |
| E2 | overflow | Use the Responsive Layout contract: viewport-clamped surfaces, vertical scrolling, reachable controls and no horizontal page overflow. | resolved / explicit |
| E2 | zero-one-many | Omit zero-image sections, use singular/plural copy and vertically scroll the specified 50-row case. | resolved / explicit |
| E2 | long-text | Wrap explanatory text and image names while preserving full accessible labels; test the specified long-title/name fixtures and 320px layout. | resolved / explicit |
| E3 | empty | A valid board with no images exports without an image section; a referenced but unavailable image follows the missing-image error contract. | resolved / explicit |
| E3 | loading | Show Preparing recovery copy and suppress duplicate preparation while retaining the board and pending data. | resolved / explicit |
| E3 | error | Preparation or missing-image failure retains journal and in-memory content, exposes retry and never hands off a silently incomplete success archive. | resolved / explicit |
| E3 | populated | Hand off a complete authorized snapshot archive compatible with Import; the ready message does not clear pending work or claim a disk save. | resolved / explicit |
| E3 | overflow | Use the Responsive Layout contract: viewport-clamped surfaces, vertical scrolling, reachable controls and no horizontal page overflow. | resolved / explicit |
| E3 | long-text | Wrap explanatory text and image names while preserving full accessible labels; test the specified long-title/name fixtures and 320px layout. | resolved / explicit |
| E4 | empty | A valid empty board remains a valid canvas; inaccessible or unavailable board data uses the load/denied contract rather than a fabricated empty board. | resolved / explicit |
| E4 | loading | Check current account and permission before recovery, then show recovery progress until server acknowledgment. | resolved / explicit |
| E4 | error | Use distinct load, permission, corrupt-journal and restoration-mismatch states; retain isolated pending data and gate content/actions by current authority. | resolved / explicit |
| E4 | populated | Display the authorized board with its images; restore a still-valid editing context without overriding a subsequent focus move. | resolved / explicit |
| E4 | overflow | Use the Responsive Layout contract: viewport-clamped surfaces, vertical scrolling, reachable controls and no horizontal page overflow. | resolved / explicit |
| E4 | long-text | Wrap explanatory text and image names while preserving full accessible labels; test the specified long-title/name fixtures and 320px layout. | resolved / explicit |
| E5 | loading | After explicit Leave, suppress duplicate navigation while the requested transition completes and focus the destination heading. | resolved / explicit |
| E5 | error | Unconfirmed local preservation adds the defined loss warning; Stay retains the current board and Leave remains an explicit informed choice. | resolved / explicit |
| E5 | overflow | Use the Responsive Layout contract: viewport-clamped surfaces, vertical scrolling, reachable controls and no horizontal page overflow. | resolved / explicit |
| E5 | long-text | Wrap explanatory text and image names while preserving full accessible labels; test the specified long-title/name fixtures and 320px layout. | resolved / explicit |
| E6 | empty | Keep the existing empty-library view; zero pending records adds no marker and does not fabricate cards. | resolved / explicit |
| E6 | loading | Load authorized cards independently and expose Checking recovery status while journal inspection is pending. | resolved / explicit |
| E6 | error | Inspection failure shows Recovery status unavailable with Refresh boards retry; access-list failure does not reveal cached private cards. | resolved / explicit |
| E6 | populated | Place the matching account/browser pending marker below role/access metadata without changing server edited time, grid ordering or card actions. | resolved / explicit |
| E6 | partial | A missing preview uses the existing card fallback; marker visibility depends on authorized metadata and journal evidence, not preview success. | resolved / explicit |
| E6 | overflow | Use the Responsive Layout contract: viewport-clamped surfaces, vertical scrolling, reachable controls and no horizontal page overflow. | resolved / explicit |
| E6 | zero-one-many | Preserve the current zero/one/many-card layout and test 50 marked cards; clear each marker only on acknowledgment of its matching pending work. | resolved / explicit |
| E6 | long-text | Wrap explanatory text and image names while preserving full accessible labels; test the specified long-title/name fixtures and 320px layout. | resolved / explicit |

Execution must exercise these states with synthetic data at 1440px, 900px, 600px, 490px and 320px widths, 200% zoom, reduced motion, 200-character titles, 120-character unbroken image names, and zero/one/50 failed-image rows or marked cards. Check keyboard focus through automatic transitions, current/different-account recovery, restart reopening without prior cache and recovery-archive import fidelity. These are planned acceptance targets.

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| None | None | Not applicable — existing manual/native components; no registry assets introduced |

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS
- [x] Dimension 7 Inventory Provenance: PASS / not applicable to Tool none

**Design review:** all seven dimensions passed after one revision.

**Finalization:** Approved after independent checker review and explicit user confirmation on 2026-09-25. All six surface classifications and 36 acceptance truths are ready for Phase 4 planning.
