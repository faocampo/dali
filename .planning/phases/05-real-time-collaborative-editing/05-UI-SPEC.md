---
phase: "05"
slug: "real-time-collaborative-editing"
status: approved
shadcn_initialized: false
preset: none
created: "2026-10-02"
user_confirmed: "2026-10-02"
---

# Phase 5 — UI Design Contract

Contract for presence, reservations, personal history feedback, reconnection, private recovery forks, and permission transitions. D-01–D-19 in `05-CONTEXT.md` are authoritative. Routine visual choices below reuse the existing system. The contract passed an inline seven-dimension review; the user confirmed the six surfaces and all proposed state handling on 2026-10-02. Runtime visual and accessibility testing remains an execution obligation.

## Sources

- `05-CONTEXT.md` — approved behavior and superseded overwrite decision.
- `05-RESEARCH.md` — transport, mutation, history, recovery and validation findings.
- `.planning/REQUIREMENTS.md` and `.planning/ROADMAP.md` — six Phase 5 requirements and twenty-participant acceptance target.
- `.planning/phases/04-durable-boards-and-recovery/04-UI-SPEC.md` — existing shell, recovery and focus conventions.
- `src/styles/tokens.css`, `src/styles/controls.css`, `src/index.css` — current logo-derived colors, fonts, controls and layout.
- `src/header/Header.tsx`, `src/header/SaveDetails.tsx`, `src/header/LeaveRecoveryDialog.tsx`, `src/canvas/RecoveryStateView.tsx` — existing implementation seams to extend.

## Design System

| Property | Value |
|---|---|
| Tool | none; existing manual logo-derived CSS system |
| Preset | not applicable |
| Component library | Existing React/HTML shell and native BlockSuite canvas |
| Icons | Existing MenuIcon/inline SVG conventions; 16px decorative icons beside text |
| Font | `--dali-font`, bundled Dali UI/Inter with system fallback |

Retain the approved existing system; introduce no shadcn initialization, registry blocks, or UI package. Source components above are reuse seams, not a package inventory. Document typography and artboard colors remain independent of application chrome.

## Spacing Scale

| Value | Usage |
|---|---|
| 4px | icon-label and avatar overlap adjustments |
| 8px | controls, status rows, stacked actions |
| 12px | compact panel and roster row padding |
| 16px | standard panel padding and viewport gutters |
| 24px | dialog padding and section separation |
| 32px | major content gaps |
| 48px | touch-friendly control height where needed |

Reuse 8px control, 12px panel and 16px dialog radii. Minimum interactive target 44×44px; avatar graphic may be 32px inside that target. Cursor graphics and selection strokes are noninteractive overlays. Borders 1px, selection/focus strokes 2px, and focus offset 2px are geometry exceptions. Popover shadow uses `--dali-shadow-popover`; modal uses `--dali-shadow-dialog`.

## Typography

New Phase 5 chrome uses only these four sizes and two weights. Existing document text remains unchanged.

| Role | Size | Weight | Line height |
|---|---|---|---|
| Cursor name / metadata | 12px | 400 | 1.5 |
| Label / status / button | 14px | 600 | 1.5 |
| Body / participant name | 16px | 400 | 1.5 |
| Dialog heading | 20px | 600 | 1.2 |

Long names truncate in the compact header with full accessible names and focus/hover tooltip. Roster names wrap to two lines; full text is available through the same tooltip. Dialog descriptions wrap naturally; buttons wrap text without clipping or fixed single-line heights.

## Color

Approximate chrome balance is 60% quiet workspace, 30% white panels, 10% accent; authored canvas content is excluded from that ratio.

| Role | Value | Usage |
|---|---|---|
| Dominant | `--dali-workspace` #f7f6fa | surrounding application chrome |
| Secondary | `--dali-surface` #ffffff | roster and recovery surfaces |
| Text | `--dali-ink` #171126 | enabled text/icons |
| Supporting text | `--dali-muted` #6b6179 | secondary copy |
| Accent | `--dali-accent` #6840e8 | primary recovery action, focused control, active disclosure |
| Accent soft | `--dali-accent-soft` #eee8ff | selected disclosure or own identity |
| Warning | #865900 on #fff4da | disconnected/pending notices |
| Success | #34704c on #edf6f0 | acknowledged save status |
| Danger | #b12d52 on #fff0f4 | access-removal/error emphasis and local-discard confirmation |

Participant colors are semantic identity markers, not additional brand accents: violet #6840e8, green #34704c, amber #865900, rose #b12d52. Pair every marker with a name/initials; colors can repeat at high participant counts and never establish identity alone. Cursor chips use white background and ink text with a colored border; cursor/selection lines get a white contrasting outer stroke. Do not render small white text on unverified bright logo colors.

