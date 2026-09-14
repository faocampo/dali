---
status: testing
phase: 02-daily-mind-maps
source: [02-VERIFICATION.md]
started: 2026-09-13T01:50:13Z
updated: 2026-09-14T21:51:41+00:00
---

# Phase 2 — Native interaction acceptance

Use a synthetic board. Record browser/OS and the actual input method where relevant. Automated results are recorded separately in 02-VALIDATION.md.

## Current Test

number: 5
name: Mind-map typography, branch copying and unlocking
expected: |
  Format a selected topic, then press Enter: the new node retains typography.
  Duplicate a branch: it remains a sibling branch with its descendants.
  Copy a branch and paste beneath a selected topic: hierarchy and styles remain.
  Lock, deselect, then right-click and unlock a node; editing works again.
awaiting: user response

## Tests

### 1. Keyboard workflow and contextual Properties
expected: Keyboard editing works; Properties opens explicitly from More → Object actions in the right sidebar. Alignment entries appear only for multi-selection.
result: pass
reported: "Keyboard actions execute correctly. Formatting must open only from Properties in the context menu and use the existing right-side properties appearance."
accepted: 2026-09-14 — user approved the corrected More submenu, alignment visibility and Properties interaction.
gap_id: G-02-1
notes: "User confirmed actions; exact browser and native IME environment were not separately reported."

### 2. Actual browser zoom at 200 percent
expected: Set the browser's own zoom to 200 percent. Create/edit a topic and open mind-map controls. Panels remain reachable and scroll when needed, the edited topic stays visible, and Tab/Shift+Tab/Escape allow predictable focus movement. Report browser and viewport. CSS zoom evidence is tracked separately.
result: [pending]

### 3. Native clipboard in Firefox and WebKit/Safari
expected: In each available browser, copy a map with a nested collapsed branch using the OS clipboard shortcut, paste it, expand and edit the copy, and confirm the source remains unchanged. Report each browser separately; unavailable browsers remain pending.
result: [pending]

### 4. Native IME composition
expected: With an actual OS IME, commit and cancel a composition candidate in a topic. Intended text is preserved and no accidental topics are created. Record input method and browser.
result: [pending]
notes: Separated from the approved keyboard/UI test because native composition environment was not reported.

### 5. Mind-map typography, branch copying and unlocking
expected: The current focused test above preserves native node behavior and permits unlocking.
result: [pending]
reported: Enter changes typography, duplicate/paste becomes free objects, and a locked node cannot be unlocked.
gap_ids: [G-02-2, G-02-3, G-02-4]

## Summary

total: 5
passed: 1
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps

- gap_id: G-02-1
  status: resolved
  truth: "Formatting opens only by explicit Properties action and uses the existing right-side inspector."
  severity: major
  source: "Test 1 user feedback"
  root_cause: "MindMapInspector renders for every selected topic and resets dismissal on selection changes. Its standalone bottom panel has separate dimensions and styling. Tab-created topics therefore trigger the panel."
  plan: 02-07-PLAN.md
  evidence: "02-07-SUMMARY.md; explicit-opening, editing, focus and stale-action browser regressions pass."

Keyboard actions are reported working. The presentation correction is user-approved; native input environment details remain unreported.

## Follow-up menu correction

User requested Object actions as a submenu of the native More menu and alignment entries only for multi-selection. Plan 02-08 captures this correction. The user approved Properties, menu placement and alignment visibility on 2026-09-14.

## New reported behavior gaps

- G-02-2 — Pressing Enter on a selected node changes formatting without an explicit formatting action. Implemented in 02-09; user retest pending.
- G-02-3 — Node duplication and clipboard paste produce ordinary free objects. User approved whole-branch copying, sibling duplication and paste beneath the selected node. Implemented in 02-09; user retest pending.
- G-02-4 — Locked node cannot be unlocked after deselection. Implemented in 02-09; user retest pending.

Actual 200% browser zoom remains unconfirmed; these reported defects require focused retest before proceeding.
