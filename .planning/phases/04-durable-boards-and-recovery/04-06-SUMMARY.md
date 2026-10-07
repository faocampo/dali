---
phase: 04-durable-boards-and-recovery
plan: "06"
subsystem: recovery
tags: [archives, images, native-import, authorization, save-status]
requires:
  - phase: 04-03
    provides: Reconstructable local pending content and checkpoints
  - phase: 04-04
    provides: Scoped recovery authority and storage pause
  - phase: 04-05
    provides: Current document and image save coverage
provides:
  - Immutable authorized native recovery archives with complete verified images
  - Scope-bound preparation, duplicate suppression and retry state independent of saving
  - Native archive roundtrip with retained original image pixels and remapped edit ownership
affects: [04-07, 04-15, 04-16]
tech-stack:
  added: []
  patterns: [immutable snapshot capture, scoped preparation flight, native transformer ID mapping]
key-files:
  created: [src/canvas/recovery-archive.ts, src/canvas/recovery-archive.test.ts, tests/recovery-archive.spec.ts, tests/recovery-archive-fixtures.ts]
  modified: [src/canvas/export-board.ts, src/canvas/runtime.ts, src/canvas/save-status.ts, src/canvas/RecoveryStateView.tsx, src/header/Header.tsx, src/boards/import-local.ts, server/boards/documents.ts]
key-decisions:
  - Capture visible content synchronously before asynchronous authorization and asset collection; hand off only complete verified bytes under current authority.
  - Permit local-only recovery for the same unexpired writable scope during a network outage; require fresh authorization for server image reads.
  - Keep recovery preparation independent of save acknowledgments and retain pending records through success, failure and retry.
requirements-covered: [SAVE-01, SAVE-02]
requirements-completed: []
coverage:
  - id: D-02
    description: Complete immutable native archive retains pending content and image fidelity
    requirement: SAVE-01
    verification:
      - kind: integration
        ref: tests/recovery-archive.spec.ts#@04-06-01
        status: pass
    human_judgment: false
  - id: D-03
    description: Missing image blocks handoff and permits retry with pending records retained
    requirement: SAVE-02
    verification:
      - kind: integration
        ref: tests/recovery-archive.spec.ts#@04-06-02
        status: pass
    human_judgment: false
  - id: D-07
    description: Authorized storage-paused offline board exports retained content
    requirement: SAVE-02
    verification:
      - kind: integration
        ref: tests/recovery-archive.spec.ts#@04-06-01
        status: pass
    human_judgment: false
actuals:
  tokens: 16200
  tasks: 2
  commits: 4
plan_head_before: 3b21bcb63fc116a7d4003254b1c9595902d616cf
duration: 35min
completed: 2026-09-26
status: complete
---

# Phase 4 Plan 6: Recovery Archive Summary

**Authorized recovery downloads now capture immutable native board content, verify every required image and preserve pending save records through preparation, handoff and retry.**

## Accomplishments

- Capture the current visible native snapshot synchronously, including pending edits, before any asynchronous work. Later edits remain outside that fixed archive and stay pending independently.
- Collect original and processed image bytes from retained runtime memory, pending records and durable checkpoints. Server reads require fresh editable-export authorization. Validate native snapshot structure, image references, media type, size and content-addressed hashes before the single archive handoff.
- Recheck current account, board lifetime, session expiry and writable recovery authority before handoff. Explicit denial, downgrade, expiry and account changes block export. Still-unexpired same-account local recovery remains possible during network failure and storage pause.
- Produce a sanitized title plus recovery timestamp filename using the existing `.bs.zip` format. Zero-image boards omit the image section. Required missing or corrupt images produce an explicit named error and zero download.
- Keep persistent scope-bound idle/preparing/ready/error state separate from save coverage. Duplicate activation shares one preparation flight; closing and reopening details preserves progress. Success and failure retain journal IDs, mutation pause and pending markers.
- Native Import creates a new private board and preserves text, geometry, connectors, mind-map hierarchy, collapse, style, crop, brightness and image hashes. Custom image-edit ownership follows native regenerated block identities, and original pixels remain associated and readable after cold reload.

## Task Commits

| Task | RED | GREEN |
|---|---|---|
| 04-06-01 Immutable complete authorized archive | `131cd2f` | `2bfe72d` |
| 04-06-02 Persistent preparation and retry | `b18ad36` | `0c8fe3a` |

The four task commits were measured from the persisted plan base before this summary. Actual tokens are 64,799 realized diff characters divided by four and rounded; planning metadata is excluded.

## TDD Gate Compliance

Both tasks followed RED → GREEN under normal task TDD; the global MVP/TDD runtime gate was disabled in project configuration. Task 1 first demonstrated that the ordinary archive path handed off bytes whose hash did not match the image identifier: the expected rejection instead resolved successfully. Task 2 first demonstrated duplicate preparation: expected one handoff, observed two. Each assertion was recorded with its command, exit code, target and expected/actual behavior, and both runtime evidence checks returned `RED_EVIDENCE_OK` before implementation. No mandatory test was skipped.

## Verification

