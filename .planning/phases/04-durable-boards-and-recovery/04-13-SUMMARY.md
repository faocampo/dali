---
phase: 04-durable-boards-and-recovery
plan: "13"
subsystem: infra
tags: [containers, sqlite, tls, oidc, lifecycle, production]
requires:
  - phase: 04-11
    provides: Current-epoch backup scheduling and durable-write admission
provides:
  - Pinned production-only app and static-web images with actual Linux SQLite proof
  - Loopback-only proxy trust, local health probes and bounded graceful shutdown
  - Self-contained actual-image TLS/OIDC and durable restart smoke harness
  - Generic deployment, storage ownership and ingress contract
affects: [04-14, 04-15, 04-16]
tech-stack:
  added: []
  patterns: [Same-pod HTTPS ingress boundary, nonroot read-only runtime, mutation fencing before drain]
key-files:
  created: [Dockerfile, .dockerignore, tsconfig.production.json, deploy/nginx.conf, server/storage/lifecycle.ts, scripts/production-smoke.mjs, docs/deployment.md]
  modified: [package.json, server/app.ts, server/preflight.test.ts]
key-decisions:
  - Pin official Node 24 and nginx image digests; build and verify native SQLite inside Linux without upgrading dependencies.
  - Trust only the first loopback proxy hop; require operator TLS ingress with private access to web port 8080.
  - Keep liveness independent of identity and backup outages; fence mutations before draining within a 45-second deadline and specify 60-second Kubernetes grace.
requirements-covered: [OPS-01]
requirements-completed: []
coverage:
  - id: D-09
    description: Pinned production app and web images with native SQLite and actual secure authenticated durable restart
    requirement: OPS-01
    verification:
      - kind: integration
        ref: docker build --target app -t dali-phase4-app:acceptance .
        status: pass
      - kind: integration
        ref: docker build --target web -t dali-phase4-web:acceptance .
        status: pass
      - kind: e2e
        ref: node scripts/production-smoke.mjs --app-image dali-phase4-app:acceptance --web-image dali-phase4-web:acceptance
        status: pass
    human_judgment: false
  - id: D-11
    description: Production output excludes test startup and uses external generic identity/storage configuration
    requirement: OPS-01
    verification:
      - kind: integration
        ref: server/preflight.test.ts#@04-13-02
        status: pass
      - kind: other
        ref: PRODUCTION_BOUNDARY_NATIVE_PASS runtime image probe
        status: pass
    human_judgment: false
  - id: production-operator-envelope
    description: Operator storage independence, locking/flush/capacity, single-writer deployment and cluster infrastructure acceptance
    requirement: OPS-01
    verification: []
    human_judgment: true
    rationale: Synthetic local containers do not establish private operator infrastructure or the approved representative acceptance envelope.
actuals:
  tokens: 10358
  tasks: 2
  commits: 4
plan_head_before: a843581decdfde2b94f07186fc46a942eeb621af
duration: 15min measured commit interval; earlier build time unmeasured
completed: 2026-09-26
status: complete
---

# Phase 4 Plan 13: Production Container Boundary Summary

**Pinned nonroot app/web images run real signed OIDC through TLS, commit native SQLite documents/images, and preserve acknowledgments through graceful shutdown and restart.**

## Performance and commits

Two tasks and ten deliverable files completed. The measured first-task-commit to final implementation-commit interval was 15 minutes; preflight and earlier image build elapsed time were not fully captured. Actual tokens use changed deliverable diff characters divided by four, rounded up. Commit count was measured from the persisted plan ledger before summary metadata commits.

| Task | Commit | Result |
|---|---|---|
| 04-13-01 | `f600476` | Pinned production images, native Linux SQLite rebuild/probe and compiler boundary |
| 04-13-02 RED | `7c6c680` | Four intentional missing health/proxy assertions; RED_EVIDENCE_OK |
| 04-13-02 GREEN | `4e7c171` | Runtime lifecycle, extended preflight tests, secure image smoke and deployment guide |
| Intermediate metadata | `51e4119` | Preserved a subsequently resolved false-positive runtime-gate checkpoint |

Historical initial prerequisite checkpoint `a843581` is the ledger base. The operator subsequently enabled the intended daemon; actual elevated rechecks returned Docker server 29.6.2 and registry version/source/integrity matching pinned better-sqlite3 13.0.3.

## Verification evidence

