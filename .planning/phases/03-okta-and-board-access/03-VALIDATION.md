---
phase: "03"
slug: "okta-and-board-access"
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-09-16"
---

# Phase 3 — Validation Strategy

This execution and coverage record derives from [03-RESEARCH.md](03-RESEARCH.md) (OIDC, board-scoped storage and authorization) and [03-UI-SPEC.md](03-UI-SPEC.md) (approved interface states). Plans 03-01 through 03-11 have recorded focused verification. The final source and fixture revision is `73416723411ca2c5b98de090f6d5327ed9e076c7`, with application code unchanged from `6d6dade`. Its guarded complete browser matrix passed all **1,533 cases in 57.1m**, with zero failures, timeouts, skips, interruptions or unrun cases. Automated coverage and Wave 0 are complete. Actual-provider, native-observation and flagged-prohibition acceptance retain their separate pending status.

## Test Infrastructure

| Property | Value |
|---|---|
| Frameworks | Vitest 4.1.11 and Playwright 1.62.1 |
| Static/unit commands | `npm run typecheck`, `npm test`, `npm run build` |
| Browser configuration | `playwright.config.ts`; dev, prod, prod-firefox, prod-webkit and access projects |
| Server configuration | `vitest.server.config.ts`, explicit Node test environment and test include |
| Quick command | `npm run test:server` — bounded signed-protocol and route/policy suites |
| Authenticated browser command | `npm run test:access` — access project, local backend and signed synthetic OIDC provider |
| Final suite | `npm run typecheck && npm run typecheck:server && npm test && npm run test:server && npm run build && npm run test:access && npm run test:browser` |
| Timing | Focused server checks target under 30 seconds after setup; measure actual duration during execution. Browser/build startup is reported separately. |

## Sampling Rate

- Every implementation task runs typecheck and its focused behavioral checks before commit.
- Every wave runs server policy/auth checks plus the affected authenticated browser slice.
- Before requirement verification, run the complete static/unit/build/access suite and the existing canvas browser regressions with authenticated fixtures.
- Every runnable task command states its failure oracle. Nonzero exit, zero matched cases, skipped required cases or a missing expected assertion fails verification. No watch mode or pass-with-no-tests.
- A test declaration alone is not execution evidence. Behavioral regression corrections retain their observed failing assertion and verified passing result; environmental failures are identified separately.
- Browser tests retain the existing unexpected-runtime-error collector. Expected injected 401/403 responses are narrowly declared; broad error suppression is disallowed.
- Production builds and browser servers share one exclusive execution slot. Independent source ownership does not authorize parallel writes to build outputs, database fixtures or browser ports.

## Requirement Verification Map

The twelve executable plans own these implemented test targets. The per-task evidence table links recorded focused results; final-gate and operator outcomes appear below.

| Requirement / decision | Required behavior and oracle | Target | Task ownership |
|---|---|---|---|
| AUTH-01; D-01/D-03/D-04 | Signed OIDC callbacks, session lifetime and Dali-only logout | server/auth/oidc.test.ts; tests/authentication.spec.ts | 03-02-01/02 |
| BOARD-01; D-05/D-13/D-15 | Private create/reopen, denied targets and unique new-tab operations | tests/board-access.spec.ts | 03-03-01; 03-06-01/02 |
| BOARD-02; D-14 | Authorized cards, status/role/order/filter and protected thumbnails | server/boards/library.test.ts; tests/board-library.spec.ts | 03-03-02 |
| BOARD-03; D-06–D-08/D-12 | Owner grant lifecycle, verified pending activation and stale revision/commit denials | server/boards/grants.test.ts; tests/board-sharing.spec.ts | 03-07-01/02 |
| BOARD-04 | All doc/sync/image routes with foreign canary and no-state-change oracles | server/boards/access.test.ts; source adapter unit tests | 03-04-01/02 |
| BOARD-01/04; D-10–D-12 | Role-aware rename/duplicate/delete with isolated destination and intact source | tests/board-actions.spec.ts | 03-08-01/02 |
| BOARD-04; D-09–D-12 | Native Viewer mutations inert, PNG/PDF allowed and editable actions denied | tests/board-roles.spec.ts | 03-09-01/02 |
| AUTH-01; D-02/D-16 | Pending image/edit recovery, same account/role, stale tabs and BFCache | tests/session-recovery.spec.ts | 03-10-01/02/03 |
| BOARD-01; D-16 | Selected atomic image-complete copy, original retention and idempotent partial retry | tests/local-board-import.spec.ts | 03-11-01/02/03 |
| BOARD-01/04; runtime | Public workspace, native parity, isolated staging, zero-write Viewer and disposal | tests/account-workspace.spec.ts with dev-only harness | 03-05-01/02 |
| All; final acceptance | Complete matrix/UI/native regression and separate actual-provider oracle | tests/access-boundaries.spec.ts; tests/accessibility-access.spec.ts; docs/access-acceptance.md | 03-12-01/02 |

