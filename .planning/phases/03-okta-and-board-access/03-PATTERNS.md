# Phase 3: Okta and Board Access — Pattern Map

**Mapped:** 2026-09-16
**Scope:** Proposed file families below; planner finalizes new filenames and assigns every existing mutation seam explicitly.
**Evidence:** `03-CONTEXT.md` (D-01–D-16), `03-RESEARCH.md` (backend and account-runtime contracts), `03-UI-SPEC.md` (approved access surfaces).

## File Classification

Brace lists enumerate individual files. Existing files were verified with `git ls-files`; new paths are proposals. “Same-file” means preserve the existing implementation seam, with the account behavior supplied by this phase.

| New/Modified File | Role | Data Flow | Closest Tracked Analog | Match Quality |
|---|---|---|---|---|
| `server/{app,main,config}.ts` | service/config | request-response | None | absent |
| `server/storage/database.ts` | service | CRUD | None | absent |
| `server/storage/migrations.ts` | migration | batch | None | absent |
| `server/auth/{oidc,session-store,identity-policy}.ts` | service/middleware | request-response | None | absent |
| `server/boards/policy.ts` | utility | transform | None | absent |
| `server/boards/routes.ts` | route | request-response | None | absent |
| `server/boards/{documents,blobs}.ts` | service | CRUD/file-I/O | None | absent |
| `src/auth/session.ts` | store | request-response/event-driven | `src/canvas/runtime.ts` | partial lifecycle only |
| `src/auth/AuthBoundary.tsx`, `src/App.tsx` | component | request-response | `src/App.tsx` | role-match / same-file |
| `src/canvas/account/board-workspace.ts` | provider | event-driven | `src/canvas/workspace.ts` | partial lifecycle only |
| `src/canvas/account/{board-doc,board-meta}.ts` | model | event-driven | None | absent production composition |
| `src/canvas/account/{doc-source,blob-source}.ts` | service | request-response/file-I/O | `src/canvas/workspace.ts` | role-match; transport is new |
| `src/canvas/account/outbox.ts` | store | file-I/O | None | absent identity-scoped durable queue |
| `src/canvas/runtime.ts`, `src/canvas/workspace.ts` | provider/service | event-driven/file-I/O | Same files | same-file |
| `src/boards/import-local.ts` | service | batch/file-I/O | `src/boards/operations.ts` | partial snapshot transform |
| `src/boards/operations.ts` | service | CRUD | Same file | same-file |
| `src/boards/catalog.ts` | store | CRUD | Same file | same-file legacy preservation |
| `src/boards/preferences.ts` | utility | event-driven | Same file | same-file URL construction |
| `src/boards/BoardLibrary.tsx` | component | request-response | Same file | same-file card layout |
| `src/boards/{ShareBoardDialog,LocalBoardCopyDialog,BoardActionDialog}.tsx` | component | request-response/batch | `src/header/ExportDialog.tsx` | role-match modal lifecycle |
| `src/header/{Header,DaliMenu,BoardTitleMenu,ExportDialog}.tsx` | component | event-driven | Same files | same-file shell/actions |
| `src/canvas/export-board.ts` | service | file-I/O | Same file | same-file supported exports |
| `src/canvas/BlockSuiteCanvas.tsx` | component | event-driven | Same file | same-file command guards |
| `src/canvas/account/mutation-guard.ts` | middleware | event-driven | `src/canvas/mindmap-compatibility.ts` | role-match native boundary |
| `src/index.css` | config | transform | Same file | same-file theme; UI-SPEC values |
| `server/auth/oidc.test.ts`, `server/boards/{library,grants,access}.test.ts` | test | request-response | None | absent server harness |
| `tests/{board-access,board-roles,session-recovery,local-board-import}.spec.ts`, `tests/fixtures.ts` | test | event-driven/request-response | `tests/fixtures.ts` | role-match / same-file |
| `tests/oidc-provider.ts` | test | request-response | None | absent signed synthetic provider |
| `vitest.server.config.ts`, `tsconfig.server.json` | config | batch | None | absent Node-targeted configuration |
| `package.json`, `package-lock.json`, `vite.config.ts`, `playwright.config.ts`, `tsconfig.json`, `.gitignore` | config | batch | Same files | same-file tooling seams |

