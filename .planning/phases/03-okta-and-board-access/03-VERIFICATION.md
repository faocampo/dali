---
phase: 03-okta-and-board-access
verified: 2026-09-17
status: human_needed
score: 99/104 must-haves verified
behavior_unverified: 4
overrides_applied: 0
source_head: 2d0dae437499830adc1d4a142d1765a30b5cf52d
full_gate_source_head: 73416723411ca2c5b98de090f6d5327ed9e076c7
application_head: 6d6dade1ea574e41123c252f36499e465adf5811
flagged_prohibitions: 2
waived_human_prohibitions: 1
active_pending_prohibitions: 1
acceptance_updated: 2026-09-24
acceptance_source: 03-UAT.md
covered_files:
  - ".planning/PROJECT.md"
  - ".planning/REQUIREMENTS.md"
  - ".planning/ROADMAP.md"
  - ".planning/WINDOWS.md"
  - ".planning/config.json"
  - ".planning/debug/resolved/local-sign-in-startup.md"
  - ".planning/debug/resolved/recovery-native-range.md"
  - ".planning/phases/03-okta-and-board-access/03-01-PLAN.md"
  - ".planning/phases/03-okta-and-board-access/03-01-SUMMARY.md"
  - ".planning/phases/03-okta-and-board-access/03-02-PLAN.md"
  - ".planning/phases/03-okta-and-board-access/03-02-SUMMARY.md"
  - ".planning/phases/03-okta-and-board-access/03-03-PLAN.md"
  - ".planning/phases/03-okta-and-board-access/03-03-SUMMARY.md"
  - ".planning/phases/03-okta-and-board-access/03-04-PLAN.md"
  - ".planning/phases/03-okta-and-board-access/03-04-SUMMARY.md"
  - ".planning/phases/03-okta-and-board-access/03-05-PLAN.md"
  - ".planning/phases/03-okta-and-board-access/03-05-SUMMARY.md"
  - ".planning/phases/03-okta-and-board-access/03-06-PLAN.md"
  - ".planning/phases/03-okta-and-board-access/03-06-SUMMARY.md"
  - ".planning/phases/03-okta-and-board-access/03-07-PLAN.md"
  - ".planning/phases/03-okta-and-board-access/03-07-SUMMARY.md"
  - ".planning/phases/03-okta-and-board-access/03-08-PLAN.md"
  - ".planning/phases/03-okta-and-board-access/03-08-SUMMARY.md"
  - ".planning/phases/03-okta-and-board-access/03-09-PLAN.md"
  - ".planning/phases/03-okta-and-board-access/03-09-SUMMARY.md"
  - ".planning/phases/03-okta-and-board-access/03-10-PLAN.md"
  - ".planning/phases/03-okta-and-board-access/03-10-SUMMARY.md"
  - ".planning/phases/03-okta-and-board-access/03-11-PLAN.md"
  - ".planning/phases/03-okta-and-board-access/03-11-SUMMARY.md"
  - ".planning/phases/03-okta-and-board-access/03-12-CHECKPOINT.md"
  - ".planning/phases/03-okta-and-board-access/03-12-PLAN.md"
  - ".planning/phases/03-okta-and-board-access/03-CONTEXT.md"
  - ".planning/phases/03-okta-and-board-access/03-DISCUSSION-LOG.md"
  - ".planning/phases/03-okta-and-board-access/03-PATTERNS.md"
  - ".planning/phases/03-okta-and-board-access/03-PLAN-CHECK.md"
  - ".planning/phases/03-okta-and-board-access/03-PLAN-INDEX.md"
  - ".planning/phases/03-okta-and-board-access/03-REGRESSION-FIX.md"
  - ".planning/phases/03-okta-and-board-access/03-RESEARCH.md"
  - ".planning/phases/03-okta-and-board-access/03-REVIEW-FIX.md"
  - ".planning/phases/03-okta-and-board-access/03-REVIEW.md"
  - ".planning/phases/03-okta-and-board-access/03-SECURITY.md"
  - ".planning/phases/03-okta-and-board-access/03-UAT.md"
  - ".planning/phases/03-okta-and-board-access/03-UI-FIX.md"
  - ".planning/phases/03-okta-and-board-access/03-UI-REVIEW.md"
  - ".planning/phases/03-okta-and-board-access/03-UI-SPEC.md"
  - ".planning/phases/03-okta-and-board-access/03-VALIDATION.md"
  - ".planning/phases/03-okta-and-board-access/COVERAGE.md"
  - ".planning/phases/03-okta-and-board-access/deferred-items.md"
  - ".planning/state.json"
  - "AGENTS.md"
  - "README.md"
  - "docs/access-acceptance.md"
  - "package-lock.json"
  - "package.json"
  - "playwright.config.ts"
  - "scripts/dev-server.ts"
  - "scripts/dev-startup.test.mjs"
  - "scripts/dev.mjs"
  - "server/app.ts"
  - "server/auth/identity-policy.ts"
  - "server/auth/oidc.test.ts"
  - "server/auth/oidc.ts"
  - "server/auth/session-store.ts"
  - "server/boards/access.test.ts"
  - "server/boards/actions.test.ts"
  - "server/boards/actions.ts"
  - "server/boards/blobs.ts"
  - "server/boards/documents.ts"
  - "server/boards/grants.test.ts"
  - "server/boards/grants.ts"
  - "server/boards/imports.ts"
  - "server/boards/library.test.ts"
  - "server/boards/operation-receipts.test.ts"
  - "server/boards/routes.ts"
  - "server/preflight.test.ts"
  - "server/storage/database.ts"
  - "src/App.tsx"
  - "src/auth/AuthBoundary.tsx"
  - "src/auth/session.ts"
  - "src/boards/BoardActionDialog.tsx"
  - "src/boards/BoardLibrary.tsx"
  - "src/boards/LocalBoardCopyDialog.tsx"
  - "src/boards/ShareBoardDialog.tsx"
  - "src/boards/catalog.ts"
  - "src/boards/import-local.ts"
  - "src/boards/operations.ts"
  - "src/boards/preferences.ts"
  - "src/canvas/BlockSuiteCanvas.tsx"
  - "src/canvas/MindMapInspector.tsx"
  - "src/canvas/account/blob-source.test.ts"
  - "src/canvas/account/blob-source.ts"
  - "src/canvas/account/board-doc.ts"
  - "src/canvas/account/board-meta.ts"
  - "src/canvas/account/board-workspace.ts"
  - "src/canvas/account/doc-source.test.ts"
  - "src/canvas/account/doc-source.ts"
  - "src/canvas/account/mutation-guard.test.ts"
  - "src/canvas/account/mutation-guard.ts"
  - "src/canvas/account/outbox.test.ts"
  - "src/canvas/account/outbox.ts"
  - "src/canvas/blocksuite-editor.ts"
  - "src/canvas/export-board.test.ts"
  - "src/canvas/export-board.ts"
  - "src/canvas/image-input.ts"
  - "src/canvas/legacy-runtime.ts"
  - "src/canvas/runtime.ts"
  - "src/canvas/workspace.ts"
  - "src/header/BoardTitleMenu.tsx"
  - "src/header/DaliMenu.tsx"
  - "src/header/ExportDialog.tsx"
  - "src/header/Header.tsx"
  - "src/index.css"
  - "tests/access-boundaries.spec.ts"
  - "tests/access-fixtures.ts"
  - "tests/accessibility-access.spec.ts"
  - "tests/account-workspace-harness.ts"
  - "tests/account-workspace.spec.ts"
  - "tests/authentication.spec.ts"
  - "tests/board-access.spec.ts"
  - "tests/board-actions.spec.ts"
  - "tests/board-library.spec.ts"
  - "tests/board-roles.spec.ts"
  - "tests/board-sharing.spec.ts"
  - "tests/board-title.spec.ts"
  - "tests/canvas-arrangement.spec.ts"
  - "tests/canvas-editing.spec.ts"
  - "tests/canvas-feedback.spec.ts"
  - "tests/canvas-view.spec.ts"
  - "tests/community.spec.ts"
  - "tests/connector-labels.spec.ts"
  - "tests/dali-menu.spec.ts"
  - "tests/fixtures.ts"
  - "tests/image-export.spec.ts"
  - "tests/image-import.spec.ts"
  - "tests/image-visual-edits.spec.ts"
  - "tests/local-board-import.spec.ts"
  - "tests/mindmap-accessibility.spec.ts"
  - "tests/mindmap-collapse.spec.ts"
  - "tests/mindmap-compatibility.spec.ts"
  - "tests/mindmap-copy.spec.ts"
  - "tests/mindmap-formatting.spec.ts"
  - "tests/mindmap-keyboard.spec.ts"
  - "tests/mindmap-layout.spec.ts"
  - "tests/mindmap-node-copy.spec.ts"
  - "tests/mindmap-workflow.spec.ts"
  - "tests/mindmap.spec.ts"
  - "tests/oidc-provider.ts"
  - "tests/session-recovery.spec.ts"
  - "tests/sticky-shadow.spec.ts"
  - "tests/topic-focus-new-board.spec.ts"
  - "tsconfig.dev.json"
  - "tsconfig.server.json"
  - "vite.config.ts"
  - "vitest.server.config.ts"
covered_digest: "v1:sha256:817abede715dfca1fae8bb1c4d1f0820b2c12f0a3cefc1155d94803c1590de3c"
behavior_unverified_items:
  - truth: "UI-SHARE-overflow: Sharing dialog body scrolls vertically with visible fixed actions and keyboard-focused rows unobscured at 490px and 200% zoom."
    test: "At browser UI zoom 200%, exercise long sharing lists and authentication/recovery at narrow and wide windows, keyboard through all controls."
    expected: "Vertical scrolling keeps focus and fixed recovery/share actions visible and operable without horizontal clipping."
    why_human: "Native 200% zoom unobserved; H2."
  - truth: "D-16: Account caches, previews and outbox records remain isolated across identities, stale tabs and restored BFCache documents."
    test: "Navigate away from an authorized board, revoke or change its identity/access, then restore a genuinely persisted history entry and record pageshow.persisted true."
    expected: "Protected content stays paused until fresh session and descriptor authorization; no stale image, content or outbox replay crosses identity or role."
    why_human: "Genuine persisted BFCache restoration unobserved; H3."
  - truth: "UI-AUTH-overflow: Authentication and expiry content fits a 490px viewport and scrolls vertically at 200% zoom without hiding the active recovery control."
    test: "At browser UI zoom 200%, exercise long sharing lists and authentication/recovery at narrow and wide windows, keyboard through all controls."
    expected: "Vertical scrolling keeps focus and fixed recovery/share actions visible and operable without horizontal clipping."
    why_human: "Native 200% zoom unobserved; H2."
  - truth: "The completed interface satisfies all 39 UI state predicates and retains accepted native canvas/mind-map/image behaviors."
    test: "At browser UI zoom 200%, exercise long sharing lists and authentication/recovery at narrow and wide windows, keyboard through all controls."
    expected: "Vertical scrolling keeps focus and fixed recovery/share actions visible and operable without horizontal clipping."
    why_human: "Aggregate 39-predicate assertion includes native zoom predicates not observed; H2. Native environment limits H3–H6 remain explicit."
prohibitions:
  - statement: "Explicit Dali sign-out MUST NOT silently sign the member back in or terminate their provider-wide session."
    verification: test
    status: verified
    flagged: false
    enforcement_evidence: []
    disposition: User explicitly accepted UAT item 7 on 2026-09-24; no wired automated descriptor claimed.
  - statement: "Pending access MUST NOT be presented as an emailed invitation or active membership before verified internal sign-in."
    verification: test
    status: unverified
    flagged: true
    enforcement_evidence: []
  - statement: "Selected local copying MUST NOT silently upload unselected browser boards or delete original local documents or images."
    verification: test
    status: unverified
    flagged: true
    enforcement_evidence: []
    acceptance_disposition: skipped_by_user
    disposition: User waived optional local-copy human acceptance on 2026-09-24; retained implementation safety rules and existing regression coverage remain required.
  - statement: "Public artifacts MUST NOT contain operator-specific identity settings, real organizational content, credentials or real-provider evidence."
    verification: judgment
    status: verified
    flagged: false
    enforcement_evidence: []
    disposition: Scoped judgment review in 03-UAT-REVIEW.md on 2026-09-24; publication recheck remains required.
