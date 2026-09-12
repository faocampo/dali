# Phase 2 Deferred Verification Items

- Plan 02-06: `tests/mindmap-copy.spec.ts:135` reloads immediately after successful in-memory Redo without waiting for Saved locally. Extra plan 02-05 production regression failed there; unchanged isolated rerun passed. Preserve all content assertions while adding legitimate persistence readiness.
- Plan 02-06: `tests/canvas-editing.spec.ts:33` expected `Synthetic shape` and received empty after coordinate double-click at line 30 and immediate insertText at line 31. Failed in the extra 38-case production run and again isolated. Diagnose editor readiness and source behavior before changing assertions. No mind map exists in this case; source cause remains unestablished.