## Pattern Assignments

### Runtime, authentication boundary and account composition

**Analog:** `src/canvas/runtime.ts:47-52` — memoize initialization, clear rejection for retry:
```typescript
export function getCanvasRuntime(): Promise<CanvasRuntime> {
  runtime ??= createRuntime().catch((error: unknown) => {
    runtime = null;
    throw error;
  });
  return runtime;
}
```
Apply lifecycle reuse to `session.ts`, `runtime.ts` and `board-workspace.ts`, but key initialization by authorized account/board/generation. Global page-lifetime reuse currently permits one local runtime; new account startup must first obtain session and board descriptor. `src/App.tsx:13-32` supplies cancellable-effect structure, but its immediate runtime start and editor-on-error fallback must become explicit authenticated/error states.

`src/canvas/runtime.ts:129-143` establishes `store.load(...)` extension/history initialization and `store.resetHistory()` after blank page/surface creation. Preserve these invariants in `board-doc.ts`; run the research tracer before shell migration. `src/canvas/runtime.ts:173-199` supplies idempotent lifecycle teardown and BFCache context; account restoration additionally revalidates identity before unpausing.

**Imports:** `src/canvas/runtime.ts:15-19` uses package-root value imports, separate `import type`, and relative feature imports. Account files use public pinned Workspace/Doc contracts. Existing `TestWorkspace` typing/imports require replacement on the account path; the legacy adapter remains isolated.

### Transport sources, failure propagation and original local storage

**Analog:** `src/canvas/workspace.ts:31-39`:
```typescript
class ReportingIndexedDBDocSource extends IndexedDBDocSource {
  override async push(docId: string, data: Uint8Array): Promise<void> {
    try {
      await super.push(docId, data);
    } catch (error) {
      reportDocWriteFailure(error);
      throw error;
    }
  }
}
```
Copy report-and-rethrow semantics into `doc-source.ts` and `blob-source.ts`; classify authorization failures into the auth-paused channel. The blob counterpart at lines 45-56 brackets actual writes with begin/finish status. Add server acknowledgment and account generation checks. The existing in-memory retry map is only a lifecycle reference; `outbox.ts` needs the new identity-scoped document-plus-blob persistence contract.

Preserve `src/canvas/workspace.ts:26` legacy database identifier and `src/boards/catalog.ts:3` catalog key. `workspace.ts:119-136` starts sync, bounds initial loading, then initializes metadata. Account metadata must likewise wait for authoritative hydration. Do not copy the local TestWorkspace construction or destructive disposal into account implementations. `catalog.ts:15-23` currently collapses storage errors to empty; local-copy enumeration must distinguish failure from an empty inventory.

### Board operations, migration and routing

**Analog:** `src/boards/operations.ts:159-167`:
```typescript
source.load();
validateMindmapDocument(source);
const transformer = source.getTransformer([replaceIdMiddleware(workspace.idGenerator)]);
const snapshot = transformer.docToSnapshot(source);
if (!snapshot) throw new Error('The board could not be copied.');
const duplicate = await transformer.snapshotToDoc(structuredClone(snapshot));
if (!duplicate) throw new Error('The board could not be copied.');
duplicate.resetHistory();
```
Apply validation and regenerated identifiers to `import-local.ts` and authenticated duplication. Add the referenced-image manifest, idempotent staging and atomic private publication. Preserve originals and exact imported titles. Existing duplicate naming, local catalog updates and deletion are separate local behaviors.

`src/boards/operations.ts:86-94` maps metadata to summaries and sorts recent-first; authenticated summaries instead come from filtered server rows with role/share status. `src/boards/preferences.ts:72-76` builds a new-tab URL with `URL`/`searchParams`; preserve explicit `new` intent through sign-in. `preferences.ts:23-24` local last-board fallback must not select or authorize account content. Keep deferred local deletion isolated from the account runtime.

### Library, sharing, confirmations, headers and exports