## Wave 0 Requirements

- [x] Server scripts/configuration and native SQLite load/transaction smoke.
- [x] Isolated temporary database migrations, injected clock and cleanup for each fixture.
- [x] Test-only synthetic OIDC provider with discovery, JWKS, authorization, token and UserInfo; real signed tokens and protocol validation.
- [x] Four separate synthetic member contexts plus foreign-board text/image canaries.
- [x] Production-mode rejection of test-auth enablement and absence of bypass routes.
- [x] Account workspace conformance fixture and zero-write lifecycle assertions.
- [x] Explicit existing canvas fixture adaptation; real authenticated sessions replace assumptions of immediate anonymous startup.

Evidence: `03-01-SUMMARY.md` (native dependency/provider/database setup), `03-02-SUMMARY.md` (signed authentication and bypass rejection), `03-05-SUMMARY.md` (six dev workspace conformance cases), and subsequent authenticated fixture/canary suites. The Nyquist auditor inspected all seven prerequisites and their prior measured results. Historical pre-install provenance timing remains unattested as recorded in `03-SECURITY.md`.

## Manual-Only Verifications

| Behavior | Requirement | Why operator involvement is required | Procedure and evidence boundary |
|---|---|---|---|
| Actual Okta application and trusted claim mapping | AUTH-01; BOARD-03 | Provider registration, assignments, secrets and directory email semantics are controlled externally | Supply issuer/client/callback and membership policy outside the repository; use two assigned synthetic test members and a denied identity. Exercise login/target restoration, persistent session, expiry, local logout, pending verified-email activation and denial. Keep configuration/evidence private. Public outcome stays not run until the operator reports acceptance. |
| Native assistive technology or browser zoom unavailable to automation | UI contract | Emulated viewport/keyboard events do not prove every native environment | Execute only uncovered native focus, screen-reader announcement and 200% zoom steps; report exact environment and remaining limits. Do not require duplicate manual testing for automated, observable behavior. |

## Security and Evidence Boundaries

Each plan includes an ASVS level 1 threat model and connects each threat to test ownership. Authentication/authorization are enforced by server requests and state-change oracles, not control visibility. PNG/PDF and editable-export action policy is distinct from preventing an authorized viewer reconstructing content already received for rendering.

Current HTTP request authorization belongs to Phase 3. Phase 4 retains restart/recovery/backup/deployment acceptance; Phase 5 retains real-time transport, presence, active-connection revocation, reconnection and 20-user acceptance. Phase 3 outbox preservation during authentication remains mandatory.

## Validation Sign-Off

- [x] Each task has automated verification or explicit test-creation prerequisites.
- [x] Task/threat map matches the final PLAN.md set.
- [x] Every required test target is created before its command runs.
- [x] Sampling continuity has no three unchecked consecutive tasks.
- [x] Commands have failure oracles and no watch mode.
- [x] Runtime timings and execution evidence are recorded.
- [x] Actual-provider status is reported separately.

**Planning approval:** checked on 2026-09-16; zero blockers/warnings and one informational concurrency advisory. See [03-PLAN-CHECK.md](03-PLAN-CHECK.md) (independent review and deterministic checks). **Execution evidence:** prior focused GREEN for all 24 implementation tasks, current static/unit/server/build/access and complete 1,533-case matrix GREEN at `7341672`. Wave 0 and automated coverage compliance are complete. Actual-provider/native acceptance remains independently pending.

