---
phase: "05"
slug: "real-time-collaborative-editing"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-02"
---

# Phase 5 — Validation Strategy

Draft strategy derived from `05-RESEARCH.md`. Executable plans and per-task mapping await the UI contract. No test results are claimed here.

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

Task IDs, wave assignments and threat IDs remain pending until executable plans exist.

| Requirement | Required automated evidence | Proposed execution-time suite | Exists |
|---|---|---|---|
| COL-01 | Independent simultaneous native edits, reservation enforcement, 20 distinct authenticated participants, durable reopen | `tests/collaboration.spec.ts` | No |
| COL-02 | Names, cursor role filtering, multi-tab deduplication, fade/removal and spoof resistance | `tests/collaboration-presence.spec.ts` | No |
| CAN-03 | Per-tab personal undo/redo, complete text session, independent remote edits preserved, conflicts skipped | `tests/collaboration-history.spec.ts` | No |
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

- [ ] Per-task automated commands and threat references assigned by plans.
- [ ] All new test references have creation prerequisites.
- [ ] No watch mode and no empty-match successes.
- [ ] Requirement and D-01 through D-19 coverage verified.
- [ ] Browser/error and load evidence collected against the implementation revision.
- [ ] nyquist_compliant set only after validation obligations are satisfied.

**Approval:** Pending executable planning and validation.
