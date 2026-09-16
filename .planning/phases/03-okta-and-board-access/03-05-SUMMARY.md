---
phase: 03-okta-and-board-access
plan: "05"
subsystem: canvas
tags: [blocksuite, yjs, authorization, native-conformance, staging]
requires:
  - phase: 03-04
    provides: Authorized board document/image sources and transactional resource boundaries
provides:
  - Public BoardWorkspace, BoardDoc and BoardMeta composition for one authorized root/content pair
  - Native authenticated editing, reopening, images, mind maps, history and presentation export conformance
  - Read-only authoritative hydration and non-mutating disposal
  - Isolated reserved-destination snapshot transformation
affects: [03-06, 03-08, 03-09, 03-10, 03-11]
tech-stack:
  added: []
  patterns: [public-contract composition, authoritative-before-observers hydration, generation-bound disposal, isolated staging]
key-files:
  created: [src/canvas/account/board-workspace.ts, src/canvas/account/board-doc.ts, src/canvas/account/board-meta.ts, tests/account-workspace-harness.ts, tests/account-workspace.spec.ts]
  modified: [server/boards/routes.ts, server/boards/library.test.ts, server/boards/access.test.ts, vite.config.ts]
key-decisions:
  - Compose public StoreContainer, AwarenessStore, DocEngine and BlobEngine; keep network awareness disabled.
  - Hydrate Viewer documents directly before constructing a readonly Store, without starting SyncPeer's unconditional hydration-push lifecycle.
  - Seed canonical native page metadata and boxed surface elements on the server; reject malformed authoritative documents without blank fallback.
  - Reserve the first replacement ID for the staging content document, then generate fresh native block and element IDs.
requirements-completed: []
requirements-progressed: [BOARD-01, BOARD-04]
plan_head_before: 90b8f9a4e8c84310b635d73a51541539e567c58d
actuals:
  tokens: 12478
  tokens_basis: realized implementation diff characters divided by four; size estimate only
  model_token_usage: unavailable
  tasks: 2
  commits: 4
duration: 28min
completed: 2026-09-16
status: complete
coverage:
  - id: D1
    description: Authorized public native workspace create/edit/reopen with exact document binding
    requirement: BOARD-01
    verification:
      - kind: e2e
        ref: tests/account-workspace.spec.ts#@03-05-01
        status: pass
    human_judgment: false
  - id: D2
    description: Native images/maps/history/export, zero-write Viewer and disposal, identity isolation and staging
    requirement: BOARD-04
    verification:
      - kind: e2e
        ref: tests/account-workspace.spec.ts#@03-05-02
        status: pass
    human_judgment: false
---

# Phase 3 Plan 5: Native Account Workspace Conformance Summary

**One-board public BlockSuite workspaces now round-trip native canvas content through authenticated HTTP, while Viewers hydrate without writes and snapshot copies use an isolated reserved destination.**

## Outcomes and Commits

1. Task 03-05-01: `666340d` RED, `3f2ec01` GREEN — BoardWorkspace/BoardDoc/BoardMeta compose the public 0.22.4 contracts with established store extensions. Root/content bytes arrive from authorized sources before metadata validation and Store construction. Native shape/text edits persist across complete disposal and fresh reopening. Foreign document lookup fails closed.
2. Task 03-05-02: `665be17` RED, `360dc13` GREEN — isolated native staging; explicit readonly hydration; abort/generation checks; no-write teardown; subscription cleanup; stale metadata rejection; native image/map/history/export, identity-alternation and injected-subdocument conformance. The dev harness mounts the production native extensions and existing mind-map compatibility lifecycle.

Four implementation/test commits are measured from the recorded ledger before summary/tracking commits. The GSD `actuals.tokens` field is a diff-size estimate: the realized nine-file diff character count divided by four, rounded up. Actual model token usage is unavailable from the harness. No dependency installation or tracked deletion occurred.

## Verification

| Command | Result |
|---|---|
| `npm run typecheck` | Passed on the final revision |
| `npm run typecheck:server` | Passed |
| `npm run typecheck && npm run typecheck:server && npm exec playwright test -- tests/account-workspace.spec.ts --project=dev --grep '@03-05-01'` | 1 passed, 10.3s; cleared disposable Vite optimizer cache before this run |
| `npm run typecheck && npm exec playwright test -- tests/account-workspace.spec.ts --project=dev --grep '@03-05-02'` | 5 passed, 14.1s; final exact typography/image-pixel/source-byte assertions |
| Task 2 cold-cache conformance run | 5 passed, 13.9s after clearing the disposable Vite optimizer cache; final test refinements subsequently rerun above |
| `npm run test:server -- server/boards/library.test.ts server/boards/access.test.ts` | 24 passed, 2.38s |
| `npm test` | 95 passed across 9 files, 970ms |
| `npm run test:server` | 84 passed across 4 files, 6.17s |
| `npm run build` | Passed TypeScript and production Vite build, Vite 393ms |