- Recovery unit suite: **17 passed**, covering immutable content, missing/corrupt images, zero images, local-only paused recovery, scope invalidation, expiry, permission denial, delayed asset reads, duplicate flights and retained save state.
- Full frontend unit suite: **174 passed**, 15 files, zero skipped, 8.44 seconds including startup.
- Exact task 1 native gate, `npm exec playwright test -- tests/recovery-archive.spec.ts --project=prod --grep @04-06-01`: **4 passed**, zero skipped, 30.0 seconds including production build and owned server startup.
- Exact task 2 native gate, `npm exec playwright test -- tests/recovery-archive.spec.ts --project=prod --grep @04-06-02`: **3 passed**, zero skipped, 21.9 seconds including startup.
- Final combined native archive/local-recovery regression: **12 passed**, zero skipped, 40.9 seconds. This reran all seven archive cases plus five prior quota, abort, corrupt/restore isolation and loading/focus cases against the final implementation.
- Existing native Import regression: **16 passed** in the integration run after importer remapping. That run was stopped when its subsequent recovery case exposed missing original-image server manifest coverage; the corrected recovery gate above passed after rebuilding.
- Full server regression: **307 passed**, 13 files, zero skipped, 19.93 seconds. The initial sandbox invocation could not bind test listeners; the approved loopback run passed.
- Both `npm run typecheck` and `npm run typecheck:server` passed after each task and after final changes. Browser startup built the production bundle. `git diff --check` passed; task commits delete no tracked files.
- The missing-image case verifies actual widths 1440, 900, 600, 490 and 320 pixels with a 200-character title and 120-character image name. The 320-pixel screenshot was inspected; text wraps, the surface scrolls vertically and controls remain reachable. A real narrow-width retry click completes after bytes become available.

Native browser tests use actual canvas edits, authentication, persisted journals, native ZIP download/import and server image reads. Synthetic response barriers establish precise races. ZIP payloads and image digests are inspected, including original and processed raster bytes. The missing-preview case removes the rendered preview while retained bytes still export successfully.

## Deviations from Plan

1. **[Rule 2 — native import fidelity]** Native transformer identity replacement omitted the custom image-edit block's image owner and the Import manifest omitted its original source pixels. Added bounded ZIP reading with the existing `fflate` dependency and native Transformer middleware, retained exact block identity mappings, and included original image references in client/server import manifests. This is required for the specified native crop/adjustment roundtrip. Files: `src/boards/import-local.ts`, `server/boards/documents.ts`. Commit: `2bfe72d`.
2. **[Rule 2 — visible recovery integration]** Connected existing Header and recovery controls to the new service and persistent preparation state so current users can activate and retry the specified behavior before the dependent SaveDetails plan. Files: `src/header/Header.tsx`, `src/canvas/RecoveryStateView.tsx`. Commits: `2bfe72d`, `0c8fe3a`.
3. **[Rule 1 — narrow recovery controls]** The real 320-pixel retry exposed a canvas inspector intercepting pointer events above the recovery surface. Raised the open Header stacking context, clamped panel height and wrapped action controls. The actual narrow retry passed after correction. Commit: `0c8fe3a`.

No dependencies were installed. Preexisting user files and services were preserved.

## Interfaces for Following Plans

- `downloadRecoveryCopy()` captures immediately and returns the shared current-scope preparation promise. `getRecoveryDownloadState()` and `subscribeRecoveryDownloadState()` expose immutable idle/preparing/ready/error state, label, optional message and captured timestamp. Render the state only for the matching recovery scope.
- `getRecoveryRuntime()` exposes the visible runtime and a local-only asset reader independent of mutation pause. Retained bytes are lifetime-scoped and cleared with the runtime.
- `buildSnapshotArchive()` is shared by ordinary export and recovery, enforcing the same complete-reference and verified-image contract.
- `recoveryArchiveFixtures` defines E3 empty/loading/error/populated/overflow/long-text cases and a response barrier. Current controller and Header evidence covers these states and narrow layout. The dependent 04-07 final SaveDetails integration owns its complete image-list rendering, 50-row fixture and final zoom/accessibility matrix.

## Threat Flags

| Flag | File | Description |
|---|---|---|
| threat_flag: archive_import | src/boards/import-local.ts | Explicit ZIP decoding and native identity mapping extend the original download boundary. Compressed entry limits, native schema transformation and existing staged Import authorization remain enforced; original image keys join the server reference manifest. |

The declared T-04-06-01 boundary is covered by fixed scope/content capture, complete asset validation, authority rechecks and the sole handoff. Known account changes and denial produce zero handoff in unit/native tests.

## Acceptance Limits

The ready message reports browser handoff and asks the user to check downloads. Browser cancellation and disk persistence cannot establish server acknowledgment; pending records remain retained. This plan establishes production Chromium behavior with synthetic test deployment settings. Phase-wide cross-browser and requirement acceptance remain with the later verifier. No unfinished implementation stubs were found. The next dependency-ordered plan is **04-09**.

## Documentation Consulted

- BlockSuite data synchronization ([https://github.com/toeverything/blocksuite/blob/main/docs/guide/data-synchronization.md](https://github.com/toeverything/blocksuite/blob/main/docs/guide/data-synchronization.md)), retrieved through Context7; the installed native Transformer implementation determines synchronous snapshot capture and identity replacement behavior.
- fflate ZIP APIs ([https://github.com/101arrowz/fflate/blob/master/docs/README.md](https://github.com/101arrowz/fflate/blob/master/docs/README.md)) and unzip filtering ([https://github.com/101arrowz/fflate/blob/master/docs/interfaces/UnzipOptions.md](https://github.com/101arrowz/fflate/blob/master/docs/interfaces/UnzipOptions.md)), retrieved through Context7 for existing-dependency bounded archive decoding.

## Self-Check: PASSED

All four new artifacts and all four task commits exist. Required automated gates passed without skips, both static checks passed, and the final native regression passed all 12 cases. Requirement-wide acceptance remains unchanged.
