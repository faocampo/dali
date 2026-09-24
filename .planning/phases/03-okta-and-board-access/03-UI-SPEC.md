---
phase: "3"
slug: "okta-and-board-access"
status: approved
shadcn_initialized: false
preset: none
created: "2026-09-16"
---

# Phase 3 — UI Design Contract

This contract defines AUTH-01 and BOARD-01 through BOARD-04. It carries forward all 16 locked access decisions. Routine copy, dimensions and interaction details are defaults selected under the user's instruction to move forward with recommended options. This is a design artifact; implementation, runtime accessibility and real-provider acceptance require separate evidence.

## User-directed refinement — 2026-09-18

The eight browser comments recorded in quick task 260918-eix amend the presentation contract: click-to-edit borderless titles; vertically centered roles; an initials avatar and user name; Import/Export last in File; concise menu labels; an unoutlined library heading; no full-name disclosure; and local copying under Import instead of a separate section. Authorization, preservation and pending acceptance remain unchanged.

## User-directed refinement — 2026-09-24

Quick task 260924-amb moves card actions into a three-dot disclosure, places Import in the library top bar, and reuses the canvas avatar/name account control at the right. Email and sign-out are inside that disclosure. The user reaffirmed internal-member-only admission, independently of board roles. The synthetic user without board grants is explicitly labeled an internal member; a separate external fixture exercises rejection.

## Sources and Decision Status

- [03-CONTEXT.md](03-CONTEXT.md) (D-01–D-16: authentication, roles, library and local-copy decisions) is authoritative for behavior.
- [REQUIREMENTS.md](../../REQUIREMENTS.md) (approved identity and board-access requirements), [ROADMAP.md](../../ROADMAP.md) (Phase 3 scope and Phase 4/5 boundaries), [PROJECT.md](../../PROJECT.md) (internal-member product scope), and [STATE.md](../../STATE.md) (accepted foundation and recent shell changes) establish scope.
- [AGENTS.md](../../../AGENTS.md) (public repository privacy boundary) requires synthetic examples and organization-neutral artifacts.
- [02-UI-SPEC.md](../02-daily-mind-maps/02-UI-SPEC.md) (manual theme, typography, keyboard and explicit Properties conventions) and [01-CONTEXT.md](../01-editable-canvas-and-image-portability/01-CONTEXT.md) (canvas and image-export behavior) establish preservation requirements. No Phase 1 UI-SPEC or DESIGN.md was found in the repository scan.
- [src/index.css](../../../src/index.css) (existing theme and responsive card/dialog styles), [BoardLibrary.tsx](../../../src/boards/BoardLibrary.tsx) (cards and local board actions), [Header.tsx](../../../src/header/Header.tsx) (compact editor shell), [BoardTitleMenu.tsx](../../../src/header/BoardTitleMenu.tsx) (inline rename), and [ExportDialog.tsx](../../../src/header/ExportDialog.tsx) (existing export surface) were inspected as implementation seams.

Technical research proceeds separately. This contract does not select a backend, session lifetime, identity claim mapping or storage protocol. Phase 4 owns durable recovery/restart/backup acceptance; Phase 5 owns collaboration and active-session revocation acceptance. Phase 3 must still deny unauthorized direct reads/writes and recheck identity/access before resuming pending changes.

## Design System

| Property | Value |
|----------|-------|
| Tool | none; existing manual CSS theme |
| Preset | not applicable |
| Component library | Existing HTML/React shell and native BlockSuite canvas controls |
| Icon library | Existing inline SVG and native canvas icon convention |
| Font | Existing `--affine-font-family`: system sans-serif |

The source scan found no components.json or Tailwind preset. Preserve the existing system under the locked reuse decisions and the user-authorized continuation; no initialization or stack replacement is required. A packaged component inventory is omitted because Tool is none. No third-party registry assets are introduced.

Reuse board cards and their preview geometry, Main Menu, inline title editing, native modal behavior established by export, and existing PNG/PDF settings. New surfaces are authentication status, account control, role/status labels, sharing dialog, named destructive confirmations and selected local-board copying. Preserve existing branding and canvas visual behavior. Existing starter templates may remain, using the same private creation path; this phase adds no templates.

## Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Label/icon spacing |
| sm | 8px | Related controls and row gaps |
| md | 16px | Card padding, list spacing and narrow viewport gutter |
| lg | 24px | Dialog padding and library section separation |
| xl | 32px | Desktop main content top padding |
| 2xl | 48px | Authentication-state vertical separation |
| 3xl | 64px | Library bottom padding |

