---
phase: 01-editable-canvas-and-image-portability
plan: "03"
subsystem: ui
tags: [images, clipboard, blocksuite, persistence, playwright]
requires:
  - phase: 01-02
    provides: Native canvas tools and arrangement
provides:
  - Validated native PNG/JPEG imports through picker, drop and paste
  - Proportional model-space placement and local blob persistence
  - Sequential per-file recovery and cancelled-board mutation guards
affects: [01-05]
tech-stack:
  added: []
  patterns: [single event owner, guarded native mutation, bounded raster decode]
key-files:
  created: [src/canvas/image-input.ts, src/canvas/image-input.test.ts, tests/image-import.spec.ts]
  modified: [src/canvas/BlockSuiteCanvas.tsx]
key-decisions:
  - Accept decoded PNG and JPEG with predecode header, byte and pixel checks.
  - Preserve native addImages storage and placement; guard its final addBlocks mutation across asynchronous work.
  - Capture image-file input events before native listeners while retaining native text and object clipboard paths.
requirements-completed: [IMG-01, CAN-02]
actuals:
  tokens: 7209
  tasks: 2
  commits: 4
plan_head_before: 77656fbefe7613aef3dc2a6c76bab3ee37c147f6
duration: approximately 17min
completed: 2026-09-11
status: complete
---

# Phase 1 Plan 3: Local Image Import Summary

**PNG/JPEG reference images now enter native editable canvas models through picker, drop and paste with proportional placement, persistent blobs, bounded validation and recoverable errors.**

## Accomplishments

- The picker resets after capture, deliberately repeated imports receive distinct native IDs, and mouse-driven movement/corner resizing retain proportions and reloadable geometry.
- The adapter validates raster signatures and header dimensions before decoding, checks decoded dimensions, and preserves native `addImages` with `MAX_IMAGE_WIDTH`. Explicit model coordinates use `shouldTransformPoint: false`; picker and paste use viewport center and drop converts client coordinates through native viewport APIs.
- Inputs are queued sequentially, with deterministic 32-unit offsets and individual numbered errors. Corrupt, unsupported, active-content and oversized files produce an actionable alert and another-image control. A valid subsequent import succeeds.
- Captured store identity, active-board identity, connected host and abort state protect native mutation. A narrow proxy checks `store.addBlocks` after native asynchronous blob/decode work. Aborted decodes release temporary URLs and image sources; a 15-second decoder deadline bounds waiting.

## Task Commits

| Task | RED | GREEN |
|---|---|---|
| 01-03-01 Picker, arrangement and persistence | `7875c42` | `eb9f08b` |
| 01-03-02 Drop, paste and recovery | `dd96b0c` | `2c4fc28` |

Actual tokens are realized task-diff characters divided by four, rounded up. Commits are measured from the persisted plan base before summary/tracking metadata.

## Supported Formats and Budgets

| Contract | Implemented / verified |
|---|---|
| Accepted formats | PNG and JPEG; both actual bytes and browser decoding must agree with the supported raster format. |
| Other formats | Rejected with PNG/JPEG recovery guidance; SVG and renamed payloads have explicit rejection coverage. |
| File size | At most 16 MiB; browser rejection above the cap is verified. |
| Dimensions | At most 8192 per side and 16,000,000 pixels; boundary math is unit-tested and oversized headers are rejected before decode. These are conservative application budgets, not a universal browser allocation guarantee. |
| Proportions | Landscape 2:1 and portrait 1:2 fixtures, native resize, viewport centering and one-model-unit drop tolerance are verified. |
| Persistence | Native stored PNG bytes match the generated source SHA-256 before and after reload; native IDs and arranged bounds persist. |

IMG-01's generic unclassified-format probe remains visible for phase verification. PNG/JPEG meet the plan's tested minimum; no broader raster support is claimed.

## Event Ownership and Installed API Findings

Source: [BlockSuite v0.22.4](https://github.com/toeverything/blocksuite/tree/v0.22.4) (installed native image, viewport and clipboard source).

- Native image drop uses a host listener; native clipboard control listens on document bubble. The app captures image-file drops on the host and image-file paste on document before those paths, preventing default and stopping immediate propagation exactly once.
- Text-only clipboard payloads and serialized native objects remain on native handlers. Inputs, textareas and dialogs outside the canvas retain their own paste handling.
- Native `addImages` concurrently reads dimensions and stores a blob before `store.addBlocks`; therefore a guard only before calling it cannot protect a board transition. The final-mutation guard preserves native IDs, storage and selection semantics without modifying the dependency.
- A cancelled operation after blob storage may leave an unreferenced content-addressed blob; it creates no partial image model and never inserts into another board. Existing blob lifecycle remains native.

## Verification

| Check | Result |
|---|---|
| `npm run typecheck` and `git diff --check` | Passed before task commits. |
| `npm test -- src/canvas/image-input.test.ts` | 14 passed, including header validation, dimension boundaries and decoder cleanup on rejection/abort. |
| Required development/production import matrix plus Firefox/WebKit | 32 passed: eight cases in each project, 43.3 seconds. |
| Focused final native object clipboard regression | Two passed in development/production Chromium, 16.4 seconds. |
| Production build | Passed through Playwright server startup; retained bundle-size advisory and informational dynamic/static module chunk warning. |
| Fault recovery | Invalid bytes, SVG, byte cap, oversized header, storage rejection, board change during native storage, board unmount during pending decode, mixed per-file results and valid retry passed. |

## Input Evidence and Remaining OS Paths

- Picker: real HTML file input delivery through Playwright, including repeated selection; native canvas mouse movement and corner resizing. Native operating-system file-dialog cancellation was not exercised.
- Drop: constructed `DataTransfer` and `DragEvent` delivered through the mounted native host in all engines, with navigation prevention and pan/zoom model-coordinate assertions. Operating-system file-manager drag remains unverified.
- Clipboard: Chromium browser Clipboard API writes followed by native keyboard paste passed for text, bitmap and native object copy/paste. Firefox and WebKit use constructed clipboard events; Firefox requires explicit clipboardData on those untrusted test events. Their operating-system clipboard integration remains unverified.
- These OS-path gaps are recorded in the cross-phase WINDOWS ledger. Synthetic event delivery is routing evidence only.

## TDD Gate Compliance

- Task 1 RED failed on the missing actionable image-import alert. Task 2 RED failed because an image paste event was not claimed/prevented. Both named assertion failures were recorded before implementing their respective behavior and validated with `RED_EVIDENCE_OK`.
- Actual Playwright failures were normalized to TAP for the runtime's Node-only RED parser, with the normalization recorded. Existing green native capabilities were retained as regression coverage.
- The picker trace passed before event-input expansion. Task 2 test-only overload types were corrected before the RED commit; those type errors were never counted as intentional RED evidence.

## Deviations and Limitations

- Automatic approval review rejected inherited commit identity under the repository privacy boundary. Subsequent commits use the approved process-only generic contributor identity; global configuration and prior history were unchanged.
- Tests were adjusted to native `model.props.sourceId`, scoped to the board picker to distinguish the image-replacement control, and given explicit constructed clipboard data for Firefox. These are verification-adapter corrections.
- The planned OS integration coverage is partial as detailed above. No new dependency, network endpoint, authentication boundary or schema was introduced. No implementation stubs remain.

## Self-Check: PASSED

All four task files and all four recorded commits exist. Static checks, unit tests and browser evidence passed. No tracked files were deleted.

## Next Plan Readiness

The native export integration remains intact. Plan 01-05 can continue with selected-object and frame export; phase verification should retain the recorded OS-input and format-probe limitations.
