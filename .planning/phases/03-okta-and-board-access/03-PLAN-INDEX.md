# Phase 3 — Executable Plan Index

**As an** internal member, **I want to** sign in through Okta, find my authorized boards and work within owner-controlled permissions, **so that** board content and images are available only to their owners and members granted access.

Scope authority: [03-CONTEXT.md](03-CONTEXT.md) (sixteen approved access decisions), [03-RESEARCH.md](03-RESEARCH.md) (source-supported implementation), [03-UI-SPEC.md](03-UI-SPEC.md) (39 approved UI predicates), [03-VALIDATION.md](03-VALIDATION.md) (test and evidence obligations). These plans authorize implementation only after plan checking; this artifact contains no implementation evidence.

## Execution order

Twelve plans, 26 tasks, eleven waves. Plan 01 is the mandatory test/package prerequisite conventionally called Wave 0; its metadata uses wave 1 so normal executor ordering remains valid. The first application implementation task is the production end-to-end sign-in tracer 03-02-01. This explicit prerequisite exception keeps tools/fixtures available before the tracer without one oversized multi-subsystem task. Account adapter conformance in plan 05 is mandatory before broad shell migration in plan 06.

| Plan | Wave | Depends on | Tasks | Files | Outcome |
|---|---:|---|---:|---:|---|
| [03-01-PLAN.md](03-01-PLAN.md) | 1 | — | 2 | 9 | Verify dependency provenance and prepare the authenticated test harness |
| [03-02-PLAN.md](03-02-PLAN.md) | 2 | 03-01 | 2 | 9 | Sign in through OIDC and retain an expiring Dali session |
| [03-03-PLAN.md](03-03-PLAN.md) | 3 | 03-02 | 2 | 8 | Create private boards and browse the authorized library |
| [03-04-PLAN.md](03-04-PLAN.md) | 4 | 03-03 | 2 | 8 | Save and retrieve board-bound documents and images |
| [03-05-PLAN.md](03-05-PLAN.md) | 5 | 03-04 | 2 | 5 | Prove the production account workspace before migrating editor entry |
| [03-06-PLAN.md](03-06-PLAN.md) | 6 | 03-05 | 2 | 9 | Open account boards in the established canvas shell |
| [03-07-PLAN.md](03-07-PLAN.md) | 7 | 03-06 | 2 | 9 | Manage active and pending internal access |
| [03-08-PLAN.md](03-08-PLAN.md) | 8 | 03-07 | 2 | 8 | Rename, duplicate and delete boards through role-aware controls |
| [03-09-PLAN.md](03-09-PLAN.md) | 9 | 03-08 | 2 | 6 | Enforce native read-only editing and permitted viewer exports |
| [03-10-PLAN.md](03-10-PLAN.md) | 9 | 03-08 | 3 | 9 | Preserve interrupted work and isolate account recovery |
| [03-11-PLAN.md](03-11-PLAN.md) | 10 | 03-09, 03-10 | 3 | 9 | Copy selected browser-local work into private account boards |
| [03-12-PLAN.md](03-12-PLAN.md) | 11 | 03-11 | 2 | 5 | Verify all access boundaries and record actual-provider acceptance |

Plans 09 and 10 own disjoint files and may implement in parallel. All shared App/header/library/routes/CSS edits are ordered by dependencies. Production builds, browser ports, fixtures and screenshots have one exclusive execution slot even in wave 9. Tasks modify at most five files and plans at most ten. The planner owns no implementation changes. Estimates use measured calibration factor 1, zero samples, confidence low.

## Interface contracts

All names below are new application contracts unless their source is named. Follow these definitions; do not ask executors to redesign identity or storage.

### Server, configuration and tests

