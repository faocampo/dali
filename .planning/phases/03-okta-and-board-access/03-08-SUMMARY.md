---
phase: 03-okta-and-board-access
plan: "08"
subsystem: board-actions
tags: [authorization, sqlite, yjs, native-copy, unicode, accessibility]
requires:
  - phase: 03-07
    provides: member-bound grants, role summaries, sharing dialog and monotonic revisions
provides:
  - Acknowledged Unicode rename and transactional owner deletion
  - Private staged native duplication with fresh identities and complete images
  - Role-aware inline title, account controls and owner sharing in the compact header
affects: [03-09, 03-10, 03-11, 03-12]
tech-stack:
  added: []
  patterns: [source-bound staging, operation reconciliation, field-specific native graph identity remapping]
key-files:
  created: [server/boards/actions.ts, server/boards/actions.test.ts, src/boards/BoardActionDialog.tsx, tests/board-actions.spec.ts]
  modified: [server/boards/routes.ts, src/boards/operations.ts, src/boards/BoardLibrary.tsx, src/canvas/account/board-meta.ts, src/App.tsx, src/header/Header.tsx, src/header/BoardTitleMenu.tsx, src/header/DaliMenu.tsx, src/index.css]
key-decisions:
  - Native snapshot duplication uses a captured readonly source reader and a separate reserved destination workspace.
  - Complement pinned replaceIdMiddleware with field-specific surface identity remapping; preserve text, image hashes and relationship details.
  - Keep SQL title authoritative and reconcile uncertain mutations with the original operation ID.
requirements-completed: []
requirements-progressed: [BOARD-01, BOARD-02, BOARD-03, BOARD-04]
plan_head_before: d53d7473a81435d4633d515c376099aedeb0a87f
actuals:
  tokens: 23058
  basis: "Diff-size estimate only: ceil(92230 diff characters / 4); not model token consumption."
  model_token_usage: unavailable
  tasks: 2
  commits: 4
duration: 34min
completed: 2026-09-16
status: complete
coverage:
  - id: board-actions
    description: Role-authorized rename, private native duplicate and owner deletion with unchanged-state denial oracles
    requirement: BOARD-01
    verification:
      - kind: integration
        ref: server/boards/actions.test.ts
        status: pass
      - kind: automated_ui
        ref: "tests/board-actions.spec.ts @03-08-01"
        status: pass
    human_judgment: false
  - id: authenticated-header
    description: Inline title acknowledgment, IME and error states, account role and sharing controls at 490px
    requirement: BOARD-02
    verification:
      - kind: automated_ui
        ref: "tests/board-actions.spec.ts @03-08-02"
        status: pass
      - kind: e2e
        ref: "tests/topic-focus-new-board.spec.ts and tests/dali-menu.spec.ts"
        status: pass
    human_judgment: false
---

# Phase 3 Plan 8: Authorized Board Actions and Header Summary

**Owner/Editor Unicode rename and image-complete private duplication now use acknowledged server operations; owner deletion and compact account controls preserve role boundaries and existing New-tab behavior.**

## Task Commits

1. Task 03-08-01 RED: `46c3719` — intentional missing rename route assertion.
2. Task 03-08-01 GREEN: `ae05c1c` — transactional actions, native staging, library dialogs and canary coverage.
3. Task 03-08-02 RED: `55602e8` — intentional absent authenticated inline title assertion.
4. Task 03-08-02 GREEN: `bcc45c2` — acknowledged inline naming, role/account/sharing header and menu integration.

Thirteen implementation/test files changed. The four-commit actual is measured from the persisted pre-plan ledger to the final implementation commit; subsequent documentation commits are excluded from this measurement. Duration is approximately 34 minutes; command timings below are measured runner output. Model token consumption is unavailable.

## Verification

| Command | Result |
|---|---|
| `npm run typecheck` | Passed, including final title tests |
| `npm run typecheck:server` | Passed |
| `npm run test:server -- server/boards/actions.test.ts` | 5 passed; 1.25 seconds |
| `npm run test:server` | 107 passed across 6 files; 7.92 seconds |
| `npm test` | 95 passed across 9 files; 1.25 seconds |
| `npm exec playwright test -- tests/board-actions.spec.ts --project=prod --grep '@03-08-01'` | 4 passed; final strengthened native case included; 25.3 seconds |
| `npm exec playwright test -- tests/board-actions.spec.ts tests/topic-focus-new-board.spec.ts tests/dali-menu.spec.ts --project=prod` | 13 passed; 38.0 seconds |
| `npm exec playwright test -- tests/board-actions.spec.ts --project=prod --grep '@03-08-02'` | Final 4 passed; 23.0 seconds |