The six distinct browser cases run through the signed synthetic provider, ordinary session cookies, actual board descriptors and production document/blob sources. The runtime-error collector remains active. No required case is skipped. Browser/server listener commands use the required local execution permission. An initial sandboxed server attempt failed with listener EPERM; the authorized rerun passed. Existing Node localStorage, terminal-color and development-Lit warnings remain unchanged.

The task-2 evidence includes:

- Image SHA-256 equality; source raster pixels present in the rendered PNG; nested map parent/order/collapse and exact 28px/700/#2468ab branch typography; complete native snapshot equality after reopening; functioning canUndo, undo and redo after Store extension loading.
- A separate signed Viewer context receives a real repository grant seeded only in the test process against its newly created synthetic board. It navigates, renders a permitted presentation export, reloads and disposes twice with zero push/PUT/DELETE requests, zero local Yjs mutations, unchanged owner-read root/content bytes and unchanged board descriptor. No application test-auth or grant bypass was introduced.
- Failed transport startup can be retried; a real delayed HTTP response is rejected after abort; foreign root/content subdocuments invalidate the workspace; generation replacement makes retained APIs stale; disposal schedules zero backend writes.
- Two genuinely authenticated identities alternate four times. Each workspace exposes exactly its own content ID and canary, rejects access after disposal, and receives a generic denial for the other identity's private board.
- The native destination transformer uses the reserved content ID and fresh block IDs. It retains image hashes, hidden descendants, original source document/root bytes, source snapshot and document membership. Staging has zero network/outbox calls and starts without a content Store.

## TDD Gate Compliance

| Task | Intentional RED assertion | Gate | GREEN |
|---|---|---|---|
| 03-05-01 | Authorized native workspace contract requested for server round-trip; absent module returned HTML instead | RED_EVIDENCE_OK before production changes | Native shape/text round-trip case |
| 03-05-02 | Native isolated staging factory expected function, received undefined | RED_EVIDENCE_OK before staging implementation | Five native/lifecycle/staging cases |

Raw Playwright JSON reports and mechanically normalized named-failure TAP records were retained in temporary execution artifacts. The installed RED validator accepts flat TAP; both records name a real assertion failure in the intended test. RED commits precede their corresponding GREEN commits. No refactor commit was needed.

## Interfaces for Subsequent Plans

- `createAccountWorkspace(options): Promise<BoardWorkspace>` accepts `descriptor`, `accountId`, `generation`, optional external AbortSignal, `isCurrent(generation)`, fetch override and existing `onPendingDocument`, `onPendingBlob`, `onAcknowledged`, `onAuthorizationLost` callbacks. `onReadonlyMutation` reports an unexpected reader mutation and closes the workspace. The descriptor is cloned. `key` is the JSON tuple of account/board/generation; plan 06 owns shell-level runtime reuse keyed to that tuple.
- `workspace.getDoc(descriptor.contentDocId)!.getStore()` returns the already loaded native Store. It runs the existing StoreExtensionManager extensions, `store.load()` lifecycle and initial `resetHistory()`. Server-created boards already contain the one canonical page/surface; hydration never invents a replacement blank board. `workspace.docs` returns a bounded copy of the content-document map; the root is `workspace.doc`.
- Owner/Editor synchronization uses a DocEngine with the board-bound HTTP main source and no shadows. `waitForSynced()` waits for committed source acknowledgment and releases its status subscription. Initial loading is bounded to 20 seconds. Source authorization loss closes the workspace before forwarding the callback.
- Viewer readonly is established in StoreContainer construction, before loaded hooks or native view observers. Root/content hydration completes first; read-only mutation observers attach before Store construction. The Viewer DocEngine stays stopped because pinned SyncPeer always enqueues a hydration diff. Refresh requires a fresh authorized workspace; HTTP polling/live transport is outside this plan and real-time synchronization remains Phase 5.
- `dispose()` is synchronous and idempotent: abort requests, stop engines, detach observers, make retained Stores readonly, dispose Store extensions, clear in-memory references, revoke source-managed URLs, destroy local awareness/Yjs objects. It performs no clear/remove transaction or resource deletion. Dispose the mounted EditorHost/view before calling it. Native mind maps still require the existing `installMindmapCompatibility(host)` and its cleanup, as the current shell does.
- BoardMeta validates exactly one content ID, returns copies of metadata with the authorized SQL title, and rejects stale/disposed access. Structural add/remove and global workspace properties are unsupported explicitly; bounded metadata updates remain available only to writable runtimes. Board rename/deletion continue through server-owned application operations.
- `createStagingWorkspace(options)` uses the same public composition with isolated in-memory blobs and an unstarted public NoopDocSource. It accepts a server-reserved descriptor and initially exposes zero content Stores. `staging.createImportTransformer(sourceStore.schema)` returns the native Transformer with the first page replacement ID reserved for the destination content document. Supply the referenced blobs to staging, then call `transformer.snapshotToDoc(structuredClone(snapshot))`, validate the result and reset its history. Extract `staging.doc` and `copied.spaceDoc` bytes plus image manifest for later publication; dispose the transformer and staging afterward. Never invoke destination snapshot import on the source workspace.
- The dev-only harness is an explicit Vite optimizer entry; it is absent from the production entry graph and remains excluded from production/access Playwright projects. No general App/editor entry migration occurs here; plan 06 owns it.

