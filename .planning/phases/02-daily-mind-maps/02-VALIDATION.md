---
phase: "02"
slug: "daily-mind-maps"
status: executed
nyquist_compliant: true
wave_0_complete: true
created: "2026-09-12"
---

# Phase 2 — Validation Strategy

Derived from 02-RESEARCH.md (native seams and validation architecture) and 02-UI-SPEC.md (proposed interaction contract). All planned suites are implemented. Original implementation evidence at e52dab1: 67 unit tests, typecheck, production build and 604 browser cases passed; browser elapsed time 13.6 minutes. See 02-06-SUMMARY.md for decoded PNG inspection, regression repairs and explicit native input limits.

## Test Infrastructure

| Property | Value |
|---|---|
| Framework | Existing Vitest and Playwright |
| Config | vite.config.ts; playwright.config.ts |
| Quick command | `npm test -- src/canvas/mindmap-state.test.ts` |
| Focused browser command | `npm exec playwright test -- tests/mindmap.spec.ts --project=prod --grep "@02-01-01"` |
| Static/build | `npm run typecheck && npm run build` |
| Full gate | `npm test && npm run build && npm run test:browser` |
| Runtime | Warm focused smoke target under 30 seconds, measure during execution; Phase 1 full browser baseline 6.9 minutes |

## Sampling Rate

- Each task: typecheck and focused behavioral checks before commit.
- Each wave: mind-map cases plus affected Phase 1 arrangement/export tests.
- Before verification: complete unit/browser suite and production build.
- Nonzero exit and zero matched tests fail verification. Keep Vitest/Playwright default empty-match failures; no pass-with-no-tests, skip or todo options. Initial server/build startup is measured separately.
- Tag browser cases with the exact owning task IDs below. Create new targets first, then run a relevant failing assertion before production behavior changes. Existing passing native behavior remains regression coverage.
- Browser suites import test/expect from tests/fixtures.ts (unexpected runtime-error gate); actions use real controls and model inspection supplies assertions. Narrowly declare injected expected errors.
- Existing projects: dev, prod, prod-firefox and prod-webkit. Browser servers and production builds share one exclusive execution slot.

## Per-Task Verification Map

All commands run from the repository root and each task additionally runs `npm run typecheck`. All targets below were created and executed; the final four-project aggregate passed. Original target descriptions are retained for traceability.

| Task / wave | Requirement coverage | Focused behavioral command | Failure oracle / target status |
|---|---|---|---|
| 02-01-01 / 1 | MIND-01, MIND-03 | `npm exec playwright test -- tests/mindmap.spec.ts --project=prod --grep "@02-01-01"` | Native root/child/sibling, same-browser reload and decoded board PNG. New target. |
| 02-01-02 / 1 | MIND-02, MIND-03, MIND-04 | `npm exec playwright test -- tests/mindmap-compatibility.spec.ts --project=prod --grep "@02-01-02"` | Formatting, copy-route trace, one-action queued undo, fault restoration, stale callbacks. New target. |
| 02-02-01 / 2 | MIND-01, MIND-02, MIND-04 | `npm exec playwright test -- tests/mindmap-copy.spec.ts --project=prod --grep "@02-02-01"` | Native duplicate/paste remapping and independent board-copy document scope. New target. |
| 02-03-01 / 3 | MIND-01 | `npm exec playwright test -- tests/mindmap-keyboard.spec.ts --project=prod --grep "@02-03-01"` | Exact counts/parents, focus, composition, key repeat and stale commands. New target. |
| 02-03-02 / 3 | MIND-02, MIND-03 | `npm test -- src/canvas/mindmap-state.test.ts && npm exec playwright test -- tests/mindmap-collapse.spec.ts --project=prod --grep "@02-03-02"` | Descendant snapshots, nested flags, undo/reload, malformed topology and bounded traversal. Both new. |
| 02-04-01 / 4 | MIND-01, MIND-02, MIND-03 | `npm exec playwright test -- tests/mindmap-visibility.spec.ts --project=prod --grep "@02-04-01"` | Hidden hit/marquee/keyboard/Layers exclusion; hierarchy-safe arrangement/deletion Undo. New target. |
| 02-05-01 / 5 | MIND-02, MIND-03 | `npm exec playwright test -- tests/mindmap-layout.spec.ts --project=prod --grep "@02-05-01"` | All triggers/directions, bounds, root anchor within 0.5 model unit, parent edges and retry. New target. |
| 02-05-02 / 5 | MIND-04 | `npm exec playwright test -- tests/mindmap-formatting.spec.ts --project=prod --grep "@02-05-02"` | Four styles, retained explicit typography, empty/Unicode/inert-markup labels. New target. |
| 02-05-03 / 5 | MIND-01, MIND-02, MIND-04 | `npm exec playwright test -- tests/mindmap-accessibility.spec.ts --project=prod --grep "@02-05-03"` | Names, focus, announcements, viewport bounds, measured contrast/targets and retry. New target. |
| 02-06-01 / 6 | MIND-02, MIND-03, MIND-04 | `npm test -- src/canvas/mindmap-export.test.ts && npm exec playwright test -- tests/mindmap-export.spec.ts --project=prod --grep "@02-06-01"` | Visible membership/bounds, branch pixels, hidden exclusion and frame clipping. Both new. |
| 02-06-02 / 6 | MIND-02, MIND-03, MIND-04 | `npm test -- src/canvas/export-plan.test.ts && npm exec playwright test -- tests/mindmap-export.spec.ts --project=prod --grep "@02-06-02"` | Exact selected identities/edges; sibling exclusion and ordinary connector rules. Existing targets extended. |
| 02-06-03 / 6 | MIND-01, MIND-02, MIND-03, MIND-04 | `npm exec playwright test -- tests/mindmap-export.spec.ts tests/mindmap-workflow.spec.ts --project=prod --grep "@02-06-03"` | Hint, scale/background, stale/resource failure and complete real workflow. Workflow new, export extended. |

