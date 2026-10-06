---
phase: "05"
slug: "real-time-collaborative-editing"
status: in-progress
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-02"
---

# Phase 5 — Validation Strategy

Strategy derived from research and approved UI contract, mapped to nine executable plans. Plans 05-01 and 05-02 have recorded execution evidence; verified 05-03 stabilization is documented in [the resumption report](05-RESUMPTION-2026-10-06.md). Plan 05-04 has [verified automated evidence](05-04-SUMMARY.md); plans 05-05 through 05-09 remain pending. Whole-phase validation is incomplete.

## Test Infrastructure

| Property | Value |
|---|---|
| Framework | Existing Vitest and Playwright |
| Config | `vite.config.ts`, `vitest.server.config.ts`, `playwright.config.ts` |
| Static check | `npm run typecheck && npm run typecheck:server` |
| Existing focused baseline | `npm test -- src/canvas/account/recovery.test.ts src/canvas/account/doc-source.test.ts` |
| Full regression | `npm test && npm run test:server && npm run test:browser` |
| Runtime | Phase 5 duration unmeasured; establish during first executable slice |

## Sampling Rate

- After each task: relevant unit/server tests plus static checks; plans must supply exact commands and new-file prerequisites.
- After integrated capability slices: real authenticated browser tests covering their native interactions and failure paths.
- Before acceptance: full regression and 20-participant convergence/durability matrix, reporting known Phase 4 exception separately if reproduced.
- Feedback-latency target for focused checks: under 60 seconds where feasible; measure rather than assert. Large browser/load runs are separate gates.

## Requirement Verification Map

Requirement-level map below is expanded into the per-task commands that follow.

| Requirement | Required automated evidence | Proposed execution-time suite | Exists |
|---|---|---|---|
| COL-01 | Independent simultaneous native edits, reservation enforcement, 20 distinct authenticated participants, durable reopen | `tests/collaboration.spec.ts` | Yes; 20-editor load suite remains pending |
| COL-02 | Names, cursor role filtering, multi-tab deduplication, fade/removal and spoof resistance | `tests/collaboration-presence.spec.ts` | Yes |
| CAN-03 | Per-tab personal undo/redo, complete text session, independent remote edits preserved, conflicts skipped | `tests/collaboration-history.spec.ts`, `tests/collaboration-history-reconnect.spec.ts`, `tests/collaboration-history-reservation.spec.ts` | Yes; 05-04 slice |
| COL-03 | Unchanged baseline replay; divergent latest/fork choice; no automatic merge; exact fork content/images and lost receipts | `tests/collaboration-recovery.spec.ts` | No |
| COL-04 | Active revocation, queued writes, direct document/image access, held response reauthorization, restoration confirmation | `tests/collaboration-access.spec.ts` | No |
| MIND-05 | Concurrent independent branches and conflicting structural operations with valid reopened hierarchy | `tests/collaboration-mindmap.spec.ts` | No |

## Wave 0 Requirements

- [ ] Plan tests and fixtures before referencing their commands as runnable.
- [ ] Reuse synthetic identity/provider fixture with distinct account sessions, not twenty tabs sharing one identity.
- [ ] Provide deterministic barriers for acquire/commit/revoke/reconnect races.
- [ ] Provide native object assertions plus strict browser console/page-error capture.
- [ ] Define actual affected-object schema fixtures, including mind-map layout and nested surface objects.
- [ ] Preserve old checkpoint/journal fixtures to exercise compatible recovery metadata evolution.

## Manual Review

Review names/avatars and reservation messages for clarity, keyboard/focus behavior of recovery choices, and reduced-motion/contrast behavior in the UI contract. Automated interaction coverage should accompany these reviews. Existing deferred native assistive-technology and real-provider validation remain separately tracked.

## Validation Sign-Off

- [x] Per-task automated commands and threat references assigned by plans.
- [x] All new test references have creation prerequisites.
- [x] No watch mode and no empty-match successes.
- [x] Requirement and D-01 through D-19 coverage verified.
- [ ] Browser/error and load evidence collected against the implementation revision.
- [ ] nyquist_compliant set only after validation obligations are satisfied.

**Planning review:** Complete. Executable evidence exists for the delivered slices; full phase verification and human acceptance remain pending.

## Per-Task Verification Map

All listed new suites are created by the owning task before its command runs. Warm unit/server feedback precedes browser verification; browser server startup is measured separately. Each task also runs both typechecks.

