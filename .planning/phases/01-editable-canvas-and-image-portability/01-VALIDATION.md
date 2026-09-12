---
phase: "01"
slug: "editable-canvas-and-image-portability"
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-09-11"
---

# Phase 1 — Validation Strategy

Execution contract derived from [01-RESEARCH.md](01-RESEARCH.md) (pinned implementation findings and validation architecture). Automated execution and independent verification evidence are recorded below; feature-level manual acceptance is recorded in 01-UAT.md.

## Test Infrastructure

| Property | Value |
|---|---|
| Framework | Vitest 4.1.11 and Playwright 1.62.1; maintained toolchain validated |
| Config | `vite.config.ts`, `playwright.config.ts` |
| Quick run | `npm test -- src/canvas/export-plan.test.ts` |
| Static check | `npm run typecheck` |
| Full suite | `npm test && npm run build && npm run test:browser` |
| Runtime | Measure during execution; quick feedback target under 30 seconds |

## Sampling Rate

- Before each task commit: typecheck and the affected focused suite.
- After each wave: all unit tests and affected development/production browser suites.
- Before phase verification: full suite green and downloaded-PNG evidence.
- Every runnable check must report a nonzero exit for unmet assertions and missing target tests.

## Per-Task Verification Map

Task IDs and waves below match the executable plans. All commands run from the repository root; the corresponding task creates its missing suite before running it. Automated task evidence is in each plan SUMMARY; OS-input limits remain separate below.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---|---|---|---|---|---|---|---|---|---|
| 01-01-01 | 01-01 | 1 | CAN-01 | T-01-LIFE, T-01-SC, T-01-PRIV | Local write/read; pinned public source; verified dependencies | browser/static | `npm run typecheck && npm exec playwright test -- tests/community.spec.ts --project=dev` | Yes | passed (automated scope) |
| 01-01-02 | 01-01 | 1 | CAN-01 | T-01-SC | Maintained verified build preserves local lifecycle | browser/build | `npm run typecheck && npm test && npm run build && npm exec playwright test -- tests/community.spec.ts --project=prod` | Yes | passed (automated scope) |
| 01-02-01 | 01-02 | 2 | CAN-01 | T-02-INPUT, T-02-TEXT | Focus-safe primitives and inert pasted markup | browser | `npm exec playwright test -- tests/canvas-editing.spec.ts --project=dev` | Yes | passed (automated scope) |
| 01-02-02 | 01-02 | 2 | CAN-02 | T-02-INPUT | Stable native identities, lock and selection guards | browser | `npm exec playwright test -- tests/canvas-arrangement.spec.ts --project=dev` | Yes | passed (automated scope) |
| 01-04-01 | 01-04 | 2 | IMG-02 | T-04-ASSET, T-04-STALE | True source-scale mixed-layer PNG | browser/download | `npm exec playwright test -- tests/image-export.spec.ts --project=prod --grep "whole board"` | Yes | passed (automated scope) |
| 01-04-02 | 01-04 | 2 | IMG-02 | T-04-MEM, T-04-ASSET | Preflight bounds, explicit lower scale and retry | unit/browser | `npm test -- src/canvas/export-plan.test.ts && npm exec playwright test -- tests/image-export.spec.ts --project=prod --grep "limits|recovery"` | Yes | passed (automated scope) |
| 01-03-01 | 01-03 | 3 | IMG-01, CAN-02 | T-03-SIZE, T-03-ACTIVE | Validated picker image and stored pixels | unit/browser | `npm test -- src/canvas/image-input.test.ts && npm exec playwright test -- tests/image-import.spec.ts --project=dev --grep picker` | Yes | passed (automated scope) |
| 01-03-02 | 01-03 | 3 | IMG-01 | T-03-SIZE, T-03-ACTIVE, T-03-RACE | Single event ownership, decode guards and retry | unit/browser | `npm exec playwright test -- tests/image-import.spec.ts --project=dev --project=prod` | Yes | passed (automated scope) |
| 01-05-01 | 01-05 | 4 | IMG-03 | T-05-SCOPE, T-05-GEOM | Selected membership excludes overlapping content | unit/download | `npm test -- src/canvas/export-plan.test.ts && npm exec playwright test -- tests/image-export.spec.ts --project=prod --grep selection` | Yes | passed (automated scope) |
| 01-05-02 | 01-05 | 4 | IMG-02, IMG-03 | T-05-SCOPE, T-05-RACE | Exact frame clip and complete import/export path | unit/download | `npm exec playwright test -- tests/image-export.spec.ts --project=prod --grep "frame|workflow"` | Yes | passed (automated scope) |

