---
phase: "2"
slug: "daily-mind-maps"
status: approved
reviewed_at: "2026-09-12T21:10:36Z"
shadcn_initialized: false
preset: none
created: "2026-09-12"
---

# Phase 2 — UI Design Contract

This draft defines the proposed visual and interaction defaults for MIND-01 through MIND-04. The requirements and phase allocation are approved; the detailed defaults below are research proposals for planning. The UI checker approved the contract; runtime implementation remains pending.

## Sources and Decision Status

- [REQUIREMENTS.md](../../REQUIREMENTS.md) (approved mind-map requirements and validation boundaries) supplies hierarchy, keyboard creation, preserved collapsed content, automatic layout, and formatting obligations.
- [ROADMAP.md](../../ROADMAP.md) (Phase 2 success criteria and later persistence/collaboration allocation) bounds this phase to MIND-01–04.
- [PROJECT.md](../../PROJECT.md) (product scope and decision authority) and [STATE.md](../../STATE.md) (accepted Phase 1 visual and storage foundation) establish reuse of the existing canvas.
- [SEED-003](../../seeds/SEED-003-dali-brand-assets-and-naming.md) (deferred branding work) remains dormant until UI/UX completion.
- [src/index.css](../../../src/index.css) (current theme variables), [BlockSuiteCanvas.tsx](../../../src/canvas/BlockSuiteCanvas.tsx) (accessible left rail), and [extensions.ts](../../../src/canvas/extensions.ts) (explicit native registrations) establish the existing presentation and integration seams.
- Installed BlockSuite 0.22.4 source, inspected on 2026-09-12, supplies native layout and mind-map controls. Reproduce the resolved version with `node -p "require('./node_modules/@blocksuite/affine/package.json').version"`. Native details are coordinated with [02-RESEARCH.md](02-RESEARCH.md) (technical findings and implementation risks).

No phase CONTEXT.md exists. Routine defaults are proposed under the user's authorization to research and propose them. All references to covered states below describe required implementation behavior, rather than completed verification.

The selected topic is the active visual anchor; the root anchors an unselected map. Contextual controls remain subordinate to canvas content.

## Design System

| Property | Value |
|----------|-------|
| Tool | none; existing manual CSS theme |
| Preset | not applicable |
| Component library | Existing BlockSuite 0.22.4 canvas widgets and HTML/React application controls |
| Icon library | Existing native BlockSuite icons and inline SVG control convention |
| Font | Existing `--affine-font-family` system sans-serif for application chrome; native map presets for authored canvas text |

The repository has no components.json. Retain the established manual/native system under the explicit preservation instruction; introducing shadcn is outside this contract. Registry initialization and vetting are not applicable. A packaged design-system component inventory is omitted because Tool is none.

Use the existing left rail for one accessible **Add mind map** entry. Register the native store and view extensions and use their contextual controls. Add compact application controls only where a native control cannot meet a specified interaction or accessibility obligation. Keep branding, other canvas tools, image controls, and existing header treatment consistent with Phase 1.

## Spacing Scale

Proposed values for new application chrome:

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon-to-label gaps and inline spacing |
| sm | 8px | Toolbar padding, control gaps, viewport safe inset |
| md | 16px | Inspector padding and related field groups |
| lg | 24px | Inspector sections |
| xl | 32px | Section separation |
| 2xl | 48px | Large empty-state separation |
| 3xl | 64px | Reserved major layout spacing |

Exceptions: new icon buttons have a minimum 44px pointer target at normal UI scale. Native mind-map model-space spacing remains its existing 45px vertical, 110px horizontal, and 200px first-level horizontal values, as defined by `node_modules/@blocksuite/affine-gfx-mindmap/src/view/layout.ts` (native tree layout). These engine geometry constants are separate from chrome spacing tokens. Retain native node padding and curve geometry; do not change the layout engine solely to normalize its spacing.

## Typography

Four sizes and two weights for new application chrome; inherit the existing font stack.

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Count / shortcut hint | 12px | 400 | 1.5 |
| Control label | 13px | 600 | 1.5 |
| Body / error | 15px | 400 | 1.5 |
| Panel heading | 20px | 600 | 1.2 |

