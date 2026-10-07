---
phase: 05-real-time-collaborative-editing
plan: "05"
subsystem: collaboration
tags: [recovery, divergence, receipts, offline, epochs]
requires:
  - phase: 05-04
    provides: Personal history with acknowledged action provenance
provides:
  - Isolated local candidates and fresh transactional recovery comparison
  - Exact document and title receipts retaining eligible personal history
  - Explicit restored-permission consent and locally preserved outage actions
  - Tab, account, epoch, image and storage boundaries verified in native browsers
requirements-completed: []
affects: [05-06, 05-07, 05-09]
tech-stack:
  added: []
  patterns: [isolated local candidate, fresh version comparison, actor-tab exact receipt, explicit permission consent]
key-files:
  created: [src/canvas/account/recovery-baseline.ts, src/canvas/account/live-recovery.ts, server/boards/recovery-baseline.ts, tests/collaboration-recovery.spec.ts, tests/collaboration-offline-editing.spec.ts, tests/collaboration-recovery-boundaries.spec.ts, tests/collaboration-recovery-restore.spec.ts]
  modified: [src/canvas/account/outbox.ts, src/canvas/account/recovery.ts, src/canvas/runtime.ts, src/canvas/account/live-source.ts, src/canvas/account/blob-source.ts, src/canvas/account/board-workspace.ts, src/canvas/RecoveryStateView.tsx, server/boards/documents.ts, server/boards/blobs.ts, server/boards/actions.ts]
coverage:
  - id: RECOVERY-ISOLATION
    description: Divergent, unknown and legacy candidates remain separate from shared hydration and replay.
    verification:
      - kind: unit
        ref: src/canvas/account/recovery-baseline.test.ts
        status: pass
      - kind: e2e
        ref: "tests/collaboration-recovery.spec.ts#@05-05-01"
        status: pass
    human_judgment: false
  - id: RECOVERY-REPLAY
    description: Fresh reservations and transaction comparisons admit unchanged work; exact own receipts reconcile lost responses and personal history.
    verification:
      - kind: integration
        ref: server/boards/recovery-baseline.test.ts
        status: pass
      - kind: e2e
        ref: "tests/collaboration-recovery.spec.ts#@05-05-02"
        status: pass
    human_judgment: false
  - id: RECOVERY-OFFLINE
    description: New explicit outage gestures and images remain local; restored permission requires explicit consent at every replay boundary.
    verification:
      - kind: unit
        ref: src/canvas/account/live-source.test.ts
        status: pass
      - kind: unit
        ref: src/canvas/account/blob-source.test.ts
        status: pass
      - kind: e2e
        ref: tests/collaboration-offline-editing.spec.ts
        status: pass
      - kind: e2e
        ref: tests/collaboration-recovery-boundaries.spec.ts
        status: pass
    human_judgment: false
  - id: RECOVERY-LIFETIME
    description: Separate tabs, changed account, navigation, real restored epochs and post-commit storage failures retain only the correct candidate and cancel stale work.
    verification:
      - kind: e2e
        ref: tests/collaboration-recovery-boundaries.spec.ts
        status: pass
      - kind: e2e
        ref: tests/collaboration-recovery-restore.spec.ts
        status: pass
      - kind: e2e
        ref: "tests/collaboration-recovery.spec.ts#active-replay-quota"
        status: pass
    human_judgment: false
completed: 2026-10-07
status: automated_verified
---

# Phase 05 Plan 05: Divergence-aware recovery

Pending collaborative work stays isolated from shared content until a fresh authority and version check permit replay or the member chooses a recovery path. Both approved tasks have verified automated evidence at the final product checkpoint below. Whole-phase acceptance remains incomplete.

## Delivered behavior

An additive shared root/content/title baseline coexists with the existing local checkpoint and original assets. Unknown or legacy evidence enters a conservative choice. Actual document content and title determine divergence; presence and grant revision changes alone do not. Recovery epoch remains an independent fence.

One selected account/board/epoch/tab candidate is reconstructed before hydration. Reconnecting cannot apply the server's newer content over that candidate or publish divergent bytes. The server returns consistent authorized baselines and exact own operation/rename receipts. Lost acknowledgements are reconciled by original account, transport tab, operation, document and digest, including partially recovered history actions. A later foreign title or property is never borrowed as proof of the member's work.

