---
status: complete
---
# Save status, image details and typography feedback

- Reproduce cold recovery where the board persists but save status retains a failure. Verify against fresh authorized server document state without treating local checkpoints as server acknowledgment or clearing newer pending edits.
- Remove image-selection actions from Save details; distinguish image uploads from document saves and explain pending removals.
- Expand locally bundled fonts with upstream licenses and replace the empty native font-style popup with choices backed by loaded font faces.
- Verify new regressions, existing save details/status/recovery behavior, typography editing, type safety and production build. Preserve unrelated changes and keep Phase 4 final acceptance open.