## Spec-less Edge Coverage

No standalone phase SPEC exists. The deterministic edge probe classified the five requirements using explicit text, collection, stateful, I/O and session-lifetime boundary shapes. All 24 raised items have explicit planned acceptance; none were dismissed. The planner lifts each predicate into must_haves and assigns execution tests. The Nyquist auditor traced all 24 predicates to assertion-bearing tests and prior focused results. The table preserves the approved predicates; the current complete gate below supplies executed automated acceptance.

| Requirement / category | Status | Verification | Planned predicate |
|---|---|---|---|
| AUTH-01 / boundary | resolved | explicit | AUTH-01 boundary: authorization accepts a session only before its configured expiry; at expiry and afterward it rejects protected reads/writes and enters the D-02 recovery state. |
| AUTH-01 / empty | resolved | explicit | AUTH-01 empty: absent or incomplete OIDC configuration produces a recoverable configuration error; missing state, nonce, code or required identity claims establishes no session. |
| AUTH-01 / encoding | resolved | explicit | AUTH-01 encoding: canonical member identity uses the exact validated issuer and subject; email or display-name changes do not create an automatic identity merge. |
| AUTH-01 / precision | resolved | explicit | AUTH-01 precision: session expiry uses one documented time unit with safe finite integer validation; zero, negative, NaN, overflow and clock-boundary tests fail closed. |
| AUTH-01 / idempotency | resolved | explicit | AUTH-01 idempotency: an authorization callback is single-use, repeated sign-out is harmless, and explicit sign-out remains signed out until Sign in again is chosen. |
| AUTH-01 / concurrency | resolved | explicit | AUTH-01 concurrency: simultaneous expiry/sign-out/account-switch events cannot replay pending board changes under a different member or a revoked role. |
| BOARD-01 / adjacency | resolved | explicit | BOARD-01 adjacency: boards with identical titles retain distinct stable IDs and independent documents, images and grants. |
| BOARD-01 / empty | resolved | explicit | BOARD-01 empty: an empty library offers board creation; blank new titles produce Untitled board; missing or unauthorized board IDs never create a fallback board. |
| BOARD-01 / encoding | resolved | explicit | BOARD-01 encoding: Unicode board titles survive creation, rename, library display and reopen without losing grapheme content within the documented title bound. |
| BOARD-01 / ordering | resolved | explicit | BOARD-01 ordering: the library sorts updated time descending with a stable board-ID tie breaker. |
| BOARD-01 / idempotency | resolved | explicit | BOARD-01 idempotency: retries of one create, duplicate or import operation return the same completed board rather than creating extra copies. |
| BOARD-01 / concurrency | resolved | explicit | BOARD-01 concurrency: each new-tab creation receives a distinct operation identity; interrupted creation/import keeps source local work and exposes only committed authorized copies. |
| BOARD-02 / adjacency | resolved | explicit | BOARD-02 adjacency: an accessible board appears once even when ownership and a redundant membership record coexist; ownership determines the displayed role. |
| BOARD-02 / empty | resolved | explicit | BOARD-02 empty: All, Mine and Shared with me each have an accessible empty state with no unauthorized metadata or thumbnails. |
| BOARD-02 / encoding | resolved | explicit | BOARD-02 encoding: role and access labels use stable enums and visible text; long Unicode titles retain an accessible full name. |
| BOARD-02 / ordering | resolved | explicit | BOARD-02 ordering: all library filters retain the same updated-time-descending, board-ID tie-break ordering. |
| BOARD-03 / adjacency | resolved | explicit | BOARD-03 adjacency: duplicate pending or active grants for one trusted internal identity converge to one effective role; owner rights cannot be replaced by a grant. |
| BOARD-03 / empty | resolved | explicit | BOARD-03 empty: empty/invalid/external email and search with no matches do not create a grant; the owner can enter a valid internal email to create a pending Viewer grant. |
| BOARD-03 / encoding | resolved | explicit | BOARD-03 encoding: email matching follows the documented trusted-provider normalization policy; unverified, ambiguous or cross-issuer matches never activate pending grants. |
| BOARD-03 / ordering | resolved | explicit | BOARD-03 ordering: member-search and sharing lists use deterministic ordering so refresh does not arbitrarily move equal display names. |
| BOARD-03 / idempotency | resolved | explicit | BOARD-03 idempotency: repeated grant/update/revoke requests have a single resulting grant state; revoking an already absent grant does not restore access. |
| BOARD-03 / concurrency | resolved | explicit | BOARD-03 concurrency: grant mutations are authorized at commit time; stale owner forms or overlapping role changes cannot restore a revoked grant silently. |
| BOARD-04 / idempotency | resolved | explicit | BOARD-04 idempotency: repeating denied document, synchronization, image or mutation requests always denies them without creating data or revealing board existence through content. |
| BOARD-04 / concurrency | resolved | explicit | BOARD-04 concurrency: every protected request rechecks current session and board role; an in-flight mutation that loses access before commit cannot persist or acknowledge success. |

