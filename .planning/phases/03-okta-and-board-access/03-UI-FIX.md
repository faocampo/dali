---
phase: 03-okta-and-board-access
review_path: .planning/phases/03-okta-and-board-access/03-UI-REVIEW.md
review_revision: 4696353
iteration: 1
findings_in_scope: 13
fixed: 13
skipped: 0
status: all_fixed
source_revision: 8320dd1
fixed_at: 2026-09-16T21:51:44Z
---

# Phase 3 UI remediation

This pass implements the thirteen approved UI-contract findings. Verification ran in the main checkout using the established sequential `isolation: none` decision. Independent review and the final browser matrix remain separate gates. Actual-provider acceptance remains pending.

## Changes and evidence

| Finding | Correction | Regression evidence |
| --- | --- | --- |
| UI-X1 | Hold sharing dismissal during active/unknown mutations; retain operation IDs and original payloads. Terminal receipt authorization loss invalidates the dialog. A separate pending-operation row keeps reconciliation reachable after a successful unrelated mutation removes the original row from the live list. | Actual POST/PATCH/DELETE commits with lost responses, Close and Escape attempts, exact original receipt, one mutation, authoritative final grants and trigger focus. Additional actual expired-session 401, changed-account 409, deleted-board 404 and concurrent two-row deletion/role-update cases. |
| UI-W1 | Exact member/Access labels, owner/link explanation, verified-account activation helper, distinct pending/active/role success, duplicate/empty/search copy and clipboard fallback announcement. | Complete sharing suite, exact-copy assertions, unchanged server grants after clipboard failure. |
| UI-W2 | Named irreversible deletion affecting everyone; exact active/pending Remove access language and Keep access. | Named delete, safe initial focus, pending removal, authoritative deletion and role-denial cases. |
| UI-W3 | Unknown library creation and new-grant outcomes say they are unconfirmed and offer Check again with the same operation. | Actual committed creation with lost response and unavailable receipt, then one original receipt and no additional POST. |
| UI-V1 | Explicit sharing border, zero inherited panel gap and 24px header/body/footer insets. | Computed border/gap/padding and inspected synthetic narrow/wide captures. |
| UI-C1 | Enabled card actions use neutral ink. | Actual enabled computed color `rgb(27, 26, 24)` on all four card actions. |
| UI-C2 | Essential fields use `#76736e`; final destructive controls use `#b23b32`. | Computed sharing/library/action field boundaries, destructive button color, sharing text contrast checks. |
| UI-T1 | Scoped 12/13/15/20px and 400/600 roles for account chrome, dialog body/headings/fields/actions, metadata and Viewer title. | Computed card/action/dialog typography and explicit Viewer title weight; authored canvas styles are outside these selectors. |
| UI-S1 | Contract spacing, 8px controls and 640px share/copy geometry with viewport-minus-32 and explicit box sizing/max width. | Exact 458px/640px dialog widths at 490px/1404px, overflow and 44px controls, fifty-row library/share/local-copy cases. |
| UI-S2 | Actionable menu links and archive success link receive 44px targets. | Actual New/Upstream source and Owner/Editor imported-board link rectangles. |
| UI-X2 | Library creation opens the acknowledged board. File New immediately renders safe DOM progress in its gesture-reserved tab and reports an unresolved failure there. | Default/named creation, original receipt reconciliation, two distinct private tabs, blocked-popup fallback and byte-stable source board. |
| UI-X3 | Stable error IDs describe title/dialog/sharing controls; library filters have a group role. | Field/row description assertions, exact filter group, retained drafts and keyboard cases. |
| UI-X4 | Route-state headings receive deliberate focus; library refresh/filter and dialog/card-action focus stay local. Recovery focus restoration remains intact. | Library initial/filter/refresh focus, auth error/logout/changed-account headings, denied headings and complete recovery suite. |

## RED and correction record

