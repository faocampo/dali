---
status: complete
phase: 03-okta-and-board-access
source: [03-VERIFICATION.md]
started: 2026-09-17T13:43:09.794134+00:00
updated: 2026-09-25T05:11:05.251812+00:00
---

# Phase 3 acceptance checklist

Human acceptance is complete with **seven passes, three approved skips and zero pending items**. The refreshed automated gate passed at `63f352b`: 110 unit, 116 server, 124 standalone access and 1,658 full-matrix browser cases, plus both static checks and the production build. [03-VERIFICATION.md](03-VERIFICATION.md) (current evidence and historical audit) records the accepted Phase 3 scope. Actual-provider and spoken assistive-technology acceptance retain their approved backlog dispositions. Operator settings, real identities, screenshots and protocol traces stay outside this repository.

## Current Test

[testing complete]

## Tests

The seven active acceptance items below passed. Original numbering is retained for traceability.

### 2. Native 200% browser zoom

procedure: At browser UI zoom 200%, exercise long sharing lists and authentication/recovery at narrow and wide windows, keyboard through all controls.
expected: Vertical scrolling keeps focus and fixed recovery/share actions visible and operable without horizontal clipping.
reason: Viewport resizing, short viewport and CSS scaling evidence do not establish native browser zoom.
result: pass
source: user
observed: 2026-09-24
disposition: User reported OK. Environment versions and additional protocol details were not supplied.

### 3. Genuine BFCache restoration

procedure: Navigate away from an authorized board, revoke or change its identity/access, then restore a genuinely persisted history entry and record pageshow.persisted true.
expected: Protected content stays paused until fresh session and descriptor authorization; no stale image, content or outbox replay crosses identity or role.
reason: All five final real-history cases took ordinary reload. Constructed persisted pageshow verifies the handler but does not prove an actual browser restoration.
result: pass
source: user
observed: 2026-09-24
disposition: User reported OK. Environment versions and additional protocol details were not supplied.

### 4. Native OS IME

procedure: Use an actual OS composition session in inline title, native topic, sharing and recovery; expire or change access mid-composition.
expected: Enter during composition does not commit accidentally, readonly recovery blocks writes, and acknowledged same-account resume restores the exact permitted edit range.
reason: Automated composition events exercise application handlers without an OS IME.
result: pass
source: user
observed: 2026-09-24
disposition: User reported OK. Environment versions and additional protocol details were not supplied.

### 6. Firefox/WebKit native clipboard

procedure: Use OS copy/paste with native text, image and mind-map data as Editor and Viewer in Firefox and WebKit, including delayed completion after access loss.
expected: Permitted copy/paste preserves content; Viewer and stale scope cannot mutate or write backend data.
reason: Final engine annotations distinguish clipboard payload-route simulation from native OS clipboard observation.
result: pass
source: user
observed: 2026-09-24
disposition: User reported OK. Environment versions and additional protocol details were not supplied.

### 7. 03-02 prohibition resolution

procedure: Explicitly review and resolve: Explicit Dali sign-out MUST NOT silently sign the member back in or terminate their provider-wide session.
expected: Record human disposition or provide a wired enforcement descriptor and reverify.
reason: Descriptor-less test prohibition; semantic test coverage does not supply the missing enforcement contract.
result: pass
source: user
observed: 2026-09-24
disposition: User reported OK. Environment versions and additional protocol details were not supplied.

### 8. 03-07 prohibition resolution

procedure: Explicitly review and resolve: Pending access MUST NOT be presented as an emailed invitation or active membership before verified internal sign-in.
expected: Record human disposition or provide a wired enforcement descriptor and reverify.
reason: Descriptor-less test prohibition; semantic test coverage does not supply the missing enforcement contract.
result: pass
source: user
observed: 2026-09-24
disposition: User replied "pass" after reviewing the synthetic pending-access wording and focused browser/server evidence.
agent_check: 2026-09-24 — 3/3 pending-access browser checks and 16/16 grant server tests passed. Synthetic capture reviewed; user subsequently accepted the wording. See 03-UAT-REVIEW.md.

