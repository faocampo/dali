---
phase: 01-editable-canvas-and-image-portability
plan: "01"
subsystem: ui
tags: [canvas, blocksuite, indexeddb, vite, playwright]
requires: []
provides:
  - Pinned native editor with verified browser-local sticky persistence
  - Maintained local build and four-project browser harness
affects: [01-02, 01-03, 01-04, 01-05]
tech-stack:
  added: [BlockSuite 0.22.4, React 18.3.1, Vite 7.3.6, Vitest 4.1.11, Playwright 1.62.1]
  patterns: [shared runtime, disposable editor views, real IndexedDB, automatic browser error fixture]
key-files:
  created: [src/canvas/workspace.ts, src/canvas/runtime.ts, tests/community.spec.ts, playwright.config.ts, README.md]
  modified: [LICENSE, package.json, package-lock.json, vite.config.ts]
key-decisions:
  - Retain BlockSuite 0.22.4 and existing storage identifiers.
  - Use maintained Vite 7.3 with its native-decorator-compatible esbuild pipeline.
  - Keep optional sharing empty and attribution linked to the pinned public upstream source.
requirements-completed: []
requirements-addressed: [CAN-01]
coverage:
  - id: local-sticky
    description: A sticky edited through pointer and keyboard input retains its native ID and text after reload.
    requirement: CAN-01
    verification:
      - kind: e2e
        ref: tests/community.spec.ts#creates, edits and reopens exactly one locally stored sticky note
        status: pass
    human_judgment: false
  - id: lifecycle
    description: Reopen cycles, interrupted mounts and rapid board switching preserve board isolation and object counts.
    verification:
      - kind: e2e
        ref: tests/community.spec.ts#interrupted mounting and rapid board switching keep the final board isolated
        status: pass
    human_judgment: false
  - id: save-failure
    description: A real IndexedDB transaction failure reports failed storage and withholds the saved acknowledgement.
    verification:
      - kind: e2e
        ref: tests/community.spec.ts#a failed IndexedDB write is reported without a saved acknowledgement
        status: pass
    human_judgment: false
actuals:
  tokens: 150434
  tasks: 2
  commits: 2
plan_head_before: 0259451e9cfb50f00713680c9b7dd7eb06741aaa
duration: approximately 18min
completed: 2026-09-11
status: complete
---

# Phase 1 Plan 1: Local Canvas Foundation Summary

**Native sticky editing persists through IndexedDB reloads, with tested editor lifecycle and a maintained Vite 7 build.**

## Accomplishments

- Incorporated exactly the approved 45-file dependency closure from DJAI Academy revision `27f8bb97b10984e04e48d7650d954d0a7ecd212c`; retained both complete MIT notices. Added the local run guide as the 46th delivered file.
- Preserved native registrations, edgeless mode, `host.updateComplete`, shared runtime, `djai-storyboard`, catalog and preference keys. Application runtime source remains identical to the pinned upstream.
- Added browser cases for empty-board usability, pointer/keyboard sticky editing, native ID/text retention across reload, repeated editor/library reopening, interrupted mounting, rapid board switching, and actual IndexedDB write rejection.
- Enabled automatic console/page-error assertions through `tests/fixtures.ts`, four explicit browser projects, loopback servers, and missing-test failures. The fixture's explicit injected-error control fails independently of the passing suite.
- Documented installation, local running, verification, exact environment and browser-local storage in [README.md](../../../README.md) (local run and compatibility guide).

## Task Commits

1. `0fd1523` — `feat(01-01): incorporate verified local canvas and persistence tracer`
2. `269140d` — `chore(01-01): maintain canvas build with verified Vite 7 toolchain`

The measured actuals cover the realized source diff at the second task commit; the documentation completion commit follows separately. Source diff character count divided by four, rounded up, produced the token estimate. All task changes were individually staged and reviewed for the publication boundary; generated artifacts stayed ignored.

## Verification Results