Idle fade changes the cursor graphic/avatar decoration to 50% opacity; readable labels and interactive button focus remain full contrast. Roster explicitly says Idle. Enabled controls use ink and normal opacity; only unavailable actions use disabled treatment with an explanation.

## Layout and Component Contracts

### E1 — Participant disclosure and roster list (D-01–D-04)

The canvas remains the primary visual anchor. Place a compact participant disclosure next to Share and before the current-account menu. It contains up to three avatar graphics and a +N overflow indicator, all within one keyboard-focusable button labeled `People on this board: {count}`. Count unique authenticated people including the current user. The roster lists name, role, You and Idle markers where applicable; no follow/presenter controls are introduced.

One avatar per account across tabs/devices. Show only the most recently active connected editor cursor. Viewers remain roster entries with no cursor/selection overlays. At narrow widths collapse the avatars into a people icon plus count; retain Share and account access. Disclosure width is min(320px, viewport minus 32px), maximum height min(480px, available viewport), with internal vertical scrolling. Anchoring flips/clamps to viewport. Roster rows are informational, not clickable navigation. Stable ordering avoids moving rows on cursor activity; use current user first, then names.

Loading shows People loading and three non-animated placeholder rows; never show a false zero while fetching. With one person show Only you are here. A temporarily incomplete name renders Participant with role pending, never an identifier or email fallback. A failed roster shows the error copy and Retry presence. On lost connection do not keep other people presented as live. Remove a disconnected person upon detection; remaining connected sessions retain the account row.

### E2 — Cursor, selection and reservation overlays (D-01, D-05–D-07)

Cursors are pointer-events:none. Show name while moving and briefly afterward, plus on hover over the cursor's location using a separate nonblocking hit-detection layer. Own native handles stay distinct from remote selection outlines. Remote names and lock symbols sit outside object bounds where possible; clamp labels to viewport. Place overlays below all formatting menus, dialogs and tooltips. At crowded positions do not stack opaque labels over editing controls.

Requesting a reservation shows Waiting for editing access beside the selected object's toolbar; a private preview may appear but mutation requires authorization. When acquired, use ordinary editing controls. When another participant holds it, keep selection/navigation available and show `{name} is editing this object` with a lock icon; disable conflicting actions with an accessible reason. A denied gesture does not queue a surprise later mutation. Retry when the user deliberately starts another action after release. Multi-object conflicts name the blocking participant and affected selection count.

Idle never releases a connected text editor's reservation. Blur/finish or detected disconnect releases it. UI inactivity and reservation ownership are separate states. Pure selection does not acquire a reservation. Long names use the full-name tooltip and readable status text. No avatar/cursor portraits or new image assets are required.

### E3 — Connection and history status (D-08–D-10, D-19)

Keep the existing title-adjacent Saved status with acknowledged content/image semantics. Add a distinct compact connection label only when connecting, disconnected or checking access; successful transport alone never produces Saved. Outage text states local changes are pending. Keep existing storage-paused and session-expired behavior.

Undo/redo controls remain in the existing toolbar. When skipping a conflicting history step, emit one concise polite status message; do not steal focus. A text session remains one step including typing pauses. History remains scoped to this tab and survives temporary reconnect; reload/close resets it. If an undo action needs a reservation, show the same reservation status and revalidate eligibility before mutation.

### E4 — Diverged version decision dialog (D-11–D-16)

Use a native modal dialog, max-width 480px and viewport gutters 16px. Heading and explanation precede a compact note about local pending work. Primary action Create private copy (branch/copy icon); secondary Load latest changes (refresh icon); tertiary Decide later. Initial focus is the heading, not an action. Escape has Decide later semantics. Until resolved, preserve local work and keep shared writes paused. Reopening the pending-work disclosure returns to this decision.

Create private copy snapshots the local version with assets, reserves a private destination owned by the actor, and shows Creating private copy with an indeterminate progress indicator. Disable duplicate submissions. On successful acknowledgement, open the new board and announce Private copy created. On failure preserve the source/local work, keep the dialog, and offer Retry copy. On permission loss transition to E6 rather than offering an unauthorized retry. Shared source content remains unchanged.

### E5 — Download offer before loading latest (D-13)

Load latest changes leads to a download offer: Download local copy, Load latest without download, Back to versions. Download first exports the retained local snapshot; after export initiation succeeds, show Download started and an explicit Load latest changes action. Browser download completion is not claimed. Export failure preserves work and offers Retry download or Back to versions. Choosing Load latest without download explicitly resolves the selected local candidate; its consequence is stated beside that action. Scope cleanup to that candidate/tab and only after latest content loads successfully.

If loading latest fails, preserve the candidate and show Retry loading or Back to versions. A canceled dialog returns to the unresolved state without publishing or discarding edits. Local download and fork actions require current write permission. Offline/unverified authority disables them with Check access; preserved work stays intact.

