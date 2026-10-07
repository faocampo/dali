---
phase: 04-durable-boards-and-recovery
plan: "09"
subsystem: recovery
tags: [indexeddb, library, account-isolation, playwright]
requires:
  - phase: 04-03
    provides: Account and board journal indexes with exact acknowledgments
  - phase: 04-04
    provides: Authorized recovery and explicit restored-board entry
  - phase: 04-05
    provides: Current save acknowledgment coverage
  - phase: 04-06
    provides: Authorized recovery downloads independent of save acknowledgment
provides:
  - Authorized browser-local pending markers on library cards
  - Independent journal inspection with loading, error and refresh states
  - Account-race, responsive and native save/download/restoration lifecycle evidence
affects: [04-14, 04-15, 04-16]
tech-stack:
  added: []
  patterns: [Keyed account lifetime, abortable authorized inspection, metadata-free invalidation]
key-files:
  created: [src/boards/pending-recovery.ts, src/boards/pending-recovery.test.ts, src/boards/pending-recovery.css, tests/library-recovery.spec.ts, tests/library-recovery-fixtures.ts]
  modified: [src/boards/BoardLibrary.tsx]
key-decisions:
  - Reauthorize the card list on journal invalidation and inspect only its current account and board indexes.
  - Return pending booleans without journal metadata and retain old-epoch records until their work resolves.
requirements-covered: [SAVE-02]
requirements-completed: []
coverage:
  - id: D-08
    description: Authorized cards identify browser-local pending work with isolated inspection and exact save lifecycle
    requirement: SAVE-02
    verification:
      - kind: unit
        ref: src/boards/pending-recovery.test.ts
        status: pass
      - kind: e2e
        ref: tests/library-recovery.spec.ts#@04-09-01
        status: pass
      - kind: e2e
        ref: tests/library-recovery.spec.ts#@04-09-02
        status: pass
    human_judgment: false
actuals:
  tokens: 8539
  tasks: 2
  commits: 4
plan_head_before: 7115733dc7ab29b8fa300e05ca845bdeba1c2d38
duration: approximately 12min
completed: 2026-09-26
status: complete
---

# Phase 4 Plan 9: Authorized Library Pending Markers Summary

**Library cards now show account-isolated browser pending work, with independent storage inspection and retained markers across downloads and restored-board entry.**

## Accomplishments

- `inspectAuthorizedPendingBoards()` validates the entire authorized account list before storage reads, deduplicates board IDs, reads their existing IndexedDB board indexes and returns only `PendingBoardStatus.hasPendingChanges`. Aborted or out-of-scope results fail closed. Old-epoch, legacy and quarantined work remains pending.
- Cards load independently of journal reads. Checking recovery status appears while inspection is pending; failures show Recovery status unavailable with the existing Refresh boards retry. An authorized-list failure clears private cards. Empty journals add no marker or fabricated card.
- Account-keyed component lifetimes reset state synchronously; abort cleanup suppresses stale inspection completions. The existing cross-tab signal carries only invalidation and triggers fresh list authorization before another inspection.
- Markers sit below role/access metadata, preserve card ordering, server edited times, preview fallback and actions, and describe the open link accessibly. Dedicated CSS provides 12px/400 warning text, a decorative icon and wrapping helper text.
- Native browser evidence covers zero/one/50 cards, real Owner/Editor/Viewer roles, blocked/failed inspection, cross-account switching during a blocked read, a cold same-account browser, inaccessible records and failed access lists. Real save acknowledgment removes one marker among 50 while the other 49 remain. Recovery download, actual in-app leave navigation and explicit restored-board entry retain unresolved records and markers.

## Task Commits

| Task | RED | GREEN |
|---|---|---|
| 04-09-01 authorized inspection | `7e770f9` | `6c57215` |
| 04-09-02 layout and lifecycle | `c57e067` | `ccdeec9` |

The persisted ledger measures four task commits through `ccdeec9`; documentation close-out follows. Actual tokens are the realized committed diff's character count divided by four and rounded up, including owned RED evidence. Eight files changed across task commits, including two evidence records. Duration is approximate because initial startup was not separately instrumented.

## Verification Evidence