| Task | Wave | Requirements | Threat | Automated browser check | Status |
|---|---|---|---|---|---|
| 05-01-01 | 1 | COL-01, COL-04 | T-05-01 | `npm exec playwright test -- tests/collaboration.spec.ts --project=prod --grep @05-01-01` | Recorded pass; see 05-01-SUMMARY.md and current resumption gate |
| 05-01-02 | 1 | COL-01, COL-04 | T-05-01 | `npm exec playwright test -- tests/collaboration.spec.ts --project=prod --grep @05-01-02` | Recorded pass; see 05-01-SUMMARY.md and current resumption gate |
| 05-02-01 | 2 | COL-01 | T-05-02 | `npm exec playwright test -- tests/collaboration-reservations.spec.ts --project=prod --grep @05-02-01` | Recorded pass; see 05-02-SUMMARY.md and current resumption gate |
| 05-02-02 | 2 | COL-01 | T-05-02 | `npm exec playwright test -- tests/collaboration-reservations.spec.ts --project=prod --grep @05-02-02` | Recorded pass; see 05-02-SUMMARY.md and current resumption gate |
| 05-03-01 | 3 | COL-02 | T-05-03 | `npm exec playwright test -- tests/collaboration-presence.spec.ts --project=prod --grep @05-03-01` | Automated gate passed; see 05-03-SUMMARY.md and resumption evidence |
| 05-03-02 | 3 | COL-02 | T-05-03 | `npm exec playwright test -- tests/collaboration-presence.spec.ts --project=prod --grep @05-03-02` | Automated gate passed; see 05-03-SUMMARY.md and resumption evidence |
| 05-04-01 | 4 | CAN-03 | T-05-04 | `npm exec playwright test -- tests/collaboration-history.spec.ts --project=prod --grep @05-04-01` | Pass; see [05-04 summary](05-04-SUMMARY.md); whole-phase requirement remains open |
| 05-04-02 | 4 | CAN-03 | T-05-04 | `npm exec playwright test -- tests/collaboration-history.spec.ts tests/collaboration-history-reconnect.spec.ts tests/collaboration-history-reservation.spec.ts --project=prod --grep @05-04-02` | Pass; see [05-04 summary](05-04-SUMMARY.md); whole-phase requirement remains open |
| 05-05-01 | 5 | COL-03 | T-05-05 | `npm exec playwright test -- tests/collaboration-recovery.spec.ts --project=prod --grep @05-05-01` | Pending; new suite owned by plan 05 |
| 05-05-02 | 5 | COL-03 | T-05-05 | `npm exec playwright test -- tests/collaboration-recovery.spec.ts --project=prod --grep @05-05-02` | Pending; new suite owned by plan 05 |
| 05-06-01 | 6 | COL-03 | T-05-06 | `npm exec playwright test -- tests/collaboration-fork.spec.ts --project=prod --grep @05-06-01` | Pending; new suite owned by plan 06 |
| 05-06-02 | 6 | COL-03 | T-05-06 | `npm exec playwright test -- tests/collaboration-fork.spec.ts --project=prod --grep @05-06-02` | Pending; new suite owned by plan 06 |
| 05-07-01 | 7 | COL-04, COL-03 | T-05-07 | `npm exec playwright test -- tests/collaboration-access.spec.ts --project=prod --grep @05-07-01` | Pending; new suite owned by plan 07 |
| 05-07-02 | 7 | COL-04, COL-03 | T-05-07 | `npm exec playwright test -- tests/collaboration-access.spec.ts --project=prod --grep @05-07-02` | Pending; new suite owned by plan 07 |
| 05-08-01 | 8 | MIND-05, COL-01, CAN-03 | T-05-08 | `npm exec playwright test -- tests/collaboration-mindmap.spec.ts --project=prod --grep @05-08-01` | Pending; new suite owned by plan 08 |
| 05-08-02 | 8 | MIND-05, COL-01, CAN-03 | T-05-08 | `npm exec playwright test -- tests/collaboration-mindmap.spec.ts --project=prod --grep @05-08-02` | Pending; new suite owned by plan 08 |
| 05-09-01 | 9 | CAN-03, COL-01, COL-02, COL-03, COL-04, MIND-05 | T-05-09 | `npm exec playwright test -- tests/collaboration-load.spec.ts --project=prod --grep @05-09-01` | Pending; new suite owned by plan 09 |
| 05-09-02 | 9 | CAN-03, COL-01, COL-02, COL-03, COL-04, MIND-05 | T-05-09 | `npm exec playwright test -- tests/collaboration-load.spec.ts --project=prod --grep @05-09-02` | Pending; new suite owned by plan 09 |

Task 05-09-03 is the explicit human acceptance checkpoint after automated gates. All new native collaboration suites run on prod-firefox and prod-webkit in final acceptance as well as prod. New server/unit commands are specified in each task. No zero-test pass, mandatory skip, retry, or unexpected console/page error is acceptable. Known Phase 4 exception 999.7 is reported separately for disposition; it is not suppressed or counted as passing.
