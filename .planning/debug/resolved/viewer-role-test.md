---
status: resolved
trigger: "External account cannot log: OK. Viewer can edit: FAIL. Remove the message about mind maps."
created: 2026-09-24
updated: 2026-09-24
---

# Viewer role test

## Symptoms

- External account admission is confirmed rejected by the user.
- The account named Synthetic Viewer can edit the tested board.
- The user confirmed the board header says Owner.
- Remove the empty-canvas mind-map message.

## Current Focus

hypothesis: Confirmed. The local sign-in fixture suggested global roles, but grants are assigned per board and newly created boards belong to their creator.
test: Completed local-startup and cross-browser tests with real Owner, Editor and Viewer grants.
expecting: Verified Viewer view-only controls and unchanged model/server data; independent ownership of newly created boards remains intact.
next_action: User retest on Shared role test. Phase 3 broader human acceptance remains pending.

## Evidence

- `server/boards/routes.ts` derives authority from board ownership or an explicit board grant; creation gives ownership to the authenticated member.
- `tests/oidc-provider.ts` assigns internal membership to the synthetic Viewer identity, with no global board role claim.
- `scripts/dev-server.ts` previously created no shared role-test board or grants.
- User confirmed Owner in the tested board header.
- Existing role tests explicitly grant Viewer before testing read-only UI, native mutation paths and server denial.

## Resolution

root_cause: Misleading local role-test setup: role-named accounts had no corresponding shared board grants.
fix: Added a one-time local Shared role test board, with explicit synthetic Owner/Editor/Viewer grants. Reused canonical document initialization, preserved existing identity IDs and board data, and retained sample content/access changes on restart. Clarified per-board roles on the synthetic sign-in page and in local testing instructions. Removed empty-canvas mind-map guidance and its unused styles; updated the existing empty-state regression.
verification: Client, server and local-launcher typechecks passed. Four startup tests passed, including signed Editor/Viewer sessions on the seeded sample, rejected Viewer rename, unchanged native and authoritative content after attempted editing, and retained content/grant changes across restart. Seventy-nine authentication/authorization server tests passed. Twenty-one focused production browser cases passed in Chromium, Firefox and WebKit, covering Viewer creation/style/keyboard/clipboard/drop/history denial, navigation, Owner/Editor editing and empty/populated mind-map controls. The browser run rebuilt the production app successfully. Live local UI showed the empty canvas without guidance and the sample's active Editor/Viewer grants. External rejection was also confirmed by the user; actual-provider acceptance remains separate.

## Changed files

- `scripts/dev-role-board.ts`: one-time synthetic shared-board fixture.
- `scripts/dev-server.ts`: seed after schema initialization; sign-in instructions.
- `server/boards/routes.ts`: export the existing canonical document initializer for reuse.
- `scripts/dev-startup.test.mjs`: local role, mutation and restart regression; account-menu sign-out interaction.
- `src/canvas/MindMapInspector.tsx`, `src/index.css`: remove empty-canvas guidance.
- `tests/mindmap-accessibility.spec.ts`: update empty-state expectations, retain usable controls.
- `docs/local-role-testing.md`, `docs/access-acceptance.md`: repeatable local Viewer check.

## Scope

Local synthetic fixture setup was corrected. Production admission and per-board authorization semantics remain as approved. Existing user edits and unrelated development scripts were preserved. No real identity, session, board content, screenshot or operator configuration is included in this report.