The independently checked UI contract additionally has 39 explicit UI-state predicates. The Nyquist auditor mapped all 39 to actual suites: AUTH 4, HOME 8, TITLE 5, SHARE 8, COPY 8 and CANVAS 6. The complete automated gate passed; uncovered native predicates remain separately pending.

## Executable Task, Threat and Command Map

These commands retain plan ownership and observable failure oracles. The targets now exist. Account conformance uses dev and is excluded from production/access projects. The 24 implementation tasks have prior focused GREEN evidence in their corresponding summaries; the complete current-source browser pass is recorded separately below.

| Task | Wave | Threats | Automated command | Evidence |
|---|---:|---|---|---|
| 03-01-01 | 1 | T-03-SC, T-03-01 | `npm run typecheck && npm run typecheck:server && npm run test:server -- server/preflight.test.ts` | Prior focused GREEN: 03-01-SUMMARY.md; current complete matrix GREEN at 7341672 |
| 03-01-02 | 1 | T-03-SC, T-03-01 | `npm run server:build && node .gsd/access-build/tests/oidc-provider.js --self-test && npm run typecheck` | Prior focused GREEN: 03-01-SUMMARY.md; current complete matrix GREEN at 7341672 |
| 03-02-01 | 2 | T-03-02, T-03-03, T-03-04 | `npm run typecheck && npm run typecheck:server && npm exec playwright test -- tests/authentication.spec.ts --project=prod --grep "@03-02-01"` | Prior focused GREEN: 03-02-SUMMARY.md; current complete matrix GREEN at 7341672 |
| 03-02-02 | 2 | T-03-02, T-03-03, T-03-04 | `npm run typecheck && npm run typecheck:server && npm run test:server -- server/auth/oidc.test.ts && npm exec playwright test -- tests/authentication.spec.ts --project=prod` | Prior focused GREEN: 03-02-SUMMARY.md; current complete matrix GREEN at 7341672 |
| 03-03-01 | 3 | T-03-05, T-03-06 | `npm run typecheck && npm run typecheck:server && npm exec playwright test -- tests/board-access.spec.ts --project=prod --grep "@03-03-01"` | Prior focused GREEN: 03-03-SUMMARY.md; current complete matrix GREEN at 7341672 |
| 03-03-02 | 3 | T-03-05, T-03-06 | `npm run typecheck && npm run test:server -- server/boards/library.test.ts && npm exec playwright test -- tests/board-library.spec.ts --project=prod --grep "@03-03-02"` | Prior focused GREEN: 03-03-SUMMARY.md; current complete matrix GREEN at 7341672 |
| 03-04-01 | 4 | T-03-07, T-03-08, T-03-09 | `npm run typecheck && npm run typecheck:server && npm run test:server -- server/boards/access.test.ts -t '@03-04-01' && npm test -- src/canvas/account/doc-source.test.ts` | Prior focused GREEN: 03-04-SUMMARY.md; current complete matrix GREEN at 7341672 |
| 03-04-02 | 4 | T-03-07, T-03-08, T-03-09 | `npm run typecheck && npm run test:server -- server/boards/access.test.ts -t '@03-04-02' && npm test -- src/canvas/account/blob-source.test.ts` | Prior focused GREEN: 03-04-SUMMARY.md; current complete matrix GREEN at 7341672 |
| 03-05-01 | 5 | T-03-10, T-03-11 | `npm run typecheck && npm run typecheck:server && npm exec playwright test -- tests/account-workspace.spec.ts --project=dev --grep "@03-05-01"` | Prior focused GREEN: 03-05-SUMMARY.md; current complete matrix GREEN at 7341672 |
| 03-05-02 | 5 | T-03-10, T-03-11 | `npm run typecheck && npm exec playwright test -- tests/account-workspace.spec.ts --project=dev --grep "@03-05-02"` | Prior focused GREEN: 03-05-SUMMARY.md; current complete matrix GREEN at 7341672 |
| 03-06-01 | 6 | T-03-12, T-03-13 | `npm run typecheck && npm exec playwright test -- tests/board-access.spec.ts --project=prod --grep "@03-06-01"` | Prior focused GREEN: 03-06-SUMMARY.md; current complete matrix GREEN at 7341672 |
| 03-06-02 | 6 | T-03-12, T-03-13 | `npm run typecheck && npm exec playwright test -- tests/board-access.spec.ts tests/mindmap.spec.ts tests/image-import.spec.ts --project=prod` | Prior focused GREEN: 03-06-SUMMARY.md; current complete matrix GREEN at 7341672 |
| 03-07-01 | 7 | T-03-14, T-03-15, T-03-16 | `npm run typecheck && npm run typecheck:server && npm exec playwright test -- tests/board-sharing.spec.ts --project=prod --grep "@03-07-01"` | Prior focused GREEN: 03-07-SUMMARY.md; current complete matrix GREEN at 7341672 |
| 03-07-02 | 7 | T-03-14, T-03-15, T-03-16 | `npm run typecheck && npm run test:server -- server/boards/grants.test.ts && npm exec playwright test -- tests/board-sharing.spec.ts --project=prod` | Prior focused GREEN: 03-07-SUMMARY.md; current complete matrix GREEN at 7341672 |
| 03-08-01 | 8 | T-03-17, T-03-18, T-03-19 | `npm run typecheck && npm run typecheck:server && npm exec playwright test -- tests/board-actions.spec.ts --project=prod --grep "@03-08-01"` | Prior focused GREEN: 03-08-SUMMARY.md; current complete matrix GREEN at 7341672 |
| 03-08-02 | 8 | T-03-17, T-03-18, T-03-19 | `npm run typecheck && npm exec playwright test -- tests/board-actions.spec.ts --project=prod --grep "@03-08-02"` | Prior focused GREEN: 03-08-SUMMARY.md; current complete matrix GREEN at 7341672 |
| 03-09-01 | 9 | T-03-20, T-03-21 | `npm run typecheck && npm exec playwright test -- tests/board-roles.spec.ts --project=prod --grep "@03-09-01"` | Prior focused GREEN: 03-09-SUMMARY.md; current complete matrix GREEN at 7341672 |
| 03-09-02 | 9 | T-03-20, T-03-21 | `npm run typecheck && npm exec playwright test -- tests/board-roles.spec.ts tests/mindmap-export.spec.ts --project=prod --grep "@03-09-02\|@02-06"` | Prior focused GREEN: 03-09-SUMMARY.md; current complete matrix GREEN at 7341672 |
| 03-10-01 | 9 | T-03-22, T-03-23, T-03-24 | `npm run typecheck && npm exec playwright test -- tests/session-recovery.spec.ts --project=prod --grep "@03-10-01"` | Prior focused GREEN: 03-10-SUMMARY.md; current complete matrix GREEN at 7341672 |
| 03-10-02 | 9 | T-03-22, T-03-23, T-03-24 | `npm run typecheck && npm exec playwright test -- tests/session-recovery.spec.ts --project=prod --grep "@03-10-02"` | Prior focused GREEN: 03-10-SUMMARY.md; current complete matrix GREEN at 7341672 |
| 03-10-03 | 9 | T-03-22, T-03-23, T-03-24 | `npm run typecheck && npm exec playwright test -- tests/session-recovery.spec.ts --project=prod --grep "@03-10-03"` | Prior focused GREEN: 03-10-SUMMARY.md; current complete matrix GREEN at 7341672 |
| 03-11-01 | 10 | T-03-25, T-03-26, T-03-27 | `npm run typecheck && npm run typecheck:server && npm exec playwright test -- tests/local-board-import.spec.ts --project=prod --grep "@03-11-01"` | Prior focused GREEN: 03-11-SUMMARY.md; current complete matrix GREEN at 7341672 |
| 03-11-02 | 10 | T-03-25, T-03-26, T-03-27 | `npm run typecheck && npm exec playwright test -- tests/local-board-import.spec.ts --project=prod --grep "@03-11-02"` | Prior focused GREEN: 03-11-SUMMARY.md; current complete matrix GREEN at 7341672 |
| 03-11-03 | 10 | T-03-25, T-03-26, T-03-27 | `npm run typecheck && npm exec playwright test -- tests/local-board-import.spec.ts --project=prod --grep "@03-11-03"` | Prior focused GREEN: 03-11-SUMMARY.md; current complete matrix GREEN at 7341672 |
| 03-12-01 | 11 | T-03-28, T-03-29, T-03-30 | `npm run typecheck && npm exec playwright test -- tests/access-boundaries.spec.ts tests/accessibility-access.spec.ts --project=prod --grep "@03-12-smoke"` | Final smoke 2/2 GREEN; complete matrix 1533/1533 GREEN at 7341672 |
| 03-12-02 | 11 | T-03-28, T-03-29, T-03-30 | `npm run test:server -- server/auth/oidc.test.ts server/boards/grants.test.ts` | human_needed; actual-provider precondition absent; synthetic checks do not accept it |