Exceptions: none for new spacing. All new or modified actionable controls have a minimum 44px height and 44px icon-only target; 44px is a target dimension, not padding. Retain existing 132px card previews, 1240px library maximum width and native canvas model-space geometry. Use 8px control radius and the existing card radius token. Use 1px borders and 2px focus outlines as line thicknesses.

## Typography

Four sizes and two weights for Phase 3 application surfaces, matching the Phase 2 chrome contract. Apply these to touched library/access controls without changing authored canvas text.

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Metadata / updated time | 12px | 400 | 1.5 |
| Control / role label | 13px | 600 | 1.5 |
| Body / error / text input | 15px | 400 | 1.5 |
| Page / dialog heading | 20px | 600 | 1.2 |

Board titles use 15px/600/1.5. Display member emails in ordinary system text; permit wrapping at any character. Role names retain title case: Owner, Editor, Viewer. Use text labels alongside state icons.

Differentiate the compact sizes through weight and grouping: 12px/400 metadata sits in a secondary line beneath each card title; 13px/600 control and role labels sit within their button or status group; 15px/400 body text occupies a separate explanatory paragraph or input. Keep metadata and controls in distinct rows with an 8px gap, and separate explanatory text from action groups by 16px. This hierarchy retains the established four sizes and two weights.

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#f1f0ed` | Library and authentication page ground; established canvas paper |
| Secondary (30%) | `#ffffff`, `#f7f6f3` | Cards, dialogs, account menu, neutral status surfaces |
| Accent (10%) | `#b4451f` | Primary action, active filter indicator, selected local-copy checkbox and keyboard focus |
| Destructive | `#b23b32` | Delete board and remove-access actions/confirmation |

Accent reserved for New board, Sign in again/Sign in to continue, Grant access, Copy selected boards, the selected filter indicator, checked local-copy controls and focus outlines. Use a single visually primary action per surface. Other controls use neutral ink `#1b1a18`; secondary meaningful text uses `#57534e`. Preserve the existing error token `#b23b32` for error text with an explicit message; error color is semantic, separate from the accent budget. Use `#76736e` for essential input boundaries and `#e3e1dc` for decorative dividers. White text on the accent fill, role labels, focus indicators and rendered backgrounds require contrast checks during execution. The 60/30/10 split is a composition target for chrome; previews retain authored colors.

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary library CTA | New board |
| Library heading / subtitle | Your boards / Boards you can access with this account. |
| Filters | All / Mine / Shared with me |
| Empty All or Mine heading | Create your first board |
| Empty All or Mine body | Start a private board. You can share it with internal members afterward. |
| Empty Shared with me heading | No shared boards yet |
| Empty Shared with me body | Boards shared with you will appear here. Choose All to see your boards. |
| Authentication transition | Signing you in… |
| Opening board | Opening board… |
| Loading library | Loading your boards… |
| Login failure | We couldn't sign you in. Try signing in again. |
| Signed-out heading / body | You're signed out of Dalí / Your Dalí session has ended. |
| Signed-out CTA | Sign in again |
| Session expiry heading / CTA | Session expired — sign in to continue. / Sign in to continue |
| Expiry preservation detail | Editing is paused. Pending changes are kept for this account while you sign in. |
| Preservation failure | Pending changes could not be secured for sign-in. Keep this tab open and retry preservation. |
| Preservation retry | Retry preservation |
| Different identity after sign-in | You're signed in with a different account. Return to your boards or sign in with the previous account to recover its pending changes. |
| Denied heading / body / CTA | You don't have access to this board / Ask the board owner to grant access to your internal account. / Back to your boards |
| Access lost during recovery | Your access has changed. Pending changes have not been applied. Return to your boards or contact the board owner. |
| Read-only indicator | Viewer · View only |
| Private status | Private |
| Shared status / pending detail | Shared / Pending member sign-in |
| Account control | Initials avatar and {display name} |
| Account action | Sign out of Dalí |
| New default title | Untitled board |
| Rename accessible label | Board name |
| Rename failure | We couldn't rename this board. Your previous name is unchanged. Try again. |
| Board operation failure | We couldn't {create / duplicate / delete} this board. Try again. |
| Library failure | We couldn't load your boards. Try again. |
| Retry action | Try again |
| Sharing title / trigger | Share board |
| Member field label | Find an internal member or enter an internal email |
| Search progress / empty | Searching members… / No matching members. Enter an internal email to add access before their first sign-in. |
| Search failure | We couldn't search members. Try again. |
| Grant role / default | Access / Viewer |
| Grant CTA | Grant access |
| Pending grant helper | Access starts after this person signs in with a verified internal account. |
| Sharing explanation | Only the owner can manage access. A board link works only for people who already have access. |
| Share list empty | Only you have access. |
| Invalid email | Enter a valid internal email address. |
| Internal eligibility failure | This address is not eligible for internal access. Check the address and try again. |
| Duplicate grant | This person already has access. Change their role in the access list. |
| Share failure | We couldn't update access. The previous access settings are unchanged. Try again. |
| Grant success | Access granted. |
| Pending grant success | Pending access added. |
| Role update success | Access updated. |
| Copy location action / success | Copy board link / Board link copied. |
| Copy location failure | We couldn't copy the link. Select and copy the board address below. |
| Remove access confirmation | Remove access for {member}? They will lose permission to open this board. |
| Remove pending confirmation | Remove pending access for {email}? This grant will no longer activate after sign-in. |
| Remove confirmation buttons | Keep access / Remove access |
| Delete confirmation | Delete “{board title}”? This removes the board and its access grants for everyone. This cannot be undone. |
| Delete confirmation buttons | Keep board / Delete board |
| Duplicate success | Private copy created. Only you have access. |
| Local work entry | Import > Copy local boards |
| Local-copy helper | Select the local boards to copy into this account as private boards. Their titles, content and images will be copied. Originals stay in this browser. |
| Local-copy destination | Copy to: {current account email} |
| Local-copy CTA / progress | Copy selected boards / Copying {completed} of {total} boards… |
| Local-copy zero | No local boards are available in this browser. |
| Local-copy complete | {N} board copied. / {N} boards copied. Originals remain in this browser. |
| Local-copy partial | {N} copied; {M} could not be copied. Retry the failed boards. Originals remain in this browser. |
| Local-copy failure / retry | This board could not be copied. Its original is unchanged. / Retry failed boards |
| Missing preview | Preview unavailable |
| Missing image | An image could not be loaded. Try again. |
| Blocked new tab | Your new board is ready. Open board in a new tab. |

