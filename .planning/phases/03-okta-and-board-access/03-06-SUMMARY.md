---
phase: 03-okta-and-board-access
plan: "06"
status: complete
subsystem: account-canvas
tags: [authorization, blocksuite, images, oidc, browser-tests]
requires: [03-05]
provides: [authorized native canvas shell, immutable access scope, private New tabs, authenticated native fixtures]
affects: [03-07, 03-08, 03-09, 03-10, 03-11]
tech-stack:
  added: []
  patterns: [generation-bound runtime, idempotent creation reconciliation, acknowledged preview upload]
key-files:
  created: [src/canvas/legacy-runtime.ts]
  modified: [src/canvas/runtime.ts, src/App.tsx, src/canvas/BlockSuiteCanvas.tsx, src/header/Header.tsx, src/header/DaliMenu.tsx, src/boards/preferences.ts, src/boards/operations.ts, tests/fixtures.ts, tests/board-access.spec.ts]
key-decisions:
  - Account runtime exposes public Workspace and Store and never falls back to local storage.
  - Each explicit New reserves a tab synchronously and receives an independent operation identity; retries reconcile that identity.
  - Thumbnail writes require current transactional capability and follow acknowledged document edits.
requirements-completed: []
requirements-progressed: [BOARD-01, BOARD-02, BOARD-04, AUTH-01]
duration: 28min
completed: 2026-09-16
plan_head_before: d8a92d721017c900dcbb30db35526720371af18a
actuals:
  tokens: 26974
  tokens_basis: realized implementation diff characters divided by four, rounded up; size estimate only
  model_token_usage: unavailable
  tasks: 2
  commits: 4
---

# Phase 3 Plan 6: Authorized native account canvas Summary

Authorized boards now mount the native canvas with protected document/image sources, scoped preview publication, and independent private New-board tabs.

## Task outcomes and commits

1. **03-06-01** — Session and board descriptor validation precede native runtime mounting. Account identity, board identity and generation govern initialization, suspension, disposal and image insertion. Legacy runtime identifiers are preserved in an explicitly isolated module. Native history, map compatibility installation/cleanup, source error handling, image retry and coordinate handling remain integrated. RED `18019df`; implementation `5e15beb`.
2. **03-06-02** — File > New reserves a tab inside the gesture, creates a private board with a fresh operation identity, reconciles ambiguous completion before retry, and provides the authorized destination when a popup is blocked. Signed login preserves the bounded creation intent. Ordinary native browser fixtures authenticate through the synthetic signed provider and create isolated account boards. RED `21492f7`; implementation `6408579`.

## Verification

- `npm run typecheck` and `npm run typecheck:server`: passed.
- `npm exec playwright test -- tests/board-access.spec.ts --project=prod --grep "@03-06-01"`: **4 passed**, 24.5 seconds at task 1 boundary.
- `npm exec playwright test -- tests/board-access.spec.ts tests/mindmap.spec.ts tests/image-import.spec.ts tests/dali-menu.spec.ts --project=prod`: **23 passed**, 42.1 seconds, after the final task 2 implementation. This includes every prescribed task 2 test plus the existing Main Menu cases.
- `npm test`: **95 passed**, 9 files, 1.35 seconds.
- `npm run test:server`: **86 passed**, 4 files, 7.25 seconds. This includes valid/invalid/oversized thumbnail uploads, foreign/viewer denial, unchanged prior bytes, and capability revocation at the transaction barrier, plus signed OIDC creation intent preservation.
- `git diff --check`: passed before each implementation commit. Required browser cases were selected and none skipped. Fresh synthetic production servers used exclusive test ports; the user's development board was untouched.

Browser assertions cover signed cold reopen, denied foreign canaries without native mounting or local IndexedDB creation, opening/loading/error image states, retry, empty export guidance, native history, acknowledged thumbnail bytes, independent New actions, source bytes/title/URL preservation, popup blocking, lost-response reconciliation and same-operation replay. Existing image decoding cancellation and final insertion guards retain their original native oracles. The automatic runtime-error collector and WebKit lifecycle workaround remain active; the deliberate denied-image test narrowly allows its expected native SourceAccessError.

## TDD Gate Compliance

Both tasks had committed tests and intentional runtime RED evidence before their implementation. Task 1 failed because the authorized native editor was absent; task 2 failed because the newly reserved tab never mounted a native editor. Both normalized evidence files passed `check tdd-red-evidence` with `RED_EVIDENCE_OK`. Thumbnail regression additionally observed the missing endpoint's 404 before implementation. GREEN gates above passed; no refactor-only commit was needed. Local transient evidence is intentionally outside the public repository. Actual model consumption was unavailable; `actuals.tokens` measures diff size only.

