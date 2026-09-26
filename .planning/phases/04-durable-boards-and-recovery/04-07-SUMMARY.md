---
phase: 04-durable-boards-and-recovery
plan: "07"
subsystem: save-details
tags: [recovery, images, accessibility, responsive]
requires:
  - phase: 04-06
    provides: Immutable recovery archive and scope-bound download progress
provides:
  - Always-available title-adjacent Save details dialog with acknowledged save age
  - Stable image failures, local previews, permitted selection and coalesced recovery actions
  - Viewport-clamped scrolling recovery details with long-name and 50-row coverage
affects: [04-08, 04-15, 04-16]
tech-stack:
  added: []
  patterns: [scope-bound dialog lifetime, nonmodal focus return, visual viewport containment]
key-files:
  created: [src/header/SaveDetails.tsx, src/header/save-details.css, tests/save-details.spec.ts, tests/save-details-fixtures.ts]
  modified: [src/header/Header.tsx, tests/save-status.spec.ts, tests/local-recovery.spec.ts, tests/recovery-archive.spec.ts, tests/library-recovery.spec.ts]
key-decisions:
  - Present active authorized Viewers as Read only while preserving the recovery coordinator write isolation and authorization boundary.
  - Keep recovery preparation in the existing scoped service and clamp the details surface to the visual viewport below the actual header.
requirements-covered: [SAVE-02]
requirements-completed: []
coverage:
  - id: D-01
    description: Stable deliberate details activation, save age, focus return and live acknowledgment
    requirement: SAVE-02
    verification: [{kind: integration, ref: "tests/save-details.spec.ts#@04-07-01", status: pass}]
    human_judgment: false
  - id: D-02
    description: Coalesced retry and real recovery download success and failure retain pending records
    requirement: SAVE-02
    verification: [{kind: integration, ref: "tests/save-details.spec.ts#@04-07-01", status: pass}]
    human_judgment: false
  - id: D-03
    description: Stable image labels, failures, previews and permitted selection
    requirement: SAVE-02
    verification: [{kind: integration, ref: "tests/save-details.spec.ts#@04-07-01", status: pass}]
    human_judgment: false
actuals:
  tokens: 30700
  tasks: 2
  commits: 4
plan_head_before: 3605bbc5efbb6103c44b28acaf060619e882e381
duration: 30min
completed: 2026-09-26
status: complete
---

# Phase 4 Plan 7: Save Details Summary

**Title-adjacent Save details now exposes current save coverage, stable image failures and scoped recovery actions in a keyboard-accessible, scrolling surface.**

## Accomplishments

- Saved, pending, failed and paused states share a stable deliberate activation control with acknowledged save age. The named nonmodal dialog focuses its heading, returns focus on Close/Escape and dismisses on outside interaction without stealing focus.
- Required-image rows retain escaped stable labels and unresolved failures through retry, show available local raster thumbnails or neutral missing previews, and select/recenter permitted extant canvas objects without modifying them. Removed objects lose selection actions. Empty lists are omitted.
- Retry uses a single in-flight operation; download consumes the existing account/board/generation-bound preparation service. Reopening details retains progress. Actual downloads and missing-byte failures preserve pending records.
- An active authorized Viewer sees Read only and no mutation/recovery controls. The coordinator's denied write-isolation state remains unchanged.
- The surface measures the actual header and visual viewport, maintains 16px gutters, wraps long names, scrolls all content, and keeps 44px controls reachable. Small-screen actions stack; reduced motion uses no animated recovery transitions.

## Task Commits

1. `044300f` — RED: saved-board activation initially lacked Save details.
2. `c77ed20` — Task 1: scoped save details, image recovery actions and compatible native selectors.
3. `b906049` — RED: narrow and magnified viewport containment initially failed.
4. `d547c2a` — Task 2: measured viewport containment, scrolling styles and regression expectations.

The four implementation/test commits are measured from the persisted plan ledger. Token actuals are the realized committed diff characters divided by four, rounded up; the diff includes accessibility-selector migrations across 35 files. The separate completion metadata commit is outside that measurement.

## Validation

| Gate | Observed result |
|---|---|
| Task 1 exact `@04-07-01` production browser gate | RED 1 selected/1 failed on missing dialog; GREEN 7 selected/7 passed/0 skipped |
| Task 2 exact `@04-07-02` production browser gate | RED 2 selected/2 failed on viewport containment; GREEN 2 selected/2 passed/0 skipped |
| Both TypeScript checks | Passed for each task and final source state |
| Unit suite | 182 passed across 16 files, zero skipped |
| Combined Save details/save status/local recovery/archive suite | 42 selected: 38 passed, 4 failed on migrated heading/dialog/scroll expectations |
| Corrected integrated cases | All four passed in targeted rerun, zero skipped; current source therefore has passing evidence for all 42 distinct cases across runs |
| Library download, leaving and restored-board entry | 1 selected/1 passed/0 skipped |
| Production build and diff checks | Passed; existing chunk-size/dynamic-import warnings remain |

