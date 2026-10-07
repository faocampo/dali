---
phase: 03-okta-and-board-access
plan: "04"
subsystem: api
tags: [authorization, yjs, sqlite, images, account-sources]
requires:
  - phase: 03-03
    provides: Private boards, root/content seed documents and current-role request guards
provides:
  - Board-bound CRDT pull/push with transactional identity and role checks
  - Composite image resources, bounded raster validation and referenced-delete protection
  - Account document/blob sources with pending, acknowledgment and authorization channels
affects: [03-05, 03-06, 03-10, 03-11]
tech-stack:
  added: []
  patterns: [same-transaction authorization, binary HTTP sources, bounded raster parsing]
key-files:
  created: [server/boards/documents.ts, server/boards/blobs.ts, server/boards/access.test.ts, src/canvas/account/doc-source.ts, src/canvas/account/doc-source.test.ts, src/canvas/account/blob-source.ts, src/canvas/account/blob-source.test.ts]
  modified: [server/boards/routes.ts, server/app.ts]
key-decisions:
  - Preserve the pinned BlockSuite padded base64url SHA-256 image key format within exact board associations.
  - Re-read latest document bytes and current session/account/role in the synchronous commit transaction after the injected scheduling barrier.
  - An authorized missing image returns IMAGE_UNAVAILABLE; authorization failures throw through the source and invoke the access-loss callback.
requirements-completed: []
requirements-progressed: [BOARD-01, BOARD-04]
plan_head_before: 1b9594ed6ab42c496035f443f3b4600a2c340f1c
actuals:
  tokens: 14924
  tasks: 2
  commits: 4
duration: 21min
completed: 2026-09-16
status: complete
coverage:
  - id: D1
    description: Authorized CRDT convergence and unchanged-state document denials
    requirement: BOARD-04
    verification:
      - kind: integration
        ref: server/boards/access.test.ts#@03-04-01
        status: pass
      - kind: unit
        ref: src/canvas/account/doc-source.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Composite image access, reference integrity and reader-safe source lifecycle
    requirement: BOARD-04
    verification:
      - kind: integration
        ref: server/boards/access.test.ts#@03-04-02
        status: pass
      - kind: unit
        ref: src/canvas/account/blob-source.test.ts
        status: pass
    human_judgment: false
---

# Phase 3 Plan 4: Board-Bound Documents and Images Summary

**Authorized Yjs synchronization and raster image resources now use exact board associations, transaction-time identity checks, and client acknowledgment only after committed server success.**

## Outcomes and Commits

1. Task 03-04-01: `f39d30c` RED, `2749596` GREEN — binary document pull/push, exact root/content allowlist, bounded decoding, independent reader convergence, replay idempotency, schema/resource binding, SQL timestamp/revision updates and atomic thumbnail invalidation. Concurrent updates merge against the latest committed document. Source requests retain account/generation and report authorization failure before upstream retry handling can hide it.
2. Task 03-04-02: `5e4e7f5` RED, `5621491` GREEN — migration 4 adds composite board/blob storage, list/get/set/delete, SHA-256 key checks, PNG/JPEG byte/header/dimension validation, bounded PNG inflation, per-board byte quota and referenced-delete conflicts. Reader sources never schedule writes, expose missing-image separately, and revoke their managed object URLs on access loss/disposal.

Four task commits measured from `plan_head_before` before documentation commits. Token actuals are the realized implementation/test diff length divided by four, rounded up; nine implementation/test files changed. No dependency installation or tracked deletion occurred.

## Verification

| Command | Result |
|---|---|
| `npm run typecheck` | Passed |
| `npm run typecheck:server` | Passed |
| `npm run test:server -- server/boards/access.test.ts -t '@03-04-01'` | 9 selected cases passed, 1.76s |
| `npm test -- src/canvas/account/doc-source.test.ts` | 7 passed, 145ms |
| `npm run test:server -- server/boards/access.test.ts -t '@03-04-02'` | 8 selected cases passed, 1.39s |
| `npm test -- src/canvas/account/blob-source.test.ts` | 9 passed, 154ms |
| `npm run test:server` | 84 passed across 4 files, 6.18s; all 17 resource cases ran without skips |
| `npm test` | 95 passed across 9 files, 1.07s |
| `npm run build` | Passed TypeScript and production Vite build; Vite 422ms |
| `npm exec playwright test -- tests/authentication.spec.ts tests/board-library.spec.ts tests/board-access.spec.ts --project=prod` | 21 passed, 16.0s, fresh isolated servers and production build |

The two task filters report the other task's cases as excluded; the final unfiltered server run executes all required assertions. The browser run retains the established runtime-error collector. Existing Node localStorage and terminal-color warnings remain unchanged. Browser results cover the current authentication/library/authorized transition; account canvas conformance and mounting remain plans 03-05 and 03-06.

Denial assertions compare owner rereads, stored document bytes/state vectors, board metadata and image bytes/hashes. Cases include repeated Viewer/non-member requests, stale expected account, exact Origin/request/content-type checks, foreign document/subdocument IDs, malformed/oversized updates, foreign image references, guessed blob keys, same hash on different boards, PNG/JPEG corruption and dimension bounds, image quota and SQL failures. Injected pre-commit barriers exercise revocation, expiry and identity replacement; failed operations expose no canary or success acknowledgment. Client tests cover pending-storage failure, generation invalidation, abort, authorization callback, no cached-byte fallback, read-only mutation rejection and URL teardown.