Copy asserting preservation, unchanged settings or completed creation is shown only after the corresponding operation establishes that result. A transport timeout is an unknown outcome: show “We couldn't confirm this change. Check again before retrying.” with Check again; reconcile the result before offering another mutation. This applies to create, duplicate, delete, grants and copying.

## Interaction Contract

### Authentication and interrupted work — D-01–D-04, D-13

Ordinary signed-out entry redirects directly to the configured provider, showing only neutral transition UI while navigating. Preserve a valid application board target across sign-in. Authorize the returned target before mounting its document, title, preview or images. Entry without a target opens the authenticated library. Denial uses the same generic state for an absent or inaccessible board, with no protected board metadata. A denied target remains on that state until deliberate navigation; do not substitute a remembered or newly created board. Authentication errors remain on a retry page rather than looping.

Explicit Sign out of Dalí ends the application session, clears visible account content and opens the signed-out page. Sign in again is deliberate; this page never immediately redirects. A still-active provider session may sign the member back in when that button is used. Browser restart reuses an unexpired application session; session duration remains operator-configured.

When expiry is detected, immediately suspend every mutation path and open a modal interruption surface. Preserve the current draft and pending operations under the original identity and board before starting a redirect. Block proceeding if preservation fails and provide Retry preservation. Closing or pressing Escape must never restore editing under an expired session. Preserve the requested board and restore focus to the prior editing location after successful same-account authorization and recovery. Announce resumed editing only after pending work is accepted; keep honest pending/failure status while recovery runs.

If reauthentication returns a different identity, dispose the previous visible runtime and expose no prior account content, thumbnails or drafts. Show the different-identity message with Back to your boards and Sign out of Dalí; the latter enables deliberate previous-account sign-in. Retain recovery records privately scoped to their originating identity. Same identity with lost access gets the recovery-denied message and no replay. A Viewer downgrade permits read-only authorized content but blocks replay of edits. Session expiry and explicit sign-out must not silently discard pending edits; protect them before leaving or hold the current tab with the preservation failure state.

