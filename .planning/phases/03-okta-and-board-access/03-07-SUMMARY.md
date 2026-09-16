---
phase: 03-okta-and-board-access
plan: "07"
subsystem: access
tags: [oidc, sqlite, sharing, accessibility, idempotency]
requires:
  - phase: 03-06
    provides: Authorized account boards and native editor shell
provides:
  - Owner-authorized active and pending grants with revision and operation reconciliation
  - Trusted one-time pending activation bound to issuer and subject identity
  - Accessible reusable sharing dialog and owner library action
affects: [03-08, 03-12]
tech-stack:
  added: []
  patterns: [transactional grant authorization, observed-email ambiguity history, native modal sharing]
key-files:
  created: [server/boards/grants.ts, server/boards/grants.test.ts, src/boards/ShareBoardDialog.tsx, tests/board-sharing.spec.ts]
  modified: [server/boards/routes.ts, server/auth/oidc.ts, server/auth/identity-policy.ts, src/boards/BoardLibrary.tsx, src/index.css]
key-decisions:
  - Grant revisions use the monotonically increasing board revision to reject stale revoke/recreate forms.
  - Observed canonical email history is issuer-scoped ambiguity protection; active grants remain bound to member IDs.
  - Header sharing trigger remains in plan 03-08; the library mounts the reusable dialog now.
requirements-completed: []
requirements-progressed: [BOARD-03, BOARD-02, BOARD-04]
actuals:
  tokens: 19221
  basis: realized implementation diff characters divided by four, rounded up; 76882 characters
  model_token_usage: unavailable
  tasks: 2
  commits: 4
plan_head_before: d6ad9f3630f8f36297fa10becc11727e3fe2bae3
duration: 24min
completed: 2026-09-16
status: complete
---

# Phase 3 Plan 7: Internal Board Sharing Summary

**Owners can grant, change and revoke internal board access through an accessible dialog, with transactional authorization, stale-form protection and one-time trusted pending activation.**

## Task commits

1. Task 03-07-01 RED: `4dc1873` — specify owner sharing and Viewer default.
2. Task 03-07-01 GREEN: `9d80175` — owner-authorized active and pending sharing.
3. Task 03-07-02 RED: `d7085a0` — trusted activation and grant race boundaries.
4. Task 03-07-02 GREEN: `7209505` — trusted activation and accessible sharing states.

The four implementation/test commits were measured from the persisted plan ledger before this separate metadata commit. Model token consumption was unavailable; the numeric actual is explicitly a diff-size estimate.

## Verification evidence

| Command | Executed result |
|---|---|
| `npm run typecheck` | Passed after final edits |
| `npm run typecheck:server` | Passed after final edits |
| `npm exec playwright test -- tests/board-sharing.spec.ts --project=prod --grep '@03-07-01'` | 3 passed, 21.4 seconds |
| `npm run test:server -- server/boards/grants.test.ts` | Final focused gate: 16 passed, 2.47 seconds |
| `npm exec playwright test -- tests/board-sharing.spec.ts --project=prod` | Final browser gate: 11 passed, 47.5 seconds; fresh production build and isolated signed-provider HTTP fixture |
| `npm run test:server -- server/boards/grants.test.ts server/auth/oidc.test.ts` | Intermediate gate: 72 passed, 7.37 seconds |
| `npm run test:server` | 101 passed, 7.94 seconds; ran before the last duplicate-convergence test was added. That added test passes in the final 16-case focused run. |
| `npm test` | 95 passed, 1.25 seconds |
| Parent independent wave gate at `7209505`: build, unit and full server suites | Production build passed; 95 unit and 102 server tests passed. Full server runner: 7.74 seconds (8.1 seconds wall). This includes the final convergence case. |

No required automated case is skipped in the final focused or full gates. The intentionally targeted RED run selected one test; its unselected tests are not acceptance omissions. Browser fixture uses signed OIDC login through the ordinary application boundary and retains the existing automatic runtime-error collector. Expected synthetic HTTP failures are explicitly listed in the fixture. The user's local board and development port were untouched.

### Observable acceptance

- D-06/D-07: new selections default to Viewer, Editor requires selection, pending and active rows stay distinct, trusted first sign-in activates once, revoked pending access stays absent, and existing active/pending duplicates converge without replacing the active role.
- D-08: clipboard failure exposes a selectable board URL; owner grant rereads remain equal before and after copying. Direct unauthorized access still denies.
- D-12/T-03-15/T-03-16: separately signed editor, viewer and non-member sessions cannot read/search/mutate grants. Owner rereads stay unchanged. Owner rows expose no mutation controls; direct owner-grant mutation rejects. In-flight expiry, session loss and ownership loss are rechecked after the existing beforeCommit seam inside the transaction. Concurrent revoke/update and revoke/recreate reject stale revision writes.
- T-03-14: stable issuer/subject identity retains grants through email changes. Missing/false verification, external membership, wrong issuer, same-email subjects and observed recycled-email ambiguity cannot activate pending access. Domain normalization uses IDNA and lowercase; local-part case and aliases remain intact unless the operator enables case folding.
- UI-SHARE-empty/partial/populated: invalid and external input stays disabled, no matches has recovery copy, Owner/Editor/Viewer and active/pending states render, and owner-control loss closes the stale dialog.
- UI-SHARE-loading/error: stale search responses are ignored; search and grant/revoke failures expose recovery; only the affected row is busy. A real ten-second timeout after server commit reconciles the operation and rereads current grants without sending another mutation. An unresolved operation locks conflicting row actions and exposes Check access.
- UI-SHARE-overflow/zero-one-many/long-text: 0, 1 and 50 access/search rows, 120-character unbroken identities/titles, deterministic equal-name ordering, 490px viewport, vertical body scrolling, visible footer, unobscured focused controls and 44px minimum targets pass. Named revoke defaults focus to Keep access and returns focus after acknowledgment. Combobox arrows, Enter, Escape, focus containment/return and constructed IME-composition Enter suppression pass.

