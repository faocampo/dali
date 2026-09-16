---
phase: 03-okta-and-board-access
plan: "03"
subsystem: boards
tags: [sqlite, authorization, library, thumbnails, react, yjs]
requires:
  - phase: 03-02
    provides: signed identity, persistent SQL sessions and expected-account guards
provides:
  - Private creator-owned board creation with independent root/content documents and operation reconciliation
  - Authorized SQL catalog and descriptors with owner precedence and deterministic role-aware filters
  - Protected thumbnail reads and generation-scoped browser object URLs
  - Responsive authenticated library with complete loading, error, empty and long-title states
affects: [03-04, 03-05, 03-06, 03-07, 03-08, 03-10, 03-12]
tech-stack:
  added: []
  patterns: [transactional private creation, board-bound subdocuments, abortable account-scoped previews]
key-files:
  created: [server/boards/routes.ts, server/boards/library.test.ts, tests/board-access.spec.ts, tests/board-library.spec.ts]
  modified: [server/app.ts, src/App.tsx, src/boards/BoardLibrary.tsx, src/index.css, tests/authentication.spec.ts, server/auth/oidc.test.ts]
key-decisions:
  - Preserve the authorized board transition until plan 03-06 mounts the conformance-proven account canvas.
  - Thumbnail display uses expected-account fetches and revoked object URLs; the producer belongs to later resource/runtime integration.
requirements-completed: []
requirements-supported: [BOARD-01, BOARD-02, BOARD-04]
coverage:
  - id: private-create
    description: Creator-owned private creation, distinct documents, operation reconciliation and denied explicit targets
    requirement: BOARD-01
    verification:
      - kind: e2e
        ref: tests/board-access.spec.ts
        status: pass
      - kind: integration
        ref: server/boards/library.test.ts
        status: pass
    human_judgment: false
  - id: authorized-library
    description: Stable SQL roles, filters, sharing labels and complete responsive library states
    requirement: BOARD-02
    verification:
      - kind: integration
        ref: server/boards/library.test.ts
        status: pass
      - kind: automated_ui
        ref: tests/board-library.spec.ts
        status: pass
    human_judgment: false
  - id: protected-previews
    description: Current-role and expected-account image checks, denied canaries and revoked stale preview URLs
    requirement: BOARD-04
    verification:
      - kind: integration
        ref: server/boards/library.test.ts
        status: pass
      - kind: e2e
        ref: tests/board-library.spec.ts
        status: pass
    human_judgment: false
actuals:
  tokens: 20239
  tasks: 2
  commits: 4
plan_head_before: 111ff53ec8762254d4236fce63f5de5971bbeff3
duration: 23min
completed: 2026-09-16
status: complete
---

# Phase 3 Plan 3: Private Boards and Authorized Library Summary

**SQL-backed private boards now receive creator ownership, independent Yjs resources and reconciled create operations, while the authenticated home displays only authorized cards and protected previews.**

## Accomplishments

- Registered additive board migrations and routes in the existing application. The server assigns board, root and content IDs, owner, canonical trimmed/default title and timestamps in one transaction alongside the initial root/content Yjs bytes and completed operation result. The root contains exactly one bound content subdocument; page and surface block IDs are independent between boards. Supplied owner/grant fields never establish authority.
- Added expected-account library, descriptor and operation endpoints. Lists use prepared SQL, owner precedence, one row per board, updated-time descending and board-ID ascending. All, Mine and Shared with me maintain that ordering. Active or pending grants produce Shared; pending-only rows expose Pending member sign-in. Returned role and account identity are required before a card can open.
- Creation preserves the server-confirmed title/card and reconciles uncertain responses through the member-scoped operation endpoint before another POST. Missing or inaccessible explicit targets show the same denied state and never consult a remembered local board or create a replacement. Account descriptors are authorized before exposing the board title.
- Added board-associated thumbnail storage and protected GET. Current session, expected account and current board role precede image reads; responses are private/no-store, PNG and nosniff. Browser preview fetches carry X-Dali-Account, validate the returned account and MIME, use AbortSignal, and revoke object URLs when their card generation is removed. A missing or denied preview leaves the permitted Open action usable.
- Completed loading skeletons, filter-preserving refresh, retryable failures with cleared cards, per-filter empty copy, 44px controls, 1240px/five-column desktop grid, 490px one-column layout, two-line titles and native keyboard/touch full-name disclosure. Tested zero, one and 50 cards, a 200-grapheme Unicode title, a 120-character unbroken title and a long synthetic email.