Every command inherits its task's observable fails_when and the nonzero/zero-selected/skipped-required failure rule. The checkpoint's rerun proves synthetic policy only. All browser/build checks share one exclusive slot.

**Blocking final phase gate:** `npm run typecheck && npm run typecheck:server && npm test && npm run test:server && npm run build && npm run test:access && npm run test:browser`. Execute it after focused task checks and before actual-provider acceptance or phase completion. Record exact cases/timings; any failing or skipped required assertion blocks completion.

The [03-PLAN-INDEX.md](03-PLAN-INDEX.md) (26-task ordering, 24 edge mappings and 39 UI-to-task/test mappings) is the complete predicate ownership map. Task03-12-01 checks equality with executed cases. No three consecutive tasks lack a runnable check.

### Threat verification ownership

| Threat | Plan | Severity | Required oracle |
|---|---|---|---|
| T-03-SC | 03-01 | high | Exact registry/source/integrity and lifecycle preflight; native load smoke in 03-01-01 |
| T-03-01 | 03-01 | high | Separate test-only provider; no application bypass route; production checks in 03-02-02 |
| T-03-02 | 03-02 | high | Library validation and signed negative callback matrix in 03-02-02 |
| T-03-03 | 03-02 | high | Issuer/subject key; policy fail closed; expiry and rotation tests |
| T-03-04 | 03-02 | high | Exact origin, X-Dali-Request and expected-member guard; logout tests |
| T-03-05 | 03-03 | high | Authorized SQL query; metadata/preview no-store and foreign canaries |
| T-03-06 | 03-03 | high | Server assigns owner and root/content IDs; no client owner/grant trust |
| T-03-07 | 03-04 | high | Composite resource binding and foreign canaries in 03-04-01/02 |
| T-03-08 | 03-04 | high | Yjs merge plus same-transaction session/role/identity checks |
| T-03-09 | 03-04 | high | Finite byte limits, controlled Yjs decode and PNG/JPEG validation |
| T-03-10 | 03-05 | high | One-board metadata, foreign subdoc rejection and account-switch canaries |
| T-03-11 | 03-05 | high | Authoritative load, zero-write counters and before/after server bytes |
| T-03-12 | 03-06 | high | Authorize before mount and bind generation |
| T-03-13 | 03-06 | high | Distinct operation identity; account path cannot execute local deferred deletion |
| T-03-14 | 03-07 | high | Stable subject binding, trusted verified email and collision tests |
| T-03-15 | 03-07 | high | Owner/identity/expiry and optimistic revision checked in commit transaction |
| T-03-16 | 03-07 | high | Established internal-member search only, owner-only grant list |
| T-03-17 | 03-08 | high | Server capability matrix and atomic source checks |
| T-03-18 | 03-08 | high | Validated snapshot with regenerated IDs and complete image manifest |
| T-03-19 | 03-08 | medium | Named safe-focus confirmation and operation result reconciliation |
| T-03-20 | 03-09 | high | Native final-write guard plus document state-vector and local model oracles |
| T-03-21 | 03-09 | high | Shared export service authorization and direct endpoint role tests |
| T-03-22 | 03-10 | high | Opaque account scope, generation invalidation and quarantine tests |
| T-03-23 | 03-10 | high | Same-account/board-write check and transactional server role recheck |
| T-03-24 | 03-10 | high | Expected-member header plus restore revalidation and abort/generation barrier |
| T-03-25 | 03-11 | high | Legacy-only explicit selection and account scope tests |
| T-03-26 | 03-11 | high | Idempotent staging, complete manifest and atomic commit |
| T-03-27 | 03-11 | high | No original deletion; hash comparisons and stop/resume identity checks |
| T-03-28 | 03-12 | high | Synthetic fixtures, redaction and tracked/staged privacy review |
| T-03-29 | 03-12 | high | Separate not-run/accepted status and explicit operator oracle |
| T-03-30 | 03-12 | high | Complete capability/resource matrix and zero-skips suite inventory |

