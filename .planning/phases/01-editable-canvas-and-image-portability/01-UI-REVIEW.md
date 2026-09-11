# Phase 1 — UI Review

**Audited:** 2026-09-11
**Baseline:** Abstract six-pillar standards and approved D-01 through D-15 in [01-CONTEXT.md](01-CONTEXT.md) (canvas and image-portability decisions).
**Screenshots:** Not captured. The standard development ports and supplied production preview were unreachable from the audit process. Findings are source-based; rendered layouts, responsive behavior and pointer interactions were not observed.

## Pillar Scores

| Pillar | Score | Key finding |
|--------|-------|-------------|
| Copywriting | 3/4 | Actionable input/export guidance; frame scope wording overstates included chrome. |
| Visuals | 3/4 | Clear section hierarchy; resolution recovery uses an unstyled button. |
| Color | 2/4 | Secondary text uses a low-contrast gray on white. |
| Typography | 3/4 | Consistent compact dialog labels; new resolution content bypasses existing type classes. |
| Spacing | 3/4 | Bounded scrolling dialog; selection-padding control lacks explicit layout. |
| Experience Design | 2/4 | Recovery states exist; modal focus containment is missing. |

**Overall: 16/24.** This score measures interface quality in the reviewed source, independently of functional requirement completion. No new failure of the approved canvas or PNG workflow was established by this bounded review.

## Top 3 Priority Fixes

1. **WARNING — Contain export-dialog keyboard focus.** Users can tab beyond a modal declared `aria-modal`. In `src/header/ExportDialog.tsx:240`, add Tab/Shift+Tab containment and make background content inert while open. Retain Escape and the opener-focus restoration already present in `src/header/Header.tsx:26`. Validate both tab directions, retry and dismissal.
2. **WARNING — Increase secondary-text contrast.** `--board-ink-soft: #9c978e` is used for 12px instructions on white (`src/index.css:114`, `895`, `959`). Darken the token and verify rendered contrast of enabled instructions, labels and close controls. Its calculated white-background contrast is approximately 2.9:1, below the conventional 4.5:1 normal-text target. Disabled controls need separate treatment so their explanatory guidance remains readable.
3. **WARNING — Apply existing dialog styles to resolution controls.** The padding field, dimensions, preflight error and lower-scale button (`src/header/ExportDialog.tsx:147–160`) bypass the existing input/message/action styling. Add an explicit label/input/help layout, apply the existing note/error/button classes, and associate help with the field. Check at desktop, tablet and narrow widths.

## Detailed Findings

### Copywriting — 3/4

- **Strength:** Unavailable scopes explain the prerequisite selection (`src/header/ExportDialog.tsx:119`). Image failures specify accepted formats and limits (`src/canvas/image-input.ts:9–13`, `40–42`). Export labels expose scale, pixel dimensions and background behavior (`src/header/ExportDialog.tsx:123–170`), supporting D-07 through D-11.
- **WARNING:** The selected-frame hint says “The selected frame and the content inside it” (`src/header/ExportDialog.tsx:106`), while the approved implementation omits frame title/border. Use “Content inside the selected frame, cropped to its edges.” This is copy alignment, not a request to change D-15 behavior.

### Visuals — 3/4

- **Strength:** Separate format, area and resolution sections and a primary Download action provide source-level hierarchy. Icon-only close/properties controls have accessible names (`src/header/ExportDialog.tsx:272`; `src/canvas/SelectionInspector.tsx:241`, `278`).
- **WARNING:** The explicit lower-scale recovery action has no existing action class (`src/header/ExportDialog.tsx:160`), while the main action uses `djai-primary`. Apply the existing secondary-button treatment so the supported recovery route is distinguishable. Actual prominence remains unverified without screenshots.
- Neutral canvas and limited primary actions are structurally appropriate for D-01/D-02; source inspection cannot establish a rendered 60/30/10 distribution or toolbar overlap.

### Color — 2/4

- **Strength:** Shared CSS variables cover canvas, text, structure, accent and status (`src/index.css:20–62`); native and React controls reuse them.
- **WARNING:** Enabled section headings, radio descriptions and notes use `--board-ink-soft` against `--board-surface` white (`src/index.css:870–898`, `959–963`). The low contrast affects instructions required to choose a valid export. This is the principal color defect, rather than arbitrary palette preference.
- **WARNING:** Disabled radio rows apply opacity to the whole row, including the instruction explaining how to enable it (`src/index.css:901–904`). Keep the disabled input distinguishable while retaining readable prerequisite text.
- Tailwind accent-class counts are inapplicable to this CSS-based implementation. Hardcoded palette definitions are centralized tokens, not independently a defect. No rendered element-count or color-area claim is made.

