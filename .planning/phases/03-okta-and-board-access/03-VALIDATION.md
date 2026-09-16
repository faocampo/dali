---
phase: "03"
slug: "okta-and-board-access"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-16"
---

# Phase 3 — Validation Strategy

This is an execution contract derived from [03-RESEARCH.md](03-RESEARCH.md) (OIDC, board-scoped storage and authorization) and [03-UI-SPEC.md](03-UI-SPEC.md) (approved interface states). Phase 3 behavior has not been implemented or exercised. Synthetic protocol tests and actual-provider acceptance have separate outcomes.

## Test Infrastructure

| Property | Value |
|---|---|
| Existing frameworks | Vitest 4.1.11 and Playwright 1.62.1 |
| Existing static/unit commands | `npm run typecheck`, `npm test`, `npm run build` |
| Existing browser configuration | `playwright.config.ts`; dev, prod, prod-firefox and prod-webkit projects |
| Proposed server configuration | `vitest.server.config.ts`, explicit Node test environment and test include |
| Proposed quick command | `npm run test:server` — create script and bounded route/policy suites before use |
| Proposed authenticated browser command | `npm run test:access` — create script, access project, local backend and synthetic OIDC provider before use |
| Final suite | `npm run typecheck && npm run typecheck:server && npm test && npm run test:server && npm run build && npm run test:access && npm run test:browser` |
| Timing | Focused server checks target under 30 seconds after setup; measure actual duration during execution. Browser/build startup is reported separately. |

## Sampling Rate

- Every implementation task runs typecheck and its focused behavioral checks before commit.
- Every wave runs server policy/auth checks plus the affected authenticated browser slice.
- Before requirement verification, run the complete static/unit/build/access suite and the existing canvas browser regressions with authenticated fixtures.
- Every runnable task command states its failure oracle. Nonzero exit, zero matched cases, skipped required cases or a missing expected assertion fails verification. No watch mode or pass-with-no-tests.
- New suites and scripts are planned work, never evidence that already exists. Create a meaningful failing assertion before changing the behavior it guards.
- Browser tests retain the existing unexpected-runtime-error collector. Expected injected 401/403 responses are narrowly declared; broad error suppression is disallowed.
- Production builds and browser servers share one exclusive execution slot. Independent source ownership does not authorize parallel writes to build outputs, database fixtures or browser ports.

## Requirement Verification Map

The twelve executable plans own these test targets. Each new target is created by its named task before invocation. All execution evidence remains pending.

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

- [ ] Server scripts/configuration and native SQLite load/transaction smoke.
- [ ] Isolated temporary database migrations, injected clock and cleanup for each fixture.
- [ ] Test-only synthetic OIDC provider with discovery, JWKS, authorization, token and UserInfo; real signed tokens and protocol validation.
- [ ] Four separate synthetic member contexts plus foreign-board text/image canaries.
- [ ] Production-mode rejection of test-auth enablement and absence of bypass routes.
- [ ] Account workspace conformance fixture and zero-write lifecycle assertions.
- [ ] Explicit existing canvas fixture adaptation; real authenticated sessions replace assumptions of immediate anonymous startup.

## Manual-Only Verifications

| Behavior | Requirement | Why operator involvement is required | Procedure and evidence boundary |
|---|---|---|---|
| Actual Okta application and trusted claim mapping | AUTH-01; BOARD-03 | Provider registration, assignments, secrets and directory email semantics are controlled externally | Supply issuer/client/callback and membership policy outside the repository; use two assigned synthetic test members and a denied identity. Exercise login/target restoration, persistent session, expiry, local logout, pending verified-email activation and denial. Keep configuration/evidence private. Public outcome stays not run until the operator reports acceptance. |
| Native assistive technology or browser zoom unavailable to automation | UI contract | Emulated viewport/keyboard events do not prove every native environment | Execute only uncovered native focus, screen-reader announcement and 200% zoom steps; report exact environment and remaining limits. Do not require duplicate manual testing for automated, observable behavior. |

## Security and Evidence Boundaries