The browser harness rebuilt production assets and started isolated synthetic OIDC/service listeners for every run. The final distinct browser union is 14 cases: eight action/header cases and six existing menu/topic/New regressions. The combined run preceded the final added long-dialog case and caret assertion; the final targeted run verifies those additions. There are zero skipped required cases. Automatic unexpected console/page-error assertions remain enabled. Build completed successfully; Vite retains advisory chunk-size and static/dynamic import notices.

The parent independently verified the stable implementation: production build passed in 13.1 seconds, all 95 unit tests and 107 server tests passed (server runner 6.82 seconds; 7.2 seconds wall), and schema/UI capability gates were clear. The advisory codebase-drift check had no STRUCTURE baseline and was skipped; it is not a plan acceptance test.

### Observed contracts

- The direct role matrix denies Viewer rename/duplicate/editable export and denies Editor deletion/sharing. SQL metadata, document bytes, image bytes, grants and staging remain unchanged on denied actions. Authorization is rechecked after the scheduling barrier and inside commit transactions.
- Rename preserves 200 multi-codepoint graphemes, trims surrounding whitespace, rejects 201 visibly, retains failed drafts, and restores the acknowledged name on blank input or Escape. Enter, blur, Save name and Keep name follow the shared contract. Composing input does not commit. Pending submission is disabled and announced. Lost responses reconcile the original operation before further mutation.
- Duplication reserves fresh board/root/content identities and uses an isolated native destination transformer. Actual native maps include nested collapsed descendants, ordered siblings and formatting; connector endpoints resolve to copied shapes. Destination semantic parent/order/collapse/formatting relationships equal the source, element IDs are disjoint, and image SHA-256 matches exactly. Original document bytes, snapshot and workspace document membership remain unchanged after staging disposal and reopen.
- Publication requires both transformed documents and the entire declared image manifest. Invalid reused identities and missing image bytes reject. Changed source revision and revoked source access prevent publication. Repeated reserve/commit uses one destination. Copies belong to the actor and have zero active or pending grants.
- Named deletion initially focuses Keep board. Cancel returns focus, failure retains context, acknowledgment removes the card and focuses a surviving card or New board. Cascades remove documents, blobs, grants and source-bound staging; a repeated delete returns its recorded result.
- The Owner header exposes Share board and returns focus from its dialog. Viewer gets a readable full title, visible View only role and account control. At 490px, essential controls remain within the viewport with 44px targets, long dialog labels/errors wrap, and long input values retain end-caret scrolling. Existing Main Menu keyboard navigation, topic focus/typography and File > New source-content/reload assertions pass unchanged.

## Interfaces for Subsequent Plans

- `server/boards/actions.ts` registers PATCH/DELETE board actions, GET editable-export, POST duplicate reservation, and GET/PUT/POST import staging endpoints listed in the plan index. Migration 6 creates `import_staging` and `import_staging_blobs`, keyed by authenticated member and operation. The reserved descriptor and source revision remain server-owned. Documents are bounded, root/content binding is checked, source block/surface identities are rejected, image keys require exact padded base64url SHA-256, and the final transaction publishes owned private resources only when complete.
- Editable export returns `{descriptor, root, content, manifest}` with base64 Yjs bytes and referenced image keys. Duplicate reservation returns `{status, result}`; `result` is its reserved descriptor. Stage document PUT accepts `{root, content, manifest}`. Blob PUT accepts declared PNG/JPEG bytes. Commit returns the completed descriptor. Source revision/permission is checked in that commit transaction. Plan 11 adds the explicit selected-local-copy reservation endpoint while reusing this staged transport.
- `AccountBoardAction(accountId, boardId, kind)` retains one operation ID. `run(title?)` reconciles and executes; `check()` reads its result. `BoardActionError.uncertain` selects Check again instead of blind retries. `validateBoardTitle(draft, acknowledged)` is shared by inline and dialog clients.
- `regenerateSurfaceIdentities(snapshot)` clones the native snapshot and remaps surface keys/IDs, connector endpoint IDs, group children keys and mind-map child/parent IDs. It preserves text, hashes, ordered child detail and collapse/formatting fields. Apply it before the staging workspace's reserved-content-first native transformer. Native replaceIdMiddleware still owns block and document-scoped block relationships. The transformer is disposed through `[Symbol.dispose]()` before workspace disposal.
- The duplicate source reader hydrates captured exported document bytes through a readonly workspace with an injected read-only fetch implementation. Referenced blobs are fetched through authorized routes and checked before staging. Source imports and source catalog mutations never occur. Plan 11 should reuse the isolated destination and field-specific remapping while reading explicit selected local sources.
- `BoardActionDialog` accepts `{board, kind, onClose, onComplete}`; completed rename/duplicate returns a descriptor, completed deletion returns `{deleted:true, boardId}`. Header actions reuse it and the existing `ShareBoardDialog`. A header duplicate returns to the library with a validated accessible-card focus target.

