---
phase: 02-daily-mind-maps
plan: "03"
subsystem: canvas
tags: [mindmap, keyboard, collapse, hierarchy, accessibility, playwright]
requires:
  - phase: 02-02
    provides: Native hierarchy copy validation and scoped compatibility adapters
provides:
  - Single-owner keyboard routing and shared guarded child/sibling commands
  - Accessible branch counts and native collapse selection relocation
  - Iterative topology validation and complete failure-state restoration
affects: [02-04, 02-05, 02-06]
tech-stack:
  added: []
  patterns: [composed event path ownership, native snapshot preflight, omitted-default restoration]
key-files:
  created: [src/canvas/mindmap-keyboard.ts, src/canvas/MindMapInspector.tsx, src/canvas/mindmap-state.ts, src/canvas/mindmap-state.test.ts, tests/mindmap-keyboard.spec.ts, tests/mindmap-collapse.spec.ts]
  modified: [src/canvas/mindmap.ts, src/canvas/BlockSuiteCanvas.tsx, tests/mindmap.spec.ts]
key-decisions:
  - Keep rich-text writes native while explicitly owning mind-map edit exits and creation events.
  - Validate native topology iteratively before hierarchy mutations; bound native recursive layout entry to depth 128.
  - Restore omitted serialized defaults on failure and remove failed additions after native add observers flush.
requirements-completed: []
requirements-addressed: [MIND-01, MIND-02, MIND-03]
coverage:
  - id: D1
    description: Focus-safe child and sibling editing through keyboard and accessible controls
    requirement: MIND-01
    verification:
      - kind: e2e
        ref: tests/mindmap-keyboard.spec.ts#@02-03-01
        status: pass
    human_judgment: false
  - id: D2
    description: Nested branch preservation, native history and rejected malformed mutations
    requirement: MIND-02
    verification:
      - kind: unit
        ref: src/canvas/mindmap-state.test.ts
        status: pass
      - kind: e2e
        ref: tests/mindmap-collapse.spec.ts#@02-03-02
        status: pass
    human_judgment: false
actuals:
  tokens: 11277
  tasks: 2
  commits: 4
plan_head_before: fb4a3331fdbf89962c2cf9cdd002e60090d7e249
measurement_head: b1b0f36
duration: 25min
completed: 2026-09-12
status: complete
---

# Phase 2 Plan 3: Keyboard Editing and Nested Collapse Summary

**Mind-map topics now support guarded child/sibling shortcuts, exact inline edit exits and accessible nested collapse with bounded topology checks and complete failure restoration.**

## Accomplishments

- `src/canvas/mindmap-keyboard.ts` (mounted-host keyboard routing) owns creation shortcuts before the native bubbling keymap. It distinguishes composed inline-editor paths, external controls, ordinary canvas selection, modifiers, repeat/keyup and composition termination. One selected topic uses Tab for a child and Enter for a following sibling; root Enter creates a child. Enter/Tab/Escape finish native inline editing, preserving the topic text and selection. Shift+Enter remains native multiline entry. Escape from topic selection clears it for normal traversal. Installation replaces a previous installation and returns complete listener cleanup.
- `src/canvas/mindmap.ts` (native hierarchy commands) exposes shared child/sibling boundaries, checks host/store identity, connection, readonly state, selected membership, visibility and all map descendant locks. Commands run synchronously, avoiding deferred command mutation. A collapsed parent is revealed using derived ancestor visibility before insertion, retaining nested collapsed flags. New topics use the UI contract's New topic text and the native editor. Viewport adjustment translates only excess outside the safe bounds, preserving zoom.
- `src/canvas/MindMapInspector.tsx` (topic controls and live messages) retains native selected IDs, exposes Add child/Add sibling and root-specific explanation, and provides direct-child collapse counts with expanded/pressed state, singular/plural labels and polite announcements. Leaves expose no toggle. The native canvas collapse method passes through the same hierarchy guard and relocates hidden selected descendants to the collapsed ancestor; expansion retains that ancestor selection.
- `src/canvas/mindmap-state.ts` (read-only native-tree projection) validates unique nonempty IDs, one root, known parents, nonempty and distinct sibling ordering, finite nonnegative bounds, boolean collapse flags and connected acyclic topology. Iterative traversal derives visible IDs, hidden ancestors, ordered children and depth using a three-pass node budget. A 12,000-depth pure fixture completes without recursion. Entry to the existing recursive native layout is protected at depth 128; this is a defensive mutation bound, not a performance capacity claim.
- Collapse continues through the proven native compatibility/history adapter. Failed collapse restores omitted defaults as well as field values. Failed insertion removes partial shapes after native add observers flush, avoiding the native surface's eager-cache ghost model for add/delete in the same transaction. Complete serialized snapshot assertions include unrelated objects.

## Task Commits

1. `0f6c6f2` — test(02-03): specify focus-safe mind-map keyboard editing
2. `5430dc5` — feat(02-03): route guarded mind-map editing and context commands
3. `21e62e1` — test(02-03): specify accessible nested-collapse preservation
4. `b1b0f36` — feat(02-03): validate and preserve nested mind-map collapse

Actual tokens are ceiling(realized diff characters / 4). Four task commits are measured from plan_head_before through measurement_head. Documentation close-out follows separately. All four task commits use neutral public contributor attribution; no tracked files were deleted.

## Verification

