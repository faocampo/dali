---
status: testing
phase: 02-daily-mind-maps
source: [02-VERIFICATION.md]
started: 2026-09-13T01:50:13Z
updated: 2026-09-14T16:10:48+00:00
---

# Phase 2 — Native interaction acceptance

Use a synthetic board. Record browser/OS and the actual input method where relevant. Automated results are recorded separately in 02-VALIDATION.md.

## Current Test

number: 1
name: Explicit Properties sidebar retest
expected: |
  Select a topic, press Tab, and enter its text: Properties stays closed.
  Open the selection toolbar More menu, then Object actions → Properties:
  a matching right-side panel opens. Alignment entries are absent for one object
  and appear when multiple objects are selected.
  Close the panel, select another topic, or resume editing: it stays closed until
  Properties is requested again. Confirm the panel appearance and workflow.
awaiting: user response

## Tests

### 1. Keyboard mind-map editing and native IME
expected: The keyboard workflow above is usable; actual OS composition commit/cancel produces intended text without accidental topic creation. Nested branches retain content. Report input method and browser used.
result: [pending]
reported: "Keyboard actions execute correctly. Formatting must open only from Properties in the context menu and use the existing right-side properties appearance."
severity: major
gap_id: G-02-1
notes: "User confirmed actions; exact browser and native IME environment were not separately reported."

### 2. Actual browser zoom at 200 percent
expected: Set the browser's own zoom to 200 percent. Create/edit a topic and open mind-map controls. Panels remain reachable and scroll when needed, the edited topic stays visible, and Tab/Shift+Tab/Escape allow predictable focus movement. Report browser and viewport. CSS zoom evidence is tracked separately.
result: [pending]

### 3. Native clipboard in Firefox and WebKit/Safari
expected: In each available browser, copy a map with a nested collapsed branch using the OS clipboard shortcut, paste it, expand and edit the copy, and confirm the source remains unchanged. Report each browser separately; unavailable browsers remain pending.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps

- gap_id: G-02-1
  status: resolved_awaiting_retest
  truth: "Formatting opens only by explicit Properties action and uses the existing right-side inspector."
  severity: major
  source: "Test 1 user feedback"
  root_cause: "MindMapInspector renders for every selected topic and resets dismissal on selection changes. Its standalone bottom panel has separate dimensions and styling. Tab-created topics therefore trigger the panel."
  plan: 02-07-PLAN.md
  evidence: "02-07-SUMMARY.md; explicit-opening, editing, focus and stale-action browser regressions pass."

Keyboard actions are reported working. This presentation correction requires retest; native input environment details remain unreported.

## Follow-up menu correction

User requested Object actions as a submenu of the native More menu and alignment entries only for multi-selection. Plan 02-08 captures this correction. Properties and this menu placement remain pending user retest.
