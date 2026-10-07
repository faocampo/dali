# Phase 2 — UI Review

**Audited:** 2026-09-13
**Code baseline:** `e52dab1`
**Design baseline:** [02-UI-SPEC.md](02-UI-SPEC.md) (approved mind-map visual and interaction contract)
**Initial verdict:** WARNINGS — 19/24; no demonstrated task-completion blocker in this visual review.
**Post-correction visual score:** 22/24 — selected-topic and control collisions corrected; minor copy/color advisories remain. See the correction evidence below.

## Method and Evidence Boundary

Adaptation: the orchestrator reused the plan executor thread because session agent slots were exhausted. The GSD UI review skill, workflow and UI-auditor role instructions were read and applied inline; this is not an independently spawned auditor context. The initial audit was read-only apart from this report. The orchestrator subsequently authorized the narrow corrections documented below.

The screenshot safety gate verified the existing image ignore rules in `.planning/ui-reviews/.gitignore` before capture. Fresh ephemeral Chromium contexts loaded the local production preview and created only synthetic Release plan, Research, Design and Review topics. Five captures were inspected: empty desktop, populated desktop, desktop resized to narrow, fresh narrow editing and fresh narrow committed selection. Images remain outside repository content; no existing user boards or user image files were opened.

Desktop sample: 1280×800. Narrow sample: 390×844. The narrow fixture was also created from a fresh context at its initial width, so the overlap finding does not depend on resizing an existing board. CLI Playwright was used; no persistent browser or UI connector was used. The supplied final 604/604 browser, 67/67 unit, typecheck and build results were accepted as prior execution evidence; the full suite was not repeated.

## Initial Pillar Scores

| Pillar | Score | Specific finding |
|---|---|---|
| Copywriting | 3/4 | Required action, error and state copy is present; Style 1–4 gives little preview of the visual choice. |
| Visuals | 2/4 | The full panel covers the selected topic after editing ends, and an additional generic Shape inspector competes with it. |
| Color | 3/4 | Readable ink, neutral surfaces and measured focus contrast match the contract; accent also marks layout direction beyond the declared accent uses. |
| Typography | 4/4 | New chrome uses the specified 12/13/15/20px roles, 400/600 weights and line heights. |
| Spacing | 4/4 | New panel respects 8px safe insets, 16px padding, 4/8px field gaps, 44px controls and scrollable overflow. |
| Experience Design | 3/4 | Creation, state feedback and dismissal work; committed selection loses visibility when the editing panel expands. Native human evidence remains pending. |

**Overall: 19/24**

## Top 3 Priority Fixes

1. **WARNING — Preserve selected-topic visibility when the panel expands.** After Enter, rerun panel-versus-topic collision handling for the selected topic using the final panel rectangle, retaining canvas zoom. Check both horizontal and vertical overlap before minimal panning. Add a real browser assertion that the selected topic rectangle has an 8px gap from the panel after Enter at desktop and narrow widths.
2. **WARNING — Show one contextual inspector for a single native mind-map topic.** Suppress the generic Shape properties panel for that selection while retaining relevant ordinary-object actions and the explicit Layers panel. Subscribe the decision to native selection changes so ordinary shapes and mixed selections retain their existing inspector behavior.
3. **WARNING — Make the four style options visually identifiable.** Retain the accessible Mind-map style group and pressed states, and add compact native-style previews or descriptive labels. Keep the existing native preset identities and typography-preservation behavior.

## Detailed Findings

### 1. Copywriting — 3/4

**Verified:** `src/canvas/MindMapInspector.tsx:41` implements the exact empty-state heading/body; lines 65–70 implement Add child, Add sibling and singular/plural branch names; lines 93–96 provide the exact root explanation, editing hint, alert and polite announcement. `src/canvas/mindmap.ts:9` defines the agreed creation/edit/layout errors. `src/header/ExportDialog.tsx:160` displays the exact conditional visible-export hint.

**WARNING C1:** `src/canvas/MindMapInspector.tsx:89` presents only Style 1 through Style 4. These satisfy selection-state semantics but give no indication of each preset before application. Add a native visual sample or descriptive option name; this is a usability recommendation rather than a missing required string.

### 2. Visuals — 2/4

**WARNING V1 — Reproducible selected-topic occlusion:** At fresh 390×844, create Release plan and press Enter. The selected topic occupied view rectangle x=112, y=426, w=166.285, h=45; the expanded panel began at y=456.5, x=8, w=374, h=379.5. Their vertical intersection is 14.5px, visibly covering the topic's lower edge and part of its text. At 1280×800, create root, child Research, sibling Design and child Review through actual context actions; committing Review expands the bottom-right panel over the active branch area. The canvas focal point is lost behind chrome.

