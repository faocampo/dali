---
phase: 03-okta-and-board-access
plan: "01"
subsystem: testing
tags: [oidc, fastify, sqlite, pkce, test-harness]
requires:
  - phase: 02-daily-mind-maps
    provides: accepted canvas foundation and regression tooling
provides:
  - Verified exact server dependencies and isolated NodeNext compilation
  - Signed synthetic OIDC provider with 17 observable protocol checks
  - Four-identity browser helpers and state-preserving denial oracles
affects: [03-02, 03-03, 03-04, 03-05, 03-06, 03-12]
tech-stack:
  added: [fastify 5.12.5, "@fastify/cookie 11.1.2", "@fastify/session 11.1.3", openid-client 6.8.8, better-sqlite3 13.0.3]
  patterns: [signed test-only provider, exact-origin dual backend fixtures, no-empty server selection]
key-files:
  created: [tsconfig.server.json, vitest.server.config.ts, server/preflight.test.ts, tests/oidc-provider.ts, tests/access-fixtures.ts]
  modified: [package.json, package-lock.json, playwright.config.ts, vite.config.ts]
key-decisions:
  - Explicitly enable openid-client non-repudiation checks to validate ID-token signatures.
  - Load the application lazily and pass environment-shaped server-only config to buildApp with an injected clock.
  - Use the verified SQLite package prebuild; no lifecycle scripts or native rebuild were necessary.
requirements-completed: []
requirements-supported: [AUTH-01, BOARD-04]
coverage:
  - id: dependency-preflight
    description: Exact pins, ESM loading and actual SQL commit/rollback
    verification:
      - kind: integration
        ref: server/preflight.test.ts
        status: pass
    human_judgment: false
  - id: signed-protocol
    description: Signed protocol exchange and malformed callback/code rejection
    verification:
      - kind: integration
        ref: tests/oidc-provider.ts --self-test
        status: pass
    human_judgment: false
actuals:
  tokens: 16421
  tasks: 2
  commits: 3
plan_head_before: 3b48c837e73203712020c496352c908a4cc87d3f
duration: 14min
completed: 2026-09-16
status: complete
---

# Phase 3 Plan 1: Authenticated Test Harness Summary

**Verified server dependencies, native SQLite transactions and a signed OIDC fixture establish the test boundary for the upcoming application sign-in tracer.**

## Accomplishments

- Preserved existing canvas pins and scripts; added exact server pins, direct Yjs 13.6.31/RxJS 7.8.2/y-protocols 1.0.7 declarations and SQL types 9.6.0. NodeNext emits isolated ESM under ignored `.gsd/access-build`.
- The provider implements discovery, JWKS, authorization, token and subject-checked UserInfo with generated RSA keys, S256, nonce/state, one-use expiring codes and independent synthetic account cookies. Controllable faults cover issuer, audience, signature, claims, nonce/state, UserInfo subject and time. No production login bypass was introduced.
- The launcher lazily imports the future `buildApp({ config, now })`, owns temporary database directories and cleanup, and configures separate dev/preview origins, callbacks and registrations. Configuration uses generic DALI_* keys; session/client secrets are generated at runtime.
- Helpers prepare Owner, Editor, Viewer and Non-member contexts through normal application redirects. Repository seeding is an explicit test-process callback. Distinct valid PNG/text canaries and owner re-reads compare document bytes, state vectors, image hashes, grants and metadata after denials.
- Existing Playwright projects remain; the access project selects Phase 3 suites. The native account-workspace harness is dev-only. One worker and fresh services preserve exclusive execution. Vite dev/preview proxies target their respective backends while retaining decorator/CSS transforms.

## Task Commits

1. Task 03-01-01 RED: `f44473c` — require reviewed server pins and transaction preflight.
2. Task 03-01-01 GREEN: `890a9cb` — pin verified server dependencies and compile Node ESM.
3. Task 03-01-02: `2da661d` — signed provider, separate account helpers and access launcher.

Actual tokens are ceil(realized nine-file implementation diff characters / 4): 65,682 / 4. The measured three commits cover task implementation before this metadata commit.

## Verification Results

| Command/check | Result |
|---|---|
| `npm run typecheck && npm run typecheck:server && npm run test:server -- server/preflight.test.ts` | Pass; 3 tests, 0 skipped; final focused run 194 ms |
| `npm run server:build && node .gsd/access-build/tests/oidc-provider.js --self-test && npm run typecheck` | Pass; 17 named protocol checks, 0 skipped |
| Real Node ESM imports plus in-memory SQLite create/commit smoke | Pass; native driver loaded successfully; rollback separately asserted by the preflight suite |
| `npm test` | Pass; 79 tests across 7 files, 0 skipped; 967 ms |
| `npm run build` | Pass; 3,884 transformed modules, Vite build 8.22 seconds |
| Fixture-oracle probe against compiled helpers | 6 checks passed: distinct valid PNG, unchanged denial, text leak rejected, image leak rejected, mutated owner reread rejected, repository-only grant seeding |
| Playwright config assertions | Five projects retained/added, dev-only native harness exclusion and fresh server policy passed |
| `npm run test:server -- server/no-such-required-suite.test.ts` | Expected exit 1; empty required selection fails |
| Staged diff check and privacy scan | Pass; synthetic identities/example domain, no private configuration or host paths in task files |

