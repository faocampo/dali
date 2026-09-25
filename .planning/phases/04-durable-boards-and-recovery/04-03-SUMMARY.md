---
phase: 04-durable-boards-and-recovery
plan: "03"
subsystem: recovery
tags: [indexeddb, yjs, local-capture, images, playwright]
requires:
  - phase: 04-02
    provides: Authorized recovery epochs and scoped transport acknowledgments
provides:
  - Independent local Yjs capture and reconstructable versioned checkpoints
  - Non-destructive legacy journal upgrade and strict transaction completion
  - Retained image bytes and atomic exact-ID acknowledgment and compaction
affects: [04-04, 04-05, 04-06, 04-07, 04-08, 04-09]
tech-stack:
  added: []
  patterns: [Independent Yjs observation, strict IndexedDB transactions, immutable acknowledgment coverage, invalidation-only cross-tab signals]
key-files:
  created: [src/canvas/account/local-capture.ts, tests/local-recovery.spec.ts]
  modified: [src/canvas/account/outbox.ts, src/canvas/account/outbox.test.ts, src/canvas/account/blob-source.ts, src/canvas/account/blob-source.test.ts, src/canvas/account/board-workspace.ts, src/canvas/runtime.ts, tests/board-access.spec.ts]
key-decisions:
  - Keep the existing recovery database namespace and upgrade its version without rewriting legacy rows or adopting an epoch.
  - Merge exactly acknowledged document operations and image bytes into the checkpoint in the same transaction that removes their immutable record IDs.
  - Compute submission coverage from confirmed Yjs operation clocks and deletion sets so split or garbage-collected native updates retain correct acknowledgment semantics.
  - Cache available image bytes through authorized source callbacks while preserving the existing visible loading and retry flow.
requirements-covered: [SAVE-01, SAVE-02]
requirements-completed: []
coverage:
  - id: D-05
    description: Independent capture reconstructs a second edit after native push failure and reload
    requirement: SAVE-01
    verification:
      - kind: browser
        ref: tests/local-recovery.spec.ts
        status: pass
    human_judgment: false
  - id: D-06
    description: Scoped checkpoints retain root, content, title and available image bytes
    requirement: SAVE-02
    verification:
      - kind: browser
        ref: tests/local-recovery.spec.ts
        status: pass
    human_judgment: false
actuals:
  tokens: 18958
  tasks: 2
  commits: 4
plan_head_before: 61a42164370392e54e7ec5e27896a955c2687a1e
duration: 30min
completed: 2026-09-25
status: complete
---

# Phase 04 Plan 03: Reconstructable Local Capture Summary

**Independent Yjs listeners preserve versioned root/content checkpoints and local edits through failed native sync, while exact-ID transactions retain required image bytes and protect newer or other-tab work.**

## Accomplishments

- The existing `dali-account-recovery-v1` namespace opens at version 2 with journal, checkpoints and sequences stores, account/board/epoch indexes and strict write transactions. Completed transactions define persistence success. Aborted transactions retain unconfirmed memory; blocked upgrades reject safely and can retry after the old connection closes.
- Legacy rows remain byte-for-byte available without assigning a current epoch. Unknown/corrupt rows and checkpoint manifests remain stored and block replay or acknowledgment. Scope, schema, sizes, Yjs encoding and image metadata are bounded before use.
- Each new record captures a random immutable ID, version, tab identity, account, board, epoch and covered IDs. Its durable sequence is allocated in the same transaction. Tab identity survives reload; separate tabs have distinct identities. Retrying an existing record preserves its sequence.
- Local observers attach to root and content after authorized hydration and before the runtime is exposed for editing. They copy local updates immediately, exclude hydration/replay/remote transactions, and remain active when native network sync fails. Checkpoints retain complete root/content updates, title and image references.
- Blob admission retains bytes before upload. Authorized fetched images are hash-validated and cached in checkpoints. Upload acknowledgments keep available image bytes for reconstruction; later reference-only manifests preserve cached bytes.
- A submission freezes exact covered IDs after synchronous Yjs listeners finish. Coverage uses the confirmed checkpoint plus submitted operations and compares Yjs clocks/deletions. Atomic acknowledgment advances checkpoints and removes only those IDs. Repeated, late and wrong-scope acknowledgments preserve unrelated work. Compaction replaces only selected same-tab inputs and leaves later/other-tab rows intact.
- Storage persistence requests and estimates are advisory. Cross-tab notifications contain only `{type: 'changed'}`; consumers use scoped indexed rereads. Failed captures retain memory and signal the existing storage suspension path for the next lifecycle slice.

## Task Commits

1. **04-03-01 — complete local reconstruction:** `cccf8f8` (RED), `f266295` (GREEN).
2. **04-03-02 — images and exact acknowledgment coverage:** `d87c5b5` (RED), `9faf7d0` (GREEN).

The four implementation/test commits and diff-character token estimate were measured from the persisted plan ledger before this summary commit.

## TDD Gate Compliance

| Task | Observed RED | GREEN |
|---|---|---|
| 04-03-01 | Version/epoch metadata assertion failed on the original record; native upgrade also exposed version 1 rather than 2. | Versioned capture, independent reconstruction, completed/aborted transaction and retained migration cases pass. |
| 04-03-02 | Failed local blob admission returned null instead of the original bytes; native image acknowledgment lost checkpoint bytes. | Original bytes remain retrievable; acknowledged assets remain in checkpoints; exact acknowledgment and storage race cases pass. |

Both RED evidence records passed `check tdd-red-evidence` with `RED_EVIDENCE_OK`. Their normalized TAP records disclose that unrelated unit cases were excluded by the name filter. No required GREEN gate was skipped.