These values reuse current theme sizes and constrain additions only. Native canvas preset typography remains authored content: use native style ONE initially, preserve its hierarchy, and retain user-selected node formatting through subsequent layout. The typography table is not a migration of existing global CSS or an allowlist for authored text.

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#f1f0ed` | Existing canvas paper surface |
| Secondary (30%) | `#ffffff`, `#f7f6f3` | Existing toolbars, panels, secondary surfaces |
| Accent (10%) | `#b4451f` | Active mind-map tool, selected style option, keyboard focus indication |
| Destructive | `#b23b32` | Delete actions; existing error token also retained for failure messaging |

The 60/30/10 distribution is a chrome composition target. Accent is reserved for the active tool, selected style option, and focus indication. Body and control text use `#1b1a18`; essential hints use this readable ink rather than the existing pale secondary text token. Canvas content retains native mind-map preset colors and user styling. Branch color alone must never carry hierarchy or selection meaning: preserve connectors, labels, geometry, and focus/selection outlines.

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | Add mind map |
| Empty state heading | Start a mind map |
| Empty state body | Add a mind map, then name the central topic. Select a topic and press Tab to add a child or Enter to add a sibling. |
| Root initial editable text | Central topic |
| New node initial editable text | New topic |
| Child action | Add child |
| Sibling action | Add sibling |
| Root sibling explanation | The central topic has no sibling. Enter adds a child. |
| Editing hint | Enter finishes editing. Shift+Enter adds a line. Esc returns to topic selection. |
| Collapse action | Collapse branch |
| Expand action | Expand branch |
| Collapsed badge accessible name | Expand branch: {N} direct branch hidden / Expand branch: {N} direct branches hidden |
| Collapse announcement | Branch collapsed. {N} direct branch hidden. / Branch collapsed. {N} direct branches hidden. |
| Expand announcement | Branch expanded. |
| Formatting scope | Topic text |
| Style scope | Mind-map style |
| Loading | Opening board… |
| Creation error | The mind map could not be added. Try Add mind map again. |
| Edit error | This change could not be applied. Your previous topic is still available. Try again. |
| Layout error | The mind map could not be arranged. Try Arrange mind map again. |
| Layout retry | Arrange mind map |
| Export hint | Only visible topics are exported. Expand branches to include their hidden topics. |
| Delete leaf | Delete topic — immediate reversible action through existing Undo |
| Delete branch or root | Use native reversible hierarchy-safe deletion. Undo restores the complete deleted subtree, including collapsed descendants. |

Counts use singular/plural grammar. Destructive counts include nested and collapsed descendants. Error copy promising the previous state requires an atomic failure path; if the implementation cannot preserve it, the planner must resolve that gap before exposing the action.

## Interaction Contract

### Creation and selection

Add mind map creates one native map at the viewport center and places the central topic in text-editing mode with its initial text selected. Repeated invocation deliberately creates another independent map. Never insert canned branches or synthetic example content into the user's board. A single click selects a topic; double-click or the native text-edit action edits its text. The selected topic has a visible outline, and contextual actions clearly identify topic scope versus whole-map scope.

Use the existing pointer, viewport, history, and selection services. Selection must preserve native topic IDs. Context controls retain selection while receiving focus, and closing a contextual panel returns focus to its invoking control or selected visible topic.

### Keyboard and focus

| Focus state | Input | Required behavior |
|-------------|-------|-------------------|
| One mind-map topic selected; canvas focused | Tab | Add a child, reveal its branch if collapsed, and edit the new topic |
| One non-root topic selected; canvas focused | Enter | Add a sibling after the selected topic and edit it |
| Root selected; canvas focused | Enter | Add a child; show root-specific shortcut explanation |
| Topic text editor focused | Enter | Commit text and return to topic selection |
| Topic text editor focused | Shift+Enter | Insert a line break |
| Topic text editor focused | Tab | Finish editing and leave edit mode; create zero nodes |
| Topic text editor focused | Esc | Finish editing with current content retained; return to selected topic |
| Input, textarea, contenteditable outside the map, dialog, or menu focused | Tab / Enter | Preserve that control's own behavior; create zero nodes |
| IME composition active, including its terminating Enter | Any creation shortcut | Create zero nodes and preserve composed text |
| Multi-selection or unrelated object selected | Tab / Enter | Preserve existing canvas behavior; create zero mind-map nodes |

Ignore repeated keydown events for creation until keyup. Gate handling through the actual composed event path across shadow roots and composition state. Keyboard activation through Add child/Add sibling buttons must have the same result as shortcuts. Root sibling button is disabled with its explanation; Enter remains the documented root-child convenience.