## Deviations from Plan

1. **[Rule 3 — seed compatibility]** Native conformance exposed two earlier seed omissions in `server/boards/routes.ts`: no authoritative `meta.pages`, and raw surface `prop:elements` instead of the pinned native boxed-map representation. With orchestrator-assigned ownership, creation now seeds one native page metadata entry and `{type: '$blocksuite:internal:native$', value: Y.Map}` surface storage. Focused library assertions and actual native rendering/editing prove compatibility. This preserves zero-write Viewer hydration and fails closed on malformed authoritative content. Commit: `3f2ec01`.
2. **[Rule 1 — successful CRDT read oracle]** Replacing now-existing root metadata creates deleted Yjs structs whose successful pull may be garbage-collected into a different binary encoding. The single successful root-pull assertion in `server/boards/access.test.ts` now compares decoded metadata and state vectors. All denied-operation server before/after byte-equality and state-vector oracles remain intact. Commit: `3f2ec01`.
3. **[Rule 3 — cold dev module discovery]** Vite initially reoptimized dynamically imported native dependencies during the test, causing a page reload/outdated-dependency response. Assigned `vite.config.ts` changes add verified facade imports and explicitly scan the dev-only harness alongside index.html. Cold-cache conformance passes without retries or error suppression. Commit: `360dc13`.

During harness review, exact typography assertions caught the missing established mind-map compatibility installation. The harness now uses the production install/cleanup lifecycle, and asserts the expected formatting rather than only equal before/after values. No additional native product behavior was changed.

No unresolved stub, skipped required test, unrun plan verification or security surface outside T-03-10/11 was introduced. Staging is explicitly transient; its empty initial Store collection is required for the reserved native import lifecycle.

## Evidence Limits and Operator Obligations

A1's account-workspace conformance is executable and passing before broad shell mounting. Shared requirements remain progressed rather than complete: downstream shell, role/mutation, recovery, sharing and local-copy plans remain. Actual Okta registration/claim-policy acceptance remains pending in operator-controlled infrastructure. Synthetic OIDC success does not establish actual-provider acceptance. Phase 4 retains restart/backup/recovery and Phase 5 retains live collaboration and concurrent-user acceptance.

API evidence: installed BlockSuite 0.22.4 public Workspace/Doc/WorkspaceMeta/StoreContainer/Transformer and synchronization source contracts; Yjs [Document Updates](https://docs.yjs.dev/api/document-updates) (state vectors and idempotent update/normalization semantics); Vite [Dependency Optimization Options](https://vite.dev/config/dep-optimization-options) (explicit dev entries). Context7 was unavailable; official documentation and pinned sources supplied the lookup evidence. The account implementation has no test-runtime import or inheritance.

## Self-Check: PASSED

All nine changed implementation/test/config files and the four recorded task commits exist. Static checks, focused/full tests, build, native browser conformance, whitespace review and synthetic/public-data inspection passed. Unrelated image assets and orchestration lock are preserved.
