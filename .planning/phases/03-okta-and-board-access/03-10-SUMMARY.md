---
phase: 03-okta-and-board-access
plan: "10"
status: complete
subsystem: account-recovery
tags: [indexeddb, yjs, session, authorization, recovery]
requires: [03-04, 03-05, 03-06, 03-08, 03-09]
provides: [durable account document and image journal, preservation-gated authentication and logout, isolated authorized recovery, accessible interruption states]
affects: [03-11, 03-12, 04, 05]
tech-stack:
  added: []
  patterns: [durable local image acknowledgment, blob-before-document replay, immutable access scope, expected-account requests, state-only cross-tab signals]
key-files:
  created: [src/canvas/account/outbox.ts, src/auth/session.ts, tests/session-recovery.spec.ts]
  modified: [src/auth/AuthBoundary.tsx, src/canvas/runtime.ts, src/App.tsx, src/canvas/account/doc-source.ts, src/canvas/account/blob-source.ts, src/canvas/account/board-workspace.ts, src/index.css, tests/authentication.spec.ts, tests/board-access.spec.ts]
key-decisions:
  - Native image insertion acknowledges durable local capture while separate status tracks committed server acknowledgment.
  - Pause native editing and preserve full buffered documents before aborting requests or permitting authentication and logout navigation.
  - Recovery requires the original opaque account and a fresh writable board descriptor; blobs replay before referencing documents.
  - Reauthorization constructs a fresh workspace; persisted pageshow and state-only cross-tab signals trigger fresh session and descriptor validation.
requirements-completed: []
requirements-progressed: [AUTH-01, BOARD-04, BOARD-01]
duration: 79min
completed: 2026-09-16
plan_head_before: dca3dd96902fa49b50cf35ff9a31a4eb08f4f32f
actuals:
  tokens: 22035
  tokens_basis: realized implementation diff characters divided by four, rounded up; size estimate only
  model_token_usage: unavailable
  tasks: 3
  commits: 8
coverage:
  - id: D1
    description: Durable pending documents and images survive full reauthentication, quota failure and interrupted server acknowledgment
    requirement: AUTH-01
    verification:
      - kind: e2e
        ref: tests/session-recovery.spec.ts#@03-10-01
        status: pass
    human_judgment: false
  - id: D2
    description: Exact-account replay and fresh write authorization isolate stale requests, restored tabs and role loss
    requirement: BOARD-04
    verification:
      - kind: e2e
        ref: tests/session-recovery.spec.ts#@03-10-02
        status: pass
      - kind: integration
        ref: server/boards/access.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: Blocking accessible recovery, truthful acknowledgment status and authorized focus restoration
    requirement: AUTH-01
    verification:
      - kind: e2e
        ref: tests/session-recovery.spec.ts#@03-10-03
        status: pass
    human_judgment: false
---

# Phase 3 Plan 10: Preserve interrupted work and isolate account recovery Summary

**An account-scoped IndexedDB journal preserves native document updates and pending image bytes before sign-in or logout, then replays only after the original account regains current board write access.**

## Task outcomes and commits

1. **03-10-01:** RED `c6a3eb3`; GREEN `28e5744`. Strict IndexedDB transactions persist account, board, generation, sequence, resource and bytes before local acknowledgment. Native image insertion can display the durable pending blob while server upload continues. Readonly pause captures buffered root/content Yjs state, stops engines and aborts requests; failed capture keeps the runtime blocked with Retry preservation. Full sign-in navigation follows successful preservation. Replay uploads images first, validates committed acknowledgments and removes only acknowledged records. Stable image keys and Yjs updates make interrupted acknowledgment retry idempotent.
2. **03-10-02:** RED `746c159`; GREEN `fbe5ea6`. Expected-account headers, abort and generation barriers guard protected resources. Different identity clears prior visible content and quarantines its journal. Viewer or revoked recovery submits no writes and retains the original journal with named discard confirmation independent of legacy originals. BroadcastChannel and storage-event fallback carry state-only signals. Persisted pageshow pauses immediately and requires fresh session and board authorization. Explicit logout preserves first and remains signed out; late session responses cannot reverse it.
3. **03-10-03:** RED `bfe5ea6`; GREEN `61fa59e`. Native modal focus containment, blocking Escape behavior, exact recovery actions, long-text wrapping, narrow viewport scrolling and reduced-motion behavior keep controls reachable. Prior control or native shape text editing focus returns only after authorized replay succeeds. The polite resumed notice follows that restoration. Follow-up `7a9a862` restores the generic authentication error alert role. Integration commit `0afa172` aligns earlier tests with current native editing and verifies the exact recovery database namespace plus empty acknowledged journal.