Unchanged replay uses a fresh connection and reservations. Document, image and rename commits compare the expected shared version inside the transaction. A remote write winning during comparison or commit surfaces the isolated choice. Restored write permission requires explicit consent bound to the actual marker version, including access lost during fresh authorization, baseline inspection, reservation acquisition or commit. Permission errors cannot unmount the candidate before recording that loss.

Already-open disconnected boards can preserve new explicit gestures and original image bytes while their last authenticated session remains valid and local storage is available. Local action identities cannot become remote reservation headers. A rejected online reservation never becomes an offline replay. Known expiry, read-only access, stale runtime, recovery choice and storage failure stop admission. History remains unavailable offline; after acknowledged replay it retains eligible personal steps and fresh inverse protection.

Storage quota after a recovery commit retains the candidate and exact submission proof. Retrying reconciles the own receipt without resending the operation; native synchronization resumes only after the original transport reconnects. Same-account tabs remain separate, and navigation/account changes cancel old callbacks. A real SQLite backup/restore changes epoch, invalidates sessions and quarantines old rows; explicitly opening the restored version retains those rows and never replays their bytes.

## Revision-scoped verification

Final product checkpoint: `ab0b8a7`.

- Full client: 286/286 across 26 files, 13.75 seconds.
- Full serialized server: 388/388 across 19 files, 150.04 seconds.
- Both TypeScript checks pass.
- Chromium combined gate: 48/48, 8.4 minutes, zero skips/retries/unexpected errors. It covers: recovery 14, additional boundaries 7, real collaborative restore 1, offline editing/access loss 8, history 10, clean history reconnect 2, consecutive typography 3, online image actions 2 and cold Viewer-first restore 1.
- Firefox/WebKit recovery matrix: 60/60 (12.1m), all 30 current recovery/outage/boundary/restore cases per engine, zero skips/retries/unexpected errors.

These gates have zero required skips/retries and no unexpected browser errors. Expected negative HTTP responses are checked against their concrete operation and strict engine-specific console list. Native file-input and pointer tests do not claim Finder, system clipboard, browser-chrome zoom, spoken assistive technology, real-provider login or independent storage acceptance.

## Task commits and retained failures

- `c952a21`: isolated pending versions and additive baseline foundation.
- `3e6f0e2`: unchanged replay, exact title receipts and transactional comparison.
- `e91fc2c`: partial-action provenance and recovered personal history after lost replay ACK.
- `717a88d`: explicit choice when remote changes win after comparison.
- `8157503`: new explicit local actions during live outages.
- `bea25b3`: permission-loss marker at all replay boundaries.
- `ab0b8a7`: locally retained outage images and deferred native sync after storage recovery.

The execution report preserves original failures separately from fixes and passing reruns: early title/receipt gaps, lost recovered history, missing race dialogs, blocked offline gestures, four absent restored-permission choices, premature offline asset publication and native-root retries after quota recovery. Test corrections are identified separately: an idempotent root acknowledgement required a bounded storage wait; scope-transition tests incorrectly waited for a leave dialog or an aborted response body; account transition legitimately rejects both old session validation and old connection retirement. No failing run is relabeled as passing.

## Scope, deviations and next dependency

No packages, new services or database migration were introduced by this plan. Coverage was split into dedicated offline, boundary and actual-restore suites to keep failure ownership clear. Backup/restore evidence uses owned local directories and synthetic identities. The original checkout and independent migration-11 history remain preserved; their databases are not mixed.

The current decision surface preserves work, supports dismissal/review and restored-work consent. Create private copy and Load latest changes remain disabled until approved plan 05-06 implements their complete paths. Shared-canvas replacement is not offered. Current automatic status/choice checks do not replace whole-phase human UX acceptance.

COL-03 remains pending because plans 05-06, 05-07 and 05-09 also declare it. Phase 5 remains incomplete and collaboration stays opt-in. Proceed directly to 05-06 after verified closure; active access transitions, collaborative mind maps, twenty distinct native editors, full phase regression and explicit human acceptance remain 05-07 through 05-09. No pilot readiness, publication, merge or shared deployment is claimed.

## Execution scope and self-check

Two approved tasks; multi-session execution duration was not consistently recorded. Seven product commits plus a documentation checkpoint span 43 changed files from the prior plan. Delivered implementation and named suites exist, both static checks pass, and final native recovery coverage passes in all three engines. This summary classifies only the tested behaviors. Shared COL-03 remains Pending in REQUIREMENTS.md until its later dependent plans and whole-phase acceptance complete; its requirement array is intentionally not claimed complete here.