- Initial sharing lifetime RED: all three POST/PATCH/DELETE cases failed because Close remained enabled. Sharing GREEN: 14/14, 47.0s.
- Independent sharing follow-up RED: deleted-board receipt and removed-row reconciliation failed; real expired-session and changed-account cases already passed via the session observer. The same four cases and complete sharing suite passed after correction: 18/18, 53.2s.
- Library RED: both unknown-outcome copy and route-heading focus cases failed before correction. Reserved-tab RED: progress was absent before the safe DOM surface was added.
- First complete affected production run: 94/96 passed, 3.2m. The measured browser default max-width was corrected explicitly. The two-create fixture was updated to wait for completed library navigation before filling its field.
- Next complete directly affected run: 41/42 passed, 1.7m. The remaining fixture assertion counted intentionally preserved records from the first board as second-board pending work. The approved correction preserves the first board's exact departure snapshot, retains its pre-departure empty-journal oracle and requires the second board's journal to be empty.
- Final access/action/measured pass: 29/30 passed, 1.4m. Creation and the exact per-board journal oracle passed, as did all seventeen board-action cases. Only the wide screenshot's new heading-in-viewport assertion failed because scrolling window/library did not scroll every ancestor. The capture now scrolls the heading itself into view.
- Final complete measured suite: 3/3 passed, 23.5s, with inspected wide above-fold library and narrow/wide sharing, action, local-copy and recovery captures. Earlier incomplete 96-, 42- and 30-case runs are not reported as wholly passing.
- Initial receipt test authoring had an ambiguous option locator; it was corrected to the synthetic recipient before collecting the meaningful RED evidence above. An overlapping test-start attempt was refused by the occupied synthetic server and did not run cases.

## Verification

- Client and server TypeScript checks passed before the sharing commits and subsequent production passes.
- Unit tests: 102/102 in 11 files, 1.42s.
- Server tests: 110/110 in 7 files, 6.70s.
- Production browser runs each built a fresh application and server before launching Chromium. Existing chunk-size/dynamic-import build notices remain informational.
- Final client and server TypeScript checks passed. The last production build and complete measured suite passed before source commit `8320dd1`.
- Complete suites exercised across the recorded overlapping runs: `board-sharing`, `board-library`, `board-access`, `board-actions`, `accessibility-access`, `authentication`, `session-recovery`, `dali-menu`, `local-board-import`, and `community`. These are 114 distinct production cases across the focused selections, not one consolidated 114-case run. All reported failed assertions were subsequently corrected and rerun successfully.
- Ten synthetic PNG captures are retained under ignored `.gsd/acceptance-03-ui-fix/`: `synthetic-library-{490,1404}.png`, `synthetic-sharing-{490,1404}.png`, `synthetic-action-{490,1404}.png`, `synthetic-local-copy-{490,1404}.png`, and `synthetic-recovery-{490,1404}.png`. The wide library capture now includes the account header, page heading, creation controls, filters and five-column grid.
- Exact staged file list, whitespace checks and bounded privacy scan were reviewed before neutral commits. No source or test changes remain uncommitted. Synthetic listeners were confirmed stopped before releasing the exclusive slot.

The strict browser error collector, authorization-denial/source-isolation assertions, shared proxy helper and singleton-root readiness corrections remain in place. No full browser matrix was run in this fix pass. Native 200% zoom, OS IME, assistive-technology speech and genuine BFCache restoration remain pending; synthetic input/history cases do not establish those observations.

## Commits and files

- `7c8982c` — sharing lifetime and exact access copy: `src/boards/ShareBoardDialog.tsx`, `tests/board-sharing.spec.ts`, `tests/accessibility-access.spec.ts`.
- `b4877ce` — terminal and removed-row sharing receipts: `src/boards/ShareBoardDialog.tsx`, `tests/board-sharing.spec.ts`.
- `8320dd1` — approved creation, focus and access-interface contracts: the fifteen paths below.