Mandatory final gate: `npm test && npm run build && npm run test:browser`. Preserve the proven Phase 1 focused commands `npm test -- src/canvas/export-plan.test.ts` and `npm exec playwright test -- tests/image-export.spec.ts --project=prod`.

## Wave 0 Requirements

- Create mind-map browser fixtures and meaningful pure state tests within the first implementing tasks.
- Probe native registration, view-bound layout, collapse history, copy conversion, and formatting persistence before expanding UI.
- Preserve existing synthetic fixtures, runtime-error gate, storage isolation, and failure behavior for empty test selection.

## Manual-Only Verifications

| Behavior | Why | Instructions |
|---|---|---|
| Native OS IME composition when unavailable to automation | Constructed composition events establish routing only | Enter composed text in a topic; confirm terminating Enter commits text without accidental node creation. Report exact tested environment separately. |
| Interaction feel | Human usability acceptance | Create a map using keyboard, collapse nested branches and style a topic; confirm readable layout and visible focus. |
| Native browser magnification when automation cannot control it | Device scale, CSS zoom and viewport emulation have different behavior | Set browser zoom to 200%; verify rail/panels fit, the edited topic stays visible, and Tab/Shift+Tab/Esc leave and restore focus. Record the actual browser and viewport. |

## Validation Sign-Off

- [x] All final tasks have automated checks or a test-creation dependency.
- [x] No three consecutive tasks lack checks.
- [x] Missing suites are created before referenced commands run.
- [x] Commands have failure signals and no watch mode.
- [x] Timing is measured.
- [x] All four requirements have execution evidence.

Automated sign-off complete. Approval: pending phase verification and human-only evidence; requirements remain open.

## Dependency and Scope Audit

Six plans, twelve tasks, six sequential waves: 02-01 → 02-02 → 02-03 → 02-04 → 02-05 → 02-06. Task counts are 2, 1, 2, 1, 3 and 3; file counts are 7, 4, 8, 5, 8 and 9. The two one-task expansion plans are explicitly split for file-scope control; every task modifies at most five files. Shared native adapter, command, chrome and export state requires ordering; same-wave parallel browser/build execution is excluded. Estimates use calibration factor 1, sample count 0 and derived confidence low. No user setup or package installs are planned.

The initial production tracer traverses UI, native model/view, local reload and PNG. The source-backed mechanisms are resolved before execution: preserve every existing topic's native fontSize/fontWeight/color, refit, and use native layout applyStyle:false; collapse and native layout run synchronously inside one captured transaction. Same-document duplicate/paste uses native createCanvasElement full-detail remapping; board copy retains document-local surface IDs in an independent copied document. Selection export renders eligible native connectors individually at the map's layer slot. These choices require no override schema or migration. Runtime checks in 02-01-02 and dependent tasks prove the selected behavior rather than selecting architecture.

Source discovery is complete for the installed native contracts; their runtime hypotheses are execution gates. There is no phase CONTEXT.md, SPEC.md or graph context. The user's authorization to research and propose defaults supplies the decision basis. Existing native typography is authoritative for all existing topics; native addNode initializes new topic defaults. Native model/history/storage/rendering responsibilities stay in their existing tiers; toolbar/inspector behavior stays in browser chrome. No separate identity service, storage source or layout algorithm is introduced.

