# Phase 3 — UI Review

**Audited:** 2026-09-16
**Baseline:** [03-UI-SPEC.md](03-UI-SPEC.md) (approved access-interface contract, including Revision 1)
**Source:** production UI `033ecc0`; test delta `1a55d14`; documentation HEAD `e8e4a71`. HEAD and an empty `git diff 033ecc0 -- src` were independently checked.
**Screenshots:** six existing synthetic screenshots inspected at 490px and 1404px, refreshed by the acceptance executor in ignored `.gsd/acceptance-03-12/current-dev/`; six preceding `current-access/` screenshots also inspected. No screenshots committed.

## Pillar Scores

| Pillar | Score | Key finding |
| --- | --- | --- |
| Copywriting | 2/4 | Missing sharing explanations, irreversible-delete warning and honest uncertainty labels. |
| Visuals | 3/4 | Library/recovery hierarchy holds; sharing header has no inset and retains a heavy native border. |
| Color | 2/4 | Enabled card actions have 2.904:1 contrast; sharing field boundaries have 1.307:1 contrast. |
| Typography | 2/4 | Sharing and action/copy dialogs lack the contracted type system; card actions override it. |
| Spacing | 2/4 | Sharing geometry and new dialog spacing diverge; modified menu links and imported-board link miss target sizing. |
| Experience Design | 1/4 | Closing sharing discards an in-flight mutation's reconciliation identity and outcome. |

**Overall: 12/24.** One source-proved blocking interaction defect; additional contract warnings below. A passing security review or selected automated tests do not resolve these UI findings.

## Top 3 Priority Fixes

1. **UI-X1 — preserve sharing mutations through dismissal.** Hold Close/Escape until settlement, retain uncertain operation IDs, and offer explicit reconciliation before another mutation. Verify delayed POST/PATCH/DELETE responses and attempted dismissal against authoritative grants and the original receipt.
2. **UI-C1 — repair enabled card-action contrast.** Set `.board-card__actions button` to the contracted neutral ink; cover library actions in rendered contrast assertions. Their present enabled appearance resembles disabled text.
3. **UI-W1/UI-W2 — restore consequential sharing and deletion copy.** Explain verified-account activation and link permissions, distinguish pending from active success, and explicitly state deletion affects everyone and cannot be undone.

## Detailed Findings

### Pillar 1: Copywriting — 2/4

