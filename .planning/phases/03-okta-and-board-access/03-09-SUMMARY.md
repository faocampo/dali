---
phase: 03-okta-and-board-access
plan: "09"
status: complete
subsystem: canvas-authorization
tags: [blocksuite, yjs, roles, exports, native-input]
requires: [03-05, 03-06, 03-08]
provides: [scoped native mutation guards, Viewer presentation exports, final editable export authorization]
affects: [03-10, 03-11, 03-12]
tech-stack:
  added: []
  patterns: [per-document mutation interception, captured immutable access scope, final-download authorization]
key-files:
  created: [src/canvas/account/mutation-guard.ts, src/canvas/account/mutation-guard.test.ts, src/canvas/export-board.test.ts, tests/board-roles.spec.ts]
  modified: [src/canvas/blocksuite-editor.ts, src/canvas/BlockSuiteCanvas.tsx, src/canvas/export-board.ts, src/header/ExportDialog.tsx, src/header/Header.tsx]
key-decisions:
  - Guard document-local native mutation methods before view mounting, preserving authorized remote integration and restoring instance methods on disposal.
  - Revalidate captured account, board and generation plus server capability immediately before every supported download.
  - Build the existing native archive format through the exported archive helper so missing assets and stale access cannot download a partial backup.
requirements-completed: []
requirements-progressed: [BOARD-04]
duration: 26min
completed: 2026-09-16
plan_head_before: 23b155e7f30d7e605a3871824f110cb38d26fbaf
actuals:
  tokens: 11851
  tokens_basis: realized implementation diff characters divided by four, rounded up; size estimate only
  model_token_usage: unavailable
  tasks: 2
  commits: 4
coverage:
  - id: D1
    description: Native Viewer denial with unchanged local model and vector, server rows and independent Owner rereads; writable role counterparts
    requirement: BOARD-04
    verification:
      - kind: e2e
        ref: tests/board-roles.spec.ts#@03-09-01
        status: pass
      - kind: unit
        ref: src/canvas/account/mutation-guard.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Reader PNG/PDF scope and pixel preservation, editable role enforcement and no stale download
    requirement: BOARD-04
    verification:
      - kind: e2e
        ref: tests/board-roles.spec.ts#@03-09-02
        status: pass
      - kind: unit
        ref: src/canvas/export-board.test.ts
        status: pass
    human_judgment: false
---

# Phase 3 Plan 9: Native read-only editing and permitted exports Summary

**Viewers retain native selection, pan, zoom and scoped PNG/PDF downloads while current account/board/generation guards reject document mutations and editable export without producing an artifact.**

## Task outcomes and commits

1. **03-09-01:** RED `b9c1246`; GREEN `411fde6`. Native guards install before view rendering. Store transactions/history and existing or newly attached nested Y.Map/Y.Array/Y.Text mutation methods consult current immutable access scope. The guard changes only instance methods, shares its lifetime across overlapping mounts, restores methods/listeners on final disposal and keeps captured guarded callbacks inert afterward. Mutation-only custom canvas controls are absent for Viewers. Native pointer selection, wheel zoom, middle-button pan and ordinary Tab navigation remain available.
2. **03-09-02:** RED `f715153`; GREEN `73cbc40`. The shared export service rejects direct Viewer editable export and checks the protected server capability before preparing and immediately before downloading. PNG/PDF retain existing board/frame/selection, scale and background behavior. Native editable archives require all referenced images, preserve snapshot/image contents and dispose their transformer. The dialog starts Viewers on PNG, omits editable format, and the backup button omits Viewer access and reports failures. Final task tests also cover deferred mutation after role/phase/account/board changes and ordinary keyboard navigation.

The four implementation/test commits are measured from the persisted pre-plan ledger through the final GREEN commit. Nine implementation/test files changed. Duration is approximate elapsed execution time; test timings below come from runner output. Model token usage is unavailable; the frontmatter token field estimates diff size only.

## Verification

| Command | Result |
|---|---|
| `npm run typecheck` | Passed; final production harness also typechecked the full tree |
| `npm run typecheck:server` | Passed |
| `npm test` | **102 passed**, 11 files, 1.23 seconds |
| `npm run test:server -- server/boards/actions.test.ts server/boards/access.test.ts` | **22 passed**, 2 files, 2.74 seconds |
| `npm run typecheck && npm exec playwright test -- tests/board-roles.spec.ts --project=prod --grep '@03-09-01'` | **4 passed**, 27.1 seconds at task 1 boundary |
| `npm exec playwright test -- tests/board-roles.spec.ts tests/canvas-editing.spec.ts tests/canvas-arrangement.spec.ts tests/mindmap-formatting.spec.ts tests/image-import.spec.ts --project=prod` | **42 passed**, 1.1 minutes; native mutation, writable drawing/rich text/arrangement, image import/cancellation and formatting regressions |
| `npm exec playwright test -- tests/board-roles.spec.ts tests/mindmap-export.spec.ts --project=prod --grep '@03-09-02\|@02-06'` | **16 passed**, 48.6 seconds |
| `npm run typecheck && npm exec playwright test -- tests/board-roles.spec.ts tests/mindmap-export.spec.ts tests/image-export.spec.ts --project=prod` | Final combined coverage: **38 passed**, 1.7 minutes; 8 role/native/export, 18 image/selection export and 12 map export cases |
| Staged whitespace/privacy inspection | Passed; no tracked deletions |

