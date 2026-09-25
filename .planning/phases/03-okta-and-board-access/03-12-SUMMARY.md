---
phase: 03-okta-and-board-access
plan: "12"
status: complete
subsystem: acceptance
tags: [oidc, authorization, native-canvas, uat, recovery]
requires:
  - phase: 03-01-through-03-11
    provides: Authenticated board lifecycle, role boundaries and account recovery
provides:
  - Refreshed whole-project acceptance for the approved Phase 3 scope
  - Explicit human acceptance and operator-controlled deferred follow-ups
affects: [04-durable-boards-and-recovery]
tech-stack:
  added: []
  patterns: [source-frozen-acceptance, font-ready-native-metrics]
key-files:
  created: [03-12-SUMMARY.md]
  modified: [src/canvas/BlockSuiteCanvas.tsx, src/header/BoardTitleMenu.tsx, tests/community.spec.ts, tests/board-title.spec.ts, src/canvas/canvas-fonts.ts, src/canvas/blocksuite-editor.ts, src/index.css, tests/connector-labels.spec.ts, tests/authentication.spec.ts, tests/board-access.spec.ts, tests/board-actions.spec.ts, tests/board-roles.spec.ts]
key-decisions:
  - Actual-provider configuration and acceptance remain deferred to backlog 999.4 until operator access is available.
  - Assistive-technology speech and interaction remain deferred to backlog 999.3.
  - Optional browser-local copying was waived and replaced with explicit file import into a new private owned board.
requirements-completed: [AUTH-01, BOARD-01, BOARD-02, BOARD-03, BOARD-04]
completed: 2026-09-25
---

# Phase 3 Plan 12: Access Acceptance

The current OIDC and authorized-board workflows have recorded automated and user acceptance, with real-provider and assistive-technology follow-ups explicitly deferred by the user.

## Task outcomes

1. **03-12-01 — Automated acceptance:** passed the fresh complete gate at `63f352b`; exact results and source hashes were reconciled.
2. **03-12-02 — Operator acceptance:** user deferred actual provider setup and acceptance to backlog 999.4. Generic OIDC protocol, membership and board authorization remain implemented and tested with the signed synthetic provider. No real-provider pass is claimed.

## Human acceptance

[03-UAT.md](03-UAT.md) (authoritative checklist) records **7 passes, 3 approved skips, 0 issues and 0 pending items**. The user accepted native browser zoom, BFCache restoration, OS IME, native Firefox/WebKit clipboard, Dali-only logout and pending-access wording. The seventh pass is the scoped repository privacy judgment in [03-UAT-REVIEW.md](03-UAT-REVIEW.md) (evidence, boundaries and deferrals). The user's native observations have no recorded browser versions or private traces; automated synthetic checks retain their own limits.

Actual-provider work is backlog 999.4; screen-reader speech and interaction are backlog 999.3. The third skip is the user-waived optional local-copy workflow. Its menu was removed and file picker/drag-and-drop import now creates a new private board owned by the importer. The earlier local-copy plan and reports retain historical scope; they are not current UI instructions.

## Corrections exposed by final acceptance

- `e1f0cd5` restored 44px header controls and constrained long inline titles, and refreshed assertions for approved account-role placement, saved-age text, design colors and session fields. The later control, canary, unchanged-byte, navigation and focus oracles remain intact.
- `b4755ab` loads bundled fonts before native cached measurements, supports bounded failure/retry, and keeps the open mind-map inspector above a repositioned canvas toolbar. Existing geometry/history assertions remain; new delayed-font and timeout/retry cases prove saved connector dimensions survive reopening.
- `f8e87db` preserves Layers precedence over contextual properties.
- `e5a0739` preserves title focus through delayed Firefox blur; 400 diagnostic renames and the permanent bounded regression passed.
- `63f352b` cancels stale native mounting before attachment, immediately disposes an in-progress view and keeps it bound to its supplied authorized runtime; all 144 focused mount/font/recovery checks passed.
- `bcee05f` records the user's final pending-access pass. The file-import replacement is recorded in `07f3170` / `5c7fe7a`.

The failed and intentionally interrupted attempts remain in [03-12-CHECKPOINT.md](03-12-CHECKPOINT.md) (revision-specific counts, diagnoses and original obligations). They are not counted as passing evidence.

## Verification

All seven blocking commands passed on source/test commit `63f352b7a955bff176143d51bd64431b04777d81`. The 190 tracked source/test/configuration hashes matched before and after execution. Commands ran sequentially with isolated synthetic services and the configured single worker. No required case was skipped, retried or left unrun.

| Command | Result | Outer duration |
| --- | --- | ---: |
| `npm run typecheck` | Passed | 4.5s |
| `npm run typecheck:server` | Passed | 1.3s |
| `npm test` | Passed | 1.9s |
| `npm run test:server` | Passed | 8.2s |
| `npm run build` | Passed | 12.9s |
| `npm run test:access -- --reporter=list,json` | Passed | 271.5s |
| `npm run test:browser -- --reporter=list,json` | Passed | 3808.9s |

Unit tests: **110/110**. Server tests: **116/116**. Standalone access: **124/124** (270.9s runner duration). Full browser matrix: **1,658/1,658** (3808.3s; 63.5m runner duration). Full-matrix projects: development 388, production Chromium 382, Firefox 382, WebKit 382, access 124. Failures, timeouts, skips, retries, interruptions and unrun cases: **zero**. Standalone access cases also appear in the full matrix; these are separate runs, not disjoint coverage totals.

The validated working tree retained pre-existing package-script additions. They were included in the source fingerprint and left outside acceptance commits, alongside the user's README/artwork changes. Existing build warnings remain documented in raw execution output; the build exited successfully.


## Evidence limits and next phase

All browser identities, boards, content and provider settings in automated checks are synthetic. Operator secrets, tenant settings and real-provider traces remain outside repository content. Bounded privacy scans and code review do not replace publication-time inspection. User-owned README, package-script and artwork work was left outside the acceptance commits.

Phase 4 will establish its own cross-browser/service-restart persistence, deployment and backup/restore acceptance. Phase 3's preliminary persistence and recovery evidence does not complete SAVE-01, SAVE-02, OPS-01 or OPS-02.
