---
status: testing
phase: 01-editable-canvas-and-image-portability
source: [01-VERIFICATION.md]
started: 2026-09-11
updated: 2026-09-11
---

# Phase 1 Remaining Acceptance Checks

## Current Test

number: 1
name: Native file-manager drag and picker cancellation
expected: |
  Drag a synthetic PNG after panning and zooming: exactly one proportional image appears at the drop point without navigating away. Cancel the native picker: no object is added; reopen it and import successfully.
awaiting: user response

## Tests

### 1. Native file-manager drag and picker cancellation
expected: One correctly placed editable image; cancellation leaves the board unchanged and the next import works.
result: [pending]

### 2. Firefox and WebKit OS clipboard
expected: Copy a synthetic raster image using the OS clipboard and paste into each browser canvas. Exactly one proportional editable image appears near the viewport center.
result: [pending]

### 3. Publication-history remediation
expected: User-approved anonymization and review of the affected local commit metadata; publication remains blocked until verified. Existing automated export evidence needs no repeated manual test.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps

Two native OS-input checks and one publication decision remain. See [01-VERIFICATION.md](01-VERIFICATION.md) and [01-SECURITY.md](01-SECURITY.md).