```text
src/App.tsx
src/auth/AuthBoundary.tsx
src/boards/BoardActionDialog.tsx
src/boards/BoardLibrary.tsx
src/header/BoardTitleMenu.tsx
src/header/Header.tsx
src/index.css
tests/accessibility-access.spec.ts
tests/authentication.spec.ts
tests/board-access.spec.ts
tests/board-actions.spec.ts
tests/board-library.spec.ts
tests/community.spec.ts
tests/dali-menu.spec.ts
tests/session-recovery.spec.ts
```

The complete three-commit pass additionally changes `src/boards/ShareBoardDialog.tsx` and `tests/board-sharing.spec.ts`. The `community` navigation adaptation and exact per-board journal assertion were explicitly approved. Local-copy and archive link corrections use scoped existing CSS; their runtime modules did not need changes.

Reproduction commands used `npm run typecheck`, `npm run typecheck:server`, `npm run test`, `npm run test:server`, and `npx playwright test <the selected complete spec paths> --project=prod` with the configured browser cache. RED selections were restricted with `-g` to the new sharing-lifetime, receipt/removed-row, library-creation/focus, or two-New-command tests described above.

This report is left uncommitted for the parent. Parent-owned reviews/tracking and unrelated assets are preserved. No push, phase advancement or provider-acceptance claim is made.

## Iteration 2 — residual UI-T1, UI-C2 and UI-S1

The independent re-audit of `8320dd1` resolved ten findings and retained three styling warnings. The initial implementation claims above remain historical execution evidence; this iteration addresses the precise residuals rather than treating the earlier thirteen-item claim as independent acceptance.

**Commit:** `f2769dc` — `fix(03): align role typography focus and control borders`.

**Exact files:** `src/index.css` and `tests/accessibility-access.spec.ts`. No component logic, markup, permissions, operation handling or journal behavior changed.

- **UI-T1:** Owner/Editor/Viewer and access/status spans now use 13px/600/1.5. First identity/email spans and updated-time text retain 12px/400/1.5. Actual card metadata, fifty sharing rows and owner role/email are measured separately.
- **UI-C2:** New route headings and board-action controls receive scoped 2px `#b4451f` focus-visible outlines. The additional plain route-heading selector is limited to the root-level route surface. The measured case verifies focused library heading and rename input outline color/width.
- **UI-S1:** Neutral sharing/action/local-copy buttons have explicit 1px solid `#76736e` borders. Library header gutters are 16px at widths up to 700px and 24px above that breakpoint. Computed neutral button border widths and both horizontal header gutters are asserted at 490px/1404px.

**Verification:** client and server TypeScript checks passed. The complete three-case production measured suite passed **3/3 in 25.5s**. After narrowing the additional heading selector during review, a fresh production build and the same complete suite passed **3/3 in 25.2s**; the built stylesheet was checked for the final root-scoped selector. These two runs overlap and are not six distinct cases. No full browser matrix was run in this iteration.

Ten fresh synthetic captures are preserved in ignored `.gsd/acceptance-03-ui-fix-iteration2/`, using the same library/sharing/action/local-copy/recovery names and 490/1404 widths listed above. Visual spot inspection confirmed the narrow gutter, orange heading/input focus, flat neutral border and role-label hierarchy. Earlier iteration captures remain available separately.

The exact two-file staged diff, whitespace and bounded privacy scan passed. Commit attribution is neutral. Source/test/index/build/listener slots were released after commit, with no synthetic listeners remaining. This appended report stays uncommitted for the parent; independent UI review and final acceptance remain separate gates.

## Independent final closure

Independent code review at `f2769dc` is clean across the retained 92-file scope, with all ten cumulative code-review findings resolved. Independent UI recheck inspected the complete final CSS/test delta and ten fresh synthetic captures: 24/24, zero blockers or warnings, all thirteen original UI findings resolved. The complete browser gate and actual-provider/native acceptance remain independently tracked; targeted fixes and clean reviews alone do not complete Phase 3.
