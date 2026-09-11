# Phase 1: Editable Canvas and Image Portability - Context

**Gathered:** 2026-09-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the editable canvas, object arrangement, local image imports, whole-board image export, and selection-only image export defined by CAN-01, CAN-02, IMG-01, IMG-02, and IMG-03. Incorporate and validate the upstream foundation while preserving applicable attribution. All repository content and verification fixtures remain organization-neutral and synthetic.
</domain>

<decisions>
## Implementation Decisions

### Canvas controls and layout
- **D-01:** Place drawing tools in a left toolbar.
- **D-02:** Show contextual controls for selected objects.
- **D-03:** Provide familiar shortcuts for selection, pan/zoom, duplication, grouping, and deletion. Exact key bindings require research and implementation validation; no exact keys were specified during discussion.

### Image importing
- **D-04:** Support file-picker import, drag-and-drop, and clipboard paste.
- **D-05:** Preserve imported image proportions.
- **D-06:** Place dropped images at the drop location and pasted images near the viewport center.

### Export quality and formats
- **D-07:** Provide PNG export with 1×, 2×, and 4× resolution choices.
- **D-08:** Provide white and transparent background options.
- **D-09:** Show resulting image dimensions before download.
- **D-10:** If an export exceeds supported limits, offer a lower resolution. Determine supported bounds through browser/runtime validation; never silently change the requested resolution or truncate content.

### Selection and frame exports
- **D-11:** Expose whole-board, selected-object, and selected-frame export areas.
- **D-12:** Selection export includes selected groups and their children, excluding other unselected board content.
- **D-13:** Crop selection exports to tight content bounds with optional padding.
- **D-14:** In selection export, connectors appear when selected. Resolve any grouped-connector membership consistently with D-12 during implementation.
- **D-15:** Frame export includes the frame's contents and clips to its boundaries. Frame title/border rendering and crossing-object classification are implementation details to verify against these rules.

### Implementation details left open
Routine choices such as spacing, default padding amount, labels, exact keyboard mappings, and file-picker placement are left to planning within the approved behavior. The user requested a concise discussion and approved the four proposals together. New formats or broader capabilities require scope review; PNG is the approved image format for this phase.
</decisions>

<canonical_refs>
## Canonical References

Paths below are relative to the repository root. Downstream agents must read these before planning or implementing:

- `AGENTS.md` — public-repository privacy boundary and workflow rules.
- `.planning/PROJECT.md` — product scope and execution preferences.
- `.planning/REQUIREMENTS.md` — approved CAN-01, CAN-02, IMG-01, IMG-02, and IMG-03 requirements.
- `.planning/ROADMAP.md` — Phase 1 boundary, success criteria, and later-phase dependencies.
- `.planning/config.json` — agent models and enabled verification workflow.
- `.planning/research/STACK.md` — pinned upstream baseline and compatibility risks.
- `.planning/research/FEATURES.md` — inspected feature evidence and acceptance candidates.
- `.planning/research/PITFALLS.md` — export fidelity and image-handling validation risks.

Public upstream source references:
- DJAI [src/header/ExportDialog.tsx](https://github.com/DJAI-Academy/djai-open-canvas/blob/27f8bb97b10984e04e48d7650d954d0a7ecd212c/src/header/ExportDialog.tsx) — export controls and selected-scope availability.
- DJAI [src/canvas/export-board.ts](https://github.com/DJAI-Academy/djai-open-canvas/blob/27f8bb97b10984e04e48d7650d954d0a7ecd212c/src/canvas/export-board.ts) — export dispatch and download path.
- DJAI [src/App.tsx](https://github.com/DJAI-Academy/djai-open-canvas/blob/27f8bb97b10984e04e48d7650d954d0a7ecd212c/src/App.tsx) — editor shell and board-library integration.

No external specification was supplied for this discussion. Private source material must remain outside public planning and validation artifacts.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Upstream `ExportDialog` exposes PNG, transparency, and board/selection/frame scope controls. Validate and adapt it to D-07 through D-15.
- Upstream `exportBoardFile` delegates rendering to `renderBoardPresentation` and reports pixel dimensions. Extend the proven path for selectable output scales and dimension previews.
- Upstream `App` integrates the canvas, header, and local board library. It is a starting point for the Phase 1 editor shell.

### Established Patterns
- React coordinates a BlockSuite canvas through shared runtime access.
- Export rendering and download dispatch are separated from the dialog.
- Export failures retain an error state and permit retry; success is shown after download dispatch.
- Inspected source declares both PNG and PDF despite an outdated nearby comment describing an earlier single-format implementation. Use executable code and tests as evidence.

### Integration Points
- Adapt the header export entry point, contextual object controls, image input handlers, and presentation renderer.
- Inspect `src/canvas/presentation-export.ts` during research for mixed DOM/canvas rendering, selected-object inclusion, frame clipping, scale, and memory limits.
- Runtime behavior remains unverified; inspect exact upstream revision and APIs before implementation.
</code_context>

<specifics>
## Specific Ideas

Familiar Miro-style editing interactions guide discoverability. The approved export behavior is defined above; public visual tests use generated shapes, text, and synthetic images.
</specifics>

<deferred>
## Deferred Ideas

No new deferred capabilities were introduced. Later phases retain their roadmap allocations, including mind maps, identity, shared persistence, and collaboration. MCP creation and Plane integration remain deferred beyond the initial release.
</deferred>

---
*Phase: 01-editable-canvas-and-image-portability*
*Context gathered: 2026-09-11*