Every threat has mitigate disposition. ASVS level1 blocks unresolved high/critical threats. Actual SQLite migrations/table read/write/rollback prove the schema; typecheck alone cannot. Original local storage is retained; account storage is additive. No ORM schema-push tool applies.

### Evidence gaps retained

- Actual-provider setup/mapping in task03-12-02 is not run until operator/agent evidence exists.
- Four descriptor-less prohibitions remain flagged-unverified; planned assertions are not wired-check proof.
- Native screen reader or real browser zoom unavailable to automation remains only as concrete uncovered steps.
- Complete current matrix passed. Phase acceptance still requires the exact human/provider/native items. Earlier failed, interrupted and mixed outcomes remain in `03-REGRESSION-FIX.md` and `03-12-CHECKPOINT.md`.

## Executed validation and coverage closure

Source under final acceptance: `73416723411ca2c5b98de090f6d5327ed9e076c7`. The executor used one exclusive browser/build slot and a command-scoped idle-sleep guard after diagnosing the interrupted earlier run. The final command exited successfully; the parent independently reconciled all 1,533 event statuses and the terminal passed result.

| Check | Final outcome |
|---|---|
| Exact two-case phase smoke | 2/2 passed, 27.4s |
| Frontend and server TypeScript | Both passed |
| Unit suite | 105/105 passed, 1.28s |
| Server suite | 112/112 passed, 7.68s |
| Production build | Passed, 8.67s |
| Standalone authenticated access suite | 123/123 passed, 4.3m |
| Complete browser matrix | 1,533/1,533 passed, 57.1m; 0 failed/timed out/skipped/interrupted/unrun |