- `server/app.ts` exports `buildApp({ config, database?, now?, beforeCommit? })` and is the executable emitted entrypoint. Its direct-execution branch validates config, migrates the database, then listens. The test-only launcher injects clock/transaction barriers; production never reads test-auth switches to impersonate a member.
- Required server-only generic keys: `DALI_ORIGIN`, `DALI_DATABASE_PATH`, `DALI_SESSION_SECRET`, `DALI_SESSION_TTL_MS`, `DALI_OIDC_ISSUER`, `DALI_OIDC_CLIENT_ID`, `DALI_OIDC_CLIENT_SECRET`, `DALI_OIDC_CALLBACK_URL`, `DALI_INTERNAL_CLAIM`, `DALI_INTERNAL_VALUES_JSON`, `DALI_INTERNAL_EMAIL_DOMAINS_JSON`; optional `DALI_EMAIL_CASE_FOLD=false`. Real values stay outside the repository. Do not expose secrets via Vite variables. Trusted assignment as membership requires an explicit operator policy; absent trust fails closed.
- Expiry is Unix milliseconds throughout. TTL is a positive safe integer, bounded to 31 days as a generic input safety bound, and `now + TTL` must remain safe; actual value is operator-owned. Authorization requires `now < expiresAt`. No silent rolling renewal or refresh-token dependency.
- `server/storage/database.ts` exports `openDatabase`, `runMigrations`, and a transaction handle used by board modules. Enable foreign keys. Migrations run transactionally before listening, are recorded by version and tested against a fresh temporary database. Modules register additive migration definitions through this handle. There is no ORM schema-push tool; the live SQLite migration plus real table read/write/rollback is the blocking schema proof.
- Add scripts: `server:build = tsc -p tsconfig.server.json`; `typecheck:server = tsc -p tsconfig.server.json --noEmit`; `test:server = vitest run --config vitest.server.config.ts`; `test:access:server = npm run server:build && node .gsd/access-build/tests/oidc-provider.js --serve-access`; `test:access = playwright test --project=access`. Existing static/unit/build/browser commands retain their names. Server ESM output lives under ignored `.gsd/access-build`.
- Server compiler includes `server/**/*.ts` and the Node fixture entrypoint `tests/oidc-provider.ts` (self-test and serve-access modes); frontend test/harness types remain in the existing root typecheck. `vitest.server.config.ts` selects `server/**/*.test.ts`, Node environment, no empty-suite success.
- Test launcher starts one signed provider on loopback port 5496 and two separate real app instances: backend 5495 with dev origin 5494, backend 5497 with production-preview origin 5493. Each has its own temporary database/client registration/exact callback; do not weaken origin checks to a wildcard for shared fixtures. Vite dev proxy targets 5495; preview proxy targets 5497. Fixture contexts authenticate normally against the corresponding application.
- Test launcher compiles from plan 01 and loads `buildApp` only when starting application suites from plan 02. Its provider self-test can run before the application exists. Explicitly restrict `account-workspace.spec.ts` to dev and set testIgnore for it in prod, prod-firefox, prod-webkit and access. Full test:browser exercises this harness only through dev. All assigned browser tests carry their task tags; server test filters also use task tags where specified. Fail on zero selected/skipped required tests. Keep console/page-error collection and narrow expected-error declarations.

### Identity, session and common request guard

`SessionDescriptor = { accountId, displayName, email, expiresAt }`; accountId is an opaque member ID backed by unique `(issuer, subject)`. Email/display name are mutable metadata. The claim policy validates issuer, internal claim/value, subject and subject-checked UserInfo before session issuance. Canonical pending email preserves local-part case by default, normalizes the domain and never strips aliases; optional full case folding requires operator uniqueness validation. Ambiguous email binding leaves pending grants inactive.

Members, sessions and login transactions use separate tables. Session identifiers are random opaque values managed by the session plugin, rotated on login; session storage contains stable member ID and absolute expiry. Login transactions bind state/nonce/PKCE verifier/return intent to the pre-login browser session, expire after ten minutes and are consumed once. Public JSON/errors/logs exclude tokens, cookies, verifier and secrets.

All protected responses use `Cache-Control: private, no-store`. Bootstrap GET /api/session discovers accountId and does not require X-Dali-Account; it exposes only the minimal session descriptor and no board data. Auth start/callback also precede discovery. Known-account session revalidation may send the header and rejects mismatch. Subsequent protected board/image/mutation browser requests send `X-Dali-Account: <expected accountId>`; mismatch with cookie identity returns 409 `IDENTITY_CHANGED`, never acting as the new identity. Every cookie-authenticated mutation additionally requires exact configured Origin, `X-Dali-Request: 1` and route-approved content type; no permissive CORS. OIDC callback instead validates its one-use protocol transaction. Missing/expired session returns 401; absent/unauthorized board or unbound resource returns uniform 404 `BOARD_UNAVAILABLE`; a forbidden capability on a readable board returns 403; stale revision returns 409. Error bodies reveal no target metadata. Re-read session/role inside every commit transaction.

### SQL board model and roles

