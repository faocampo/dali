---
phase: 03-okta-and-board-access
plan: "02"
subsystem: auth
tags: [oidc, pkce, sqlite, sessions, identity, csrf]
requires:
  - phase: 03-01
    provides: signed provider, installed server libraries and isolated browser harness
provides:
  - Real code/PKCE sign-in with single-use browser-bound transactions
  - Exact issuer/subject identity and persistent absolute-expiry SQL sessions
  - Protected account entry, recoverable errors and deliberate local logout
  - Current-session, expected-member and mutation guards for board routes
affects: [03-03, 03-04, 03-06, 03-07, 03-10, 03-12]
tech-stack:
  added: []
  patterns: [transactional additive migrations, explicit ID-token signature checks, absolute Unix millisecond expiry]
key-files:
  created: [server/app.ts, server/storage/database.ts, server/auth/oidc.ts, server/auth/session-store.ts, server/auth/identity-policy.ts, server/auth/oidc.test.ts, src/auth/AuthBoundary.tsx, tests/authentication.spec.ts]
  modified: [src/App.tsx]
key-decisions:
  - Keep buildApp configuration environment-shaped and server-only, matching the signed-provider launcher.
  - Validate ID-token signatures explicitly and bind UserInfo to the validated subject before internal eligibility.
  - Use the index contract POST /api/logout with exact-origin, custom-header and expected-member checks.
requirements-completed: []
requirements-supported: [AUTH-01]
coverage:
  - id: trusted-authentication
    description: Signed protocol rejection, stable identity, persistent sessions and server expiry boundaries
    requirement: AUTH-01
    verification:
      - kind: integration
        ref: server/auth/oidc.test.ts
        status: pass
    human_judgment: false
  - id: protected-entry
    description: Real sign-in, loading isolation, deliberate logout, return intent, error recovery and browser restart
    requirement: AUTH-01
    verification:
      - kind: e2e
        ref: tests/authentication.spec.ts
        status: pass
    human_judgment: false
actuals:
  tokens: 12947
  tasks: 2
  commits: 4
plan_head_before: 60f3a398a9970e9a6c2a06f349909d5ebec18f5b
duration: 23min
completed: 2026-09-16
status: complete
---

# Phase 3 Plan 2: OIDC Sign-in and Persistent Sessions Summary

**A signed OIDC code/PKCE exchange now establishes an opaque, expiring SQL session before the protected account shell mounts; explicit logout destroys only the Dalí session.**

## Accomplishments

- Added versioned, transactional migrations for members, sessions and login transactions with foreign keys, unique exact issuer/subject identity, prepared statements and an additive migration seam. Fresh-database, ledger idempotency, real writes and failed-migration rollback are exercised.
- Login transactions bind state, nonce, PKCE verifier and a validated local board/new intent to a short-lived pre-login browser session. Callback consumption is atomic and single-use, including malformed, expired and concurrent replay attempts. The browser session is rechecked after provider I/O.
- Discovery/code exchange uses openid-client with explicit signature verification, issuer/audience/expiry/state/nonce checks and subject-bound UserInfo. Membership and verified internal-email policy fail closed. Changed email/name updates metadata; reused email and identical subjects from different issuers remain separate members.
- Persistent HttpOnly, host-only, SameSite=Lax cookies use Secure for HTTPS configuration. SQL expiry is absolute Unix milliseconds with a positive safe integer TTL bounded to 31 days, safe time arithmetic and exact expiry rejection. Reads do not roll expiry. Production rejects test-auth switches in both supplied and ambient configuration and exposes no fixture authentication route.
- Protected entry remains unmounted while the session is loading. Ordinary entry redirects to the provider; explicit signed-out and error pages remain stable until deliberate retry. Local logout uses POST /api/logout. The current account is cleared on logout/expiry; existing canvas components and legacy storage remain preserved for the later authorized-board integration.

## Task Commits

1. Task 03-02-01 RED: `e45acaa` — require OIDC entry and deliberate local sign-out.
2. Task 03-02-01 GREEN: `1257a7e` — sign in through OIDC with persistent local sessions.
3. Task 03-02-02 RED: `85653bc` — cover callback trust and absolute session expiry.
4. Task 03-02-02 GREEN: `f9e36c5` — enforce callback trust and absolute session boundaries.

Normal hooks ran. Staged diffs passed whitespace and public-data review; no tracked files were deleted. The four task commits are measured from the persisted plan base. Actual token scale is realized task diff characters divided by four, rounded upward; metadata is excluded. Implementation timing begins at the first test artifact, 13:16:12 UTC, and ends at approximately 13:39 UTC; initial context loading precedes that interval.

## Verification

| Command / evidence | Observed result |
|---|---|
| `npm run typecheck` | Passed before both task commits and after final changes |
| `npm run typecheck:server` | Passed before both task commits and after final changes |
| `npm exec playwright test -- tests/authentication.spec.ts --project=prod --grep "@03-02-01"` | 2 passed, 0 skipped, 8.8s; committed tracer feedback rerun: 2 passed, 8.7s |
| `npm run test:server -- server/auth/oidc.test.ts` | Final 57 passed, 0 skipped, 5.79s |
| `npm exec playwright test -- tests/authentication.spec.ts --project=prod` | Final 10 passed, 0 skipped, 10.6s |
| `npm test` | 79 passed across 7 files, 1.06s |
| `npm run test:server` | 60 passed across 2 files, 6.18s |
| `npm run server:build` and `npm run build` | Passed as mandatory fresh browser-harness startup steps |
| Synthetic viewport assertions and screenshots | 490px and 1404px: no horizontal overflow, logout target at least 44px; screenshots inspected locally |

