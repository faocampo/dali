---
phase: 02-daily-mind-maps
reviewed: 2026-09-12
depth: standard
diff_base: db5255c
review_head: e52dab1
files_reviewed: 19
files_reviewed_list:
  - src/boards/operations.ts
  - src/canvas/BlockSuiteCanvas.tsx
  - src/canvas/LayersInspector.tsx
  - src/canvas/MindMapInspector.tsx
  - src/canvas/arrangement.ts
  - src/canvas/blocksuite-editor.ts
  - src/canvas/extensions.ts
  - src/canvas/mindmap-compatibility.ts
  - src/canvas/mindmap-export.test.ts
  - src/canvas/mindmap-export.ts
  - src/canvas/mindmap-keyboard.ts
  - src/canvas/mindmap-state.test.ts
  - src/canvas/mindmap-state.ts
  - src/canvas/mindmap.ts
  - src/canvas/presentation-export.ts
  - src/canvas/selection-summary.ts
  - src/header/ExportDialog.tsx
  - src/index.css
  - vite.config.ts
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
resolved_findings: 1
status: clean
---

# Phase 2: Code Review Report

## Narrative Findings (AI reviewer)

### CR-01: BLOCKER — Clipboard validation admits hierarchy that the application cannot operate on

**Resolution:** Fixed and verified in the working tree after the original review; awaiting orchestrator commit. The original finding and evidence below are retained for audit.

**File:** `src/canvas/mindmap-compatibility.ts:36`

**Issue:** The copy preflight accepts any string for a topic's `index`, including an empty string, and does not check duplicate sibling order keys. The downstream canonical validator rejects both (`src/canvas/mindmap-state.ts:20`, `src/canvas/mindmap-state.ts:33`). Consequently native paste can persist a map whose topics are then filtered from selection, whose editing/deletion guards reject it, and whose presence causes export planning to fail. This defeats the required rejection-before-mutation boundary.

**Reproduction and evidence:** A focused Chromium probe used the real native clipboard writer and the browser paste shortcut against the production preview. It created a root-only map, deep-cloned its serialized native payload, changed only the root child detail's `index` to `""`, and pasted. The original surface contained two elements; after paste it contained four. Serialized map order keys were `[["a0"],[""]]`. Thus the invalid map and its shape were actually inserted. The original map remained intact.

**Dependency trace:** `installCopyBoundary` calls `validateMindmapCopyData` before delegating to the pinned native `createElementsFromClipboardDataCommand`. Native `createCanvasElement` preserves each child detail while remapping IDs, so it retains the invalid index. `canvasModelVisible`, mutation preflights, and `mindmapExportSnapshot` subsequently consume `validateMindmapState`, which rejects that same persisted payload. Board duplication also uses the weaker validator through `validateMindmapDocument`.

**Fix:** Project each serialized map's referenced shape bounds and child details into the existing canonical hierarchy validator before any native conversion. Preserve copy-specific identity, membership, and batch-size checks. Apply the supported depth boundary consistently at this write boundary as well. Add real paste negative cases for empty order and duplicate sibling order; assert exact unchanged document serialization and element count. Include a valid ordered-map positive case.

**Coverage gap:** `tests/mindmap-copy.spec.ts:161` covers orphan, cycle, duplicate element identity, and nonfinite geometry. Its duplicate case duplicates an element ID, so it does not exercise duplicate sibling order. Unit tests already establish that empty order and duplicate sibling order are invalid.

## Review scope and limits

Reviewed the production changes in `db5255c..e52dab1`, the two new pure-state test modules, and relevant browser assertions for keyboard routing, hierarchy, copy, formatting, visibility, and export. Traced native clipboard conversion and lifecycle seams in the pinned installed dependency. No additional proven warnings were found.

The requested reviewer role and code-review workflow were loaded. **Dispatch adaptation:** this review reused an executor thread because session thread slots were exhausted. The reviewer previously implemented plans 02-01 and 02-02; this is a separately performed adversarial review with explicit role instructions, but it does not provide fresh-agent independence for those changes.

The orchestrator supplied the completed 604-browser-test and 67-unit-test regression results plus typecheck/build success for the reviewed head. The full browser suite was not rerun. The additional focused clipboard probe above is direct review evidence. The initial review wrote only this report. The orchestrator subsequently authorized the bounded remediation below. User-owned image files were left intact.

## Remediation verification

`src/canvas/mindmap-compatibility.ts` now projects serialized native child details and shape geometry through `validateMindmapState`, retaining copy-specific identity, membership and element-count guards. It rejects depth greater than 128 before native conversion. This same preflight is used by native clipboard paste, application duplication and board-copy validation.

`tests/mindmap-copy.spec.ts` adds empty-order, duplicate-sibling-order and excessive-depth paste cases. Every malformed case also asserts exact full document serialization in addition to the existing element/model state assertion.

- **RED:** Empty-order and duplicate-order each failed the unchanged-state assertion with eight additional persisted elements; duplicate-order also emitted an invalid-hierarchy page error. A 130-topic chain (depth 129) failed with 131 additional elements and a too-deep-to-arrange page error.
- **GREEN:** All 68 copy browser checks passed across development Chromium and production Chromium, Firefox and WebKit in 1.4 minutes. This includes the three new negative cases and existing positive duplicate, real clipboard, independent board copy, history, typography and reload cases.
- **Static/unit:** Typecheck, production build, all 67 unit tests, and diff whitespace checks passed.
- **Evidence limits:** Chromium clipboard checks use the real browser clipboard route. Firefox/WebKit retain the existing explicitly annotated clipboard payload simulation. No OS clipboard integration claim is made for those engines.

No keyboard source change was made. The preliminary external-control concern did not establish another product defect: Board Library unmounts the editor, while Export and Layers register Escape listeners on document capture, where the investigated `stopPropagation` call does not suppress other same-target listeners.

No commits were created during review or remediation. Exact remediation source/test paths are the two files listed above; this report is the accompanying artifact.

## UAT correction source review — 2026-09-14

The review covered explicit opening, editing and dismissal lifecycle, menu keyboard ownership, stale selection/host handling and sidebar-only viewport framing. A reused executor reviewed the correction read-only; the orchestrator inspected the production diff. A fresh independent verifier was unavailable in this session.

The editing-state finding is closed: entering text editing clears open state, rendering and opening reject editing, and an unmounted panel cannot pan. Menu Escape returns focus to its trigger; pane Escape returns focus to the canvas. Captured selection identity and current-host checks reject stale Properties activation. Focused tests cover these paths, including Add child and double-click editing. No unresolved source blocker remains in this correction. Execution evidence is recorded in 02-07-SUMMARY.md.

## Native More submenu review — 2026-09-14

Read-only review of plan 02-08 found no concrete blocker. The native ToolbarModuleExtension uses ActionPlacement.More; subscriptions and host listeners dispose on teardown. Selection changes/removal dismiss the submenu and Properties retains current-host/selection guards. Escape/ArrowLeft restores the invoking entry; ArrowRight opens the submenu. Alignment entries require multiple selected objects and distribution retains its three-object guard. A reused executor performed this scoped review; runtime results are recorded separately in 02-08-SUMMARY.md.