## TDD Gate Compliance

| Task | Intentional RED | Gate | GREEN |
|---|---|---|---|
| 03-08-01 | Rename expected 200, received absent-route 404 | RED_EVIDENCE_OK | Five transaction tests plus four visible production cases |
| 03-08-02 | Authenticated Owner board-name input expected visible, absent | RED_EVIDENCE_OK | Four production header/state/overflow cases plus existing regressions |

Raw runner JSON and mechanically normalized named-failure TAP evidence were retained in temporary execution artifacts. Corresponding RED commits precede implementation; no refactor commit was needed. The initial RED test commit's unused copied imports were removed and the commit amended after static verification, before implementation began.

## Deviations from Plan

1. **[Rule 3 — integration ownership]** Orchestrator approved the narrowly required action module/tests, common operations client, App binding and stylesheet changes. The existing routes module registers the dedicated transactional action module; legacy local functions remain separately named.
2. **[Rule 1 — staging metadata transaction]** Differing source/copy titles exposed `BoardMeta.setDocMeta` validating its temporarily empty page array between delete and insert. Capturing the validated array once fixes the atomic replacement while retaining single-document and access guards. The production native duplicate regression proves the fix. Commit: `ae05c1c`.
3. **[Rule 2 — graph identity preservation]** Installed BlockSuite 0.22.4 replaceIdMiddleware changes block identities while retaining graph IDs. Field-specific cloned surface remapping supplies the required fresh identities without altering content. Server rejection of reused IDs and native nested map/connector assertions establish the behavior. Commit: `ae05c1c`.
4. **[Rule 1 — menu ordering regression]** New File actions initially displaced Export from its established End-key position. Actions now precede Export; the original test oracle remains unchanged. Commit: `bcc45c2`.

No unresolved implementation stub, skipped required test or unrun plan verification remains. These fixes introduce no security surface outside the plan's T-03-17/18/19 action, staged-content and reconciliation boundaries.

## Evidence Limits and Remaining Obligations

Shared requirements remain open until final phase acceptance. Actual-provider acceptance and native browser 200% zoom/assistive-technology checks remain plan 12 obligations, as recorded in the cross-phase ledger. This plan's 490px viewport, DOM geometry, focus and composition-event assertions establish their measured browser behavior; they do not substitute for those native operator checks. Phase 4 retains restart/backup recovery and Phase 5 retains live collaboration and the 20-user workload.

Implementation references: [03-08-PLAN.md](03-08-PLAN.md) (approved action/header predicates), [03-PLAN-INDEX.md](03-PLAN-INDEX.md) (shared routes and staging contracts), [03-UI-SPEC.md](03-UI-SPEC.md) (title, confirmation and responsive behavior), and installed BlockSuite 0.22.4 `affine-shared/src/adapters/middlewares/replace-id.ts` and `store/src/transformer/transformer.ts` (pinned native transformation/disposal API). Context7 CLI was unavailable; installed version-specific implementation was inspected directly.

## Self-Check: PASSED

All created files and four recorded implementation/test commits exist. Static checks, measured test evidence, staged whitespace/privacy inspection and unchanged-source oracles passed. No tracked files were deleted. Existing unrelated image assets and the orchestration lock were preserved.