- `boards(id, owner_id, title, root_doc_id, content_doc_id, created_at, updated_at, revision)`; unique stable IDs; title is SQL-canonical. Document root binds one content subdoc only. Every mutation uses prepared statements and same-transaction authorization.
- `board_grants(board_id, member_id, role, revision)` unique by board/member; role is `editor | viewer`. `pending_grants(board_id, issuer, canonical_email, role, revision)` unique by board/issuer/email. Ownership takes precedence and cannot be changed through grants.
- `board_documents(board_id, doc_id, update_bytes)`, `board_blobs(board_id, blob_key, mime, bytes, hash)`, `board_thumbnails(board_id, bytes, mime)` use composite associations. No global blob/document lookup may authorize a request. Content hashes alone confer no access.
- `operations(member_id, operation_id, kind, status, board_id, result)` provides stable results for create/duplicate/import/delete/grants. `import_staging` stores importer, source authority if any, regenerated descriptor, complete referenced-image manifest and received bytes. Publish only in the final transaction. Retries reuse operation ID; a deliberate new action creates another ID.
- `BoardSummary = { id, title, updatedAt, role, access: 'private'|'shared', pendingCount, thumbnailUrl?, accountId }`. Sort `updatedAt DESC, id ASC`. All includes accessible boards, Mine owns boards, Shared with me has non-owned explicit grants. Zero active and pending grants means private; either means shared.
- Export `BoardRole = 'owner'|'editor'|'viewer'`, `canBoard` and `requireBoardCapability` from `server/boards/routes.ts`. Capabilities: read/image/presentation-export for all readers; write/rename/editable-export/duplicate for owner/editor; grants/delete for owner. JSON title maximum is 200 graphemes; create blank uses Untitled board, blank rename retains prior value. Reject overlength visibly without truncation.

### HTTP surface

| Route | Contract / authority |
|---|---|
| GET /auth/start | Browser-bound single-use OIDC transaction; preserve validated local return intent. |
| GET /auth/callback | Library code/PKCE/state/nonce/issuer/signature/audience/lifetime checks; internal identity and pending activation; rotate session. |
| GET /api/session | Current minimal session descriptor or 401; never protected board content. |
| POST /api/logout | CSRF guard, preserve-work UI precedes request, destroy Dali session; repeated call harmless. |
| GET /api/boards?filter=all\|mine\|shared | Authoritative authorized summaries and deterministic order. |
| POST /api/boards | { title?, operationId }; server-owned private creation and root/content IDs, 201 or replay result. |
| GET /api/boards/:boardId | { summary, rootDocId, contentDocId, capabilities, revision }; authorize before any mount. |
| PATCH /api/boards/:boardId | { title, revision, operationId }; owner/editor, conflict on stale revision. |
| DELETE /api/boards/:boardId | { revision, operationId }; owner, transactional board/grant/doc/image deletion. |
| GET /api/operations/:operationId | Current member's completed/unknown operation result for reconciliation; never another actor's operation. |
| POST /api/boards/:boardId/docs/:docId/pull | Bounded state vector -> binary Yjs difference; reader plus exact document allowlist. |
| POST /api/boards/:boardId/docs/:docId/push | Bounded Yjs update -> committed acknowledgment; owner/editor and immutable resource bindings. |
| GET /api/boards/:boardId/blobs | Authorized board keys only. |
| GET, PUT, DELETE /api/boards/:boardId/blobs/:key | Reader get; writer set/delete; referenced delete conflicts; size/type/key checks. |
| GET, PUT /api/boards/:boardId/thumbnail | Reader get, writer set, current account/generation, no-store and bounded PNG; invalidated after content change. |
| GET /api/members?q=...&boardId=... | Requesting board owner searches established internal records only; stable ordering and bounded results. |
| GET, POST /api/boards/:boardId/grants | Owner list/create active or pending grant; Viewer default. |
| PATCH, DELETE /api/boards/:boardId/grants/:grantId | Owner, expected grant revision and operationId; repeated revoke harmless. |
| GET /api/boards/:boardId/editable-export | Owner/editor capability and source revision; snapshot/document plus authorized blob manifest. |
| POST /api/boards/:boardId/duplicate | Owner/editor starts an idempotent source-bound staging operation; client native transform regenerates IDs. |
| POST /api/imports | Authenticated explicit selected local copy staging; title, manifest, operationId. |
| PUT /api/imports/:operationId/document | Stage bounded transformed root/content bytes and referenced image manifest for importer. |
| PUT /api/imports/:operationId/blobs/:key | Stage validated image bytes for declared manifest only. |
| POST /api/imports/:operationId/commit | Recheck session/identity and source role/revision if duplicate; complete manifest -> atomic private publication. |
| GET /api/imports/:operationId | Importer's per-operation reconciliation status. |