Provide a keyboard escape from canvas creation mode: Esc clears active topic selection; Tab then advances through normal chrome focus. Shift+Tab must remain available to leave canvas focus. Context buttons support ordinary Tab navigation; arrows retain native tree navigation where available. Expose selected topic text and parent/level context to assistive technology through the focused topic or an associated live region; do not use `role="tree"` unless the complete corresponding keyboard pattern is implemented.

### Collapse, counts, and automatic layout

Use native branch-collapse controls, visible on selected/focused branch nodes and reachable through the contextual Collapse branch/Expand branch action. Leaf nodes expose no collapse action. The root may collapse its children while remaining visible.

Preserve the native badge's direct-child count. The tooltip and accessible name explicitly say direct branches, so a badge showing 2 may represent two branches containing many deeper descendants. Hidden descendant text, IDs, styles, and hierarchy remain intact. Nested collapsed flags survive expanding an ancestor. Repeated toggles produce no duplicate nodes or connectors.

Collapse moves any affected selected descendant and keyboard focus to the visible ancestor being collapsed. Expansion retains selection on that ancestor. Hidden descendants must be absent from pointer hit testing, marquee selection, keyboard navigation, visible bounds, and export rendering. Any exposed Layers list must reflect visibility and cannot select an invisible descendant without first revealing its ancestors.

Default layout is native rightward. Preserve native leftward and balanced controls if exposed, clearly labeled Right, Left, and Balanced. Layout responds to additions, text-size changes, deletions, and collapse/expand while keeping the root anchored. Unrelated canvas objects retain their positions. New topic creation pans only as needed to reveal the focused topic, retaining zoom. Automatic layout uses visible measured bounds, routes connectors to their correct parent, and does not require a manual refresh.

Use immediate layout updates; animation is optional only if it preserves input continuity and respects reduced-motion preferences. Long multiline labels grow their measured geometry rather than overlap sibling text. Keep native wrapping/resize behavior, and test a long unbroken token explicitly.

### Formatting and branch styles

Expose native whole-map style presets with an accessible selected state and a Mind-map style label. Applying a preset changes branch connector/palette treatment consistently across the map and leaves topic identities, text, ordering, and collapse flags intact. This whole-map styling is the proposed MIND-04 branch-style scope; individual connector editing is outside the required default.

Expose Topic text controls for selected-topic font size and weight using native shape formatting where possible. Apply to the selected topic only. Subsequent node addition, edit, collapse, expansion, layout direction changes, and reload must retain explicit topic formatting. A whole-map preset may change inherited defaults but must preserve explicit topic overrides. Because native layout can reapply presets, the preservation seam is a required implementation check, not assumed native behavior. Keep generic grouping and arrangement actions from corrupting hierarchy.

### Accessibility and responsive behavior

All new actions have accessible names, visible focus, and labels independent of icon shape. Toggle buttons expose expanded/pressed state; style options expose selection. Collapse changes announce concise state through a polite live region; failure messages use an alert. New control text targets 4.5:1 contrast and focus/control indicators target 3:1 against adjacent surfaces; verify rendered values rather than assume theme tokens satisfy them.

At narrow viewports, keep the left rail scrollable and contextual panels within an 8px safe inset, with vertical scrolling for overflow. Never place the focused editor behind its panel; move the panel or minimally pan the topic. Verify at 1280×800 and 390×844, at 100% and 200% browser zoom, and at a zoomed-out canvas scale. Badge pointer targets can extend beyond their visual glyph without covering the topic edit target. Preserve native pan and zoom gestures.

### Local reload, errors, and export boundaries

Reuse the existing browser-local save/status mechanism and preserve its truthful local wording. Validate reload in the same browser as a Phase 1 regression: all nodes, explicit formatting, hierarchy, and collapse state reopen correctly. Native collapse metadata and hidden flags are persisted document fields; the proposed default retains them as board content. A later collaboration phase must explicitly assess their shared behavior before adding synchronization. A personal collapse preference would require a separate view-state design.

Opening a board disables mutation controls until the native editor is ready. A failed edit retains the last consistent map and gives the relevant retry action. Layout retry operates on existing nodes without duplicating them. Malformed map data must fail visibly and preserve unrelated board content, rather than delete or silently flatten the tree.