## Task Commits

1. Task 03-03-01 RED: `fa4e3c4` — require private idempotent board creation.
2. Task 03-03-01 GREEN: `7e44490` — create private boards and authorize account entry.
3. Task 03-03-02 RED: `c4c5f70` — require authoritative shared library labels.
4. Task 03-03-02 GREEN: `fbd9ea5` — render authorized role-aware board library.

All commits used normal hooks and neutral attribution. Staged whitespace and public-data checks passed; no tracked files were deleted. The four task commits were measured from the persisted plan base. Actual token scale is the realized task diff's 80,955 UTF-16 characters divided by four, rounded upward; metadata is excluded. Approximately 23 minutes elapsed from the first executable acceptance test through final verification, excluding initial context loading.

## Verification

| Command / evidence | Observed result |
|---|---|
| `npm run typecheck` | Passed before task commits and in final regression |
| `npm run typecheck:server` | Passed before task commits and in final regression |
| `npm exec playwright test -- tests/board-access.spec.ts --project=prod --grep "@03-03-01"` | RED: one intended 404-versus-201 assertion; later expanded four cases all passed in the task/final combined runs |
| `npm exec playwright test -- tests/board-access.spec.ts tests/authentication.spec.ts --project=prod` | Task 1: 14 passed, zero skipped, 12.3s |
| `npm run test:server -- server/boards/library.test.ts` | Final focused run: 7 passed, zero skipped, 1.31s |
| `npm exec playwright test -- tests/board-library.spec.ts --project=prod --grep "@03-03-02"` | 7 passed, zero skipped, 12.4s |
| `npm test` | 79 passed across 7 files, zero skipped, 1.02s |
| `npm run test:server` | 67 passed across 3 files, zero skipped, 6.32s |
| `npm exec playwright test -- tests/board-access.spec.ts tests/board-library.spec.ts tests/authentication.spec.ts --project=prod` | Final: 21 passed, zero skipped, 15.7s |
| `npm run server:build` and `npm run build` | Passed as fresh mandatory browser-harness startup steps |
| Viewport assertions and local synthetic screenshots | 490px/1404px inspected; no horizontal overflow, one/five columns and at least 44px controls |
| `requirements.ready-ids` | Zero of three shared requirements ready; no requirement prematurely marked complete |

The exact task 2 chain passed. The expanded task 1 cases also passed on the final revision. Browser runs retained the automatic console/page-error collector. Expected bootstrap 401, deliberate denied 404, injected 503, simulated create timeout and deliberately probed revoked-object-URL diagnostics have scoped declarations. No required case was skipped. The library browser fixture serves the built production shell through an isolated real HTTP application listener and seeds only its own in-memory SQL repository; authentication traverses the real signed provider. It introduces no application authentication bypass.

### Acceptance predicates and threat evidence

- **D-05/D-13, BOARD-01 adjacency/empty, T-03-06:** independent same-title identifiers and two independently seeded documents; creator Owner/private status despite supplied authority fields; default/trimmed titles; same-operation replay; committed-response reconciliation with one POST; explicit absent, blank and foreign targets; foreign text canary absence and unchanged owner descriptor; no IndexedDB canvas initialization.
- **D-14, BOARD-01 ordering, BOARD-02 adjacency/empty/encoding/ordering:** owner wins redundant Viewer grant without duplicate cards; pending-only and zero-grant labels; stable tie breaks and recent-first ordering across filters; all empty filters; 200-grapheme acceptance and 201-grapheme rejection without another row.
- **UI-HOME-empty/loading/error/populated/partial/overflow/zero-one-many/long-text:** all eight predicates have explicit browser assertions, including restored filter selection, noninteractive skeletons, no stale actionable cards, unavailable previews, metadata refusal, accessible full titles, normal single-card width and 50-card narrow/desktop layouts.
- **T-03-05:** inaccessible catalog rows and thumbnails reveal no foreign text/image canaries. Owner/Viewer allowed image reads return the correct distinct bytes; revocation, missing board and identity mismatch deny image bytes. SQL thumbnails remain unchanged after denials. Browser stale-generation and wrong-account responses never attach an image; prior object URLs cease resolving after refresh.