Declare conservative configurable byte limits with defaults: 8 MiB document update, 64 KiB state vector, 1 MiB JSON/metadata, 512 KiB thumbnail. Reuse established PNG/JPEG input byte/pixel bounds from image import; stage total bounded to 256 MiB and 10,000 objects, with a visible rejection before any completed copy. Validate merged root/content bindings and referenced image membership before publication. Size overflow or malformed decode must produce controlled failure with no commit. These are input safety bounds, not phase performance claims.

### Runtime, native editor and recovery

- `createAccountWorkspace({ descriptor, accountId, generation, signal, onPendingDocument, onPendingBlob, onAcknowledged, onAuthorizationLost })` returns public BoardWorkspace with exactly root/content IDs. BoardDoc uses StoreContainer and the established extension/history lifecycle; BoardMeta hydrates one server-authorized board. Use public affine store/sync contracts and preserve notices. The account import graph contains no test workspace.
- DocSource pull/push and BlobSource get/set/delete/list close over descriptor/account/generation. No denied read falls back to local data. Reader mode seeds authoritative data, sets readonly before observers and records zero nonempty local/network mutations. Disposal aborts/stops/detaches/revokes/destroys without a data clear or backend write.
- Plan05 test-only dev module harness mounts native EditorHost with real source modules. Its output is conformance evidence; ordinary production shell coverage begins in plan06. No account-runtime debug fixture enters production bundle.
- Plan06 freezes `AccessScope = Readonly<{ accountId: string; boardId: string; generation: number; role: BoardRole; canWrite: boolean; phase: 'active'|'paused'|'disposed' }>` in runtime.ts. Export `getActiveAccessScope(): AccessScope | null`, `subscribeAccessScope(listener): () => void` and synchronous `suspendAccessScope(reason): void`. Only runtime lifecycle replaces snapshots. Plan09 only consumes these signatures; plan10 supplies transitions behind the same contract. This is the immutable interface prerequisite for their parallel work.
- Runtime is memoized by account/board/generation, rejections are retryable, and stale generations cannot attach. SQL title remains authoritative. Account preview generation uses the existing renderer only while account/board generation and write capability remain valid. Display fetches thumbnail bytes with X-Dali-Account and AbortSignal, validates generation, then creates a short-lived object URL; revoke URLs on refresh, session/role change and unmount. Plain img src cannot carry the expected-account header. Denied/stale thumbnail canaries must never render.
- Session states: loading, authenticated, expiring, preserving, auth-paused, recovering, access-denied, identity-changed, signed-out, error. Local mutation permission requires authenticated current generation plus write capability. Dialog visibility is independent of this gate.
- Outbox records contain opaque accountId, boardId, generation, monotonic local sequence, update bytes, referenced unsent blobs and acknowledgment state in a new account namespace. Persist before redirect/sign-out; storage failure keeps the current tab paused. Replay blobs before referencing updates only after same identity plus fresh writable descriptor. Acknowledgment deletes only that completed record.
- Revoke object URLs and clear visible cards/previews on auth change; BroadcastChannel/storage fallback carries state only. Stale tabs send expected identity. BFCache pageshow remains paused until revalidation. Different identity and revoked/viewer recovery retain quarantined original-account work and send no writes.
- `createStagingWorkspace(reservedDescriptor)` uses the public composition with isolated in-memory sources and no network/outbox observers; content Store starts uninitialized. Read source with docToSnapshot, but invoke snapshotToDoc only on this separate destination. The pinned transformer creates snapshot.meta.id after beforeImport middleware: a transformer-specific replacement generator returns the reserved content ID on its first page call, then fresh block IDs. Validate reserved root/content binding, extract bytes, dispose staging without source/network writes and compare original document/map/image hashes and doc membership before/after. Plan05 proves this seam; plans08/11 reuse it.
- Legacy inventory uses unchanged original DB/catalog and a separate read-only path that does not create/delete/update boards. Explicit selections only; account caches/outbox never enter it. Local copy retains originals, exact titles, image bytes and native map hierarchy/collapse/style.

## Requirement and decision coverage