- Both exact planned Docker build commands passed, including rebuilds after runtime changes. Official image digests are recorded in `Dockerfile` and `docs/deployment.md`.
- Actual Linux arm64 Node 24.21 native binding compilation/load succeeded. The build emitted `NATIVE_SQLITE_WAL_FULL_PASS` after opening file-backed SQLite with WAL and FULL synchronous mode.
- An actual final app image probe under nonroot, read-only rootfs, dropped capabilities and temporary writable `/tmp` emitted `PRODUCTION_BOUNDARY_NATIVE_PASS`. It checked native SQLite and excluded test/fixture/planning paths.
- `npm run test:server -- server/preflight.test.ts`: **9 passed**, zero skipped. Tests include local health gates, loopback versus external proxy trust, invalid trust configuration, admitted-request draining/idempotence and shutdown deadline.
- `npm run test:server`: **307 passed in 13 files**, zero skipped. Reported wall time: 21.96 seconds.
- `npm run typecheck` and `npm run typecheck:server`: passed before both task commits. Production compiler and script syntax check passed.
- Exact `node scripts/production-smoke.mjs --app-image dali-phase4-app:acceptance --web-image dali-phase4-web:acceptance`: **IMAGE_SMOKE_PASS**. Actual HTTP assertions covered static index and JS; unauthenticated rejection; signed OIDC/PKCE; Secure, HttpOnly, SameSite=Lax cookies; spoofed forwarding input; canonical callback; session and recovery epoch; board creation; validated image upload; acknowledged Yjs document update; provider outage with live/ready probes; SIGTERM exit 0 within 45 seconds; same-volume restart; and exact image/document bytes plus session afterward.
- Owned smoke containers and volumes were confirmed absent after cleanup. Existing user services were preserved.

## TDD Gate Compliance

The first valid RED run selected seven tests: four failed on intentional behavior assertions and three passed. The targeted liveness assertion expected HTTP 200 and received HTTP 404. The persisted evidence was checked by `check tdd-red-evidence` and returned `RED_EVIDENCE_OK` before implementation. RED commit precedes task 2 GREEN. Two additional shutdown tests brought the final targeted count to nine.

The separate blocking runtime gate was initially interpreted too broadly. Fresh configuration returned `workflow.tdd_mode=false`, with no enabling invocation flag; its documented activation conditions therefore made it inactive. The checkpoint retains this correction. Ordinary task-level TDD remained required and was followed. No override or history rewriting occurred.

## Files and interfaces

- `Dockerfile`, `.dockerignore`, `tsconfig.production.json`: pinned build/run boundary, allowlisted context, production compiler, native verification and pruned runtime.
- `deploy/nginx.conf`: nonroot static server and loopback backend proxy with overwritten forwarding headers.
- `package.json`: three additive production build/start scripts, preserving unrelated user changes.
- `server/storage/lifecycle.ts`, `server/app.ts`: `startProductionLifecycle()`, `/health/live`, `/health/ready`, explicit `DALI_TRUST_PROXY=loopback` and SIGTERM/SIGINT drain.
- `server/preflight.test.ts`: executable health/proxy/lifecycle evidence.
- `scripts/production-smoke.mjs`: owned synthetic TLS/OIDC fixtures mounted separately from production images, with fail-closed actual HTTP and restart checks.
- `docs/deployment.md`: external generic configuration, volume ownership, ingress and single-writer deployment contract.

## Deviations and resolved issues

1. **[Rule 3 — Build blocker]** The initial context omitted tracked logo assets referenced by Vite. Added only the required allowlisted assets and build copies. Both actual image targets then built (`f600476`).
2. **[Rule 3 — Build blocker]** npm 11 requires lifecycle-script approval; a rebuild alone skipped native install scripts. Explicitly approved the existing pinned better-sqlite3 and esbuild scripts in the build stage, then rebuilt and proved the binding. No dependency upgrade or new package was selected (`f600476`).
3. **[Rule 1 — Fixture bug]** The initial synthetic PNG had an invalid checksum and was correctly rejected by image validation. Replaced it with generated PNG chunks and CRC32; the complete image smoke subsequently passed (`4e7c171`).

## Remaining acceptance boundaries

The existing `@blocksuite/icons@2.2.17` engine metadata excludes Node 24 and emits a build warning; the actual build and runtime gates passed. This plan does not change its version. Operator infrastructure remains responsible for TLS/host enforcement, private ingress-only web access, independent backup storage, durable flush and locking, capacity, secrets, and prevention of concurrent writers. Representative Kubernetes deployment and storage/recovery acceptance remain external gates for the phase verifier. Requirement acceptance status is unchanged.

## Known Stubs

None. No required planned verification was skipped. New health and proxy surfaces are within the plan's declared ingress/runtime trust boundary.

## Next Plan Readiness

Production packaging and synthetic secure runtime proof are complete. The orchestrator may continue with the next dependency-ready plan; broader phase acceptance remains pending.

## Self-Check: PASSED

All ten declared deliverables exist. Task commits `f600476`, `7c6c680` and `4e7c171` exist, no tracked files were deleted, and the measured source diff contains the implementation described above.