## Interfaces and downstream handoff

- `ShareBoardDialog({ board, onClose, onChanged })` accepts the existing account-bound `BoardSummary`. Key it by board ID plus account ID. `onChanged(state?)` receives authoritative `{ revision, owner, grants }` after a reread; an undefined state requests parent permission/library refresh after access loss. The library updates private/shared and pending counts without destroying the invoking card, preserving focus return. Plan 03-08 owns mounting the same dialog from the native header.
- `GET /api/members?q=...&boardId=...` is owner-only, limits query to 254 characters and results to 50 established same-issuer members, ordered by display name, email and ID. It returns `{ members, pendingEmail }`; an eligible email remains pending until trusted identity processing.
- `GET /api/boards/:boardId/grants` returns the current board revision, immutable owner row, and deterministically sorted grants. Each grant has an opaque ID, role, status, revision, identity/email and optional member ID. Pending IDs include issuer and canonical email, so distinct issuers cannot collide.
- `POST .../grants` requires board `revision` and `operationId`, plus `memberId` or `email`, with optional `role` defaulting to Viewer. `PATCH/DELETE .../grants/:grantId` require the grant revision and operation ID. PATCH also requires a role. Conflicts return 409; malformed/ineligible recipients return 400. Duplicate creation preserves the acknowledged role; absent revocation is harmless. Mutations return the current grant state.
- Grant operation fingerprints include method, board, recipient/grant, revision and payload. Reuse with different semantics returns 409. The existing current-account operations endpoint provides completed/unknown reconciliation. Clients reread current grants after reconciliation, so an old operation response cannot restore old UI state.
- **Migration 5** adds `members.email_history TEXT NOT NULL DEFAULT '[]'`, seeds existing canonical emails and adds the `(issuer, canonical_email)` index. History is retained per stable member within the same validated identity/profile transaction as pending activation. It records observed ambiguity, never proves membership by itself. No new table or dependency was added.
- Grant mutation revisions derive from `boards.revision + 1`. Plan 03-08 must keep board revisions monotonic when adding rename/delete/duplicate. Active access remains authorized by member ID after profile changes. Pending activation never overwrites an existing active role.

## TDD gate compliance

Both tasks had a committed intentional assertion failure before their implementation. Task 1's signed browser reached its owner library and failed because Share board was absent. Task 2's signed callback succeeded but the expected active grant remained pending. Both evidence records passed `check tdd-red-evidence` with `RED_EVIDENCE_OK`; transient normalized records and raw logs remain outside the repository. Initial test-only corrections removed an unused import, retained the pre-login cookie for expected denied callbacks, and scoped custom combobox options separately from native role-select options. Final acceptance passed without weakening the behavior assertions. No refactor-only commit was needed.

## Deviations and evidence limits

- No extra implementation file ownership was needed: all nine assigned files are the complete implementation scope. Summary/state/roadmap and the cross-phase defect register are tracking artifacts.
- The parent confirmed that plan 03-08 owns header Share integration; this plan delivers the library trigger and reusable dialog as its task specifies.
- **Native 200% browser zoom remains unrun**, recorded as WINDOWS entry 8 for plan 03-12 acceptance. The automated 490px geometry test proves narrow viewport behavior. Native screen-reader speech and OS IME text production were not claimed; programmatic roles, focus and composition-event routing were tested.
- Actual-provider mapping and private operator acceptance remain plan 03-12-02. Synthetic evidence does not complete AUTH-01 or the shared BOARD requirements; all remain open until phase acceptance.
- Build warnings about existing chunk size/dynamic imports and Node's localStorage warning remain unchanged and out of scope.
- The state helper reset accepted phase counts to zero; tracking was repaired to preserve 2/13 accepted phases, 21/26 completed plans and next plan 03-08.

## Known stubs and threat review

No goal-blocking placeholder or mock application data source was introduced. Empty React collection state is populated from authenticated requests. New endpoints and the observed-email column remain within this plan's declared browser/service and identity/storage trust boundaries. T-03-14, T-03-15 and T-03-16 have direct runtime denial/state-preservation coverage. Real-provider trust semantics remain explicitly unaccepted.

## Self-Check: PASSED

All nine implementation files exist. All four listed commits exist on the task branch, and the persisted ledger reports four implementation/test commits from the recorded base. Both tasks and their automated verification commands completed. Native zoom and real-provider acceptance remain separately recorded final-phase obligations.