### Library, creation and rename — D-05, D-11, D-14, D-15

Use the existing centered card grid. Order authorized account boards by most recently updated; break equal timestamps by stable board identity. All includes every accessible board; Mine includes owned boards; Shared with me includes non-owned explicit grants. Keep the selected filter while actions refresh the list. Empty filters use their matching copy and remain operable.

The library's visual anchor is the Your boards heading paired with the accent-filled New board CTA in the existing heading/action layout. The top bar contains the brand at the left and Import plus the avatar/name account disclosure at the right. Email and sign-out appear inside the account disclosure. Main content order is Your boards and its subtitle, New board, the filter group and account-board cards. Preserve this order on narrow viewports; account names truncate with a full accessible name and readable identity in the dropdown. Secondary controls remain visually subordinate to New board.

Each editable card has a 44-pixel three-dot disclosure beside its metadata, containing Rename board and Duplicate board, plus owner-only Share board and Delete board. Viewers have no mutation disclosure. Keyboard activation, Tab, Escape, outside-click dismissal and focus restoration to the disclosure after canceling dialogs remain supported. Actions never occupy a permanent stack. Each card includes a decorative preview, title, edited date/time, Private or Shared, and the current member's role. Private means owner-only with zero active or pending grants. Shared means at least one active or pending grant; pending-only sharing also exposes Pending member sign-in. Labels use authoritative summaries. A missing thumbnail gets a neutral placeholder and never blocks opening. Missing required permission/identity metadata prevents rendering an actionable card until refreshed.

New board creates a private owned board with Untitled board and opens it. Library creation may use the current tab. Preserve File > New opening another tab while leaving the current board intact. Reserve the tab during the user gesture, show progress there and resolve it to the authorized board; if blocked, expose the resulting board link without creating another board. Creation failure offers a retry without abandoning the existing board.

Owner and Editor see a compact borderless title label that enters editing on click or keyboard activation. Inline header rename preserves its behavior: Enter or blur submits a trimmed nonblank title, Escape restores the acknowledged title, and IME composition does not submit. Blank names restore the previous name; creation retains the usable default. Preserve Unicode title content through rename, copying and display; trimming only removes surrounding whitespace. Keep failed draft text available for correction and show the acknowledged title elsewhere until success. Library Rename board opens a small labeled dialog prefilled with the title; Save name commits, Keep name preserves the acknowledged title and closes the dialog. Viewers see a text title. Prevent duplicate submits; normalize via the same title rules in both entry points.

### Roles and editor affordances — D-09–D-12

| Capability | Owner | Editor | Viewer |
|------------|-------|--------|--------|
| Open, select for navigation/export, pan and zoom | Yes | Yes | Yes |
| Edit content, images, mind maps and board name | Yes | Yes | No |
| Export PNG/PDF using existing scopes/settings | Yes | Yes | Yes |
| Editable download and board duplicate | Yes | Yes | No |
| Share, grant, change/revoke grants, delete source board | Yes | No | No |

Show the role in the board header; the Viewer label remains visible alongside read-only canvas navigation. Hide unavailable mutation actions from shell menus, card actions and native context controls. Read-only state must cover keyboard shortcuts, paste, drop, drawing, text edits, Properties, history and native canvas mutations. Preserve selection needed for PNG/PDF scope. Permission enforcement on document/image/export routes and mutation services remains mandatory even when controls are hidden.

Duplicate board produces a private copy owned by the actor, with no grants inherited. Use “{title} (copy)” as the editable default, keep focus on its new card, and show the success message. Owner-only Delete board opens the named confirmation, initially focusing Keep board. Keep the source visible until deletion is acknowledged. Success removes the card and moves focus to the next card or New board. A failure preserves the card and confirmation context; uncertain outcomes reconcile before retry. Do not introduce ownership transfer.

### Sharing — D-06–D-08, D-12

Owner-only Share board is available from the header and card action area. Use a native modal with title, current account, board title, member search, role selector, Grant access, access list and Copy board link. Link copying changes no access. Owner row is labeled Owner and has no role-change/removal controls.

Search existing internal members with a labeled combobox and keyboard-selectable results displaying name plus email. Ignore stale responses after the query changes. A valid eligible typed internal email may be selected as a pending grant; distinguish it from an existing member. Default each newly selected recipient to Viewer. Editor requires an explicit role selection. Disable Grant access until a recipient and role are valid; show the reason beside the input. Never optimistically represent an unverified email as an active member.