## TDD Gate Compliance

| Task | Intentional RED assertion | Gate | GREEN |
|---|---|---|---|
| 03-04-01 | Authorized editor push expected 200, received 404 from absent route | RED_EVIDENCE_OK before production edits | 9 server and 7 source cases |
| 03-04-02 | Authorized image PUT expected 200, received 404 from absent route | RED_EVIDENCE_OK before production edits | 8 server and 9 source cases |

The installed validator accepts flat Node TAP. Vitest's nested TAP required a mechanical normalization of the named failing leaf plus the measured one-test/one-failure summary. Raw TAP and normalized evidence were retained in temporary execution artifacts. Initial default/nested reporter parsing was rejected; production edits began only after the normalized evidence returned RED_EVIDENCE_OK. Both RED commits precede their respective GREEN commits. No refactor commit was needed.

## Interfaces for Subsequent Plans

- `registerDocumentRoutes(app, config, database, now, beforeCommit?)`, `documentBytes(database, board, docId)`, `validateDocument(doc, board, docId)` and `referencedImageKeys(doc)` are exported by `server/boards/documents.ts`. Update default is 8 MiB; state-vector default is 64 KiB. Root `spaces` binds exactly one authorized content subdocument; native metadata `pages` accepts either plain records or Y.Map records for that ID. Content has one page and one surface, valid block IDs and no foreign subdocuments.
- `registerBlobRoutes(...)`, `BlobRepository`, `validateImageBytes`, `imageHash`, `validBlobKey` and `IMAGE_LIMITS` are exported by `server/boards/blobs.ts`. Image limits match the existing input path: 16 MiB, 16 megapixels, 8192 per dimension; aggregate board bytes are bounded to 256 MiB. PNG validation checks chunk CRC, raster layout and bounded inflation; JPEG validation checks marker/segment structure, dimensions, scan and end markers. Browser pixel decoding remains part of the established import path.
- Migration 4 is now used. `board_blobs(board_id,blob_key,mime,bytes,hash)` has the planned composite primary key and board foreign key. Later migrations must use unused versions.
- `BoardDocSource` implements the public pinned DocSource. `SourceOptions` carries `boardId`, `rootDocId`, `contentDocId`, `accountId`, `generation`, optional `signal`, `readonly`, `isCurrent(generation)`, `fetch`, `onPendingDocument(docId, bytes)`, `onAcknowledged(token)` and `onAuthorizationLost(error)`. The token returned by pending capture is forwarded only after a confirmed commit. `SourceAccessError.status` identifies access failures. `subscribe` returns an abort-listener cleanup; current HTTP phase explicitly pulls on reopen.
- `BoardBlobSource` implements BlobSource with the same scope fields and `onPendingBlob(key, blob)`. `get` returns null only for authorized `IMAGE_UNAVAILABLE`; access denial throws. `objectURL`, `revokeURL` and `dispose` manage optional presentation URLs. Callers provide generation validation and disposal signals, and keep source shadows empty across accounts.
- The server returns `{ acknowledged: true }` for document push and `{ acknowledged: true, key }` for blob writes. Pending hooks run before network persistence. Missing/unbound boards remain generic; readable-board forbidden capabilities return 403; expected-account mismatch returns 409; referenced deletion returns 409 `IMAGE_REFERENCED`.

## Deviations from Plan

- **[Rule 3 — integration wiring]** Added the narrow `server/app.ts` forwarding of the already-declared `beforeCommit` option. Without it the deterministic race seam could not reach resource routes. Approved by the orchestrator; prior session/route behavior is preserved and the full server/browser regression passes.
- **[Rule 1 — pinned metadata compatibility]** The final root validation accepts native Y.Map page metadata as well as plain records while retaining the exact content-ID constraint. Added a positive root round-trip and rejected foreign-metadata assertion. Document image-reference validation is completed with the image table in task 2 so publication cannot bind foreign or absent blobs.

No unresolved implementation blocker, stub, skipped required test or new threat surface outside T-03-07/08/09 was identified. Shared requirement acceptance remains pending until the phase's downstream native/runtime/recovery and final access gates.

## Evidence Limits and Operator Obligations

Actual-provider registration/claim-policy acceptance remains externally configured and unrun here. Phase 4 owns restart/backup/recovery acceptance; Phase 5 owns real-time transport and concurrent-user workload acceptance. HTTP source success proves these routes and adapters; full native account-workspace compatibility remains the next mandatory plan.

Sources checked: Yjs [Document Updates](https://docs.yjs.dev/api/document-updates), Fastify [Content-Type Parser](https://fastify.dev/docs/latest/Reference/ContentTypeParser/), and installed BlockSuite 0.22.4 public source contracts and SHA-256 utility. Context7 CLI was unavailable; official documentation and pinned source supplied the API evidence.

## Self-Check: PASSED

All nine implementation/test files and all four task commits exist. Static checks, focused/full tests, production build, browser regression, staged whitespace review and public-data review passed. Existing unrelated image assets and orchestration lock were preserved.
