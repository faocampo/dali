# Phase 04: Durable Boards and Recovery — Pattern Map

**Mapped:** 2026-09-25
**Scope:** Planning only. Proposed new paths below are assignments, not existing implementation. Existing analogs were verified with `git ls-files`; all paths are repository-relative tracked sources.

## File Classification

The research names integration seams rather than a closed new-file inventory. Grouped entries below cover those seams and inferred deployment/maintenance modules; the planner should finalize exact new filenames.

| New/modified file(s) | Role | Data flow | Closest analog | Match quality |
|---|---|---|---|---|
| `src/canvas/save-status.ts`, proposed `src/canvas/save-status.test.ts` | store/test | event-driven | Existing save-status module; `src/canvas/account/outbox.test.ts` | exact/role-match |
| `src/canvas/runtime.ts`, `src/canvas/account/board-workspace.ts`, proposed `src/canvas/account/recovery.ts` | service | event-driven | `src/canvas/runtime.ts` | exact/role-match |
| `src/canvas/account/outbox.ts`, `outbox.test.ts` | store/test | file-I/O | Same existing modules | exact |
| `src/canvas/account/doc-source.ts`, `doc-source.test.ts` | service/test | request-response | Same existing modules | exact |
| `src/canvas/account/blob-source.ts`, `blob-source.test.ts` | service/test | file-I/O/request-response | Same existing modules | exact |
| `src/auth/session.ts`, `src/canvas/account/mutation-guard.ts`, `mutation-guard.test.ts` | service/middleware/test | event-driven | Runtime access-scope lifecycle | role-match |
| `src/header/Header.tsx`, proposed save-details/leave-dialog components | component | event-driven | Existing Header status disclosure | exact/role-match |
| `src/App.tsx`, `src/boards/BoardLibrary.tsx` | component | event-driven/request-response | Runtime generation and existing library account scoping | exact integration seams |
| `src/canvas/export-board.ts`, proposed recovery-archive builder/tests | utility/test | transform/file-I/O | Existing exportBoardFile archive branch | exact/role-match |
| `server/storage/database.ts`, proposed recovery-epoch migration/module | store/migration | CRUD | Existing runMigrations | exact/role-match |
| `server/boards/documents.ts`, `server/boards/blobs.ts`, `server/boards/routes.ts` | controller | request-response/CRUD | Existing transactional document/blob handlers | exact |
| `server/app.ts`, production compiler config, `package.json` | config | request-response/batch | Existing buildApp lifecycle | exact/role-match |
| Proposed `server/storage/backup.ts`, `restore.ts`, scheduler and corresponding server tests | service/test | file-I/O/batch | Database ownership/validation seams only | partial; no operational analog |
| Proposed operator CLI and synthetic restore-dataset script | utility | batch/file-I/O | `server/app.ts` direct-entry guard; `tests/access-fixtures.ts` synthetic builders | role-match |
| Proposed Dockerfile, proxy config, Kubernetes/Kustomize base, operational runbook | config | batch | None for production packaging | none |
| Proposed recovery/restart browser suites; `tests/access-fixtures.ts`, `playwright.config.ts` | test/config | event-driven/batch | Existing acceptanceService and identity contexts | role-match |

## Pattern Assignments

### Journal and transport: retain transaction completion and exact acknowledgments

**Source:** `src/canvas/account/outbox.ts:16–26` (IndexedDB transaction wrapper).

```ts
const tx = db.transaction('journal', mode, { durability: 'strict' });
let request: IDBRequest<T>;
try { request = action(tx.objectStore('journal')); }
catch (error) { tx.abort(); reject(error); return; }
tx.oncomplete = () => resolve(request.result);
tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('Recovery storage failed'));
```

The enclosing `finally` closes the connection. Copy this completion boundary into checkpoint/journal transactions. `AccountJournal.capture(kind, resource, data): Promise<string>` at lines 52–59 copies byte arrays and retains failed writes in memory. Extend with epoch, immutable coverage and schema validation; keep failed records available for export. Existing `pendingRecords(accountId, boardId)` scans all records: add indexed scope reads and preserve legacy rows during upgrade.