Access rows show member identity, Editor/Viewer, and Active or Pending member sign-in. Role selection commits through an explicit Save access action, preserving the previous role until acknowledgment. Existing grants route to their row. Revoking active and pending grants uses the corresponding named confirmation; focus returns to the next access row or member field. Permit row-scoped loading and errors without disabling unrelated rows. An authorization rejection refreshes permissions and closes owner controls when ownership is lost. No email-delivery or invitation-sent claim is made by granting access.

### Selected local-board copy and identity isolation — D-16

Place Copy local boards inside the compact Import disclosure in the library top bar. Open Copy local boards to enumerate legacy, unbound browser-local documents. Account-bound caches and recovery drafts never enter this inventory. Enumeration failures show an error and retry; they never imply an empty collection. No board is preselected. Show checkboxes, titles, local updated times, selected count, destination account and the preservation helper before any upload.

Copy selected boards processes only explicit selections into private owned account boards, preserving titles, canvas hierarchy, collapsed state and referenced images. Each row progresses through Waiting, Copying, Copied or Failed. Only acknowledge a copied board once its required content and images are complete. A failed item remains retryable; successful items are excluded from retry to prevent duplicates. Reconcile ambiguous outcomes by the original copy attempt. Partial completion keeps per-board results visible, with singular/plural counts and links to successful copies.

Keep every local original and its images intact. This phase introduces no automatic removal or cleanup of originals. If local deletion is retained as an existing action, separate it from copying and explicitly name the local board and browser scope in its confirmation. Close local copies is safe between completed items; an active item reports progress until settled, and closing the dialog does not imply cancellation of an acknowledged copy. If identity changes or expires, stop starting new copies, hide prior-account results and require renewed same-account authorization before resuming. A new identity must explicitly select its own destination/copy operation.

## Responsive Layout, Keyboard and Focus

At 1404px viewport width, retain the 1240px centered library, 16px grid gap and auto-fill cards with minimum 220px width. At 700px and below use 16px gutters and stack the heading/actions. At 490px use one card column, a wrapping filter row and compact card action disclosures; page content must not scroll horizontally. Preserve the board header's compact title and Main Menu; wrap role/account/share controls into a second row when needed rather than covering the canvas title.

Sharing and copy dialogs use width `min(640px, calc(100vw - 32px))`, maximum height `calc(100dvh - 32px)`, fixed header/footer and a vertically scrollable body. At 490px recipient fields and role/actions stack; emails wrap; action buttons retain 44px targets. No essential controls are hover-only. Sticky dialog regions may not cover focused content at 200% browser zoom.

Cards show at most two title lines without a separate full-name disclosure. Accessible open names and native title tooltips retain the full title; opening the board exposes its readable or editable title. Header titles truncate visually while the input permits horizontal caret scrolling during editing. Dialog titles and destructive confirmations wrap fully. Test 200-character titles, 120-character unbroken tokens, long member emails, one board and 50 boards/grants. Lists scroll vertically without compressing row controls. A single card retains ordinary column width at desktop.

Use actual buttons, links, inputs and selects. Filters use a labeled button group with `aria-pressed`; Tab visits each filter and Enter/Space activates it. Card open and actions are separate interactive elements. Menus retain existing arrow/Escape behavior. Combobox Up/Down selects results, Enter chooses and Escape dismisses results before closing the dialog. Enter within IME composition never grants, renames or submits.

Dialogs trap focus, label their title, make the background inert and restore focus to the trigger on close. For sharing, focus the member field; for local copy, focus the heading then selection controls; for destructive confirmation, focus the safe action. Escape cancels ordinary dialogs without mutating data. During an in-flight request, preserve context until the operation settles rather than pretending cancellation. Session expiry remains blocking even if its visual dialog is dismissed. Route changes focus the page heading. Your boards remains visually plain when programmatically focused; interactive controls retain visible keyboard focus. Errors connect to fields using `aria-describedby` and announce via `role=alert`; progress/result announcements use a polite status region. Skeletons are noninteractive and decorative. Use static progress under reduced motion.

## UI Considerations

