# Phase 1 fixes

All five assigned fixes are committed; independent recheck is pending.

| Finding | Change | Commit |
| --- | --- | --- |
| CR-01 | Preserve native placement across crop, adjustments and reset | `9200c6c` |
| CR-02 | Give each copied image independent edit history | `807866d` |
| CR-03 | Use native geometry for rotated edits and replacement | `3d5c79d` |
| T03SIZE | Reject SVG clipboard fallback and preflight replacement raster dimensions | `a569c05` |
| T03RACE | Check replacement host, board and image identity after storage | `010a276` |

Verification in the main checkout: typecheck, production build, 14 focused unit checks and 64 focused browser checks passed. Browser coverage includes development and production Chromium, Firefox and WebKit. No source edits remain uncommitted.

See [01-REVIEW-FIX.md](01-REVIEW-FIX.md) (per-finding implementation, verification evidence and coverage limits). The broad suite and archive round trip were not repeated.