| Requirement | Plans | Primary execution proof |
|---|---|---|
| AUTH-01 | 01, 02, 06, 10, 12 | Signed protocol/session tests, full-redirect recovery, separately reported provider acceptance. |
| BOARD-01 | 03–06, 08, 10–12 | Private create/reopen/new-tab/rename/duplicate and selected image-complete local copy. |
| BOARD-02 | 03, 06–08, 12 | Authorized cards/status/role/filter/order and refreshed sharing. |
| BOARD-03 | 07, 08, 12 | Owner-only active/pending grants, trusted one-time activation and revocation. |
| BOARD-04 | 01, 03–12 | Direct resource denials, transactional role checks, reader/native/export controls and no-state-change oracles. |

| Decision | Executing tasks |
|---|---|
| D-01 | 03-02-01, 03-02-02, 03-06-01 |
| D-02 | 03-10-01, 03-10-02, 03-10-03 |
| D-03 | 03-02-01, 03-02-02, 03-10-01 |
| D-04 | 03-02-02 |
| D-05 | 03-03-01, 03-11-01 |
| D-06 | 03-07-01, 03-07-02 |
| D-07 | 03-07-01 |
| D-08 | 03-07-01 |
| D-09 | 03-09-02 |
| D-10 | 03-08-01, 03-09-01 |
| D-11 | 03-08-01, 03-08-02 |
| D-12 | 03-07-01, 03-08-01 |
| D-13 | 03-03-01, 03-06-01 |
| D-14 | 03-03-02 |
| D-15 | 03-06-02, 03-08-02 |
| D-16 | 03-05-02, 03-10-01, 03-10-02, 03-11-01 through 03-11-03 |

## Edge and UI execution mapping

Each criterion below is lifted verbatim into its owning plan's truths; the full predicates remain in [03-VALIDATION.md](03-VALIDATION.md) (24 requirement edges) and [03-UI-SPEC.md](03-UI-SPEC.md) (39 UI states). Final acceptance 03-12-01 inventories every case and fails on zero/skipped required assertions.

| Edge marker | Owning task |
|---|---|
| AUTH-01 boundary | 03-10-01 |
| AUTH-01 empty | 03-02-02 |
| AUTH-01 encoding | 03-02-02 |
| AUTH-01 precision | 03-02-02 |
| AUTH-01 idempotency | 03-02-02 |
| AUTH-01 concurrency | 03-10-02 |
| BOARD-01 adjacency | 03-03-01 |
| BOARD-01 empty | 03-03-01 |
| BOARD-01 encoding | 03-08-01 |
| BOARD-01 ordering | 03-03-02 |
| BOARD-01 idempotency | 03-08-01; 03-11-01 |
| BOARD-01 concurrency | 03-06-02; 03-11-03 |
| BOARD-02 adjacency | 03-03-02 |
| BOARD-02 empty | 03-03-02 |
| BOARD-02 encoding | 03-03-02 |
| BOARD-02 ordering | 03-03-02 |
| BOARD-03 adjacency | 03-07-01 |
| BOARD-03 empty | 03-07-01 |
| BOARD-03 encoding | 03-07-02 |
| BOARD-03 ordering | 03-07-02 |
| BOARD-03 idempotency | 03-07-01 |
| BOARD-03 concurrency | 03-07-02 |
| BOARD-04 idempotency | 03-04-01; 03-04-02 |
| BOARD-04 concurrency | 03-04-01; 03-04-02 |