The compiled UI-consideration probe ran after independent review. Six surfaces were classified with combined element kinds: authentication (navigation, controls, static content); home (collection, navigation, media, controls); titles (form, controls); sharing and local copy (form, collection, controls); canvas (media, navigation, controls). Author review supplied these combined kinds under the delegated recommended defaults. All 39 applicable considerations have explicit planned acceptance criteria; none were dismissed. This records specification coverage, with runtime checks pending execution. Copy remains in the Copywriting Contract.

| ID / surface | Category | Status | Verification | Acceptance criterion |
|---|---|---|---|---|
| UI-AUTH-loading | loading | resolved | explicit | Authentication and board-entry progress remains visible until authorization finishes, with protected content unmounted. |
| UI-AUTH-error | error | resolved | explicit | Authentication, expiry-preservation and recovery failures use their Copywriting Contract recovery actions without redirect loops or unauthorized replay. |
| UI-AUTH-overflow | overflow | resolved | explicit | Authentication and expiry content fits a 490px viewport and scrolls vertically at 200% zoom without hiding the active recovery control. |
| UI-AUTH-long-text | long-text | resolved | explicit | Long account identifiers and authentication errors wrap without truncating the recovery action. |
| UI-HOME-empty | empty | resolved | explicit | Each empty library filter shows its own Copywriting Contract state and a usable route to create or view boards. |
| UI-HOME-loading | loading | resolved | explicit | Library loading shows noninteractive placeholders and preserves the active filter while refreshing. |
| UI-HOME-error | error | resolved | explicit | Library failure exposes Try again and does not render inaccessible cached cards. |
| UI-HOME-populated | populated | resolved | explicit | Every authorized card displays title, preview or placeholder, updated time, access status and current role. |
| UI-HOME-partial | partial | resolved | explicit | A missing preview uses Preview unavailable; missing role or identity prevents an actionable card until refresh. |
| UI-HOME-overflow | overflow | resolved | explicit | Library cards and actions reflow to one column at 490px with no horizontal page scrolling. |
| UI-HOME-zero-one-many | zero-one-many | resolved | explicit | Zero, one and 50 boards retain the specified empty state, normal card width and responsive grid respectively. |
| UI-HOME-long-text | long-text | resolved | explicit | Card titles retain a full accessible name and keyboard/touch disclosure beyond two visible lines, including 200-character Unicode titles. |
| UI-TITLE-empty | empty | resolved | explicit | New blank titles use Untitled board; blank renames restore the acknowledged name. |
| UI-TITLE-loading | loading | resolved | explicit | Create and rename submission disables repeated commits and reports the pending operation. |
| UI-TITLE-error | error | resolved | explicit | Failed rename retains draft input for correction; uncertain outcomes reconcile before retry. |
| UI-TITLE-partial | partial | resolved | explicit | Unsubmitted name edits remain local until Save name, Enter or blur commits; Keep name or Escape preserves the acknowledged name. |
| UI-TITLE-long-text | long-text | resolved | explicit | Inline name inputs retain Unicode text with caret scrolling; library rename dialogs wrap labels and errors within 490px. |
| UI-SHARE-empty | empty | resolved | explicit | Empty member queries create no grant; no matches and owner-only access show their dedicated copy and eligible pending-email path. |
| UI-SHARE-loading | loading | resolved | explicit | Member search ignores stale responses; each access mutation has a row-scoped pending state. |
| UI-SHARE-error | error | resolved | explicit | Grant/search/revoke failures expose their recovery actions and preserve acknowledged access until reconciliation. |
| UI-SHARE-populated | populated | resolved | explicit | Sharing rows distinguish Owner, Editor, Viewer and pending/active membership with owner-only modification controls. |
| UI-SHARE-partial | partial | resolved | explicit | Incomplete or ineligible recipients disable Grant access with an inline reason; pending recipients never appear active before trusted sign-in. |
| UI-SHARE-overflow | overflow | resolved | explicit | Sharing dialog body scrolls vertically with visible fixed actions and keyboard-focused rows unobscured at 490px and 200% zoom. |
| UI-SHARE-zero-one-many | zero-one-many | resolved | explicit | Zero, one and 50 access/search rows preserve owner controls, empty-state copy and operable row targets. |
| UI-SHARE-long-text | long-text | resolved | explicit | Long member emails, search values and revoke confirmations wrap without obscuring identity, role or actions. |
| UI-COPY-empty | empty | resolved | explicit | Local-copy inventory starts with no selected boards; no local boards uses the explicit empty message. |
| UI-COPY-loading | loading | resolved | explicit | Local-copy rows show Waiting, Copying, Copied or Failed plus completed/total progress. |
| UI-COPY-error | error | resolved | explicit | Inventory and copy failures remain distinct from empty results; retries preserve originals and reconcile prior attempts. |
| UI-COPY-populated | populated | resolved | explicit | The copy dialog shows selected source titles, destination account, per-board results and links to successful private copies. |
| UI-COPY-partial | partial | resolved | explicit | Partial copy success exposes individual results and retries only failed boards without duplicating successful copies. |
| UI-COPY-overflow | overflow | resolved | explicit | Local-copy selection/results scroll within the dialog with destination and action controls accessible at 490px. |
| UI-COPY-zero-one-many | zero-one-many | resolved | explicit | Zero, one and many copy selections have correct disabled-action state and singular/plural progress and completion counts. |
| UI-COPY-long-text | long-text | resolved | explicit | Long local titles and destination emails wrap or expose full accessible text without pushing copy controls offscreen. |
| UI-CANVAS-empty | empty | resolved | explicit | An authorized blank board opens with usable role-appropriate navigation and available empty-board/export guidance. |
| UI-CANVAS-loading | loading | resolved | explicit | Opening a board and loading images show explicit progress without temporarily enabling unauthorized mutations. |
| UI-CANVAS-error | error | resolved | explicit | Missing images show a retryable placeholder; authorization rejection clears protected content and presents the access state. |
| UI-CANVAS-populated | populated | resolved | explicit | Owner/Editor can edit while Viewer sees View only, navigation and permitted PNG/PDF controls. |
| UI-CANVAS-overflow | overflow | resolved | explicit | Header account, role and share controls wrap instead of covering the title or canvas at 490px. |
| UI-CANVAS-long-text | long-text | resolved | explicit | Long board names and role/action text retain full accessible names without clipped essential controls. |