human_verification:
  - name: "Actual configured Okta-compatible provider"
    test: "Complete docs/access-acceptance.md A1–A9 using private operator-controlled registration, assignments, claim mapping and settings."
    expected: "Stable issuer+subject identity, trusted internal verified email, denied identity rejection, pending activation once, grants/revocation, deep target, persistent absolute session, same-account recovery and deliberate Dali-only logout."
    why_human: "The signed synthetic provider proves protocol/application behavior; no actual provider configuration or acceptance result was supplied."
  - name: "Native 200% browser zoom"
    test: "At browser UI zoom 200%, exercise long sharing lists and authentication/recovery at narrow and wide windows, keyboard through all controls."
    expected: "Vertical scrolling keeps focus and fixed recovery/share actions visible and operable without horizontal clipping."
    why_human: "Viewport resizing, short viewport and CSS scaling evidence do not establish native browser zoom."
  - name: "Genuine BFCache restoration"
    test: "Navigate away from an authorized board, revoke or change its identity/access, then restore a genuinely persisted history entry and record pageshow.persisted true."
    expected: "Protected content stays paused until fresh session and descriptor authorization; no stale image, content or outbox replay crosses identity or role."
    why_human: "All five final real-history cases took ordinary reload. Constructed persisted pageshow verifies the handler but does not prove an actual browser restoration."
  - name: "Native OS IME"
    test: "Use an actual OS composition session in inline title, native topic, sharing and recovery; expire or change access mid-composition."
    expected: "Enter during composition does not commit accidentally, readonly recovery blocks writes, and acknowledged same-account resume restores the exact permitted edit range."
    why_human: "Automated composition events exercise application handlers without an OS IME."
  - name: "Assistive-technology speech and interaction"
    test: "Use a screen reader through login/recovery, library, sharing, named destructive confirmation and copy progress."
    expected: "Names, role/access state, errors, progress and resume announcements are understandable; focus remains contained and returns appropriately."
    why_human: "DOM ARIA, focus and contrast assertions do not demonstrate the spoken experience."
  - name: "Firefox/WebKit native clipboard"
    test: "Use OS copy/paste with native text, image and mind-map data as Editor and Viewer in Firefox and WebKit, including delayed completion after access loss."
    expected: "Permitted copy/paste preserves content; Viewer and stale scope cannot mutate or write backend data."
    why_human: "Final engine annotations distinguish clipboard payload-route simulation from native OS clipboard observation."
  - name: "03-02 prohibition resolution"
    test: "Explicitly review and resolve: Explicit Dali sign-out MUST NOT silently sign the member back in or terminate their provider-wide session."
    expected: "Record human disposition or provide a wired enforcement descriptor and reverify."
    why_human: "Descriptor-less test prohibition; semantic test coverage does not supply the missing enforcement contract."
  - name: "03-07 prohibition resolution"
    test: "Explicitly review and resolve: Pending access MUST NOT be presented as an emailed invitation or active membership before verified internal sign-in."
    expected: "Record human disposition or provide a wired enforcement descriptor and reverify."
    why_human: "Descriptor-less test prohibition; semantic test coverage does not supply the missing enforcement contract."
  - name: "03-11 prohibition resolution"
    test: "Explicitly review and resolve: Selected local copying MUST NOT silently upload unselected browser boards or delete original local documents or images."
    expected: "Record human disposition or provide a wired enforcement descriptor and reverify."
    why_human: "Descriptor-less test prohibition; semantic test coverage does not supply the missing enforcement contract."
  - name: "03-12 prohibition resolution"
    test: "Explicitly review and resolve: Public artifacts MUST NOT contain operator-specific identity settings, real organizational content, credentials or real-provider evidence."
    expected: "Record human disposition or provide a wired enforcement descriptor and reverify."
    why_human: "Descriptor-less judgment prohibition; semantic test coverage does not supply the missing enforcement contract."
---

> Acceptance update, 2026-09-24: [03-UAT.md](03-UAT.md) records five user passes and one scoped privacy-review pass, two approved deferrals, a user waiver for optional local-copy human acceptance (03-11), and one pending disposition (03-07). The two technically flagged prohibitions retain their evidence status; one is waived for human acceptance. [03-UAT-REVIEW.md](03-UAT-REVIEW.md) details export analysis and privacy scope. The score, covered digest and automated evidence below are the historical verification; this update does not claim a new full gate. Human-verification entries below describe the original checks, with current dispositions in the UAT file.


# Phase 3: Okta and Board Access Verification Report

**Goal:** As a member of the internal team, I want to sign in through Okta, find my authorized boards and work within owner-controlled permissions, so that board content and images are available only to their owners and members granted access.

**Status: human_needed. Score: 99/104.** Initial Phase 3 verification; no preceding Phase 3 VERIFICATION existed. Four detailed truths are present and wired but have unobserved native behavior; roadmap authentication acceptance remains uncertain for the actual provider. No implementation blocker was established. Four additional prohibitions remain prominently **unverified-prohibition — human review recommended**. They are separate from the truth denominator.

## User Flow Coverage

| Step | Expected | Evidence | Status |
|---|---|---|---|
| Authenticate | Configured internal member enters through OIDC; protected data requires a valid session | Real signed synthetic provider → callback → validated identity → opaque SQL session → AuthBoundary; 17-check independent protocol self-test and final auth cases | VERIFIED in synthetic environment; actual-provider acceptance UNCERTAIN (H1) |
| Find authorized boards | Home shows only accessible boards with authoritative roles/access labels | BoardLibrary fetch and validated summaries from owner/grant SQL filtering; direct targets require fresh descriptor | VERIFIED |
| Create/open/edit | Creator owns private board; editor uses native canvas; viewer reads with zero writes | Bound root/content adapter, image source, immutable runtime scope and native mutation guards; independent role contexts and unchanged-state canaries | VERIFIED |
| Control access | Owner grants pending/internal Viewer or explicit Editor and revokes access | Owner-only transactional routes, identity activation, revision checks and idempotent receipts; sharing UI and server/browser tests | VERIFIED |
| Recover safely | Expiry preserves bytes before redirect; same account and fresh write permission precede replay | Durable outbox and runtime suspension, blobs-before-documents replay, exact native focus recovery | VERIFIED for exercised transitions; genuine BFCache and native input/zoom remain H2–H6 |
| Sign out | Preserve pending work, destroy Dali session, remain deliberately signed out | session interruption/preservation → POST logout → SQL session deletion; no provider logout dispatch | VERIFIED behavior; separate prohibition enforcement disposition remains H7 |

The installed MVP validator accepts the goal after the authorized equivalent role wording change from “As an internal member” to “As a member of the internal team”. Its grammar requires the literal “As a”; the remaining goal words and scope are unchanged. No requirement was narrowed. Technical evidence below covers the completed implementation and records the incomplete environmental acceptance.

## Observable Truths

Five roadmap criteria and all 99 detailed plan truths were retained (104 total). Detailed boundary/UI predicates add checks to the roadmap contract; no source was dropped to improve the score. Evidence references source plus the final executed gate, rather than SUMMARY claims.