Every command fails on nonzero exit or zero matched tests; each PLAN additionally states its assertion-specific failing direction. Run fixed-port browser checks serially across parallel plans 01-02/01-04, while their disjoint source changes may proceed in parallel. Production cross-browser smoke uses `--project=prod-firefox --project=prod-webkit` after plan 01 creates those projects.

## Wave 0 Requirements

- [x] Incorporate the reviewed public upstream source and applicable notices; inspect public content before staging.
- [x] Retrieve dependencies and inspect the exact pinned renderer and input APIs; reproduce baseline checks.
- [x] Broaden browser test discovery, import the shared error fixture, and isolate test contexts/storage.
- [x] Make empty/missing targeted tests fail.
- [x] Create synthetic mixed-board and image fixtures, PNG header/decode/pixel assertions, and font-readiness helpers.
- [x] Create targeted suites in the same plan as their feature; downstream verification depends on them.

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

- [x] Every final task has automated verification or an explicit setup dependency.
- [x] No three consecutive tasks lack an automated check.
- [x] Test setup covers every referenced new suite.
- [x] No watch-mode flags.
- [x] Feedback timing measured.
- [x] All requirements and D-01 through D-15 have execution evidence.
- [x] Set `nyquist_compliant: true` only after validation.

**Validation result:** Passed for phase acceptance. All ten task rows have automated checks; all four UAT checks have user approval. Individual native OS steps were not separately reported; retain that evidence limit.

## Historical Validation Audit 2026-09-11

- Full pre-review regression: 51 unit tests; 202/204 browser cases passed, with two clipboard fixture failures corrected and all four affected project reruns passing (204 composed cases).
- Five review/security fixes: 64 focused browser cases across four projects, 14 focused input unit cases, typecheck and build passed.
- Independent verifier at `010a276`: 35 named production browser cases and nine named unit cases passed; all five roadmap capabilities demonstrated.
- Remaining manual scope: native file-manager drag and file-dialog cancellation; Firefox/WebKit OS clipboard. Chromium Clipboard API with keyboard paste is verified.
- No new automated implementation gap was identified by independent verification. `nyquist_compliant` remains false until the full input scope is evidenced.

| Metric | Count |
|---|---|
| Task rows with automated evidence | 10/10 |
| Requirements with automated evidence | 5/5 |
| Remaining OS-input check groups | 2 |

See [01-VERIFICATION.md](01-VERIFICATION.md) (independent evidence and limitations) and [01-UAT.md](01-UAT.md) (remaining acceptance checks).

## Closure refresh 2026-09-12

Typecheck and production build passed; 51 unit tests and all 256 browser cases passed. All ten task rows have runnable automated coverage, with no watch-mode commands or missing suites. All five requirements and 15 decisions have execution evidence. UAT records 4 user-approved checks; browser-specific OS actions were not individually reported. Earlier pending statements above record the original audit. See 01-VERIFICATION.md for current acceptance and evidence limits.

| Closure metric | Count |
|---|---|
| Automated coverage gaps | 0 |
| User-approved UAT checks | 4 |
| Pending feature acceptance checks | 0 |

Full browser feedback time: 6.9 minutes; unit suite: 1.09 seconds. Historical RED-test process deviation remains recorded in WINDOWS.md.
