---
phase: 03-okta-and-board-access
fixed_at: 2026-09-16T20:30:37Z
review_path: .planning/phases/03-okta-and-board-access/03-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 3: Code Review Fix Report

**Source review:** `03-REVIEW.md`
**Baseline:** `43bd9c5`
**Final implementation/test commit:** `12a2184`
**Summary:** Seven findings addressed in eight scoped commits, with one CR-01 fixture follow-up. No findings skipped. Independent rereview and final Phase 3 acceptance remain pending.

## Fixed issues

### CR-01: Reject unreadable native root metadata

**Commits:** `8654e1c`, follow-up `12a2184`
**Status:** fixed: requires human verification (logic-fix review classification; automated semantic evidence below).

**Files modified:** `server/boards/documents.ts`, `server/boards/access.test.ts`, `server/boards/actions.test.ts`, `tests/board-actions.spec.ts`; follow-up `server/boards/operation-receipts.test.ts`, `tests/access-boundaries.spec.ts`.

The shared root validator now requires exactly one native metadata page with the correct content ID, string title, finite creation date and array tags. It rejects absent, empty and malformed metadata before publication. Successful synthetic staging fixtures include those native fields.

**RED:** The new server regression observed malformed metadata returning 200 where 400 was required.
**GREEN:** Owner and Editor malformed pushes leave document bytes/state vectors, revisions and thumbnails unchanged; staged malformed roots are rejected; a rejected malformed root still reopens through the actual native account editor. Initial focused evidence: 23 server resource/action cases passed in 2.90s; native reopen case passed in 17.9s. The final 110-server and 86-browser runs include this coverage.

The follow-up changes only intended successful root fixtures. The parent explicitly expanded ownership to `tests/access-boundaries.spec.ts` for this correction. Both-board canaries, independent owner rereads, denial cases and unchanged-state assertions were preserved. All three access-boundary cases passed in the consolidated run: receipts, staging/reconciliation, and independent role/resource denial smoke.

### CR-02: Restore editable archives as private account copies

**Commit:** `536f5d3`
**Status:** fixed.
**Files modified:** `src/boards/import-local.ts`, `src/canvas/BlockSuiteCanvas.tsx`, `tests/board-actions.spec.ts`.

The authenticated picker now reads the public native ZIP format in an isolated in-memory workspace, validates one board and its complete image manifest, then uses the existing import operation/staging/commit protocol. It creates a private account copy with fresh board/document/element identities. The confirmation dialog retains its operation for retry/reconciliation and offers an explicit link to open a completed import. Account generation and current role are rechecked before import requests. The unused legacy replacement branch was removed.

**RED:** Selecting a downloaded archive produced no account import confirmation.
**GREEN:** Actual export/download → file picker → confirmation → publication → fresh native reopen preserves text, hierarchy and exact image bytes with disjoint identities and unchanged source. Missing images, failed image upload with retained retry, stale role and a real cross-tab account change are covered. Focused archive plus existing local-import evidence: 22 cases passed in 1.0m. All are included in the final consolidated browser selection.

### CR-03: Synchronize visible edits before active duplication

**Commit:** `b1b262b`
**Status:** fixed: requires human verification (logic-fix review classification; automated semantic evidence below).
**Files modified:** `src/boards/operations.ts`, `src/canvas/runtime.ts`, `src/header/Header.tsx`, `tests/board-actions.spec.ts`.

Active duplication captures and preserves both current native documents, replays their journal under a bounded timeout and current generation/write checks, then verifies the visible state stayed stable before reading the server snapshot. Failed synchronization produces a recoverable error with the source retained. Completion navigation uses the established preservation path. Library duplication keeps its saved-source behavior and existing server revision checks.

**RED:** With document pushes failing, duplication completed and navigated instead of retaining the source with a synchronization error.
**GREEN:** Failed pushes publish no destination and retain pending source edits; retry and held-push release produce a destination exactly matching visible source content. Source reopen retains the same content. Two new cases plus the existing native library-copy case passed in 25.2s; all pass in the consolidated run.

### CR-04: Enable authorized Viewer viewport commands

**Commit:** `19528cd`
**Status:** fixed.
**Files modified:** `src/canvas/BlockSuiteCanvas.tsx`, `src/header/DaliMenu.tsx`, `tests/board-roles.spec.ts`.

