# Phase 3 — UI Review

## Final scoped recheck — `f2769dc`

**Audited:** 2026-09-16. **Current overall: 24/24. Open findings: 0 blockers, 0 warnings. All 13 original findings are resolved within this audit scope.** The 21/24 and initial 12/24 reviews below remain historical audit trails; this section supersedes their current-status language.

HEAD was independently verified as `f2769dc`. The complete delta from `8320dd1` contains only `src/index.css` and `tests/accessibility-access.spec.ts`; no component, permission, operation or recovery logic changed. The iteration-2 appendix of [03-UI-FIX.md](03-UI-FIX.md) (residual fixes and exact-build measured evidence) was read. All ten fresh synthetic library/sharing/action/local-copy/recovery screenshots at 490px and 1404px under ignored `.gsd/acceptance-03-ui-fix-iteration2/` were inspected. No new defect was observed in this bounded recheck.

| Pillar | Current score | Evidence |
| --- | --- | --- |
| Copywriting | 4/4 | Prior critical-copy resolutions retained; final delta changes no strings. |
| Visuals | 4/4 | Ten fresh captures preserve hierarchy, aligned dialog regions and readable controls. |
| Color | 4/4 | Library heading and rename-input outlines now use the specified accent; corrected ink and field boundaries retained. |
| Typography | 4/4 | Roles/status use 13px/600; email/updated-time metadata retains 12px/400. |
| Spacing | 4/4 | Neutral borders explicitly 1px; narrow/wide header gutters 16px/24px; prior dialog geometry and targets retained. |
| Experience Design | 4/4 | Prior interaction resolutions retained; scoped CSS changes preserve visible focus and do not alter operation/recovery logic. |

### Final residual verification

