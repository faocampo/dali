---
type: quick
description: Compact library controls and verify internal-member admission
---

# Library controls and admission

The user approved internal-member-only sign-in, with Owner, Editor and Viewer permissions applied separately to each board.

## Tasks

1. Replace the board-card action stack with a compact accessible overflow control. Preserve role visibility, all four actions, dialog cancellation, focus restoration and keyboard access.
2. Move Import into the library header and reuse the canvas account avatar/name control at the right. Keep email and sign-out in its dropdown. Preserve the existing visual language and narrow-screen usability.
3. Verify the identity gate with signed internal and external accounts. Make the synthetic account without board grants clearly internal, and expose an explicitly external fixture that fails admission. Preserve all server-side board authorization checks.

## Validation

- Client/server static checks and relevant authentication/authorization tests.
- Browser coverage for dropdown dismissal, dialog focus, role-specific actions, Import placement, account details and external rejection.
- Inspect the library at desktop and narrow widths; verify no overflow and minimum 44-pixel controls.
- Review changes for public-repository privacy before committing. Keep Phase 3 acceptance pending.