The fit/reset listener mounts for every authorized canvas and checks current scope before moving the viewport. Writable history/mutation controls retain their authorization boundary. Viewer Layers is visibly disabled with an accessible explanation because the existing inspector exposes editing controls.

**RED:** Viewer menu reset left zoom at 50%.
**GREEN:** Menu reset reaches 100%, fit changes the panned viewport, Layers explains its unavailable state, and history stays disabled. Exact local native state/vector and independently reread owner server content remain unchanged. Three focused Viewer/menu cases passed in 23.5s; complete roles/menu suites pass in the consolidated run.

### CR-05: Refresh the authoritative library after actions

**Commit:** `2cfd25c`
**Status:** fixed: requires human verification (logic-fix review classification; automated semantic evidence below).
**Files modified:** `src/boards/BoardLibrary.tsx`, `tests/board-actions.spec.ts`.

Acknowledged actions refetch the active filter. Focus restoration waits for refreshed cards, using the retained shared source when its new private copy is excluded. Membership and timestamp/ID ordering come from the authoritative query.

**RED:** Both the older-board rename ordering and Shared-with-me duplicate membership cases failed.
**GREEN:** Rendered IDs match fresh server queries after rename, including equal timestamps; Shared with me remains selected and excludes the new private owner copy. Seven focused action/filter/focus cases passed in 26.4s; complete action/library suites pass in the consolidated run.

### CR-06: Export the current canonical title

**Commit:** `f635a62`
**Status:** fixed: requires human verification (logic-fix review classification; automated semantic evidence below).
**Files modified:** `src/canvas/export-board.ts`, `src/canvas/export-board.test.ts`, `tests/board-roles.spec.ts`.

Export validates and uses the current authorized descriptor's title for ZIP metadata and all filenames. Its final authorization check rejects a concurrent title change before download dispatch. Account/board/generation guards remain in place. The unit identity-change oracle now also proves rendering was reached before the identity change prevented download.

**RED:** After the server acknowledged “Synthetic new”, the download was named “Synthetic old.bs.zip”. The test uses the supported blur-save interaction and waits for SQL acknowledgment.
**GREEN:** Immediate ZIP, PNG and PDF filenames and decoded native archive title all use the acknowledged title without reload. Two unit guards passed in 166ms; four production cases including revoked-role and image/identity denial passed in 27.5s. These cases also pass in the consolidated runs.

### WR-01: Exercise current account workflows in native regressions

**Commit:** `46a8402`
**Status:** fixed.
**Files modified:** `tests/community.spec.ts`, `tests/mindmap-compatibility.spec.ts`, `tests/mindmap-copy.spec.ts`.

Reopen/switch cases use exact account board links and wait for the library before its creation form. Board-copy cases use the actual confirmation dialog, require fresh native IDs and valid internal parent references, and compare semantic hierarchy, text, collapse state, geometry and typography. Independent source and Undo/Redo/reload assertions remain.

Quota injection now targets writes to `dali-account-recovery-v1`, counts intercepted failures, checks unchanged server content and retained native pending state, retries preservation, and proves exact recovery across reloads. The automatic error collector and narrow synthetic quota allowance remain intact.

**RED:** All five obsolete cases failed at removed controls or the unused legacy quota hook (15-second diagnostic test timeout).
**GREEN:** All five corrected cases passed in 27.4s. During fixture correction, the rapid-switch setup initially filled the still-mounted header before library navigation completed; an explicit library-heading wait corrected that race. The final complete community and both mind-map suites pass in the consolidated run.

## Consolidated verification