The 17 protocol checks include a successful signed exchange/UserInfo/replay cycle, three additional identity cookies, eight invalid-token/state cases, incorrect PKCE/replay, exact code-expiry boundary, mismatched UserInfo, invalid redirect/required parameters, and controlled missing membership claims. Missing membership is exposed to future application policy tests; the protocol library alone does not decide internal membership.

## Dependency Evidence

All nine direct pins were matched to their declared official repositories and downloaded registry SHA-512 integrity. The 58 added lockfile entries were independently fetched and matched to exact registry tarballs/integrity; existing canvas pins were preserved. `npm audit signatures` verified 525 registry signatures and 118 available attestations. Registry provenance was available for openid-client and better-sqlite3; several other direct pins had no provenance attestation. Integrity/signature verification establishes artifact origin, with lifecycle and runtime checks providing separate evidence.

No install scripts ran: both installs used `--ignore-scripts`. Changed packages had no preinstall/install/postinstall hooks. Development-only prepare declarations included cookie's `ts-scripts install`, pino-abstract-transport's `husky install`, and ret's `tsc`; none was enabled. The SQLite driver has `gypfile: false` and bundled native prebuilds, so its verified prebuild loaded successfully without a rebuild.

Retained freshness warnings: fastify 5.12.5 (published 2026-09-16), @fastify/session 11.1.3 (2026-09-14), and openid-client 6.8.8 (2026-09-05) were flagged as suspicious solely by release freshness. Exact origin/integrity and available attestations passed. No unresolved harmful install script was identified.

Primary source identities: [Fastify](https://github.com/fastify/fastify), [Fastify Cookie](https://github.com/fastify/fastify-cookie), [Fastify Session](https://github.com/fastify/session), [panva openid-client](https://github.com/panva/openid-client), [WiseLibs better-sqlite3](https://github.com/WiseLibs/better-sqlite3), [Yjs](https://github.com/yjs/yjs), [RxJS](https://github.com/ReactiveX/rxjs), [Y protocols](https://github.com/yjs/y-protocols), [DefinitelyTyped SQL types](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/better-sqlite3). Exact tarball hashes and URLs remain in [package-lock.json](../../../package-lock.json) (dependency integrity ledger). The [official OIDC example](https://github.com/panva/openid-client/blob/main/examples/oidc.ts) (code exchange and UserInfo) and installed 6.8.8 declarations guided API usage; signature validation is explicitly enabled.

## TDD Gate Compliance

The initial focused Vitest run failed on the intended exact-pin assertion: the baseline manifest lacked the reviewed server dependencies. Two unrelated smoke cases were filtered out during that RED-only run; all three executed and passed in GREEN. The GSD RED checker parses Node TAP and did not recognize Vitest's nested TAP output, so the same baseline pin assertion was executed using Node's test runner. It returned one assertion failure and `RED_EVIDENCE_OK`.

**Process deviation:** scripts-disabled installation began after the observed RED failure but before the machine-readable gate and RED commit. The baseline assertion was independently replayed against the pre-change manifest and the gate passed before the GREEN commit. The test commit precedes the implementation commit in history. This timing deviation is retained in [WINDOWS.md](../../WINDOWS.md) (cross-phase process ledger); it is not represented as strict gate-order compliance. No refactor commit was needed.

## Deviations and Deferred Issues

- SQLite's actual exact pin ships a native prebuild; successful native loading and transaction assertions replaced an unnecessary rebuild. No alternative package or version was installed.
- Loopback self-test startup initially received a sandbox EPERM; the authorized loopback rerun passed.
- Existing nested BlockSuite Vitest dependencies produce eleven moderate audit entries, and the current runtime falls outside the existing icons package engine range. All listed static/unit/build checks pass. [deferred-items.md](deferred-items.md) (existing dependency follow-ups) records these out-of-scope items; no high/critical advisory was reported.
- Existing production-build warnings concern a mixed dynamic/static BlockSuite import and large chunks. This task preserved those transforms and completed the build.

## Evidence Limits and Next Plan

Plan 02 owns the application server. The lazy launcher is compiled and ready for that integration; no backend browser sign-in or real authorization-server session is claimed here. The full browser/access suites begin when that application exists, and ordinary browser fixtures migrate in plan 06. Helper-oracle probes exercise synthetic responses; actual protected-resource denial proof belongs to the assigned later plans. Production-mode rejection of test-auth switches belongs to plan 02.

Actual Okta configuration, directory policy and provider acceptance remain the final operator checkpoint. AUTH-01 and BOARD-04 remain incomplete until phase-level acceptance. Phase 4 retains restart/recovery/deployment acceptance and Phase 5 retains collaboration acceptance. No blocking stub exists within this plan's harness scope.

## Self-Check: PASSED

All five created task artifacts exist. Commits `f44473c`, `890a9cb` and `2da661d` exist in history. All task verification commands passed with nonempty cases, and the task diff passes whitespace/privacy checks. Application and operator acceptance limits are explicitly retained above.