| ID | Truth | Status | Evidence |
|---|---|---|---|
| SC1 | A member can sign in through configurable OIDC SSO with Okta compatibility and sign out. Public validation uses synthetic settings; operator-specific validation and evidence remain outside the public repository. (AUTH-01) | UNCERTAIN (WARNING) | `server/auth/{oidc,session-store,identity-policy}.ts`, `src/auth/AuthBoundary.tsx`; state/nonce/PKCE, single-use browser transaction, exact issuer+subject, absolute SQL expiry and deliberate local logout. Server OIDC/session tests and auth browser cases passed. Actual operator setup and A1–A9 acceptance are absent; H1. |
| SC2 | A signed-in member can create a named board and reopen an authorized board from the home view. (BOARD-01) | VERIFIED | `server/boards/routes.ts`, `src/boards/BoardLibrary.tsx`; filtered SQL catalog, owner precedence, stable updated/id order, validated summaries and protected thumbnail bytes. Library server and board-library browser cases passed. |
| SC3 | The home view distinguishes private and shared boards and displays the member's role for each accessible board. (BOARD-02) | VERIFIED | `server/boards/routes.ts`, `src/boards/BoardLibrary.tsx`; filtered SQL catalog, owner precedence, stable updated/id order, validated summaries and protected thumbnail bytes. Library server and board-library browser cases passed. |
| SC4 | A board owner can grant an internal member editor or viewer access and revoke that grant. (BOARD-03) | VERIFIED | `server/boards/grants.ts`, `src/boards/ShareBoardDialog.tsx`, OIDC activation; owner-only fresh authorization, verified canonical identity, single binding, revision/operation reconciliation. grants server and board-sharing browser cases passed. |
| SC5 | In separate authenticated contexts, editors can modify board content, viewers can read it but cannot change it through either the interface or direct requests, and members without access cannot retrieve the board or its images through direct document, synchronization, or image requests. (BOARD-04) | VERIFIED | `server/boards/{documents,blobs,routes}.ts`, account sources; bound IDs, current session/capability and transactional rechecks, bounded decoded images and atomic Yjs merge. Server access and independent access-boundaries denial/no-change cases passed. |
| 03-01-01 | D-01/D-04: The signed synthetic OIDC harness exercises the same configured protocol/session boundary as the application without adding a production login bypass. | VERIFIED | `tests/oidc-provider.ts`, `tests/access-fixtures.ts`, `vitest.server.config.ts`; real signed discovery/token/UserInfo, SQLite tests, no production fixture import. Independent 17-check self-test passed.  |
| 03-01-02 | Server verification starts with a real SQLite transaction and fails on empty test selection. | VERIFIED | `tests/oidc-provider.ts`, `tests/access-fixtures.ts`, `vitest.server.config.ts`; real signed discovery/token/UserInfo, SQLite tests, no production fixture import. Independent 17-check self-test passed.  |
| 03-02-01 | D-01: Ordinary signed-out entry starts configured OIDC directly, retains a validated local board/new-board intent and shows protected content only after authentication. | VERIFIED | `server/auth/{oidc,session-store,identity-policy}.ts`, `src/auth/AuthBoundary.tsx`; state/nonce/PKCE, single-use browser transaction, exact issuer+subject, absolute SQL expiry and deliberate local logout. Server OIDC/session tests and auth browser cases passed.  |
| 03-02-02 | D-03: Explicit logout destroys only the Dali session and stays on a signed-out page until Sign in again. | VERIFIED | `server/auth/{oidc,session-store,identity-policy}.ts`, `src/auth/AuthBoundary.tsx`; state/nonce/PKCE, single-use browser transaction, exact issuer+subject, absolute SQL expiry and deliberate local logout. Server OIDC/session tests and auth browser cases passed.  |
| 03-02-03 | D-04: An unexpired persistent opaque Dali session survives browser restart and expires at the configured absolute time. | VERIFIED | `server/auth/{oidc,session-store,identity-policy}.ts`, `src/auth/AuthBoundary.tsx`; state/nonce/PKCE, single-use browser transaction, exact issuer+subject, absolute SQL expiry and deliberate local logout. Server OIDC/session tests and auth browser cases passed.  |
| 03-02-04 | AUTH-01 empty: absent or incomplete OIDC configuration produces a recoverable configuration error; missing state, nonce, code or required identity claims establishes no session. | VERIFIED | `server/auth/{oidc,session-store,identity-policy}.ts`, `src/auth/AuthBoundary.tsx`; state/nonce/PKCE, single-use browser transaction, exact issuer+subject, absolute SQL expiry and deliberate local logout. Server OIDC/session tests and auth browser cases passed.  |
| 03-02-05 | AUTH-01 encoding: canonical member identity uses the exact validated issuer and subject; email or display-name changes do not create an automatic identity merge. | VERIFIED | `server/auth/{oidc,session-store,identity-policy}.ts`, `src/auth/AuthBoundary.tsx`; state/nonce/PKCE, single-use browser transaction, exact issuer+subject, absolute SQL expiry and deliberate local logout. Server OIDC/session tests and auth browser cases passed.  |
| 03-02-06 | AUTH-01 precision: session expiry uses one documented time unit with safe finite integer validation; zero, negative, NaN, overflow and clock-boundary tests fail closed. | VERIFIED | `server/auth/{oidc,session-store,identity-policy}.ts`, `src/auth/AuthBoundary.tsx`; state/nonce/PKCE, single-use browser transaction, exact issuer+subject, absolute SQL expiry and deliberate local logout. Server OIDC/session tests and auth browser cases passed.  |
| 03-02-07 | AUTH-01 idempotency: an authorization callback is single-use, repeated sign-out is harmless, and explicit sign-out remains signed out until Sign in again is chosen. | VERIFIED | `server/auth/{oidc,session-store,identity-policy}.ts`, `src/auth/AuthBoundary.tsx`; state/nonce/PKCE, single-use browser transaction, exact issuer+subject, absolute SQL expiry and deliberate local logout. Server OIDC/session tests and auth browser cases passed.  |
| 03-02-08 | UI-AUTH-loading: Authentication and board-entry progress remains visible until authorization finishes, with protected content unmounted. | VERIFIED | `server/auth/{oidc,session-store,identity-policy}.ts`, `src/auth/AuthBoundary.tsx`; state/nonce/PKCE, single-use browser transaction, exact issuer+subject, absolute SQL expiry and deliberate local logout. Server OIDC/session tests and auth browser cases passed.  |
| 03-03-01 | D-05: Every created board is private and owned by its authenticated creator. | VERIFIED | `server/boards/routes.ts`, `src/boards/BoardLibrary.tsx`; filtered SQL catalog, owner precedence, stable updated/id order, validated summaries and protected thumbnail bytes. Library server and board-library browser cases passed.  |
| 03-03-02 | D-13: Home presents authorized boards; inaccessible or absent explicit targets use the same denied state without selecting or creating another board. | VERIFIED | `server/boards/routes.ts`, `src/boards/BoardLibrary.tsx`; filtered SQL catalog, owner precedence, stable updated/id order, validated summaries and protected thumbnail bytes. Library server and board-library browser cases passed.  |
| 03-03-03 | D-14: All, Mine and Shared with me show authoritative private/shared/pending labels and Owner/Editor/Viewer roles in stable recent-first order. | VERIFIED | `server/boards/routes.ts`, `src/boards/BoardLibrary.tsx`; filtered SQL catalog, owner precedence, stable updated/id order, validated summaries and protected thumbnail bytes. Library server and board-library browser cases passed.  |
| 03-03-04 | BOARD-01 adjacency: boards with identical titles retain distinct stable IDs and independent documents, images and grants. | VERIFIED | `server/boards/routes.ts`, `src/boards/BoardLibrary.tsx`; filtered SQL catalog, owner precedence, stable updated/id order, validated summaries and protected thumbnail bytes. Library server and board-library browser cases passed.  |
| 03-03-05 | BOARD-01 empty: an empty library offers board creation; blank new titles produce Untitled board; missing or unauthorized board IDs never create a fallback board. | VERIFIED | `server/boards/routes.ts`, `src/boards/BoardLibrary.tsx`; filtered SQL catalog, owner precedence, stable updated/id order, validated summaries and protected thumbnail bytes. Library server and board-library browser cases passed.  |
| 03-03-06 | BOARD-01 ordering: the library sorts updated time descending with a stable board-ID tie breaker. | VERIFIED | `server/boards/routes.ts`, `src/boards/BoardLibrary.tsx`; filtered SQL catalog, owner precedence, stable updated/id order, validated summaries and protected thumbnail bytes. Library server and board-library browser cases passed.  |
| 03-03-07 | BOARD-02 adjacency: an accessible board appears once even when ownership and a redundant membership record coexist; ownership determines the displayed role. | VERIFIED | `server/boards/routes.ts`, `src/boards/BoardLibrary.tsx`; filtered SQL catalog, owner precedence, stable updated/id order, validated summaries and protected thumbnail bytes. Library server and board-library browser cases passed.  |
| 03-03-08 | BOARD-02 empty: All, Mine and Shared with me each have an accessible empty state with no unauthorized metadata or thumbnails. | VERIFIED | `server/boards/routes.ts`, `src/boards/BoardLibrary.tsx`; filtered SQL catalog, owner precedence, stable updated/id order, validated summaries and protected thumbnail bytes. Library server and board-library browser cases passed.  |
| 03-03-09 | BOARD-02 encoding: role and access labels use stable enums and visible text; long Unicode titles retain an accessible full name. | VERIFIED | `server/boards/routes.ts`, `src/boards/BoardLibrary.tsx`; filtered SQL catalog, owner precedence, stable updated/id order, validated summaries and protected thumbnail bytes. Library server and board-library browser cases passed.  |
| 03-03-10 | BOARD-02 ordering: all library filters retain the same updated-time-descending, board-ID tie-break ordering. | VERIFIED | `server/boards/routes.ts`, `src/boards/BoardLibrary.tsx`; filtered SQL catalog, owner precedence, stable updated/id order, validated summaries and protected thumbnail bytes. Library server and board-library browser cases passed.  |
| 03-03-11 | UI-HOME-empty: Each empty library filter shows its own Copywriting Contract state and a usable route to create or view boards. | VERIFIED | `server/boards/routes.ts`, `src/boards/BoardLibrary.tsx`; filtered SQL catalog, owner precedence, stable updated/id order, validated summaries and protected thumbnail bytes. Library server and board-library browser cases passed.  |
| 03-03-12 | UI-HOME-loading: Library loading shows noninteractive placeholders and preserves the active filter while refreshing. | VERIFIED | `server/boards/routes.ts`, `src/boards/BoardLibrary.tsx`; filtered SQL catalog, owner precedence, stable updated/id order, validated summaries and protected thumbnail bytes. Library server and board-library browser cases passed.  |
| 03-03-13 | UI-HOME-error: Library failure exposes Try again and does not render inaccessible cached cards. | VERIFIED | `server/boards/routes.ts`, `src/boards/BoardLibrary.tsx`; filtered SQL catalog, owner precedence, stable updated/id order, validated summaries and protected thumbnail bytes. Library server and board-library browser cases passed.  |
| 03-03-14 | UI-HOME-populated: Every authorized card displays title, preview or placeholder, updated time, access status and current role. | VERIFIED | `server/boards/routes.ts`, `src/boards/BoardLibrary.tsx`; filtered SQL catalog, owner precedence, stable updated/id order, validated summaries and protected thumbnail bytes. Library server and board-library browser cases passed.  |
| 03-03-15 | UI-HOME-partial: A missing preview uses Preview unavailable; missing role or identity prevents an actionable card until refresh. | VERIFIED | `server/boards/routes.ts`, `src/boards/BoardLibrary.tsx`; filtered SQL catalog, owner precedence, stable updated/id order, validated summaries and protected thumbnail bytes. Library server and board-library browser cases passed.  |
| 03-03-16 | UI-HOME-overflow: Library cards and actions reflow to one column at 490px with no horizontal page scrolling. | VERIFIED | `server/boards/routes.ts`, `src/boards/BoardLibrary.tsx`; filtered SQL catalog, owner precedence, stable updated/id order, validated summaries and protected thumbnail bytes. Library server and board-library browser cases passed.  |
| 03-03-17 | UI-HOME-zero-one-many: Zero, one and 50 boards retain the specified empty state, normal card width and responsive grid respectively. | VERIFIED | `server/boards/routes.ts`, `src/boards/BoardLibrary.tsx`; filtered SQL catalog, owner precedence, stable updated/id order, validated summaries and protected thumbnail bytes. Library server and board-library browser cases passed.  |
| 03-03-18 | UI-HOME-long-text: Card titles retain a full accessible name and keyboard/touch disclosure beyond two visible lines, including 200-character Unicode titles. | VERIFIED | `server/boards/routes.ts`, `src/boards/BoardLibrary.tsx`; filtered SQL catalog, owner precedence, stable updated/id order, validated summaries and protected thumbnail bytes. Library server and board-library browser cases passed.  |
| 03-04-01 | Authorized members read only the selected board's root/content documents and associated images; editors and owners commit changes through the same board-bound path. | VERIFIED | `server/boards/{documents,blobs,routes}.ts`, account sources; bound IDs, current session/capability and transactional rechecks, bounded decoded images and atomic Yjs merge. Server access and independent access-boundaries denial/no-change cases passed.  |
| 03-04-02 | BOARD-04 authorization is checked again in the transaction that commits every mutation, including document synchronization, image writes and metadata. | VERIFIED | `server/boards/{documents,blobs,routes}.ts`, account sources; bound IDs, current session/capability and transactional rechecks, bounded decoded images and atomic Yjs merge. Server access and independent access-boundaries denial/no-change cases passed.  |
| 03-04-03 | BOARD-04 idempotency: repeating denied document, synchronization, image or mutation requests always denies them without creating data or revealing board existence through content. | VERIFIED | `server/boards/{documents,blobs,routes}.ts`, account sources; bound IDs, current session/capability and transactional rechecks, bounded decoded images and atomic Yjs merge. Server access and independent access-boundaries denial/no-change cases passed.  |
| 03-04-04 | BOARD-04 concurrency: every protected request rechecks current session and board role; an in-flight mutation that loses access before commit cannot persist or acknowledge success. | VERIFIED | `server/boards/{documents,blobs,routes}.ts`, account sources; bound IDs, current session/capability and transactional rechecks, bounded decoded images and atomic Yjs merge. Server access and independent access-boundaries denial/no-change cases passed.  |
| 03-05-01 | One account BoardWorkspace contains exactly its authorized root and content documents, with public Workspace/Doc/WorkspaceMeta contracts and the established native store extensions. | VERIFIED | `src/canvas/account/{board-workspace,board-doc,board-meta}.ts`; two authorized documents, native extensions and stopped reader synchronization. account-workspace harness tests passed in dev; account canvas regressions passed across production engines.  |
| 03-05-02 | Account create/edit/reopen/image/mind-map/history/export paths work before broad shell migration; viewer hydration and disposal send zero writes. | VERIFIED | `src/canvas/account/{board-workspace,board-doc,board-meta}.ts`; two authorized documents, native extensions and stopped reader synchronization. account-workspace harness tests passed in dev; account canvas regressions passed across production engines.  |
| 03-05-03 | D-16: Account runtimes are keyed by account/board/generation and never expose the legacy workspace root or another identity's cached content. | VERIFIED | `src/canvas/account/{board-workspace,board-doc,board-meta}.ts`; two authorized documents, native extensions and stopped reader synchronization. account-workspace harness tests passed in dev; account canvas regressions passed across production engines.  |
| 03-06-01 | D-13: Authorized direct board links mount the proven account runtime; failed authorization shows the denied state without local fallback. | VERIFIED | `src/App.tsx`, `src/canvas/runtime.ts`, `src/boards/preferences.ts`; fresh descriptor before runtime, immutable account/board/generation, separate new-tab operation ID, image loading/denial lifecycle. account-canvas/library and native regression cases passed.  |
| 03-06-02 | D-15: File > New creates one private board in another browser tab while preserving the current board and its inline title. | VERIFIED | `src/App.tsx`, `src/canvas/runtime.ts`, `src/boards/preferences.ts`; fresh descriptor before runtime, immutable account/board/generation, separate new-tab operation ID, image loading/denial lifecycle. account-canvas/library and native regression cases passed.  |
| 03-06-03 | Account canvas uses existing native editing and Main Menu controls, with authorized loading and error states. | VERIFIED | `src/App.tsx`, `src/canvas/runtime.ts`, `src/boards/preferences.ts`; fresh descriptor before runtime, immutable account/board/generation, separate new-tab operation ID, image loading/denial lifecycle. account-canvas/library and native regression cases passed.  |
| 03-06-04 | BOARD-01 concurrency: each new-tab creation receives a distinct operation identity; interrupted creation/import keeps source local work and exposes only committed authorized copies. | VERIFIED | `src/App.tsx`, `src/canvas/runtime.ts`, `src/boards/preferences.ts`; fresh descriptor before runtime, immutable account/board/generation, separate new-tab operation ID, image loading/denial lifecycle. account-canvas/library and native regression cases passed.  |
| 03-06-05 | UI-CANVAS-empty: An authorized blank board opens with usable role-appropriate navigation and available empty-board/export guidance. | VERIFIED | `src/App.tsx`, `src/canvas/runtime.ts`, `src/boards/preferences.ts`; fresh descriptor before runtime, immutable account/board/generation, separate new-tab operation ID, image loading/denial lifecycle. account-canvas/library and native regression cases passed.  |
| 03-06-06 | UI-CANVAS-loading: Opening a board and loading images show explicit progress without temporarily enabling unauthorized mutations. | VERIFIED | `src/App.tsx`, `src/canvas/runtime.ts`, `src/boards/preferences.ts`; fresh descriptor before runtime, immutable account/board/generation, separate new-tab operation ID, image loading/denial lifecycle. account-canvas/library and native regression cases passed.  |
| 03-06-07 | UI-CANVAS-error: Missing images show a retryable placeholder; authorization rejection clears protected content and presents the access state. | VERIFIED | `src/App.tsx`, `src/canvas/runtime.ts`, `src/boards/preferences.ts`; fresh descriptor before runtime, immutable account/board/generation, separate new-tab operation ID, image loading/denial lifecycle. account-canvas/library and native regression cases passed.  |
| 03-07-01 | D-06: Owners can search established internal members or grant eligible pending internal email access; trusted verified identity activates a pending grant only once. | VERIFIED | `server/boards/grants.ts`, `src/boards/ShareBoardDialog.tsx`, OIDC activation; owner-only fresh authorization, verified canonical identity, single binding, revision/operation reconciliation. grants server and board-sharing browser cases passed.  |
| 03-07-02 | D-07: Every newly selected recipient defaults to Viewer and Editor requires explicit selection. | VERIFIED | `server/boards/grants.ts`, `src/boards/ShareBoardDialog.tsx`, OIDC activation; owner-only fresh authorization, verified canonical identity, single binding, revision/operation reconciliation. grants server and board-sharing browser cases passed.  |
| 03-07-03 | D-08: Copying a board link conveys location only and changes no grant. | VERIFIED | `server/boards/grants.ts`, `src/boards/ShareBoardDialog.tsx`, OIDC activation; owner-only fresh authorization, verified canonical identity, single binding, revision/operation reconciliation. grants server and board-sharing browser cases passed.  |
| 03-07-04 | D-12: Grant, role-change and revoke actions remain owner-only, including direct requests and commit-time races. | VERIFIED | `server/boards/grants.ts`, `src/boards/ShareBoardDialog.tsx`, OIDC activation; owner-only fresh authorization, verified canonical identity, single binding, revision/operation reconciliation. grants server and board-sharing browser cases passed.  |
| 03-07-05 | BOARD-03 adjacency: duplicate pending or active grants for one trusted internal identity converge to one effective role; owner rights cannot be replaced by a grant. | VERIFIED | `server/boards/grants.ts`, `src/boards/ShareBoardDialog.tsx`, OIDC activation; owner-only fresh authorization, verified canonical identity, single binding, revision/operation reconciliation. grants server and board-sharing browser cases passed.  |
| 03-07-06 | BOARD-03 empty: empty/invalid/external email and search with no matches do not create a grant; the owner can enter a valid internal email to create a pending Viewer grant. | VERIFIED | `server/boards/grants.ts`, `src/boards/ShareBoardDialog.tsx`, OIDC activation; owner-only fresh authorization, verified canonical identity, single binding, revision/operation reconciliation. grants server and board-sharing browser cases passed.  |
| 03-07-07 | BOARD-03 encoding: email matching follows the documented trusted-provider normalization policy; unverified, ambiguous or cross-issuer matches never activate pending grants. | VERIFIED | `server/boards/grants.ts`, `src/boards/ShareBoardDialog.tsx`, OIDC activation; owner-only fresh authorization, verified canonical identity, single binding, revision/operation reconciliation. grants server and board-sharing browser cases passed.  |
| 03-07-08 | BOARD-03 ordering: member-search and sharing lists use deterministic ordering so refresh does not arbitrarily move equal display names. | VERIFIED | `server/boards/grants.ts`, `src/boards/ShareBoardDialog.tsx`, OIDC activation; owner-only fresh authorization, verified canonical identity, single binding, revision/operation reconciliation. grants server and board-sharing browser cases passed.  |
| 03-07-09 | BOARD-03 idempotency: repeated grant/update/revoke requests have a single resulting grant state; revoking an already absent grant does not restore access. | VERIFIED | `server/boards/grants.ts`, `src/boards/ShareBoardDialog.tsx`, OIDC activation; owner-only fresh authorization, verified canonical identity, single binding, revision/operation reconciliation. grants server and board-sharing browser cases passed.  |
| 03-07-10 | BOARD-03 concurrency: grant mutations are authorized at commit time; stale owner forms or overlapping role changes cannot restore a revoked grant silently. | VERIFIED | `server/boards/grants.ts`, `src/boards/ShareBoardDialog.tsx`, OIDC activation; owner-only fresh authorization, verified canonical identity, single binding, revision/operation reconciliation. grants server and board-sharing browser cases passed.  |
| 03-07-11 | UI-SHARE-empty: Empty member queries create no grant; no matches and owner-only access show their dedicated copy and eligible pending-email path. | VERIFIED | `server/boards/grants.ts`, `src/boards/ShareBoardDialog.tsx`, OIDC activation; owner-only fresh authorization, verified canonical identity, single binding, revision/operation reconciliation. grants server and board-sharing browser cases passed.  |
| 03-07-12 | UI-SHARE-loading: Member search ignores stale responses; each access mutation has a row-scoped pending state. | VERIFIED | `server/boards/grants.ts`, `src/boards/ShareBoardDialog.tsx`, OIDC activation; owner-only fresh authorization, verified canonical identity, single binding, revision/operation reconciliation. grants server and board-sharing browser cases passed.  |
| 03-07-13 | UI-SHARE-error: Grant/search/revoke failures expose their recovery actions and preserve acknowledged access until reconciliation. | VERIFIED | `server/boards/grants.ts`, `src/boards/ShareBoardDialog.tsx`, OIDC activation; owner-only fresh authorization, verified canonical identity, single binding, revision/operation reconciliation. grants server and board-sharing browser cases passed.  |
| 03-07-14 | UI-SHARE-populated: Sharing rows distinguish Owner, Editor, Viewer and pending/active membership with owner-only modification controls. | VERIFIED | `server/boards/grants.ts`, `src/boards/ShareBoardDialog.tsx`, OIDC activation; owner-only fresh authorization, verified canonical identity, single binding, revision/operation reconciliation. grants server and board-sharing browser cases passed.  |
| 03-07-15 | UI-SHARE-partial: Incomplete or ineligible recipients disable Grant access with an inline reason; pending recipients never appear active before trusted sign-in. | VERIFIED | `server/boards/grants.ts`, `src/boards/ShareBoardDialog.tsx`, OIDC activation; owner-only fresh authorization, verified canonical identity, single binding, revision/operation reconciliation. grants server and board-sharing browser cases passed.  |
| 03-07-16 | UI-SHARE-overflow: Sharing dialog body scrolls vertically with visible fixed actions and keyboard-focused rows unobscured at 490px and 200% zoom. | PRESENT_BEHAVIOR_UNVERIFIED (WARNING) | `server/boards/grants.ts`, `src/boards/ShareBoardDialog.tsx`, OIDC activation; owner-only fresh authorization, verified canonical identity, single binding, revision/operation reconciliation. grants server and board-sharing browser cases passed. Native 200% zoom unobserved; H2. |
| 03-07-17 | UI-SHARE-zero-one-many: Zero, one and 50 access/search rows preserve owner controls, empty-state copy and operable row targets. | VERIFIED | `server/boards/grants.ts`, `src/boards/ShareBoardDialog.tsx`, OIDC activation; owner-only fresh authorization, verified canonical identity, single binding, revision/operation reconciliation. grants server and board-sharing browser cases passed.  |
| 03-07-18 | UI-SHARE-long-text: Long member emails, search values and revoke confirmations wrap without obscuring identity, role or actions. | VERIFIED | `server/boards/grants.ts`, `src/boards/ShareBoardDialog.tsx`, OIDC activation; owner-only fresh authorization, verified canonical identity, single binding, revision/operation reconciliation. grants server and board-sharing browser cases passed.  |
| 03-08-01 | D-10: Only Owner/Editor duplicate; every copy has fresh board/document IDs, private ownership by actor and zero inherited grants. | VERIFIED | `server/boards/{actions,imports}.ts`, `src/boards/operations.ts`, `BoardActionDialog.tsx`, `BoardTitleMenu.tsx`; versioned acknowledgment, grapheme limit, fresh private copies, explicit confirmation and transactional deletion. board-actions and operation-receipts tests passed.  |
| 03-08-02 | D-11: Owner/Editor rename through inline title or library dialog with common Unicode and acknowledgment rules. | VERIFIED | `server/boards/{actions,imports}.ts`, `src/boards/operations.ts`, `BoardActionDialog.tsx`, `BoardTitleMenu.tsx`; versioned acknowledgment, grapheme limit, fresh private copies, explicit confirmation and transactional deletion. board-actions and operation-receipts tests passed.  |
| 03-08-03 | D-12: Only Owner deletes; a named confirmation focuses Keep board and deletion removes associated grants/resources atomically. | VERIFIED | `server/boards/{actions,imports}.ts`, `src/boards/operations.ts`, `BoardActionDialog.tsx`, `BoardTitleMenu.tsx`; versioned acknowledgment, grapheme limit, fresh private copies, explicit confirmation and transactional deletion. board-actions and operation-receipts tests passed.  |
| 03-08-04 | D-15: Inline title, Main Menu and File > New behavior remain available in the compact authenticated shell. | VERIFIED | `server/boards/{actions,imports}.ts`, `src/boards/operations.ts`, `BoardActionDialog.tsx`, `BoardTitleMenu.tsx`; versioned acknowledgment, grapheme limit, fresh private copies, explicit confirmation and transactional deletion. board-actions and operation-receipts tests passed.  |
| 03-08-05 | BOARD-01 encoding: Unicode board titles survive creation, rename, library display and reopen without losing grapheme content within the documented title bound. | VERIFIED | `server/boards/{actions,imports}.ts`, `src/boards/operations.ts`, `BoardActionDialog.tsx`, `BoardTitleMenu.tsx`; versioned acknowledgment, grapheme limit, fresh private copies, explicit confirmation and transactional deletion. board-actions and operation-receipts tests passed.  |
| 03-08-06 | BOARD-01 idempotency: retries of one create, duplicate or import operation return the same completed board rather than creating extra copies. | VERIFIED | `server/boards/{actions,imports}.ts`, `src/boards/operations.ts`, `BoardActionDialog.tsx`, `BoardTitleMenu.tsx`; versioned acknowledgment, grapheme limit, fresh private copies, explicit confirmation and transactional deletion. board-actions and operation-receipts tests passed.  |
| 03-08-07 | UI-TITLE-empty: New blank titles use Untitled board; blank renames restore the acknowledged name. | VERIFIED | `server/boards/{actions,imports}.ts`, `src/boards/operations.ts`, `BoardActionDialog.tsx`, `BoardTitleMenu.tsx`; versioned acknowledgment, grapheme limit, fresh private copies, explicit confirmation and transactional deletion. board-actions and operation-receipts tests passed.  |
| 03-08-08 | UI-TITLE-loading: Create and rename submission disables repeated commits and reports the pending operation. | VERIFIED | `server/boards/{actions,imports}.ts`, `src/boards/operations.ts`, `BoardActionDialog.tsx`, `BoardTitleMenu.tsx`; versioned acknowledgment, grapheme limit, fresh private copies, explicit confirmation and transactional deletion. board-actions and operation-receipts tests passed.  |
| 03-08-09 | UI-TITLE-error: Failed rename retains draft input for correction; uncertain outcomes reconcile before retry. | VERIFIED | `server/boards/{actions,imports}.ts`, `src/boards/operations.ts`, `BoardActionDialog.tsx`, `BoardTitleMenu.tsx`; versioned acknowledgment, grapheme limit, fresh private copies, explicit confirmation and transactional deletion. board-actions and operation-receipts tests passed.  |
| 03-08-10 | UI-TITLE-partial: Unsubmitted name edits remain local until Save name, Enter or blur commits; Keep name or Escape preserves the acknowledged name. | VERIFIED | `server/boards/{actions,imports}.ts`, `src/boards/operations.ts`, `BoardActionDialog.tsx`, `BoardTitleMenu.tsx`; versioned acknowledgment, grapheme limit, fresh private copies, explicit confirmation and transactional deletion. board-actions and operation-receipts tests passed.  |
| 03-08-11 | UI-TITLE-long-text: Inline name inputs retain Unicode text with caret scrolling; library rename dialogs wrap labels and errors within 490px. | VERIFIED | `server/boards/{actions,imports}.ts`, `src/boards/operations.ts`, `BoardActionDialog.tsx`, `BoardTitleMenu.tsx`; versioned acknowledgment, grapheme limit, fresh private copies, explicit confirmation and transactional deletion. board-actions and operation-receipts tests passed.  |
| 03-08-12 | UI-CANVAS-overflow: Header account, role and share controls wrap instead of covering the title or canvas at 490px. | VERIFIED | `server/boards/{actions,imports}.ts`, `src/boards/operations.ts`, `BoardActionDialog.tsx`, `BoardTitleMenu.tsx`; versioned acknowledgment, grapheme limit, fresh private copies, explicit confirmation and transactional deletion. board-actions and operation-receipts tests passed.  |
| 03-08-13 | UI-CANVAS-long-text: Long board names and role/action text retain full accessible names without clipped essential controls. | VERIFIED | `server/boards/{actions,imports}.ts`, `src/boards/operations.ts`, `BoardActionDialog.tsx`, `BoardTitleMenu.tsx`; versioned acknowledgment, grapheme limit, fresh private copies, explicit confirmation and transactional deletion. board-actions and operation-receipts tests passed.  |
| 03-09-01 | D-09: Viewers can select/navigate/export PNG and PDF using existing scopes/settings; editable download requires Owner or Editor. | VERIFIED | `mutation-guard.ts`, `BlockSuiteCanvas.tsx`, `export-board.ts`; guarded native/Yjs/store/history writes and final fresh authorization before download. viewer-access and native regression cases passed; independent deferred-mutation check passed.  |
| 03-09-02 | D-10/D-11/D-12: Viewer native input cannot mutate content, rename, duplicate, delete or manage access; server checks independently reject prohibited actions. | VERIFIED | `mutation-guard.ts`, `BlockSuiteCanvas.tsx`, `export-board.ts`; guarded native/Yjs/store/history writes and final fresh authorization before download. viewer-access and native regression cases passed; independent deferred-mutation check passed.  |
| 03-09-03 | Account mutation guards cover native asynchronous clipboard, drop, history, formatting and mind-map operations, with zero-write reader behavior. | VERIFIED | `mutation-guard.ts`, `BlockSuiteCanvas.tsx`, `export-board.ts`; guarded native/Yjs/store/history writes and final fresh authorization before download. viewer-access and native regression cases passed; independent deferred-mutation check passed.  |
| 03-09-04 | UI-CANVAS-populated: Owner/Editor can edit while Viewer sees View only, navigation and permitted PNG/PDF controls. | VERIFIED | `mutation-guard.ts`, `BlockSuiteCanvas.tsx`, `export-board.ts`; guarded native/Yjs/store/history writes and final fresh authorization before download. viewer-access and native regression cases passed; independent deferred-mutation check passed.  |
| 03-10-01 | D-02: Session expiry immediately pauses all editing, secures pending document updates and image bytes before redirect, and resumes the same board only for the same identity with renewed write permission. | VERIFIED | `src/auth/session.ts`, `src/canvas/runtime.ts`, `outbox.ts`; immediate readonly scope, durable bytes before navigation, account/board isolation, blobs-before-docs replay and acknowledgment-before-delete. session-recovery cases and independent durable outbox/URL cleanup checks passed.  |
| 03-10-02 | D-03: Explicit sign-out secures pending work before leaving and remains on the signed-out page. | VERIFIED | `src/auth/session.ts`, `src/canvas/runtime.ts`, `outbox.ts`; immediate readonly scope, durable bytes before navigation, account/board isolation, blobs-before-docs replay and acknowledgment-before-delete. session-recovery cases and independent durable outbox/URL cleanup checks passed.  |
| 03-10-03 | D-16: Account caches, previews and outbox records remain isolated across identities, stale tabs and restored BFCache documents. | PRESENT_BEHAVIOR_UNVERIFIED (WARNING) | `src/auth/session.ts`, `src/canvas/runtime.ts`, `outbox.ts`; immediate readonly scope, durable bytes before navigation, account/board isolation, blobs-before-docs replay and acknowledgment-before-delete. session-recovery cases and independent durable outbox/URL cleanup checks passed. Genuine persisted BFCache restoration unobserved; H3. |
| 03-10-04 | AUTH-01 boundary: authorization accepts a session only before its configured expiry; at expiry and afterward it rejects protected reads/writes and enters the D-02 recovery state. | VERIFIED | `src/auth/session.ts`, `src/canvas/runtime.ts`, `outbox.ts`; immediate readonly scope, durable bytes before navigation, account/board isolation, blobs-before-docs replay and acknowledgment-before-delete. session-recovery cases and independent durable outbox/URL cleanup checks passed.  |
| 03-10-05 | AUTH-01 concurrency: simultaneous expiry/sign-out/account-switch events cannot replay pending board changes under a different member or a revoked role. | VERIFIED | `src/auth/session.ts`, `src/canvas/runtime.ts`, `outbox.ts`; immediate readonly scope, durable bytes before navigation, account/board isolation, blobs-before-docs replay and acknowledgment-before-delete. session-recovery cases and independent durable outbox/URL cleanup checks passed.  |
| 03-10-06 | UI-AUTH-error: Authentication, expiry-preservation and recovery failures use their Copywriting Contract recovery actions without redirect loops or unauthorized replay. | VERIFIED | `src/auth/session.ts`, `src/canvas/runtime.ts`, `outbox.ts`; immediate readonly scope, durable bytes before navigation, account/board isolation, blobs-before-docs replay and acknowledgment-before-delete. session-recovery cases and independent durable outbox/URL cleanup checks passed.  |
| 03-10-07 | UI-AUTH-overflow: Authentication and expiry content fits a 490px viewport and scrolls vertically at 200% zoom without hiding the active recovery control. | PRESENT_BEHAVIOR_UNVERIFIED (WARNING) | `src/auth/session.ts`, `src/canvas/runtime.ts`, `outbox.ts`; immediate readonly scope, durable bytes before navigation, account/board isolation, blobs-before-docs replay and acknowledgment-before-delete. session-recovery cases and independent durable outbox/URL cleanup checks passed. Native 200% zoom unobserved; H2. |
| 03-10-08 | UI-AUTH-long-text: Long account identifiers and authentication errors wrap without truncating the recovery action. | VERIFIED | `src/auth/session.ts`, `src/canvas/runtime.ts`, `outbox.ts`; immediate readonly scope, durable bytes before navigation, account/board isolation, blobs-before-docs replay and acknowledgment-before-delete. session-recovery cases and independent durable outbox/URL cleanup checks passed.  |
| 03-11-01 | D-16: Only explicitly selected legacy-local boards are copied, preserving titles, canvas/map hierarchy and referenced images; local originals and images remain intact after success, failure or retry. | VERIFIED | `server/boards/imports.ts`, `src/boards/import-local.ts`, `LocalBoardCopyDialog.tsx`; explicit selection, readonly legacy reader, reserved fresh IDs, complete manifest and transactional publication. local-board-import cases assert source bytes/membership unchanged, retries and account switches.  |
| 03-11-02 | D-05/D-16: Each completed copy is private and owned by the authenticated importer; account caches and recovery drafts never appear as legacy inventory. | VERIFIED | `server/boards/imports.ts`, `src/boards/import-local.ts`, `LocalBoardCopyDialog.tsx`; explicit selection, readonly legacy reader, reserved fresh IDs, complete manifest and transactional publication. local-board-import cases assert source bytes/membership unchanged, retries and account switches.  |
| 03-11-03 | D-16: Import publishes only after validated document plus all referenced image bytes commit atomically, and retry reuses the original operation identity. | VERIFIED | `server/boards/imports.ts`, `src/boards/import-local.ts`, `LocalBoardCopyDialog.tsx`; explicit selection, readonly legacy reader, reserved fresh IDs, complete manifest and transactional publication. local-board-import cases assert source bytes/membership unchanged, retries and account switches.  |
| 03-11-04 | UI-COPY-empty: Local-copy inventory starts with no selected boards; no local boards uses the explicit empty message. | VERIFIED | `server/boards/imports.ts`, `src/boards/import-local.ts`, `LocalBoardCopyDialog.tsx`; explicit selection, readonly legacy reader, reserved fresh IDs, complete manifest and transactional publication. local-board-import cases assert source bytes/membership unchanged, retries and account switches.  |
| 03-11-05 | UI-COPY-loading: Local-copy rows show Waiting, Copying, Copied or Failed plus completed/total progress. | VERIFIED | `server/boards/imports.ts`, `src/boards/import-local.ts`, `LocalBoardCopyDialog.tsx`; explicit selection, readonly legacy reader, reserved fresh IDs, complete manifest and transactional publication. local-board-import cases assert source bytes/membership unchanged, retries and account switches.  |
| 03-11-06 | UI-COPY-error: Inventory and copy failures remain distinct from empty results; retries preserve originals and reconcile prior attempts. | VERIFIED | `server/boards/imports.ts`, `src/boards/import-local.ts`, `LocalBoardCopyDialog.tsx`; explicit selection, readonly legacy reader, reserved fresh IDs, complete manifest and transactional publication. local-board-import cases assert source bytes/membership unchanged, retries and account switches.  |
| 03-11-07 | UI-COPY-populated: The copy dialog shows selected source titles, destination account, per-board results and links to successful private copies. | VERIFIED | `server/boards/imports.ts`, `src/boards/import-local.ts`, `LocalBoardCopyDialog.tsx`; explicit selection, readonly legacy reader, reserved fresh IDs, complete manifest and transactional publication. local-board-import cases assert source bytes/membership unchanged, retries and account switches.  |
| 03-11-08 | UI-COPY-partial: Partial copy success exposes individual results and retries only failed boards without duplicating successful copies. | VERIFIED | `server/boards/imports.ts`, `src/boards/import-local.ts`, `LocalBoardCopyDialog.tsx`; explicit selection, readonly legacy reader, reserved fresh IDs, complete manifest and transactional publication. local-board-import cases assert source bytes/membership unchanged, retries and account switches.  |
| 03-11-09 | UI-COPY-overflow: Local-copy selection/results scroll within the dialog with destination and action controls accessible at 490px. | VERIFIED | `server/boards/imports.ts`, `src/boards/import-local.ts`, `LocalBoardCopyDialog.tsx`; explicit selection, readonly legacy reader, reserved fresh IDs, complete manifest and transactional publication. local-board-import cases assert source bytes/membership unchanged, retries and account switches.  |
| 03-11-10 | UI-COPY-zero-one-many: Zero, one and many copy selections have correct disabled-action state and singular/plural progress and completion counts. | VERIFIED | `server/boards/imports.ts`, `src/boards/import-local.ts`, `LocalBoardCopyDialog.tsx`; explicit selection, readonly legacy reader, reserved fresh IDs, complete manifest and transactional publication. local-board-import cases assert source bytes/membership unchanged, retries and account switches.  |
| 03-11-11 | UI-COPY-long-text: Long local titles and destination emails wrap or expose full accessible text without pushing copy controls offscreen. | VERIFIED | `server/boards/imports.ts`, `src/boards/import-local.ts`, `LocalBoardCopyDialog.tsx`; explicit selection, readonly legacy reader, reserved fresh IDs, complete manifest and transactional publication. local-board-import cases assert source bytes/membership unchanged, retries and account switches.  |
| 03-12-01 | All five Phase 3 requirements and D-01 through D-16 have real automated evidence with separate Owner/Editor/Viewer/non-member contexts. | VERIFIED | `tests/access-boundaries.spec.ts`, `tests/accessibility-access.spec.ts`, `docs/access-acceptance.md`; separate signed identities and independent canary rereads, measured responsive/focus/contrast predicates, operator-only actual-provider checklist. Final event inventory passed; explicit environment limits retained.  |
| 03-12-02 | Synthetic protocol success and actual Okta acceptance have distinct statuses; actual provider settings, claims and evidence remain operator-controlled. | VERIFIED | `tests/access-boundaries.spec.ts`, `tests/accessibility-access.spec.ts`, `docs/access-acceptance.md`; separate signed identities and independent canary rereads, measured responsive/focus/contrast predicates, operator-only actual-provider checklist. Final event inventory passed; explicit environment limits retained.  |
| 03-12-03 | The completed interface satisfies all 39 UI state predicates and retains accepted native canvas/mind-map/image behaviors. | PRESENT_BEHAVIOR_UNVERIFIED (WARNING) | `tests/access-boundaries.spec.ts`, `tests/accessibility-access.spec.ts`, `docs/access-acceptance.md`; separate signed identities and independent canary rereads, measured responsive/focus/contrast predicates, operator-only actual-provider checklist. Final event inventory passed; explicit environment limits retained. Aggregate 39-predicate assertion includes native zoom predicates not observed; H2. Native environment limits H3–H6 remain explicit. |