All gates ran sequentially in the **main checkout**, using synthetic accounts/providers and a fresh production build. The established runtime `isolation:none` decision was honored for the exclusive writer/browser pass; project configuration was unchanged and no worktree was created. This is a documented runtime deviation from the fixer's default worktree setup.

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run typecheck:server` | Passed |
| `npm test` | 102/102 tests, 11 files, 1.04s |
| `npm run test:server` | 110/110 tests, 7 files, 6.87s |
| `npm run build` | Passed, Vite build 8.10s; existing mixed-import/chunk-size warnings |
| Focused consolidated production Chromium run | 86/86 tests, 2.7m, no skipped or failed cases |
| Diff whitespace checks | Passed before each scoped commit |

The consolidated browser command selected nine complete affected files:

```sh
npx playwright test tests/board-actions.spec.ts tests/board-roles.spec.ts tests/community.spec.ts tests/mindmap-compatibility.spec.ts tests/mindmap-copy.spec.ts tests/dali-menu.spec.ts tests/local-board-import.spec.ts tests/board-library.spec.ts tests/access-boundaries.spec.ts --project=prod
```

The configured external Playwright browser cache was supplied through `PLAYWRIGHT_BROWSERS_PATH`. The test runner started its synthetic services and rebuilt production before execution. Per-finding counts above overlap the consolidated run and must not be added together as unique tests.

## Remaining acceptance boundaries

All seven scoped remediation findings are addressed. The full configured browser suite and final access gate remain assigned to the acceptance executor after independent rereview. This pass establishes synthetic-provider production-Chromium evidence only. Existing operator gaps remain: actual-provider acceptance, OS IME/assistive-technology speech/native 200% browser zoom, and unproven BFCache restoration. No phase, requirement or actual-provider status was advanced; nothing was pushed.

Unrelated image assets and the milestone lock were preserved. This report is intentionally uncommitted for the parent workflow.

---

_Fixed: 2026-09-16T20:30:37Z_
_Fixer: gsd-code-fixer_
_Iteration: 1_

## Iteration 2 — CR-07: Explain unavailable Viewer archive import

**Fixed at:** 2026-09-16T20:46:21Z
**Source review:** current `03-REVIEW.md`, independently resolving the original seven findings and identifying CR-07.
**Baseline:** `7360be0`
**Commit:** `033ecc0`
**Iteration result:** one finding in scope, one fixed, zero skipped; cumulative eight findings addressed across both iterations. Independent delta review remains pending. The frontmatter and preceding evidence retain the historical iteration-1 results.

**Files modified:** `src/header/DaliMenu.tsx`, `tests/board-roles.spec.ts`, `tests/board-actions.spec.ts`.

Viewer File > Import board is now disabled and associated through `aria-describedby` with the visible explanation “Board import requires Owner or Editor access.” This follows the existing Viewer Layers treatment. Owner and Editor retain the enabled archive workflow.

**RED:** The new production Viewer regression failed because Import board remained enabled.
**GREEN:** The regression verifies the disabled item and computed accessible description, visible explanation, keyboard navigation skipping the item in both directions, zero picker/import requests, no import dialog, exact native model/state-vector preservation, and unchanged independently reread owner server content.

The existing complete archive roundtrip now runs for both Owner and Editor. Each opens the actual picker, handles missing-image rejection and failed-upload retry, publishes a private copy, reopens it natively and checks complete hierarchy, fresh identities, exact image bytes and unchanged source. The Editor setup initially switched accounts before asynchronous image persistence completed; it now waits for the authoritative editable-export manifest before switching identity. All original rejection and source-integrity assertions remain.

**Validation in the main checkout, sequential exclusive slot:**

- `npm run typecheck`: passed.
- `npm run typecheck:server`: passed.
- Fresh production build through the Playwright web-server setup: passed with existing bundle warnings.
- Six selected production Chromium cases: **6/6 passed in 29.1s**, no failures or skips. Selection covers Owner archive restore, Editor archive restore, Viewer import keyboard/nonmutation, Viewer viewport/nonmutation, Main Menu keyboard behavior and existing File Import picker behavior.
- Scoped staged diff/privacy and whitespace checks: passed. Commit uses neutral contributor attribution and contains only the three owned source/test files.

```sh
npx playwright test tests/board-roles.spec.ts tests/board-actions.spec.ts tests/dali-menu.spec.ts --project=prod --grep '@CR-07|@CR-04|Main Menu supports|File Import opens'
```

The configured browser cache was supplied through `PLAYWRIGHT_BROWSERS_PATH`. Runtime isolation remained `none`; configuration and unrelated files were preserved. This iteration ran only the narrow authorized static/browser checks. Earlier unit/server/consolidated results above remain attributed to iteration 1. Full final acceptance, actual-provider and native OS acceptance remain pending with their assigned owners. This append remains uncommitted; no tracking/review artifact was changed by the fixer and nothing was pushed.

## Independent review closure

On 2026-09-16, the independent reviewer verified all eight remediations at `033ecc0dd40665a6abd593d838db2e2f82453868`, retaining the complete 92-file scope. `03-REVIEW.md` records zero blockers and zero warnings. The iteration-specific pending-review statements above are historical. Final automated, actual-provider and native acceptance remain tracked separately in `03-12-CHECKPOINT.md`.