Every browser run rebuilt production assets and used isolated signed synthetic provider/service listeners. The required selections contain nonzero cases and no skipped assertions. Unexpected page/console error collection remained active. The server test's initial restricted invocation received listener EPERM; rerunning with the authorized loopback permission passed. Initial frame-fixture and keyboard-focus setup issues were corrected before the final passing run. Existing Vite chunk-size and static/dynamic import advisories remain.

### Observed oracles

- Separate signed Owner, Editor and Viewer sessions exercise role behavior. Viewer keyboard create/delete/duplicate/history/formatting attempts, native clipboard paste, constructed drop/composition events, native property/collection/transaction/history attempts and drawing gestures retain the serialized model and exact per-client Yjs clock vector. Server rows and independent Owner editable-export rereads retain document bytes/metadata. The earlier role matrix also proves server rename/duplicate/delete/export denials with unchanged resources.
- Native Owner/Editor map creation, text, child creation, property/collection updates and Chromium clipboard insertion persist through reload. Existing authenticated native drawing, rich text, grouping/arrangement, image import and map formatting regressions pass. Unit tests verify newly attached nested types, captured callbacks, overlapping mount references, restoration, and deferred mutation after Viewer downgrade, paused phase, account change or board change.
- Viewer PNG and PDF each pass whole-board, selected-frame and selected-image scope assertions. PNGs are decoded through canvas pixels; PDF embedded RGB image streams are decompressed and inspected. Green image pixels, blue map pixels, dark text pixels and an outside red shape distinguish authorized content and scope exclusion. Export retains exact local model/vector and independent Owner server results.
- Owner/Editor editable ZIPs contain the native map text snapshot and image asset. Viewer direct-service calls reject; a role downgrade after opening the dialog returns an access error with no artifact. Missing image responses and a different account signing in while an already-authorized image response is delayed both prevent download. The existing image/export suite verifies error retry and decoded results; the existing map/export suite verifies retained hidden content, visible edges and selected membership.

## TDD Gate Compliance

Both tasks had committed intentional RED assertions before their implementation. Task 1 expected the Viewer mutation control to be absent and observed one visible control. Task 2 observed direct Viewer editable export resolving and stale-generation rendering producing a download. Mechanically normalized named-failure evidence from the real runner logs passed `check tdd-red-evidence` with `RED_EVIDENCE_OK` for each task. Final GREEN checks are recorded above. No refactor-only commit was needed.

## Integration and recovery handoff

`accessScopeCurrent(expected, write)` consumes the frozen runtime AccessScope contract: active phase, exact account, board and generation, plus current write capability and non-Viewer role for mutations. It never follows a replacement runtime implicitly. Scope-loss subscription sets Store readonly; final native calls also check the predicate directly. Plan 10 may reinitialize a freshly authorized runtime normally; reuse of a Store requires deliberate readonly restoration only after authorized recovery. This plan does not change the runtime getter/subscriber/suspend signatures.

Viewer authoritative hydration and stopped reader SyncPeer behavior remain from plan 05. Guard installation follows hydration but precedes native rendering; disposal does not clear document data or send compensating writes. Authorized remote Yjs integration uses its internal update path rather than guarded public local mutators. Live collaboration remains Phase 5 work.

D-09 defines supported export operations. Rendering access necessarily exposes readable board content. Server authorization remains the authority for protected resource retrieval and writes.

## Deviations from Plan

1. **[Rule 2 — native lifecycle integration]** Parent approved `src/canvas/blocksuite-editor.ts` ownership so guards install before `std.render()` and clean up after native unmount, covering initial view observers. Commit `411fde6`.
2. **[Rule 2 — direct service and lifetime proof]** Parent approved two focused unit files for direct export dispatch, captured async scope loss, newly nested Yjs types and disposal restoration, avoiding production debug hooks. Commits `411fde6`, `f715153`, `73cbc40`.
3. **[Rule 1 — native archive final boundary]** Installed BlockSuite's convenience exporter downloads internally and continues after missing image errors. Reusing its exported archive builder exposes the final authorization/no-partial-artifact boundary while retaining the native archive format. Commit `73cbc40`.

No new endpoint, schema, dependency or trust boundary was introduced outside the plan's T-03-20 and T-03-21 mutation/export surfaces. No goal-blocking stub or unrun required verification remains.

## Evidence limits and remaining obligations

The new role tests ran in Chromium production mode. Clipboard text paste used Chromium's native clipboard with browser permissions. Drop/composition test events are constructed, and unit deferred callbacks establish the final mutation predicate; they do not establish native OS IME or other-engine OS clipboard behavior. Existing navigation-time image decoding cancellation is separately covered by the authenticated image-import regression. Real 200% browser zoom, assistive-technology behavior and actual-provider acceptance remain plan 12 obligations. Shared BOARD-04 remains open until phase acceptance; phases 4 and 5 retain broader persistence and collaboration acceptance.

References: [03-09-PLAN.md](03-09-PLAN.md) (approved mutation/export requirements), [03-UI-SPEC.md](03-UI-SPEC.md) (role/navigation/export contract), [03-06-SUMMARY.md](03-06-SUMMARY.md) (immutable access scope and asynchronous image insertion), and [03-05-SUMMARY.md](03-05-SUMMARY.md) (readonly hydration and stopped reader synchronization). Version-specific implementation was checked against installed BlockSuite 0.22.4 Store and linked-doc archive sources and pinned Yjs; Context7 CLI was unavailable.

## Self-Check: PASSED

Created files and all four recorded task commits exist. The measured ledger count is four. Final static/browser/unit/server checks passed, and staged whitespace/privacy review found no tracked deletions. Existing unrelated image assets and the orchestration lock were preserved.