| Command / gate | Result |
|---|---|
| `npm test -- src/boards/pending-recovery.test.ts` | 8 passed, 0 skipped; 146ms total |
| `npm exec playwright test -- tests/library-recovery.spec.ts --project=prod --grep @04-09-01` | 3 passed, 0 skipped; 23.2s including fresh build/service startup |
| `npm exec playwright test -- tests/library-recovery.spec.ts --project=prod --grep @04-09-02` | 6 passed, 0 skipped; 29.9s including fresh build/service startup |
| Final `npm exec playwright test -- tests/library-recovery.spec.ts tests/board-library.spec.ts --project=prod` | 20 passed, 0 skipped; 47.2s including startup; 9 new recovery cases and 11 existing library regressions |
| `npm test` | 182 passed, 0 skipped; 9.45s |
| `npm run typecheck && npm run typecheck:server` | Both passed for each task and after final test edits |
| Production build from browser setup; `git diff --check` | Passed; existing bundle/static-import advisories unchanged |

The final combined native run includes strengthened in-app leave navigation, all six lifecycle cases, all three inspection cases and existing library keyboard, actions, filters, preview authorization and focus regressions. Tests use signed synthetic OIDC, real service APIs, actual IndexedDB, native canvas edits, browser download handoff and real save acknowledgments. Storage barriers and outage responses are explicit test controls. Browser setup uses the existing installed cache and owned loopback listeners. No dependencies were installed or user services stopped.

All required widths (1440, 900, 600, 490 and 320px) ran with reduced motion and 50 marked cards including a 200-character title. Assertions cover no horizontal overflow, one-column narrow layout, wrapped helper text, warning typography, full accessible descriptions and reachable last-card menus. The generated 320px screenshot was visually inspected: text wraps within the cards and menu space remains available. Library markers expose no image names, so the image-name fixture remains with the image-detail surfaces.

## TDD Gate Compliance

- Task 1 RED: the authorized card open link rendered, while Changes waiting to save was absent. One selected native assertion failed as intended.
- Task 2 RED: 50 markers rendered, but their native computed font was 14px rather than 12px. One selected native assertion failed as intended.
- Both committed RED JSON records received `RED_EVIDENCE_OK`; the records explicitly disclose normalization to TAP. GREEN commits follow their successful task gates. No separate refactor was needed.

## Deviations from Plan

None in product scope or file ownership. Requirement-wide SAVE-02 acceptance remains assigned to the phase verifier.

## Issues Encountered

The first expanded task-2 run passed four cases and exposed two test-fixture expectations: the deliberately changed account returns an expected HTTP 409, and the current retry control is named Retry saving. The targeted allowance and label correction were applied; all six cases and the final 20-case combined run passed. No product bug remained from these fixture corrections.

## Interfaces for Following Plans

- `PendingBoardStatus`: `{ hasPendingChanges: boolean }`.
- `inspectAuthorizedPendingBoards(accountId, authorizedBoards, signal)`: promise of a board-ID/status Map; rejects inspection failures and invalidated authority. Call only with the current authorized card list.
- `subscribePendingBoardInvalidation(listener)`: wraps the existing state-only journal subscription and returns cleanup. Consumers must reauthorize and inspect again.
- Existing `BoardSummary.pendingCount` retains its pending-member-grant meaning; save markers use a separate state field.

## Final Human Matrix Obligations

| Gate owned by final phase verification | Required evidence |
|---|---|
| Genuine native browser 200% zoom | Check narrow/wide libraries with 0/1/50 marked cards, the long title, full helper wrapping, visible warning text, keyboard focus and reachable open/menu/refresh controls. Record browser/version and actual browser zoom. CSS zoom and viewport resizing do not establish this result. |
| Native reload/tab-close warnings | Final leave-flow plan and phase matrix own genuine interaction, supported/suppressed platform behavior and any confirmation flow added by 04-08. This plan proves preservation through actual in-app library navigation. |
| Spoken assistive-technology acceptance | Retains approved backlog 999.3; automated descriptions and keyboard checks above have their narrower scope. |

No required automated verification was skipped. There are no known product stubs or newly introduced security surfaces beyond the plan's authorized-card-to-journal boundary. T-04-09-01 is exercised by unit scope rejection and the native delayed account-switch/inaccessible-card cases.

## Next Phase Readiness

Plan 04-09 is complete; continue with dependency-approved 04-14. Final phase verification retains genuine zoom, final leave-flow, cross-browser and operational gates. Existing user edits remain outside all task commits.

## Sources

React documentation, state reset with a key ([react.dev/reference/react/useState](https://react.dev/reference/react/useState#resetting-state-with-a-key)) and effect cleanup against stale responses ([react.dev/learn/synchronizing-with-effects](https://react.dev/learn/synchronizing-with-effects)), retrieved through Context7 before implementation.

## Self-Check: PASSED

All six declared product/test artifacts and both RED evidence records exist. All four task commit objects were verified. Both exact named native gates selected cases without skips, and the final combined run passed all 20 cases. Static checks pass, no tracked files were deleted and the changed-file scan found no unfinished stubs.
