---
status: testing
phase: 03-okta-and-board-access
source: [03-VERIFICATION.md]
started: 2026-09-17T13:43:09.794134+00:00
updated: 2026-09-17T13:43:09.794134+00:00
---

# Phase 3 acceptance checklist

The complete automated gate passed at `7341672`. Independent verification is `human_needed`, with 99/104 truths verified and no established implementation blocker. These ten items are pending observations or explicit review dispositions. Keep operator settings, real identities, screenshots and protocol traces in operator-controlled storage outside this repository. Record only generic acceptance or the failed step here.

## Current Test

number: 1
name: Actual configured Okta-compatible provider
expected: |
  Stable issuer+subject identity, trusted internal verified email, denied identity rejection, pending activation once, grants/revocation, deep target, persistent absolute session, same-account recovery and deliberate Dali-only logout.
awaiting: user response

## Tests

### 1. Actual configured Okta-compatible provider

procedure: Complete docs/access-acceptance.md A1–A9 using private operator-controlled registration, assignments, claim mapping and settings.
expected: Stable issuer+subject identity, trusted internal verified email, denied identity rejection, pending activation once, grants/revocation, deep target, persistent absolute session, same-account recovery and deliberate Dali-only logout.
reason: The signed synthetic provider proves protocol/application behavior; no actual provider configuration or acceptance result was supplied.
result: [pending]

### 2. Native 200% browser zoom

procedure: At browser UI zoom 200%, exercise long sharing lists and authentication/recovery at narrow and wide windows, keyboard through all controls.
expected: Vertical scrolling keeps focus and fixed recovery/share actions visible and operable without horizontal clipping.
reason: Viewport resizing, short viewport and CSS scaling evidence do not establish native browser zoom.
result: [pending]

### 3. Genuine BFCache restoration

procedure: Navigate away from an authorized board, revoke or change its identity/access, then restore a genuinely persisted history entry and record pageshow.persisted true.
expected: Protected content stays paused until fresh session and descriptor authorization; no stale image, content or outbox replay crosses identity or role.
reason: All five final real-history cases took ordinary reload. Constructed persisted pageshow verifies the handler but does not prove an actual browser restoration.
result: [pending]

### 4. Native OS IME

procedure: Use an actual OS composition session in inline title, native topic, sharing and recovery; expire or change access mid-composition.
expected: Enter during composition does not commit accidentally, readonly recovery blocks writes, and acknowledged same-account resume restores the exact permitted edit range.
reason: Automated composition events exercise application handlers without an OS IME.
result: [pending]

### 5. Assistive-technology speech and interaction

procedure: Use a screen reader through login/recovery, library, sharing, named destructive confirmation and copy progress.
expected: Names, role/access state, errors, progress and resume announcements are understandable; focus remains contained and returns appropriately.
reason: DOM ARIA, focus and contrast assertions do not demonstrate the spoken experience.
result: [pending]

### 6. Firefox/WebKit native clipboard

procedure: Use OS copy/paste with native text, image and mind-map data as Editor and Viewer in Firefox and WebKit, including delayed completion after access loss.
expected: Permitted copy/paste preserves content; Viewer and stale scope cannot mutate or write backend data.
reason: Final engine annotations distinguish clipboard payload-route simulation from native OS clipboard observation.
result: [pending]

### 7. 03-02 prohibition resolution

procedure: Explicitly review and resolve: Explicit Dali sign-out MUST NOT silently sign the member back in or terminate their provider-wide session.
expected: Record human disposition or provide a wired enforcement descriptor and reverify.
reason: Descriptor-less test prohibition; semantic test coverage does not supply the missing enforcement contract.
result: [pending]

### 8. 03-07 prohibition resolution

procedure: Explicitly review and resolve: Pending access MUST NOT be presented as an emailed invitation or active membership before verified internal sign-in.
expected: Record human disposition or provide a wired enforcement descriptor and reverify.
reason: Descriptor-less test prohibition; semantic test coverage does not supply the missing enforcement contract.
result: [pending]

### 9. 03-11 prohibition resolution

procedure: Explicitly review and resolve: Selected local copying MUST NOT silently upload unselected browser boards or delete original local documents or images.
expected: Record human disposition or provide a wired enforcement descriptor and reverify.
reason: Descriptor-less test prohibition; semantic test coverage does not supply the missing enforcement contract.
result: [pending]

### 10. 03-12 prohibition resolution

procedure: Explicitly review and resolve: Public artifacts MUST NOT contain operator-specific identity settings, real organizational content, credentials or real-provider evidence.
expected: Record human disposition or provide a wired enforcement descriptor and reverify.
reason: Descriptor-less judgment prohibition; semantic test coverage does not supply the missing enforcement contract.
result: [pending]

## Summary

total: 10
passed: 0
issues: 0
pending: 10
skipped: 0
blocked: 0

## Gaps

None reported in UAT yet. The pending items above remain open; no Phase 3 acceptance has been recorded.