### Typography — 3/4

- **Strength:** Dialog titles, option labels and helper text reuse 17px, 13px and 12px tokens (`src/index.css:844–898`), providing a compact hierarchy.
- **WARNING:** New dimensions and padding-help content use unclassified paragraph/span elements (`src/header/ExportDialog.tsx:147–159`), unlike the established `djai-note` treatment. Normalize these to the existing dialog type hierarchy. The 1.3rem close glyph (`src/index.css:850`) is an icon-size exception; it does not justify broad type redesign.
- Global CSS contains more than four font sizes and weights including 300, 600 and 700, partly in inherited library/template previews. Those unrelated surfaces are not treated as Phase 1 contract failures.

### Spacing — 3/4

- **Strength:** The panel has bounded width, 90vh maximum height and vertical scrolling (`src/index.css:825–835`); action rows wrap (`934–937`).
- **WARNING:** Selection padding places label text, a number input and help span inline without a dedicated layout (`src/header/ExportDialog.tsx:147–151`). Provide a column/grid and constrained input width, then inspect wrapping on narrow screens.
- Existing dialog spacing spans 0.15rem helper gaps, 0.4rem action gaps, 0.5rem section gaps, 0.55rem option gaps, 0.6rem option padding, 0.9rem panel gaps and 1.1rem panel padding (`src/index.css:829–937`). These are an inherited fine-grained scale, not evidence of broken layout. Routine consolidation can accompany the padding-control fix; a redesign is unnecessary.

### Experience Design — 2/4

- **Strength:** Export tracks busy/error/success, disables repeated downloads, preserves explicit lower-scale consent and only shows download success after dispatch (`src/header/ExportDialog.tsx:23–46`, `159–170`). Invalid PNG plans disable download. Empty/unavailable selections explain recovery. Input validation gives bounded actionable failures (`src/canvas/image-input.ts:40–65`).
- **WARNING:** The modal focuses its container and supports Escape, but has no Tab trap or background-inert behavior (`src/header/ExportDialog.tsx:240–269`). This is a substantive keyboard accessibility gap. Source does not establish that it prevents completion of a core Phase 1 workflow, so it is not classified as a functional blocker.
- **WARNING:** Preflight-invalid Download uses the same `cursor: wait` as an active export (`src/index.css:928–931` and `src/header/ExportDialog.tsx:168`). Separate busy and invalid states so an invalid selection does not appear to be processing.

## Scope and Validation Limits

- D-01 through D-15 remain the behavior baseline; spacing and labels were explicitly left to implementation. No broader capability or branding redesign is recommended here.
- Existing plan summaries report native editing, image handling and downloaded PNG checks. The orchestrator separately reports 35 targeted checks. Those results were not rerun or independently reproduced in this UI audit.
- OS file-manager drop, picker cancellation and native clipboard UAT remain pending according to the phase evidence. Constructed-event results do not close those OS-input checks.
- No screenshots were captured, so mobile/tablet geometry, keyboard traversal and computed rendered contrast remain verification follow-ups. The screenshot ignore gate was installed before any possible capture.
- Registry check: `components.json` is absent; the conditional shadcn registry audit does not apply.
- Findings: three priority fixes and three additional minor recommendations (frame copy, disabled explanatory text, invalid-state cursor). Typography/spacing/action-style findings are grouped under priority fix 3, not counted again.

## Files Audited

- `AGENTS.md` (privacy and contribution rules).
- `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` (scope, acceptance requirements and sequencing).
- `01-CONTEXT.md`, `01-01-PLAN.md` through `01-05-PLAN.md`, `01-01-SUMMARY.md` through `01-05-SUMMARY.md` (approved decisions and implementation evidence; targeted plan/summary extraction).
- `src/header/ExportDialog.tsx` (export options, status and modal interaction).
- `src/header/Header.tsx` (export entry and focus restoration).
- `src/index.css` (theme and dialog styles).
- `src/canvas/image-input.ts` (image validation and recovery copy).
- `src/canvas/SelectionInspector.tsx` (contextual control labels and actions).
- `src/App.tsx` (initial loading state).