## Interfaces and downstream handoff

- Frozen `AccessScope` contains `accountId`, `boardId`, `generation`, `role`, `canWrite`, and `phase: active | paused | disposed`. `getActiveAccessScope(): AccessScope | null`, `subscribeAccessScope(listener: () => void): () => void`, and `suspendAccessScope(reason: string): void` retain the plan-index signatures for plans 09/10.
- `CanvasRuntime.workspace` uses the public native Workspace shape with document synchronization and readiness. Runtime initialization is memoized by account/board/generation; rejected initialization can retry. Export uses the authorized descriptor title and performs zero local catalog or TestWorkspace metadata mutations.
- Preview capture waits for acknowledged document synchronization; scope, generation, edit revision and abort checks prevent stale capture publication. PUT validates bounded PNG bytes and rechecks current account/session/role inside the transaction. Thumbnail failure leaves document acknowledgment unchanged.
- Viewer hydration and stopped viewer SyncPeer from plan 05 remain intact. Reopening refreshes viewer data; live remote collaboration belongs to Phase 5.
- Plan 08 owns the account rename endpoint and mutation binding. The source title value is preserved and displayed now. `tests/topic-focus-new-board.spec.ts` retains its rename/new-tab/native-content assertions for that plan; its save-label migration is the only change here. This suite was not included in the prescribed 06 gate and is not claimed as passing.
- Plan 10 owns complete account recovery/session-expiry UX; existing local recovery wording still needs its account adaptation there. Plan 11 owns explicit local-copy/import UI; the account ZIP path is guarded until that work. These downstream obligations do not represent completed shared requirements.

## Deviations from Plan

All additional ownership was approved by the parent orchestrator before editing.

1. **[Rule 2 — Missing critical integration]** Added `src/header/DaliMenu.tsx` callback ownership and moved minimal Header/operations integration into task 1 so native account navigation could run. Added `src/canvas/export-board.ts` public Workspace integration and removed account-path local metadata mutation.
2. **[Rule 1 — Image mutation correctness]** Adapted `src/canvas/image-input.ts` to capture exact account/board/generation/Store and check immediately before mutation after asynchronous decoding/storage. Account identity loss cannot enter the explicit legacy predicate. The existing URL-switch and navigation cancellation assertions remain.
3. **[Rule 2 — Missing thumbnail write endpoint]** Added the narrow protected PUT in `server/boards/routes.ts` and denial/barrier coverage in `server/boards/library.test.ts`; this reuses existing storage and authorization boundaries.
4. **[Rule 2 — Interrupted creation continuity]** Preserved bounded operation identity in `server/auth/oidc.ts` and added `server/auth/oidc.test.ts` assertions. Identity remains idempotency data; session authority still determines account ownership.
5. **[Rule 3 — Account fixture adaptation]** Migrated only `Saved locally` to acknowledged account `Saved` in canvas-arrangement, canvas-editing, community, connector-labels, image-export, image-import, mindmap-accessibility, mindmap-collapse, mindmap-compatibility, mindmap-copy, mindmap-formatting, mindmap-keyboard, mindmap-layout, mindmap-node-copy, mindmap-workflow, mindmap, sticky-shadow and topic-focus-new-board specs. The image-import URL restoration uses the actual account board URL. The dali-menu library assertion targets the exact fixture board's accessible Open board link. Native editing, geometry, export, pending/error and rename oracles are preserved.
6. **[Rule 1 — Navigation lifetime]** The first broad run passed 20 cases and exposed one existing asynchronous decode cancellation failure caused by whole-page All boards navigation destroying the test/native document context. Restored in-app navigation and synchronous scope suspension; the unchanged cancellation oracle passes in the final 23-case run.

WINDOWS entry 7 is fixed by the native account shell and observed cold-reopen acceptance. No new skipped required checks or goal-blocking stubs were introduced.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: endpoint | server/boards/routes.ts | Added PNG thumbnail PUT within existing protected board-resource boundary; validated size/MIME/bytes, mutation request, board/account association, and transactional capability with unchanged-state denial tests. |

## Remaining acceptance scope

Synthetic signed-provider evidence establishes the automated plan behavior. Real Okta/deployment acceptance remains plan 03-12-02, and shared Phase 3 requirements remain open. No actual provider configuration or private operational evidence is included. Full cross-browser/native suite acceptance remains scoped to its earlier revisions and later phase verification.

## Self-Check: PASSED

All implementation files and the four listed commits exist. The plan ledger records four implementation/test commits from the stated base before this separate documentation commit. Both tasks and prescribed verification commands completed successfully.