## Verification

- Task 1 exact unit command passed 6 cases at its commit; exact `@04-03-01` production browser command passed 4 cases (20.2 seconds including startup).
- Task 2 exact unit command passed **26 cases** in its final run. Exact `@04-03-02` production browser command passed 5 native cases during implementation (18.2 seconds including startup); the final broader production run exercised the same five cases again.
- Final `npm test`: **130 passed**, 13 files, zero skipped.
- Both `npm run typecheck` and `npm run typecheck:server`: passed for each task and after final source changes.
- Final production browser command covering `local-recovery.spec.ts`, `board-access.spec.ts`, `session-recovery.spec.ts` and `durable-restart.spec.ts`: **44 passed**, zero skipped, **1.6 minutes including build/startup**. This includes all 9 new native recovery cases, real native undo/redo, image loading/retry, cross-account and revoked access, logout preservation, replay, and cold server restart/SIGKILL cases.
- Native recovery cases use real browser IndexedDB with isolated synthetic pages and an in-memory bundle of the actual modules. There are no production test endpoints. Concurrency uses two actual same-origin tabs. Tests abort real transactions after successful requests and simulate quota errors at admission.
- The first broad browser run passed 42/44 and exposed two integration regressions. A subsequent run passed 18/19 after fixing loading; semantic Yjs coverage fixed the remaining undo/redo case. The final 44/44 result supersedes both failures.
- The production build completed during browser startup. Existing dynamic-import/chunk-size and runtime experimental warnings remain outside this change. `git diff --check` passed; no tracked files were deleted.

## Deviations from Plan

### Auto-fixed Issues

1. **[Rule 2 — integration] Runtime callback wiring and fixture schema compatibility.** Task 2 needed the runtime to bind the journal's submission token, fetched-image caching and persistence request. The existing board-access inspection helper explicitly opened version 1; it now opens version 2. The blob-source test file was added to task ownership because the plan's required verification explicitly names it. Files: `src/canvas/runtime.ts`, `src/canvas/account/blob-source.test.ts`, `tests/board-access.spec.ts`. Commits: `d87c5b5`, `9faf7d0`.
2. **[Rule 1 — regression] Native listener order and garbage collection.** Byte equality missed already submitted original operations after undo/redo. Coverage now waits for synchronous capture listeners and compares confirmed Yjs snapshot operation clocks/deletes. Dedicated unit reproductions and the native empty-journal assertion pass. Commit: `9faf7d0`.
3. **[Rule 1 — regression] Preserve image-loading feedback.** Awaiting eager cache fetches before exposing the runtime hid the existing loading/retry state. Authorized caching now runs through source callbacks without blocking that state. The native delayed/missing/revoked-image flow passes. Commit: `9faf7d0`.

## Interfaces for Following Plans

- `AccountJournal.captureUpdate`, `checkpoint`, `captureSubmission`, `acknowledge`, `compact`, `cacheAsset`, `pendingMemory` and `preserve` retain the captured scope. `captureSubmission` returns a frozen `{scope, ids}` receipt; runtime acknowledgment verifies scope identity.
- `readCheckpoint(scope, tabId)`, `pendingRecords(accountId, boardId)` and `inspectPendingScopes(accountId)` expose scoped stored reconstruction and quarantine metadata. Legacy rows keep optional schema/epoch fields for non-destructive inspection.
- `attachLocalCapture` exposes `ready`, `preserve` and `dispose`; it has its own Yjs listeners independent of network push.
- `subscribeJournalInvalidation` carries invalidation only. Following UI/lifecycle work must reauthorize before using indexed recovery data.

## Limits and Next Work

This plan proves local storage reconstruction and acknowledgment boundaries. Dedicated local-first reopen, storage/recovery UI, coordinator lifecycle and export flows remain assigned to following Phase 4 plans. Available images are cached as fetches complete; missing references remain explicit. Browser persistence permission is advisory, and pending memory before a completed transaction has no browser-process-crash guarantee. Checkpoint assets are conservatively retained; garbage collection is not performed here. Requirement-wide SAVE-01/SAVE-02 acceptance remains with phase verification.

## Documentation Consulted

- Yjs document updates ([https://github.com/yjs/docs/blob/main/api/document-updates.md](https://github.com/yjs/docs/blob/main/api/document-updates.md)) and Y.Doc events ([https://github.com/yjs/docs/blob/main/api/y.doc.md](https://github.com/yjs/docs/blob/main/api/y.doc.md)), fetched through Context7. Installed Yjs snapshot implementation/types confirmed the operation/deletion containment API used for coverage.
- MDN IndexedDB usage ([https://github.com/mdn/content/blob/main/files/en-us/web/api/indexeddb_api/using_indexeddb/index.md](https://github.com/mdn/content/blob/main/files/en-us/web/api/indexeddb_api/using_indexeddb/index.md)), transaction completion ([https://github.com/mdn/content/blob/main/files/en-us/web/api/idbtransaction/complete_event/index.md](https://github.com/mdn/content/blob/main/files/en-us/web/api/idbtransaction/complete_event/index.md)) and durability options ([https://github.com/mdn/content/blob/main/files/en-us/web/api/idbdatabase/transaction/index.md](https://github.com/mdn/content/blob/main/files/en-us/web/api/idbdatabase/transaction/index.md)), fetched through Context7.

## Self-Check: PASSED

All declared implementation and test artifacts exist. All four task commits exist. Native and unit assertions exercise real data paths. Stub scan found no placeholder implementations preventing the plan goal. No new network endpoint or authentication boundary was introduced; storage validation remains within the plan threat model.