**Source:** `src/canvas/account/doc-source.ts:24–49` (request and acknowledgment).

```ts
headers: { 'X-Dali-Account': this.options.accountId,
  'X-Dali-Request': '1', 'Content-Type': 'application/octet-stream' },
body: new Uint8Array(data),
```

```ts
const result: unknown = await response.json(); this.assertCurrent(docId, true);
if (!result || typeof result !== 'object' || !('acknowledged' in result) ||
    result.acknowledged !== true) throw new Error('Document commit unconfirmed');
await this.options.onAcknowledged?.(token);
```

Preserve current-generation checks after awaited work and account headers. Capture at Yjs updates independently of transport; current capture at push lines 41–43 is too late for edits buffered during outage. Do not blanket-classify every new 409 as identity loss: add explicit restore-epoch error codes.

**Source:** `src/canvas/account/blob-source.ts:50–63` (blob set).

```ts
const token = await this.options.onPendingBlob?.(key, value);
// After validated acknowledgment with the exact key:
await this.options.onAcknowledged?.(token); this.pending.delete(key);
```

Use keyed image outcomes and local bytes retained before failure. Current pending-map insertion happens only after capture succeeds (line 60); a storage failure can bypass it. Preserve bytes for recovery even then. Existing `get()` prefers pending bytes (43–48), and `dispose()` revokes owned URLs (75–77). Keep these lifetime boundaries. Replay already uploads blobs before documents (`outbox.ts:74`); retain image-before-reference ordering.

### Runtime, state and shell

**Source:** `src/canvas/runtime.ts:10–23,82–104` (scope and callbacks).

```ts
const key = JSON.stringify([options.accountId, options.descriptor.summary.id, options.generation]);
const isCurrent = () => scope?.generation === initial.generation && scope.phase === 'active';
```

```ts
onPendingDocument: (id, data) => scopedJournal.capture('document', id, data),
onPendingBlob: (key, value) => scopedJournal.capture('blob', key, value),
onAcknowledged: token => typeof token === 'string' ? acknowledgeRecord(token) : Promise.resolve(),
```

Apply account/board/generation identity to status, marker inspections, timers, downloads and recovery. Add durable server epoch separately; runtime generation cannot detect server restoration. Replace the line 91 journal-failure call to `interruptSession()` with explicit storage pause. Replace replay-before-workspace creation at line 94 with authorized reconstruction that can remain visible/exportable when sending fails. `suspendAccessScope` at 25–35 sets store readonly and stops sync; reuse lifecycle integration, but distinguish network outage, expired session, storage failure and restore quarantine.

**Source:** `src/canvas/save-status.ts:82–89` (external store).

```ts
export function getSaveStatus(): LocalSaveStatus { return snapshot; }
export function subscribeSaveStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
```

**Consumer:** `src/header/Header.tsx:39`.

```tsx
const saveStatus = useSyncExternalStore(subscribeSaveStatus, getSaveStatus);
```

Preserve stable snapshot/subscription semantics and `formatSaveAge` at Header lines 183–190. Replace global image error clearing (`save-status.ts:76–79`) and engine-step-derived Saved with immutable acknowledgment coverage. Retain last acknowledged timestamp across pending/failure transitions. Header lines 126–143 provide the existing title-adjacent recovery disclosure and async error handling, but its forceStop/start retry and failure-only dialog are insufficient for the approved UI contract. Use the UI-SPEC focus, dismissal, accessible naming, precedence and responsive requirements for the expanded surface.

Library seam: `src/boards/BoardLibrary.tsx:73–84` loads authorized cards using account headers, validates each summary and scopes the effect to account/filter/refresh. Pending-marker inspection must run separately against only these authorized IDs, cancel on account changes, and retain an explicit inspection error. Its existing `pendingCount` means pending grants; never reuse that field for browser save records. Card insertion point is the `boards.map` block at line 147.

### Recovery archive

**Source:** `src/canvas/export-board.ts:169–184`.