## Validation Contract

| Area | Required evidence |
|------|-------------------|
| Authentication | Signed-out direct entry, authorized board target, denied target, explicit signed-out page, failed callback/retry and unexpired session after browser restart. |
| Expiry and isolation | Interrupt edits including mind-map text and images; verify same-identity recovery, preservation failure blocking, different-identity separation and no replay after access loss/Viewer downgrade. |
| Library | All/Mine/Shared with me, private/shared/pending labels, role labels, recent-first ordering, blank private creation, File > New in another tab and blocked-popup fallback without duplicate creation. |
| Board actions | Owner/Editor rename and duplicate; Owner delete; Viewer PNG/PDF scope preservation and editable-download exclusion. Exercise direct requests as well as visible controls. |
| Sharing | Existing member search and stale responses, pending internal email, Viewer default, explicit Editor selection, duplicate grant, role save, revoke active/pending, copy-link success/failure and denied-owner mutation. |
| Local copy | Zero/one/many, explicit selection, titles/content/images preserved, original source remains unchanged, partial failure/retry and account switch during copying. |
| Access boundary | Separate synthetic Owner, Editor, Viewer and non-member contexts; cover document/image retrieval, native shortcuts/paste/drop/mutations and role-aware exports. |
| Visual/accessibility | Screenshots and keyboard checks at 490px and 1404px; 200% zoom, dialog focus return/trap, long text, 50-row lists, announced errors, readable contrast and 44px targets. |
| Existing capability regressions | Mind-map hierarchy/formatting/collapse, selection and image exports, Main Menu and inline title behavior remain functional for authorized roles. |

Use synthetic fixtures such as Planning board, Design review, Alex Example and alex@example.org. Record actual-provider operator checks separately outside the repository. This file makes no runtime, deployment, collaboration or durability acceptance claim.

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| None | None | Not applicable: existing local/manual/native controls; no registry assets introduced |

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS
- [x] Dimension 7 Inventory Provenance: PASS / not applicable to Tool none

**Approval:** Independent checker approved on 2026-09-16 with no blocking findings. One nonblocking copy flag was resolved by specifying Rename board, Duplicate board, Delete board and Close local copies. UI-consideration probe: 39/39 explicitly specified; runtime validation pending.

**Revision 1:** Replaced the generic rename dismissal label with Keep name, made the library visual anchor and reading order explicit, and clarified compact typography through weight and grouping. Locked decisions D-01–D-16 and the existing design system remain unchanged; checker re-verification is pending.