| UI marker | Executing task | Test file |
|---|---|---|
| UI-AUTH-loading | 03-02-01 | `tests/authentication.spec.ts` |
| UI-AUTH-error | 03-10-03 | `tests/session-recovery.spec.ts` |
| UI-AUTH-overflow | 03-10-03 | `tests/session-recovery.spec.ts` |
| UI-AUTH-long-text | 03-10-03 | `tests/session-recovery.spec.ts` |
| UI-HOME-empty | 03-03-02 | `tests/board-library.spec.ts` |
| UI-HOME-loading | 03-03-02 | `tests/board-library.spec.ts` |
| UI-HOME-error | 03-03-02 | `tests/board-library.spec.ts` |
| UI-HOME-populated | 03-03-02 | `tests/board-library.spec.ts` |
| UI-HOME-partial | 03-03-02 | `tests/board-library.spec.ts` |
| UI-HOME-overflow | 03-03-02 | `tests/board-library.spec.ts` |
| UI-HOME-zero-one-many | 03-03-02 | `tests/board-library.spec.ts` |
| UI-HOME-long-text | 03-03-02 | `tests/board-library.spec.ts` |
| UI-TITLE-empty | 03-08-02 | `tests/board-actions.spec.ts` |
| UI-TITLE-loading | 03-08-02 | `tests/board-actions.spec.ts` |
| UI-TITLE-error | 03-08-02 | `tests/board-actions.spec.ts` |
| UI-TITLE-partial | 03-08-02 | `tests/board-actions.spec.ts` |
| UI-TITLE-long-text | 03-08-02 | `tests/board-actions.spec.ts` |
| UI-SHARE-empty | 03-07-01; 03-07-02 | `tests/board-sharing.spec.ts` |
| UI-SHARE-loading | 03-07-01; 03-07-02 | `tests/board-sharing.spec.ts` |
| UI-SHARE-error | 03-07-01; 03-07-02 | `tests/board-sharing.spec.ts` |
| UI-SHARE-populated | 03-07-01; 03-07-02 | `tests/board-sharing.spec.ts` |
| UI-SHARE-partial | 03-07-01; 03-07-02 | `tests/board-sharing.spec.ts` |
| UI-SHARE-overflow | 03-07-01; 03-07-02 | `tests/board-sharing.spec.ts` |
| UI-SHARE-zero-one-many | 03-07-01; 03-07-02 | `tests/board-sharing.spec.ts` |
| UI-SHARE-long-text | 03-07-01; 03-07-02 | `tests/board-sharing.spec.ts` |
| UI-COPY-empty | 03-11-02; 03-11-03 | `tests/local-board-import.spec.ts` |
| UI-COPY-loading | 03-11-02; 03-11-03 | `tests/local-board-import.spec.ts` |
| UI-COPY-error | 03-11-02; 03-11-03 | `tests/local-board-import.spec.ts` |
| UI-COPY-populated | 03-11-02; 03-11-03 | `tests/local-board-import.spec.ts` |
| UI-COPY-partial | 03-11-02; 03-11-03 | `tests/local-board-import.spec.ts` |
| UI-COPY-overflow | 03-11-02; 03-11-03 | `tests/local-board-import.spec.ts` |
| UI-COPY-zero-one-many | 03-11-02; 03-11-03 | `tests/local-board-import.spec.ts` |
| UI-COPY-long-text | 03-11-02; 03-11-03 | `tests/local-board-import.spec.ts` |
| UI-CANVAS-empty | 03-06-01 | `tests/board-access.spec.ts` |
| UI-CANVAS-loading | 03-06-01 | `tests/board-access.spec.ts` |
| UI-CANVAS-error | 03-06-01 | `tests/board-access.spec.ts` |
| UI-CANVAS-populated | 03-09-01; 03-09-02 | `tests/board-roles.spec.ts` |
| UI-CANVAS-overflow | 03-08-02 | `tests/board-actions.spec.ts` |
| UI-CANVAS-long-text | 03-08-02 | `tests/board-actions.spec.ts` |

## Operator boundary and remaining evidence

Automate all synthetic checks before the single actual-provider checkpoint 03-12-02. Operator supplies confidential registration, assigned test members, denied identity and trusted membership/email policy outside this repository. The agent runs the configured environment checks after setup; report actual provider acceptance separately. Only native zoom/assistive-technology cases unavailable to automation remain additional narrow observations.

All generated public content stays organization-neutral. No real issuer, deployment domain, secret, user record, screenshot, machine path or real-provider trace enters planning/source/history. Phase4 owns restart/recovery/backup/deployment acceptance; Phase5 owns live collaboration, reconnect/presence/active-connection revocation and 20-user workloads. These plans establish current HTTP authorization and auth-interruption preservation.

## Probe discipline

Spec-less edge fallback: 24 surfaced / 24 explicit / zero dismissed. UI probe: 39 explicit. Prohibition recall asked each of five requirements what it could silently become, then filtered routine engineering and referred canonical spoofing, CSRF, injection, access control and resource abuse to the ASVS threat register and security review. Four bespoke constraints remain: explicit local selection/original preservation; deliberate Dali-only sign-out; truthful pending-access communication; public operator-data exclusion. They are projected by the installed `projectProhibitions` serializer into the relevant plan frontmatter without check descriptors. Their downstream status remains flagged-unverified until genuine execution review/check evidence resolves them; planned tests are not wired-check proof.
