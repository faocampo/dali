# Draw text boxes and revise optional local-copy acceptance

Scope: user-directed text placement and the latest UAT item 9 disposition. Execute inline; preserve Phase 3 acceptance boundaries and unrelated work.

1. Replace immediate placeholder insertion with a native canvas tool: preview a dragged box, create on release, keep wrapping width, and focus the native text editor/caret. Keep click placement and the T shortcut usable. Escape cancels placement without adding a document element.
2. Reuse the last locally used text formatting (font, size, weight/style, color, alignment). Preserve native double-click editing, readonly protection, empty-draft cleanup, undo, persistence and text composition.
3. Add browser coverage for actual drag/type/double-click gestures, format reuse, zoom/reverse dragging and cancellation. Update older tests that relied on immediate insertion, and run static checks plus focused supported-browser regressions.
4. Record UAT item 9 as skipped by user because the optional browser-local migration workflow is not needed. Keep its safety prohibition and existing implementation/regressions. Record six passes, three skips (two deferred, one waived), and one pending item (8); Phase 3 stays open.

Plan review: the change owns only text placement/integration, related tests, and acceptance records. It adds no alternate document format, dependency, account migration or permission change. Drawn width wraps text; height follows content as in the existing text model.