**Score:** 99/104 verified; four present-but-behavior-unverified and one uncertain actual-provider truth. No overrides applied. No coincidental-reliance item was identified: production code establishes the account/role/ordering preconditions, and the synthetic provider supplies declared OIDC inputs rather than bypassing authentication. Synthetic fixture grant seeding is complemented by exercised real owner grant/activation routes.

## Required Artifacts

All 43 declared artifact entries (41 distinct paths) exist and are substantive. Installed artifact queries passed 43/43 structural checks. The independent traces below establish use and data flow beyond those checks.

| Artifact | Status | Substantive implementation / consumer |
|---|---|---|
| `vitest.server.config.ts` | VERIFIED | `tests/oidc-provider.ts`, `tests/access-fixtures.ts`, `vitest.server.config.ts`; real signed discovery/token/UserInfo, SQLite tests, no production fixture import. Independent 17-check self-test passed. |
| `tests/oidc-provider.ts` | VERIFIED | `tests/oidc-provider.ts`, `tests/access-fixtures.ts`, `vitest.server.config.ts`; real signed discovery/token/UserInfo, SQLite tests, no production fixture import. Independent 17-check self-test passed. |
| `tests/access-fixtures.ts` | VERIFIED | `tests/oidc-provider.ts`, `tests/access-fixtures.ts`, `vitest.server.config.ts`; real signed discovery/token/UserInfo, SQLite tests, no production fixture import. Independent 17-check self-test passed. |
| `server/app.ts` | VERIFIED | `server/auth/{oidc,session-store,identity-policy}.ts`, `src/auth/AuthBoundary.tsx`; state/nonce/PKCE, single-use browser transaction, exact issuer+subject, absolute SQL expiry and deliberate local logout. Server OIDC/session tests and auth browser cases passed. |
| `server/storage/database.ts` | VERIFIED | `server/auth/{oidc,session-store,identity-policy}.ts`, `src/auth/AuthBoundary.tsx`; state/nonce/PKCE, single-use browser transaction, exact issuer+subject, absolute SQL expiry and deliberate local logout. Server OIDC/session tests and auth browser cases passed. |
| `server/auth/oidc.ts` | VERIFIED | `server/auth/{oidc,session-store,identity-policy}.ts`, `src/auth/AuthBoundary.tsx`; state/nonce/PKCE, single-use browser transaction, exact issuer+subject, absolute SQL expiry and deliberate local logout. Server OIDC/session tests and auth browser cases passed. |
| `server/auth/session-store.ts` | VERIFIED | `server/auth/{oidc,session-store,identity-policy}.ts`, `src/auth/AuthBoundary.tsx`; state/nonce/PKCE, single-use browser transaction, exact issuer+subject, absolute SQL expiry and deliberate local logout. Server OIDC/session tests and auth browser cases passed. |
| `server/auth/identity-policy.ts` | VERIFIED | `server/auth/{oidc,session-store,identity-policy}.ts`, `src/auth/AuthBoundary.tsx`; state/nonce/PKCE, single-use browser transaction, exact issuer+subject, absolute SQL expiry and deliberate local logout. Server OIDC/session tests and auth browser cases passed. |
| `src/auth/AuthBoundary.tsx` | VERIFIED | `server/auth/{oidc,session-store,identity-policy}.ts`, `src/auth/AuthBoundary.tsx`; state/nonce/PKCE, single-use browser transaction, exact issuer+subject, absolute SQL expiry and deliberate local logout. Server OIDC/session tests and auth browser cases passed. |
| `server/boards/routes.ts` | VERIFIED | `server/boards/routes.ts`, `src/boards/BoardLibrary.tsx`; filtered SQL catalog, owner precedence, stable updated/id order, validated summaries and protected thumbnail bytes. Library server and board-library browser cases passed. |
| `src/boards/BoardLibrary.tsx` | VERIFIED | `server/boards/routes.ts`, `src/boards/BoardLibrary.tsx`; filtered SQL catalog, owner precedence, stable updated/id order, validated summaries and protected thumbnail bytes. Library server and board-library browser cases passed. |
| `server/boards/documents.ts` | VERIFIED | `server/boards/{documents,blobs,routes}.ts`, account sources; bound IDs, current session/capability and transactional rechecks, bounded decoded images and atomic Yjs merge. Server access and independent access-boundaries denial/no-change cases passed. |
| `server/boards/blobs.ts` | VERIFIED | `server/boards/{documents,blobs,routes}.ts`, account sources; bound IDs, current session/capability and transactional rechecks, bounded decoded images and atomic Yjs merge. Server access and independent access-boundaries denial/no-change cases passed. |
| `src/canvas/account/doc-source.ts` | VERIFIED | `server/boards/{documents,blobs,routes}.ts`, account sources; bound IDs, current session/capability and transactional rechecks, bounded decoded images and atomic Yjs merge. Server access and independent access-boundaries denial/no-change cases passed. |
| `src/canvas/account/blob-source.ts` | VERIFIED | `server/boards/{documents,blobs,routes}.ts`, account sources; bound IDs, current session/capability and transactional rechecks, bounded decoded images and atomic Yjs merge. Server access and independent access-boundaries denial/no-change cases passed. |
| `src/canvas/account/board-workspace.ts` | VERIFIED | `src/canvas/account/{board-workspace,board-doc,board-meta}.ts`; two authorized documents, native extensions and stopped reader synchronization. account-workspace harness tests passed in dev; account canvas regressions passed across production engines. |
| `src/canvas/account/board-doc.ts` | VERIFIED | `src/canvas/account/{board-workspace,board-doc,board-meta}.ts`; two authorized documents, native extensions and stopped reader synchronization. account-workspace harness tests passed in dev; account canvas regressions passed across production engines. |
| `src/canvas/account/board-meta.ts` | VERIFIED | `src/canvas/account/{board-workspace,board-doc,board-meta}.ts`; two authorized documents, native extensions and stopped reader synchronization. account-workspace harness tests passed in dev; account canvas regressions passed across production engines. |
| `tests/account-workspace-harness.ts` | VERIFIED | `src/canvas/account/{board-workspace,board-doc,board-meta}.ts`; two authorized documents, native extensions and stopped reader synchronization. account-workspace harness tests passed in dev; account canvas regressions passed across production engines. |
| `tests/account-workspace.spec.ts` | VERIFIED | `src/canvas/account/{board-workspace,board-doc,board-meta}.ts`; two authorized documents, native extensions and stopped reader synchronization. account-workspace harness tests passed in dev; account canvas regressions passed across production engines. |
| `src/canvas/runtime.ts` | VERIFIED | `src/App.tsx`, `src/canvas/runtime.ts`, `src/boards/preferences.ts`; fresh descriptor before runtime, immutable account/board/generation, separate new-tab operation ID, image loading/denial lifecycle. account-canvas/library and native regression cases passed. |
| `src/canvas/legacy-runtime.ts` | VERIFIED | `src/App.tsx`, `src/canvas/runtime.ts`, `src/boards/preferences.ts`; fresh descriptor before runtime, immutable account/board/generation, separate new-tab operation ID, image loading/denial lifecycle. account-canvas/library and native regression cases passed. |
| `src/boards/preferences.ts` | VERIFIED | `src/App.tsx`, `src/canvas/runtime.ts`, `src/boards/preferences.ts`; fresh descriptor before runtime, immutable account/board/generation, separate new-tab operation ID, image loading/denial lifecycle. account-canvas/library and native regression cases passed. |
| `tests/fixtures.ts` | VERIFIED | `src/App.tsx`, `src/canvas/runtime.ts`, `src/boards/preferences.ts`; fresh descriptor before runtime, immutable account/board/generation, separate new-tab operation ID, image loading/denial lifecycle. account-canvas/library and native regression cases passed. |
| `server/boards/grants.ts` | VERIFIED | `server/boards/grants.ts`, `src/boards/ShareBoardDialog.tsx`, OIDC activation; owner-only fresh authorization, verified canonical identity, single binding, revision/operation reconciliation. grants server and board-sharing browser cases passed. |
| `src/boards/ShareBoardDialog.tsx` | VERIFIED | `server/boards/grants.ts`, `src/boards/ShareBoardDialog.tsx`, OIDC activation; owner-only fresh authorization, verified canonical identity, single binding, revision/operation reconciliation. grants server and board-sharing browser cases passed. |
| `server/boards/grants.test.ts` | VERIFIED | `server/boards/grants.ts`, `src/boards/ShareBoardDialog.tsx`, OIDC activation; owner-only fresh authorization, verified canonical identity, single binding, revision/operation reconciliation. grants server and board-sharing browser cases passed. |
| `src/boards/BoardActionDialog.tsx` | VERIFIED | `server/boards/{actions,imports}.ts`, `src/boards/operations.ts`, `BoardActionDialog.tsx`, `BoardTitleMenu.tsx`; versioned acknowledgment, grapheme limit, fresh private copies, explicit confirmation and transactional deletion. board-actions and operation-receipts tests passed. |
| `src/header/BoardTitleMenu.tsx` | VERIFIED | `server/boards/{actions,imports}.ts`, `src/boards/operations.ts`, `BoardActionDialog.tsx`, `BoardTitleMenu.tsx`; versioned acknowledgment, grapheme limit, fresh private copies, explicit confirmation and transactional deletion. board-actions and operation-receipts tests passed. |
| `src/canvas/account/mutation-guard.ts` | VERIFIED | `mutation-guard.ts`, `BlockSuiteCanvas.tsx`, `export-board.ts`; guarded native/Yjs/store/history writes and final fresh authorization before download. viewer-access and native regression cases passed; independent deferred-mutation check passed. |
| `src/canvas/BlockSuiteCanvas.tsx` | VERIFIED | `mutation-guard.ts`, `BlockSuiteCanvas.tsx`, `export-board.ts`; guarded native/Yjs/store/history writes and final fresh authorization before download. viewer-access and native regression cases passed; independent deferred-mutation check passed. |
| `src/canvas/export-board.ts` | VERIFIED | `mutation-guard.ts`, `BlockSuiteCanvas.tsx`, `export-board.ts`; guarded native/Yjs/store/history writes and final fresh authorization before download. viewer-access and native regression cases passed; independent deferred-mutation check passed. |
| `src/canvas/account/outbox.ts` | VERIFIED | `src/auth/session.ts`, `src/canvas/runtime.ts`, `outbox.ts`; immediate readonly scope, durable bytes before navigation, account/board isolation, blobs-before-docs replay and acknowledgment-before-delete. session-recovery cases and independent durable outbox/URL cleanup checks passed. |
| `src/auth/session.ts` | VERIFIED | `src/auth/session.ts`, `src/canvas/runtime.ts`, `outbox.ts`; immediate readonly scope, durable bytes before navigation, account/board isolation, blobs-before-docs replay and acknowledgment-before-delete. session-recovery cases and independent durable outbox/URL cleanup checks passed. |
| `tests/session-recovery.spec.ts` | VERIFIED | `src/auth/session.ts`, `src/canvas/runtime.ts`, `outbox.ts`; immediate readonly scope, durable bytes before navigation, account/board isolation, blobs-before-docs replay and acknowledgment-before-delete. session-recovery cases and independent durable outbox/URL cleanup checks passed. |
| `server/boards/imports.ts` | VERIFIED | `server/boards/imports.ts`, `src/boards/import-local.ts`, `LocalBoardCopyDialog.tsx`; explicit selection, readonly legacy reader, reserved fresh IDs, complete manifest and transactional publication. local-board-import cases assert source bytes/membership unchanged, retries and account switches. |
| `src/boards/import-local.ts` | VERIFIED | `server/boards/imports.ts`, `src/boards/import-local.ts`, `LocalBoardCopyDialog.tsx`; explicit selection, readonly legacy reader, reserved fresh IDs, complete manifest and transactional publication. local-board-import cases assert source bytes/membership unchanged, retries and account switches. |
| `src/boards/LocalBoardCopyDialog.tsx` | VERIFIED | `server/boards/imports.ts`, `src/boards/import-local.ts`, `LocalBoardCopyDialog.tsx`; explicit selection, readonly legacy reader, reserved fresh IDs, complete manifest and transactional publication. local-board-import cases assert source bytes/membership unchanged, retries and account switches. |
| `tests/access-boundaries.spec.ts` | VERIFIED | `tests/access-boundaries.spec.ts`, `tests/accessibility-access.spec.ts`, `docs/access-acceptance.md`; separate signed identities and independent canary rereads, measured responsive/focus/contrast predicates, operator-only actual-provider checklist. Final event inventory passed; explicit environment limits retained. |
| `tests/accessibility-access.spec.ts` | VERIFIED | `tests/access-boundaries.spec.ts`, `tests/accessibility-access.spec.ts`, `docs/access-acceptance.md`; separate signed identities and independent canary rereads, measured responsive/focus/contrast predicates, operator-only actual-provider checklist. Final event inventory passed; explicit environment limits retained. |
| `docs/access-acceptance.md` | VERIFIED | `tests/access-boundaries.spec.ts`, `tests/accessibility-access.spec.ts`, `docs/access-acceptance.md`; separate signed identities and independent canary rereads, measured responsive/focus/contrast predicates, operator-only actual-provider checklist. Final event inventory passed; explicit environment limits retained. |