Cause: `src/canvas/MindMapInspector.tsx:29` exits collision handling whenever `editing` is false, while `src/index.css:46` hides the large action sections only during editing. The panel grows after Enter without applying the visibility adjustment. Editing itself remained visible in the fresh narrow capture. The Close action provides recovery, so this finding is a warning rather than a demonstrated blocker.

**WARNING V2 — Duplicate contextual presentation:** `src/canvas/BlockSuiteCanvas.tsx:87` mounts MindMapInspector alongside SelectionInspector at line 90. Both synthetic desktop and narrow captures show a generic Properties → Shape → Shape selected panel above the mind-map panel. It supplies little additional context for the topic while occupying valuable canvas area. Consolidate the single-topic presentation; preserve ordinary shape and image workflows.

The empty desktop otherwise has a clear starting action, readable guidance and the preserved native canvas visual language.

### 3. Color — 3/4

**Verified:** `src/index.css:19` uses #1b1a18 on white; lines 41–43 define restrained selected, focus and disabled treatments. Existing rendered contrast assertions in `tests/mindmap-accessibility.spec.ts:111` check 4.5:1 text and 3:1 control/focus indicators. Synthetic captures show neutral canvas and panels dominating the chrome; authored branch colors remain native content. No exact pixel-area 60/30/10 ratio is claimed.

**WARNING C2 — Small contract deviation:** the generic `[aria-pressed="true"]` rule at `src/index.css:41` also accents Right/Left/Balanced controls (`MindMapInspector.tsx:72`). The contract reserves accent for active tool, selected style and focus. Either include selected layout direction in the approved accent role or use a neutral selected treatment for direction. This does not impair operation or contrast.

### 4. Typography — 4/4

**Verified finding T1:** `src/index.css:22` establishes 15px/400/1.5 body text; line 28 uses 20px/600/1.2 headings; line 32 uses 13px/600/1.5 controls; line 44 uses 12px/400/1.5 hints, with 15px alerts at line 45. The narrow rendered panel measured 15px body and 22.5px line height. Canvas topic font choices are authored content, separate from the chrome scale. No typography-specific defect was found in the inspected samples.

### 5. Spacing — 4/4

**Verified finding S1:** `src/index.css:8` and line 11 enforce safe inset and bounded width; line 16 gives 16px panel padding. Lines 26–35 use 4/8/16px spacing and minimum 44px control dimensions. The fresh narrow panel measured x=8, right=382 and bottom=836, meeting all 8px viewport insets. Overflow is scrollable: sampled content height 477px versus 378px client height. All new controls remain reachable by scrolling and keyboard in the supplied accessibility suite. No spacing-token defect was found; V1 concerns panel placement rather than its internal spacing.

### 6. Experience Design — 3/4

**Verified:** initialization has a truthful Opening board status (`BlockSuiteCanvas.tsx:84`); actions expose scope, native selected states and lock/edit disabled states; Close returns focus to the host (`MindMapInspector.tsx:59`). Exact preserved-state failure/retry, nested collapse, undo and export evidence is recorded in the six execution summaries. The current panel exposes full topic text, parent and level without claiming an incomplete ARIA tree pattern.

**WARNING E1:** committing text changes panel geometry and obscures selected content, as measured in V1. Reuse one collision policy for editing and selected states, and assert zoom retention and unrelated-model immutability when panning.

**Inherited narrow-shell observation:** the fresh 390px capture clips the right edge of the existing Export header action and shows overlapping generic chrome. The mind-map panel itself fits its safe inset. Treat header layout as inherited shell review scope; this audit makes no source-regression claim for it.

## Pending Human Evidence

The following remain pending, explicitly distinct from automated UI results:

- Real browser 200% zoom on desktop and narrow samples. CSS zoom 2× tests establish layout magnification only.
- Native OS IME production, composition commit and shortcut behavior.
- Firefox/WebKit native OS clipboard copy/paste. Their simulated clipboard boundary exercises native MIME/paste handling but does not establish OS integration.
- Human interaction-feel acceptance of the daily mind-map workflow.

No pending item is marked passed by this report. Registry audit is not applicable: no `components.json` or third-party registry blocks are used.

## Authorized Corrections and Recheck

The initial findings above remain as the reproducible audit record. Following explicit orchestrator authorization, the scoped implementation now:

- Checks actual topic/panel intersection for both editing and committed selection, then pans the viewport vertically at retained zoom. It leaves model geometry untouched.
- Shows Object actions without a duplicate generic properties inspector for a single native topic. The hidden generic inspector's Escape listener is inactive for that selection. Ordinary shapes and images retain their existing inspector path.
- Places the single-topic Object actions trigger at the top-right 8px inset with a 44px target. An additional real narrow-screen overlap assertion first failed because the previous bottom trigger covered Font weight; the scoped placement corrects that collision.