- **UI-T1 resolved:** [index.css](../../../src/index.css#L1824) (separate identity and role styles, lines 1824–1825) uses first-of-type spans for email and subsequent spans for role/status. This matches the inspected sharing markup, where email is the first span and role/state follow it. Card metadata now receives 13px/600; updated-time `small` retains 12px/400. Fresh library and wide sharing captures show the corrected hierarchy. The measured oracle separately asserts actual owner/row role spans, email spans, card metadata and time text.
- **UI-C2 resolved:** [index.css](../../../src/index.css#L1827) (scoped focus rules, lines 1827–1828) sets 2px solid `#b4451f` focus-visible outlines on library/session/root-route headings and board-action controls. Both fresh library and rename captures show accent focus, replacing native blue. The additional route selector is limited to the root route surface. Existing sharing/recovery outlines remain visible.
- **UI-S1 resolved:** [index.css](../../../src/index.css#L1826) (neutral control borders) sets 1px solid `#76736e` on neutral sharing/action/local-copy buttons. The fresh captures show flat consistent borders. Lines 1840–1841 retain 24px header padding above 700px and override both horizontal sides to 16px at 700px and below. The narrow image aligns header/main gutters; desktop retains its wider header inset. Computed-border/gutter assertions cover 490px and 1404px; the exact 700px boundary is established by source rather than a separate screenshot.

### Current disposition of all thirteen findings

| Finding | Current disposition |
| --- | --- |
| UI-X1 — sharing pending/uncertain dismissal and reconciliation | Resolved at `8320dd1`; unchanged |
| UI-W1 — consequential sharing copy | Resolved at `8320dd1`; unchanged |
| UI-W2 — named irreversible delete/removal copy | Resolved at `8320dd1`; unchanged |
| UI-W3 — honest uncertainty labels | Resolved at `8320dd1`; unchanged |
| UI-V1 — sharing visual alignment | Resolved at `8320dd1`; retained in fresh captures |
| UI-C1 — enabled card contrast | Resolved at `8320dd1`; retained |
| UI-C2 — boundaries/destructive color/focus | Resolved; final focus correction verified |
| UI-T1 — typography roles | Resolved; final role/status correction verified |
| UI-S1 — spacing/borders/gutters | Resolved; final border/gutter correction verified |
| UI-S2 — menu/import link targets | Resolved at `8320dd1`; unchanged |
| UI-X2 — create opening and reserved-tab progress | Resolved at `8320dd1`; unchanged |
| UI-X3 — errors/filter semantics | Resolved at `8320dd1`; unchanged |
| UI-X4 — deliberate route focus | Resolved at `8320dd1`; final accent styling verified |

**Top priority fixes:** none remaining in this audit. **Recommendation count:** 0 priority fixes, 0 minor recommendations. Registry gate remains inapplicable: no component registry configuration or assets changed.

**Evidence limits retained:** the fixer reports both TypeScript checks and a fresh exact-build production measured suite **3/3 in 25.2s**; the earlier 3/3 run in 25.5s overlaps and is not added to this count. Source/screenshots were independently inspected; this auditor ran no tests, builds, listeners or captures and made no source edits or commits. The full **1507-case** matrix is owned by the acceptance executor and was running at this handoff; no final matrix pass is claimed. Actual-provider acceptance, native 200% browser zoom, OS IME, assistive-technology speech and genuine BFCache restoration remain unverified. A clean scoped UI audit does not close those separate gates.

---

## Historical re-audit — `8320dd1` — 21/24

**Audited:** 2026-09-16. **Current overall: 21/24.** **Open: 0 blockers, 3 warnings.** Ten original findings are resolved; UI-C2, UI-T1 and UI-S1 retain the bounded residuals below. The initial **12/24** audit is preserved afterward as historical evidence and is superseded by this section.

**Baseline:** [03-UI-SPEC.md](03-UI-SPEC.md) (approved typography, color, spacing and interaction clauses). **Source:** HEAD independently verified as `8320dd1`; all production changes in `7c8982c`, `b4877ce` and `8320dd1` were read. [03-UI-FIX.md](03-UI-FIX.md) (fixer's per-finding changes, RED/GREEN evidence and limitations) was read as attributed execution evidence.

**Screenshots:** all ten supplied synthetic captures under ignored `.gsd/acceptance-03-ui-fix/` inspected: library, sharing, rename action, local-copy and recovery at 490px and 1404px. The desktop library now includes the account header, heading, creation controls, filters and grid. Local-copy screenshots depict the empty inventory, and action screenshots depict rename; additional states remain source/test-oracle reviewed. No capture, browser interaction, test, build, listener, source edit or commit was performed by this auditor.

### Current pillar scores

| Pillar | Score | Current evidence |
| --- | --- | --- |
| Copywriting | 4/4 | Consequential sharing/delete language, distinct success and unknown-outcome actions corrected. |
| Visuals | 4/4 | Sharing header/body/footer alignment and explicit light border corrected; five surfaces retain clear hierarchy at both widths. |
| Color | 3/4 | Enabled text and field borders corrected; native blue focus remains on newly focused headings and rename input. |
| Typography | 3/4 | Four-size/two-weight surface rules implemented; role/status labels are incorrectly reduced to metadata styling. |
| Spacing | 3/4 | Main dialog geometry, padding and targets corrected; native button border thickness and narrow header gutter still diverge. |
| Experience Design | 4/4 | Source and targeted semantic oracles resolve pending/reconciliation dismissal, orphan rows, create navigation and focus findings. |

### Top 3 remaining fixes

1. **WARNING UI-T1 — role/status typography:** In [index.css](../../../src/index.css#L1824) (new typography overrides), `.share-owner > span`, `.share-row > span` and `.board-card__metadata` all receive `400 12px/1.5`. These include Owner/Editor/Viewer and Private/Shared/Active/Pending labels; the fresh library and sharing images visibly show the reduced hierarchy. The **Typography** contract specifies **Control / role label: 13px, 600, 1.5**, while **12px/400** is for metadata/updated time. Separate identity/email/updated-time metadata from role/status selectors, restoring role/status labels to 13px/600. Keep email system text and wrapping. Verify computed styles on actual role spans as well as button/heading samples; the measured test currently checks card buttons and dialog headings, not these role spans.
2. **WARNING UI-C2 — focus accent:** `synthetic-action-490.png` and `synthetic-action-1404.png` show a native blue outline around Board name; `synthetic-library-490.png` shows blue focus around Your boards. The **Color** contract explicitly reserves `#b4451f` for keyboard focus, and **Spacing Scale** requires 2px focus outlines. This is a contract mismatch, not a preference against native focus. [index.css](../../../src/index.css#L1085) (library focus selector) excludes headings, and board-action dialog has no corresponding focus-visible rule; new surface rules at lines 1804–1838 do not cover these gaps. Add scoped 2px accent focus-visible styles for the newly focusable route headings and board-action controls, preserving visible focus. Existing sharing and recovery accent outlines remain correct. Enabled card-action ink and essential field-boundary contrast from the original finding are resolved.
3. **WARNING UI-S1 — border thickness and narrow gutter:** The **Spacing Scale** clause explicitly says “Use 1px borders”; the final scoped button rule at [index.css](../../../src/index.css#L1816) (access control styling, lines 1816–1819) sets font/radius/padding/height but leaves native borders on neutral sharing/action/local-copy buttons. Fresh action and local-copy captures show the raised native borders; unlike primary buttons and dialog shells, these controls have no explicit 1px border rule. Normalize those neutral control borders to 1px and the appropriate token, then measure computed border widths. Separately, line 1836 unconditionally sets `.board-library__header` horizontal padding to **24px**, overriding the earlier narrow **16px** rule at line 1543. The **Responsive Layout, Keyboard and Focus** contract says **16px gutters at 700px and below**, and the narrow screenshot shows the header logo inset 24px versus the main content's 16px. Scope 24px to desktop and retain 16px below the contracted breakpoint. Dialog width/padding, zero inherited gap, 44px menu/import targets and arbitrary share/copy padding from the original finding are resolved.

### All thirteen original findings reconciled

| Finding | Current disposition | Evidence and practical limit |
| --- | --- | --- |
| UI-X1 | Resolved | Sharing lines 68–118 synchronously guard active requests, preserve original operation ID/method/path/body and hold Close/Escape while busy or uncertain; lines 159–162 retain a retry surface if another successful mutation removes the original grant row. Receipt 401/403/404/409 clears stale owner controls and aborts at lines 75–76. No cancellation-as-success path remains in the reviewed dismissal flow. |
| UI-W1 | Resolved | Sharing lines 129–165 include owner/link explanation, exact member/Access labels, verified-account helper, pending/active success at 108, and spoken clipboard fallback. The exact critical copy assertions were inspected. |
| UI-W2 | Resolved | BoardActionDialog line 37 names the board and states everyone/irreversibility; sharing line 163 distinguishes active/pending removal and Keep access. Safe initial-focus source remains present. |
| UI-W3 | Resolved | Library lines 118–128 and sharing lines 112/145 expose the unconfirmed-outcome message and Check again while reusing the existing operation. Definitive validation failures can reset the request; uncertain failures retain it. |
| UI-V1 | Resolved | CSS 1804–1812 establishes explicit 1px sharing shell border, zero panel gap and 24px insets; both sharing captures show aligned header/body/footer. |
| UI-C1 | Resolved | CSS 1823 explicitly sets enabled card actions to `#1b1a18`; all four actions are visibly legible. The inspected measured oracle asserts enabled computed color rather than relying on the earlier sharing-only contrast sample. |
| UI-C2 | Partially resolved | Essential fields now use `#76736e` and final destructive controls use `#b23b32`; residual native blue focus described above. |
| UI-T1 | Partially resolved | Dialog body/headings, fields, card actions, Viewer title and header controls have explicit contracted roles; residual role/status spans described above. |
| UI-S1 | Partially resolved | 458px/640px share/copy widths, 24px padding, 16px row spacing and 8px control radii are source-supported and visually consistent; remaining button-border/gutter values described above. |
| UI-S2 | Resolved | CSS 1816–1819 sets menu links to 44px; line 1829 makes the imported-board link an inline-flex box. The existing import success link receives that rule without changing its runtime module. |
| UI-X2 | Resolved | Library line 117 navigates to the acknowledged authorized board. Header lines 41–72 populate safe text-only progress in the gesture-reserved tab and retain a failure message; the source board and blocked-popup fallback remain. |
| UI-X3 | Resolved | Stable error IDs connect inline title, dialog name, creation and grant/row controls. Library filter container now has the labeled group role. The source preserves drafts and existing alert regions. |
| UI-X4 | Resolved | Library heading focuses on account entry only, skips explicit focusBoard, and does not depend on refresh/filter state. Auth state and denied/error headings focus on state transitions. Recovery focus restoration remains separately tied to authenticated recovery. |

### Interaction and verification evidence

- [ShareBoardDialog.tsx](../../../src/boards/ShareBoardDialog.tsx#L68) (mutation, receipt and dismissal lifecycle) was traced beyond button presence: active requests use a synchronous Set, uncertain requests retain their Map entry, same-key retries preserve original payload, unrelated rows remain operable, and removed-row pending entries retain reconciliation controls. Dismissal after terminal authorization loss intentionally invalidates inaccessible owner context. Successful reconciliation resumes ordinary dismissal and trigger focus. The reviewed server contract still performs actor/current-resource authorization before returning receipts.
- [board-sharing.spec.ts](../../../tests/board-sharing.spec.ts) (sharing regression oracles) covers real committed POST/PATCH/DELETE with lost responses, Close/Escape attempts, exact receipts, one mutation, final grants, expired session, changed account, deleted board and unrelated-row removal. [accessibility-access.spec.ts](../../../tests/accessibility-access.spec.ts#L51) (measured layout and style oracle) now checks enabled card buttons, field colors, exact dialog geometry and headings. These targeted checks support resolved findings but omit the three remaining details above.
- The fixer reports **14/14**, then expanded sharing **18/18**, and final complete measured suite **3/3**. Earlier **94/96**, **41/42**, and **29/30** runs were incomplete passes; failed assertions were subsequently corrected and rerun. This auditor neither sums overlapping runs nor claims a consolidated complete suite. The exclusive acceptance runner owns the final full gate at the new revision.
- No new shadcn configuration or third-party registry assets were introduced, so the registry gate remains inapplicable. Existing screenshot ignore protections remain in effect.
- Native browser 200% zoom, native OS IME, assistive-technology speech, genuine BFCache restoration and actual-provider acceptance remain **unverified**. Screenshot dimensions, synthetic composition events and source analysis do not establish them. These evidence limits do not themselves constitute implementation defects.

**Current recommendation count:** 3 priority fixes, 0 additional findings, 0 blockers. Recheck these scoped styling residuals after correction and retain final acceptance as a separate gate.

---

## Historical initial audit — `033ecc0` — 12/24

The following findings and counts describe the initial audit only. Their current dispositions are recorded above.

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