The final inventory contains dev 357, production Chromium 351, Firefox 351, WebKit 351 and access 123. The standalone access run and access project in the complete matrix overlap and are reported separately. No summation implies unique coverage.

**NYQ-01 closed:** commit `e4c6b5c` adds real signed unknown-key rejection without member/session mutation, callback replay denial, and same-application/same-issuer signing-key rollover with an observed second JWKS request after the library cache cooldown. OIDC 60/60 passed (7.28s), compiled provider self-test 17/17 passed (158ms), full server 112/112 passed (7.30s), and both type checks passed. Fixture controls are opt-in; production authentication is unchanged. Initial sandbox listener errors were environmental and are not behavioral RED evidence.

The independent audit traced all five requirement families, all 16 locked decisions, 26 task commands, 24 edge predicates and 39 UI predicates. It found one missing integrated OIDC test (NYQ-01), now filled. There are no three unchecked consecutive implementation tasks. The four descriptor-less prohibitions remain flagged-unverified for final verifier disposition; semantic tests and a bounded privacy audit do not invent enforcement descriptors.

Code review has zero open findings; UI review is 24/24 with all original findings and UI-X5 closed; security review closes 31/31 declared mitigation boundaries at the current source. These reviews remain separate from full-suite execution and actual-provider acceptance. Earlier focused native recovery evidence is 44/44; local-copy return focus is 8/8. Those behaviors also passed in the final full matrix. Their causal failures and fixes are preserved in `03-REGRESSION-FIX.md`.