## Key Link Verification

All 28 links are WIRED. The installed key-link heuristic recognized one direct config reference and returned 27 “Target not referenced” results because these links use relative imports, dependency injection, HTTP routes, or documentation contracts. Independent call/route tracing resolves those heuristic misses; no missing link was observed.

| From | To | Mechanism | Status |
|---|---|---|---|
| `playwright.config.ts` | `tests/oidc-provider.ts` | same-origin API backend and independent provider lifecycle | WIRED |
| `package.json` | `tsconfig.server.json` | server compile and test scripts | WIRED |
| `src/auth/AuthBoundary.tsx` | `server/auth/oidc.ts` | /api/session and fixed auth routes | WIRED |
| `server/auth/oidc.ts` | `server/auth/session-store.ts` | rotated persisted session after trusted identity validation | WIRED |
| `src/boards/BoardLibrary.tsx` | `server/boards/routes.ts` | session-bound library fetch and idempotent create | WIRED |
| `src/App.tsx` | `server/boards/routes.ts` | authorize explicit board target before rendering details | WIRED |
| `src/canvas/account/doc-source.ts` | `server/boards/documents.ts` | pull/push binary update route | WIRED |
| `src/canvas/account/blob-source.ts` | `server/boards/blobs.ts` | authorized image list/get/set/delete | WIRED |
| `src/canvas/account/board-workspace.ts` | `src/canvas/account/doc-source.ts` | descriptor-bound DocEngine source | WIRED |
| `src/canvas/account/board-workspace.ts` | `src/canvas/account/blob-source.ts` | descriptor-bound BlobEngine source | WIRED |
| `src/canvas/account/board-doc.ts` | `src/canvas/extensions.ts` | StoreExtensionManager load/history lifecycle | WIRED |
| `src/App.tsx` | `src/canvas/runtime.ts` | session then descriptor then account runtime | WIRED |
| `src/canvas/BlockSuiteCanvas.tsx` | `src/canvas/account/board-workspace.ts` | proven runtime injection | WIRED |
| `src/header/Header.tsx` | `src/boards/preferences.ts` | new-tab operation identity | WIRED |
| `src/boards/ShareBoardDialog.tsx` | `server/boards/grants.ts` | owner-only grant revision operations | WIRED |
| `server/auth/oidc.ts` | `server/boards/grants.ts` | activatePendingGrants only after validated internal identity | WIRED |
| `src/boards/BoardActionDialog.tsx` | `server/boards/routes.ts` | operationId and board revision checked by backend | WIRED |
| `src/header/Header.tsx` | `src/boards/ShareBoardDialog.tsx` | owner sharing trigger and current role | WIRED |
| `src/canvas/BlockSuiteCanvas.tsx` | `src/canvas/account/mutation-guard.ts` | native command and asynchronous commit boundary | WIRED |
| `src/canvas/export-board.ts` | `server/boards/routes.ts` | editable snapshot capability gate and reader image access | WIRED |
| `src/canvas/account/outbox.ts` | `src/canvas/account/doc-source.ts` | pending update capture and server acknowledgment | WIRED |
| `src/auth/session.ts` | `src/canvas/runtime.ts` | pause/dispose/revalidate generations across tabs | WIRED |
| `src/auth/AuthBoundary.tsx` | `server/auth/oidc.ts` | same-identity and fresh-role check before replay | WIRED |
| `src/boards/import-local.ts` | `src/canvas/workspace.ts` | unchanged legacy DB and read-only inventory | WIRED |
| `src/boards/import-local.ts` | `server/boards/imports.ts` | manifest-bound staged private publication | WIRED |
| `src/boards/BoardLibrary.tsx` | `src/boards/LocalBoardCopyDialog.tsx` | distinct browser-local section | WIRED |
| `tests/access-boundaries.spec.ts` | `server/boards/routes.ts` | all protected route families and commit-time denials | WIRED |
| `docs/access-acceptance.md` | `server/auth/identity-policy.ts` | operator-owned issuer/member/email trust validation | WIRED |

