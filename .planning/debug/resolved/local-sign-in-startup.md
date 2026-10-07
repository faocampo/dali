---
status: resolved
trigger: "Local page shows sign-in failure; Sign in again opens an HTTP response error."
created: 2026-09-17
updated: 2026-09-17
resolved: 2026-09-17
---

## Symptoms

expected: Opening the documented local development URL reaches a working sign-in and board library.
actual: Initial session check shows a sign-in error; the retry navigation fails.
errors: Session and authentication-start paths return HTTP 500 with empty bodies.
timeline: Reported after Phase 3 introduced authenticated board access.
reproduction: Start the documented development command, open its root URL, then choose Sign in again.

## Current Focus

bug_class: bohrbug
hypothesis: Confirmed: the original development command started only the frontend, with authentication proxy and callback settings coupled to separately launched test services.
next_action: None for this debug session; the parent owns remaining project tracking and the final commit.

reasoning_checkpoint:
  hypothesis: The frontend-only dev command causes session and sign-in failures because its hardcoded proxy requires an absent separately launched backend.
  confirming_evidence:
    - The dev package script is Vite alone and the proxy points at the browser-test backend.
    - The reported requests return empty HTTP 500 while the backend listener is absent.
    - The test harness registers another callback origin and removes its temporary database during close.
  falsification_test: With the old frontend-only startup and no backend, a successful session check followed by signed sign-in would refute this cause.
  fix_rationale: Launch all required local services together with matching origins, retain runtime state across normal restart, and keep browser harness startup explicit.
  blind_spots: Native browser interaction and actual-provider acceptance require their separate existing checkpoints; automated verification will use synthetic accounts and isolated ports.
  candidate_causes:
    - code: dev script omits required application services.
    - config: hardcoded browser-test proxy and callback origins differ from ordinary development.
    - environment: stale or conflicting listeners could independently prevent a new launcher from starting.
    - data: invalid session cookies could affect sign-in but cannot cause an absent proxy backend.
  and_gate: yes; frontend-only startup and the proxy dependency on an absent backend jointly explain the initial response failure. Callback and ephemeral state would prevent simply reusing the test harness as a durable local workflow.

## Evidence

- The frontend process is listening while its proxy backend is absent.
- Both proxied session and authentication-start requests return HTTP 500.
- The package dev script starts Vite only; its proxy defaults to the browser-test service.
- The signed test harness registers a different frontend callback and deletes its temporary database at shutdown, so merely starting it is insufficient for ordinary local development.
- No local debug knowledge base or MemPalace connector is available; no matching prior resolution was used.
- Common-pattern match is environment/config startup dependency; deterministic source and reported HTTP reproduction support the Bohrbug classification.
- SBFL skipped: there is no per-test coverage for the development entrypoint. Direct startup tracing localized the mismatch without repository-wide bisection.
- Project skill directories contain no task-specific skills; configured agent-skills query did not expose an additional specialist skill.
- Implemented a dedicated development launcher with signed provider/API/Vite composition, matching loopback origins, atomic private session-secret creation, retained SQLite state, strict ports and shutdown cleanup.
- Development compilation, frontend typecheck and server typecheck passed.
- First regression cycle: all collision and fail-closed cases passed; a nonexistent-path privacy probe received the expected SPA fallback, so the probe was corrected to request the actual private identity file, which is denied.
- Second regression cycle: actual browser rendering exposed a missing UTF-8 declaration in the synthetic provider page; added explicit charset without changing protocol behavior.
- Specialist review: unavailable; no installed TypeScript specialist skill exists. Manager reviewed the source-backed direction and acceptance scope.
- Third regression cycle: the full signed browser scenario passed, including board creation, sticky-note editing, saved content after stop/restart in a clean context, retained session, stable account identity, wrong-origin rejection, editor grant/revocation, and explicit sign-out persistence. No page exceptions occurred.
- Fourth regression cycle: all four startup tests passed together in 21.17 seconds. The browser scenario passed again in 11.15 seconds; collision checks covered all three ports; fail-closed checks covered production mode, non-loopback host, corrupt state, and changed identity origin; terminating the compiler child left no listeners.
- Existing adjacent authentication and preflight suites passed: 63 tests across 2 files in 7.32 seconds.
- Revert/reapply control temporarily restored the original frontend-only package dev entry: session and authentication-start returned HTTP 500. Restoring the complete entry returned HTTP 401 for an unsigned session and HTTP 302 for sign-in initiation. The package file was restored exactly and all control listeners closed.
- Raw Vite smoke verified the configurable API/auth proxy target and HTTP 403 denial of an actual ignored runtime file. A probe initially used Vite port zero, which Vite maps to its occupied default; it failed closed, and the corrected explicit-free-port probe passed.
- Final frontend/server typechecks, development compilation, JavaScript syntax checks, and diff whitespace checks passed. The production authentication entrypoint and policy were unchanged.
- All test/browser/control processes and temporary runtime directories were cleaned up. The original user Vite listener was preserved for the parent restart. Existing browser IndexedDB was not modified by these isolated tests.
- Parent live workflow verification passed after replacing the verified frontend-only listener with the complete npm dev command on the canonical loopback URL. A fresh browser page reached the explicitly labeled synthetic sign-in selector; selecting Synthetic Owner returned to the application with Your boards, the account header, New board, and Copy local boards visible. The working page was left open.