Eight source/test commits are measured from the persisted pre-plan ledger through `0afa172`; summary and tracking commits follow separately. Twelve source/test files changed. The approximate 79-minute elapsed interval includes a coordination pause for additional test ownership; model token usage is unavailable. The frontmatter token field is a diff-size estimate only.

## Verification

| Command | Result |
|---|---|
| `npm run typecheck` | Passed at all task boundaries and final combined regression |
| `npm run typecheck:server` | Passed |
| `npm test` | **102 passed**, 11 files, 1.17 seconds |
| `npm run test:server -- server/auth/oidc.test.ts server/boards/access.test.ts` | **75 passed**, 2 files, 6.98 seconds |
| `npm run typecheck && npm exec playwright test -- tests/session-recovery.spec.ts --project=prod --grep '@03-10-01'` | **4 passed**, 23.8 seconds |
| `npm run typecheck && npm exec playwright test -- tests/session-recovery.spec.ts --project=prod --grep '@03-10-02'` | **12 passed**, 43.8 seconds |
| `npm run typecheck && npm exec playwright test -- tests/session-recovery.spec.ts --project=prod --grep '@03-10-03'` | **5 passed**, 26.8 seconds |
| `npm exec playwright test -- tests/authentication.spec.ts --project=prod --grep 'empty configuration'` | **1 passed**, 16.7 seconds after alert-role repair |
| `npm run typecheck && npm exec playwright test -- tests/session-recovery.spec.ts tests/authentication.spec.ts tests/board-access.spec.ts tests/image-import.spec.ts --project=prod` | Final **51 passed**, 1.4 minutes, zero skips |
| Staged whitespace/privacy checks | Passed; no tracked deletions |

The coordinator independently verified source HEAD `0afa172`: production build passed in 12.9 seconds, full unit suite **102 passed** in 1.01 seconds, and full server suite **107 passed** in 6.74 seconds. Schema and whitespace gates were clear. UI-SPEC was present with no blocking result; the advisory inspected a test-only final commit and did not substitute for the browser UI evidence above. The optional codebase advisory had no STRUCTURE artifact to inspect.

Every browser invocation rebuilt production assets and used isolated synthetic signed OIDC and trusted-service listeners. Browser executable location was supplied through `PLAYWRIGHT_BROWSERS_PATH`. The runtime error collector remained active; only the intentional canceled native image request has a narrowly scoped expected AbortError. Existing Vite chunk-size and static/dynamic import advisories remain. A concurrent-port setup attempt was stopped and rerun after the earlier process exited; no stale build was used for passing evidence.

The first combined run reported 45 passing cases and six failures: five obsolete integration assertions and the missing generic error alert role. The alert was repaired in production code. Approved test updates verify actual native editor mounting, exact acknowledged textbox titles, bare New intent creating an owned private board, Main Menu → File → All boards navigation, and exact journal namespace with zero pending rows after acknowledgment. Existing independent SQL, card, document-byte, history, preview and foreign-account assertions remain. The final combined run passes all 51 cases.

### Observed oracles

- Full-page authentication with an unacknowledged image and native map edit restores the canonical full model and exact image hash/bytes once. Object keys are sorted only for serialized model comparison; values and native structure remain exact. An interrupted response follows a real committed server write, then idempotent replay retains server content.
- Injected IndexedDB failure blocks navigation and logout, retains native buffered work and exposes Retry preservation. A real protected 401 freezes native editing before workspace disposal. Retry commits actual records before allowing sign-in or logout.
- Independent trusted-service database rows and separately authorized reads prove unchanged state for different-account, Viewer, revoked and commit-time revocation paths. Two identities sharing the same board still cannot replay each other's work. Delayed authorized document, image and thumbnail responses cannot expose prior-account UI after identity changes.
- BroadcastChannel and storage fallback both preserve pending work before another tab becomes signed out. A delayed session response cannot override simultaneous logout/account switch. Persisted pageshow requires fresh session and descriptor checks before writable mount.
- Keyboard Tab/Shift-Tab remain within the interruption dialog. Escape and constructed composition events cannot resume native mutations. Control and native text-editor focus restoration follow successful replay; failed replay retains pending state without a resumed notice. Long synthetic identifiers, 490px width, short-height scrolling and reduced motion keep recovery controls visible.
- Server tests include exact absolute-expiry minus one millisecond, expiry, and plus one millisecond boundaries, plus transactional protected document/image authorization.

