# Phase 2 Deferred Verification Items

- Resolved in 02-06 (`fb59597`): board-copy Redo waits for Saved locally before reload; all exact durable-copy assertions pass in the 604-case gate.
- Resolved in 02-06 (`7e79f9f`): the ordinary shape failure came from a 66px stale native pointer/viewport origin after header layout. Both origins refresh before input; the regression asserts requested drawing position, measured editing position, exact Synthetic shape text and reload. All four projects pass.
- Remaining native OS input and magnification evidence is recorded in WINDOWS.md and 02-06-SUMMARY.md for phase verification.