**RED evidence:** the new desktop test expected clear topic/panel rectangles and received false; the narrow test expected zero generic properties panels and received one. The added narrow Object actions/Font weight separation assertion independently expected true and received false before its placement change. Behavioral assertions were retained.

**Actual visual recheck:** fresh synthetic desktop and narrow captures show the selected root fully visible, one contextual inspector, and the action trigger clear of formatting controls. At 390×844 the topic now spans y=395.5 through 440.5 while the panel begins at 456.5, a 16px gap; canvas zoom remains 1. At 1280×800 the root retains its position because its rectangle does not intersect the panel. Both captures show zero generic properties panels.

**Final focused validation:** typecheck and production build passed. The final accessibility matrix passed **36/36** in 48.5 seconds (9 cases each across dev Chromium, production Chromium, Firefox and WebKit). The final production regression passed **25/25** in 19.5 seconds: six ordinary canvas editing cases, nine image visual-edit cases and ten mind-map keyboard cases. Runtime-error gates remained enabled. These results supplement the earlier full-phase gate; no new full-suite aggregate is claimed after the review corrections.

| Pillar | Final score | Recheck disposition |
|---|---|---|
| Copywriting | 3/4 | C1 style-option guidance remains advisory. |
| Visuals | 4/4 | V1 and V2 corrected; floating-trigger collision also corrected in the inspected samples. |
| Color | 3/4 | C2 accent-role alignment remains advisory. |
| Typography | 4/4 | Original compliant scale retained. |
| Spacing | 4/4 | Safe insets, scrolling and control targets retained. |
| Experience Design | 4/4 | E1 corrected; native human evidence remains pending without being inferred from automated checks. |

**Final score: 22/24.** Inherited narrow header clipping remains a separate shell observation.

## Implementation Scope

- `src/canvas/MindMapInspector.tsx`: collision handling for committed selection using intersecting view rectangles; viewport panning only.
- `src/canvas/SelectionInspector.tsx`: suppress only generic single-topic properties, retaining object-action access and ordinary/mixed selection behavior.
- `src/canvas/ObjectContextMenu.tsx`, `src/index.css`: optional scoped top placement for the retained single-topic action trigger.
- `tests/mindmap-accessibility.spec.ts`: root/child separation after Enter, one inspector, action-trigger separation and ordinary-inspector restoration at 1280×800 and 390×844.

No commits were made by this reviewer; changes are handed to the orchestrator for final review.

## Files Audited

- `src/canvas/MindMapInspector.tsx`, `src/canvas/BlockSuiteCanvas.tsx`, `src/canvas/SelectionInspector.tsx`
- `src/canvas/mindmap.ts`, `src/index.css`, `src/header/ExportDialog.tsx`
- `tests/mindmap-accessibility.spec.ts`
- `02-UI-SPEC.md`, execution summaries `02-01` through `02-06` (prior executor context for 01–04), and supplied final validation results

## Explicit Properties correction — 2026-09-14

User feedback supersedes automatic panel opening and the earlier bottom-panel proposal. Commit `28329b3` opens Properties only from the selected topic context menu and uses the existing right-side SelectionInspector shell. Editing closes it and subsequent Tab or selection does not reopen it.

Executor and orchestrator inspected final synthetic 1280×800 and 390×844 views. The selected topic is fully inside the narrow viewport below the pane, with 16px separation; desktop positions it 16px left of the pane. Controls remain scrollable. Existing narrow header clipping remains a prior advisory. No new score is inferred from this focused correction.

Final 392/392 mind-map cases and 40/40 ordinary/keyboard regressions pass, together with 67/67 units, typecheck and build. Native browser magnification remains pending human evidence. See 02-07-SUMMARY.md for revision and test provenance.

## Native More correction — 2026-09-14

Object actions now appears as a styled submenu entry in the native selection More menu. The standalone canvas trigger is removed; single selections omit alignment entries. A synthetic desktop capture was inspected and submenu geometry/keyboard behavior and narrow toolbar reachability passed in the 204-case browser matrix. The sidebar interaction remains explicit. See 02-08-SUMMARY.md; prior scores and native magnification limitations retain their historical scope.


## Mind-map behavior correction — 2026-09-14

Plan 02-09 retains the explicit Properties sidebar and native More submenu. New topics continue the selected typography. Locked topics remain reachable by right-click after deselection; context and native Unlock actions resolve the actual lock owner. No new visual score is inferred. The focused behavior retest and earlier native magnification/IME/clipboard checks remain in 02-UAT.md. Final automated evidence is recorded in 02-09-SUMMARY.md.