Preserve existing whole-board, frame, and selected-object PNG behavior. For a selected map, include its visible topics and visible connecting branches. For selected topics, include only selected visible topic objects and connectors whose selected visible endpoints establish inclusion; respect existing explicit selected connector behavior. Hidden descendants and connectors to them are excluded from scope, bounds, and pixels. Clip frame output as before. Interactive handles and collapse badges stay out of PNG output; show the Export hint whenever collapsed content is in export scope. The exported image expresses the current visible map. Verify the actual native raster path, since visibility and DOM overlays may differ between live canvas and PNG.

## UI Considerations

Applicable state considerations resolved: 8 covered, 0 backstop, 0 unresolved. Covered means resolved in this contract; implementation evidence remains required.

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | mind-map collection / topic editor | ✅ covered | Empty boards retain the normal canvas and Add mind map action with the empty-state copy; one new root opens editable initial text. Empty committed topic text remains a valid editable topic and retains its geometry. |
| loading | board / creation control | ✅ covered | Reuse Opening board copy while initializing; prevent insertion until the host is ready. Local completed actions do not show artificial loading delays. |
| error | creation / edit / layout / export | ✅ covered | Show relevant Copywriting Contract failure and retry actions; preserve previous content and existing export error handling. |
| populated | hierarchical topics and connectors | ✅ covered | A root, multiple branches, and nested descendants render connected and editable; selection and style scope remain explicit. |
| partial | unfinished labels / mixed formatting / malformed tree | ✅ covered | Empty or unfinished labels remain editable; mixed text formatting is retained; malformed hierarchy surfaces an error without silent deletion or flattening. |
| overflow | canvas / contextual controls / Layers | ✅ covered | Canvas pans to focused topics at retained zoom; panels fit viewport and scroll; hidden nodes cannot remain selected invisibly. |
| zero-one-many | child branches and badges | ✅ covered | Leaf has no toggle; one child uses singular copy; multiple children use plural direct-branch counts; nested descendants remain preserved. |
| long-text | topic editor / node / alert | ✅ covered | Text wraps or grows measured node bounds; native layout separates visible nodes; alerts wrap within viewport; full topic text remains accessible. |

## Implementation-Verifiable Checks

| Check | Evidence required |
|-------|-------------------|
| MIND-01 creation | Native UI creates root, child, and sibling with correct parent IDs; root Enter produces one child; repeated keydown and multi-selection produce no accidental duplicates. |
| Focus and IME | Browser tests exercise composed shadow-root events, text-editor Tab/Enter/Shift+Enter, external inputs, Esc exit, context-button focus, and composition start/update/end plus terminating Enter. Record any OS IME validation still needing human evidence. |
| MIND-02 preservation | Compare full node IDs, text, formatting, and hierarchy before collapse and after expansion, including nested collapsed branches. Assert direct-child badge wording and focus relocation. |
| MIND-03 layout | Measure visible node bounds and connector endpoints after additions, multiline edits, deletion, collapse/expand, and direction change; assert root/unrelated-object anchoring and absence of sibling overlap. |
| MIND-04 formatting | Change a topic size/weight and map preset; perform another edit and collapse/expand; compare explicit overrides and map topology. |
| Local reload | Same-browser reload preserves full map data and current collapse state; report evidence separately from later durable/collaborative requirements. |
| Visibility and PNG | At least one nested collapsed fixture compares live canvas, selection/hit testing, Layers, bounds, and rendered board/frame/selection PNG pixels. Verify connectors, excluded badges, and untouched unrelated objects. |
| Robustness and accessibility | Exercise empty label, 200-character label, 120-character unbroken token, 30 siblings, and depth 10; keyboard focus and pointer targets remain usable at the specified viewport/zoom samples. Include rendered contrast checks and accessible name/state assertions. |
| Failure recovery | Inject creation/layout failures before committing a mutation; assert stable prior data, visible error, successful retry, and no duplicate topics. |
| Phase 1 regressions | Run relevant existing selection, arrangement, image import/export, local history, and reload checks after native extension registration. |

Fixtures use synthetic topics such as Release plan, Research, Design, and Review. Record automated results and any human-only limits separately. No implementation or runtime acceptance is claimed by this document.

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| None | None | Not applicable: existing local/native UI, no registry blocks introduced |

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS
- [x] Dimension 7 Inventory Provenance: PASS / not applicable to Tool none

**Approval:** UI checker passed all seven dimensions on 2026-09-12. Interaction defaults remain proposals authorized for planning.
