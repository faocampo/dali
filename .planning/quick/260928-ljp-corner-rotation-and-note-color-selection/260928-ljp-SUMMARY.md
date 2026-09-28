---
status: complete
quick: 260928-ljp
implementation_commit: 0b35555
---
# Corner rotation and note colors

Implemented both requested UI refinements in commit `0b35555`.

## Behavior

- Native rotatable selections show a visible 26-pixel rotation grip outside the bottom-right corner. Dragging it rotates the selection; the inner circle continues to resize. Native rotation, history, persistence, locking and read-only constraints remain authoritative. Text and shape rotation were exercised directly. Notes and frames retain their native resize-only constraints.
- The Notes tool opens a palette before inserting anything. Yellow, orange, red, magenta, purple, blue, green and white use the native note colors. Choosing one inserts a note in available viewport space. Escape and outside click dismiss without insertion. Arrow keys, Home/End and Enter support color selection; the last color receives focus the next time the palette opens in that mounted canvas.
- Existing browser setups now explicitly choose Yellow through a shared UI helper instead of assuming immediate insertion. No assertions were weakened.

## Validation

- TypeScript: passed (`npm run typecheck`).
- Production build: passed as part of the browser test server startup.
- Client unit tests: 236/236 passed across 20 files.
- Focused browser tests: 54/54 passed, 18 each in Chromium, Firefox and WebKit, in 2.8 minutes.
- Suites: rotation-note-colors, classical-shapes, note-resize-refinement, sticky-shadow and recovery-navigation.
- New tests verify pointer rotation, unchanged object dimensions, undo/redo, saved reopen, distinct palette swatches, creation only after selection, Escape/outside dismissal, keyboard selection, remembered focus and color persistence at a narrow viewport.
- Inspected rendered text rotation grip and note palette screenshots using synthetic content.
- Diff whitespace and staged privacy checks passed.

## Continuing phase work

This quick task does not close Phase 4. Its prior broad regression was interrupted after ordinal 1560 with seven known assertion failures, and final acceptance remains incomplete. The focused saved-to-library navigation regression passes in all three engines with this UI change. Existing unrelated working changes and Phase 4 drafts were preserved.
