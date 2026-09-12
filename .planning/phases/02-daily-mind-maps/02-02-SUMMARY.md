---
phase: 02-daily-mind-maps
plan: "02"
subsystem: canvas
tags: [blocksuite, clipboard, duplication, hierarchy, playwright]
requires:
  - phase: 02-01
    provides: Native map creation and scoped typography/history compatibility
provides:
  - Invocation-time duplicate source capture and final native mutation guards
  - Bounded native copy hierarchy validation
  - Independent object, clipboard and board-copy regression evidence
affects: [02-03, 02-04, 02-05, 02-06]
tech-stack:
  added: []
  patterns: [captured native source identity, native conversion preflight, document-scoped copy identity]
key-files:
  created: [tests/mindmap-copy.spec.ts]
  modified: [src/canvas/mindmap-compatibility.ts, src/canvas/arrangement.ts, src/boards/operations.ts]
key-decisions:
  - Retain native complete-detail conversion and document-local surface IDs in board snapshots.
  - Capture duplicate source models at invocation and validate them independently of later selection changes.
  - Bound native copy batches at 10000 elements and reject invalid map identities, geometry and topology before conversion writes.
requirements-completed: []
requirements-addressed: [MIND-01, MIND-02, MIND-04]
coverage:
  - id: D1
    description: Independent native object, clipboard and board mind-map copies
    verification:
      - kind: e2e
        ref: tests/mindmap-copy.spec.ts#@02-02-01
        status: pass
    human_judgment: false
actuals:
  tokens: 5862
  tasks: 1
  commits: 2
plan_head_before: 5a5bbec48025c995d52ef25d083dace46c9fe86e
measurement_head: 8fd0269
duration: 12min
completed: 2026-09-12
status: complete
---

# Phase 2 Plan 2: Independent Native Mind-Map Copying Summary

**Native duplicates, clipboard pastes and copied boards preserve nested hidden content and typography, with captured source identity and malformed-hierarchy rejection.**

## Changes

- `src/canvas/arrangement.ts` (native object operations) captures selected model references and the store before adding duplication to the existing per-host queue. Later selection changes cannot change the intended source. The captured source is validated again when the queued operation starts.
- `src/canvas/mindmap-compatibility.ts` (native copy and layout integration) scopes source guards around the existing duplicate call and validates the exact native clipboard-creation command input before conversion. Its native primitive insertion boundary checks host/store identity, connection, readonly state and current source locks/existence immediately before writes. Original methods are restored at disposal.
- Native snapshot validation checks unique element IDs, finite four-value geometry, valid shape membership, parent/index/collapsed details, one root, missing parents and cycles. An iterative completed-path walk bounds parent validation. Copy batches are limited to 10,000 native elements. This is a defensive input bound, not a measured performance guarantee.
- `src/boards/operations.ts` (local board lifecycle) validates native map content before the existing docToSnapshot/snapshotToDoc flow. replaceIdMiddleware and native document-local surface ID semantics remain unchanged.
- The existing 02-01 per-model wrappers continue preserving copied fontSize/fontWeight/color and native fitted geometry. No override schema, canvas-ID migration or dependency-source modification was introduced.

## Task Commits

1. `7e655fe` — test(02-02): specify guarded native mind-map copying
2. `8fd0269` — feat(02-02): guard native mind-map copy sources and hierarchy

Actual tokens are ceiling(realized diff characters / 4). The two implementation/test commits were measured from plan_head_before through measurement_head; documentation close-out follows separately.

## Verification

- `npm run typecheck` — passed before commits and after final test additions.
- `npm run build` — passed; production assets were rebuilt before GREEN runs. Existing mixed-import/chunk warnings remain.
- `npm exec playwright test -- tests/mindmap-copy.spec.ts --project=prod --grep "@02-02-01"` — **14 passed in 13.9 seconds**.
- `npm exec playwright test -- tests/canvas-arrangement.spec.ts tests/canvas-editing.spec.ts tests/mindmap-compatibility.spec.ts tests/mindmap.spec.ts --project=prod` — **29 passed in 27.2 seconds**.
- `npm test` — **51 passed across four files**, approximately one second.