```ts
const job = store.getTransformer();
try {
  const snapshot = job.docToSnapshot(store);
  if (!snapshot) throw new Error('The board could not be prepared for export.');
  snapshot.meta.title = catalog.title;
  const ids = [...job.assetsManager.getPathBlobIdMap().values()];
  for (const id of ids) {
    await job.assetsManager.readFromBlob(id); assertCurrent();
    if (!job.assets.has(id)) throw new Error('An image is missing. Restore the image and retry.');
  }
  const zip = await createAssetsArchive(job.assets, ids);
  await zip.file(`${safeFilename(catalog.title)}-${snapshot.meta.id}.snapshot.json`, JSON.stringify(snapshot));
  const blob = await zip.generate();
  await confirm();
  downloadBlob(blob, `${safeFilename(catalog.title)}.bs.zip`);
} finally { job[Symbol.dispose](); }
```

Factor archive assembly into a snapshot builder; include retained local image bytes. Preserve one handoff after completeness and authority checks. Current function acquires an active runtime and recontacts authorization (lines 144–164): a paused/offline recovery path needs an explicit current-authority policy and snapshot input rather than blindly calling this wrapper. Export success never acknowledges the journal. Validate the archive through existing private-board import with semantic content/image comparisons.

### Server persistence and operator modules

**Source:** `server/storage/database.ts:14–29` (additive migrations, owned database).

```ts
database.transaction(() => {
  database.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY)');
  for (const migration of [...migrations, ...additional].sort((a, b) => a.version - b.version)) {
    if (!Number.isSafeInteger(migration.version) || migration.version < 1) throw new Error('Invalid migration');
    if (database.prepare('SELECT version FROM schema_migrations WHERE version=?').get(migration.version)) continue;
    database.exec(migration.sql);
    database.prepare('INSERT INTO schema_migrations(version) VALUES (?)').run(migration.version);
  }
})();
```

Add epoch/maintenance metadata additively, choosing unused migration numbers after checking all registration modules. Configure and read back WAL/FULL before serving; preserve close-on-startup-error. Restore changes epoch and invalidates sessions; ordinary restart retains epoch. Backup/restore modules should accept `AccountDatabase`, injected time and generic destination/configuration. There is no existing complete backup publication or restore implementation to copy; follow RESEARCH.md for verified online snapshot, manifest/hash validation, publication, retention and restore fencing.

**Source:** `server/boards/documents.ts:73–91` (commit seam).

```ts
await beforeCommit?.();
return database.transaction(() => {
  const latest = requireBoardCapability(database, request, reply, boardId, 'write', now);
  if (!latest) return;
  // Merge newest committed bytes, validate binding and referenced images, then write.
  return { acknowledged: true };
})();
```

The abbreviated excerpt marks the existing body rather than providing a replacement handler. Keep actual validation at lines 79–84, including incomplete Yjs update rejection and referenced-image existence. Put epoch and backup-freshness write admission inside the same transaction. Apply equivalent checks to all durable mutation routes, including metadata/actions/imports/grants, not only document and blob writes.

Blob counterpart: `server/boards/blobs.ts:115–129` validates MIME, bytes and content hash before the scheduling barrier; rechecks capability inside transaction; refuses deletion of referenced images; returns `{ acknowledged: true, key }`. Keep blobs in the database backup unit.

**Source:** `server/app.ts:50,64–75` (dependency injection and direct entry).

```ts
const database = options.database ?? openDatabase(config.databasePath); runMigrations(database);
if (!options.database) app.addHook('onClose', async () => { database.close(); });
const now = options.now ?? Date.now;
```

```ts
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  readConfig(process.env); const app = await buildApp({ config: process.env });
  await app.listen({ host: '127.0.0.1', port: Number(process.env.PORT ?? 3000) });
}
```

Use this import-safe entry pattern for operator tooling and preserve injectable database/time for deterministic scheduler tests. Production startup must add readiness/draining and a production-only compiler boundary. Choose a tested same-pod loopback proxy topology or explicit backend bind; existing loopback startup does not itself expose a container service. Preserve secure-cookie policy and explicitly constrain proxy trust.