### E6 — Permission transition and restored-work panel (D-14–D-19)

Downgrade to Viewer immediately pauses editing and preserves local work. Show a nonmodal notice explaining read-only access, then latest permitted content; the pending-work marker states editing access is required for recovery. No editable download or fork action appears while Viewer.

Full revocation replaces the entire canvas with a neutral access-removal panel, including removal of background thumbnails, menus and overlays. Primary Back to boards; secondary Check access. Retained work is not exposed in the current UI. Check access shows Checking access, prevents duplicate requests and routes by fresh authority. An error leaves the canvas hidden and offers Try checking again. An expired session uses existing sign-in flow and preserves work.

On restored write access, ask before restoring unchanged pending work: Restore pending edits or Load latest changes (via E5). Changed server content routes to E4. Recheck rights at every action. If another change arrives during a decision, retain the local candidate and use the latest authorized state; no overwrite option exists.

## Copywriting Contract

| Element | Copy |
|---|---|
| Roster only self | Only you are here / Invite someone using Share board. |
| Presence failure | People could not be loaded. Check your connection and try again. / Retry presence |
| Presence loading | People loading |
| Missing name | Participant |
| Reservation pending | Waiting for editing access |
| Reservation held | {name} is editing this object. You can edit it when they finish. |
| Reservation denied | This object is being edited. Try again when it is available. |
| Undo conflict | Skipped an undo step to preserve someone else's changes. |
| Redo conflict | Skipped a redo step to preserve someone else's changes. |
| Disconnected | Disconnected. Your changes are kept in this browser and are waiting to save. |
| Checking authority | Checking access before recovering your changes. |
| Version heading | This board changed while you were away |
| Version body | Load the latest shared board, or create a private copy with your local changes. |
| Version actions | Create private copy / Load latest changes / Decide later |
| Fork progress | Creating private copy… |
| Fork error | Your private copy could not be created. Your local work is still here. / Retry copy |
| Download offer heading | Download your local version? |
| Download offer body | Keep a recovery copy before loading the latest shared board. Loading without downloading discards this local version after the latest board opens successfully. |
| Download actions | Download local copy / Load latest without download / Back to versions |
| Export progress | Preparing local copy… |
| Export failure | The local copy could not be prepared. Your work is still here. / Retry download |
| Export initiated | Download started. You can now load the latest board. |
| Latest failure | The latest board could not be loaded. Your local work is still here. / Retry loading |
| Downgrade | Your access is now read-only. Local changes are kept in this browser until editing access is restored. |
| Revoked heading | Your access to this board has been removed |
| Revoked body | Any pending local work is preserved in this browser. Editing access is required to recover it. |
| Revoked actions | Back to boards / Check access |
| Access check error | Access could not be checked. Try again when your connection is available. / Try checking again |
| Restored heading | Editing access restored |
| Restored unchanged body | This browser has pending edits. Restore them or load the latest shared board. |
| Restored actions | Restore pending edits / Load latest changes |

Copy is specific to phase actions. Existing accepted generic shell labels are not broadly renamed by this phase. No destructive shared-board replacement action exists; local-discard consequences are explicit in E5.

## Interaction, Responsive and Accessibility Contract

- Header disclosures close on outside click or Escape and return focus to their trigger. A roster update does not steal focus or reset scroll.
- Modal dialog traps focus and labels itself with the heading/description. Permission revocation takes precedence over every open dialog; move focus to its replacement heading. Return focus to the initiating disclosure on normal dismissal, or to the new board heading after fork navigation.
- Use semantic buttons and lists; decorative SVGs are hidden from assistive technology. Avatar names, role and idle state are available without color. Cursor movement is not live-announced; important access, conflict and recovery outcomes use concise live status.
- Body and action text wrap at 320 CSS px; at native 200% zoom the dialog/footer remain reachable with internal vertical scroll and stacked full-width actions. Floating menus stay within the viewport and above canvas overlays. Preserve toolbar keyboard access.
- Focus indicators use the existing 2px accent ring. Idle opacity affects decoration only. Error status contains text and an action, not color alone.
- Limit transition duration to 120ms for disclosure/fade; honor reduced motion by removing transitions and spinner rotation while retaining progress text. No cursor animation beyond incoming positions.
- Validate selection overlays against arbitrary light/dark authored objects using contrasting outlines and text chips. Viewport pan/zoom transforms must keep cursor/selection coordinates correct.

## Registry Safety

No registry blocks or new UI packages. Existing first-party CSS and inline SVG conventions apply. Third-party registry review is not applicable.

## UI Considerations