The indirect paths are explicit: App fetches a fresh descriptor before runtime construction; runtime injects BoardWorkspace into the native canvas; BoardDoc receives the established extension manager through workspace construction; BoardActionDialog invokes AccountBoardAction and registered action/import routes; AuthBoundary establishes identity, then App/runtime recheck current board role before replay. outbox capture/ack hooks are supplied to document sources by runtime. The documentation link is the operator contract, not a runtime import.

## Data-Flow Trace (Level 4)

| Rendered artifact/value | Real source and route | Result |
|---|---|---|
| AuthBoundary identity/status | Validated provider issuer+subject → members and sessions SQL → GET /api/session → session state → children/recovery rendering | FLOWING |
| BoardLibrary cards/filter/role/access/order | boards LEFT JOIN grants with current account predicate → summary → GET /api/boards → validated setBoards → filter/card JSX | FLOWING |
| Card preview | Board-specific protected thumbnail route → validated PNG bytes → object URL → image; rejection aborts/revokes URL | FLOWING |
| Native canvas/root/content | Fresh board descriptor → root/content pull → SQL board_documents → Yjs apply → native store/extensions → canvas; write source returns only acknowledged commits | FLOWING |
| Native image | Board-bound key → current capability → BlobRepository composite key bytes/MIME → scoped URL; missing authorized image yields retry state | FLOWING |
| Title and action results | SQL authoritative title/revision → descriptor → acknowledged title state; draft stays separate until guarded PATCH and receipt reconciliation | FLOWING |
| Share recipients/roles/pending | Owner-only member search/grant SQL → validated result state → rows; callback trusted identity activates pending row transactionally | FLOWING |
| Local-copy inventory/results | Readonly legacy IndexedDB docs/catalog → explicit selection → native snapshot → server staging → complete manifest/transaction → returned private descriptor | FLOWING |
| Recovery status and pending work | Native pending updates/image bytes → scoped durable IndexedDB journal → preserved/replaying state → same-account fresh capability → blob/doc acknowledgment before deletion | FLOWING |
| Export output | Authorized native snapshot and verified assets or rendered presentation → fresh final account/board capability check → downloadable ZIP/PNG/PDF | FLOWING |