An earlier combined run loaded a stale region locator and was interrupted after the owned test timeout; its incomplete result is superseded by the explicitly counted runs above. There was no single clean 42-case combined run after correcting all four expectations. No mandatory selected test was skipped.

### Acceptance truth mapping

| Truth | Native browser assertion |
|---|---|
| E1/loading | Pending state retains last acknowledged age and live acknowledgment updates open details |
| E1/error | Existing save-status precedence/current-coverage cases plus real failed dialog actions |
| E1/overflow | 1440, 900, 600, 490 and 320px containment and no horizontal page overflow |
| E1/long-text | 200-character board title with viewport matrix |
| E2/empty | Saved details omit image section and show acknowledged time |
| E2/loading | Held retry preserves focused control and unresolved rows |
| E2/error | Mixed failures remain until acknowledgment; removed-object selection disappears |
| E2/populated | Stable labels, local 8×8 decoded preview and nonmutating selection |
| E2/partial | Missing preview uses neutral fallback; real missing bytes block download |
| E2/overflow | 50 rows, short viewport and last-row/download reachability |
| E2/zero-one-many | Omitted zero, singular image and 50-image plural summary |
| E2/long-text | 120-character image labels wrap with accessible text retained |

Rendered token assertions cover 12/13/14/20px type, 400/600 weights, text contrast of at least 4.5:1, control boundary contrast of at least 3:1 and 44px action targets. Screenshots of the 320px/short viewport and magnified scrolling surface were inspected using synthetic content.

## Deviations from Plan

1. **[Rule 1 — Bug; explicitly assigned] Authorized Viewer label:** source inspection found the recovery coordinator's denied write-isolation state presented as recovery denial in Header. The UI now derives Read only from active authorized Viewer scope. A separate browser with a real synthetic Viewer grant verifies read-only canvas and absent retry/download controls. The pre-change UI was not separately replayed in a browser; the initial diagnosis was source-based. Current native behavior is verified.
2. **[Rule 3 — Blocking compatibility] Existing native selectors:** the newly required accessible activation suffix and unified Save details dialog required selector/copy changes across existing tests. Four integrated assumptions were corrected for full-page headings, outside dismissal and intentional scrolling. These changes preserve their underlying assertions.

## Security and Interfaces

T-04-07-01 is mitigated by escaped text rendering, control-character-filtered labels, current account/board/generation checks, raster-only local preview URLs, stale-result rejection and URL disposal. Existing native access-loss, old-account/board-result and archive gates passed in the integrated cases. No new endpoint, schema or authorization mechanism was introduced.

Header consumes the existing `recoveryDownload` state and scope API from 04-06. SaveDetails accepts status, snapshot, current scope, scoped download state, trigger and close callback. Canvas selection uses the native controller; preview bytes use the existing local asset reader. Journal/replay and archive byte generation remain in their existing services.

## Evidence Limits and Next Work

- Automated Chromium magnification uses CDP `Emulation.setPageScaleFactor` with observed `visualViewport.scale === 2`. This is visual viewport/pinch magnification. Native browser UI 200% zoom remains a final phase acceptance check and is recorded in the cross-phase defect ledger. Other browser paths use narrow reflow; cross-engine execution belongs to final phase verification.
- Real-provider and spoken assistive-technology acceptance retain their previously approved deferred gates. SAVE-02 and all phase requirement acceptance states remain unchanged.
- The 04-06 final 50-row recovery matrix handoff is covered here through the actual dialog, long labels, reachable recovery download and existing real archive success/failure cases. Full phase regression remains for 04-16.
- Next dependency-approved plan: 04-08, title intent and unresolved-save navigation.

No implementation stubs remain in the plan's changed production files. The neutral missing-preview state is intentional behavior.

## Documentation Consulted

Context7 supplied React effect cleanup/stale-result guidance from React documentation ([useEffect](https://github.com/reactjs/react.dev/blob/main/src/content/reference/react/useEffect.md)) and Chromium CDP session guidance from Playwright documentation ([CDPSession](https://github.com/microsoft/playwright/blob/main/docs/src/api/class-cdpsession.md)).

## Self-Check: PASSED

All five plan artifacts exist; all four listed commits exist. Both tasks passed their exact selected native gates and static checks. Requirement acceptance remains pending at phase level.