Actual-provider A1–A9, native browser 200% zoom, OS IME and assistive-technology speech remain human_needed. The latest actual history navigation observed ordinary reload, not persisted BFCache restoration. Constructed pageshow, CSS scaling and keyboard/input automation remain explicitly separate from those native observations.

### Complete matrix at 6d6dade — failed gate

| Project | Passed | Failed | Skipped / unrun |
|---|---:|---:|---|
| dev | 356 | 1 | 0 / 0 |
| prod | 351 | 0 | 0 / 0 |
| prod-firefox | 351 | 0 | 0 / 0 |
| prod-webkit | 344 | 7 | 0 / 0 |
| access | 123 | 0 | 0 / 0 |

The development failure is the sticky-note reload assertion observing two transient native roots. Six WebKit cases report populated-library thumbnail request errors during navigation: expired cookie, blocked popup, authorized deep link, blank-board/history, image revocation, and image duplication. A seventh WebKit case reports a document push error during fill-opacity reload. Semantic assertions do not waive strict runtime diagnostics. The executor is tracing navigation and request acknowledgment, with no broad diagnostic suppression authorized. The fresh full gate must pass after correction; this failed run does not satisfy final compliance.

### Fixture correction and environmental interruption

Source/test revision `7341672` fixes the proven readiness boundaries, with 52/52 focused cases across four variants and clean independent code/security delta reviews. Application code remains at `6d6dade`. Its fresh smoke (2/2), type checks, unit (105/105), server (112/112), build and standalone access (123/123) passed.

Its first full matrix was interrupted by repeated host sleep: **810 passed, 36 timed out, four failed, one interrupted, 682 unrun**. The full event record supersedes incorrect interim production-pass counts inferred from recent log lines. The first 926.710-second timeout coincides with a 926-second host suspension; affected scenarios require unchanged awake-host reruns before any completion claim. Exact project counts are retained in `03-REGRESSION-FIX.md`. The runner will use a process-scoped idle-sleep guard; test timeouts, assertions, diagnostics and application behavior remain unchanged. Final compliance remains false.

The guarded reproduction then passed **42/42 in 2.4m**: every one of the 40 affected project-qualified cases plus two populated-library setup cases. No assertion, timeout or tracked source/test changed. The guard and listeners released automatically. The subsequent complete gate at unchanged `7341672` passed all 1,533 cases under the same process-scoped idle-sleep guard; all counts derive from the entire event record. Historical false compliance/pending language above describes the earlier failed attempts, superseded by the final results at the top of this record.

## Final reconciliation — 2026-09-17

| Browser project | Selected | Passed | Failed / skipped / unrun |
|---|---:|---:|---|
| Development Chromium | 357 | 357 | 0 / 0 / 0 |
| Production Chromium | 351 | 351 | 0 / 0 / 0 |
| Production Firefox | 351 | 351 | 0 / 0 / 0 |
| Production WebKit | 351 | 351 | 0 / 0 / 0 |
| Access | 123 | 123 | 0 / 0 / 0 |
| Total | 1533 | 1533 | 0 / 0 / 0 |

Full duration: 3,426,486.701ms (57.1m). Five actual-history annotations all recorded ordinary reload; genuine persisted BFCache remains unobserved. The guard and synthetic listeners released automatically. Source/tests remained unchanged throughout the passing run. All 26 tasks retain their runnable checks or explicit operator precondition; NYQ-01 is filled, all seven Wave-0 prerequisites are exercised, and the automation inventory matches the selected and executed cases.

Automated `nyquist_compliant: true` does not accept the configured provider, native observations, or four descriptor-less prohibitions. Those remain for the final phase verifier and UAT. Phase 3 and plan 03-12 remain open until that checkpoint resolves.