Each plan includes an ASVS level 1 threat model and connects each threat to test ownership. Authentication/authorization are enforced by server requests and state-change oracles, not control visibility. PNG/PDF and editable-export action policy is distinct from preventing an authorized viewer reconstructing content already received for rendering.

Current HTTP request authorization belongs to Phase 3. Phase 4 retains restart/recovery/backup/deployment acceptance; Phase 5 retains real-time transport, presence, active-connection revocation, reconnection and 20-user acceptance. Phase 3 outbox preservation during authentication remains mandatory.

## Validation Sign-Off

- [ ] Each task has automated verification or explicit test-creation prerequisites.
- [ ] Task/threat map matches the final PLAN.md set.
- [ ] Every required test target is created before its command runs.
- [ ] Sampling continuity has no three unchecked consecutive tasks.
- [ ] Commands have failure oracles and no watch mode.
- [ ] Runtime timings and execution evidence are recorded.
- [ ] Actual-provider status is reported separately.

**Planning approval:** checked on 2026-09-16; zero blockers/warnings and one informational concurrency advisory. See [03-PLAN-CHECK.md](03-PLAN-CHECK.md) (independent review and deterministic checks). **Execution evidence:** pending. Keep status draft, nyquist_compliant false and wave_0_complete false until the corresponding executed evidence exists.

## Spec-less Edge Coverage

No standalone phase SPEC exists. The deterministic edge probe classified the five requirements using explicit text, collection, stateful, I/O and session-lifetime boundary shapes. All 24 raised items have explicit planned acceptance; none were dismissed. The planner lifts each predicate into must_haves and assigns execution tests. This is coverage of the plan, not passed tests.

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

The independently checked UI contract additionally has 39 explicit UI-state predicates. Each must be represented in a plan and an executing verification task.

## Executable Task, Threat and Command Map

These are planned execution commands. Plan01 creates scripts/configuration first. Task03-02-01 is the first application tracer; account conformance uses dev and is excluded from production/access projects. Every task creates its own required named assertions before running them.