## TDD Gate Compliance

Both behavior-adding tasks followed observed RED, validated evidence, test commit, implementation and GREEN verification. Task 1 failed its create assertion with 404 instead of 201; task 2 failed its sharing assertion with Private instead of Shared. Both evidence records returned `RED_EVIDENCE_OK` before implementation. The TAP-only gate consumed explicitly labeled projections of actual Playwright/Vitest output. No optional refactor commit was needed.

## Deviations from Plan

### Required integration adaptations

1. **[Rule 1 - Bug] Authentication return-intent regression:** `tests/authentication.spec.ts` previously expected the empty shell for an absent explicit target. Updated it to require the approved denied state while retaining the signed-login and unchanged return-intent assertions. Authorized by the orchestrator; committed in `7e44490`.
2. **[Rule 1 - Bug] Migration rollback regression:** `server/auth/oidc.test.ts` assumed only migration 1 existed and selected version 2 for its deliberate rollback. The board migrations legitimately occupy versions 2 and 3. Snapshot the complete existing ledger, test idempotence, use the next unused version and assert unchanged ledger plus absent probe table after rollback. Authorized by the orchestrator; committed in `fbd9ea5`.

The library browser fixture initially attempted injection-only route fulfillment for authentication; real redirects escaped that interception and sign-in failed. Replaced it with an isolated actual application listener and the production static shell. This was a test-fixture correction; no authentication checks were weakened. The revoked-URL test's expected browser network diagnostic was explicitly scoped. Screenshot inspection corrected the subtitle color to the required meaningful-text token.

## Known Stubs

| File / line | Intentional boundary | Resolution |
|---|---|---|
| `src/App.tsx:28` | Authorized board transition awaits account canvas mounting in plan 03-06; permission is checked before displaying the canonical board title. | Plan 03-06, after plan 03-05 workspace conformance; also recorded as WINDOWS entry 7 |

This transition is explicitly required by this plan. It does not establish completed canvas editing, shared BOARD requirement acceptance or full Phase 3 acceptance. Thumbnail GET/storage are ready; thumbnail generation/publication belongs to subsequent resource/runtime integration. Legacy local documents remain untouched.

## Next Plan Integration

- `registerBoardRoutes(app, config, database, now)` applies board migration 2 and thumbnail migration 3. Later additive migrations must use unused version numbers.
- `requireBoardCapability(database, request, reply, boardId, capability, now)` re-reads the session and expected account, returns the authorized BoardRow or sends 401/409/404/403. Invoke inside later write transactions. `BoardRole`, `BoardCapability`, `canBoard` and `boardCapabilities` are exported.
- SQL names and resource associations follow the plan index: boards, board_grants, pending_grants, board_documents, operations and board_thumbnails. The root map is `spaces`; content map is `blocks`, seeded with affine:page version 2 and affine:surface version 5. Resource transports remain plan 03-04; full workspace compatibility remains plan 03-05.
- `GET /api/boards` returns a BoardSummary array; descriptor returns `{summary, rootDocId, contentDocId, capabilities, revision}`. Creation returns that descriptor; operation lookup returns `{status: 'completed', result}` or `{status: 'unknown'}` for the current member only.
- Session/config/identity helper interfaces and canonical POST `/api/logout` are preserved. Phase 3 remains executing with plan 03-04 next, 2 of 13 accepted phases and 17 of 26 completed plans.

## Evidence Limits and Operator Obligations

Actual-provider registration, claim mapping, real-provider acceptance, native assistive technology and actual browser zoom remain separately assigned phase acceptance. Current browser checks use production Chromium with synthetic data. Phase 4 recovery and Phase 5 live collaboration remain later scope. No new threat surface outside the plan's catalog/creation/thumbnail register was introduced.

Documentation checked: Yjs ([Subdocuments](https://docs.yjs.dev/api/subdocuments)) and better-sqlite3 ([API](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md)), plus installed pinned BlockSuite page/surface schemas. Context7 MCP and CLI were unavailable; official documentation and installed source provided the fallback.

## Self-Check: PASSED

All four task commits and all ten changed implementation/test files exist. Static checks, staged whitespace review, public-data review, server tests and the final browser slice passed. No tracked deletions or generated untracked outputs were introduced. Existing unrelated image assets and the orchestrator lock were preserved.