## Eliminated

- Invalid browser data as the primary cause: a missing proxy target fails before application session or board data can be read.

## Boundaries

- Keep local synthetic sign-in explicit and loopback-only; use the real OIDC validation and application authorization paths.
- Preserve the actual-provider checkpoint, existing user browser data, unrelated assets and prior acceptance evidence.
- Production entrypoints remain independent from development/test provider code.

## Resolution

root_cause: The documented dev command starts only Vite while its proxy depends on an absent test backend; the test harness callback origin and temporary-state cleanup also make it unsuitable for ordinary restartable local development.
fix: Complete npm dev composition with persistent private local state; raw Vite moved to dev:ui; generic API proxy target applies to both dev and preview; synthetic provider page is explicitly labeled and UTF-8 encoded.
oracle_type: specified
verification:
  target_test: { result: pass, command: "npm run test:dev", tests: 4, failures: 0 }
  mutation_check: { result: skipped, reason_if_skipped: "Stryker is not installed or configured for this repository." }
  no_op_deletion: { result: pass, deletion_justified_by_rca: true, detail: "The frontend-only package entry is replaced with complete service startup; authentication/authorization checks remain intact." }
  adjacent_tests: { result: pass, suites_run: ["server/auth/oidc.test.ts", "server/preflight.test.ts"], tests: 63 }
  revert_and_reconfirm: { result: pass, bug_returned_on_revert: true, fixed_on_reapply: true }
  live_workflow_check: { result: pass, source: "Parent interactive browser verification", detail: "Complete local startup reached the synthetic selector and returned to the authenticated board library with account and board controls visible." }
  guardrail_verdict: accepted
cycles: 4
specialist_hint: typescript
specialist_review: unavailable; manager reviewed acceptance scope and direction.
why_not_caught: Existing browser tests start the test backend separately, so they did not exercise the documented frontend-only npm dev entrypoint or normal local state retention.
recurrence_guard: "scripts/dev-startup.test.mjs (actual npm dev startup, signed browser workflow, restart retention, strict-port rejection and cleanup); npm run test:dev"
files_changed: [scripts/dev.mjs, scripts/dev-server.ts, scripts/dev-startup.test.mjs, tsconfig.dev.json, package.json, vite.config.ts, playwright.config.ts, tests/oidc-provider.ts, README.md]
limitations: Actual-provider and the remaining native interaction acceptance items retain their existing checkpoints. Restart evidence covers local development and does not accept the later durable-recovery milestone. This journal was resolved and archived after the parent live workflow check; the parent owns project tracking and the final commit. No additional tests, staging, or commits were performed during archival.