- `npm run typecheck` — passed before task commits and the final browser matrix.
- `npm test` — **64 passed across five files**, 920ms. The focused hierarchy command separately passed **13 cases**, 159ms.
- `npm run build` — passed; final production build took **7.93 seconds**. Existing mixed-import and bundle-size warnings remain unchanged in kind.
- `npm exec playwright test -- tests/mindmap-keyboard.spec.ts tests/mindmap-collapse.spec.ts --project=dev --project=prod --project=prod-firefox --project=prod-webkit` — **92 passed**, approximately **1.3 minutes**. Each target runs 10 keyboard and 13 collapse cases against the final source/build.
- `npm exec playwright test -- tests/canvas-editing.spec.ts tests/canvas-arrangement.spec.ts tests/mindmap-compatibility.spec.ts tests/mindmap.spec.ts --project=prod` — **29 passed in 26.2 seconds** after the final source changes. This includes native typography, exact collapse Undo/Redo, clipboard/board copy, root creation, reload and PNG, alongside Phase 1 editing and arrangement.

All browser cases retain the automatic unexpected-console/page-error gate. Production assets were rebuilt before final checks; browser timing is separate from build startup. No test is skipped and every named task target matches real assertions.

## Preservation and Failure Evidence

| Case | Asserted outcome |
|------|------------------|
| Root, child and following sibling | Exact topic count, parent IDs and ordering; keyboard and context insertion both create one topic. |
| Inline editing | Escape/Tab remove the editor and retain text; Shift+Enter retains a real multiline label; deliberate commands after reload create one topic. |
| Focus and event guards | Held keys, external shadow input, context focus, readonly, locked, multiple selection and detached hosts create no extra topics. |
| Nested collapse | Seven-node fixture preserves text, explicit typography, IDs, parent order and nested collapse through expand and local reload; full serialized Undo/Redo states match exactly. |
| Counts and visibility | Leaf has no toggle; one child uses singular copy; two branches use plural copy. Root collapse leaves the root visible. Adding into a collapsed parent reveals existing eligible descendants immediately. |
| Native badge path | Native toggle invocation relocates a selected hidden descendant to the visible ancestor, then contextual expansion retains that selection. |
| Repeated toggles | Twelve toggles preserve every topic's identity, ordering and text; the nested collapsed leaf stays hidden. |
| Malformed input | Orphan, cycle, duplicate ID, multiple roots, invalid ordering and nonfinite geometry fail at preflight with a visible error and unchanged serialized state. Pure fixtures additionally cover self-cycle, empty tree and negative geometry. |
| Injected layout/add failure | Full shape and map serialization, including omitted defaults, matches the original; unrelated shapes remain unchanged and no partial topic survives. |

Malformed browser fixtures inject altered detail iteration at the read-only native preflight boundary so native observers cannot repair the fixture before the intended action. These establish command-boundary rejection. They do not claim arbitrary corrupted persistent documents have been loaded safely through every upstream observer.

## TDD Gate Compliance

- Task 1 RED: the named Escape assertion expected zero native inline editors and observed one. The first sandbox server-start failure was a setup failure and did not authorize implementation. The subsequent actual Playwright assertion was represented as TAP for the runtime validator, which returned RED_EVIDENCE_OK before the RED commit and production edits.
- Task 2 RED: the named nested-collapse test expected a visible Collapse branch control, which did not exist. Its actual assertion result likewise passed RED_EVIDENCE_OK before the RED commit and production edits. Pure state cases were written before their implementation.
- GREEN: both named task suites pass in all four configured targets. Complete snapshots exposed omitted-default and failed-add cache restoration defects; the implementation was corrected while retaining those assertions.
- A Firefox ordinary-entry fixture used text insertion that triggered composition semantics. It now sends actual character key events, while the separate composition case preserves its zero-creation and retained-text assertions. The speculative held-key modification was reverted; final routing retains repeat/keyup ownership.
- No separate refactor commit was needed.

## Deviations from Plan

**[Rule 3 — Blocking regression fixture] Updated the prior tracer's initial topic label.** `tests/mindmap.spec.ts` (native creation/reload/export regression) expected upstream New node. The approved UI contract requires New topic, so its two label expectations were updated with explicit orchestrator authorization. Its node-count, text, hierarchy, reload and PNG assertions remain unchanged. Included in `5430dc5`.

The implementation-time corrections for blur reentrancy, omitted serialized defaults, immediate reveal and failed-add cache cleanup fulfill the planned edit/preservation behavior. They introduce no separate schema or service. No unresolved implementation defects, blocking stubs, skipped tests or unrun task verification remain.

## Threat Coverage and Remaining Scope

- T-02-05: composed path, composition termination, repeat/keyup and single-handler tests cover local keyboard routing.
- T-02-06: native snapshot validation, descendant locks and full-state rejection/fault assertions protect hierarchy mutation.
- T-02-07: iterative visited traversal and bounded native-layout entry protect these commands from invalid or excessive recursive topology. Repeated toggle and deep pure fixtures terminate.
- T-02-08: synchronous commands, host/store identity guards, readonly/lock checks and disposal protect local command lifetime. Phase 5 retains multi-user durability and concurrency guarantees.
- T-02-09: ancestor selection relocation is implemented here; Layers, hit testing, marquee and other existing selection surfaces remain assigned to 02-04.

Constructed composition events establish routing over retained native text. Actual native OS IME text production and interaction feel remain the explicit manual checks in `02-VALIDATION.md` (phase validation contract). No native OS acceptance or later collaborative durability is claimed.

The deterministic MIND-02 **unclassified** assumption marker remains unresolved for reviewer assessment, alongside these explicit preservation tests. MIND-01–03 remain open for dependent-plan and phase verification. Plans 02-04 through 02-06 retain their assigned visibility, layout/style/accessibility and export work. Phase 2 is ready to proceed to plan 02-04.

## Self-Check: PASSED

All nine changed source/test files exist. All four listed task commits exist. Static checks, 64 unit tests, 92 cross-target behavior cases and 29 final regressions pass. No tracked file deletions occurred. User-owned untracked images were preserved.
