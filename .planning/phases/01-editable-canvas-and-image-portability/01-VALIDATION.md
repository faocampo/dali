---
phase: "01"
slug: "editable-canvas-and-image-portability"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-11"
---

# Phase 1 — Validation Strategy

Execution contract derived from [01-RESEARCH.md](01-RESEARCH.md) (pinned implementation findings and validation architecture). Tests and runtime evidence are pending.

## Test Infrastructure

| Property | Value |
|---|---|
| Framework | Inherited Vitest 2.1.9 and Playwright 1.62.1; reproduce locked baseline |
| Config | `vite.config.ts`, `playwright.config.ts` — incorporated during first plan |
| Quick run | `npm test -- src/canvas/export-plan.test.ts` after its creation; before then use the current plan's focused test |
| Static check | `npm run typecheck` |
| Full suite | `npm test && npm run build && npm run test:browser` |
| Runtime | Measure during execution; quick feedback target under 30 seconds |

## Sampling Rate

- Before each task commit: typecheck and the affected focused suite.
- After each wave: all unit tests and affected development/production browser suites.
- Before phase verification: full suite green and downloaded-PNG evidence.
- Every runnable check must report a nonzero exit for unmet assertions and missing target tests.

## Per-Task Verification Map

Task IDs and waves below match the executable plans. All commands run from the repository root; the corresponding task creates its missing suite before running it. Implementation evidence remains pending.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---|---|---|---|---|---|---|---|---|---|
| 01-01-01 | 01-01 | 1 | CAN-01 | T-01-LIFE, T-01-SC, T-01-PRIV | Local write/read; pinned public source; verified dependencies | browser/static | `npm run typecheck && npm exec playwright test -- tests/community.spec.ts --project=dev` | No, incorporation task | pending |
| 01-01-02 | 01-01 | 1 | CAN-01 | T-01-SC | Maintained verified build preserves local lifecycle | browser/build | `npm run typecheck && npm test && npm run build && npm exec playwright test -- tests/community.spec.ts --project=prod` | No, prior task | pending |
| 01-02-01 | 01-02 | 2 | CAN-01 | T-02-INPUT, T-02-TEXT | Focus-safe primitives and inert pasted markup | browser | `npm exec playwright test -- tests/canvas-editing.spec.ts --project=dev` | No, same task | pending |
| 01-02-02 | 01-02 | 2 | CAN-02 | T-02-INPUT | Stable native identities, lock and selection guards | browser | `npm exec playwright test -- tests/canvas-arrangement.spec.ts --project=dev` | No, same task | pending |
| 01-04-01 | 01-04 | 2 | IMG-02 | T-04-ASSET, T-04-STALE | True source-scale mixed-layer PNG | browser/download | `npm exec playwright test -- tests/image-export.spec.ts --project=prod --grep "whole board"` | No, same task | pending |
| 01-04-02 | 01-04 | 2 | IMG-02 | T-04-MEM, T-04-ASSET | Preflight bounds, explicit lower scale and retry | unit/browser | `npm test -- src/canvas/export-plan.test.ts && npm exec playwright test -- tests/image-export.spec.ts --project=prod --grep "limits|recovery"` | No, same plan | pending |
| 01-03-01 | 01-03 | 3 | IMG-01, CAN-02 | T-03-SIZE, T-03-ACTIVE | Validated picker image and stored pixels | unit/browser | `npm test -- src/canvas/image-input.test.ts && npm exec playwright test -- tests/image-import.spec.ts --project=dev --grep picker` | No, same task | pending |
| 01-03-02 | 01-03 | 3 | IMG-01 | T-03-SIZE, T-03-ACTIVE, T-03-RACE | Single event ownership, decode guards and retry | unit/browser | `npm exec playwright test -- tests/image-import.spec.ts --project=dev --project=prod` | No, same plan | pending |
| 01-05-01 | 01-05 | 4 | IMG-03 | T-05-SCOPE, T-05-GEOM | Selected membership excludes overlapping content | unit/download | `npm test -- src/canvas/export-plan.test.ts && npm exec playwright test -- tests/image-export.spec.ts --project=prod --grep selection` | No, prior plan | pending |
| 01-05-02 | 01-05 | 4 | IMG-02, IMG-03 | T-05-SCOPE, T-05-RACE | Exact frame clip and complete import/export path | unit/download | `npm exec playwright test -- tests/image-export.spec.ts --project=prod --grep "frame|workflow"` | No, prior plan | pending |

Every command fails on nonzero exit or zero matched tests; each PLAN additionally states its assertion-specific failing direction. Run fixed-port browser checks serially across parallel plans 01-02/01-04, while their disjoint source changes may proceed in parallel. Production cross-browser smoke uses `--project=prod-firefox --project=prod-webkit` after plan 01 creates those projects.

## Wave 0 Requirements

- [ ] Incorporate the reviewed public upstream source and applicable notices; inspect public content before staging.
- [ ] Retrieve dependencies and inspect the exact pinned renderer and input APIs; reproduce baseline checks.
- [ ] Broaden browser test discovery, import the shared error fixture, and isolate test contexts/storage.
- [ ] Make empty/missing targeted tests fail.
- [ ] Create synthetic mixed-board and image fixtures, PNG header/decode/pixel assertions, and font-readiness helpers.
- [ ] Create targeted suites in the same plan as their feature; downstream verification depends on them.

## Required Behavioral Evidence

- All editable primitives and arrangement operations through actual UI input.
- Picker/drop/paste each insert once with preserved proportions; drop coordinates and paste center remain correct after pan/zoom.
- Actual downloaded PNG dimensions match preview at 1x/2x/4x across DPR 1 and 2; higher scale rerenders text and geometry.
- White/transparent output, group descendants, explicit/grouped connectors, excluded overlapping objects, optional selection padding, and exact frame clipping.
- Empty scopes, invalid input, missing assets, encoding failure, allocation limits, explicit lower-scale recovery, and retry.
- Browser bounds and runtime versions measured during execution; production support claims require corresponding passed evidence.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Instructions |
|---|---|---|---|
| Native OS clipboard or file-manager drag smoke, if browser automation cannot drive the native path | IMG-01 | Synthetic event tests alone cannot establish an OS integration | On a synthetic board, paste a copied raster image and drag a local synthetic image; confirm single insertion, aspect ratio, placement, and no browser navigation. Record only sanitized result metadata. |

Automate this smoke where the available desktop tools permit; otherwise flag the precise remaining gap.

## Validation Sign-Off

- [ ] Every final task has automated verification or an explicit setup dependency.
- [ ] No three consecutive tasks lack an automated check.
- [ ] Test setup covers every referenced new suite.
- [ ] No watch-mode flags.
- [ ] Feedback timing measured.
- [ ] All requirements and D-01 through D-15 have execution evidence.
- [ ] Set `nyquist_compliant: true` only after validation.

**Approval:** Strategy prepared for plan checking; implementation results pending.