| Check | Locked baseline | Maintained build |
|---|---|---|
| Clean installation | `npm ci`: 455 packages | `npm ci`: 467 packages |
| Static types | `npm run typecheck`: pass | `npm run typecheck`: pass |
| Unit suite | 14 passed, Vitest 2.1.9 | 14 passed, Vitest 4.1.11 |
| Production build | Vite 5.4.21: pass | Vite 7.3.6: pass |
| Chromium development | 5 passed | 5 passed |
| Chromium production | 5 passed | 5 passed |
| Firefox production | Established as a project; execution followed on maintained build | 5 passed |
| WebKit production | Established as a project; execution followed on maintained build | 5 passed |

The final `npm run test:browser` ran **20 tests, all passed**, in approximately 1.2 minutes. The baseline dev/prod run passed all 10 cases in 27.5 seconds. Assertions inspect the mounted native store and UI; reload establishes the persistent read path. No document write is substituted with a synthetic success response.

Separate expected-failure controls:

- `DALI_ERROR_CONTROL=1 npm exec playwright test -- tests/community.spec.ts --project=dev --grep 'unexpected page error'` returned nonzero specifically because the automatic fixture captured `Synthetic unexpected page error`.
- `npm test -- src/canvas/nonexistent-control.test.ts` returned 1 with no test files found.
- `npm exec playwright test -- tests/nonexistent-control.spec.ts --list` returned 1 with no tests found.

The normal suite excludes the opt-in error injection. Early harness failures were a syntax error and an ambiguous heading locator; these were corrected before baseline acceptance and are not RED evidence. An initial maintained development run was stopped on the CSS failure documented below; the full matrix was rerun after its fix.

Environment: Node 26.7.0, npm 11.19.0, Playwright 1.62.1; Chromium 151.0.7922.34, Firefox 153.0, WebKit 26.5. Browsers were installed into an external cache; set `PLAYWRIGHT_BROWSERS_PATH` consistently for installation and execution when using a custom cache.

## Dependency Provenance and Maintenance

Before installation, all 19 exact direct package versions were retrieved from the npm registry; every published SHA-512 integrity matched the pinned lockfile. Licenses and lifecycle scripts were inspected: no direct package declared an install/preinstall/postinstall hook. Lockfile resolutions used only `registry.npmjs.org`, with integrity and no embedded credentials. npm reported transitive esbuild/fsevents install-script approval notices; no unverified substitute or automatic audit fix was installed.

| Package(s) | Locked baseline | Final |
|---|---|---|
| Six direct BlockSuite packages | 0.22.4 | 0.22.4 |
| React / React DOM | 18.3.1 | 18.3.1 |
| `@preact/signals-core` | 1.14.4 | 1.14.4 |
| `pdf-lib` | 1.17.1 | 1.17.1 |
| `@playwright/test` | 1.62.1 | 1.62.1 |
| `@types/node` | 22.20.1 | 22.20.1 |
| `@types/react` / `@types/react-dom` | 18.3.31 / 18.3.7 | unchanged |
| TypeScript | 5.9.3 | 5.9.3 |
| Vite | 5.4.21 | 7.3.6 |
| `@vitejs/plugin-react` | 4.7.0 | 5.2.0 |
| `@vanilla-extract/vite-plugin` | 4.0.19 | 5.2.6 |
| Vitest | 2.1.9 | 4.1.11 |

