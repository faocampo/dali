---
mode: quick
status: complete
date: 2026-09-18
---

# Board header, menu and library refinements

Implementation commit: `3c59e71`

## Delivered behavior

| Comment | Result |
| --- | --- |
| Compact board title | Borderless label enters editing on click or keyboard activation; Enter/blur save, Escape cancels, and server acknowledgment/retry remain authoritative. |
| Role alignment | Owner, Editor and Viewer labels are vertically centered with the header controls. |
| File ordering | Import board and Export board are the final File actions, following a separator. |
| Concise menus | Visible explanatory hints removed; disabled actions retain accessible permission descriptions. |
| Account identity | Circular initials avatar and display name replace the Account caption; the account disclosure retains identity and sign-out controls. |
| Plain library heading | Your boards receives route focus without a visible outline; keyboard focus remains visible on controls. |
| Simpler cards | Full board name disclosure removed; accessible open names and native title tooltips retain full names. |
| Simpler library | Boards in this browser section removed; its existing preservation workflow remains reachable through Import > Copy local boards. |

The existing 600px header breakpoint accommodates the new identity control in a compact second row, retaining the 400px grid fallback. Library Import follows the existing 700px stacked heading layout. Controls retain 44px targets. No dependency, server, authorization or document-storage changes.

Title editing focuses and selects during the layout effect. Enter/Escape restore the title control; blur preserves the next control's focus. Validation errors clear when an unchanged/blank draft returns to the label. An uncertain rename continues reconciliation even when a refreshed title matches the draft.

## Validation

- TypeScript: `npm run typecheck` passed.
- Production: `npm run build` passed as part of the final isolated Playwright server startup.
- Affected Chromium suites: 130 distinct cases reached passing outcomes across the focused runs, covering board actions, roles, naming, menus, library, local copying, authentication, access, recovery, canvas view, shapes and topic/new-board behavior.
- Final header/menu run: 21/21 passed across Chromium, Firefox and WebKit after the focus and caret-test adjustments.
- Rendered accessibility/long-list checks: 3/3 passed across the same engines at both 490px and 1404px, including library, sharing, action and local-copy dialogs.
- Total distinct passing test/project pairs: 146 (130 Chromium, 8 Firefox, 8 WebKit), without double-counting repeated runs.
- `git diff --check` and staged privacy review passed.

The broad affected-suite checks preceded the final title-focus adjustments; the final three-engine header/menu run covers those adjustments. Earlier failed expectations and the portable keyboard correction are described below. No whole-project matrix or real-provider acceptance is claimed. The live in-app browser was inspected at 1404x998 and 490x998, including the library, File menu and account disclosure. The temporary viewport override was reset. Existing live board content was left unchanged.

Two initial regression expectations referred to the removed full-name disclosure and heading outline. Updated tests preserve full accessible titles, keyboard navigation and the new presentation. The repeated viewport check now explicitly focuses the heading before testing Tab navigation. The caret-scroll check collapses the selected title with Arrow Right, avoiding platform-dependent End-key behavior.

## Provenance and scope

The user comments amend [03-UI-SPEC.md](../../phases/03-okta-and-board-access/03-UI-SPEC.md) (header, menu and library presentation). Phase 3 remains pending the existing human acceptance checklist. Earlier full-matrix evidence retains its original revision; this task records focused follow-up validation only. Tests use synthetic identities and board content; real browser screenshots and operator settings are excluded from repository artifacts.