### 10. 03-12 prohibition resolution

procedure: Explicitly review and resolve: Public artifacts MUST NOT contain operator-specific identity settings, real organizational content, credentials or real-provider evidence.
expected: Record human disposition or provide a wired enforcement descriptor and reverify.
reason: Descriptor-less judgment prohibition; semantic test coverage does not supply the missing enforcement contract.
result: pass
source: agent judgment review
observed: 2026-09-24
disposition: Scoped tracked-content and reachable-history privacy review found no prohibited operator content. See 03-UAT-REVIEW.md for evidence, exclusions and publication recheck obligations.

## Approved scope deferrals and removal

These three original items are outside current Phase 3 acceptance by explicit user decision. Their original skipped results remain visible; they are not counted as passes. Real-provider and assistive-technology checks belong to their backlog follow-ups, and the optional local-copy check belongs to the removed workflow.

### Original item 1: Actual configured Okta-compatible provider

procedure: Complete docs/access-acceptance.md A1–A9 using private operator-controlled registration, assignments, claim mapping and settings.
expected: Stable issuer+subject identity, trusted internal verified email, denied identity rejection, pending activation once, grants/revocation, deep target, persistent absolute session, same-account recovery and deliberate Dali-only logout.
reason: The signed synthetic provider proves protocol/application behavior; no actual provider configuration or acceptance result was supplied.
result: skipped
source: user
disposition: Deferred follow-up — user lacks Okta access and requested postponement. Generic OIDC code remains; real-provider acceptance is unverified.
backlog: 999.4

### Original item 5: Assistive-technology speech and interaction

procedure: Use a screen reader through login/recovery, library, sharing, named destructive confirmation and copy progress.
expected: Names, role/access state, errors, progress and resume announcements are understandable; focus remains contained and returns appropriately.
reason: DOM ARIA, focus and contrast assertions do not demonstrate the spoken experience.
result: skipped
source: user
disposition: Deferred follow-up — user requested assistive-technology speech and interaction testing move to the backlog.
backlog: 999.3

### Original item 9: 03-11 prohibition resolution

procedure: Explicitly review and resolve: Selected local copying MUST NOT silently upload unselected browser boards or delete original local documents or images.
expected: Record human disposition or provide a wired enforcement descriptor and reverify.
reason: Descriptor-less test prohibition; semantic test coverage does not supply the missing enforcement contract.
result: skipped
source: user scope decision
disposition: User does not need the optional Copy local boards workflow and waived this human acceptance step. The user subsequently requested removal of that UI. Library Import now accepts an exported board file by picker or drop and creates a new private canvas. Existing browser-local documents and images remain untouched. The earlier export analysis remains bounded evidence; this skip supplies no additional enforcement evidence.

## Summary

total: 10
passed: 7
issues: 0
pending: 0
skipped: 3
blocked: 0

## Deferred Follow-Ups

- Test 1: Actual provider configuration/acceptance — backlog 999.4; resume when operator Okta access is available.
- Test 5: Assistive-technology speech and interaction — backlog 999.3; resume with a screen reader testing session.

## Gaps

No new implementation failure was reported in this UAT update. Item 8 passed by explicit user acceptance. Item 9 is skipped by user scope decision: the optional browser-local migration workflow is not needed for acceptance. The user subsequently replaced that UI with file-based board import; source preservation and import authorization retain regression coverage. User-reported passes do not imply unreported browser versions or observation details. Human acceptance is complete within approved scope. The refreshed final automated gate passed; the two deferred items retain explicit backlog follow-up scope.

The earlier local startup defect remains resolved at `2d0dae4`; see [resolved startup journal](../../debug/resolved/local-sign-in-startup.md) (root cause and regression evidence).