No displayed board data chain terminates in a production fixture or hardcoded empty array. Empty arrays/nulls are loading, denied, missing-authorized-resource, or initially empty states populated by the traced source. Memory-only staging and snapshot readers intentionally consume captured authorized bytes; they cannot fetch another board or publish before server commit. Legacy helper functions remain separate from the authenticated entrypoint.

## Behavioral Evidence and Spot-Checks

The final candidate gate was read from its raw log and event stream, not inferred from summaries. Final run ID **1789646405743-1533** contains 1,533 unique selected/completed cases, every case passed, final status passed, duration 3,426,486.701 ms. Project totals: dev 357; prod 351; prod-firefox 351; prod-webkit 351; access 123. Zero failed, timed out, skipped, interrupted or unrun cases. Earlier focused/interrupted/failing attempts in the same evidence collection are historical and were not added to this count.

| Check | Exact scope / command | Observed result | Provenance |
|---|---|---|---|
| Final smoke | Two @03-12-smoke production cases | 2/2, 27.4s | Acceptance executor's saved output, independently reconciled |
| Static checks | npm run typecheck; npm run typecheck:server | Both exit 0 | Final gate |
| Unit | npm test | 105/105, 1.28s | Final gate |
| Server | npm run test:server | 112/112, 7.68s | Final gate |
| Build | npm run build | Exit 0, 8.67s | Final gate |
| Standalone access | npm run test:access | 123/123, 4.3m | Distinct final gate stage; not additional browser-matrix cases |
| Full browser | npm run test:browser | 1533/1533, 57.1m | Exact final event run above |
| Durable pending image | npm test -- src/canvas/account/outbox.test.ts -t 'persists file bytes and MIME before reporting success and retries the same record after storage failure' | 1 passed, 175ms | Independently executed by verifier |
| Deferred native insertion | npm test -- src/canvas/account/mutation-guard.test.ts -t 'deferred insertion after account scope loss leaves exact local bytes unchanged' | 1 passed, 183ms | Independently executed by verifier |
| Object URL lifecycle | npm test -- src/canvas/account/blob-source.test.ts -t 'tears down object URLs on authorization loss and abort without backend writes' | 1 passed, 180ms | Independently executed by verifier |

The three named test commands intentionally exclude unrelated cases with -t; those filtered cases are not missing required coverage because the complete final gate separately ran them. No new full-matrix rerun was needed after a documentation-only goal wording correction.

Behavioral source scrutiny included independent four-identity/two-board canaries, denial bodies with no protected content, and owner rereads of document bytes/state vectors, image hashes, metadata and grants. Commit-race tests change access before transaction commit. Recovery tests compare exact persisted bytes/model and retained journals, rather than merely seeing a modal. Copy tests compare source/destination identities, manifests, native hierarchy, image hashes and source originals. Real production routes establish the state transitions under test; fixture data supplies synthetic identities and test input.

## Probe Execution

| Probe | Command | Result |
|---|---|---|
| Declared signed-provider protocol self-test | node .gsd/access-build/tests/oidc-provider.js --self-test | PASS: 17 passed, 0 skipped; exit 0 in verifier process |
| Conventional shell probes | scripts/**/tests/probe-*.sh discovery | None declared/found for this application phase |

The first self-test attempt could not bind its ephemeral loopback listener under the sandbox (EPERM). The authorized escalated retry passed in 0.29s. No application defect is inferred from that environment denial. This self-test covers discovery, signed exchange and UserInfo, independent identity cookies, one-use codes, issuer/audience/signature/nonce/state/time/subject rejection, PKCE/replay, fixed callback and missing protocol fields.