| Source | Item | Plan/task coverage | Status |
|---|---|---|---|
| GOAL | Develop and reorganize readable maps by rapid keyboard editing and automatic hierarchical layout | 02-01 tracer; 02-03 editing; 02-05 layout/style; 02-06 workflow | COVERED |
| REQ | MIND-01 hierarchy and child/sibling shortcuts | 02-01-01, 02-02-01; 02-03-01, 02-04-01; 02-06-03 | COVERED |
| REQ | MIND-02 preserved collapse/expand descendants | 02-01-02, 02-02-01; 02-03-02, 02-04-01; 02-06 export | COVERED |
| REQ | MIND-03 layout adapts to node/visibility changes | 02-01-01, 02-01-02; 02-05-01; 02-06 bounds | COVERED |
| REQ | MIND-04 text formatting and branch styles | 02-01-02; 02-05-02; 02-06 rendering | COVERED |
| RESEARCH | Explicit native store/view registration and existing Vite pipeline | 02-01-01 | COVERED |
| RESEARCH | Geometry/style separation, fitting and four native presets | 02-01-02; 02-05-01, 02-05-02 | COVERED |
| RESEARCH | Actual native copy routes, same-document remapping and copied-document independence | 02-01-02; 02-02-01 | COVERED |
| RESEARCH | Collapse/detail/hidden consistency, outer transaction and queued history | 02-01-02; 02-03-02 | COVERED |
| RESEARCH | View-bound layout, hydration, disposal and root anchoring | 02-01-01, 02-01-02; 02-05-01 | COVERED |
| RESEARCH | Native text context, IME, Enter/Tab/Escape and duplicate-event prevention | 02-03-01 | COVERED |
| RESEARCH | Local reload, unchanged document/blob sources and ordinary copy | 02-01-01, 02-02-01; 02-06-03 | COVERED |
| RESEARCH | Effective visibility, tree validation, bounded traversal and finite geometry | 02-03-02, 02-04-01; 02-05-01 | COVERED |
| RESEARCH | Board/frame/selected-topic export membership and derived connectors | 02-06-01, 02-06-02 | COVERED |
| RESEARCH | Frame clipping, allocation limits, stale export and PNG fidelity | 02-06-01, 02-06-03 | COVERED |
| RESEARCH | Seven-node nested and bounded 50-node fixtures; fail-closed tests | 02-01-02; 02-03-02; 02-05-01; every task verification | COVERED |
| RESEARCH | ASVS1 label encoding, malformed mutation, bounds, stale writes, export privacy | T-02-01 through T-02-17 across all plans | COVERED |
| CONTEXT | No phase context or locked D-NN decisions | Explicit absence recorded; no fabricated citations | NOT APPLICABLE |
| UI-SPEC | Proposed root-only RIGHT/ONE creation and direct-child collapsed counts | 02-01-01; 02-03-02 | COVERED |
| UI-SPEC | Native-focus commands, selection retention, hidden selection/Layers and safe deletion | 02-03-01, 02-03-02, 02-04-01 | COVERED |
| UI-SPEC | Topic formatting, map presets, stable root, empty/long/international text | 02-05-01, 02-05-02 | COVERED |
| UI-SPEC | Eight state categories, exact copy, focus, responsive targets and contrast | 02-05-03; errors in each owning task | COVERED |
| UI-SPEC | Visible-export hint, controls excluded from PNG and selected-edge policy | 02-06-01, 02-06-02, 02-06-03 | COVERED |
| EXCLUSION | MIND-05 concurrency and durable service guarantees | Phase 5 allocation; local reload here is a regression check | OUTSIDE PHASE |
| EXCLUSION | Grid/snapping, distances/alignment seeds and brand assets/naming | Deferred seeds retained; no implementation tasks | DEFERRED |

## Spec-less Edge Probe Ledger

The deterministic probe supplied six entries. Four have explicit planned predicates copied into plan must_haves.truths; two required a phase-review classification decision. Planning coverage is distinct from executed verification. No item was dismissed or silently resolved.

| Requirement / category | Probe outcome in plan | Explicit predicate / owner |
|---|---|---|
| MIND-01 / idempotency | resolved; verification explicit; automated evidence passed | One gesture yields one topic; held keys/listener remount create no extras; two deliberate invocations create independent maps. 02-01/02 truths and 02-03-01. |
| MIND-01 / concurrency | resolved; verification explicit; automated evidence passed | Local interrupted/stale/readonly/locked commands make zero writes; serialized deliberate commands stay distinct. 02-03 truths and 02-01-02, 02-02-01, 02-03-01. Multi-user MIND-05 stays Phase 5. |
| MIND-02 / unclassified | manually classified: state preservation and reversibility; COVERED | Reviewed requirement semantics: collapse may change visibility and layout but must retain descendant identity, parent/order, text, style and nested collapse flags. Exact snapshot, repeated toggle, failure rollback, Undo/Redo, copy and reload assertions cover this predicate in collapse/compatibility/copy suites. |
| MIND-03 / unclassified | manually classified: geometry and lifecycle; COVERED | Reviewed requirement semantics: add/delete/edit/collapse/direction changes produce finite measured layout, retained parent edges and stable root; stale callbacks cannot mutate a disposed map. The 7/50-topic layout, fault/retry, native toolbar and compatibility lifecycle tests exercise these predicates. |
| MIND-04 / empty | resolved; verification explicit; automated evidence passed | No selection disables formatting; empty text and one-root/many-topic maps remain valid. 02-05 truths and 02-05-02. |
| MIND-04 / encoding | resolved; verification explicit; automated evidence passed | Exact native text sequence preserved for emoji, combining marks, CJK/RTL; fitting uses measured geometry, no forced normalization. 02-05 truths and 02-05-02. |

