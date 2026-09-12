---
status: testing
phase: 01-editable-canvas-and-image-portability
source: [01-VERIFICATION.md]
started: 2026-09-11
updated: 2026-09-12
---

# Phase 1 Remaining Acceptance Checks

## Current Test

number: 4
name: Sticky-note shadow fix
expected: |
  Select a sticky note, open its style menu, and choose different Shadow presets. The shadow changes visibly on the canvas; No shadow removes it. Reloading preserves the selected shadow.
awaiting: user response

## Tests

### 1. Native file-manager drag and picker cancellation
expected: One correctly placed editable image; cancellation leaves the board unchanged and the next import works.
result: [pass]
evidence: User approved image import on 2026-09-12 after manual testing. This records feature acceptance; individual native steps were not separately reported.

### 2. Firefox and WebKit OS clipboard
expected: Copy a synthetic raster image using the OS clipboard and paste into each browser canvas. Exactly one proportional editable image appears near the viewport center.
result: [pass]
evidence: User approved the copy-and-paste use case after manual testing. Browser-specific steps were not individually reported.

### 3. Publication-history remediation
expected: Resolve the author-metadata concern under the user-approved privacy boundary.
result: [pass]
evidence: Approved 15-commit anonymization verified; user clarified that remaining personal authorship is permitted. See 01-HISTORY-REMEDIATION.md.

### 4. Sticky-note shadow fix
expected: Shadow presets visibly change the sticky note on the canvas, No shadow removes the effect, and the selected style survives reloading.
result: [pending]
evidence: Automated regression checks passed in development Chromium and production Chromium, Firefox, and WebKit. Awaiting user confirmation of the reported visual issue.

## Summary

total: 4
passed: 3
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps

Image import and copy/paste are user-approved. The reported sticky-note shadow rendering issue is fixed; see 01-STICKY-SHADOW-FOLLOWUP.md. The authorship concern is resolved. See [01-VERIFICATION.md](01-VERIFICATION.md) and [01-SECURITY.md](01-SECURITY.md).