## TDD Gate Compliance

All three tasks had committed intentional RED assertions before implementation. Task 1 observed a missing durable pending image, task 2 observed no fresh session request on persisted pageshow, and task 3 observed focus leaving the interruption dialog. Mechanically normalized named-failure evidence from actual runner logs passed `check tdd-red-evidence` with `RED_EVIDENCE_OK` for each task. Final GREEN results are recorded above; no refactor-only commit was needed.

## Deviations from Plan

1. **[Rule 2 — native source acknowledgment integration]** Moved doc-source/blob-source wiring from task 2 into task 1 with coordinator approval. Pinned native BlobEngine waits for source acknowledgment before image insertion, so local acknowledgment must mean durable IndexedDB capture while network acknowledgment remains separately tracked. Waiting for an unavailable server would prevent preserving the referenced native image. Files: doc-source, blob-source, runtime and outbox; `28e5744`.
2. **[Rule 2 — preserve before authorization-loss disposal]** Added narrowly approved ownership of `src/canvas/account/board-workspace.ts`. Authorization loss now notifies runtime before disposal so native buffered updates survive 401 and capture failure. Viewer stopped SyncPeer behavior and nonmutating disposal remain intact. A real 401 preservation canary verifies the ordering; `28e5744`.
3. **[Rule 1 — integration accessibility]** Restored the generic authentication error alert role after the broader regression exposed its removal; `7a9a862`.
4. **[Rule 3 — stale regression contracts]** Added approved ownership of `tests/authentication.spec.ts` and `tests/board-access.spec.ts`. Replaced pre-native-shell and pre-journal assumptions with stronger current native/server/journal assertions while preserving independent denial and persistence oracles; `0afa172`.

## Integration handoff

The frozen AccessScope interface from plans 06/09 remains unchanged. Suspension makes the native Store readonly before capturing buffered updates, stops engines, publishes paused scope and aborts source requests. Reauthorization uses a fresh workspace; no implicit readonly restoration is used. Pending image reads are confined to the source account/board/generation lifetime, and disposal clears them and object URLs. Viewer hydration and stopped reader SyncPeer remain from plan 05.

The journal database `dali-account-recovery-v1` is separate from legacy local originals. Its records carry opaque account/board identity and replay requires a freshly authorized descriptor. Discard is scoped to the original account and board. Plan 11 must preserve this separation when offering local-copy import. Session broadcasts contain only event kind and deduplication ID; no board content is broadcast.

Threats T-03-22, T-03-23 and T-03-24 have automated isolation, replay and stale-response evidence above. No new server endpoint, provider setting or dependency was introduced. Browser IndexedDB, session restoration and state-signal surfaces are covered by the approved threat model.

## Evidence limits and remaining acceptance

Actual-provider acceptance, deployment configuration and final Phase 3 requirement acceptance remain plan 12 obligations. Shared AUTH-01, BOARD-01 and BOARD-04 requirements remain open. Broader durability is Phase 4; 20-user live collaboration is Phase 5.

Persisted pageshow is exercised with a constructed `PageTransitionEvent`; actual browser BFCache eviction/restoration is not claimed. Programmatic keyboard/focus and constructed composition events do not establish native OS IME or screen-reader speech behavior. Native 200% browser zoom remains a narrow final operator check; viewport geometry and CSS scaling are not substitutes. WINDOWS entry 9 records these recovery-specific obligations alongside existing entry 8 for sharing. No required automated assertion is skipped, and no implementation stub remains.

Next: [03-11-PLAN.md](03-11-PLAN.md) (explicit local-board copies), then [03-12-PLAN.md](03-12-PLAN.md) (final verification and operator acceptance).

## Self-Check: PASSED

Created artifacts exist and all eight source/test commits resolve. The persisted base ledger yields eight implementation commits and twelve changed source/test files. Required task selections are nonzero, the final 51-case browser regression has zero skips, and shared requirement completion remains deferred to final acceptance.