The exact task02 command chain ran successfully after the canonical logout route and final source changes. All browser runs used isolated provider/backend/preview ports and retained the runtime-error collector, allowing only the expected unauthenticated bootstrap 401 console message. No user browser-local board data was accessed.

### Acceptance predicates and threat evidence

- **AUTH-01 empty / T-03-02:** 19 signed negative provider cases cover issuer, audience, signature, state, nonce, expiry, required identity claims, membership, verified internal email and UserInfo subject. Missing code/state, foreign browser transaction, wrong PKCE, expiration and replay create no authenticated session or member mutation. Browser tampered-nonce testing obtains a real signed token and observes rejection plus a working retry.
- **AUTH-01 encoding / T-03-03:** email/name changes preserve accountId; separate subjects with the same email and the same subject under separate issuers receive distinct accountIds.
- **AUTH-01 precision / D-04 / T-03-03:** expiry minus one millisecond succeeds; expiry and expiry plus one deny. Zero, negative, fractional, NaN, infinity, oversized TTL and overflowing clock arithmetic fail closed. A new app/SQL connection restores the session; a full Chromium process restart independently restores the persistent cookie with unchanged identity/expiry. An expired browser cookie denies at the real endpoint.
- **AUTH-01 idempotency / D-03 / T-03-04:** repeated callbacks produce at most one session. Forged origin, missing custom header, unsupported content type and stale expected identity cannot log out the valid session. Repeated valid logout is harmless. Reload remains signed out; deliberate sign-in reuses the still-active provider session.
- **D-01 / UI-AUTH-loading:** ordinary entry follows the provider, board/new intents survive through server transaction state, external/invalid destinations collapse to home, and a delayed session check exposes neither protected account content nor canvas/local database initialization.

## TDD Gate Compliance

Both tasks have observed assertion failures, `RED_EVIDENCE_OK` before implementation, and RED commits before their corresponding GREEN commits. Task01 failed because the original anonymous shell never reached the provider link. Its isolated RED configuration omitted the not-yet-created backend launcher, while running the real existing application. Task02 failed because ambient test-auth configuration was not rejected. Playwright/Vitest results were normalized into TAP records for the installed TAP-only evidence classifier; the records remain in ignored local GSD artifacts. The initial task02 promise-rejection assertion caused a serializer error on the resolved Fastify instance; it was replaced with a direct boolean assertion and rerun to an intentional RED before authorization to implement. Filter-excluded tests during RED were all executed in the final full suite.

## Interfaces for Following Plans

- `buildApp({ config, database?, now?, beforeCommit? })`: config retains the exact environment-shaped DALI_* contract. The transaction barrier parameter is reserved for later board mutations. Production direct execution validates configuration, migrates, then listens. Missing/incomplete injected configuration serves a generic recoverable authentication error.
- `openDatabase(path)` returns a better-sqlite3 database handle with `transaction`, `prepare` and `exec`; `runMigrations(database, additional)` accepts additive `{ version, sql }` definitions. Authentication owns version 1; subsequent migrations must use new versions.
- `currentSession(database, request, now)` re-reads the authoritative session/member join. `requireExpectedMember(request, reply, member, required=true)` denies missing session with 401 and mismatched identity with 409. Bootstrap /api/session passes `required=false` but still rejects an explicitly wrong expected identity.
- `requireMutation(request, reply, config, types=['application/json'])` requires the exact configured Origin, X-Dali-Request: 1 and a route-approved content type. Board routes must compose it with current session/expected member and current board capability inside their commit transaction.
- `registerOidcRoutes`, `SqliteSessionStore` and `validateInternalIdentity` are exported from their cohesive auth modules. `validateInternalIdentity` currently obtains internal policy/email/name from the subject-bound UserInfo response. Actual provider claim placement remains an operator validation item.
- `AuthBoundary` exposes authenticated descriptor and deliberate async sign-out through its render callback. Plan03 replaces the minimal authenticated account surface with the real library; plan06 mounts authorized account boards; plan10 adds editing preservation and account-switch recovery before redirects/sign-out.

## Deviations and Issues

No architecture or requirement scope change. Task02 also finalized the plan-owned browser/UI files to exercise actual browser restart, expiry, loading and error predicates; the complete plan remains within its nine assigned files. The route test cookie helper was corrected to use the final Set-Cookie value after session rotation, matching actual browser behavior. Hardening also closed ambient test-switch detection, generic configuration-error redaction and long-TTL timer handling within the assigned authentication boundary. No unresolved authentication stub, skipped required check or new unplanned security surface remains.

Official API verification: [openid-client enableNonRepudiationChecks](https://github.com/panva/openid-client/blob/main/docs/functions/enableNonRepudiationChecks.md) (explicit JWT signature validation) and [Fastify session](https://github.com/fastify/session) (cookie/store/session lifecycle), checked alongside the installed pinned sources.

## Evidence Limits and Next Plan

AUTH-01 remains pending at phase level. Real Okta registration, claim mapping, membership/email trust, operator lifetime and actual-provider acceptance are reserved for plan12. Browser board-target tests establish intent preservation; board authorization/mounting arrives in plans03–06. The existing canvas suites require the planned authenticated fixture/shell transition and are not claimed as passing here; all 79 existing unit tests pass. Full editing expiry/pending-work recovery and multi-tab identity isolation belong to plan10. Phase4 durability/deployment and Phase5 live collaboration acceptance remain separate.

Ready for plan03, with no external operator prerequisite for the remaining synthetic implementation slices.

## Self-Check: PASSED

All eight created files and the modified App exist. All four task commits exist. The final focused server/browser suites have nonempty passing cases with zero skips, and the staged task diff passes static, whitespace and privacy checks. Shared AUTH-01 is deliberately unmarked until the remaining owning plans and operator gate finish.
