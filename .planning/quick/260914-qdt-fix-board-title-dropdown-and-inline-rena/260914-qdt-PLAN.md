---
mode: quick
status: complete
---
# Board title dropdown and rename

Implement inline in the orchestrator using the skill's inline fallback. Replace direct navigation with an accessible dropdown: Rename board opens a focused name form; All boards explicitly opens the existing library. Reuse renameLocalBoard and update the current title after saving. Escape/cancel/outside click dismiss without mutation; prevent empty names and duplicate saves. Preserve the mounted canvas while renaming.

Scope: App.tsx, Header.tsx, new BoardTitleMenu.tsx, scoped CSS, focused header tests, and existing tests that intentionally navigate to the library. Validate persistence after reload, cancellation, keyboard dismissal and explicit library navigation. Run typecheck, build, units and affected browser cases. Record completion in STATE.md without advancing Phase 2.