The six direct BlockSuite packages are affine, affine-gfx-group, affine-widget-edgeless-selected-rect, affine-widget-edgeless-zoom-toolbar, store and data-view. Their registry manifests omit repository metadata. Official [BlockSuite v0.22.4 source](https://github.com/toeverything/blocksuite/tree/v0.22.4) (matching package names, versions and MIT declarations; tag commit `a5091e72365a47351f370ca23f212ef43a9d42f0`) completed provenance. Other registry repository fields identify the official [React](https://github.com/facebook/react), [Signals](https://github.com/preactjs/signals), [pdf-lib](https://github.com/Hopding/pdf-lib), [Playwright](https://github.com/microsoft/playwright), [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped), [TypeScript](https://github.com/microsoft/TypeScript), [Vite](https://github.com/vitejs/vite), [React Vite plugin](https://github.com/vitejs/vite-plugin-react), [vanilla-extract](https://github.com/vanilla-extract-css/vanilla-extract), and [Vitest](https://github.com/vitest-dev/vitest) repositories.

Changed packages were verified again before installation through exact-version npm metadata: [Vite 7.3.6](https://registry.npmjs.org/vite/7.3.6), [React plugin 5.2.0](https://registry.npmjs.org/@vitejs%2fplugin-react/5.2.0), [vanilla-extract plugin 5.2.6](https://registry.npmjs.org/@vanilla-extract%2fvite-plugin/5.2.6), and [Vitest 4.1.11](https://registry.npmjs.org/vitest/4.1.11) (licenses, scripts, repository, integrity, engines and compatible peer ranges). Final lockfile integrity matches these values.

Vite's [release policy](https://vite.dev/releases) (maintained lines) lists 7.3 for important/security fixes. Its [Vite 8 migration guidance](https://vite.dev/guide/migration) (Oxc native decorator lowering limitation) supports retaining Vite 7's esbuild path. The [Vite 6](https://v6.vite.dev/guide/migration) and [Vite 7](https://v7.vite.dev/guide/migration) migration guides were checked; ES2022, class-field semantics and vanilla-extract remain explicit.

## Deviations from Plan

### Auto-fixed Issues

1. **[Rule 2 - Public content] Pulled neutral link sanitation forward into task 1.** Upstream links contained personal profile and hosted-product destinations. The publication constraint required replacing them before the incorporation commit. `src/header/links.ts` now uses local home navigation, pinned public source attribution, and intentionally empty optional sharing. Commit: `0fd1523`.
2. **[Rule 1 - Build compatibility] Preserved CSS transforms under Vite 7.** Development dependency optimization inlined BlockSuite `.css.ts` modules, causing a vanilla-extract file-scope exception. A scoped `vite.config.ts` optimizer resolver leaves these modules to the normal Vite transform. Source inspection located the failing `note-edgeless-block.css.ts` call in the optimized dependency chunk. All 20 browser cases pass after the fix. Commit: `269140d`.

## TDD Gate Compliance

Task 1 was marked `tdd="true"`, while plan type was `execute` and workflow TDD mode was disabled. The incorporated upstream already implements the local persistence behavior: newly authored acceptance assertions passed on that functionality. There is **no intentional RED assertion and no RED commit**; this is a recorded TDD deviation, not a claim of RED/GREEN compliance. The orchestrator was informed and instructed preservation of the observed inherited behavior without manufacturing failures. Negative controls prove the harness rejects errors but do not count as a missing-product-behavior RED gate. The process deviation is also recorded as open entry 1 in [WINDOWS.md](../../WINDOWS.md) (cross-phase defect register) for review.

## Deferred Issues

See [deferred-items.md](deferred-items.md) (inherited compatibility, advisory and build-size observations). npm audit found **0 high, 0 critical, 11 moderate affected dependency nodes**, propagated from the inherited nested Vitest/mocker advisory [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) (redirect-mock path traversal). The direct runner is patched 4.1.11; the editor family remains pinned. No untested override or downgrade was applied.

The icons package's Node engine range ends below 23; npm warns on the tested Node 26 runtime. Large inherited bundles also emit size warnings. These observations do not claim future runtime support or complete dependency security.

## Known Stubs

No stubs prevent this plan's goal. Optional sharing targets are deliberately empty under the approved public-content rule; they are disabled optional functionality, with pinned source attribution retained. Existing empty-board UI and native mode no-ops are intentional source behavior. No skipped tests remain.

## Next Plan Readiness

The local skeleton, native APIs, test fixtures and maintained build are ready for the next canvas interaction and image plans. CAN-01 remains unchecked globally because its remaining primitives, pan/zoom and controls require plan 01-02 and phase verification. This plan establishes only the traced local subset.

## Self-Check: PASSED

All 46 source/documentation delivery paths exist. Both task commits are present. Final static, unit, build and 20-case browser checks passed; the deliberate negative controls were kept separate. Source/assets and staged diffs were reviewed for the public boundary. No unexpected tracked-file deletions occurred.