## Requirements and Decisions

| Requirement | Source plans | Outcome | Evidence |
|---|---|---|---|
| AUTH-01 | 01,02,06,10,12 | NEEDS HUMAN for actual provider; synthetic implementation verified | OIDC/session/identity policy, AuthBoundary, protocol and recovery tests; H1 |
| BOARD-01 | 03,04,05,06,08,10,11,12 | SATISFIED in exercised application | Private create/reopen, authoritative title, native documents/images, idempotent private copy and scoped replay |
| BOARD-02 | 03,06,07,08,12 | SATISFIED | SQL authorized catalog/owner precedence, private/shared/pending roles and UI state tests |
| BOARD-03 | 07,08,12 | SATISFIED in synthetic identity policy; actual directory mapping is H1 | Owner-only grants/revoke, Viewer default, exact canonical activation and concurrency tests |
| BOARD-04 | 01,03,04,05,06,07,08,09,10,11,12 | SATISFIED for current request and tested lifecycle boundaries; restored BFCache environment remains H3 | All protected route families, document/image canaries, mutation/read guards and current-role commit rechecks |

All five Phase 3 IDs are claimed in plan frontmatter and map to the roadmap; no orphaned requirement was found. Requirement checkboxes remain pending phase acceptance and are not used as evidence.

| Decisions | Source enforcement and behavioral evidence | Disposition |
|---|---|---|
| D-01 ordinary OIDC entry; D-03 deliberate local logout; D-04 absolute persistent session | AuthBoundary, OIDC routes and SQL session store; auth/server and recovery browser tests | VERIFIED implementation; actual provider H1; prohibition H7 |
| D-02 preserve/resume pending work | session interruption → runtime readonly/capture → durable outbox → same-account/fresh-role replay | VERIFIED tested transitions |
| D-05 private creator ownership | SQL create/import destination actor owner with zero inherited grants | VERIFIED |
| D-06 pending/established internal member; D-07 default Viewer; D-08 link location only | grants.ts trusted canonical activation; ShareBoardDialog role reset; copy link does not issue grant mutation | VERIFIED behavior; prohibition H8 |
| D-09 Viewer navigation/presentation exports | native mutation guard + final export reauthorization + independent server matrix | VERIFIED, native clipboard environment H6 |
| D-10 private independent duplicate; D-11 common rename semantics; D-12 owner grants/delete | operations/actions/imports, fresh IDs, revision/receipt paths, capability matrix | VERIFIED |
| D-13 explicit authorized target; D-14 stable filtered home; D-15 separate-tab New and compact header | App descriptor gate, SQL sorted catalog and preferences operation IDs | VERIFIED |
| D-16 isolated account/cache/local copy/BFCache | immutable runtime scope, expected-account headers, readonly legacy reader and journal filtering | VERIFIED exercised isolation/copy; genuine BFCache H3; prohibition H9 |

Installed decision-coverage query reported 16/16 honored, zero missing; independent source tracing supplies the evidence above. No live collaboration/presence or 20-user claim is made. The roadmap assigns deployment durability to Phase 4 and live collaboration to Phase 5. None of the human acceptance items below was silently deferred to those phases.

## Anti-Patterns and Independent Audit Disposition

No unresolved TBD/FIXME/XXX debt marker or disabled test marker was found in the scanned application/server/tests. No required artifact was a stub, orphan, or disconnected dynamic prop. Account adapter methods that prohibit unsupported workspace-wide operations throw explicitly; readonly source/snapshot no-op persistence is intentional isolation, covered by zero-write tests.

Independent review report retains 98 cumulative paths with zero open findings, security 31/31 closed, and UI review 24/24 on the unchanged application. Those audit results support their respective scopes; they do not replace actual provider, native zoom, OS input or assistive-technology observation. Historical failures remain in 03-REGRESSION-FIX.md and 03-12-CHECKPOINT.md, with the final successful run separately identified.

| File/area | Finding | Severity | Disposition |
|---|---|---|---|
| tests/accessibility-access.spec.ts, session-recovery.spec.ts | Real-history outcomes were ordinary reload; constructed persisted event covers handler only | WARNING | H3; no fabricated BFCache pass |
| UI-SHARE-overflow, UI-AUTH-overflow | Responsive/short viewport checks pass; actual browser 200% zoom absent | WARNING | H2 and four unverified aggregate/detail truth rows |
| Operator identity integration | No registered actual provider/claim-mapping acceptance supplied | WARNING | H1 |
| Four PLAN prohibition entries | verification tier exists without wired enforcement descriptor | WARNING | Individually flagged H7–H10 |

## Prohibition Disposition

Every item remains **unverified-prohibition — human review recommended**. Non-authoritative LLM judgment: inspected implementation and synthetic semantic assertions are consistent with each prohibition. This judgment supplies neither the missing deterministic enforcement descriptor nor explicit human resolution.

| ID | Plan/tier | Prohibition | Disposition |
|---|---|---|---|
| H7 | 03-02 / test | Explicit Dali sign-out MUST NOT silently sign the member back in or terminate their provider-wide session. | UNVERIFIED, flagged; enforcement evidence empty |
| H8 | 03-07 / test | Pending access MUST NOT be presented as an emailed invitation or active membership before verified internal sign-in. | UNVERIFIED, flagged; enforcement evidence empty |
| H9 | 03-11 / test | Selected local copying MUST NOT silently upload unselected browser boards or delete original local documents or images. | UNVERIFIED, flagged; enforcement evidence empty |
| H10 | 03-12 / judgment | Public artifacts MUST NOT contain operator-specific identity settings, real organizational content, credentials or real-provider evidence. | UNVERIFIED, flagged; enforcement evidence empty |

## Human Verification Required

### H1. Actual configured Okta-compatible provider

**Test:** Complete docs/access-acceptance.md A1–A9 using private operator-controlled registration, assignments, claim mapping and settings.

**Expected:** Stable issuer+subject identity, trusted internal verified email, denied identity rejection, pending activation once, grants/revocation, deep target, persistent absolute session, same-account recovery and deliberate Dali-only logout.

**Why human:** The signed synthetic provider proves protocol/application behavior; no actual provider configuration or acceptance result was supplied.

### H2. Native 200% browser zoom

**Test:** At browser UI zoom 200%, exercise long sharing lists and authentication/recovery at narrow and wide windows, keyboard through all controls.

**Expected:** Vertical scrolling keeps focus and fixed recovery/share actions visible and operable without horizontal clipping.

**Why human:** Viewport resizing, short viewport and CSS scaling evidence do not establish native browser zoom.

### H3. Genuine BFCache restoration

**Test:** Navigate away from an authorized board, revoke or change its identity/access, then restore a genuinely persisted history entry and record pageshow.persisted true.

**Expected:** Protected content stays paused until fresh session and descriptor authorization; no stale image, content or outbox replay crosses identity or role.

**Why human:** All five final real-history cases took ordinary reload. Constructed persisted pageshow verifies the handler but does not prove an actual browser restoration.

### H4. Native OS IME

**Test:** Use an actual OS composition session in inline title, native topic, sharing and recovery; expire or change access mid-composition.

**Expected:** Enter during composition does not commit accidentally, readonly recovery blocks writes, and acknowledged same-account resume restores the exact permitted edit range.

**Why human:** Automated composition events exercise application handlers without an OS IME.

### H5. Assistive-technology speech and interaction

**Test:** Use a screen reader through login/recovery, library, sharing, named destructive confirmation and copy progress.

**Expected:** Names, role/access state, errors, progress and resume announcements are understandable; focus remains contained and returns appropriately.

**Why human:** DOM ARIA, focus and contrast assertions do not demonstrate the spoken experience.

### H6. Firefox/WebKit native clipboard

**Test:** Use OS copy/paste with native text, image and mind-map data as Editor and Viewer in Firefox and WebKit, including delayed completion after access loss.

**Expected:** Permitted copy/paste preserves content; Viewer and stale scope cannot mutate or write backend data.

**Why human:** Final engine annotations distinguish clipboard payload-route simulation from native OS clipboard observation.

### H7. 03-02 prohibition resolution

**Test:** Explicitly review and resolve “Explicit Dali sign-out MUST NOT silently sign the member back in or terminate their provider-wide session.”

**Expected:** Record the individual human disposition or supply a wired enforcement descriptor and reverify.

**Why human:** The test-tier entry is descriptor-less. Its planned “resolved” label does not establish executable enforcement; related passing assertions cannot silently substitute for that contract.

### H8. 03-07 prohibition resolution

**Test:** Explicitly review and resolve “Pending access MUST NOT be presented as an emailed invitation or active membership before verified internal sign-in.”

**Expected:** Record the individual human disposition or supply a wired enforcement descriptor and reverify.

**Why human:** The test-tier entry is descriptor-less. Its planned “resolved” label does not establish executable enforcement; related passing assertions cannot silently substitute for that contract.

### H9. 03-11 prohibition resolution

**Current acceptance disposition (2026-09-24):** Skipped by user scope decision because optional browser-local copying is not needed. The safety prohibition and existing regression protections remain; see [03-UAT.md](03-UAT.md) (item 9 waiver). The original verification procedure below is retained as history.

**Test:** Explicitly review and resolve “Selected local copying MUST NOT silently upload unselected browser boards or delete original local documents or images.”

**Expected:** Record the individual human disposition or supply a wired enforcement descriptor and reverify.

**Why human:** The test-tier entry is descriptor-less. Its planned “resolved” label does not establish executable enforcement; related passing assertions cannot silently substitute for that contract.

### H10. 03-12 prohibition resolution

**Test:** Explicitly review and resolve “Public artifacts MUST NOT contain operator-specific identity settings, real organizational content, credentials or real-provider evidence.”

**Expected:** Record the individual human disposition or supply a wired enforcement descriptor and reverify.

**Why human:** The judgment-tier entry is descriptor-less. Its planned “resolved” label does not establish executable enforcement; related passing assertions cannot silently substitute for that contract.

## Final Disposition

There are zero proved implementation gaps and ten distinct human verification items: six environmental/integration observations and four prohibition dispositions. The overall status is **human_needed**, not passed. Task 03-12-02 remains incomplete, no 03-12-SUMMARY is created, and Phase 4 must not advance from this report. The end-of-phase operator/native checkpoint from Plan 12 is incorporated into H1–H6.

The verifier changed only this report and the explicitly authorized equivalent roadmap role phrase. Existing working-tree edits and unrelated artifacts were preserved. No source/test change, staging or commit was performed. The fingerprint was generated by the installed verification.fingerprint query over 147 root-relative files, including every Phase 3 PLAN/SUMMARY, contracts, mapped requirements, and existing files changed from the phase baseline. This report is excluded from its own digest.

_Verified: 2026-09-17. Verifier: gsd-verifier._

## Local startup delta verification — 2026-09-17

The parent reviewed the nine-file development correction at `2d0dae4` and refreshed this report after the bounded checks recorded in [03-12-CHECKPOINT.md](03-12-CHECKPOINT.md) (startup correction and test provenance). The local launcher uses signed synthetic identity and real application session/board checks, binds only loopback, retains private state outside tracked source, refuses production mode and conflicting ports, and closes its services together. Source review found no open issue in this delta. The live in-app browser reached the explicitly labeled synthetic selector and then the authenticated board library. The existing frontend/backend production authorization graph is unchanged.

Fresh evidence: four actual-command startup regression cases; 63 adjacent server tests; four existing development/production-preview sign-in and recovery cases; static checks, development compilation and a production build. The 1,533-case complete matrix, independent security review and UI review retain their original source scope at `7341672`; they are not represented as fresh full-suite reviews of this delta. The original verifier findings are retained, with all ten actual-provider/native/prohibition acceptance items still pending and status **human_needed (99/104)**. This delta was reviewed by the parent, separately from the earlier independent verifier.

The refreshed digest covers the prior verification inventory plus the development launcher, regression test, configuration, startup documentation, resolved journal and UAT checklist. Runtime secrets, private board state, real screenshots and operator settings are excluded.