Count reconciliation: 6 supplied = 4 explicit planning predicates + 2 explicit phase-review classifications above. Original unclassified markers remain in the immutable plans for provenance. Classification uses approved requirement semantics and reviewed test assertions; it adds no new capability or waiver.

## Prohibition Recall

Recall examined unintended duplication/flattening, lost hidden content, overwritten formatting, altered text encoding, trapped focus, unbounded traversal, stale mutation, misleading export scope, hidden/sibling pixel inclusion and non-generic evidence. Routine correctness belongs to the explicit task oracles. Injection/export privacy are security canon and route to the plan threat models and GSD security verification. Public evidence privacy is already an explicit repository constraint. The precision pass yields zero additional bespoke values prohibitions; no fabricated prohibition check descriptors or extra product restrictions are introduced.

## Final Nyquist audit — 2026-09-13

Inline orchestrator audit matched all twelve task tags and all four requirement IDs to implemented behavioral tests. COVERED: MIND-01, MIND-02, MIND-03, MIND-04. No missing automated target found. Final aggregate: 604/604 browser cases across dev, production Chromium, Firefox and WebKit; 67/67 unit cases; typecheck/build passed. Prior-phase export regressions separately passed 23 unit and 18 browser cases. See 02-06-SUMMARY.md for execution evidence and test-harness adaptations.

Native Firefox/WebKit OS clipboard use remains manual: copy a map with nested collapsed branches, paste, edit the copy and confirm source independence. Chromium uses the real clipboard in automation; other engines use the native serialized payload route. Real browser 200% magnification and native OS IME remain manual as listed above. Nyquist compliance describes automated coverage; final human acceptance remains pending.

Post-review correction `a5c6f8d`: 68/68 copy cases across four projects passed after three new malformed-paste regressions failed before the fix. The correction uses canonical hierarchy validation before conversion; all 67 unit cases, typecheck and build passed again. The prior 604-case aggregate is retained with its original revision scope.

Post-review UI correction `a05b94d`: 36/36 accessibility cases across four projects and 25/25 production canvas/image/keyboard regressions passed. Typecheck and production build passed. Synthetic desktop and narrow renders confirm topic/panel clearance, a single inspector and separate action controls. See 02-UI-REVIEW.md for the 22/24 audit and advisory copy/color observations.

## Plan 02-07 — explicit Properties UAT correction

- 02-07-01 / MIND-01, MIND-04: `tests/mindmap-properties.spec.ts` verifies no automatic panel during creation/Tab, explicit contextual opening, editing/close lifecycle, current-selection/host invalidation, menu keyboard navigation and focus. `tests/mindmap-accessibility.spec.ts` verifies shared sidebar placement and selected-topic viewport containment.
- 02-07-02 / MIND-01, MIND-04: `tests/mindmap-properties.ts` supplies an actual Object actions → Properties gesture to affected formatting, collapse, keyboard, layout and workflow suites. Existing content/history assertions remain.
- RED reproduced automatic opening, swallowed menu Escape and narrow-view topic containment. The final 392/392 mind-map browser matrix passed across dev Chromium and production Chromium, Firefox and WebKit; 67/67 unit tests, typecheck and build passed.
- Ordinary regression totals and final source revision are recorded in 02-07-SUMMARY.md. Native IME, real browser magnification and non-Chromium OS clipboard acceptance remain separately pending in 02-UAT.md.

## Plan 02-08 — native More submenu

The final affected matrix passed 204/204 cases across four browser projects, with 67/67 units, typecheck and build passing. `object-actions-submenu.spec.ts` verifies native More nesting, submenu placement, keyboard return/reopen, Properties and single/two-object alignment visibility. Existing arrangement tests validate all eight alignment/distribution operations; Properties, image, keyboard and accessibility suites validate preserved behavior. The earlier 392-case result remains tied to plan 02-07. See 02-08-SUMMARY.md for this correction's evidence.
