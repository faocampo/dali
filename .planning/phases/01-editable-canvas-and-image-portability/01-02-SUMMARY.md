---
phase: 01-editable-canvas-and-image-portability
plan: "02"
subsystem: ui
tags: [canvas, blocksuite, accessibility, native-models, playwright]
requires:
  - phase: 01-01
    provides: Mounted native editor, local persistence and browser error fixtures
provides:
  - Accessible left drawing rail using native tool classes
  - Contextual arrangement controls and guarded platform shortcuts
  - Real-input editing and arrangement evidence in development and production
affects: [01-03, 01-04, 01-05]
tech-stack:
  added: []
  patterns: [native command adapters, guarded keyboard capture, serialized native duplication, model-backed browser assertions]
key-files:
  created: [tests/canvas-editing.spec.ts, tests/canvas-arrangement.spec.ts]
  modified: [src/canvas/BlockSuiteCanvas.tsx, src/canvas/EdgelessToolbarDragHandle.tsx, src/canvas/SelectionInspector.tsx, src/canvas/arrangement.ts, src/index.css]
key-decisions:
  - Use the existing left rail with native tool classes because the native horizontal palette has fixed-size illustrated internals.
  - Preserve native contextual style controls and native grouping, duplication, geometry and history operations.
  - Guard arrangement against editing focus, readonly or detached editors, locked descendants and nonfinite geometry.
requirements-completed: [CAN-01, CAN-02]
coverage:
  - id: native-editing
    description: Native primitive creation, shape editing and persistence, Unicode bold text, viewport gestures, keyboard tool activation and inert HTML paste.
    requirement: CAN-01
    verification:
      - kind: e2e
        ref: tests/canvas-editing.spec.ts
        status: pass
    human_judgment: false
  - id: native-arrangement
    description: Real selection, movement, resizing, duplication, grouping, alignment, layer order, color and focused deletion with native model assertions.
    requirement: CAN-02
    verification:
      - kind: e2e
        ref: tests/canvas-arrangement.spec.ts
        status: pass
    human_judgment: false
actuals:
  tokens: 9800
  tasks: 2
  commits: 4
plan_head_before: 31afe49bfd632be7437babcfacd90246979753db
duration: approximately 20min
completed: 2026-09-11
status: complete
---

# Phase 1 Plan 2: Editable Canvas Controls and Arrangement Summary

**Native drawing tools now occupy an accessible left rail, with contextual arrangement controls, guarded duplication/grouping shortcuts and 40 passing development/production browser cases.**

## Accomplishments

- Replaced the draggable bottom palette presentation with one scrollable left rail using native DefaultTool, FrameTool, ShapeTool, ConnectorTool and BrushTool. Existing sticky, text, image and board actions remain in the same rail. Tool buttons expose names, pressed state, focus indicators and 36px targets on an 8px spacing scale.
- Kept BlockSuite's contextual shape, color, text, connector and other style controls. The right inspector now provides duplicate, group, ungroup, eight alignment/distribution actions, front/back order and lock controls.
- Added platform-aware duplication/grouping shortcuts and serialized native duplication. Checks protect active input and rich-text editing, composition, readonly/detached editors and locked group descendants. Alignment uses finite native geometry and document-order tie breaking; it retains IDs at touching or coincident bounds.
- Browser evidence covers native shape/frame/connector/freehand creation, shape text and geometry persistence, Unicode combining marks and emoji with bold formatting, sticky and formatted-text input, both supported viewport sizes, pointer-centered zoom, Space and middle-button panning, inert pasted HTML, marquee selection, all eight arrangement actions, nested groups, repeated distinct duplicates, movement, resizing, color persistence, layering, locks and local undo/redo.

## Task Commits

| Task | RED | GREEN |
|---|---|---|
| 01-02-01 Native primitives and left tools | `173b21f` | `b2400f5` |
| 01-02-02 Native arrangement and shortcuts | `f1ca747` | `2eb79ff` |

## Verification

- `npm run typecheck`: passed.
- `npm test`: 14 tests passed across two files.
- `npm exec playwright test -- tests/canvas-editing.spec.ts tests/canvas-arrangement.spec.ts --project=dev --project=prod`: 40 tests passed, 20 per project.
- The browser harness rebuilt production with `npm run build` and started the production preview. Build passed with the pre-existing bundle-size advisory.
- All browser tests import the automatic console/page-error fixture. Inputs use actual pointer, keyboard and clipboard actions; model inspection is read-only.
- The exclusive browser/build slot was held for this plan. Browser instances used synthetic local content. Existing unrelated configuration/runtime files were preserved.

## Key Bindings and Interaction Evidence

| Binding | Implementation and evidence |
|---|---|
| V / F / S / C / P | Retained installed native select/frame/shape/connector/brush mappings; rail tooltips expose these inspected bindings. UI activation is browser-tested, including Tab and Space activation of Shape. |
| Space + drag | Native temporary pan; viewport center changes are asserted. |
| Middle-button drag | Native temporary pan; viewport center changes are asserted. |
| Control + wheel | Native pointer-centered zoom; model coordinate under the pointer remains stable. |
| Meta on macOS / Control elsewhere + D | Guarded native duplicate; each completed invocation creates a distinct editable model or group subtree. |
| Platform modifier + G / Shift + G | Guarded native group/ungroup; nested membership is asserted. |
| Delete / Backspace | Native canvas deletion retained; rich-text editing preserves field semantics. Delete and undo are asserted after leaving text editing. |
| Platform modifier + Z / Shift + Z | Native history retained; resize undo/redo and deletion undo are asserted. |

## TDD Gate Compliance

- The initial layout assertion failed because the native bottom palette began at x=408 instead of x<120. The final semantic toolbar locator targets the selected left-rail wrapper implementation.
- Duplication failed because modifier+D retained one model instead of creating two.
- Both failures were real named browser assertions, committed before implementation. Their original Playwright output was retained locally and normalized to TAP for the GSD RED-evidence validator; both returned `RED_EVIDENCE_OK`.
- Existing passing native capabilities were tested as regression coverage without manufacturing failing implementations.
- Development editing checks passed before arrangement expansion; the final matrix revalidated both tasks.

## Decisions and Deviations

- The plan explicitly allowed DOM placement or the existing wrapper. Inspection showed the illustrated native toolbar and smooth-corner container depend on horizontal dimensions. The existing rail was used with native tool classes, and the old palette host was hidden. Native contextual style controls remain mounted.
- The viewport oracle subtracts the editor's origin before converting pointer coordinates to model coordinates. HTML sanitization uses script/onclick markup in rich text; the initial image-containing sample exercised native image import instead.
- No dependencies, storage schema, network endpoint or authentication surface changed. No stubs, skipped tests or unrun plan verification commands remain.

## Self-Check: PASSED

Both new browser suites and all five modified source files exist. All four recorded task commits exist. Static checks, unit tests and the development/production matrix passed. No tracked files were deleted.

## Next Plan Readiness

Native editor host signatures and arrangement exports remain available. The rail adapter now receives the mounted host explicitly. Image portability and export plans can reuse these controls and selection behavior.