Probe completed: 28 applicable checks, 28 resolved with explicit acceptance criteria, zero backstop-only checks, zero unresolved and zero unclassified surfaces. The user confirmed the classifications and proposed resolutions on 2026-10-02. Covered here means specified; execution must still supply runtime evidence. E1 combines list, control and static content; E2–E6 combine controls and static content.

| Category | Element | Status | Resolution / Reason |
|---|---|---|---|
| empty | E1 | ✅ covered | Use the only-self roster copy; unknown/loading presence must not imply an empty board. |
| loading | E1 | ✅ covered | Show the surface-specific progress text and prevent duplicate action submissions while preserving current work. |
| error | E1 | ✅ covered | Use the surface-specific error and retry/back action in Copywriting Contract; retain local candidates on failure. |
| populated | E1 | ✅ covered | Render named roster rows with role and You/Idle markers using E1 ordering and limits. |
| partial | E1 | ✅ covered | Use Participant for an unavailable name and role-pending indication; do not fabricate identity. |
| overflow | E1 | ✅ covered | Clamp floating surfaces to the viewport; roster scrolls internally; dialog content reflows with reachable actions. |
| zero-one-many | E1 | ✅ covered | Distinguish loading from only-self presence; deduplicate accounts and use avatar overflow plus full roster for many. |
| long-text | E1 | ✅ covered | Wrap dialog/status text; truncate compact names with full accessible tooltip; allow button height to expand. |
| loading | E2 | ✅ covered | Show the surface-specific progress text and prevent duplicate action submissions while preserving current work. |
| error | E2 | ✅ covered | Use the surface-specific error and retry/back action in Copywriting Contract; retain local candidates on failure. |
| overflow | E2 | ✅ covered | Clamp floating surfaces to the viewport; roster scrolls internally; dialog content reflows with reachable actions. |
| long-text | E2 | ✅ covered | Wrap dialog/status text; truncate compact names with full accessible tooltip; allow button height to expand. |
| loading | E3 | ✅ covered | Show the surface-specific progress text and prevent duplicate action submissions while preserving current work. |
| error | E3 | ✅ covered | Use the surface-specific error and retry/back action in Copywriting Contract; retain local candidates on failure. |
| overflow | E3 | ✅ covered | Clamp floating surfaces to the viewport; roster scrolls internally; dialog content reflows with reachable actions. |
| long-text | E3 | ✅ covered | Wrap dialog/status text; truncate compact names with full accessible tooltip; allow button height to expand. |
| loading | E4 | ✅ covered | Show the surface-specific progress text and prevent duplicate action submissions while preserving current work. |
| error | E4 | ✅ covered | Use the surface-specific error and retry/back action in Copywriting Contract; retain local candidates on failure. |
| overflow | E4 | ✅ covered | Clamp floating surfaces to the viewport; roster scrolls internally; dialog content reflows with reachable actions. |
| long-text | E4 | ✅ covered | Wrap dialog/status text; truncate compact names with full accessible tooltip; allow button height to expand. |
| loading | E5 | ✅ covered | Show the surface-specific progress text and prevent duplicate action submissions while preserving current work. |
| error | E5 | ✅ covered | Use the surface-specific error and retry/back action in Copywriting Contract; retain local candidates on failure. |
| overflow | E5 | ✅ covered | Clamp floating surfaces to the viewport; roster scrolls internally; dialog content reflows with reachable actions. |
| long-text | E5 | ✅ covered | Wrap dialog/status text; truncate compact names with full accessible tooltip; allow button height to expand. |
| loading | E6 | ✅ covered | Show the surface-specific progress text and prevent duplicate action submissions while preserving current work. |
| error | E6 | ✅ covered | Use the surface-specific error and retry/back action in Copywriting Contract; retain local candidates on failure. |
| overflow | E6 | ✅ covered | Clamp floating surfaces to the viewport; roster scrolls internally; dialog content reflows with reachable actions. |
| long-text | E6 | ✅ covered | Wrap dialog/status text; truncate compact names with full accessible tooltip; allow button height to expand. |

## Checker Sign-Off

Inline review under the Codex adapter, not an independent subagent review:

| Dimension | Verdict | Evidence |
|---|---|---|
| Copywriting | PASS | Explicit action, empty, error and local-discard copy in the contract |
| Visuals | PASS | Canvas anchor, compact presence, decision-first dialogs, labeled icons |
| Color | PASS | Existing semantic palette, explicit accent uses and participant-color purpose |
| Typography | PASS | Four chrome sizes, two weights, explicit line heights |
| Spacing | PASS | Multiples of four, declared stroke/radius geometry and target sizes |
| Registry safety | PASS | Existing implementation only; no registry input |
| Inventory provenance | PASS | Tool none; package inventory omitted, source reuse seams identified |

**Approval:** Approved 2026-10-02 following user confirmation. All seven design dimensions pass inline review. Runtime UI and accessibility validation remain execution obligations.