All browser cases use the automatic unexpected console/page-error fixture. Happy paths use real Chromium clipboard permissions and keyboard copy/paste. Deterministic negative scheduling and final-boundary fault probes are explicitly identified in their test comments; they establish routing and guard behavior. No other-engine clipboard or native OS claim is made by this plan.

## Observed Copy Semantics

| Route | Evidence |
|---|---|
| Native object duplicate | Seven nodes retain parent order, two nested collapse flags, hidden descendants and explicit 29px/700/#345678 typography. Topic and parent IDs are independently remapped. One Undo removes the copy, Redo restores it, and editing/formatting/expanding the copy leaves the source unchanged. Repeated duplication yields 21 unique topic IDs across three seven-node maps. |
| Actual Chromium clipboard | Native copied HTML is awaited after asynchronous serialization. Paste retains the same complete hierarchy and typography, supports Undo/Redo, and remains independent after editing and same-browser reload. |
| Native topic selection | Duplicating a selected topic creates an independent shape. Its source map and complete branch remain unchanged. Duplicating the resulting ordinary shape remains available. |
| Board library duplicate | The copied board has a distinct document ID while retaining document-local surface IDs. Typography edits, expansion, Undo/Redo and reload operate independently; reopening the source yields its exact previous state. |
| Stale duplicate work | Readonly, descendant lock, removed source and detached host invalidations insert no objects. A separate injected descendant lock immediately before the native conversion command also inserts nothing. |
| Malformed clipboard | Orphan parents, cyclic parent links, duplicate element IDs and nonfinite geometry insert nothing and preserve exact source state. |

The native same-document route remains `duplicate` → `getSortedCloneElements` → `prepareCloneData` → `createElementsFromClipboardDataCommand` → `createCanvasElement`. Native clipboard paste reaches that same creation command. Its MINDMAP branch spreads full child details into a Y.Map and remaps child/parent IDs. The generic propsToY pick list remains untouched.

Sources: `node_modules/@blocksuite/affine-block-root/src/edgeless/utils/clipboard-utils.ts` (duplicate dispatch), `utils/clone-utils.ts` (sorting and serialization), `clipboard/command.ts` (native conversion), `clipboard/canvas.ts` (complete-detail remapping), and `src/boards/operations.ts` (board transformer route).

## TDD Gate Compliance

- RED: the intended-source test dispatched duplication and changed selection within the same event turn. It expected two maps but found one because the queued implementation copied the newly selected unrelated shape. The actual named Playwright JSON assertion result was converted to TAP for the runtime validator; RED_EVIDENCE_OK authorized implementation.
- GREEN: invocation-time capture plus native boundary preflight resolved that failure. All 14 copy tests and the 29 affected regression cases pass.
- Initial malformed orphan/cycle fixture failures revealed that native serialize() retains nested detail references. The fixtures now structuredClone serialized output before corruption. Exact source-state assertions remain unchanged; production conversion already spreads child details.
- No separate refactor commit was needed.

## Threat Verification

- **T-02-18:** Complete-detail native mapping and distinct document scope are verified through independent edits, collapse, typography, Undo and reload.
- **T-02-19:** Captured model/store identity and native insertion guards are verified with queued invalidations and a final-command-boundary descendant lock.
- **T-02-20:** Bounded hierarchy preflight rejects the tested cycle, orphan, duplicate-ID and nonfinite-geometry payloads before adapter writes.

## Deviations and Remaining Scope

None — the plan uses the specified native routes and scoped integration points. MIND-01, MIND-02 and MIND-04 remain open for their other approved dependent-plan behavior and phase verification. No blocking stubs, skipped tests or unrun task verification remain. Phase 5 retains concurrent durability responsibility.

## Self-Check: PASSED

All four declared source/test files exist, both task commits exist, static checks and named browser assertions pass, and no tracked file deletions occurred. User-owned untracked images were left untouched.