| Task | Wave | Threats | Automated command | Evidence |
|---|---:|---|---|---|
| 03-01-01 | 1 | T-03-SC, T-03-01 | `npm run typecheck && npm run typecheck:server && npm run test:server -- server/preflight.test.ts` | pending |
| 03-01-02 | 1 | T-03-SC, T-03-01 | `npm run server:build && node .gsd/access-build/tests/oidc-provider.js --self-test && npm run typecheck` | pending |
| 03-02-01 | 2 | T-03-02, T-03-03, T-03-04 | `npm run typecheck && npm run typecheck:server && npm exec playwright test -- tests/authentication.spec.ts --project=prod --grep "@03-02-01"` | pending |
| 03-02-02 | 2 | T-03-02, T-03-03, T-03-04 | `npm run typecheck && npm run typecheck:server && npm run test:server -- server/auth/oidc.test.ts && npm exec playwright test -- tests/authentication.spec.ts --project=prod` | pending |
| 03-03-01 | 3 | T-03-05, T-03-06 | `npm run typecheck && npm run typecheck:server && npm exec playwright test -- tests/board-access.spec.ts --project=prod --grep "@03-03-01"` | pending |
| 03-03-02 | 3 | T-03-05, T-03-06 | `npm run typecheck && npm run test:server -- server/boards/library.test.ts && npm exec playwright test -- tests/board-library.spec.ts --project=prod --grep "@03-03-02"` | pending |
| 03-04-01 | 4 | T-03-07, T-03-08, T-03-09 | `npm run typecheck && npm run typecheck:server && npm run test:server -- server/boards/access.test.ts -t '@03-04-01' && npm test -- src/canvas/account/doc-source.test.ts` | pending |
| 03-04-02 | 4 | T-03-07, T-03-08, T-03-09 | `npm run typecheck && npm run test:server -- server/boards/access.test.ts -t '@03-04-02' && npm test -- src/canvas/account/blob-source.test.ts` | pending |
| 03-05-01 | 5 | T-03-10, T-03-11 | `npm run typecheck && npm run typecheck:server && npm exec playwright test -- tests/account-workspace.spec.ts --project=dev --grep "@03-05-01"` | pending |
| 03-05-02 | 5 | T-03-10, T-03-11 | `npm run typecheck && npm exec playwright test -- tests/account-workspace.spec.ts --project=dev --grep "@03-05-02"` | pending |
| 03-06-01 | 6 | T-03-12, T-03-13 | `npm run typecheck && npm exec playwright test -- tests/board-access.spec.ts --project=prod --grep "@03-06-01"` | pending |
| 03-06-02 | 6 | T-03-12, T-03-13 | `npm run typecheck && npm exec playwright test -- tests/board-access.spec.ts tests/mindmap.spec.ts tests/image-import.spec.ts --project=prod` | pending |
| 03-07-01 | 7 | T-03-14, T-03-15, T-03-16 | `npm run typecheck && npm run typecheck:server && npm exec playwright test -- tests/board-sharing.spec.ts --project=prod --grep "@03-07-01"` | pending |
| 03-07-02 | 7 | T-03-14, T-03-15, T-03-16 | `npm run typecheck && npm run test:server -- server/boards/grants.test.ts && npm exec playwright test -- tests/board-sharing.spec.ts --project=prod` | pending |
| 03-08-01 | 8 | T-03-17, T-03-18, T-03-19 | `npm run typecheck && npm run typecheck:server && npm exec playwright test -- tests/board-actions.spec.ts --project=prod --grep "@03-08-01"` | pending |
| 03-08-02 | 8 | T-03-17, T-03-18, T-03-19 | `npm run typecheck && npm exec playwright test -- tests/board-actions.spec.ts --project=prod --grep "@03-08-02"` | pending |
| 03-09-01 | 9 | T-03-20, T-03-21 | `npm run typecheck && npm exec playwright test -- tests/board-roles.spec.ts --project=prod --grep "@03-09-01"` | pending |
| 03-09-02 | 9 | T-03-20, T-03-21 | `npm run typecheck && npm exec playwright test -- tests/board-roles.spec.ts tests/mindmap-export.spec.ts --project=prod --grep "@03-09-02\|@02-06"` | pending |
| 03-10-01 | 9 | T-03-22, T-03-23, T-03-24 | `npm run typecheck && npm exec playwright test -- tests/session-recovery.spec.ts --project=prod --grep "@03-10-01"` | pending |
| 03-10-02 | 9 | T-03-22, T-03-23, T-03-24 | `npm run typecheck && npm exec playwright test -- tests/session-recovery.spec.ts --project=prod --grep "@03-10-02"` | pending |
| 03-10-03 | 9 | T-03-22, T-03-23, T-03-24 | `npm run typecheck && npm exec playwright test -- tests/session-recovery.spec.ts --project=prod --grep "@03-10-03"` | pending |
| 03-11-01 | 10 | T-03-25, T-03-26, T-03-27 | `npm run typecheck && npm run typecheck:server && npm exec playwright test -- tests/local-board-import.spec.ts --project=prod --grep "@03-11-01"` | pending |
| 03-11-02 | 10 | T-03-25, T-03-26, T-03-27 | `npm run typecheck && npm exec playwright test -- tests/local-board-import.spec.ts --project=prod --grep "@03-11-02"` | pending |
| 03-11-03 | 10 | T-03-25, T-03-26, T-03-27 | `npm run typecheck && npm exec playwright test -- tests/local-board-import.spec.ts --project=prod --grep "@03-11-03"` | pending |
| 03-12-01 | 11 | T-03-28, T-03-29, T-03-30 | `npm run typecheck && npm exec playwright test -- tests/access-boundaries.spec.ts tests/accessibility-access.spec.ts --project=prod --grep "@03-12-smoke"` | pending |
| 03-12-02 | 11 | T-03-28, T-03-29, T-03-30 | `npm run test:server -- server/auth/oidc.test.ts server/boards/grants.test.ts` | pending |

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
- Execution outcomes, timings and case counts remain pending; frontmatter draft/compliance/Wave0 flags stay unchanged.