- **WARNING UI-W1:** [ShareBoardDialog.tsx](../../../src/boards/ShareBoardDialog.tsx#L119) (sharing content, lines 119–149) omits the contracted owner/link explanation and “Access starts after this person signs in with a verified internal account.” Pending recipients receive only a status label. Line 101 announces “Access updated.” for new active grants, pending grants and role changes alike. Restore the exact member-field, Access, active-success and pending-success copy, plus the two explanations. Clipboard failure at line 149 reveals a field without the contracted failure/instruction announcement. Give it explicit status text.
- **WARNING UI-W2:** [BoardActionDialog.tsx](../../../src/boards/BoardActionDialog.tsx#L36) (destructive confirmation, lines 36–41) displays the title separately and asks whether to delete documents/images/sharing, but omits “for everyone” and “This cannot be undone.” Restore the named contract confirmation. Sharing removal uses “Revoke access”/“Confirm revoke” at lines 142–147 rather than the approved “Remove access” action and full active/pending explanation.
- **WARNING UI-W3:** [BoardLibrary.tsx](../../../src/boards/BoardLibrary.tsx#L83) (creation reconciliation, lines 83–126) retains the original operation ID, but an ambiguous result says creation failed and keeps “New board.” [ShareBoardDialog.tsx](../../../src/boards/ShareBoardDialog.tsx#L71) (grant reconciliation, lines 71–104, 134–144) similarly retries an uncertain new grant under “Grant access,” whereas existing rows use “Check access.” Use the contracted unknown-outcome message and Check again without implying a confirmed failure. The internal reconciliation is useful; the user-facing state must accurately describe it.

AuthBoundary's expiry/preservation, identity-change and signed-out text follows the core contract. Local-copy helper, destination, per-row states and pluralized completion text are present in [LocalBoardCopyDialog.tsx](../../../src/boards/LocalBoardCopyDialog.tsx#L82) (copy content, lines 82–96).

### Pillar 2: Visuals — 3/4

- **WARNING UI-V1:** Both `synthetic-sharing-490.png` and `synthetic-sharing-1404.png` show Share board against the left edge of a heavy dark native dialog border, while the body begins farther inward. [index.css](../../../src/index.css#L1719) (sharing rules, lines 1719–1738) removes outer padding but gives the header no replacement inset or explicit border; the inherited panel also retains a separate gap. Apply the contracted 24px header/body rhythm and explicit 1px border. This is a visible inconsistency with the well-spaced recovery dialog, not a claim that scrolling is broken.

The narrow library screenshot establishes the heading, creation action, wrapping filters, one card column, two-line title, accessible full-title disclosure and role metadata. The desktop shot is scrolled near the end of its 50-card collection: it establishes five ordinary-width columns and the local-copy section, but cannot establish above-fold desktop heading alignment. Long sharing titles wrap fully as contracted. Recovery has a clear heading and single primary action at both widths. The already-corrected sharing Close target has explicit 44px minima at line 1723.

### Pillar 3: Color — 2/4

- **WARNING UI-C1:** [index.css](../../../src/index.css#L1477) (card-action styling, lines 1477–1485) sets enabled actions to `--board-ink-soft`, defined as `#9c978e` at line 152, over the white card. Calculated WCAG sRGB contrast is **2.904:1**. Both current library screenshots show the faint Rename/Duplicate/Share/Delete labels. The later card selector overrides the equal-specificity neutral-ink library button rule at line 1082. Use `#1b1a18` for actions and validate actual enabled computed styles.
- **WARNING UI-C2:** Sharing inputs/selects use `--board-line` (`#e3e1dc`) at line 1725, providing **1.307:1** against white; the contract prescribes `#76736e` for essential field boundaries (**4.721:1**). Screenshot role-select outlines are visibly faint. Delete and remove-access controls also lack the contracted destructive color; add explicit semantic styles to their final destructive actions.

The library ground, white surfaces and restrained primary accent broadly respect the composition target; no pixel-area 60/30/10 measurement is claimed. Accent white-text contrast computes to **5.509:1**. The provided contrast JSON files each contain 158 sharing samples with minimum **17.391:1**, but [accessibility-access.spec.ts](../../../tests/accessibility-access.spec.ts#L73) (contrast selection, lines 73–83) samples only sharing `h2,p,label,button`, excluding disabled buttons and all library actions/input boundaries. Those results cannot establish whole-interface contrast. No Tailwind color classes apply to this manual-CSS design.

### Pillar 4: Typography — 2/4

- **WARNING UI-T1:** The contracted Phase 3 distribution is 12/13/15/20px and weights 400/600. Actual card-action `font: var(--affine-font-xs)/1 ...` at [index.css](../../../src/index.css#L1485) (card font shorthand) resets the more general 13px/600/1.5 rule to **12px/400/1**. Sharing heading inherits **17px** from lines 138 and 876–879, with no 600-weight override. Sharing body and board-action/local-copy body have no explicit 15px/1.5 surface baseline; headings/strong text retain browser defaults where not scoped. Thus no compliant four-size/two-weight distribution is established. Set the four roles explicitly on these new surfaces, including button/select/input inheritance, h2 20px/600/1.2 and card actions 13px/600/1.5.

Recovery explicitly applies the body and heading contract at lines 1769–1775; library titles/metadata explicitly use 15px/600 and 12px, respectively. Authored canvas typography is outside this finding.

### Pillar 5: Spacing — 2/4

- **WARNING UI-S1:** [index.css](../../../src/index.css#L1719) (sharing geometry) uses 620px and viewport minus 24px, instead of 640px/minus 32px. It also omits `box-sizing: border-box`. New share/copy rules use 12px/20px padding and 6px radii at lines 1724–1737 and 1785–1793; board-action gap is 12px at line 1743. These violate the no-exceptions 4/8/16/24/32/48/64 spacing scale and 8px control radius. Replace these with named contract values. Preserve the already-correct 132px previews, 16px grid gap, 1240px library and narrow one-column behavior.
- **WARNING UI-S2:** Modified menu links remain covered by `min-height:40px` at line 1662, while `.djai-header button` gets 44px at line 1747. The newly added “Open imported board” link in [BlockSuiteCanvas.tsx](../../../src/canvas/BlockSuiteCanvas.tsx#L262) (archive-success action) receives no 44px target rule from `.board-action-dialog`, whose rule covers buttons only. Apply 44px sizing to all actionable menu links and the import-success link; measure rendered rectangles. This is source evidence, not a fresh runtime measurement.

### Pillar 6: Experience Design — 1/4

- **BLOCKER UI-X1:** [ShareBoardDialog.tsx](../../../src/boards/ShareBoardDialog.tsx#L109) (dismissal and mutation lifetime) allows Close at line 117 and Escape at line 109 while a grant, role update or removal is pending. Both parent call sites unmount the dialog. Cleanup at line 38 aborts the controller; the linked mutation controller aborts at lines 83–97 and the catch returns on aborted lifetime at line 94. The operation map exists only in the component ref at line 12 and is lost. [grants.ts](../../../server/boards/grants.ts#L62) (grant transaction, lines 62–108) can still commit and persist its receipt; it has no client-abort rollback. The UI therefore loses the prescribed progress/result and the ID needed to check the original uncertain request. This breaks the explicitly required reconciliation flow. It does **not** establish duplicate grants or an authorization bypass: the server has revision checks and convergent grant creation. Fix by holding dismissal until settlement and retaining uncertainty until reconciled, or lifting account/board-scoped operation state above the dialog. **Reproduction oracle:** delay POST/PATCH/DELETE after acceptance, press Close/Escape, release the server response, and reopen. Assert retained original operation identity, authoritative final result, no second logical mutation, honest progress and predictable focus. This oracle is specified for execution; this auditor did not run it.
- **WARNING UI-X2:** [BoardLibrary.tsx](../../../src/boards/BoardLibrary.tsx#L111) (create completion, lines 111–117) adds/refreshes the card and stays in the library. The contract says New board creates and opens it. Navigate to the acknowledged board only after current identity validation. [Header.tsx](../../../src/header/Header.tsx#L55) (File New, lines 55–60) reserves `about:blank` without rendering the contracted progress in that tab; populate a safe local progress surface until navigation or failure.
- **WARNING UI-X3:** [BoardTitleMenu.tsx](../../../src/header/BoardTitleMenu.tsx#L30) (inline name/error, lines 30–40), [BoardActionDialog.tsx](../../../src/boards/BoardActionDialog.tsx#L37) (name/error, lines 37–39) and sharing mutation errors at lines 135/144 omit field-to-error `aria-describedby` connections. The share field references only `share-reason`. Give error elements stable IDs and associate them with their fields/row controls. Library filters at line 130 have `aria-label` on a plain div without the specified group role; add `role="group"`.
- **WARNING UI-X4:** Route-state headings in [AuthBoundary.tsx](../../../src/auth/AuthBoundary.tsx#L58) (signed-out/error/identity states), [App.tsx](../../../src/App.tsx#L82) (denied board) and [BoardLibrary.tsx](../../../src/boards/BoardLibrary.tsx#L123) (library heading) have no transition focus effect or focusable heading. The contract requires route changes to focus the page heading. Implement deliberate heading focus while preserving the separately implemented recovery-focus restoration and post-operation card focus.

Positive source evidence: loading library cards are decorative/noninteractive; failed requests clear stale rows; empty filters have distinct actions; card actions respect roles; Viewer Import and Layers are disabled with connected explanations in [DaliMenu.tsx](../../../src/header/DaliMenu.tsx#L73) (role-aware commands). Board-operation dialogs block cancellation while busy and reconcile uncertain outcomes. Local copy persists operation IDs and waits for the active item when close is requested. Archive import exposes progress, private-copy confirmation, success link and Check import again, with dismissal blocked while busy/uncertain. Session interruption prevents Escape, preserves before redirect, separates changed identity and restores recovery focus after authorization. These do not cancel UI-X1 or establish native speech/IME/zoom behavior.

## Evidence and acceptance limits

- The screenshot safety directory and existing ignore file were checked; `git check-ignore` confirms the inspected `.gsd` image and a review-directory image are ignored. No source fixes, tests, commits, captures, listeners or browser interactions were performed by this auditor. Read/Write-named tools were unavailable; files were inspected with shell reads and this report written through the structured patch tool.
- Dev-server discovery and new capture were intentionally delegated to the exclusive acceptance runner. Its refreshed synthetic screenshots supplied the visual evidence. No native CUA or Playwright MCP was available for this audit. Desktop screenshots are scrolled, and sharing shots show a long-query/search state; local copy, archive, error/retry and destructive states were audited in source rather than pictured.
- Real browser 200% zoom, native OS IME, assistive-technology speech and genuine BFCache restoration remain unverified. Environment inaccessibility is an evidence limitation, not an implementation defect.
- The full 1462-case browser matrix was still running at handoff; no final matrix pass is claimed here. The executor reported the access project at 112/112 and initial dev cases passing; those are attributed execution claims, separate from this visual/source audit. Actual-provider acceptance remains separately open in [access-acceptance.md](../../../docs/access-acceptance.md) (operator procedure and native observations).
- Registry gate checked after scoring: no `components.json`, and the approved contract introduces no registry assets; no registry safety section or penalty applies.

## Files Audited

- AGENTS.md; project scope, requirements, roadmap and configuration; all 12 Phase 3 plans and 11 available summaries; context, approved UI contract, checkpoint, independent code review and access acceptance procedure.
- `src/index.css`; `src/boards/{BoardLibrary,ShareBoardDialog,BoardActionDialog,LocalBoardCopyDialog}.tsx`; `src/header/{Header,BoardTitleMenu,DaliMenu}.tsx`; `src/auth/AuthBoundary.tsx`; focus references in `src/auth/session.ts` and route states in `src/App.tsx`; archive and role controls in `src/canvas/BlockSuiteCanvas.tsx`.
- `server/boards/grants.ts`; receipt/create routes in `server/boards/routes.ts`; contrast and geometry selection in `tests/accessibility-access.spec.ts`.
- Synthetic library/sharing/recovery screenshots at both widths in `current-access` and `current-dev`; existing contrast JSON at both widths. These local ignored assets contain synthetic fixtures and are intentionally excluded from published artifacts.

**Recommendation count:** 13 findings: 1 blocker and 12 warnings. Three priority work packages are listed above; nine findings remain outside those packages. Re-review after remediation with fresh exact-revision evidence.