### Tests and fixtures

**Source:** `src/canvas/account/outbox.test.ts:1–3,38–46`.

```ts
import { afterEach, expect, it, vi } from 'vitest';
import { AccountJournal, replayJournal, type JournalRecord } from './outbox';
```

```ts
db.fail(true); await expect(journal.capture('blob', 'image', blob)).rejects.toThrow('Storage unavailable');
expect(failure).toHaveBeenCalledOnce(); expect(db.rows.size).toBe(0);
db.fail(false); await journal.preserve();
expect(db.rows.size).toBe(1);
```

Retain behavioral failure-retention assertions, adding schema upgrades, exact acknowledgment coverage, epoch quarantine and stale callbacks. The strict transaction double at lines 7–32 is useful for deterministic unit cases; native browser tests must cover real IndexedDB upgrade/blocking/quota behavior.

**Source:** `tests/access-fixtures.ts:22–36,73–95`.

```ts
const database = openDatabase(':memory:');
let barrier: (() => Promise<void>) | undefined;
const app = await buildApp({ database, beforeCommit: () => barrier?.() ?? Promise.resolve(), config: {
  // Synthetic OIDC configuration is supplied here by the existing fixture.
} });
```

Reuse synthetic signed OIDC identities, separate browser cookie jars, `beforeCommit` barriers, and error collection. Replace the in-memory database with temporary file storage and a real kill/restart process harness for durability evidence. Keep stable synthetic provider identity across restart. `syntheticCanaries()` at 107–130 creates real distinct PNG bytes; `expectDeniedWithoutChange()` at 143–154 verifies both response non-disclosure and unchanged owner state. Extend those builders for restored document/image/grant integrity and timestamped acknowledged canaries.

`playwright.config.ts:6,18–22` uses a named-suite regex for the access project; register new Phase 4 suites or explicitly select production projects and assert nonzero counts. Preserve one-worker browser execution. Restart/restore must include a freshly authenticated context with no prior local cache; download events alone do not establish archive fidelity.

## Shared Patterns

- **Imports:** Browser modules use extensionless relative imports and `import type`; server ESM imports use `.js` suffixes (document handler lines 1–6). Keep code on its correct build side.
- **Authority:** `server/boards/routes.ts:23–32` obtains current session, enforces expected member, derives owner/grant role and applies system Viewer restriction while retaining Owner privilege. Reuse this guard in fresh reads and again within writes. Restore checks complement it.
- **Errors:** Server app lines 54–56 returns generic `{ code }` responses; client source layers parse/validate unknown bodies and test scope after awaits. Introduce distinct restore/storage/network outcomes without exposing raw internals.
- **Lifetime:** Account/board/generation changes invalidate async results. Add epoch to persistence/replay; keep download results, names, markers and image URLs isolated.
- **Public artifacts:** Synthetic identities and example configuration only. Real storage, ingress, provider values and measured operator evidence stay outside the repository.

## No Analog Found

| Proposed artifact | Role/data flow | Planner guidance |
|---|---|---|
| Backup publication, scheduler, restoration CLI | service/utility; batch/file-I/O | Use research's validated snapshot/publication and epoch protocol; database opening is only a partial analog. |
| OCI build, Kustomize deployment, production proxy/probes | config; batch/request-response | Use research's selected single-writer topology; current development launcher is a test/development seam. |
| Complete recovery state machine and leave policy | service/component; event-driven | Runtime/store patterns supply wiring; UI-SPEC supplies the full state and focus contract. |

## Metadata

**Search scope:** Tracked browser canvas/account/header/library sources, server storage/board/app sources, existing tests and build configuration.
**Method:** Targeted source reads and symbol searches; no application files changed; no runtime verification claimed.
**Primary inputs:** `04-CONTEXT.md` (locked outcomes), `04-RESEARCH.md` (selected durability/operations design), `04-UI-SPEC.md` (36 approved UI acceptance truths).
**Pattern extraction date:** 2026-09-25.
