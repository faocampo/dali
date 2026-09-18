---
mode: quick
status: complete
date: 2026-09-18
---

# Refine board header, menus and library

Implement the eight supplied UI comments within the existing canvas design. Execute inline; preserve account authorization, acknowledged rename/retry behavior, legacy originals and pending Phase 3 acceptance.

1. Restore a compact borderless board title that enters editing on click or keyboard activation. Preserve Enter/blur save, Escape cancel, composition safety, errors and uncertain-operation reconciliation. Vertically align roles; show account initials and display name.
2. Place Import and Export last in File. Remove visible explanatory menu hints while retaining accessible permission descriptions. Remove the library heading focus outline and full-name disclosure, retaining full titles in the card. Remove the browser-boards section; retain its explicit copy action in a compact library Import disclosure.
3. Update affected interaction tests for the revised controls; verify rename/cancel/retry, account, menu order, library long names and local-copy access, plus responsive desktop/narrow rendering. Run static checks, build and the relevant browser suites; inspect the diff and record evidence before committing.

Implementation owners: current agent — Header, BoardTitleMenu, DaliMenu, ViewMenu, BoardLibrary, scoped index.css styles and affected browser tests. No new dependencies or backend changes. Incumbent CSS and supplied screenshots are design evidence. Live source inspection confirmed shared form styles override the title and role alignment, and programmatic heading focus adds the library border.