**Analog:** `src/header/ExportDialog.tsx:174-182`:
```typescript
useEffect(() => {
  const dialog = panelRef.current!;
  const previousFocus = document.activeElement;
  dialog.showModal();
  return () => {
    dialog.close();
    if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
  };
}, []);
```
Use the native modal/focus-return pattern for sharing, selected-copy and named board confirmations. Lines 190-213 implement portal, keyboard trapping and cancellation; adapt initial focus and in-flight cancellation to UI-SPEC. Lines 33-45 show pending/error/finally handling with success only after the awaited operation. Sharing needs row-scoped status and stale-search protection; copying needs per-item status.

`src/boards/BoardLibrary.tsx:186-211` separates each card's accessible Open button from action buttons. Retain that structure, adding account/role/status/filters and server-confirmed mutations. Replace prompt/confirm paths with the named dialogs. `src/header/Header.tsx:54-55` composes Main Menu and inline title; preserve these seams. Gate editable export in both `ExportDialog.tsx` and `export-board.ts`, including the Header backup action; retain Viewer PNG/PDF and scope settings. Source-local prompts/labels yield to UI-SPEC copy.

### Native mutation guards and browser tests

**Analog:** `src/canvas/mindmap-compatibility.ts:92`:
```typescript
const current = () => active && host.isConnected && host.store === store && !store.readonly && (copySources.get(host)?.() ?? true);
```
Use this identity/liveness/readonly predicate at native asynchronous mutation boundaries. Lines 102-105 validate before clipboard execution. `src/canvas/BlockSuiteCanvas.tsx:118-119` guards undo/redo; lines 129-140 pair AbortController with current-host checks for image work. Set readonly before mounting and guard paste/drop, imports, drawing, shortcuts, property edits and duplicate paths. Preserve navigation, selection and allowed exports. Backend transactional policy remains independently mandatory.

**Testing analog:** `tests/fixtures.ts:1` imports Playwright; lines 41-58 automatically collect console/page errors and assert unexpected errors are empty. Extend this fixture with synthetic identities and backend lifecycle; retain exact expected-error matching. New suites should import its `test`/`expect`, use separate cookie jars, and verify unchanged owner-visible bytes/state after forbidden actions. Server injection, real signed test OIDC and database fixtures have no existing analog.

## Shared Patterns

- **Ownership/lifecycle:** acquire once per authorized scope, bound loading, unregister listeners, abort requests, and reject stale generations. Existing cleanup patterns need explicit account identity and readonly extensions.
- **Error handling:** awaited operations acknowledge success; catch converts unknown errors for UI while source adapters rethrow. Security failures pause/clear protected views. Pending grants and copies remain unacknowledged until server confirmation.
- **Validation/auth:** snapshot validation already exists; identity validation, CSRF, ACL, binary limits, resource binding and SQL transactions are new backend contracts from RESEARCH. No existing server guard can be copied.
- **Native integration:** own extensions and guards under `src/canvas/account/` or existing tracked application modules. Installed BlockSuite code is read-only contract/reference material, never an edit target or tracked analog.

## No Analog Found

The backend families, SQL migrations, identity/authorization policy, signed synthetic provider, server harness, identity-scoped outbox, and production BoardDoc/BoardMeta composition have no suitable tracked implementation. Use the research interfaces and code examples, then prove them with the first account-workspace tracer, real route tests, and synthetic OIDC flow. Local IndexedDB storage and readonly UI provide useful integration seams but do not supply server authority.

## Metadata

**Search scope:** tracked `src/`, `tests/`, root tooling; approved phase context/research/UI contract. No project skill directories found.
**Strong pattern families:** runtime lifecycle, source error propagation, snapshot transformation, native modal controls, native mutation boundary. Supporting reads covered shell, library, preferences, catalog and browser fixture.
**Tracking gate:** every existing source/config path named above was returned by `git ls-files`; proposed new paths have no tracked implementation yet.
**Limits:** mapping is planning evidence. Dependency installation, runtime conformance, server authorization, real-provider acceptance and UI validation remain execution work.
