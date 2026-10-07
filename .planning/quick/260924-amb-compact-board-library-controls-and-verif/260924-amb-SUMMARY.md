---
quick_task: 260924-amb
status: complete
date: 2026-09-24
commits: [f224778, bfbe573]
---

# Compact library controls and internal-member admission

Implemented the four requested refinements. Phase 3 human acceptance stays pending.

## Delivered

- Board cards use a 44-pixel three-dot action disclosure beside their access/role metadata. Owners can rename, duplicate, share and delete; editors can rename and duplicate; viewers have no mutation menu. The permanent four-button stack is removed.
- The library top bar places Import and a shared initials-avatar/name account control at the right. Email and sign-out appear inside the account disclosure. The canvas uses the same account component.
- Import opens Copy local boards from the top bar. Dialogs return focus to their disclosure trigger. Disclosures support native keyboard activation, Tab navigation, Escape and outside-click/focus dismissal.
- Existing responsive breakpoints are retained. Controls keep 44-pixel targets; the account name truncates when necessary, while its accessible name and opened identity stay complete. Desktop, 490-pixel and 320-pixel layouts were inspected.

## Sign-in finding and verification

The user confirmed that only approved internal members may enter Dali, and board roles apply separately. The existing server validates the configured internal-membership claim and verified, eligible email before creating a member/session.

The synthetic account previously named “Non-member” was an internal user with no grant on other members' test boards. It is now named “Synthetic Internal Member”; its stable identity and stored boards are preserved. Synthetic identities carry explicit membership claims. A separate “Synthetic External Account” has a verified email on the accepted example domain but an external claim, and is denied without creating an authenticated session or member record. Its next sign-in attempt returns to the synthetic account picker.

These checks exercise signed synthetic OIDC. Actual operator identity-provider acceptance remains in the existing Phase 3 UAT scope.

## Validation

- Client and server TypeScript checks, server compilation, production build and whitespace checks passed.
- 105 unit tests passed.
- 113 server tests passed, including authentication, board permissions, grant races and unchanged-state denial assertions.
- 126 distinct browser/project cases passed across focused runs:
  - 9 new library/admission cases across Chromium, Firefox and WebKit.
  - 108 production workflow regressions passed. One old assertion required zero card disclosures; it was updated to validate the new actions disclosure while still rejecting the removed full-name disclosure.
  - 12 final cross-browser cases passed: that long-title/touch-target regression, both mind-map copy flows and external rejection/retry. Four cases overlap earlier runs, yielding 126 distinct passing cases.
- Visual inspection covered desktop, narrow card actions and the 320-pixel account dropdown. The Impeccable detector reported only the preexisting actual canvas grid-style preview advisory, which is appropriate for that control.
- Initial browser attempts required loopback test permissions and fresh browser binaries; neither attempt supplied application-validation evidence.
- The live local stack was restarted without clearing stored boards. Local external rejection and sign-in retry were verified separately.

## Source references

- [BoardLibrary.tsx](../../../src/boards/BoardLibrary.tsx) (library header, card actions and role-aware controls).
- [AccountMenu.tsx](../../../src/header/AccountMenu.tsx) (shared avatar and account details).
- [Dropdown.tsx](../../../src/header/Dropdown.tsx) (dismissal and focus restoration).
- [identity-policy.ts](../../../server/auth/identity-policy.ts) (existing internal-member admission gate).
- [oidc-provider.ts](../../../tests/oidc-provider.ts) (explicit synthetic internal/external claims).
- [board-library.spec.ts](../../../tests/board-library.spec.ts) (responsive, keyboard and focus checks).
- [authentication.spec.ts](../../../tests/authentication.spec.ts) (external denial and approved internal retry).
- [UI contract](../../phases/03-okta-and-board-access/03-UI-SPEC.md) (updated approved presentation behavior).

## Commits

- `f224778` — distinguish internal and external test accounts and verify rejection.
- `bfbe573` — compact card menus and shared top-bar controls with browser coverage.

Preexisting installation/startup and asset changes remain outside these commits. No user screenshots, operator settings or private runtime evidence were committed.
